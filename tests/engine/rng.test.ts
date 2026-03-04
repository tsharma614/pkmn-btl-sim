import { describe, it, expect } from 'vitest';
import { SeededRNG } from '../../src/utils/rng';

describe('SeededRNG', () => {
  it('produces deterministic results with same seed', () => {
    const rng1 = new SeededRNG(42);
    const rng2 = new SeededRNG(42);

    for (let i = 0; i < 100; i++) {
      expect(rng1.next()).toBe(rng2.next());
    }
  });

  it('produces different results with different seeds', () => {
    const rng1 = new SeededRNG(42);
    const rng2 = new SeededRNG(99);

    let allSame = true;
    for (let i = 0; i < 10; i++) {
      if (rng1.next() !== rng2.next()) {
        allSame = false;
        break;
      }
    }
    expect(allSame).toBe(false);
  });

  it('next() returns values in [0, 1)', () => {
    const rng = new SeededRNG(42);
    for (let i = 0; i < 1000; i++) {
      const val = rng.next();
      expect(val).toBeGreaterThanOrEqual(0);
      expect(val).toBeLessThan(1);
    }
  });

  it('int() returns values in [min, max]', () => {
    const rng = new SeededRNG(42);
    for (let i = 0; i < 1000; i++) {
      const val = rng.int(1, 6);
      expect(val).toBeGreaterThanOrEqual(1);
      expect(val).toBeLessThanOrEqual(6);
    }
  });

  it('damageRoll() returns values in [0.85, 1.0]', () => {
    const rng = new SeededRNG(42);
    for (let i = 0; i < 1000; i++) {
      const val = rng.damageRoll();
      expect(val).toBeGreaterThanOrEqual(0.85);
      expect(val).toBeLessThanOrEqual(1.0);
    }
  });

  it('chance(100) always returns true', () => {
    const rng = new SeededRNG(42);
    for (let i = 0; i < 100; i++) {
      expect(rng.chance(100)).toBe(true);
    }
  });

  it('chance(0) always returns false', () => {
    const rng = new SeededRNG(42);
    for (let i = 0; i < 100; i++) {
      // next() * 100 >= 0 so it's always false (rng.next() >= 0, never < 0)
      expect(rng.chance(0)).toBe(false);
    }
  });

  it('shuffle produces all elements', () => {
    const rng = new SeededRNG(42);
    const arr = [1, 2, 3, 4, 5];
    const shuffled = rng.shuffle([...arr]);

    expect(shuffled).toHaveLength(5);
    expect(shuffled.sort()).toEqual([1, 2, 3, 4, 5]);
  });

  it('pick returns an element from the array', () => {
    const rng = new SeededRNG(42);
    const arr = ['a', 'b', 'c'];
    for (let i = 0; i < 100; i++) {
      const picked = rng.pick(arr);
      expect(arr).toContain(picked);
    }
  });

  it('stores the seed', () => {
    const rng = new SeededRNG(12345);
    expect(rng.seed).toBe(12345);
  });

  it('generates a random seed when none provided', () => {
    const rng1 = new SeededRNG();
    const rng2 = new SeededRNG();
    // Very unlikely to be the same
    expect(rng1.seed).not.toBe(rng2.seed);
  });
});
