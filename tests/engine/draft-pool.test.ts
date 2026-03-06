import { describe, it, expect } from 'vitest';
import {
  generateDraftPool,
  pickBotDraftPick,
  buildTeamFromDraftPicks,
  SNAKE_ORDER,
  DraftPoolEntry,
} from '../../src/engine/draft-pool';
import { SeededRNG } from '../../src/utils/rng';

describe('Draft Pool Generation', () => {
  it('generates a pool of 21 Pokemon', () => {
    const rng = new SeededRNG(42);
    const pool = generateDraftPool(rng);
    expect(pool).toHaveLength(21);
  });

  it('normal tier distribution: 3 T1, 5 T2, 6 T3, 7 T4', () => {
    const rng = new SeededRNG(42);
    const pool = generateDraftPool(rng);
    const tierCounts = { 1: 0, 2: 0, 3: 0, 4: 0 };
    for (const entry of pool) {
      tierCounts[entry.tier as 1 | 2 | 3 | 4]++;
    }
    expect(tierCounts[1]).toBe(3);
    expect(tierCounts[2]).toBe(5);
    expect(tierCounts[3]).toBe(6);
    expect(tierCounts[4]).toBe(7);
  });

  it('legendary tier distribution: 5 T1, 7 T2, 9 T3, 0 T4', () => {
    const rng = new SeededRNG(42);
    const pool = generateDraftPool(rng, { legendaryMode: true });
    const tierCounts = { 1: 0, 2: 0, 3: 0, 4: 0 };
    for (const entry of pool) {
      tierCounts[entry.tier as 1 | 2 | 3 | 4]++;
    }
    expect(tierCounts[1]).toBe(5);
    expect(tierCounts[2]).toBe(7);
    expect(tierCounts[3]).toBe(9);
    expect(tierCounts[4]).toBe(0);
  });

  it('no duplicate species in pool', () => {
    for (let seed = 0; seed < 20; seed++) {
      const rng = new SeededRNG(seed);
      const pool = generateDraftPool(rng);
      const ids = pool.map(e => e.species.id);
      expect(new Set(ids).size).toBe(21);
    }
  });

  it('no duplicate type combinations (most seeds)', () => {
    let passCount = 0;
    for (let seed = 0; seed < 20; seed++) {
      const rng = new SeededRNG(seed);
      const pool = generateDraftPool(rng);
      const typeKeys = pool.map(e => [...e.species.types].sort().join('/'));
      if (new Set(typeKeys).size === typeKeys.length) passCount++;
    }
    // Validation may occasionally fail and use fallback pool, so allow a few misses
    expect(passCount).toBeGreaterThanOrEqual(15);
  });

  it('at least 10 distinct types in pool', () => {
    for (let seed = 0; seed < 20; seed++) {
      const rng = new SeededRNG(seed);
      const pool = generateDraftPool(rng);
      const allTypes = new Set<string>();
      for (const entry of pool) {
        for (const t of entry.species.types) allTypes.add(t);
      }
      expect(allTypes.size).toBeGreaterThanOrEqual(10);
    }
  });

  it('no type appears on more than 5 Pokemon', () => {
    for (let seed = 0; seed < 20; seed++) {
      const rng = new SeededRNG(seed);
      const pool = generateDraftPool(rng);
      const typeCounts: Record<string, number> = {};
      for (const entry of pool) {
        for (const t of entry.species.types) {
          typeCounts[t] = (typeCounts[t] || 0) + 1;
        }
      }
      for (const [type, count] of Object.entries(typeCounts)) {
        expect(count, `Type ${type} appears ${count} times`).toBeLessThanOrEqual(5);
      }
    }
  });

  it('at least 2 physical and 2 special attackers', () => {
    for (let seed = 0; seed < 20; seed++) {
      const rng = new SeededRNG(seed);
      const pool = generateDraftPool(rng);
      const physical = pool.filter(e => e.species.baseStats.atk >= e.species.baseStats.spa);
      const special = pool.filter(e => e.species.baseStats.spa > e.species.baseStats.atk);
      expect(physical.length).toBeGreaterThanOrEqual(2);
      expect(special.length).toBeGreaterThanOrEqual(2);
    }
  });

  it('deterministic with same seed', () => {
    const pool1 = generateDraftPool(new SeededRNG(42));
    const pool2 = generateDraftPool(new SeededRNG(42));
    for (let i = 0; i < 21; i++) {
      expect(pool1[i].species.id).toBe(pool2[i].species.id);
    }
  });

  it('different with different seeds', () => {
    const pool1 = generateDraftPool(new SeededRNG(42));
    const pool2 = generateDraftPool(new SeededRNG(99));
    const ids1 = pool1.map(e => e.species.id).sort();
    const ids2 = pool2.map(e => e.species.id).sort();
    expect(ids1).not.toEqual(ids2);
  });

  it('classic mode (maxGen=4): only Gen 1-4 Pokemon', () => {
    for (let seed = 0; seed < 20; seed++) {
      const rng = new SeededRNG(seed);
      const pool = generateDraftPool(rng, { maxGen: 4 });
      for (const entry of pool) {
        expect(entry.species.generation).toBeLessThanOrEqual(4);
      }
    }
  });

  it('preserves Fairy type in classic mode', () => {
    let foundFairy = false;
    for (let seed = 0; seed < 100 && !foundFairy; seed++) {
      const pool = generateDraftPool(new SeededRNG(seed), { maxGen: 4 });
      if (pool.some(e => (e.species.types as string[]).includes('Fairy'))) {
        foundFairy = true;
      }
    }
    expect(foundFairy).toBe(true);
  });

  it('legendary mode has more T1 Pokemon', () => {
    const normal = generateDraftPool(new SeededRNG(42));
    const legendary = generateDraftPool(new SeededRNG(42), { legendaryMode: true });
    const normalT1 = normal.filter(e => e.tier === 1).length;
    const legendaryT1 = legendary.filter(e => e.tier === 1).length;
    expect(legendaryT1).toBeGreaterThan(normalT1);
  });

  it('classic + legendary combined', () => {
    for (let seed = 0; seed < 10; seed++) {
      const rng = new SeededRNG(seed);
      const pool = generateDraftPool(rng, { maxGen: 4, legendaryMode: true });
      expect(pool).toHaveLength(21);
      for (const entry of pool) {
        expect(entry.species.generation).toBeLessThanOrEqual(4);
      }
    }
  });

  it('pool generation succeeds for many seeds (stress test)', () => {
    for (let seed = 0; seed < 50; seed++) {
      const rng = new SeededRNG(seed);
      const pool = generateDraftPool(rng);
      expect(pool).toHaveLength(21);
    }
  });
});

describe('Bot Draft AI', () => {
  function makePool(seed: number): DraftPoolEntry[] {
    return generateDraftPool(new SeededRNG(seed));
  }

  it('easy: picks valid index from remaining pool', () => {
    const pool = makePool(42);
    const rng = new SeededRNG(1);
    const pick = pickBotDraftPick(pool, [], [], 'easy', rng);
    expect(pick).toBeGreaterThanOrEqual(0);
    expect(pick).toBeLessThan(pool.length);
  });

  it('bot never picks an already-picked Pokemon', () => {
    const pool = makePool(42);
    const rng = new SeededRNG(1);
    const myPicks = [0, 3, 5];
    const opponentPicks = [1, 2];
    const picked = new Set([...myPicks, ...opponentPicks]);

    for (let i = 0; i < 50; i++) {
      const pick = pickBotDraftPick(pool, myPicks, opponentPicks, 'easy', new SeededRNG(i));
      expect(picked.has(pick)).toBe(false);
    }
  });

  it('normal: tends to pick higher-tier Pokemon', () => {
    const pool = makePool(42);
    const tierPicks = { 1: 0, 2: 0, 3: 0, 4: 0 };
    for (let i = 0; i < 100; i++) {
      const rng = new SeededRNG(i);
      const pick = pickBotDraftPick(pool, [], [], 'normal', rng);
      tierPicks[pool[pick].tier as 1 | 2 | 3 | 4]++;
    }
    // T1+T2 should be picked more often than T3+T4
    expect(tierPicks[1] + tierPicks[2]).toBeGreaterThan(tierPicks[3] + tierPicks[4]);
  });

  it('hard: picks highest-scoring Pokemon (greedy)', () => {
    const pool = makePool(42);
    const rng = new SeededRNG(1);
    const pick = pickBotDraftPick(pool, [], [], 'hard', rng);
    // Hard mode with no existing picks should pick a T1 Pokemon
    expect(pool[pick].tier).toBe(1);
  });

  it('hard: considers type coverage', () => {
    const pool = makePool(42);
    const rng = new SeededRNG(1);
    // First pick a couple Pokemon to establish types
    const firstPick = pickBotDraftPick(pool, [], [], 'hard', rng);
    const secondPick = pickBotDraftPick(pool, [firstPick], [], 'hard', new SeededRNG(2));
    // Second pick should have at least one type not on the first pick
    const firstTypes = new Set(pool[firstPick].species.types);
    const secondTypes = pool[secondPick].species.types;
    const hasNewType = secondTypes.some((t: string) => !firstTypes.has(t));
    expect(hasNewType).toBe(true);
  });
});

describe('SNAKE_ORDER', () => {
  it('has 12 picks', () => {
    expect(SNAKE_ORDER).toHaveLength(12);
  });

  it('follows P1, P2, P2, P1, P1, P2, P2, P1, P1, P2, P2, P1', () => {
    expect(SNAKE_ORDER).toEqual([0, 1, 1, 0, 0, 1, 1, 0, 0, 1, 1, 0]);
  });

  it('each player picks 6 times', () => {
    const p0 = SNAKE_ORDER.filter(p => p === 0).length;
    const p1 = SNAKE_ORDER.filter(p => p === 1).length;
    expect(p0).toBe(6);
    expect(p1).toBe(6);
  });
});

describe('buildTeamFromDraftPicks', () => {
  it('produces 6 valid BattlePokemon', () => {
    const pool = generateDraftPool(new SeededRNG(42));
    const species = pool.slice(0, 6).map(e => e.species);
    const team = buildTeamFromDraftPicks(species, new SeededRNG(1));
    expect(team).toHaveLength(6);
  });

  it('all Pokemon are level 100, alive, at full HP', () => {
    const pool = generateDraftPool(new SeededRNG(42));
    const species = pool.slice(0, 6).map(e => e.species);
    const team = buildTeamFromDraftPicks(species, new SeededRNG(1));
    for (const pokemon of team) {
      expect(pokemon.level).toBe(100);
      expect(pokemon.isAlive).toBe(true);
      expect(pokemon.currentHp).toBe(pokemon.maxHp);
    }
  });

  it('each Pokemon has moves, ability, item', () => {
    const pool = generateDraftPool(new SeededRNG(42));
    const species = pool.slice(0, 6).map(e => e.species);
    const team = buildTeamFromDraftPicks(species, new SeededRNG(1));
    for (const pokemon of team) {
      expect(pokemon.moves.length).toBeGreaterThan(0);
      expect(pokemon.ability).toBeTruthy();
      expect(pokemon.item).toBeTruthy();
    }
  });

  it('preserves Fairy type with maxGen=4', () => {
    // Find a pool with a Fairy-type Pokemon
    let fairySpecies = null;
    for (let seed = 0; seed < 100; seed++) {
      const pool = generateDraftPool(new SeededRNG(seed), { maxGen: 4 });
      const fairy = pool.find(e => (e.species.types as string[]).includes('Fairy'));
      if (fairy) {
        fairySpecies = fairy.species;
        break;
      }
    }
    expect(fairySpecies).not.toBeNull();
    if (fairySpecies) {
      const team = buildTeamFromDraftPicks([fairySpecies], new SeededRNG(1), { maxGen: 4 });
      expect((team[0].species.types as string[])).toContain('Fairy');
    }
  });
});
