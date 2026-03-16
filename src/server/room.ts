/**
 * Room class: manages a single battle room's state machine.
 * Lifecycle: waiting → team_preview → battling → finished → (rematch → team_preview)
 */

import { Battle } from '../engine/battle';
import { generateTeam } from '../engine/team-generator';
import { generateDraftPool, generateRoleDraftPool, buildTeamFromDraftPicks, SNAKE_ORDER, DRAFT_ROLES } from '../engine/draft-pool';
import type { DraftPoolEntry, RoleDraftPoolEntry, DraftRole } from '../engine/draft-pool';
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
  /** Generation filter: only use Pokemon from gen <= maxGen (null = all gens) */
  maxGen: number | null;
  /** Legendary mode: high-tier teams (mostly T1) */
  legendaryMode: boolean;
  /** Lock to prevent double-processing turns */
  isProcessingTurn: boolean;
  /** Accumulated events from force switches (both players) */
  forceSwitchEvents: import('../types').BattleEvent[];
  /** Draft mode state */
  draftMode: boolean;
  draftType: 'snake' | 'role';
  roleOrder: DraftRole[];
  megaMode: boolean;
  monotype: string | null;
  draftPool: DraftPoolEntry[];
  draftPicks: [number[], number[]];
  draftCurrentPick: number;
  /** Randomized draft order: maps SNAKE_ORDER slot 0/1 to actual playerIndex */
  draftSlotMap: [0 | 1, 0 | 1];
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
    this.maxGen = null;
    this.legendaryMode = false;
    this.isProcessingTurn = false;
    this.forceSwitchEvents = [];
    this.draftMode = false;
    this.draftType = 'snake';
    this.roleOrder = [...DRAFT_ROLES];
    this.megaMode = false;
    this.monotype = null;
    this.draftPool = [];
    this.draftPicks = [[], []];
    this.draftCurrentPick = 0;
    this.draftSlotMap = [0, 1];
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

    // If both players are in, move to drafting or team_preview
    if (this.players[0] !== null && this.players[1] !== null) {
      if (this.draftMode) {
        this.status = 'drafting';
        if (this.draftType === 'role') {
          this.draftPool = generateRoleDraftPool(this.rng, { maxGen: this.maxGen, legendaryMode: this.legendaryMode });
          // Shuffle role order for variety
          this.roleOrder = [...DRAFT_ROLES];
          this.rng.shuffle(this.roleOrder);
        } else {
          this.draftPool = generateDraftPool(this.rng, { maxGen: this.maxGen, legendaryMode: this.legendaryMode, itemMode: this.players[0]!.itemMode, monotype: this.monotype, megaMode: this.megaMode });
        }
        this.draftPicks = [[], []];
        this.draftCurrentPick = 0;
        // Randomize who picks first
        this.draftSlotMap = this.rng.next() < 0.5 ? [0, 1] : [1, 0];
      } else {
        this.status = 'team_preview';
        this.generateTeams();
      }
    }

    return { player, index: slot as 0 | 1 };
  }

  private generateTeams(): void {
    this.teams[0] = generateTeam(this.rng, { itemMode: this.players[0]!.itemMode, maxGen: this.maxGen, legendaryMode: this.legendaryMode, megaMode: this.megaMode });
    this.teams[1] = generateTeam(this.rng, { itemMode: this.players[1]!.itemMode, maxGen: this.maxGen, legendaryMode: this.legendaryMode, megaMode: this.megaMode });
  }

  rerollDraftPool(): { valid: boolean; error?: string } {
    if (this.status !== 'drafting') {
      return { valid: false, error: 'Not in drafting phase' };
    }
    if (this.draftCurrentPick > 0) {
      return { valid: false, error: 'Cannot reroll after picks have been made' };
    }
    if (this.draftType === 'role') {
      this.draftPool = generateRoleDraftPool(this.rng, { maxGen: this.maxGen, legendaryMode: this.legendaryMode });
      this.roleOrder = [...DRAFT_ROLES];
      this.rng.shuffle(this.roleOrder);
    } else {
      this.draftPool = generateDraftPool(this.rng, { maxGen: this.maxGen, legendaryMode: this.legendaryMode, itemMode: this.players[0]!.itemMode, monotype: this.monotype, megaMode: this.megaMode });
    }
    this.draftPicks = [[], []];
    return { valid: true };
  }

  submitDraftPick(playerIndex: 0 | 1, poolIndex: number): { valid: boolean; draftComplete: boolean; error?: string } {
    if (this.status !== 'drafting') {
      return { valid: false, draftComplete: false, error: 'Not in drafting phase' };
    }
    if (this.draftCurrentPick >= SNAKE_ORDER.length) {
      return { valid: false, draftComplete: false, error: 'Draft already complete' };
    }
    // draftSlotMap maps SNAKE_ORDER slots to actual playerIndex
    const expectedPlayer = this.draftSlotMap[SNAKE_ORDER[this.draftCurrentPick]];
    if (expectedPlayer !== playerIndex) {
      return { valid: false, draftComplete: false, error: 'Not your turn to pick' };
    }
    if (poolIndex < 0 || poolIndex >= this.draftPool.length) {
      return { valid: false, draftComplete: false, error: 'Invalid pool index' };
    }
    const allPicked = [...this.draftPicks[0], ...this.draftPicks[1]];
    if (allPicked.includes(poolIndex)) {
      return { valid: false, draftComplete: false, error: 'Pokemon already picked' };
    }

    // Role draft validation: pick must belong to the current role
    if (this.draftType === 'role') {
      const currentRound = Math.floor(this.draftCurrentPick / 2);
      const currentRole = this.roleOrder[currentRound];
      const entry = this.draftPool[poolIndex] as RoleDraftPoolEntry;
      if (currentRole && entry.role !== currentRole) {
        return { valid: false, draftComplete: false, error: `Pick must be from role: ${currentRole}` };
      }
    }

    this.draftPicks[playerIndex].push(poolIndex);
    this.draftCurrentPick++;

    if (this.draftCurrentPick >= SNAKE_ORDER.length) {
      // Draft complete — build teams
      const p0Species = this.draftPicks[0].map(i => this.draftPool[i].species);
      const p1Species = this.draftPicks[1].map(i => this.draftPool[i].species);
      this.teams[0] = buildTeamFromDraftPicks(p0Species, this.rng, { itemMode: this.players[0]!.itemMode, maxGen: this.maxGen });
      this.teams[1] = buildTeamFromDraftPicks(p1Species, this.rng, { itemMode: this.players[1]!.itemMode, maxGen: this.maxGen });
      this.status = 'team_preview';
      return { valid: true, draftComplete: true };
    }

    return { valid: true, draftComplete: false };
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

  /** Returns true if both players have submitted their actions and no force switches are pending. */
  bothActionsReady(): boolean {
    if (this.isProcessingTurn) return false;
    if (this.pendingForceSwitch[0] || this.pendingForceSwitch[1]) return false;
    return this.pendingActions[0] !== null && this.pendingActions[1] !== null;
  }

  /** Process the turn with both submitted actions. */
  processTurn(): BattleEvent[] {
    if (!this.battle || !this.pendingActions[0] || !this.pendingActions[1]) {
      return [];
    }
    this.isProcessingTurn = true;
    this.forceSwitchEvents = [];

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

    // Release processing lock if no force switches needed
    if (!this.pendingForceSwitch[0] && !this.pendingForceSwitch[1]) {
      this.isProcessingTurn = false;
    }

    // Check for battle end
    if (this.battle.state.status === 'finished') {
      this.status = 'finished';
      this.isProcessingTurn = false;
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

    // Accumulate force switch events for both players
    this.forceSwitchEvents.push(...events);

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
      this.isProcessingTurn = false;
    }

    return {
      events,
      needsMoreSwitches: this.pendingForceSwitch[playerIndex],
    };
  }

  /** Returns true if all required force switches have been resolved. */
  allForceSwitchesResolved(): boolean {
    const resolved = !this.pendingForceSwitch[0] && !this.pendingForceSwitch[1];
    if (resolved) {
      this.isProcessingTurn = false;
    }
    return resolved;
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
      this.battle = null;
      this.scoutedPokemon = [new Set(), new Set()];
      this.pendingActions = [null, null];
      this.pendingForceSwitch = [false, false];
      this.rematchRequested = [false, false];
      this.players[0]!.leadSelected = false;
      this.players[1]!.leadSelected = false;

      if (this.draftMode) {
        this.status = 'drafting';
        if (this.draftType === 'role') {
          this.draftPool = generateRoleDraftPool(this.rng, { maxGen: this.maxGen, legendaryMode: this.legendaryMode });
          this.roleOrder = [...DRAFT_ROLES];
          this.rng.shuffle(this.roleOrder);
        } else {
          this.draftPool = generateDraftPool(this.rng, { maxGen: this.maxGen, legendaryMode: this.legendaryMode, itemMode: this.players[0]!.itemMode, monotype: this.monotype, megaMode: this.megaMode });
        }
        this.draftPicks = [[], []];
        this.draftCurrentPick = 0;
        this.draftSlotMap = this.rng.next() < 0.5 ? [0, 1] : [1, 0];
      } else {
        this.status = 'team_preview';
        this.generateTeams();
      }
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
