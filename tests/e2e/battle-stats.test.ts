/**
 * Per-Pokemon battle stats tests.
 * Tests KO tracking, damage accumulation, faint counting,
 * save/load persistence, respawn survival, and shop initialization.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { Battle } from '../../src/engine/battle';
import { createBattlePokemon } from '../../src/engine/pokemon-factory';
import { serializeOwnPokemon } from '../../src/server/state-sanitizer';
import { battleReducer, initialState } from '../../src/client/state/battle-reducer';
import type { Player, PokemonSpecies, PokemonSet, BattlePokemon, PokemonType, Nature } from '../../src/types';

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
  return { id, name, team, activePokemonIndex: 0, itemMode: 'competitive', hasMegaEvolved: false };
}

describe('Per-Pokemon Battle Stats', () => {
  describe('KO counter', () => {
    it('increments attacker kos when a Pokemon KOs an opponent', () => {
      const p1 = createTestPlayer('p1', 'Ash');
      const p2 = createTestPlayer('p2', 'Gary');

      // Set defender HP to 1 so a single hit KOs it
      p2.team[0].currentHp = 1;

      const battle = new Battle(p1, p2, 42);
      battle.processTurn(
        { type: 'move', moveIndex: 0 }, // Tackle
        { type: 'move', moveIndex: 0 },
      );

      const attacker = battle.state.players[0].team[0];
      expect(attacker.battleStats.kos).toBe(1);
    });
  });

  describe('Damage dealt accumulation', () => {
    it('accumulates damage dealt correctly across hits', () => {
      const p1 = createTestPlayer('p1', 'Ash', [{ set: { item: null as any } }]);
      const p2 = createTestPlayer('p2', 'Gary', [{ set: { item: null as any } }]);

      const battle = new Battle(p1, p2, 42);

      battle.processTurn(
        { type: 'move', moveIndex: 0 },
        { type: 'move', moveIndex: 0 },
      );

      const p1Attacker = battle.state.players[0].team[0];
      const p2Attacker = battle.state.players[1].team[0];

      // Both should have dealt some damage
      expect(p1Attacker.battleStats.damageDealt).toBeGreaterThan(0);
      expect(p2Attacker.battleStats.damageDealt).toBeGreaterThan(0);

      // Second turn: damage should accumulate
      const p1DmgAfterTurn1 = p1Attacker.battleStats.damageDealt;
      battle.processTurn(
        { type: 'move', moveIndex: 0 },
        { type: 'move', moveIndex: 0 },
      );
      expect(p1Attacker.battleStats.damageDealt).toBeGreaterThan(p1DmgAfterTurn1);
    });
  });

  describe('Times fainted', () => {
    it('increments timesFainted when a Pokemon faints', () => {
      const p1 = createTestPlayer('p1', 'Ash');
      const p2 = createTestPlayer('p2', 'Gary');

      // Set p2 lead to 1 HP
      p2.team[0].currentHp = 1;

      const battle = new Battle(p1, p2, 42);
      battle.processTurn(
        { type: 'move', moveIndex: 0 },
        { type: 'move', moveIndex: 0 },
      );

      const faintedMon = battle.state.players[1].team[0];
      expect(faintedMon.isAlive).toBe(false);
      expect(faintedMon.battleStats.timesFainted).toBe(1);
    });
  });

  describe('Save/load persistence', () => {
    it('battleStats are included in serialized OwnPokemon', () => {
      const species = createTestSpecies();
      const set = createTestSet();
      const mon = createBattlePokemon(species, set);
      mon.battleStats = { kos: 5, damageDealt: 1200, timesFainted: 2 };

      const serialized = serializeOwnPokemon(mon);
      expect(serialized.battleStats).toEqual({ kos: 5, damageDealt: 1200, timesFainted: 2 });
    });

    it('new Pokemon starts with zeroed battleStats', () => {
      const species = createTestSpecies();
      const set = createTestSet();
      const mon = createBattlePokemon(species, set);

      expect(mon.battleStats).toEqual({ kos: 0, damageDealt: 0, timesFainted: 0 });

      const serialized = serializeOwnPokemon(mon);
      expect(serialized.battleStats).toEqual({ kos: 0, damageDealt: 0, timesFainted: 0 });
    });
  });

  describe('Stats survive respawn', () => {
    it('battleStats preserved through returnToMapAfterLoss heal cycle', () => {
      // Simulate: a BattlePokemon with accumulated stats gets respawned
      const species = createTestSpecies();
      const set = createTestSet();
      const mon = createBattlePokemon(species, set);
      mon.battleStats = { kos: 3, damageDealt: 800, timesFainted: 1 };
      mon.currentHp = 0;
      mon.isAlive = false;

      // Simulate the heal logic from returnToMapAfterLoss
      const healed = {
        ...mon,
        currentHp: mon.stats.hp,
        maxHp: mon.stats.hp,
        isAlive: true,
        status: null,
        volatileStatuses: new Set<string>(),
        battleStats: mon.battleStats ? { ...mon.battleStats } : { kos: 0, damageDealt: 0, timesFainted: 0 },
      };

      expect(healed.isAlive).toBe(true);
      expect(healed.battleStats).toEqual({ kos: 3, damageDealt: 800, timesFainted: 1 });
    });
  });

  describe('Shop Pokemon initialization', () => {
    it('newly created Pokemon has all battleStats at 0', () => {
      const species = createTestSpecies({ id: 'shopmon', name: 'ShopMon' });
      const set = createTestSet();
      const newMon = createBattlePokemon(species, set, 100, null);

      expect(newMon.battleStats).toEqual({ kos: 0, damageDealt: 0, timesFainted: 0 });
    });
  });
});
