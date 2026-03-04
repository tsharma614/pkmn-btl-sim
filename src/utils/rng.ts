/**
 * Seeded pseudo-random number generator (Mulberry32).
 * Deterministic: same seed + same sequence of calls = same results.
 * Every battle logs its seed for replay/debugging.
 */
export class SeededRNG {
  private state: number;
  readonly seed: number;

  constructor(seed?: number) {
    this.seed = seed ?? Math.floor(Math.random() * 2147483647);
    this.state = this.seed;
  }

  /** Returns a float in [0, 1) */
  next(): number {
    this.state |= 0;
    this.state = (this.state + 0x6D2B79F5) | 0;
    let t = Math.imul(this.state ^ (this.state >>> 15), 1 | this.state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Returns an integer in [min, max] (inclusive) */
  int(min: number, max: number): number {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }

  /** Returns true with the given probability (0-100) */
  chance(percent: number): boolean {
    return this.next() * 100 < percent;
  }

  /** Returns a random damage roll (85-100) / 100 */
  damageRoll(): number {
    return this.int(85, 100) / 100;
  }

  /** Shuffle an array in place (Fisher-Yates) */
  shuffle<T>(arr: T[]): T[] {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = this.int(0, i);
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  /** Pick a random element from array */
  pick<T>(arr: T[]): T {
    return arr[this.int(0, arr.length - 1)];
  }
}
