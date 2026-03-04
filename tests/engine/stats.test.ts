import { describe, it, expect } from 'vitest';
import { calculateStat, calculateAllStats, getStatStageMultiplier, getAccuracyStageMultiplier, clampHp } from '../../src/utils/stats';

describe('Stat Calculation', () => {
  describe('calculateStat', () => {
    it('calculates HP correctly at level 100', () => {
      // Garchomp: base HP 108, 252 EVs, 31 IVs
      const hp = calculateStat(108, 252, 31, 100, 'Adamant', 'hp');
      expect(hp).toBe(420);
    });

    it('calculates Attack with Adamant nature (+10%)', () => {
      // Garchomp: base Atk 130, 252 EVs, 31 IVs, Adamant (+Atk)
      const atk = calculateStat(130, 252, 31, 100, 'Adamant', 'atk');
      expect(atk).toBe(394);
    });

    it('calculates SpA with Adamant nature (-10%)', () => {
      // Garchomp: base SpA 80, 0 EVs, 31 IVs, Adamant (-SpA)
      const spa = calculateStat(80, 0, 31, 100, 'Adamant', 'spa');
      expect(spa).toBe(176);
    });

    it('calculates stat with neutral nature', () => {
      // Garchomp: base Def 95, 0 EVs, 31 IVs, Adamant (neutral for Def)
      const def = calculateStat(95, 0, 31, 100, 'Adamant', 'def');
      expect(def).toBe(226);
    });

    it('handles Shedinja (1 HP always)', () => {
      const hp = calculateStat(1, 252, 31, 100, 'Adamant', 'hp');
      expect(hp).toBe(1);
    });

    it('handles 0 EVs correctly', () => {
      const atk = calculateStat(100, 0, 31, 100, 'Hardy', 'atk');
      expect(atk).toBe(236);
    });
  });

  describe('calculateAllStats', () => {
    it('calculates all 6 stats', () => {
      const stats = calculateAllStats(
        { hp: 108, atk: 130, def: 95, spa: 80, spd: 85, spe: 102 },
        { atk: 252, spe: 252, hp: 4 },
        'Adamant',
        100
      );
      expect(stats.hp).toBe(358);
      expect(stats.atk).toBe(394);
      expect(stats.spe).toBe(303);
    });
  });

  describe('getStatStageMultiplier', () => {
    it('returns 1 at stage 0', () => {
      expect(getStatStageMultiplier(0)).toBe(1);
    });

    it('returns 1.5 at +1', () => {
      expect(getStatStageMultiplier(1)).toBe(1.5);
    });

    it('returns 2 at +2', () => {
      expect(getStatStageMultiplier(2)).toBe(2);
    });

    it('returns 4 at +6', () => {
      expect(getStatStageMultiplier(6)).toBe(4);
    });

    it('returns 0.5 at -2', () => {
      expect(getStatStageMultiplier(-2)).toBe(0.5);
    });

    it('returns 0.25 at -6', () => {
      expect(getStatStageMultiplier(-6)).toBe(0.25);
    });

    it('clamps to +6', () => {
      expect(getStatStageMultiplier(10)).toBe(4);
    });

    it('clamps to -6', () => {
      expect(getStatStageMultiplier(-10)).toBe(0.25);
    });
  });

  describe('getAccuracyStageMultiplier', () => {
    it('returns 1 at stage 0', () => {
      expect(getAccuracyStageMultiplier(0)).toBe(1);
    });

    it('returns 4/3 at +1', () => {
      expect(getAccuracyStageMultiplier(1)).toBeCloseTo(4/3);
    });

    it('returns 3/4 at -1', () => {
      expect(getAccuracyStageMultiplier(-1)).toBeCloseTo(3/4);
    });
  });

  describe('clampHp', () => {
    it('clamps to 0 minimum', () => {
      expect(clampHp(-10, 100)).toBe(0);
    });

    it('clamps to maxHp', () => {
      expect(clampHp(150, 100)).toBe(100);
    });

    it('passes through valid values', () => {
      expect(clampHp(50, 100)).toBe(50);
    });
  });
});
