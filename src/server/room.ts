/**
 * Room class: manages a single battle room's state machine.
 * Lifecycle: waiting → team_preview → battling → finished → (rematch → team_preview)
 */

import { Battle } from '../engine/battle';
import { generateTeam } from '../engine/team-generator';
import { SeededRNG } from '../utils/rng';
import { Player, BattlePokemon, BattleAction, BattleEvent } from '../types';
import { RoomStatus, RoomPlayer } from './types';

export class Room {
  code: string;
  status: RoomStatus;
  players: [RoomPlayer | null, RoomPlayer | null];
  battle: Battle | null;
  teams: [BattlePokemon[] | null, BattlePokemon[] | null];
  /** Track which Pokemon each player has seen from the opponent */
  scoutedPokemon: [Set<number>, Set<number>];
  /** Pending actions for current turn: [p1Action, p2Action] */
  pendingActions: [BattleAction | null, BattleAction | null];
  /** Pending force switch flags */
  pendingForceSwitch: [boolean, boolean];
  /** Rematch request tracking */
  rematchRequested: [boolean, boolean];
  createdAt: number;
  rng: SeededRNG;

  constructor(code: string, seed?: number) {
    this.code = code;
    this.status = 'waiting';
    this.players = [null, null];
    this.battle = null;
    this.teams = [null, null];
    this.scoutedPokemon = [new Set(), new Set()];
    this.pendingActions = [null, null];
    this.pendingForceSwitch = [false, false];
    this.rematchRequested = [false, false];
    this.createdAt = Date.now();
    this.rng = new SeededRNG(seed);
  }

  get playerCount(): number {
    return this.players.filter(p => p !== null).length;
  }

  getPlayerBySocketId(socketId: string): { player: RoomPlayer; index: 0 | 1 } | null {
    for (let i = 0; i < 2; i++) {
      const p = this.players[i as 0 | 1];
      if (p && p.socketId === socketId) {
        return { player: p, index: i as 0 | 1 };
      }
    }
    return null;
  }

  addPlayer(socketId: string, name: string, itemMode: 'competitive' | 'casual' = 'competitive'): { player: RoomPlayer; index: 0 | 1 } | null {
    if (this.status !== 'waiting') return null;

    const slot = this.players[0] === null ? 0 : this.players[1] === null ? 1 : -1;
    if (slot === -1) return null;

    const player: RoomPlayer = {
      socketId,
      name,
      playerIndex: slot as 0 | 1,
      leadSelected: false,
      actionSubmitted: false,
      itemMode,
    };

    this.players[slot as 0 | 1] = player;

    // If both players are in, move to team_preview
    if (this.players[0] !== null && this.players[1] !== null) {
      this.status = 'team_preview';
      this.generateTeams();
    }

    return { player, index: slot as 0 | 1 };
  }

  private generateTeams(): void {
    this.teams[0] = generateTeam(this.rng, { itemMode: this.players[0]!.itemMode });
    this.teams[1] = generateTeam(this.rng, { itemMode: this.players[1]!.itemMode });
  }

  selectLead(playerIndex: 0 | 1, pokemonIndex: number, itemMode: 'competitive' | 'casual'): boolean {
    if (this.status !== 'team_preview') return false;
    const player = this.players[playerIndex];
    if (!player || player.leadSelected) return false;
    const team = this.teams[playerIndex];
    if (!team || pokemonIndex < 0 || pokemonIndex >= team.length) return false;

    player.leadSelected = true;
    player.itemMode = itemMode;

    // Swap lead to front if needed
    if (pokemonIndex !== 0) {
      const temp = team[0];
      team[0] = team[pokemonIndex];
      team[pokemonIndex] = temp;
    }

    // If both leads selected, start the battle
    if (this.players[0]?.leadSelected && this.players[1]?.leadSelected) {
      this.startBattle();
    }

    return true;
  }

  private startBattle(): void {
    const p1 = this.players[0]!;
    const p2 = this.players[1]!;

    const player1: Player = {
      id: 'p1',
      name: p1.name,
      team: this.teams[0]!,
      activePokemonIndex: 0,
      itemMode: p1.itemMode,
      hasMegaEvolved: false,
    };

    const player2: Player = {
      id: 'p2',
      name: p2.name,
      team: this.teams[1]!,
      activePokemonIndex: 0,
      itemMode: p2.itemMode,
      hasMegaEvolved: false,
    };

    this.battle = new Battle(player1, player2, this.rng.seed);
    this.status = 'battling';
    // Mark the active (lead) Pokemon as scouted for both players
    this.scoutedPokemon[0].add(0); // p1 sees p2's lead
    this.scoutedPokemon[1].add(0); // p2 sees p1's lead
  }

  submitAction(playerIndex: 0 | 1, action: BattleAction): { valid: boolean; error?: string } {
    if (this.status !== 'battling' || !this.battle) {
      return { valid: false, error: 'Battle not in progress' };
    }
    if (this.pendingForceSwitch[playerIndex]) {
      return { valid: false, error: 'You need to switch first' };
    }

    const player = this.players[playerIndex];
    if (!player) return { valid: false, error: 'Player not found' };
    if (this.pendingActions[playerIndex] !== null) {
      return { valid: false, error: 'Action already submitted' };
    }

    // Validate the action
    if (action.type === 'move') {
      const availableMoves = this.battle.getAvailableMoves(playerIndex);
      if (availableMoves.length === 0) {
        // Must use Struggle — this is handled by the engine automatically with moveIndex -1
      } else if (!availableMoves.includes(action.moveIndex)) {
        return { valid: false, error: 'Invalid move selection' };
      }
    } else if (action.type === 'switch') {
      const availableSwitches = this.battle.getAvailableSwitches(playerIndex);
      if (!availableSwitches.includes(action.pokemonIndex)) {
        return { valid: false, error: 'Invalid switch target' };
      }
    }

    this.pendingActions[playerIndex] = action;
    return { valid: true };
  }

  /** Returns true if both players have submitted their actions. */
  bothActionsReady(): boolean {
    return this.pendingActions[0] !== null && this.pendingActions[1] !== null;
  }

  /** Process the turn with both submitted actions. */
  processTurn(): BattleEvent[] {
    if (!this.battle || !this.pendingActions[0] || !this.pendingActions[1]) {
      return [];
    }

    const events = this.battle.processTurn(this.pendingActions[0], this.pendingActions[1]);

    // Update scouted Pokemon (switched-in Pokemon become visible)
    for (let i = 0; i < 2; i++) {
      const activeIdx = this.battle.state.players[i].activePokemonIndex;
      // The opponent (1-i) can now see this player's active Pokemon
      this.scoutedPokemon[1 - i].add(activeIdx);
    }

    // Reset pending actions
    this.pendingActions = [null, null];

    // Check for force switches (faint) and self-switches (U-Turn etc.)
    this.pendingForceSwitch[0] = this.battle.needsSwitch(0) || this.battle.needsSelfSwitch(0);
    this.pendingForceSwitch[1] = this.battle.needsSwitch(1) || this.battle.needsSelfSwitch(1);

    // Check for battle end
    if (this.battle.state.status === 'finished') {
      this.status = 'finished';
    }

    return events;
  }

  /** Process a force switch after a faint. Returns events and whether more switches are needed. */
  processForceSwitch(playerIndex: 0 | 1, pokemonIndex: number): {
    events: BattleEvent[];
    needsMoreSwitches: boolean;
    error?: string;
  } {
    if (!this.battle || !this.pendingForceSwitch[playerIndex]) {
      return { events: [], needsMoreSwitches: false, error: 'No force switch needed' };
    }

    const availableSwitches = this.battle.getAvailableSwitches(playerIndex);
    if (!availableSwitches.includes(pokemonIndex)) {
      return { events: [], needsMoreSwitches: true, error: 'Invalid switch target' };
    }

    // Check if this is a selfSwitch (U-Turn etc.) vs a faint switch
    let events: BattleEvent[];
    if (this.battle.needsSelfSwitch(playerIndex)) {
      // Determine if it's Baton Pass (copyvolatile)
      const active = this.battle.getActivePokemon(playerIndex);
      const lastMove = active.lastMoveUsed;
      // Look up the move data to check selfSwitch type
      const moveData = active.moves.find(m => m.data.name === lastMove);
      const isBatonPass = moveData?.data.selfSwitch === 'copyvolatile';
      events = this.battle.processSelfSwitch(playerIndex, pokemonIndex, isBatonPass);
    } else {
      events = this.battle.processForceSwitch(playerIndex, pokemonIndex);
    }
    this.pendingForceSwitch[playerIndex] = false;

    // Update scouted Pokemon
    const activeIdx = this.battle.state.players[playerIndex].activePokemonIndex;
    this.scoutedPokemon[1 - playerIndex].add(activeIdx);

    // Check if hazard KO on switch-in caused another faint
    if (this.battle.needsSwitch(playerIndex)) {
      this.pendingForceSwitch[playerIndex] = true;
    }

    // Check for battle end
    if (this.battle.state.status === 'finished') {
      this.status = 'finished';
    }

    return {
      events,
      needsMoreSwitches: this.pendingForceSwitch[playerIndex],
    };
  }

  /** Returns true if all required force switches have been resolved. */
  allForceSwitchesResolved(): boolean {
    return !this.pendingForceSwitch[0] && !this.pendingForceSwitch[1];
  }

  /** Handle forfeit by a player. */
  forfeit(playerIndex: 0 | 1): BattleEvent[] {
    if (!this.battle || this.status !== 'battling') return [];

    const winnerId = playerIndex === 0 ? 'p2' : 'p1';
    const events: BattleEvent[] = [{
      type: 'battle_end',
      turn: this.battle.state.turn,
      timestamp: new Date().toISOString(),
      data: { winner: winnerId, reason: 'forfeit' },
    }];

    this.battle.state.status = 'finished';
    this.battle.state.winner = winnerId;
    this.status = 'finished';

    return events;
  }

  /** Handle rematch request. Returns true if both players requested. */
  requestRematch(playerIndex: 0 | 1): boolean {
    if (this.status !== 'finished') return false;
    this.rematchRequested[playerIndex] = true;

    if (this.rematchRequested[0] && this.rematchRequested[1]) {
      // Reset for rematch
      this.status = 'team_preview';
      this.battle = null;
      this.scoutedPokemon = [new Set(), new Set()];
      this.pendingActions = [null, null];
      this.pendingForceSwitch = [false, false];
      this.rematchRequested = [false, false];
      this.players[0]!.leadSelected = false;
      this.players[1]!.leadSelected = false;
      this.generateTeams();
      return true;
    }

    return false;
  }

  /** Reconnect a player by name, updating their socket ID. */
  reconnect(socketId: string, name: string): { player: RoomPlayer; index: 0 | 1 } | null {
    for (let i = 0; i < 2; i++) {
      const p = this.players[i as 0 | 1];
      if (p && p.name === name) {
        p.socketId = socketId;
        return { player: p, index: i as 0 | 1 };
      }
    }
    return null;
  }
}
