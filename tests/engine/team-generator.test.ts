import { describe, it, expect } from 'vitest';
import { generateTeam } from '../../src/engine/team-generator';
import { SeededRNG } from '../../src/utils/rng';
import { PokemonType } from '../../src/types';

describe('Team Generator', () => {
  it('generates a team of 6 Pokemon', () => {
    const rng = new SeededRNG(42);
    const team = generateTeam(rng);
    expect(team).toHaveLength(6);
  });

  it('all Pokemon are alive and at full HP', () => {
    const rng = new SeededRNG(42);
    const team = generateTeam(rng);
    for (const pokemon of team) {
      expect(pokemon.isAlive).toBe(true);
      expect(pokemon.currentHp).toBe(pokemon.maxHp);
      expect(pokemon.currentHp).toBeGreaterThan(0);
    }
  });

  it('all Pokemon are level 100', () => {
    const rng = new SeededRNG(42);
    const team = generateTeam(rng);
    for (const pokemon of team) {
      expect(pokemon.level).toBe(100);
    }
  });

  it('all Pokemon have an ability', () => {
    const rng = new SeededRNG(42);
    const team = generateTeam(rng);
    for (const pokemon of team) {
      expect(pokemon.ability).toBeTruthy();
    }
  });

  it('all Pokemon have moves', () => {
    const rng = new SeededRNG(42);
    const team = generateTeam(rng);
    for (const pokemon of team) {
      expect(pokemon.moves.length).toBeGreaterThan(0);
      expect(pokemon.moves.length).toBeLessThanOrEqual(4);
    }
  });

  it('produces deterministic teams with same seed', () => {
    const team1 = generateTeam(new SeededRNG(42));
    const team2 = generateTeam(new SeededRNG(42));

    for (let i = 0; i < 6; i++) {
      expect(team1[i].species.name).toBe(team2[i].species.name);
    }
  });

  it('produces different teams with different seeds', () => {
    const team1 = generateTeam(new SeededRNG(42));
    const team2 = generateTeam(new SeededRNG(99));

    const names1 = team1.map(p => p.species.name).sort();
    const names2 = team2.map(p => p.species.name).sort();
    expect(names1).not.toEqual(names2);
  });

  it('no duplicate Pokemon on a team', () => {
    for (let seed = 0; seed < 20; seed++) {
      const rng = new SeededRNG(seed);
      const team = generateTeam(rng);
      const names = team.map(p => p.species.id);
      const uniqueNames = new Set(names);
      expect(uniqueNames.size).toBe(6);
    }
  });

  it('no more than 2 Pokemon share a type', () => {
    for (let seed = 0; seed < 20; seed++) {
      const rng = new SeededRNG(seed);
      const team = generateTeam(rng);
      const typeCounts: Record<string, number> = {};
      for (const pokemon of team) {
        for (const type of pokemon.species.types) {
          typeCounts[type] = (typeCounts[type] || 0) + 1;
        }
      }
      for (const [type, count] of Object.entries(typeCounts)) {
        expect(count, `Type ${type} appears ${count} times`).toBeLessThanOrEqual(2);
      }
    }
  });

  it('has tier distribution 1-2-2-1', () => {
    const rng = new SeededRNG(42);
    const team = generateTeam(rng);
    const tierCounts = { 1: 0, 2: 0, 3: 0, 4: 0 };
    for (const pokemon of team) {
      tierCounts[pokemon.species.tier as 1 | 2 | 3 | 4]++;
    }
    expect(tierCounts[1]).toBe(1);
    expect(tierCounts[2]).toBe(2);
    expect(tierCounts[3]).toBe(2);
    expect(tierCounts[4]).toBe(1);
  });

  it('casual mode swaps Choice items', () => {
    const rng = new SeededRNG(42);
    const team = generateTeam(rng, { itemMode: 'casual' });
    for (const pokemon of team) {
      expect(pokemon.item).not.toBe('Choice Band');
      expect(pokemon.item).not.toBe('Choice Specs');
      expect(pokemon.item).not.toBe('Choice Scarf');
    }
  });

  it('has at least 1 physical and 1 special attacker', () => {
    for (let seed = 0; seed < 20; seed++) {
      const rng = new SeededRNG(seed);
      const team = generateTeam(rng);
      const hasPhysical = team.some(p => p.species.baseStats.atk >= p.species.baseStats.spa);
      const hasSpecial = team.some(p => p.species.baseStats.spa > p.species.baseStats.atk);
      expect(hasPhysical).toBe(true);
      expect(hasSpecial).toBe(true);
    }
  });
});
