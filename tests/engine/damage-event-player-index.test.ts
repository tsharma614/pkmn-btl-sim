/**
 * Tests that damage events include defenderPlayer index and faint events include player index.
 * This is critical for correct animation routing in the client event queue.
 */
import { describe, it, expect } from 'vitest';
import { Battle } from '../../src/engine/battle';
import { Player, PokemonSpecies, PokemonSet, BattlePokemon, PokemonType, Nature } from '../../src/types';
import { createBattlePokemon } from '../../src/engine/pokemon-factory';
import { SeededRNG } from '../../src/utils/rng';

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

function createTestPlayer(name: string, teamOverrides: Array<{ species?: Partial<PokemonSpecies>; set?: Partial<PokemonSet> }> = []): Player {
  const team: BattlePokemon[] = [];
  for (let i = 0; i < 6; i++) {
    const overrides = teamOverrides[i] || {};
    const species = createTestSpecies({ id: `mon${i}`, name: `Mon${i}`, ...overrides.species });
    const set = createTestSet(overrides.set);
    team.push(createBattlePokemon(species, set));
  }
  return { id: `p${name}`, name, team, activePokemonIndex: 0 };
}

describe('Damage Event Player Index', () => {
  it('damage events include defenderPlayer field', () => {
    const p1 = createTestPlayer('Alice');
    const p2 = createTestPlayer('Bob');
    const battle = new Battle(p1, p2, new SeededRNG(42));

    const events = battle.processTurn(
      { type: 'move', playerId: 'p', moveIndex: 0 },
      { type: 'move', playerId: 'p', moveIndex: 0 },
    );

    const damageEvents = events.filter(e => e.type === 'damage');
    expect(damageEvents.length).toBeGreaterThan(0);

    for (const event of damageEvents) {
      expect(event.data).toHaveProperty('defenderPlayer');
      expect([0, 1]).toContain(event.data.defenderPlayer);
    }
  });

  it('defenderPlayer correctly identifies which player was hit', () => {
    // Make P1 much faster so they attack first
    const p1 = createTestPlayer('Alice', [{ species: { baseStats: { hp: 100, atk: 100, def: 100, spa: 100, spd: 100, spe: 200 } } }]);
    const p2 = createTestPlayer('Bob', [{ species: { baseStats: { hp: 100, atk: 100, def: 100, spa: 100, spd: 100, spe: 10 } } }]);
    const battle = new Battle(p1, p2, new SeededRNG(42));

    const events = battle.processTurn(
      { type: 'move', playerId: 'p', moveIndex: 0 },
      { type: 'move', playerId: 'p', moveIndex: 0 },
    );

    const damageEvents = events.filter(e => e.type === 'damage');
    expect(damageEvents.length).toBeGreaterThanOrEqual(2);

    // P1 is faster, hits P2 first → defenderPlayer = 1
    expect(damageEvents[0].data.defenderPlayer).toBe(1);
    // P2 hits P1 second → defenderPlayer = 0
    expect(damageEvents[1].data.defenderPlayer).toBe(0);
  });

  it('faint events include player field', () => {
    const p1 = createTestPlayer('Alice', [{ species: { baseStats: { hp: 100, atk: 100, def: 100, spa: 100, spd: 100, spe: 200 } } }]);
    const p2 = createTestPlayer('Bob');
    // Set P2's lead to 1 HP so it faints from Tackle
    p2.team[0].currentHp = 1;
    const battle = new Battle(p1, p2, new SeededRNG(42));

    const events = battle.processTurn(
      { type: 'move', playerId: 'p', moveIndex: 0 },
      { type: 'move', playerId: 'p', moveIndex: 0 },
    );

    const faintEvents = events.filter(e => e.type === 'faint');
    expect(faintEvents.length).toBeGreaterThanOrEqual(1);
    // P2's Pokemon fainted, so player = 1
    expect(faintEvents[0].data.player).toBe(1);
  });

  it('faint event player matches the fainted Pokemon owner (P1 faints)', () => {
    const p1 = createTestPlayer('Alice');
    const p2 = createTestPlayer('Bob', [{ species: { baseStats: { hp: 100, atk: 100, def: 100, spa: 100, spd: 100, spe: 200 } } }]);
    // Set P1's lead to 1 HP so it faints
    p1.team[0].currentHp = 1;
    const battle = new Battle(p1, p2, new SeededRNG(42));

    const events = battle.processTurn(
      { type: 'move', playerId: 'p', moveIndex: 0 },
      { type: 'move', playerId: 'p', moveIndex: 0 },
    );

    const faintEvents = events.filter(e => e.type === 'faint');
    expect(faintEvents.length).toBeGreaterThanOrEqual(1);
    // P1's Pokemon fainted, so player = 0
    expect(faintEvents[0].data.player).toBe(0);
  });

  it('defenderPlayer is consistent — defender name matches defender player team', () => {
    const p1 = createTestPlayer('Alice');
    const p2 = createTestPlayer('Bob');
    const battle = new Battle(p1, p2, new SeededRNG(42));

    const events = battle.processTurn(
      { type: 'move', playerId: 'p', moveIndex: 0 },
      { type: 'move', playerId: 'p', moveIndex: 0 },
    );

    const damageEvents = events.filter(e => e.type === 'damage');
    for (const event of damageEvents) {
      const dp = event.data.defenderPlayer as number;
      const defenderName = event.data.defender as string;
      const team = dp === 0 ? p1.team : p2.team;
      expect(
        team.some(p => p.species.name === defenderName),
        `Defender ${defenderName} should be on player ${dp}'s team`,
      ).toBe(true);
    }
  });
});
