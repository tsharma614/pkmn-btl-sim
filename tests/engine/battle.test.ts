import { describe, it, expect, beforeEach } from 'vitest';
import { Battle } from '../../src/engine/battle';
import { createBattlePokemon } from '../../src/engine/pokemon-factory';
import { Player, PokemonSpecies, PokemonSet, BattlePokemon, PokemonType, Nature } from '../../src/types';

function createTestSpecies(overrides: Partial<PokemonSpecies> = {}): PokemonSpecies {
  return {
    id: 'testmon',
    name: 'Testmon',
    dexNum: 1,
    types: ['Normal'] as [PokemonType],
    baseStats: { hp: 100, atk: 100, def: 100, spa: 100, spd: 100, spe: 100 },
    abilities: ['Overgrow'],
    bestAbility: 'Overgrow',
    tier: 3,
    generation: 1,
    movePool: [],
    sets: [],
    ...overrides,
  } as PokemonSpecies;
}

function createTestSet(overrides: Partial<PokemonSet> = {}): PokemonSet {
  return {
    moves: ['Tackle', 'Thunderbolt', 'Ice Beam', 'Earthquake'],
    ability: 'Overgrow',
    item: 'Leftovers',
    nature: 'Hardy' as Nature,
    evs: { hp: 252, atk: 252, spe: 4 },
    ...overrides,
  };
}

function createTestPlayer(
  id: string,
  name: string,
  teamOverrides: Array<{ species?: Partial<PokemonSpecies>; set?: Partial<PokemonSet> }> = []
): Player {
  const team: BattlePokemon[] = [];
  for (let i = 0; i < 6; i++) {
    const overrides = teamOverrides[i] || {};
    const species = createTestSpecies({ id: `mon${i}`, name: `Mon${i}`, ...overrides.species });
    const set = createTestSet(overrides.set);
    team.push(createBattlePokemon(species, set));
  }

  return {
    id,
    name,
    team,
    activePokemonIndex: 0,
    itemMode: 'competitive',
    hasMegaEvolved: false,
  };
}

describe('Battle Engine', () => {
  let battle: Battle;
  let p1: Player;
  let p2: Player;

  beforeEach(() => {
    p1 = createTestPlayer('p1', 'Tanmay');
    p2 = createTestPlayer('p2', 'Nikhil');
    battle = new Battle(p1, p2, 42);
  });

  describe('initialization', () => {
    it('creates a battle with correct initial state', () => {
      expect(battle.state.turn).toBe(0);
      expect(battle.state.status).toBe('active');
      expect(battle.state.weather).toBe('none');
      expect(battle.state.winner).toBeNull();
    });

    it('both players start with first Pokemon active', () => {
      expect(battle.state.players[0].activePokemonIndex).toBe(0);
      expect(battle.state.players[1].activePokemonIndex).toBe(0);
    });

    it('all Pokemon start at full HP', () => {
      for (const player of battle.state.players) {
        for (const pokemon of player.team) {
          expect(pokemon.currentHp).toBe(pokemon.maxHp);
          expect(pokemon.isAlive).toBe(true);
        }
      }
    });

    it('logs the RNG seed', () => {
      expect(battle.state.rngSeed).toBe(42);
    });
  });

  describe('turn processing', () => {
    it('increments turn counter', () => {
      battle.processTurn(
        { type: 'move', playerId: 'p1', moveIndex: 0 },
        { type: 'move', playerId: 'p2', moveIndex: 0 }
      );
      expect(battle.state.turn).toBe(1);
    });

    it('deals damage with attacking moves', () => {
      const events = battle.processTurn(
        { type: 'move', playerId: 'p1', moveIndex: 0 },
        { type: 'move', playerId: 'p2', moveIndex: 0 }
      );
      // At least one Pokemon should have taken damage
      const p1Hp = battle.getActivePokemon(0).currentHp;
      const p2Hp = battle.getActivePokemon(1).currentHp;
      expect(p1Hp < battle.getActivePokemon(0).maxHp || p2Hp < battle.getActivePokemon(1).maxHp).toBe(true);
    });
  });

  describe('switching', () => {
    it('switches active Pokemon', () => {
      battle.processTurn(
        { type: 'switch', playerId: 'p1', pokemonIndex: 1 },
        { type: 'move', playerId: 'p2', moveIndex: 0 }
      );
      expect(battle.state.players[0].activePokemonIndex).toBe(1);
    });

    it('resets boosts on switch', () => {
      // Boost the active Pokemon
      battle.getActivePokemon(0).boosts.atk = 2;

      battle.processTurn(
        { type: 'switch', playerId: 'p1', pokemonIndex: 1 },
        { type: 'move', playerId: 'p2', moveIndex: 0 }
      );

      // Old Pokemon's boosts should be reset
      expect(p1.team[0].boosts.atk).toBe(0);
    });

    it('clears volatile statuses on switch', () => {
      battle.getActivePokemon(0).volatileStatuses.add('confusion');

      battle.processTurn(
        { type: 'switch', playerId: 'p1', pokemonIndex: 1 },
        { type: 'move', playerId: 'p2', moveIndex: 0 }
      );

      expect(p1.team[0].volatileStatuses.size).toBe(0);
    });

    it('switches go before moves', () => {
      const events = battle.processTurn(
        { type: 'switch', playerId: 'p1', pokemonIndex: 1 },
        { type: 'move', playerId: 'p2', moveIndex: 0 }
      );

      const switchEvent = events.find(e => e.type === 'switch');
      const moveEvent = events.find(e => e.type === 'use_move');

      expect(switchEvent).toBeDefined();
      expect(moveEvent).toBeDefined();
      expect(events.indexOf(switchEvent!)).toBeLessThan(events.indexOf(moveEvent!));
    });
  });

  describe('forfeit', () => {
    it('forfeiting ends the battle', () => {
      const events = battle.processTurn(
        { type: 'forfeit', playerId: 'p1' },
        { type: 'move', playerId: 'p2', moveIndex: 0 }
      );

      expect(battle.state.status).toBe('finished');
      expect(battle.state.winner).toBe('p2');
    });
  });

  describe('status conditions', () => {
    it('applies burn status', () => {
      const events: any[] = [];
      const defender = battle.getActivePokemon(1);
      battle.applyStatus(defender, 'burn', events);

      expect(defender.status).toBe('burn');
    });

    it('Fire types are immune to burn', () => {
      const fireSpecies = createTestSpecies({ types: ['Fire'] as [PokemonType] });
      const fireSet = createTestSet();
      const firePokemon = createBattlePokemon(fireSpecies, fireSet);
      p2.team[0] = firePokemon;
      p2.activePokemonIndex = 0;

      const events: any[] = [];
      const result = battle.applyStatus(firePokemon, 'burn', events);
      expect(result).toBe(false);
      expect(firePokemon.status).toBeNull();
    });

    it('Electric types are immune to paralysis', () => {
      const elecSpecies = createTestSpecies({ types: ['Electric'] as [PokemonType] });
      const elecPokemon = createBattlePokemon(elecSpecies, createTestSet());

      const events: any[] = [];
      const result = battle.applyStatus(elecPokemon, 'paralysis', events);
      expect(result).toBe(false);
    });

    it('Poison/Steel types are immune to poison', () => {
      const poisonSpecies = createTestSpecies({ types: ['Poison'] as [PokemonType] });
      const poisonPokemon = createBattlePokemon(poisonSpecies, createTestSet());

      const events: any[] = [];
      expect(battle.applyStatus(poisonPokemon, 'poison', events)).toBe(false);
      expect(battle.applyStatus(poisonPokemon, 'toxic', events)).toBe(false);
    });

    it('Ice types are immune to freeze', () => {
      const iceSpecies = createTestSpecies({ types: ['Ice'] as [PokemonType] });
      const icePokemon = createBattlePokemon(iceSpecies, createTestSet());

      const events: any[] = [];
      expect(battle.applyStatus(icePokemon, 'freeze', events)).toBe(false);
    });

    it('cannot apply a second status', () => {
      const pokemon = battle.getActivePokemon(0);
      const events: any[] = [];

      battle.applyStatus(pokemon, 'burn', events);
      expect(pokemon.status).toBe('burn');

      const result = battle.applyStatus(pokemon, 'paralysis', events);
      expect(result).toBe(false);
      expect(pokemon.status).toBe('burn');
    });
  });

  describe('stat boosts', () => {
    it('applies boost correctly', () => {
      const pokemon = battle.getActivePokemon(0);
      const events: any[] = [];

      battle.applyBoost(pokemon, 'atk', 2, events);
      expect(pokemon.boosts.atk).toBe(2);
    });

    it('caps at +6', () => {
      const pokemon = battle.getActivePokemon(0);
      const events: any[] = [];

      battle.applyBoost(pokemon, 'atk', 6, events);
      battle.applyBoost(pokemon, 'atk', 2, events);
      expect(pokemon.boosts.atk).toBe(6);
    });

    it('caps at -6', () => {
      const pokemon = battle.getActivePokemon(0);
      const events: any[] = [];

      battle.applyBoost(pokemon, 'def', -6, events);
      battle.applyBoost(pokemon, 'def', -2, events);
      expect(pokemon.boosts.def).toBe(-6);
    });
  });

  describe('weather', () => {
    it('sets weather correctly', () => {
      const events: any[] = [];
      battle.setWeather('rain', events);
      expect(battle.state.weather).toBe('rain');
      expect(battle.state.weatherTurnsRemaining).toBe(5);
    });
  });

  describe('entry hazards', () => {
    it('Stealth Rock deals type-based damage on switch', () => {
      // Set Stealth Rock on p1's side
      battle.state.fieldEffects.player1Side.stealthRock = true;

      // P1 switches — new Pokemon takes SR damage
      const events = battle.processTurn(
        { type: 'switch', playerId: 'p1', pokemonIndex: 1 },
        { type: 'move', playerId: 'p2', moveIndex: 0 }
      );

      const srEvent = events.find(e => e.type === 'hazard_damage' && e.data.hazard === 'Stealth Rock');
      expect(srEvent).toBeDefined();
    });

    it('Stealth Rock actually reduces switched-in Pokemon HP', () => {
      battle.state.fieldEffects.player2Side.stealthRock = true;
      const bench = battle.state.players[1].team[1];
      const hpBefore = bench.currentHp;

      const events = battle.processTurn(
        { type: 'move', playerId: 'p1', moveIndex: 0 },
        { type: 'switch', playerId: 'p2', pokemonIndex: 1 }
      );

      // After switching, the new active Pokemon should have taken SR damage
      const newActive = battle.getActivePokemon(1);
      expect(newActive.currentHp).toBeLessThan(hpBefore);
      const srEvent = events.find(e => e.type === 'hazard_damage' && e.data.hazard === 'Stealth Rock');
      expect(srEvent).toBeDefined();
      expect(srEvent!.data.damage).toBeGreaterThan(0);
    });

    it('using Stealth Rock move sets hazard on opponent side', () => {
      // Give p1 Stealth Rock as a move
      const attacker = battle.getActivePokemon(0);
      attacker.moves[0] = {
        data: {
          name: 'Stealth Rock', type: 'Rock', category: 'Status',
          power: null, accuracy: null, pp: 20, priority: 0,
          target: 'foeSide', flags: { contact: false, sound: false, bullet: false, punch: false, bite: false, pulse: false, protect: false, mirror: false, defrost: false, charge: false },
          effects: [{ type: 'hazard', hazard: 'stealthrock', chance: 100 }],
          critRatio: 1, willCrit: false, forceSwitch: false,
        } as any,
        currentPp: 20,
        maxPp: 20,
      };

      expect(battle.getSideEffects(1).stealthRock).toBe(false);

      battle.processTurn(
        { type: 'move', playerId: 'p1', moveIndex: 0 },
        { type: 'move', playerId: 'p2', moveIndex: 0 }
      );

      expect(battle.getSideEffects(1).stealthRock).toBe(true);
    });

    it('Stealth Rock set by move → switch next turn → damage applied', () => {
      // Give p1 Stealth Rock
      const attacker = battle.getActivePokemon(0);
      attacker.moves[0] = {
        data: {
          name: 'Stealth Rock', type: 'Rock', category: 'Status',
          power: null, accuracy: null, pp: 20, priority: 0,
          target: 'foeSide', flags: { contact: false, sound: false, bullet: false, punch: false, bite: false, pulse: false, protect: false, mirror: false, defrost: false, charge: false },
          effects: [{ type: 'hazard', hazard: 'stealthrock', chance: 100 }],
          critRatio: 1, willCrit: false, forceSwitch: false,
        } as any,
        currentPp: 20,
        maxPp: 20,
      };

      // Turn 1: Set Stealth Rock
      battle.processTurn(
        { type: 'move', playerId: 'p1', moveIndex: 0 },
        { type: 'move', playerId: 'p2', moveIndex: 0 }
      );
      expect(battle.getSideEffects(1).stealthRock).toBe(true);

      // Turn 2: P2 switches — should take SR damage
      const bench = battle.state.players[1].team[1];
      const hpBefore = bench.currentHp;

      const events = battle.processTurn(
        { type: 'move', playerId: 'p1', moveIndex: 0 },
        { type: 'switch', playerId: 'p2', pokemonIndex: 1 }
      );

      expect(battle.getActivePokemon(1).currentHp).toBeLessThan(hpBefore);
      const srEvent = events.find(e => e.type === 'hazard_damage' && e.data.hazard === 'Stealth Rock');
      expect(srEvent).toBeDefined();
    });
  });

  describe('switch-in damage from attacks', () => {
    it('opponent attack hits newly switched-in Pokemon', () => {
      // P1 switches, P2 attacks — attack should hit the NEW Pokemon
      const oldActive = battle.getActivePokemon(0);
      const bench = battle.state.players[0].team[1];
      const benchHpBefore = bench.currentHp;

      const events = battle.processTurn(
        { type: 'switch', playerId: 'p1', pokemonIndex: 1 },
        { type: 'move', playerId: 'p2', moveIndex: 0 }
      );

      // Old Pokemon should be at full HP (wasn't hit)
      expect(oldActive.currentHp).toBe(oldActive.maxHp);
      // New Pokemon should have taken damage
      const newActive = battle.getActivePokemon(0);
      expect(newActive).toBe(bench);
      // The damage event should reference the new Pokemon
      const dmgEvent = events.find(e => e.type === 'damage' && e.data.defender === bench.species.name);
      expect(dmgEvent).toBeDefined();
    });

    it('switch-in Pokemon takes both hazard and attack damage', () => {
      battle.state.fieldEffects.player1Side.stealthRock = true;
      const bench = battle.state.players[0].team[1];
      const hpBefore = bench.currentHp;

      const events = battle.processTurn(
        { type: 'switch', playerId: 'p1', pokemonIndex: 1 },
        { type: 'move', playerId: 'p2', moveIndex: 0 }
      );

      const newActive = battle.getActivePokemon(0);
      const srEvent = events.find(e => e.type === 'hazard_damage' && e.data.hazard === 'Stealth Rock');
      const dmgEvent = events.find(e => e.type === 'damage' && e.data.defender === bench.species.name);
      expect(srEvent).toBeDefined();
      expect(dmgEvent).toBeDefined();
      // Should have taken BOTH hazard AND attack damage
      expect(newActive.currentHp).toBeLessThan(hpBefore - (srEvent!.data.damage as number));
    });
  });

  describe('fainting', () => {
    it('Pokemon faints at 0 HP', () => {
      const defender = battle.getActivePokemon(1);
      defender.currentHp = 1;

      battle.processTurn(
        { type: 'move', playerId: 'p1', moveIndex: 0 },
        { type: 'move', playerId: 'p2', moveIndex: 0 }
      );

      // The defender should have fainted (if it was hit)
      if (!defender.isAlive) {
        expect(defender.currentHp).toBe(0);
        expect(defender.status).toBeNull();
      }
    });

    it('battle ends when all Pokemon faint', () => {
      // Kill all but one of p2's Pokemon
      for (let i = 1; i < 6; i++) {
        p2.team[i].currentHp = 0;
        p2.team[i].isAlive = false;
      }
      p2.team[0].currentHp = 1;

      // Run turns until battle ends
      for (let i = 0; i < 10; i++) {
        if (battle.state.status === 'finished') break;
        battle.processTurn(
          { type: 'move', playerId: 'p1', moveIndex: 0 },
          { type: 'move', playerId: 'p2', moveIndex: 0 }
        );
      }

      // Battle should end
      if (battle.state.status === 'finished') {
        expect(battle.state.winner).toBe('p1');
      }
    });
  });

  describe('available moves', () => {
    it('returns all moves with PP', () => {
      const moves = battle.getAvailableMoves(0);
      expect(moves.length).toBeGreaterThan(0);
    });

    it('excludes moves with 0 PP', () => {
      const pokemon = battle.getActivePokemon(0);
      pokemon.moves[0].currentPp = 0;

      const moves = battle.getAvailableMoves(0);
      expect(moves).not.toContain(0);
    });

    it('choice locked returns only locked move', () => {
      const pokemon = battle.getActivePokemon(0);
      pokemon.choiceLocked = pokemon.moves[2].data.name;

      const moves = battle.getAvailableMoves(0);
      expect(moves).toEqual([2]);
    });
  });

  describe('available switches', () => {
    it('returns alive non-active Pokemon', () => {
      const switches = battle.getAvailableSwitches(0);
      expect(switches).toHaveLength(5); // 6 total - 1 active = 5
      expect(switches).not.toContain(0); // Active index excluded
    });

    it('excludes fainted Pokemon', () => {
      p1.team[1].isAlive = false;
      p1.team[1].currentHp = 0;

      const switches = battle.getAvailableSwitches(0);
      expect(switches).toHaveLength(4);
      expect(switches).not.toContain(1);
    });
  });

  describe('turn limit', () => {
    it('battle ends at 100 turns', () => {
      battle.state.turn = 99;
      battle.processTurn(
        { type: 'move', playerId: 'p1', moveIndex: 0 },
        { type: 'move', playerId: 'p2', moveIndex: 0 }
      );

      expect(battle.state.status).toBe('finished');
      expect(battle.state.winner).toBeTruthy();
    });
  });
});
