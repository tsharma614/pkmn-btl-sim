import { describe, it, expect } from 'vitest';
import { Battle } from '../../src/engine/battle';
import { createBattlePokemon } from '../../src/engine/pokemon-factory';
import { Player, PokemonSpecies, PokemonSet, PokemonType, Nature } from '../../src/types';

function createTestSpecies(overrides: Partial<PokemonSpecies> = {}): PokemonSpecies {
  return {
    id: 'testmon', name: 'Testmon', dexNum: 1,
    types: ['Normal'] as [PokemonType],
    baseStats: { hp: 100, atk: 100, def: 100, spa: 100, spd: 100, spe: 100 },
    abilities: ['Overgrow'], bestAbility: 'Overgrow',
    tier: 3, generation: 1, movePool: [], sets: [],
    ...overrides,
  } as PokemonSpecies;
}

function createTestSet(overrides: Partial<PokemonSet> = {}): PokemonSet {
  return {
    moves: ['Tackle', 'Thunderbolt', 'Ice Beam', 'Earthquake'],
    ability: 'Overgrow', item: 'Leftovers',
    nature: 'Hardy' as Nature, evs: { hp: 252, atk: 252, spe: 4 },
    ...overrides,
  };
}

function makePlayer(id: string, name: string, teamOverrides: Array<{ species?: Partial<PokemonSpecies>; set?: Partial<PokemonSet> }> = []): Player {
  const team = [];
  for (let i = 0; i < 6; i++) {
    const overrides = teamOverrides[i] || {};
    const species = createTestSpecies({ id: 'mon' + i, name: 'Mon' + i, ...overrides.species });
    team.push(createBattlePokemon(species, createTestSet(overrides.set)));
  }
  return { id, name, team, activePokemonIndex: 0, itemMode: 'competitive', hasMegaEvolved: false };
}

describe('Spectral Thief', () => {
  it('steals positive boosts from the target before dealing damage', () => {
    const p1 = makePlayer('p1', 'Alice', [
      { species: { types: ['Ghost', 'Fighting'] as any }, set: { moves: ['Spectral Thief', 'Tackle', 'Thunderbolt', 'Ice Beam'] } },
    ]);
    const p2 = makePlayer('p2', 'Bob', [
      { species: { types: ['Fighting'] as any }, set: { moves: ['Swords Dance', 'Tackle', 'Thunderbolt', 'Ice Beam'] } },
    ]);

    const battle = new Battle(p1, p2, 42);

    // First turn: P2 uses Swords Dance (+2 Atk)
    battle.processTurn(
      { type: 'move', playerId: 'p1', moveIndex: 1 }, // Tackle
      { type: 'move', playerId: 'p2', moveIndex: 0 }, // Swords Dance
    );

    expect(battle.state.players[1].team[0].boosts.atk).toBe(2);

    // Second turn: P1 uses Spectral Thief — should steal the +2 Atk
    const events = battle.processTurn(
      { type: 'move', playerId: 'p1', moveIndex: 0 }, // Spectral Thief
      { type: 'move', playerId: 'p2', moveIndex: 1 }, // Tackle
    );

    // P1 should have stolen the boosts
    expect(battle.state.players[0].team[0].boosts.atk).toBe(2);
    // P2 should have lost them
    expect(battle.state.players[1].team[0].boosts.atk).toBe(0);
    // Should have a boost_steal event
    const stealEvents = events.filter(e => e.type === 'boost_steal');
    expect(stealEvents.length).toBe(1);
  });

  it('does not steal negative boosts', () => {
    const p1 = makePlayer('p1', 'Alice', [
      { species: { types: ['Ghost', 'Fighting'] as any }, set: { moves: ['Spectral Thief', 'Tackle', 'Thunderbolt', 'Ice Beam'] } },
    ]);
    const p2 = makePlayer('p2', 'Bob', [
      { species: { types: ['Fighting'] as any } },
    ]);

    const battle = new Battle(p1, p2, 42);
    // Manually set negative boosts on P2
    battle.state.players[1].team[0].boosts.atk = -2;
    battle.state.players[1].team[0].boosts.spe = -1;

    const events = battle.processTurn(
      { type: 'move', playerId: 'p1', moveIndex: 0 }, // Spectral Thief
      { type: 'move', playerId: 'p2', moveIndex: 0 },
    );

    // Negative boosts should NOT be stolen
    expect(battle.state.players[0].team[0].boosts.atk).toBe(0);
    expect(battle.state.players[1].team[0].boosts.atk).toBe(-2);
    // No boost_steal event when nothing positive to steal
    const stealEvents = events.filter(e => e.type === 'boost_steal');
    expect(stealEvents.length).toBe(0);
  });

  it('deals damage after stealing boosts (physical, Ghost type)', () => {
    const p1 = makePlayer('p1', 'Alice', [
      { species: { types: ['Ghost', 'Fighting'] as any }, set: { moves: ['Spectral Thief', 'Tackle', 'Thunderbolt', 'Ice Beam'] } },
    ]);
    const p2 = makePlayer('p2', 'Bob', [
      { species: { types: ['Fighting'] as any } },
    ]);

    const battle = new Battle(p1, p2, 42);
    const initialHp = battle.state.players[1].team[0].currentHp;

    battle.processTurn(
      { type: 'move', playerId: 'p1', moveIndex: 0 }, // Spectral Thief
      { type: 'move', playerId: 'p2', moveIndex: 0 },
    );

    // Should deal damage
    expect(battle.state.players[1].team[0].currentHp).toBeLessThan(initialHp);
  });
});
