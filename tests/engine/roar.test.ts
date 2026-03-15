import { describe, it, expect } from 'vitest';
import { Battle } from '../../src/engine/battle';
import { createBattlePokemon } from '../../src/engine/pokemon-factory';
import { Player, PokemonSpecies, PokemonSet, BattlePokemon, PokemonType, Nature } from '../../src/types';

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

function createTestPlayer(id: string, name: string, teamOverrides: Array<{ species?: Partial<PokemonSpecies>; set?: Partial<PokemonSet> }> = []): Player {
  const team: BattlePokemon[] = [];
  for (let i = 0; i < 6; i++) {
    const overrides = teamOverrides[i] || {};
    const species = createTestSpecies({
      id: 'mon' + i, name: 'Mon' + i,
      ...overrides.species,
    });
    const set = createTestSet(overrides.set);
    team.push(createBattlePokemon(species, set));
  }
  return { id, name, team, activePokemonIndex: 0, itemMode: 'competitive', hasMegaEvolved: false };
}

describe('Roar / ForceSwitch', () => {
  it('forces the opponent to switch when they have other Pokemon', () => {
    const p1 = createTestPlayer('p1', 'Alice', [
      { set: { moves: ['Roar', 'Tackle', 'Thunderbolt', 'Ice Beam'] } },
    ]);
    const p2 = createTestPlayer('p2', 'Bob');

    const battle = new Battle(p1, p2, 42);
    const events = battle.processTurn(
      { type: 'move', playerId: 'p1', moveIndex: 0 },
      { type: 'move', playerId: 'p2', moveIndex: 0 },
    );

    // Check for a switch event caused by Roar
    const switchEvents = events.filter(e => e.type === 'switch');
    expect(switchEvents.length).toBeGreaterThan(0);
    // P2 should have been forced to switch
    expect(battle.state.players[1].activePokemonIndex).not.toBe(0);
  });

  it('fails when opponent has no other Pokemon', () => {
    // Only give P2 one Pokemon
    const p1 = createTestPlayer('p1', 'Alice', [
      { set: { moves: ['Roar', 'Tackle', 'Thunderbolt', 'Ice Beam'] } },
    ]);
    const p2 = createTestPlayer('p2', 'Bob');
    // KO all but the active Pokemon
    for (let i = 1; i < 6; i++) {
      p2.team[i].currentHp = 0;
      p2.team[i].isAlive = false;
    }

    const battle = new Battle(p1, p2, 42);
    const events = battle.processTurn(
      { type: 'move', playerId: 'p1', moveIndex: 0 },
      { type: 'move', playerId: 'p2', moveIndex: 0 },
    );

    // Should have a move_fail event
    const failEvents = events.filter(e => e.type === 'move_fail');
    expect(failEvents.length).toBeGreaterThan(0);
    // P2 should still be at index 0
    expect(battle.state.players[1].activePokemonIndex).toBe(0);
  });

  it('Whirlwind also forces switch', () => {
    const p1 = createTestPlayer('p1', 'Alice', [
      { set: { moves: ['Whirlwind', 'Tackle', 'Thunderbolt', 'Ice Beam'] } },
    ]);
    const p2 = createTestPlayer('p2', 'Bob');

    const battle = new Battle(p1, p2, 42);
    const events = battle.processTurn(
      { type: 'move', playerId: 'p1', moveIndex: 0 },
      { type: 'move', playerId: 'p2', moveIndex: 0 },
    );

    const switchEvents = events.filter(e => e.type === 'switch');
    expect(switchEvents.length).toBeGreaterThan(0);
  });
});
