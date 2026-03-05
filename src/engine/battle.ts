import {
  BattleState, BattleAction, MoveAction, SwitchAction, Player,
  BattlePokemon, Weather, SideEffects, BattleEvent, StatusCondition,
  PokemonType, BoostableStat, MoveData,
} from '../types';
import { calculateDamage, rollCritical, rollAccuracy } from './damage';
import { getTypeEffectiveness } from '../data/type-chart';
import { clampHp, getStatStageMultiplier } from '../utils/stats';
import { SeededRNG } from '../utils/rng';
import { BattleLogger } from '../logging/logger';

/** Translate Showdown abbreviations to our StatusCondition names */
const STATUS_ALIASES: Record<string, string> = {
  par: 'paralysis', slp: 'sleep', brn: 'burn',
  frz: 'freeze', psn: 'poison', tox: 'toxic',
};

/** Translate Showdown weather names to our Weather type */
const WEATHER_ALIASES: Record<string, Weather> = {
  RainDance: 'rain', raindance: 'rain', rain: 'rain',
  Sandstorm: 'sandstorm', sandstorm: 'sandstorm',
  sunnyday: 'sun', SunnyDay: 'sun', sun: 'sun',
  snowscape: 'hail', Snowscape: 'hail', hail: 'hail',
};

export class Battle {
  state: BattleState;
  rng: SeededRNG;
  logger: BattleLogger;
  /** Flags set during turn when a selfSwitch move (U-Turn etc.) needs a switch after the turn */
  pendingSelfSwitch: [boolean, boolean] = [false, false];

  constructor(
    player1: Player,
    player2: Player,
    seed?: number
  ) {
    this.rng = new SeededRNG(seed);
    const battleId = `battle_${Date.now()}_${this.rng.seed}`;
    this.logger = new BattleLogger(battleId);

    this.state = {
      id: battleId,
      turn: 0,
      players: [player1, player2],
      weather: 'none',
      weatherTurnsRemaining: 0,
      fieldEffects: {
        player1Side: createEmptySideEffects(),
        player2Side: createEmptySideEffects(),
      },
      status: 'active',
      winner: null,
      rngSeed: this.rng.seed,
      log: [],
    };

    this.logger.info('battle', 'Battle created', {
      battleId,
      seed: this.rng.seed,
      player1: player1.name,
      player2: player2.name,
    });
  }

  getActivePokemon(playerIndex: number): BattlePokemon {
    const player = this.state.players[playerIndex];
    return player.team[player.activePokemonIndex];
  }

  getSideEffects(playerIndex: number): SideEffects {
    return playerIndex === 0
      ? this.state.fieldEffects.player1Side
      : this.state.fieldEffects.player2Side;
  }

  /**
   * Process a full turn: both players submit actions, resolve in order.
   */
  processTurn(action1: BattleAction, action2: BattleAction): BattleEvent[] {
    if (this.state.status !== 'active') {
      this.logger.warn('battle', 'Attempted to process turn on non-active battle');
      return [];
    }

    this.state.turn++;
    const events: BattleEvent[] = [];

    this.logger.info('turn', `Turn ${this.state.turn} start`, {
      player1Action: action1,
      player2Action: action2,
    });

    // Reset per-turn state
    this.pendingSelfSwitch = [false, false];
    const active0 = this.getActivePokemon(0);
    const active1 = this.getActivePokemon(1);
    // Track if Protect was used last turn (for consecutive failure)
    active0.protectedLastTurn = active0.volatileStatuses.has('protect') || active0.volatileStatuses.has('endure');
    active1.protectedLastTurn = active1.volatileStatuses.has('protect') || active1.volatileStatuses.has('endure');
    active0.volatileStatuses.delete('protect');
    active1.volatileStatuses.delete('protect');
    active0.volatileStatuses.delete('endure');
    active1.volatileStatuses.delete('endure');
    active0.hasMovedThisTurn = false;
    active1.hasMovedThisTurn = false;
    active0.tookDamageThisTurn = false;
    active1.tookDamageThisTurn = false;
    active0.turnsOnField++;
    active1.turnsOnField++;

    // Handle forfeits
    if (action1.type === 'forfeit') {
      this.endBattle(this.state.players[1].id, 'forfeit', events);
      return events;
    }
    if (action2.type === 'forfeit') {
      this.endBattle(this.state.players[0].id, 'forfeit', events);
      return events;
    }

    // Determine action order
    const orderedActions = this.determineActionOrder(action1, action2);

    // Execute actions in order
    for (const { action, playerIndex, opponentIndex } of orderedActions) {
      // Check if the acting Pokemon is still alive
      const pokemon = this.getActivePokemon(playerIndex);
      if (!pokemon.isAlive) continue;

      if (action.type === 'switch') {
        this.executeSwitch(playerIndex, (action as SwitchAction).pokemonIndex, events);
      } else if (action.type === 'move') {
        this.executeMove(playerIndex, opponentIndex, (action as MoveAction).moveIndex, events);
      }

      // Check for KOs after each action
      if (this.checkBattleEnd(events)) return events;
    }

    // End-of-turn effects
    this.processEndOfTurn(events);

    // Check for KOs after end-of-turn
    this.checkBattleEnd(events);

    this.logger.info('turn', `Turn ${this.state.turn} end`, {
      weather: this.state.weather,
      p1Active: this.getActivePokemon(0).species.name,
      p1Hp: `${this.getActivePokemon(0).currentHp}/${this.getActivePokemon(0).maxHp}`,
      p2Active: this.getActivePokemon(1).species.name,
      p2Hp: `${this.getActivePokemon(1).currentHp}/${this.getActivePokemon(1).maxHp}`,
    });

    return events;
  }

  /**
   * Handle forced switch (after a Pokemon faints).
   */
  processForceSwitch(playerIndex: number, pokemonIndex: number): BattleEvent[] {
    const events: BattleEvent[] = [];
    this.executeSwitch(playerIndex, pokemonIndex, events);
    return events;
  }

  /**
   * Check if a player needs to switch (active Pokemon fainted).
   */
  needsSwitch(playerIndex: number): boolean {
    const player = this.state.players[playerIndex];
    const active = player.team[player.activePokemonIndex];
    if (active.isAlive) return false;
    // Check if there are alive Pokemon to switch to
    return player.team.some(p => p.isAlive);
  }

  /**
   * Get available switch targets for a player.
   */
  getAvailableSwitches(playerIndex: number): number[] {
    const player = this.state.players[playerIndex];
    return player.team
      .map((p, i) => ({ pokemon: p, index: i }))
      .filter(({ pokemon, index }) => pokemon.isAlive && index !== player.activePokemonIndex)
      .map(({ index }) => index);
  }

  /**
   * Get available moves for active Pokemon.
   */
  getAvailableMoves(playerIndex: number): number[] {
    const pokemon = this.getActivePokemon(playerIndex);

    // Encore lock: forced to repeat the encore'd move
    if (pokemon.encoreTurns > 0 && pokemon.encoreMove) {
      const encoreIdx = pokemon.moves.findIndex(m => m.data.name === pokemon.encoreMove);
      if (encoreIdx !== -1 && pokemon.moves[encoreIdx].currentPp > 0) {
        return [encoreIdx];
      }
      // Encore'd move has no PP — encore ends, fallthrough to normal selection
      pokemon.encoreTurns = 0;
      pokemon.encoreMove = null;
      pokemon.volatileStatuses.delete('encore');
    }

    // If choice-locked, can only use that move
    if (pokemon.choiceLocked) {
      const lockedIdx = pokemon.moves.findIndex(m => m.data.name === pokemon.choiceLocked);
      if (lockedIdx !== -1 && pokemon.moves[lockedIdx].currentPp > 0) {
        return [lockedIdx];
      }
      // Choice locked but out of PP — Struggle
      return [];
    }

    const available = pokemon.moves
      .map((m, i) => ({ move: m, index: i }))
      .filter(({ move }) => move.currentPp > 0 && !move.disabled)
      .map(({ index }) => index);

    return available;
  }

  /**
   * Check if a player needs a self-switch (after U-Turn, Volt Switch, etc.).
   */
  needsSelfSwitch(playerIndex: number): boolean {
    return this.pendingSelfSwitch[playerIndex as 0 | 1];
  }

  /**
   * Process a self-switch (U-Turn, Volt Switch, Baton Pass, etc.).
   * For Baton Pass, stats and volatile statuses are passed to the incoming Pokemon.
   */
  processSelfSwitch(playerIndex: number, pokemonIndex: number, isBatonPass: boolean): BattleEvent[] {
    const events: BattleEvent[] = [];
    const player = this.state.players[playerIndex];
    const oldPokemon = player.team[player.activePokemonIndex];

    if (isBatonPass && oldPokemon.isAlive) {
      // Save boosts and volatile statuses to pass
      const savedBoosts = { ...oldPokemon.boosts };
      const savedVolatile = new Set(oldPokemon.volatileStatuses);
      const savedSubHp = oldPokemon.substituteHp;

      this.executeSwitch(playerIndex, pokemonIndex, events);

      // Apply passed stats to the new Pokemon
      const newPokemon = player.team[player.activePokemonIndex];
      newPokemon.boosts = savedBoosts;
      for (const vs of savedVolatile) {
        if (vs !== 'flinch' && vs !== 'protect') {
          newPokemon.volatileStatuses.add(vs);
        }
      }
      newPokemon.substituteHp = savedSubHp;
    } else {
      this.executeSwitch(playerIndex, pokemonIndex, events);
    }

    this.pendingSelfSwitch[playerIndex as 0 | 1] = false;
    return events;
  }

  // --- Action ordering ---

  private determineActionOrder(
    action1: BattleAction,
    action2: BattleAction
  ): { action: BattleAction; playerIndex: number; opponentIndex: number }[] {
    // Switches always go before moves
    const p1Priority = this.getActionPriority(action1, 0);
    const p2Priority = this.getActionPriority(action2, 1);

    if (p1Priority !== p2Priority) {
      if (p1Priority > p2Priority) {
        return [
          { action: action1, playerIndex: 0, opponentIndex: 1 },
          { action: action2, playerIndex: 1, opponentIndex: 0 },
        ];
      } else {
        return [
          { action: action2, playerIndex: 1, opponentIndex: 0 },
          { action: action1, playerIndex: 0, opponentIndex: 1 },
        ];
      }
    }

    // Same priority bracket — compare speed
    const speed1 = this.getEffectiveSpeed(0);
    const speed2 = this.getEffectiveSpeed(1);

    if (speed1 !== speed2) {
      if (speed1 > speed2) {
        return [
          { action: action1, playerIndex: 0, opponentIndex: 1 },
          { action: action2, playerIndex: 1, opponentIndex: 0 },
        ];
      } else {
        return [
          { action: action2, playerIndex: 1, opponentIndex: 0 },
          { action: action1, playerIndex: 0, opponentIndex: 1 },
        ];
      }
    }

    // Speed tie — coin flip
    if (this.rng.chance(50)) {
      return [
        { action: action1, playerIndex: 0, opponentIndex: 1 },
        { action: action2, playerIndex: 1, opponentIndex: 0 },
      ];
    } else {
      return [
        { action: action2, playerIndex: 1, opponentIndex: 0 },
        { action: action1, playerIndex: 0, opponentIndex: 1 },
      ];
    }
  }

  private getActionPriority(action: BattleAction, playerIndex: number): number {
    if (action.type === 'switch') return 100; // Switches go first
    if (action.type === 'move') {
      const pokemon = this.getActivePokemon(playerIndex);
      const move = pokemon.moves[(action as MoveAction).moveIndex];
      if (move) {
        let priority = move.data.priority;
        // Prankster: +1 priority for Status moves
        if (pokemon.ability === 'Prankster' && move.data.category === 'Status') {
          priority += 1;
        }
        // Gale Wings: +1 priority for Flying-type moves at full HP
        if (pokemon.ability === 'Gale Wings' && move.data.type === 'Flying' && pokemon.currentHp === pokemon.maxHp) {
          priority += 1;
        }
        // Triage: +3 priority for healing moves
        if (pokemon.ability === 'Triage' && move.data.flags.drain) {
          priority += 3;
        }
        return priority;
      }
    }
    return 0;
  }

  private getEffectiveSpeed(playerIndex: number): number {
    const pokemon = this.getActivePokemon(playerIndex);
    let speed = pokemon.stats.spe;

    // Apply boost stages
    speed = Math.floor(speed * getStatStageMultiplier(pokemon.boosts.spe));

    // Paralysis halves speed
    if (pokemon.status === 'paralysis') {
      speed = Math.floor(speed * 0.5);
    }

    // Weather speed abilities
    if (pokemon.ability === 'Chlorophyll' && this.state.weather === 'sun') speed = Math.floor(speed * 2);
    if (pokemon.ability === 'Swift Swim' && this.state.weather === 'rain') speed = Math.floor(speed * 2);
    if (pokemon.ability === 'Sand Rush' && this.state.weather === 'sandstorm') speed = Math.floor(speed * 2);
    if (pokemon.ability === 'Slush Rush' && this.state.weather === 'hail') speed = Math.floor(speed * 2);
    // Unburden: doubles speed when item is consumed
    if (pokemon.ability === 'Unburden' && pokemon.itemConsumed) speed = Math.floor(speed * 2);

    // Choice Scarf
    if (pokemon.item === 'Choice Scarf') {
      speed = Math.floor(speed * 1.5);
    }

    // Tailwind doubles speed
    const side = this.getSideEffects(playerIndex);
    if (side.tailwind > 0) {
      speed = Math.floor(speed * 2);
    }

    return Math.max(1, speed);
  }

  // --- Move execution ---

  private executeMove(
    playerIndex: number,
    opponentIndex: number,
    moveIndex: number,
    events: BattleEvent[]
  ): void {
    const attacker = this.getActivePokemon(playerIndex);
    const defender = this.getActivePokemon(opponentIndex);

    // Check for all PP used — use Struggle
    let move: MoveData;
    let isStruggle = false;

    if (moveIndex < 0 || moveIndex >= attacker.moves.length || this.getAvailableMoves(playerIndex).length === 0) {
      move = STRUGGLE;
      isStruggle = true;
    } else {
      const battleMove = attacker.moves[moveIndex];
      if (battleMove.currentPp <= 0) {
        move = STRUGGLE;
        isStruggle = true;
      } else {
        move = battleMove.data;
        // Deduct PP
        battleMove.currentPp--;
        // Pressure: deduct extra PP
        if (defender.ability === 'Pressure' && battleMove.currentPp > 0) {
          battleMove.currentPp--;
        }
      }
    }

    this.logger.debug('move', `${attacker.species.name} uses ${move.name}`, {
      player: playerIndex,
      move: move.name,
      pp: isStruggle ? 'Struggle' : attacker.moves[moveIndex]?.currentPp,
    });

    // Recharge turn (Hyper Beam, Giga Impact)
    if (attacker.mustRecharge) {
      attacker.mustRecharge = false;
      this.addEvent(events, 'cant_move', { pokemon: attacker.species.name, reason: 'recharge' });
      return;
    }

    // Check paralysis
    if (attacker.status === 'paralysis' && this.rng.chance(25)) {
      this.addEvent(events, 'cant_move', { pokemon: attacker.species.name, reason: 'paralysis' });
      return;
    }

    // Check sleep (Sleep Talk bypasses this)
    if (attacker.status === 'sleep' && move.name !== 'Sleep Talk') {
      if (attacker.sleepTurns > 0) {
        attacker.sleepTurns--;
        this.addEvent(events, 'cant_move', { pokemon: attacker.species.name, reason: 'sleep' });
        return;
      } else {
        // Wake up
        attacker.status = null;
        this.addEvent(events, 'status_cure', { pokemon: attacker.species.name, status: 'sleep' });
      }
    }

    // Check freeze (20% chance to thaw each turn)
    if (attacker.status === 'freeze') {
      if (move.flags.defrost) {
        attacker.status = null;
        this.addEvent(events, 'status_cure', { pokemon: attacker.species.name, status: 'freeze', reason: 'defrost_move' });
      } else if (this.rng.chance(20)) {
        attacker.status = null;
        this.addEvent(events, 'status_cure', { pokemon: attacker.species.name, status: 'freeze' });
      } else {
        this.addEvent(events, 'cant_move', { pokemon: attacker.species.name, reason: 'freeze' });
        return;
      }
    }

    // Check confusion
    if (attacker.volatileStatuses.has('confusion')) {
      if (attacker.confusionTurns <= 0) {
        attacker.volatileStatuses.delete('confusion');
        this.addEvent(events, 'volatile_cure', { pokemon: attacker.species.name, status: 'confusion' });
      } else {
        attacker.confusionTurns--;
        if (this.rng.chance(33)) {
          // Hit self in confusion
          const confusionDamage = this.calculateConfusionDamage(attacker);
          attacker.currentHp = clampHp(attacker.currentHp - confusionDamage, attacker.maxHp);
          this.addEvent(events, 'confusion_self_hit', {
            pokemon: attacker.species.name,
            damage: confusionDamage,
          });
          this.checkFaint(attacker, playerIndex, events);
          return;
        }
      }
    }

    // Flinch check
    if (attacker.volatileStatuses.has('flinch')) {
      attacker.volatileStatuses.delete('flinch');
      this.addEvent(events, 'cant_move', { pokemon: attacker.species.name, reason: 'flinch' });
      return;
    }

    // Truant: skip every other turn
    if (attacker.ability === 'Truant' && attacker.truantNextTurn) {
      attacker.truantNextTurn = false;
      this.addEvent(events, 'cant_move', { pokemon: attacker.species.name, reason: 'loafing' });
      return;
    }

    // Fake Out: only works on the first turn after entering battle
    if (move.name === 'Fake Out' && attacker.turnsOnField > 1) {
      this.addEvent(events, 'use_move', {
        pokemon: attacker.species.name,
        move: move.name,
        player: playerIndex,
      });
      this.addEvent(events, 'move_fail', { pokemon: attacker.species.name, move: move.name, reason: 'not first turn' });
      return;
    }

    // Focus Punch: fails if user took damage this turn
    if (move.name === 'Focus Punch' && attacker.tookDamageThisTurn) {
      this.addEvent(events, 'use_move', {
        pokemon: attacker.species.name,
        move: move.name,
        player: playerIndex,
      });
      this.addEvent(events, 'cant_move', { pokemon: attacker.species.name, reason: 'lost focus' });
      return;
    }

    this.addEvent(events, 'use_move', {
      pokemon: attacker.species.name,
      move: move.name,
      player: playerIndex,
    });

    // Accuracy check
    if (!rollAccuracy(this.rng, move.accuracy, attacker.boosts.accuracy, defender.boosts.evasion, {
      moveName: move.name,
      weather: this.state.weather,
      attackerAbility: attacker.ability,
    })) {
      this.addEvent(events, 'miss', { pokemon: attacker.species.name, move: move.name });
      return;
    }

    // Protect check — blocks most moves targeting the defender
    if (defender.volatileStatuses.has('protect') && move.target !== 'self' && move.target !== 'allySide') {
      this.addEvent(events, 'protected', { pokemon: defender.species.name, move: move.name });
      return;
    }

    // Substitute check — absorbs damage for the pokemon behind it
    if (defender.substituteHp > 0 && move.category !== 'Status') {
      // Damage hits the substitute instead
    }

    // Type immunity check for non-status moves (Struggle bypasses type immunity)
    if (move.category !== 'Status' && !isStruggle) {
      const effectiveness = getTypeEffectiveness(
        move.type as PokemonType,
        defender.species.types as PokemonType[]
      );
      if (effectiveness === 0) {
        this.addEvent(events, 'immune', {
          target: defender.species.name,
          move: move.name,
          reason: 'type_immunity',
        });
        return;
      }
    }

    // Ability-based immunity checks
    if (this.checkAbilityImmunity(defender, move, events)) {
      return;
    }

    // Execute the move
    if (move.category === 'Status') {
      this.executeStatusMove(attacker, defender, move, playerIndex, opponentIndex, events);
    } else {
      this.executeDamagingMove(attacker, defender, move, playerIndex, opponentIndex, isStruggle, events);
    }

    // Rapid Spin: clear hazards and +1 Speed on hit
    if (move.name === 'Rapid Spin' && attacker.isAlive) {
      const side = this.getSideEffects(playerIndex);
      let cleared = false;
      if (side.stealthRock) { side.stealthRock = false; cleared = true; }
      if (side.spikesLayers > 0) { side.spikesLayers = 0; cleared = true; }
      if (side.toxicSpikesLayers > 0) { side.toxicSpikesLayers = 0; cleared = true; }
      if (side.stickyWeb) { side.stickyWeb = false; cleared = true; }
      if (cleared) {
        this.addEvent(events, 'hazard_clear', { pokemon: attacker.species.name, move: 'Rapid Spin' });
      }
      // Also remove Leech Seed and partial trapping
      attacker.volatileStatuses.delete('leechseed');
      attacker.volatileStatuses.delete('partiallytrapped' as any);
      this.applyBoost(attacker, 'spe', 1, events);
    }

    // Defog: clear all hazards from both sides
    if (move.name === 'Defog') {
      for (let i = 0; i < 2; i++) {
        const side = this.getSideEffects(i);
        side.stealthRock = false;
        side.spikesLayers = 0;
        side.toxicSpikesLayers = 0;
        side.stickyWeb = false;
      }
      this.addEvent(events, 'hazard_clear', { pokemon: attacker.species.name, move: 'Defog' });
    }

    // Set last move used
    attacker.lastMoveUsed = move.name;
    attacker.hasMovedThisTurn = true;

    // Truant: flag to skip next turn
    if (attacker.ability === 'Truant') {
      attacker.truantNextTurn = true;
    }

    // Recharge: flag to skip next turn (Hyper Beam, Giga Impact, etc.)
    if (move.flags.recharge && attacker.isAlive) {
      attacker.mustRecharge = true;
    }

    // Choice lock
    if (!isStruggle && (attacker.item === 'Choice Band' || attacker.item === 'Choice Specs' || attacker.item === 'Choice Scarf')) {
      attacker.choiceLocked = move.name;
    }

    // selfSwitch (U-Turn, Flip Turn, Volt Switch, Baton Pass, Parting Shot, etc.)
    if (move.selfSwitch && attacker.isAlive) {
      const switches = this.getAvailableSwitches(playerIndex);
      if (switches.length > 0) {
        this.pendingSelfSwitch[playerIndex as 0 | 1] = true;
      }
    }

    // forceSwitch (Roar, Whirlwind, Dragon Tail, Circle Throw)
    if (move.forceSwitch && defender.isAlive) {
      const oppSwitches = this.getAvailableSwitches(opponentIndex);
      if (oppSwitches.length > 0) {
        const target = oppSwitches[this.rng.int(0, oppSwitches.length - 1)];
        this.executeSwitch(opponentIndex, target, events);
      }
    }
  }

  private executeDamagingMove(
    attacker: BattlePokemon,
    defender: BattlePokemon,
    move: MoveData,
    playerIndex: number,
    opponentIndex: number,
    isStruggle: boolean,
    events: BattleEvent[]
  ): void {
    // Get ability/item modifiers
    const modifiers = this.getAbilityItemModifiers(attacker, defender, move);

    // Critical hit check
    let critStage = move.critRatio !== undefined ? move.critRatio : 0;
    // Focus Energy
    if (attacker.volatileStatuses.has('focusenergy')) critStage += 2;
    // Super Luck
    if (attacker.ability === 'Super Luck') critStage++;
    // Scope Lens / Razor Claw
    if (attacker.item === 'Scope Lens' || attacker.item === 'Razor Claw') critStage++;

    const isCritical = move.willCrit || rollCritical(this.rng, critStage);

    // Multi-hit moves
    const hits = this.getHitCount(move);
    let totalDamage = 0;

    for (let hit = 0; hit < hits; hit++) {
      if (!defender.isAlive) break;

      const result = calculateDamage(
        attacker, defender, move, this.state.weather,
        this.rng, isCritical && hit === 0, modifiers
      );

      // Cap damage at defender's remaining HP
      let damage = Math.min(result.finalDamage, defender.currentHp);

      // Focus Sash: survive at 1 HP if at full HP (single use)
      if (damage >= defender.currentHp && defender.currentHp === defender.maxHp &&
          defender.item === 'Focus Sash' && !defender.itemConsumed) {
        damage = defender.currentHp - 1;
        defender.itemConsumed = true;
        this.addEvent(events, 'item_trigger', { pokemon: defender.species.name, item: 'Focus Sash' });
      }
      // Sturdy: survive at 1 HP if at full HP
      if (damage >= defender.currentHp && defender.currentHp === defender.maxHp &&
          defender.ability === 'Sturdy') {
        damage = defender.currentHp - 1;
        this.addEvent(events, 'ability_trigger', { pokemon: defender.species.name, ability: 'Sturdy' });
      }

      totalDamage += damage;

      // Apply damage
      defender.currentHp = clampHp(defender.currentHp - damage, defender.maxHp);
      if (damage > 0) {
        defender.tookDamageThisTurn = true;
        // Air Balloon pops when hit
        if (defender.item === 'Air Balloon' && !defender.itemConsumed) {
          defender.itemConsumed = true;
          this.addEvent(events, 'item_trigger', { pokemon: defender.species.name, item: 'Air Balloon', message: 'popped' });
        }
      }

      this.logger.debug('damage', `${attacker.species.name}'s ${move.name} dealt ${damage} to ${defender.species.name}`, {
        ...result,
        hit: hit + 1,
        totalHits: hits,
        remainingHp: defender.currentHp,
      });

      if (hit === 0) {
        this.addEvent(events, 'damage', {
          attacker: attacker.species.name,
          defender: defender.species.name,
          move: move.name,
          damage,
          totalDamage: hits > 1 ? undefined : damage,
          isCritical,
          effectiveness: result.typeEffectiveness,
          remainingHp: defender.currentHp,
          maxHp: defender.maxHp,
        });
      }

      this.checkFaint(defender, opponentIndex, events, true);
    }

    if (hits > 1) {
      this.addEvent(events, 'multi_hit', {
        move: move.name,
        hits,
        totalDamage,
      });
    }

    // Effectiveness message
    const eff = getTypeEffectiveness(move.type as PokemonType, defender.species.types as PokemonType[]);
    if (eff > 1) {
      this.addEvent(events, 'super_effective', { target: defender.species.name });
    } else if (eff < 1 && eff > 0) {
      this.addEvent(events, 'not_very_effective', { target: defender.species.name });
    }

    // Recoil damage
    if (move.flags.recoil && totalDamage > 0) {
      const recoilDamage = Math.max(1, Math.floor(totalDamage * (move.flags.recoil as number)));
      if (attacker.ability !== 'Rock Head' && attacker.ability !== 'Magic Guard') {
        attacker.currentHp = clampHp(attacker.currentHp - recoilDamage, attacker.maxHp);
        this.addEvent(events, 'recoil', {
          pokemon: attacker.species.name,
          damage: recoilDamage,
        });
        this.checkFaint(attacker, playerIndex, events);
      }
    }

    // Self-destruct moves (Explosion, Self-Destruct) — user faints
    if ((move as any).selfdestruct && attacker.isAlive) {
      attacker.currentHp = 0;
      this.checkFaint(attacker, playerIndex, events);
    }

    // Struggle recoil (25% of max HP)
    if (isStruggle) {
      const struggleRecoil = Math.max(1, Math.floor(attacker.maxHp / 4));
      attacker.currentHp = clampHp(attacker.currentHp - struggleRecoil, attacker.maxHp);
      this.addEvent(events, 'recoil', {
        pokemon: attacker.species.name,
        damage: struggleRecoil,
        reason: 'Struggle',
      });
      this.checkFaint(attacker, playerIndex, events);
    }

    // Drain
    if (move.flags.drain && totalDamage > 0) {
      const drainAmount = Math.max(1, Math.floor(totalDamage * (move.flags.drain as number)));
      const healed = Math.min(drainAmount, attacker.maxHp - attacker.currentHp);
      attacker.currentHp = clampHp(attacker.currentHp + drainAmount, attacker.maxHp);
      if (healed > 0) {
        this.addEvent(events, 'drain', {
          pokemon: attacker.species.name,
          amount: healed,
        });
      }
    }

    // Secondary effects (status, stat drops, flinch)
    // Sheer Force: suppress secondary effects (they got the 1.3x power boost instead)
    const hasSecondaryEffects = move.effects && move.effects.some(e =>
      e.type === 'status' || e.type === 'flinch' || (e.type === 'boost' && e.target !== 'self')
    );
    const sheerForceActive = attacker.ability === 'Sheer Force' && hasSecondaryEffects;

    // Life Orb recoil (skip if attacker already fainted from move recoil)
    // Sheer Force also suppresses Life Orb recoil when secondary effects are present
    if (attacker.isAlive && attacker.item === 'Life Orb' && totalDamage > 0 && attacker.ability !== 'Magic Guard' && !sheerForceActive) {
      const lifeOrbRecoil = Math.max(1, Math.floor(attacker.maxHp / 10));
      attacker.currentHp = clampHp(attacker.currentHp - lifeOrbRecoil, attacker.maxHp);
      this.addEvent(events, 'item_damage', {
        pokemon: attacker.species.name,
        item: 'Life Orb',
        damage: lifeOrbRecoil,
      });
      this.checkFaint(attacker, playerIndex, events);
    }

    // Self-targeting effects (like Close Combat's -1 Def/-1 SpD) must apply even if defender fainted
    if (sheerForceActive) {
      // Sheer Force: only apply self-targeting effects, suppress target-facing secondary effects
      this.applySelfEffectsOnly(attacker, move, events);
    } else if (defender.isAlive) {
      this.applyMoveEffects(attacker, defender, move, playerIndex, opponentIndex, events);
    } else {
      // Defender fainted — still apply self-effects (selfBoosts, self-status, self-heal)
      this.applySelfEffectsOnly(attacker, move, events);
    }

    // Contact-triggered abilities
    if (move.flags.contact && defender.isAlive && attacker.isAlive) {
      this.handleContactAbilities(attacker, defender, playerIndex, opponentIndex, events);
    }

    // Rocky Helmet: 1/6 max HP damage to attacker on contact
    if (move.flags.contact && defender.isAlive && attacker.isAlive && defender.item === 'Rocky Helmet') {
      const rhDamage = Math.max(1, Math.floor(attacker.maxHp / 6));
      attacker.currentHp = clampHp(attacker.currentHp - rhDamage, attacker.maxHp);
      this.addEvent(events, 'item_damage', { pokemon: attacker.species.name, item: 'Rocky Helmet', damage: rhDamage });
      this.checkFaint(attacker, playerIndex, events);
    }

    // Weakness Policy: +2 Atk/SpA when hit super effectively (single use)
    if (defender.isAlive && !defender.itemConsumed && defender.item === 'Weakness Policy' && totalDamage > 0) {
      const eff = getTypeEffectiveness(move.type as PokemonType, defender.species.types as PokemonType[]);
      if (eff > 1) {
        defender.itemConsumed = true;
        this.applyBoost(defender, 'atk', 2, events);
        this.applyBoost(defender, 'spa', 2, events);
        this.addEvent(events, 'item_trigger', { pokemon: defender.species.name, item: 'Weakness Policy' });
      }
    }

    // Moxie: +1 Atk when KOing opponent
    if (!defender.isAlive && attacker.isAlive && attacker.ability === 'Moxie') {
      this.applyBoost(attacker, 'atk', 1, events);
      this.addEvent(events, 'ability_trigger', { pokemon: attacker.species.name, ability: 'Moxie' });
    }

    // Beast Boost: +1 to highest stat when KOing opponent
    if (!defender.isAlive && attacker.isAlive && attacker.ability === 'Beast Boost') {
      const stats = attacker.stats;
      const highest = (['atk', 'def', 'spa', 'spd', 'spe'] as const).reduce((a, b) => stats[a] >= stats[b] ? a : b);
      this.applyBoost(attacker, highest, 1, events);
      this.addEvent(events, 'ability_trigger', { pokemon: attacker.species.name, ability: 'Beast Boost' });
    }
  }

  private executeStatusMove(
    attacker: BattlePokemon,
    defender: BattlePokemon,
    move: MoveData,
    playerIndex: number,
    opponentIndex: number,
    events: BattleEvent[]
  ): void {
    // Protect-like moves
    const protectMoves = ['Protect', 'Detect', 'Baneful Bunker', 'King\'s Shield', 'Spiky Shield', 'Obstruct', 'Silk Trap'];
    if (protectMoves.includes(move.name)) {
      // Consecutive use: 1/3 chance each time (stacks multiplicatively)
      if (attacker.protectedLastTurn && !this.rng.chance(33)) {
        this.addEvent(events, 'move_fail', { pokemon: attacker.species.name, move: move.name, reason: 'consecutive use' });
        return;
      }
      attacker.volatileStatuses.add('protect');
      this.addEvent(events, 'protect', { pokemon: attacker.species.name });
      return;
    }

    // Weather-dependent healing: Moonlight, Synthesis, Morning Sun
    const weatherHealMoves = ['Moonlight', 'Synthesis', 'Morning Sun'];
    if (weatherHealMoves.includes(move.name)) {
      let fraction = 0.5; // default: heal 50%
      if (this.state.weather === 'sun') {
        fraction = 2 / 3; // 66.7% in sun
      } else if (this.state.weather !== 'none') {
        fraction = 0.25; // 25% in rain/sand/hail
      }
      const healAmount = Math.floor(attacker.maxHp * fraction);
      const actualHeal = Math.min(healAmount, attacker.maxHp - attacker.currentHp);
      if (actualHeal <= 0) {
        this.addEvent(events, 'move_fail', { pokemon: attacker.species.name, move: move.name, reason: 'already at full HP' });
        return;
      }
      attacker.currentHp = clampHp(attacker.currentHp + healAmount, attacker.maxHp);
      this.addEvent(events, 'heal', { pokemon: attacker.species.name, amount: actualHeal });
      return;
    }

    // Sleep Talk: use a random other move while asleep
    if (move.name === 'Sleep Talk') {
      if (attacker.status !== 'sleep') {
        this.addEvent(events, 'move_fail', { pokemon: attacker.species.name, move: 'Sleep Talk', reason: 'not asleep' });
        return;
      }
      // Decrement sleep counter for Sleep Talk turn
      if (attacker.sleepTurns > 0) attacker.sleepTurns--;
      // Pick a random move that isn't Sleep Talk
      const usableMoves = attacker.moves
        .map((m, i) => ({ m, i }))
        .filter(({ m }) => m.data.name !== 'Sleep Talk' && m.data.name !== 'Rest');
      if (usableMoves.length === 0) {
        this.addEvent(events, 'move_fail', { pokemon: attacker.species.name, move: 'Sleep Talk', reason: 'no usable moves' });
        return;
      }
      const chosen = usableMoves[this.rng.int(0, usableMoves.length - 1)];
      // Execute the chosen move (don't deduct PP for the called move)
      const chosenMove = chosen.m.data;
      this.addEvent(events, 'use_move', {
        pokemon: attacker.species.name,
        move: chosenMove.name,
        player: playerIndex,
      });
      // Protect check for called move
      if (defender.volatileStatuses.has('protect') && chosenMove.target !== 'self' && chosenMove.target !== 'allySide') {
        this.addEvent(events, 'protected', { pokemon: defender.species.name, move: chosenMove.name });
        return;
      }
      // Accuracy check for the called move
      if (chosenMove.accuracy !== null && !rollAccuracy(this.rng, chosenMove.accuracy, attacker.boosts.accuracy, defender.boosts.evasion)) {
        this.addEvent(events, 'miss', { pokemon: attacker.species.name, move: chosenMove.name });
        return;
      }
      if (chosenMove.category === 'Status') {
        this.executeStatusMove(attacker, defender, chosenMove, playerIndex, opponentIndex, events);
      } else {
        this.executeDamagingMove(attacker, defender, chosenMove, playerIndex, opponentIndex, false, events);
      }
      attacker.lastMoveUsed = chosenMove.name;
      return;
    }

    // Rest: heal to full, sleep for exactly 2 turns
    if (move.name === 'Rest') {
      if (attacker.status === 'sleep') {
        this.addEvent(events, 'move_fail', { pokemon: attacker.species.name, move: 'Rest', reason: 'already asleep' });
        return;
      }
      if (attacker.currentHp >= attacker.maxHp) {
        this.addEvent(events, 'move_fail', { pokemon: attacker.species.name, move: 'Rest', reason: 'already at full HP' });
        return;
      }
      // Abilities that block sleep also block Rest
      if (attacker.ability === 'Insomnia' || attacker.ability === 'Vital Spirit') {
        this.addEvent(events, 'move_fail', { pokemon: attacker.species.name, move: 'Rest', reason: 'ability prevents sleep' });
        return;
      }
      // Clear existing status first
      if (attacker.status) {
        this.addEvent(events, 'status_cure', { pokemon: attacker.species.name, status: attacker.status });
      }
      // Heal to full
      const healAmount = attacker.maxHp - attacker.currentHp;
      attacker.currentHp = attacker.maxHp;
      this.addEvent(events, 'heal', { pokemon: attacker.species.name, amount: healAmount });
      // Self-inflict sleep (exactly 2 turns)
      attacker.status = 'sleep';
      attacker.sleepTurns = 2;
      this.addEvent(events, 'status', { pokemon: attacker.species.name, status: 'sleep' });
      return;
    }

    // Curse: dual-mode depending on user type
    if (move.name === 'Curse') {
      const isGhost = (attacker.species.types as PokemonType[]).includes('Ghost');
      if (isGhost) {
        // Ghost Curse: sacrifice 50% max HP, target is cursed (loses 1/4 max HP each turn)
        const cost = Math.floor(attacker.maxHp / 2);
        attacker.currentHp = clampHp(attacker.currentHp - cost, attacker.maxHp);
        this.addEvent(events, 'damage', {
          attacker: attacker.species.name,
          defender: attacker.species.name,
          move: 'Curse',
          damage: cost,
          remainingHp: attacker.currentHp,
          maxHp: attacker.maxHp,
        });
        defender.volatileStatuses.add('curse' as any);
        this.addEvent(events, 'volatile_status', { pokemon: defender.species.name, status: 'curse' });
        this.checkFaint(attacker, playerIndex, events);
      } else {
        // Non-Ghost Curse: +1 ATK, +1 DEF, -1 SPE
        this.applyBoost(attacker, 'atk', 1, events);
        this.applyBoost(attacker, 'def', 1, events);
        this.applyBoost(attacker, 'spe', -1, events);
      }
      return;
    }

    // Substitute: costs 25% HP, creates a substitute
    if (move.name === 'Substitute') {
      const cost = Math.floor(attacker.maxHp / 4);
      if (attacker.currentHp <= cost) {
        this.addEvent(events, 'move_fail', { pokemon: attacker.species.name, move: move.name, reason: 'not enough HP' });
        return;
      }
      if (attacker.substituteHp > 0) {
        this.addEvent(events, 'move_fail', { pokemon: attacker.species.name, move: move.name, reason: 'already has substitute' });
        return;
      }
      attacker.currentHp -= cost;
      attacker.substituteHp = cost;
      attacker.volatileStatuses.add('substitute');
      this.addEvent(events, 'substitute', { pokemon: attacker.species.name, hp: cost });
      return;
    }

    this.applyMoveEffects(attacker, defender, move, playerIndex, opponentIndex, events);
  }

  // --- Move effects ---

  private applyMoveEffects(
    attacker: BattlePokemon,
    defender: BattlePokemon,
    move: MoveData,
    playerIndex: number,
    opponentIndex: number,
    events: BattleEvent[]
  ): void {
    if (!move.effects) return;

    for (const effect of move.effects) {
      const chance = effect.chance || 100;
      if (!this.rng.chance(chance)) continue;

      switch (effect.type) {
        case 'status': {
          const rawStatus = effect.status as string;
          const resolved = (STATUS_ALIASES[rawStatus] || rawStatus) as StatusCondition;
          if (effect.target === 'self') {
            this.applyStatus(attacker, resolved, events);
          } else {
            this.applyStatus(defender, resolved, events);
          }
          break;
        }

        case 'boost': {
          const target = effect.target === 'self' ? attacker : defender;
          this.applyBoost(target, effect.stat as BoostableStat, effect.stages as number, events);
          break;
        }

        case 'weather': {
          const rawWeather = effect.weather as string;
          const resolvedWeather = WEATHER_ALIASES[rawWeather] || rawWeather as Weather;
          this.setWeather(resolvedWeather, events);
          break;
        }

        case 'hazard': {
          // Screens/Tailwind/Aurora Veil go on the user's side; entry hazards go on opponent's
          const selfSideHazards = ['reflect', 'lightscreen', 'tailwind', 'auroraveil', 'safeguard', 'mist', 'quickguard', 'wideguard', 'craftyshield', 'matblock', 'luckychant'];
          const hazardSide = selfSideHazards.includes(effect.hazard as string) ? playerIndex : opponentIndex;
          this.applyHazard(hazardSide, effect.hazard as string, events);
          break;
        }

        case 'flinch':
          if (!defender.hasMovedThisTurn) {
            defender.volatileStatuses.add('flinch');
          }
          break;

        case 'heal': {
          const amount = effect.amount || 0.5;
          const healAmount = Math.floor(attacker.maxHp * amount);
          attacker.currentHp = clampHp(attacker.currentHp + healAmount, attacker.maxHp);
          this.addEvent(events, 'heal', { pokemon: attacker.species.name, amount: healAmount });
          break;
        }

        case 'custom':
          // Custom handlers will be implemented as needed
          break;
      }
    }

    // Handle moves that directly set status/boosts/volatileStatus (from Showdown data format)
    if (move.volatileStatus) {
      this.applyVolatileStatus(attacker, defender, move, playerIndex, opponentIndex, events);
    }

    // Legacy boost fields — skip if the effects array already handled boosts
    // (otherwise moves like Nasty Plot double-apply: effects gives +2 spa to self,
    // then move.boosts gives +2 spa to the DEFENDER incorrectly)
    const effectsHaveBoosts = move.effects?.some(e => e.type === 'boost');
    if (!effectsHaveBoosts) {
      if (move.boosts) {
        for (const [stat, stages] of Object.entries(move.boosts)) {
          if (stages) this.applyBoost(defender, stat as BoostableStat, stages, events);
        }
      }
      if (move.selfBoosts) {
        for (const [stat, stages] of Object.entries(move.selfBoosts)) {
          if (stages) this.applyBoost(attacker, stat as BoostableStat, stages, events);
        }
      }
    }
  }

  /** Apply only self-targeting effects from a move (used when defender fainted) */
  private applySelfEffectsOnly(
    attacker: BattlePokemon,
    move: MoveData,
    events: BattleEvent[],
  ): void {
    // Self-targeting effects from effects array
    for (const effect of (move.effects || [])) {
      const chance = effect.chance || 100;
      if (!this.rng.chance(chance)) continue;

      if (effect.target === 'self' && effect.type === 'boost') {
        this.applyBoost(attacker, effect.stat as BoostableStat, effect.stages as number, events);
      }
      if (effect.type === 'heal') {
        const amount = effect.amount || 0.5;
        const healAmount = Math.floor(attacker.maxHp * amount);
        attacker.currentHp = clampHp(attacker.currentHp + healAmount, attacker.maxHp);
        this.addEvent(events, 'heal', { pokemon: attacker.species.name, amount: healAmount });
      }
    }

    // Legacy selfBoosts field
    const effectsHaveBoosts = move.effects?.some(e => e.type === 'boost');
    if (!effectsHaveBoosts && move.selfBoosts) {
      for (const [stat, stages] of Object.entries(move.selfBoosts)) {
        if (stages) this.applyBoost(attacker, stat as BoostableStat, stages, events);
      }
    }
  }

  private applyVolatileStatus(
    attacker: BattlePokemon,
    defender: BattlePokemon,
    move: MoveData,
    _playerIndex: number,
    _opponentIndex: number,
    events: BattleEvent[],
  ): void {
    const target = move.target === 'self' ? attacker : defender;
    const vs = move.volatileStatus!;

    switch (vs) {
      case 'encore': {
        if (!target.lastMoveUsed) {
          this.addEvent(events, 'move_fail', { pokemon: attacker.species.name, move: move.name, reason: 'no last move' });
          return;
        }
        if (target.encoreTurns > 0) {
          this.addEvent(events, 'move_fail', { pokemon: attacker.species.name, move: move.name, reason: 'already encored' });
          return;
        }
        target.encoreTurns = 3;
        target.encoreMove = target.lastMoveUsed;
        target.volatileStatuses.add('encore');
        this.addEvent(events, 'volatile_status', {
          pokemon: target.species.name,
          status: 'encore',
          move: target.encoreMove,
        });
        break;
      }
      case 'confusion': {
        if (target.volatileStatuses.has('confusion')) return;
        target.volatileStatuses.add('confusion');
        target.confusionTurns = this.rng.int(2, 5);
        this.addEvent(events, 'volatile_status', { pokemon: target.species.name, status: 'confusion' });
        break;
      }
      case 'leechseed':
      case 'leech-seed': {
        if (target.volatileStatuses.has('leechseed')) return;
        if ((target.species.types as PokemonType[]).includes('Grass')) {
          this.addEvent(events, 'immune', { target: target.species.name, move: move.name, reason: 'Grass type' });
          return;
        }
        target.volatileStatuses.add('leechseed');
        this.addEvent(events, 'volatile_status', { pokemon: target.species.name, status: 'leechseed' });
        break;
      }
      case 'taunt': {
        if (target.volatileStatuses.has('taunt')) return;
        target.volatileStatuses.add('taunt');
        this.addEvent(events, 'volatile_status', { pokemon: target.species.name, status: 'taunt' });
        break;
      }
      case 'yawn': {
        if (target.volatileStatuses.has('yawn') || target.status !== null) return;
        target.volatileStatuses.add('yawn');
        this.addEvent(events, 'volatile_status', { pokemon: target.species.name, status: 'yawn' });
        break;
      }
      case 'focusenergy': {
        if (target.volatileStatuses.has('focusenergy')) return;
        target.volatileStatuses.add('focusenergy');
        this.addEvent(events, 'volatile_status', { pokemon: target.species.name, status: 'focusenergy' });
        break;
      }
      case 'endure': {
        if (attacker.protectedLastTurn) {
          this.addEvent(events, 'move_fail', { pokemon: attacker.species.name, move: move.name, reason: 'consecutive use' });
          return;
        }
        attacker.volatileStatuses.add('endure');
        this.addEvent(events, 'volatile_status', { pokemon: attacker.species.name, status: 'endure' });
        break;
      }
      case 'ingrain': {
        if (target.volatileStatuses.has('ingrain')) return;
        target.volatileStatuses.add('ingrain');
        this.addEvent(events, 'volatile_status', { pokemon: target.species.name, status: 'ingrain' });
        break;
      }
      case 'aquaring': {
        if (target.volatileStatuses.has('aquaring')) return;
        target.volatileStatuses.add('aquaring');
        this.addEvent(events, 'volatile_status', { pokemon: target.species.name, status: 'aquaring' });
        break;
      }
      default: {
        target.volatileStatuses.add(vs as any);
        this.addEvent(events, 'volatile_status', { pokemon: target.species.name, status: vs });
        break;
      }
    }
  }

  // --- Status conditions ---

  applyStatus(pokemon: BattlePokemon, status: StatusCondition, events: BattleEvent[]): boolean {
    // Already has a status
    if (pokemon.status !== null) {
      this.addEvent(events, 'status_fail', {
        pokemon: pokemon.species.name,
        status,
        reason: 'already_statused',
      });
      return false;
    }

    // Type immunities
    const types = pokemon.species.types as PokemonType[];
    if (status === 'burn' && types.includes('Fire')) return false;
    if (status === 'paralysis' && types.includes('Electric')) return false;
    if ((status === 'poison' || status === 'toxic') && (types.includes('Poison') || types.includes('Steel'))) return false;
    if (status === 'freeze' && types.includes('Ice')) return false;

    // Ability immunities
    if (status === 'burn' && (pokemon.ability === 'Water Veil' || pokemon.ability === 'Water Bubble')) return false;
    if (status === 'paralysis' && pokemon.ability === 'Limber') return false;
    if ((status === 'poison' || status === 'toxic') && pokemon.ability === 'Immunity') return false;
    if (status === 'freeze' && pokemon.ability === 'Magma Armor') return false;
    if (status === 'sleep' && (pokemon.ability === 'Insomnia' || pokemon.ability === 'Vital Spirit')) return false;

    pokemon.status = status;

    if (status === 'sleep') {
      pokemon.sleepTurns = this.rng.int(1, 3);
    }
    if (status === 'toxic') {
      pokemon.toxicCounter = 1;
    }

    this.addEvent(events, 'status', {
      pokemon: pokemon.species.name,
      status,
    });

    return true;
  }

  // --- Stat boosts ---

  applyBoost(
    pokemon: BattlePokemon,
    stat: BoostableStat,
    stages: number,
    events: BattleEvent[],
    fromOpponent: boolean = false
  ): void {
    // Simple: doubles stat changes
    if (pokemon.ability === 'Simple') stages = stages * 2;
    // Contrary reverses all stat changes
    if (pokemon.ability === 'Contrary') stages = -stages;

    const oldStage = pokemon.boosts[stat];
    const newStage = Math.max(-6, Math.min(6, oldStage + stages));
    const actualChange = newStage - oldStage;

    if (actualChange === 0) {
      this.addEvent(events, 'boost_fail', {
        pokemon: pokemon.species.name,
        stat,
        reason: stages > 0 ? 'max' : 'min',
      });
      return;
    }

    pokemon.boosts[stat] = newStage;
    this.addEvent(events, 'boost', {
      pokemon: pokemon.species.name,
      stat,
      stages: actualChange,
      newStage,
    });

    // Defiant: +2 Atk when a stat is lowered by an opponent
    if (fromOpponent && actualChange < 0 && pokemon.ability === 'Defiant') {
      this.addEvent(events, 'ability_trigger', { pokemon: pokemon.species.name, ability: 'Defiant' });
      this.applyBoost(pokemon, 'atk', 2, events);
    }
    // Competitive: +2 SpA when a stat is lowered by an opponent
    if (fromOpponent && actualChange < 0 && pokemon.ability === 'Competitive') {
      this.addEvent(events, 'ability_trigger', { pokemon: pokemon.species.name, ability: 'Competitive' });
      this.applyBoost(pokemon, 'spa', 2, events);
    }
  }

  // --- Weather ---

  setWeather(weather: Weather, events: BattleEvent[]): void {
    if (this.state.weather === weather) return;
    this.state.weather = weather;
    this.state.weatherTurnsRemaining = weather === 'none' ? 0 : 5;
    this.addEvent(events, 'weather', { weather });
  }

  // --- Hazards ---

  private applyHazard(sideIndex: number, hazard: string, events: BattleEvent[]): void {
    const side = this.getSideEffects(sideIndex);

    switch (hazard) {
      case 'stealthrock':
        if (side.stealthRock) return;
        side.stealthRock = true;
        this.addEvent(events, 'hazard_set', { side: sideIndex, hazard: 'Stealth Rock' });
        break;
      case 'spikes':
        if (side.spikesLayers >= 3) return;
        side.spikesLayers++;
        this.addEvent(events, 'hazard_set', { side: sideIndex, hazard: 'Spikes', layers: side.spikesLayers });
        break;
      case 'toxicspikes':
        if (side.toxicSpikesLayers >= 2) return;
        side.toxicSpikesLayers++;
        this.addEvent(events, 'hazard_set', { side: sideIndex, hazard: 'Toxic Spikes', layers: side.toxicSpikesLayers });
        break;
      case 'reflect':
        side.reflect = 5;
        this.addEvent(events, 'screen_set', { side: sideIndex, screen: 'Reflect' });
        break;
      case 'lightscreen':
        side.lightScreen = 5;
        this.addEvent(events, 'screen_set', { side: sideIndex, screen: 'Light Screen' });
        break;
      case 'stickyweb':
        if (side.stickyWeb) return;
        side.stickyWeb = true;
        this.addEvent(events, 'hazard_set', { side: sideIndex, hazard: 'Sticky Web' });
        break;
      case 'tailwind':
        side.tailwind = 4;
        this.addEvent(events, 'screen_set', { side: sideIndex, screen: 'Tailwind' });
        break;
      case 'auroraveil': {
        if (this.state.weather !== 'hail') {
          this.addEvent(events, 'move_fail', { pokemon: 'unknown', move: 'Aurora Veil', reason: 'no hail' });
          return;
        }
        side.auroraVeil = 5;
        this.addEvent(events, 'screen_set', { side: sideIndex, screen: 'Aurora Veil' });
        break;
      }
    }
  }

  // --- Switching ---

  executeSwitch(playerIndex: number, pokemonIndex: number, events: BattleEvent[]): void {
    const player = this.state.players[playerIndex];
    const oldPokemon = player.team[player.activePokemonIndex];
    const newPokemon = player.team[pokemonIndex];

    if (!newPokemon.isAlive) {
      this.logger.warn('switch', `Attempted to switch to fainted ${newPokemon.species.name}`);
      return;
    }

    // Natural Cure: cure status when switching out
    if (oldPokemon.ability === 'Natural Cure' && oldPokemon.status) {
      this.addEvent(events, 'ability_trigger', { pokemon: oldPokemon.species.name, ability: 'Natural Cure' });
      this.addEvent(events, 'status_cure', { pokemon: oldPokemon.species.name, status: oldPokemon.status });
      oldPokemon.status = null;
    }

    // Regenerator: heal 1/3 HP on switch-out
    if (oldPokemon.ability === 'Regenerator' && oldPokemon.isAlive) {
      const heal = Math.floor(oldPokemon.maxHp / 3);
      const actualHeal = Math.min(heal, oldPokemon.maxHp - oldPokemon.currentHp);
      if (actualHeal > 0) {
        oldPokemon.currentHp = clampHp(oldPokemon.currentHp + heal, oldPokemon.maxHp);
        this.addEvent(events, 'ability_heal', { pokemon: oldPokemon.species.name, ability: 'Regenerator', amount: actualHeal });
      }
    }

    // Clear volatile statuses on switch-out
    oldPokemon.volatileStatuses.clear();
    oldPokemon.boosts = { atk: 0, def: 0, spa: 0, spd: 0, spe: 0, accuracy: 0, evasion: 0 };
    oldPokemon.choiceLocked = null;
    oldPokemon.toxicCounter = oldPokemon.status === 'toxic' ? 1 : 0;
    oldPokemon.confusionTurns = 0;
    oldPokemon.encoreTurns = 0;
    oldPokemon.encoreMove = null;
    oldPokemon.truantNextTurn = false;
    oldPokemon.mustRecharge = false;
    oldPokemon.turnsOnField = 0;

    if (oldPokemon.isAlive) {
      this.addEvent(events, 'switch', {
        player: playerIndex,
        from: oldPokemon.species.name,
        to: newPokemon.species.name,
        toId: newPokemon.species.id,
        toHp: newPokemon.currentHp,
        toMaxHp: newPokemon.maxHp,
      });
    } else {
      this.addEvent(events, 'send_out', {
        player: playerIndex,
        pokemon: newPokemon.species.name,
        speciesId: newPokemon.species.id,
        currentHp: newPokemon.currentHp,
        maxHp: newPokemon.maxHp,
      });
    }

    player.activePokemonIndex = pokemonIndex;
    newPokemon.turnsOnField = 0;

    // Apply entry hazards
    this.applyEntryHazards(playerIndex, newPokemon, events);

    // Switch-in abilities
    this.handleSwitchInAbility(playerIndex, newPokemon, events);
  }

  private applyEntryHazards(playerIndex: number, pokemon: BattlePokemon, events: BattleEvent[]): void {
    // Heavy-Duty Boots: immune to entry hazards
    if (pokemon.item === 'Heavy-Duty Boots') return;

    const side = this.getSideEffects(playerIndex);
    const types = pokemon.species.types as PokemonType[];
    const isFlying = types.includes('Flying') || pokemon.ability === 'Levitate';

    // Stealth Rock — type-based damage
    if (side.stealthRock) {
      const effectiveness = getTypeEffectiveness('Rock', types);
      const damage = Math.max(1, Math.floor(pokemon.maxHp * effectiveness / 8));
      pokemon.currentHp = clampHp(pokemon.currentHp - damage, pokemon.maxHp);
      this.addEvent(events, 'hazard_damage', {
        pokemon: pokemon.species.name,
        hazard: 'Stealth Rock',
        damage,
        effectiveness,
      });
      this.checkFaint(pokemon, playerIndex, events);
    }

    // Spikes — not affected if Flying/Levitate
    if (side.spikesLayers > 0 && !isFlying) {
      const fractions = [0, 1/8, 1/6, 1/4]; // 0, 1, 2, 3 layers
      const damage = Math.max(1, Math.floor(pokemon.maxHp * fractions[side.spikesLayers]));
      pokemon.currentHp = clampHp(pokemon.currentHp - damage, pokemon.maxHp);
      this.addEvent(events, 'hazard_damage', {
        pokemon: pokemon.species.name,
        hazard: 'Spikes',
        damage,
        layers: side.spikesLayers,
      });
      this.checkFaint(pokemon, playerIndex, events);
    }

    // Sticky Web — -1 Speed on switch-in (not affected if Flying/Levitate)
    if (side.stickyWeb && !isFlying && pokemon.isAlive) {
      this.applyBoost(pokemon, 'spe', -1, events);
      this.addEvent(events, 'hazard_damage', {
        pokemon: pokemon.species.name,
        hazard: 'Sticky Web',
        damage: 0,
      });
    }

    // Toxic Spikes — not affected if Flying/Levitate
    if (side.toxicSpikesLayers > 0 && !isFlying && pokemon.isAlive) {
      // Poison types absorb Toxic Spikes
      if (types.includes('Poison')) {
        side.toxicSpikesLayers = 0;
        this.addEvent(events, 'hazard_absorb', {
          pokemon: pokemon.species.name,
          hazard: 'Toxic Spikes',
        });
      } else if (!types.includes('Steel')) {
        if (side.toxicSpikesLayers === 1) {
          this.applyStatus(pokemon, 'poison', events);
        } else {
          this.applyStatus(pokemon, 'toxic', events);
        }
      }
    }
  }

  // --- Ability handlers ---

  private handleSwitchInAbility(playerIndex: number, pokemon: BattlePokemon, events: BattleEvent[]): void {
    const opponentIndex = playerIndex === 0 ? 1 : 0;
    const opponent = this.getActivePokemon(opponentIndex);

    switch (pokemon.ability) {
      case 'Intimidate':
        if (opponent.isAlive) {
          this.addEvent(events, 'ability_trigger', {
            pokemon: pokemon.species.name,
            ability: 'Intimidate',
          });
          this.applyBoost(opponent, 'atk', -1, events, true);
        }
        break;
      case 'Drizzle':
        this.setWeather('rain', events);
        break;
      case 'Drought':
        this.setWeather('sun', events);
        break;
      case 'Sand Stream':
        this.setWeather('sandstorm', events);
        break;
      case 'Snow Warning':
        this.setWeather('hail', events);
        break;
      case 'Download': {
        const oppDef = opponent.stats.def;
        const oppSpD = opponent.stats.spd;
        if (oppDef <= oppSpD) {
          this.applyBoost(pokemon, 'atk', 1, events);
        } else {
          this.applyBoost(pokemon, 'spa', 1, events);
        }
        break;
      }
      case 'Trace':
        if (opponent.ability) {
          pokemon.ability = opponent.ability;
          this.addEvent(events, 'ability_trigger', {
            pokemon: pokemon.species.name,
            ability: 'Trace',
            traced: opponent.ability,
          });
        }
        break;
    }
  }

  private checkAbilityImmunity(defender: BattlePokemon, move: MoveData, events: BattleEvent[]): boolean {
    const moveType = move.type as PokemonType;

    // Levitate
    if (defender.ability === 'Levitate' && moveType === 'Ground') {
      this.addEvent(events, 'immune', { target: defender.species.name, move: move.name, reason: 'Levitate' });
      return true;
    }
    // Air Balloon
    if (defender.item === 'Air Balloon' && !defender.itemConsumed && moveType === 'Ground') {
      this.addEvent(events, 'immune', { target: defender.species.name, move: move.name, reason: 'Air Balloon' });
      return true;
    }
    // Flash Fire
    if (defender.ability === 'Flash Fire' && moveType === 'Fire') {
      this.addEvent(events, 'ability_trigger', { pokemon: defender.species.name, ability: 'Flash Fire' });
      return true;
    }
    // Volt Absorb
    if (defender.ability === 'Volt Absorb' && moveType === 'Electric') {
      const heal = Math.floor(defender.maxHp / 4);
      defender.currentHp = clampHp(defender.currentHp + heal, defender.maxHp);
      this.addEvent(events, 'ability_heal', { pokemon: defender.species.name, ability: 'Volt Absorb', amount: heal });
      return true;
    }
    // Water Absorb / Dry Skin (water immunity)
    if ((defender.ability === 'Water Absorb' || defender.ability === 'Dry Skin') && moveType === 'Water') {
      const heal = Math.floor(defender.maxHp / 4);
      defender.currentHp = clampHp(defender.currentHp + heal, defender.maxHp);
      this.addEvent(events, 'ability_heal', { pokemon: defender.species.name, ability: defender.ability, amount: heal });
      return true;
    }
    // Lightning Rod
    if (defender.ability === 'Lightning Rod' && moveType === 'Electric') {
      this.applyBoost(defender, 'spa', 1, events);
      return true;
    }
    // Storm Drain
    if (defender.ability === 'Storm Drain' && moveType === 'Water') {
      this.applyBoost(defender, 'spa', 1, events);
      return true;
    }
    // Motor Drive
    if (defender.ability === 'Motor Drive' && moveType === 'Electric') {
      this.applyBoost(defender, 'spe', 1, events);
      return true;
    }
    // Sap Sipper
    if (defender.ability === 'Sap Sipper' && moveType === 'Grass') {
      this.applyBoost(defender, 'atk', 1, events);
      return true;
    }
    // Wonder Guard — only super effective moves hit
    if (defender.ability === 'Wonder Guard' && move.category !== 'Status') {
      const effectiveness = getTypeEffectiveness(moveType, defender.species.types as PokemonType[]);
      if (effectiveness <= 1) {
        this.addEvent(events, 'immune', { target: defender.species.name, move: move.name, reason: 'Wonder Guard' });
        return true;
      }
    }
    // Soundproof
    if (defender.ability === 'Soundproof' && move.flags.sound) {
      this.addEvent(events, 'immune', { target: defender.species.name, move: move.name, reason: 'Soundproof' });
      return true;
    }
    // Bulletproof
    if (defender.ability === 'Bulletproof' && move.flags.bullet) {
      this.addEvent(events, 'immune', { target: defender.species.name, move: move.name, reason: 'Bulletproof' });
      return true;
    }

    return false;
  }

  private getAbilityItemModifiers(
    attacker: BattlePokemon,
    defender: BattlePokemon,
    move: MoveData
  ): { attackMod?: number; defenseMod?: number; powerMod?: number; finalMod?: number } {
    const mods: { attackMod?: number; defenseMod?: number; powerMod?: number; finalMod?: number } = {};

    // Attacker ability modifiers
    switch (attacker.ability) {
      case 'Huge Power':
      case 'Pure Power':
        if (move.category === 'Physical') mods.attackMod = 2;
        break;
      case 'Hustle':
        if (move.category === 'Physical') mods.attackMod = 1.5;
        break;
      case 'Guts':
        if (attacker.status && move.category === 'Physical') mods.attackMod = 1.5;
        break;
      case 'Iron Fist':
        if (move.flags.punch) mods.powerMod = 1.2;
        break;
      case 'Technician':
        if ((move.power || 0) <= 60) mods.powerMod = 1.5;
        break;
      case 'Adaptability':
        // STAB becomes 2x instead of 1.5x (handled in finalMod since STAB is applied separately)
        if (attacker.species.types.includes(move.type as PokemonType)) {
          mods.finalMod = (mods.finalMod || 1) * (2 / 1.5);
        }
        break;
      case 'Sheer Force':
        if (move.effects && move.effects.length > 0) mods.finalMod = 1.3;
        break;
      case 'Tough Claws':
        if (move.flags.contact) mods.powerMod = (mods.powerMod || 1) * 1.3;
        break;
      case 'Strong Jaw':
        if (move.flags.bite) mods.powerMod = (mods.powerMod || 1) * 1.5;
        break;
      case 'Mega Launcher':
        if (move.flags.pulse) mods.powerMod = (mods.powerMod || 1) * 1.5;
        break;
      case 'Tinted Lens':
        if (getTypeEffectiveness(move.type as PokemonType, defender.species.types as PokemonType[]) < 1) {
          mods.finalMod = (mods.finalMod || 1) * 2;
        }
        break;
      case 'Reckless':
        if (move.flags.recoil) mods.powerMod = (mods.powerMod || 1) * 1.2;
        break;
      case 'Analytic':
        // Bonus if moving last — approximate by checking if defender already moved
        if (defender.hasMovedThisTurn) mods.finalMod = (mods.finalMod || 1) * 1.3;
        break;
    }

    // Defender ability modifiers
    switch (defender.ability) {
      case 'Thick Fat':
        if (move.type === 'Fire' || move.type === 'Ice') mods.finalMod = (mods.finalMod || 1) * 0.5;
        break;
      case 'Marvel Scale':
        if (defender.status && move.category === 'Physical') mods.defenseMod = 1.5;
        break;
      case 'Fur Coat':
        if (move.category === 'Physical') mods.defenseMod = 2;
        break;
      case 'Multiscale':
      case 'Shadow Shield':
        if (defender.currentHp === defender.maxHp) mods.finalMod = (mods.finalMod || 1) * 0.5;
        break;
      case 'Solid Rock':
      case 'Filter':
      case 'Prism Armor':
        if (getTypeEffectiveness(move.type as PokemonType, defender.species.types as PokemonType[]) > 1) {
          mods.finalMod = (mods.finalMod || 1) * 0.75;
        }
        break;
    }

    // Attacker item modifiers
    switch (attacker.item) {
      case 'Choice Band':
        if (move.category === 'Physical') mods.attackMod = (mods.attackMod || 1) * 1.5;
        break;
      case 'Choice Specs':
        if (move.category === 'Special') mods.attackMod = (mods.attackMod || 1) * 1.5;
        break;
      case 'Life Orb':
        mods.finalMod = (mods.finalMod || 1) * 1.3;
        break;
      case 'Expert Belt':
        if (getTypeEffectiveness(move.type as PokemonType, defender.species.types as PokemonType[]) > 1) {
          mods.finalMod = (mods.finalMod || 1) * 1.2;
        }
        break;
    }

    // Defender item modifiers
    switch (defender.item) {
      case 'Assault Vest':
        if (move.category === 'Special') mods.defenseMod = (mods.defenseMod || 1) * 1.5;
        break;
    }

    // Screens
    const defenderSide = this.getSideEffects(defender === this.getActivePokemon(0) ? 0 : 1);
    if (move.category === 'Physical' && defenderSide.reflect > 0) {
      mods.finalMod = (mods.finalMod || 1) * 0.5;
    }
    if (move.category === 'Special' && defenderSide.lightScreen > 0) {
      mods.finalMod = (mods.finalMod || 1) * 0.5;
    }
    // Aurora Veil: halves both physical and special (doesn't stack with Reflect/Light Screen)
    if (defenderSide.auroraVeil > 0) {
      if (move.category === 'Physical' && defenderSide.reflect <= 0) {
        mods.finalMod = (mods.finalMod || 1) * 0.5;
      }
      if (move.category === 'Special' && defenderSide.lightScreen <= 0) {
        mods.finalMod = (mods.finalMod || 1) * 0.5;
      }
    }

    return mods;
  }

  private handleContactAbilities(
    attacker: BattlePokemon,
    defender: BattlePokemon,
    playerIndex: number,
    opponentIndex: number,
    events: BattleEvent[]
  ): void {
    switch (defender.ability) {
      case 'Static':
        if (this.rng.chance(30)) {
          this.applyStatus(attacker, 'paralysis', events);
        }
        break;
      case 'Poison Point':
        if (this.rng.chance(30)) {
          this.applyStatus(attacker, 'poison', events);
        }
        break;
      case 'Flame Body':
        if (this.rng.chance(30)) {
          this.applyStatus(attacker, 'burn', events);
        }
        break;
      case 'Effect Spore':
        if (this.rng.chance(30)) {
          const roll = this.rng.int(1, 3);
          if (roll === 1) this.applyStatus(attacker, 'paralysis', events);
          else if (roll === 2) this.applyStatus(attacker, 'poison', events);
          else this.applyStatus(attacker, 'sleep', events);
        }
        break;
      case 'Rough Skin':
      case 'Iron Barbs': {
        const damage = Math.max(1, Math.floor(attacker.maxHp / 8));
        attacker.currentHp = clampHp(attacker.currentHp - damage, attacker.maxHp);
        this.addEvent(events, 'ability_damage', {
          pokemon: attacker.species.name,
          ability: defender.ability,
          damage,
        });
        this.checkFaint(attacker, playerIndex, events);
        break;
      }
      case 'Cute Charm':
        // Not implementing infatuation for now
        break;
    }
  }

  // --- End of turn ---

  private processEndOfTurn(events: BattleEvent[]): void {
    // Weather tick
    if (this.state.weather !== 'none') {
      this.state.weatherTurnsRemaining--;
      if (this.state.weatherTurnsRemaining <= 0) {
        this.addEvent(events, 'weather_end', { weather: this.state.weather });
        this.state.weather = 'none';
      } else {
        // Weather damage
        for (let i = 0; i < 2; i++) {
          const pokemon = this.getActivePokemon(i);
          if (!pokemon.isAlive) continue;
          this.applyWeatherDamage(pokemon, i, events);
        }
      }
    }

    // Screens countdown
    for (let i = 0; i < 2; i++) {
      const side = this.getSideEffects(i);
      if (side.reflect > 0) {
        side.reflect--;
        if (side.reflect === 0) {
          this.addEvent(events, 'screen_end', { side: i, screen: 'Reflect' });
        }
      }
      if (side.lightScreen > 0) {
        side.lightScreen--;
        if (side.lightScreen === 0) {
          this.addEvent(events, 'screen_end', { side: i, screen: 'Light Screen' });
        }
      }
      if (side.auroraVeil > 0) {
        side.auroraVeil--;
        if (side.auroraVeil === 0) {
          this.addEvent(events, 'screen_end', { side: i, screen: 'Aurora Veil' });
        }
      }
      if (side.tailwind > 0) {
        side.tailwind--;
        if (side.tailwind === 0) {
          this.addEvent(events, 'screen_end', { side: i, screen: 'Tailwind' });
        }
      }
    }

    // Status damage and abilities for each Pokemon (faster first)
    const order = this.getSpeedOrder();
    for (const playerIndex of order) {
      const pokemon = this.getActivePokemon(playerIndex);
      if (!pokemon.isAlive) continue;

      // Burn damage
      if (pokemon.status === 'burn') {
        const damage = Math.max(1, Math.floor(pokemon.maxHp / 16));
        pokemon.currentHp = clampHp(pokemon.currentHp - damage, pokemon.maxHp);
        this.addEvent(events, 'status_damage', {
          pokemon: pokemon.species.name,
          status: 'burn',
          damage,
        });
        this.checkFaint(pokemon, playerIndex, events);
      }

      // Poison damage
      if (pokemon.status === 'poison' && pokemon.ability !== 'Poison Heal') {
        const damage = Math.max(1, Math.floor(pokemon.maxHp / 8));
        pokemon.currentHp = clampHp(pokemon.currentHp - damage, pokemon.maxHp);
        this.addEvent(events, 'status_damage', {
          pokemon: pokemon.species.name,
          status: 'poison',
          damage,
        });
        this.checkFaint(pokemon, playerIndex, events);
      }

      // Toxic damage (escalating)
      if (pokemon.status === 'toxic' && pokemon.ability !== 'Poison Heal') {
        const damage = Math.max(1, Math.floor(pokemon.maxHp * pokemon.toxicCounter / 16));
        pokemon.currentHp = clampHp(pokemon.currentHp - damage, pokemon.maxHp);
        pokemon.toxicCounter = Math.min(15, pokemon.toxicCounter + 1);
        this.addEvent(events, 'status_damage', {
          pokemon: pokemon.species.name,
          status: 'toxic',
          damage,
          counter: pokemon.toxicCounter,
        });
        this.checkFaint(pokemon, playerIndex, events);
      }

      // Poison Heal
      if ((pokemon.status === 'poison' || pokemon.status === 'toxic') && pokemon.ability === 'Poison Heal') {
        const heal = Math.max(1, Math.floor(pokemon.maxHp / 8));
        const actualHeal = Math.min(heal, pokemon.maxHp - pokemon.currentHp);
        if (actualHeal > 0) {
          pokemon.currentHp = clampHp(pokemon.currentHp + heal, pokemon.maxHp);
          this.addEvent(events, 'ability_heal', {
            pokemon: pokemon.species.name,
            ability: 'Poison Heal',
            amount: actualHeal,
          });
        }
      }

      // Leech Seed
      if (pokemon.volatileStatuses.has('leechseed')) {
        const opponentIndex = playerIndex === 0 ? 1 : 0;
        const opponent = this.getActivePokemon(opponentIndex);
        const damage = Math.max(1, Math.floor(pokemon.maxHp / 8));
        pokemon.currentHp = clampHp(pokemon.currentHp - damage, pokemon.maxHp);
        if (opponent.isAlive) {
          opponent.currentHp = clampHp(opponent.currentHp + damage, opponent.maxHp);
        }
        this.addEvent(events, 'leech_seed', {
          pokemon: pokemon.species.name,
          damage,
        });
        this.checkFaint(pokemon, playerIndex, events);
      }

      // Nightmare: 1/4 max HP per turn while asleep
      if (pokemon.volatileStatuses.has('nightmare' as any)) {
        if (pokemon.status === 'sleep') {
          const nightmareDmg = Math.max(1, Math.floor(pokemon.maxHp / 4));
          pokemon.currentHp = clampHp(pokemon.currentHp - nightmareDmg, pokemon.maxHp);
          this.addEvent(events, 'status_damage', {
            pokemon: pokemon.species.name,
            status: 'nightmare',
            damage: nightmareDmg,
          });
          this.checkFaint(pokemon, playerIndex, events);
        } else {
          pokemon.volatileStatuses.delete('nightmare' as any);
        }
      }

      // Trapping damage (Bind, Wrap, Fire Spin, etc.): 1/8 max HP per turn
      if (pokemon.volatileStatuses.has('partiallytrapped' as any)) {
        const trapDmg = Math.max(1, Math.floor(pokemon.maxHp / 8));
        pokemon.currentHp = clampHp(pokemon.currentHp - trapDmg, pokemon.maxHp);
        this.addEvent(events, 'status_damage', {
          pokemon: pokemon.species.name,
          status: 'trapped',
          damage: trapDmg,
        });
        this.checkFaint(pokemon, playerIndex, events);
      }

      // Curse damage (Ghost Curse: 1/4 max HP per turn)
      if (pokemon.volatileStatuses.has('curse' as any)) {
        const curseDmg = Math.max(1, Math.floor(pokemon.maxHp / 4));
        pokemon.currentHp = clampHp(pokemon.currentHp - curseDmg, pokemon.maxHp);
        this.addEvent(events, 'status_damage', {
          pokemon: pokemon.species.name,
          status: 'curse',
          damage: curseDmg,
        });
        this.checkFaint(pokemon, playerIndex, events);
      }

      // Yawn: falls asleep at end of the turn after being yawned
      if (pokemon.volatileStatuses.has('yawn')) {
        pokemon.volatileStatuses.delete('yawn');
        if (pokemon.status === null) {
          this.applyStatus(pokemon, 'sleep', events);
        }
      }

      // Ingrain healing: 1/16 max HP per turn
      if (pokemon.volatileStatuses.has('ingrain') && pokemon.currentHp < pokemon.maxHp) {
        const heal = Math.max(1, Math.floor(pokemon.maxHp / 16));
        pokemon.currentHp = clampHp(pokemon.currentHp + heal, pokemon.maxHp);
        this.addEvent(events, 'heal', { pokemon: pokemon.species.name, amount: heal });
      }

      // Aqua Ring healing: 1/16 max HP per turn
      if (pokemon.volatileStatuses.has('aquaring') && pokemon.currentHp < pokemon.maxHp) {
        const heal = Math.max(1, Math.floor(pokemon.maxHp / 16));
        pokemon.currentHp = clampHp(pokemon.currentHp + heal, pokemon.maxHp);
        this.addEvent(events, 'heal', { pokemon: pokemon.species.name, amount: heal });
      }

      // Leftovers
      if (pokemon.item === 'Leftovers' && pokemon.currentHp < pokemon.maxHp) {
        const heal = Math.max(1, Math.floor(pokemon.maxHp / 16));
        pokemon.currentHp = clampHp(pokemon.currentHp + heal, pokemon.maxHp);
        this.addEvent(events, 'item_heal', {
          pokemon: pokemon.species.name,
          item: 'Leftovers',
          amount: heal,
        });
      }

      // Black Sludge
      if (pokemon.item === 'Black Sludge') {
        if (pokemon.species.types.includes('Poison')) {
          const heal = Math.max(1, Math.floor(pokemon.maxHp / 16));
          pokemon.currentHp = clampHp(pokemon.currentHp + heal, pokemon.maxHp);
          this.addEvent(events, 'item_heal', {
            pokemon: pokemon.species.name,
            item: 'Black Sludge',
            amount: heal,
          });
        } else {
          const damage = Math.max(1, Math.floor(pokemon.maxHp / 8));
          pokemon.currentHp = clampHp(pokemon.currentHp - damage, pokemon.maxHp);
          this.addEvent(events, 'item_damage', {
            pokemon: pokemon.species.name,
            item: 'Black Sludge',
            damage,
          });
          this.checkFaint(pokemon, playerIndex, events);
        }
      }

      // Toxic Orb: badly poison at end of turn
      if (pokemon.item === 'Toxic Orb' && !pokemon.status) {
        this.applyStatus(pokemon, 'toxic', events);
        this.addEvent(events, 'item_trigger', { pokemon: pokemon.species.name, item: 'Toxic Orb' });
      }

      // Flame Orb: burn at end of turn
      if (pokemon.item === 'Flame Orb' && !pokemon.status) {
        this.applyStatus(pokemon, 'burn', events);
        this.addEvent(events, 'item_trigger', { pokemon: pokemon.species.name, item: 'Flame Orb' });
      }

      // Speed Boost
      if (pokemon.ability === 'Speed Boost') {
        this.applyBoost(pokemon, 'spe', 1, events);
      }

      // Encore countdown
      if (pokemon.encoreTurns > 0) {
        pokemon.encoreTurns--;
        if (pokemon.encoreTurns <= 0) {
          pokemon.encoreMove = null;
          pokemon.volatileStatuses.delete('encore');
          this.addEvent(events, 'volatile_cure', { pokemon: pokemon.species.name, status: 'encore' });
        }
      }

      // Clear flinch at end of turn
      pokemon.volatileStatuses.delete('flinch');
    }
  }

  private applyWeatherDamage(pokemon: BattlePokemon, playerIndex: number, events: BattleEvent[]): void {
    const types = pokemon.species.types as PokemonType[];

    if (this.state.weather === 'sandstorm') {
      // Immune: Rock, Ground, Steel types and Magic Guard, Overcoat, Sand Veil, Sand Rush, Sand Force
      const immuneTypes: PokemonType[] = ['Rock', 'Ground', 'Steel'];
      const immuneAbilities = ['Magic Guard', 'Overcoat', 'Sand Veil', 'Sand Rush', 'Sand Force'];
      if (immuneTypes.some(t => types.includes(t)) || immuneAbilities.includes(pokemon.ability)) return;

      const damage = Math.max(1, Math.floor(pokemon.maxHp / 16));
      pokemon.currentHp = clampHp(pokemon.currentHp - damage, pokemon.maxHp);
      this.addEvent(events, 'weather_damage', {
        pokemon: pokemon.species.name,
        weather: 'sandstorm',
        damage,
      });
      this.checkFaint(pokemon, playerIndex, events);
    }

    if (this.state.weather === 'hail') {
      // Immune: Ice types and Magic Guard, Overcoat, Ice Body, Snow Cloak
      const immuneAbilities = ['Magic Guard', 'Overcoat', 'Ice Body', 'Snow Cloak'];
      if (types.includes('Ice') || immuneAbilities.includes(pokemon.ability)) return;

      const damage = Math.max(1, Math.floor(pokemon.maxHp / 16));
      pokemon.currentHp = clampHp(pokemon.currentHp - damage, pokemon.maxHp);
      this.addEvent(events, 'weather_damage', {
        pokemon: pokemon.species.name,
        weather: 'hail',
        damage,
      });
      this.checkFaint(pokemon, playerIndex, events);
    }

    // Ice Body healing in hail
    if (this.state.weather === 'hail' && pokemon.ability === 'Ice Body') {
      const heal = Math.max(1, Math.floor(pokemon.maxHp / 16));
      pokemon.currentHp = clampHp(pokemon.currentHp + heal, pokemon.maxHp);
      this.addEvent(events, 'ability_heal', {
        pokemon: pokemon.species.name,
        ability: 'Ice Body',
        amount: heal,
      });
    }

    // Rain Dish
    if (this.state.weather === 'rain' && pokemon.ability === 'Rain Dish') {
      const heal = Math.max(1, Math.floor(pokemon.maxHp / 16));
      pokemon.currentHp = clampHp(pokemon.currentHp + heal, pokemon.maxHp);
    }

    // Dry Skin — heals in rain, extra damage in sun
    if (pokemon.ability === 'Dry Skin') {
      if (this.state.weather === 'rain') {
        const heal = Math.max(1, Math.floor(pokemon.maxHp / 8));
        pokemon.currentHp = clampHp(pokemon.currentHp + heal, pokemon.maxHp);
      } else if (this.state.weather === 'sun') {
        const damage = Math.max(1, Math.floor(pokemon.maxHp / 8));
        pokemon.currentHp = clampHp(pokemon.currentHp - damage, pokemon.maxHp);
        this.checkFaint(pokemon, playerIndex, events);
      }
    }
  }

  // --- Utility ---

  private getHitCount(move: MoveData): number {
    if (!move.flags.multiHit) return 1;
    const [min, max] = move.flags.multiHit as [number, number];
    if (min === max) return min;
    // Standard distribution: 2 hits 35%, 3 hits 35%, 4 hits 15%, 5 hits 15%
    const roll = this.rng.int(1, 100);
    if (roll <= 35) return 2;
    if (roll <= 70) return 3;
    if (roll <= 85) return 4;
    return 5;
  }

  private calculateConfusionDamage(pokemon: BattlePokemon): number {
    // Confusion uses a 40-power physical move with no modifiers
    const level = pokemon.level;
    const atk = pokemon.stats.atk;
    const def = pokemon.stats.def;
    const damage = Math.floor(
      Math.floor(
        (Math.floor((2 * level) / 5 + 2) * 40 * atk) / def
      ) / 50 + 2
    );
    return Math.max(1, damage);
  }

  private checkFaint(pokemon: BattlePokemon, playerIndex: number, events: BattleEvent[], fromDirectAttack: boolean = false): void {
    if (pokemon.currentHp <= 0) {
      // Endure: survive at 1 HP (only from direct attacks, not residual damage)
      if (fromDirectAttack && pokemon.volatileStatuses.has('endure')) {
        pokemon.currentHp = 1;
        this.addEvent(events, 'endure', { pokemon: pokemon.species.name });
        return;
      }
      pokemon.currentHp = 0;
      pokemon.isAlive = false;
      pokemon.status = null;
      pokemon.volatileStatuses.clear();
      this.addEvent(events, 'faint', { pokemon: pokemon.species.name, player: playerIndex });
    }
  }

  private checkBattleEnd(events: BattleEvent[]): boolean {
    for (let i = 0; i < 2; i++) {
      const player = this.state.players[i];
      const allFainted = player.team.every(p => !p.isAlive);
      if (allFainted) {
        const winnerId = this.state.players[1 - i].id;
        this.endBattle(winnerId, 'all_fainted', events);
        return true;
      }
    }
    // Turn limit check (100 turns)
    if (this.state.turn >= 100) {
      this.logger.warn('battle', 'Battle reached 100 turn limit');
      // Player with more remaining HP% wins
      const p1Hp = this.getTotalHpPercent(0);
      const p2Hp = this.getTotalHpPercent(1);
      const winnerId = p1Hp >= p2Hp ? this.state.players[0].id : this.state.players[1].id;
      this.endBattle(winnerId, 'turn_limit', events);
      return true;
    }
    return false;
  }

  private getTotalHpPercent(playerIndex: number): number {
    const player = this.state.players[playerIndex];
    let totalHp = 0, totalMaxHp = 0;
    for (const p of player.team) {
      totalHp += p.currentHp;
      totalMaxHp += p.maxHp;
    }
    return totalMaxHp > 0 ? totalHp / totalMaxHp : 0;
  }

  private endBattle(winnerId: string, reason: string, events: BattleEvent[]): void {
    this.state.status = 'finished';
    this.state.winner = winnerId;
    this.addEvent(events, 'battle_end', { winner: winnerId, reason });
    this.logger.info('battle', `Battle ended. Winner: ${winnerId}`, { reason });
  }

  private getSpeedOrder(): number[] {
    const speed0 = this.getEffectiveSpeed(0);
    const speed1 = this.getEffectiveSpeed(1);
    if (speed0 > speed1) return [0, 1];
    if (speed1 > speed0) return [1, 0];
    return this.rng.chance(50) ? [0, 1] : [1, 0];
  }

  private addEvent(events: BattleEvent[], type: string, data: Record<string, unknown>): void {
    const event: BattleEvent = {
      type,
      turn: this.state.turn,
      timestamp: new Date().toISOString(),
      data,
    };
    events.push(event);
    this.state.log.push(event);
  }
}

// --- Constants ---

const STRUGGLE: MoveData = {
  name: 'Struggle',
  type: 'Normal',
  category: 'Physical',
  power: 50,
  accuracy: null, // always hits
  pp: Infinity,
  priority: 0,
  flags: {},
  effects: [],
  target: 'normal',
};

function createEmptySideEffects(): SideEffects {
  return {
    stealthRock: false,
    spikesLayers: 0,
    toxicSpikesLayers: 0,
    reflect: 0,
    lightScreen: 0,
    tailwind: 0,
    stickyWeb: false,
    auroraVeil: 0,
  };
}
