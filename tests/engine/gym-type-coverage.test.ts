import { describe, it, expect } from 'vitest';
import { SeededRNG } from '../../src/utils/rng';
import { generateGymTeam } from '../../src/engine/team-generator';

const ALL_TYPES = [
  'Normal', 'Fire', 'Water', 'Electric', 'Grass', 'Ice',
  'Fighting', 'Poison', 'Ground', 'Flying', 'Psychic',
  'Bug', 'Rock', 'Ghost', 'Dragon', 'Dark', 'Steel', 'Fairy',
];

describe('Gym team — all 18 types', () => {
  for (const type of ALL_TYPES) {
    it(`${type} gym has exactly 6 Pokemon`, () => {
      const team = generateGymTeam(new SeededRNG(42), type);
      expect(team.length).toBe(6);
    });

    it(`${type} gym has at least 4/6 matching type`, () => {
      const team = generateGymTeam(new SeededRNG(42), type);
      const matching = team.filter(p => p.species.types.includes(type));
      expect(matching.length, `${type}: only ${matching.length}/6 match`).toBeGreaterThanOrEqual(4);
    });
  }

  it('no crashes across multiple seeds', () => {
    for (const type of ALL_TYPES) {
      for (let seed = 0; seed < 5; seed++) {
        const team = generateGymTeam(new SeededRNG(seed), type);
        expect(team.length).toBe(6);
      }
    }
  });

  it('no duplicate Pokemon on any gym team', () => {
    for (const type of ALL_TYPES) {
      const team = generateGymTeam(new SeededRNG(42), type);
      const ids = team.map(p => p.species.id);
      expect(new Set(ids).size, `${type} gym has duplicates`).toBe(ids.length);
    }
  });
});
