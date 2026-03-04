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

export class Battle {
  state: BattleState;
  rng: SeededRNG;
  logger: BattleLogger;

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
    this.getActivePokemon(0).hasMovedThisTurn = false;
    this.getActivePokemon(1).hasMovedThisTurn = false;

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
      if (move) return move.data.priority;
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
      speed = Math.floor(speed * 0.25);
    }

    // Choice Scarf
    if (pokemon.item === 'Choice Scarf') {
      speed = Math.floor(speed * 1.5);
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

    // Check paralysis
    if (attacker.status === 'paralysis' && this.rng.chance(25)) {
      this.addEvent(events, 'cant_move', { pokemon: attacker.species.name, reason: 'paralysis' });
      return;
    }

    // Check sleep
    if (attacker.status === 'sleep') {
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

    this.addEvent(events, 'use_move', {
      pokemon: attacker.species.name,
      move: move.name,
      player: playerIndex,
    });

    // Accuracy check
    if (!rollAccuracy(this.rng, move.accuracy, attacker.boosts.accuracy, defender.boosts.evasion)) {
      this.addEvent(events, 'miss', { pokemon: attacker.species.name, move: move.name });
      return;
    }

    // Type immunity check for non-status moves
    if (move.category !== 'Status') {
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

    // Set last move used
    attacker.lastMoveUsed = move.name;
    attacker.hasMovedThisTurn = true;

    // Choice lock
    if (!isStruggle && (attacker.item === 'Choice Band' || attacker.item === 'Choice Specs' || attacker.item === 'Choice Scarf')) {
      attacker.choiceLocked = move.name;
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

      const damage = result.finalDamage;
      totalDamage += damage;

      // Apply damage
      defender.currentHp = clampHp(defender.currentHp - damage, defender.maxHp);

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

      this.checkFaint(defender, opponentIndex, events);
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

    // Life Orb recoil
    if (attacker.item === 'Life Orb' && totalDamage > 0 && attacker.ability !== 'Magic Guard') {
      const lifeOrbRecoil = Math.max(1, Math.floor(attacker.maxHp / 10));
      attacker.currentHp = clampHp(attacker.currentHp - lifeOrbRecoil, attacker.maxHp);
      this.addEvent(events, 'item_damage', {
        pokemon: attacker.species.name,
        item: 'Life Orb',
        damage: lifeOrbRecoil,
      });
      this.checkFaint(attacker, playerIndex, events);
    }

    // Secondary effects (status, stat drops, flinch)
    if (defender.isAlive) {
      this.applyMoveEffects(attacker, defender, move, playerIndex, opponentIndex, events);
    }

    // Contact-triggered abilities
    if (move.flags.contact && defender.isAlive && attacker.isAlive) {
      this.handleContactAbilities(attacker, defender, playerIndex, opponentIndex, events);
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
        case 'status':
          if (effect.target === 'self') {
            this.applyStatus(attacker, effect.status as StatusCondition, events);
          } else {
            this.applyStatus(defender, effect.status as StatusCondition, events);
          }
          break;

        case 'boost': {
          const target = effect.target === 'self' ? attacker : defender;
          this.applyBoost(target, effect.stat as BoostableStat, effect.stages as number, events);
          break;
        }

        case 'weather':
          this.setWeather(effect.weather as Weather, events);
          break;

        case 'hazard':
          this.applyHazard(opponentIndex, effect.hazard as string, events);
          break;

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

    // Handle moves that directly set status/boosts (from Showdown data format)
    // These are stored on the move itself, not in effects array
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
    events: BattleEvent[]
  ): void {
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

    // Clear volatile statuses on switch-out
    oldPokemon.volatileStatuses.clear();
    oldPokemon.boosts = { atk: 0, def: 0, spa: 0, spd: 0, spe: 0, accuracy: 0, evasion: 0 };
    oldPokemon.choiceLocked = null;
    oldPokemon.toxicCounter = oldPokemon.status === 'toxic' ? 1 : 0;
    oldPokemon.confusionTurns = 0;

    this.addEvent(events, 'switch', {
      player: playerIndex,
      from: oldPokemon.species.name,
      to: newPokemon.species.name,
    });

    player.activePokemonIndex = pokemonIndex;

    // Apply entry hazards
    this.applyEntryHazards(playerIndex, newPokemon, events);

    // Switch-in abilities
    this.handleSwitchInAbility(playerIndex, newPokemon, events);
  }

  private applyEntryHazards(playerIndex: number, pokemon: BattlePokemon, events: BattleEvent[]): void {
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
          this.applyBoost(opponent, 'atk', -1, events);
          this.addEvent(events, 'ability_trigger', {
            pokemon: pokemon.species.name,
            ability: 'Intimidate',
          });
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
        if (defender.currentHp === defender.maxHp) mods.finalMod = (mods.finalMod || 1) * 0.5;
        break;
      case 'Solid Rock':
      case 'Filter':
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
    }

    // Screens
    const defenderSide = this.getSideEffects(defender === this.getActivePokemon(0) ? 0 : 1);
    if (move.category === 'Physical' && defenderSide.reflect > 0) {
      mods.finalMod = (mods.finalMod || 1) * 0.5;
    }
    if (move.category === 'Special' && defenderSide.lightScreen > 0) {
      mods.finalMod = (mods.finalMod || 1) * 0.5;
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
      if (pokemon.volatileStatuses.has('leech-seed')) {
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

      // Speed Boost
      if (pokemon.ability === 'Speed Boost') {
        this.applyBoost(pokemon, 'spe', 1, events);
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

  private checkFaint(pokemon: BattlePokemon, playerIndex: number, events: BattleEvent[]): void {
    if (pokemon.currentHp <= 0) {
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
  };
}
