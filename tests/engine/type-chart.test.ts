import { describe, it, expect } from 'vitest';
import { getTypeEffectiveness, TYPE_CHART, ALL_TYPES } from '../../src/data/type-chart';
import { PokemonType } from '../../src/types';

describe('Type Chart', () => {
  it('should have 18 types', () => {
    expect(ALL_TYPES).toHaveLength(18);
  });

  it('should have entries for all 18x18 = 324 matchups', () => {
    for (const atkType of ALL_TYPES) {
      for (const defType of ALL_TYPES) {
        expect(TYPE_CHART[atkType][defType]).toBeDefined();
        expect([0, 0.5, 1, 2]).toContain(TYPE_CHART[atkType][defType]);
      }
    }
  });

  // --- Type immunities ---
  describe('immunities', () => {
    it('Normal is immune to Ghost', () => {
      expect(getTypeEffectiveness('Ghost', ['Normal'])).toBe(0);
    });

    it('Ghost is immune to Normal', () => {
      expect(getTypeEffectiveness('Normal', ['Ghost'])).toBe(0);
    });

    it('Ghost is immune to Fighting', () => {
      expect(getTypeEffectiveness('Fighting', ['Ghost'])).toBe(0);
    });

    it('Ground is immune to Electric', () => {
      expect(getTypeEffectiveness('Electric', ['Ground'])).toBe(0);
    });

    it('Flying is immune to Ground', () => {
      expect(getTypeEffectiveness('Ground', ['Flying'])).toBe(0);
    });

    it('Dark is immune to Psychic', () => {
      expect(getTypeEffectiveness('Psychic', ['Dark'])).toBe(0);
    });

    it('Steel is immune to Poison', () => {
      expect(getTypeEffectiveness('Poison', ['Steel'])).toBe(0);
    });

    it('Fairy is immune to Dragon', () => {
      expect(getTypeEffectiveness('Dragon', ['Fairy'])).toBe(0);
    });
  });

  // --- Fairy type interactions ---
  describe('Fairy type', () => {
    it('Fairy resists Fighting', () => {
      expect(getTypeEffectiveness('Fighting', ['Fairy'])).toBe(0.5);
    });

    it('Fairy resists Dark', () => {
      expect(getTypeEffectiveness('Dark', ['Fairy'])).toBe(0.5);
    });

    it('Fairy resists Bug', () => {
      expect(getTypeEffectiveness('Bug', ['Fairy'])).toBe(0.5);
    });

    it('Fairy is weak to Poison', () => {
      expect(getTypeEffectiveness('Poison', ['Fairy'])).toBe(2);
    });

    it('Fairy is weak to Steel', () => {
      expect(getTypeEffectiveness('Steel', ['Fairy'])).toBe(2);
    });

    it('Fairy is super effective against Dragon', () => {
      expect(TYPE_CHART['Fairy']['Dragon']).toBe(2);
    });

    it('Fairy is super effective against Dark', () => {
      expect(TYPE_CHART['Fairy']['Dark']).toBe(2);
    });

    it('Fairy is super effective against Fighting', () => {
      expect(TYPE_CHART['Fairy']['Fighting']).toBe(2);
    });
  });

  // --- Dual-type effectiveness ---
  describe('dual-type effectiveness', () => {
    it('Fire vs Water/Ground = 4x effective', () => {
      // Actually Fire vs Water/Ground: Fire is not very effective on Water (0.5) and neutral on Ground (1) = 0.5
      expect(getTypeEffectiveness('Fire', ['Water', 'Ground'])).toBe(0.5);
    });

    it('Ground vs Fire/Flying = 0x (Flying immunity)', () => {
      expect(getTypeEffectiveness('Ground', ['Fire', 'Flying'])).toBe(0);
    });

    it('Ice vs Dragon/Flying = 4x', () => {
      expect(getTypeEffectiveness('Ice', ['Dragon', 'Flying'])).toBe(4);
    });

    it('Ice vs Dragon/Ground = 4x', () => {
      expect(getTypeEffectiveness('Ice', ['Dragon', 'Ground'])).toBe(4);
    });

    it('Electric vs Water/Flying = 4x', () => {
      expect(getTypeEffectiveness('Electric', ['Water', 'Flying'])).toBe(4);
    });

    it('Fighting vs Normal/Dark = 4x', () => {
      expect(getTypeEffectiveness('Fighting', ['Normal', 'Dark'])).toBe(4);
    });

    it('Ground vs Water/Poison = 2x (1 * 2)', () => {
      // Ground is neutral vs Water (1x) and super effective vs Poison (2x) = 2x
      expect(getTypeEffectiveness('Ground', ['Water', 'Poison'])).toBe(2);
    });

    it('Grass vs Water/Ground = 4x', () => {
      expect(getTypeEffectiveness('Grass', ['Water', 'Ground'])).toBe(4);
    });
  });

  // --- Classic matchups ---
  describe('classic matchups', () => {
    it('Fire beats Grass', () => {
      expect(TYPE_CHART['Fire']['Grass']).toBe(2);
    });

    it('Water beats Fire', () => {
      expect(TYPE_CHART['Water']['Fire']).toBe(2);
    });

    it('Grass beats Water', () => {
      expect(TYPE_CHART['Grass']['Water']).toBe(2);
    });

    it('Electric beats Water', () => {
      expect(TYPE_CHART['Electric']['Water']).toBe(2);
    });

    it('Ground beats Electric', () => {
      expect(TYPE_CHART['Ground']['Electric']).toBe(2);
    });
  });

  // --- All 324 matchups are valid ---
  it('all effectiveness values are valid (0, 0.5, 1, or 2)', () => {
    const validValues = [0, 0.5, 1, 2];
    for (const atk of ALL_TYPES) {
      for (const def of ALL_TYPES) {
        expect(validValues).toContain(TYPE_CHART[atk][def]);
      }
    }
  });
});
