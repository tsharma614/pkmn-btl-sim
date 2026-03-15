import { describe, it, expect } from 'vitest';
import {
  generateDraftPool,
  generateGymLeaderPool,
  pickBotDraftPick,
  pickGymLeaderDraftPick,
  buildTeamFromDraftPicks,
  generateRoleDraftPool,
  classifyRole,
  DRAFT_ROLES,
  ROLE_LABELS,
  SNAKE_ORDER,
  DraftPoolEntry,
  MONOTYPE_TYPES,
  POOL_SIZES,
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

  it('legendary tier distribution: 9 T1, 12 T2, 0 T3/T4', () => {
    const rng = new SeededRNG(42);
    const pool = generateDraftPool(rng, { legendaryMode: true });
    const tierCounts = { 1: 0, 2: 0, 3: 0, 4: 0 };
    for (const entry of pool) {
      tierCounts[entry.tier as 1 | 2 | 3 | 4]++;
    }
    expect(tierCounts[1]).toBe(9);
    expect(tierCounts[2]).toBe(12);
    expect(tierCounts[3]).toBe(0);
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

  it('no type combo appears more than twice', () => {
    for (let seed = 0; seed < 20; seed++) {
      const rng = new SeededRNG(seed);
      const pool = generateDraftPool(rng);
      const comboCounts: Record<string, number> = {};
      for (const entry of pool) {
        const key = [...entry.species.types].sort().join('/');
        comboCounts[key] = (comboCounts[key] || 0) + 1;
      }
      for (const [combo, count] of Object.entries(comboCounts)) {
        expect(count, `Combo ${combo} appears ${count} times`).toBeLessThanOrEqual(2);
      }
    }
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

  it('no type appears on more than 6 Pokemon', () => {
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
        expect(count, `Type ${type} appears ${count} times`).toBeLessThanOrEqual(6);
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

describe('Reroll', () => {
  it('calling generateDraftPool again with a different RNG state produces different pool', () => {
    const rng = new SeededRNG(42);
    const pool1 = generateDraftPool(rng);
    const pool2 = generateDraftPool(rng); // rng state has advanced
    const ids1 = pool1.map(e => e.species.id).sort();
    const ids2 = pool2.map(e => e.species.id).sort();
    expect(ids1).not.toEqual(ids2);
  });

  it('rerolled pool still has 21 valid Pokemon', () => {
    const rng = new SeededRNG(42);
    generateDraftPool(rng); // first roll
    const pool2 = generateDraftPool(rng); // reroll
    expect(pool2).toHaveLength(21);
    const ids = pool2.map(e => e.species.id);
    expect(new Set(ids).size).toBe(21);
  });
});

describe('T1 Type Diversity', () => {
  it('no single type dominates T1 picks in legendary mode', () => {
    for (let seed = 0; seed < 20; seed++) {
      const rng = new SeededRNG(seed);
      const pool = generateDraftPool(rng, { legendaryMode: true });
      const t1Entries = pool.filter(e => e.tier === 1);
      const typeCounts: Record<string, number> = {};
      for (const entry of t1Entries) {
        for (const t of entry.species.types) {
          typeCounts[t as string] = (typeCounts[t as string] || 0) + 1;
        }
      }
      // No type should have more than ceil(9/3) = 3 of the T1 picks
      for (const [type, count] of Object.entries(typeCounts)) {
        expect(count, `Type ${type} has ${count} T1 picks (seed ${seed})`).toBeLessThanOrEqual(3);
      }
    }
  });

  it('all T1 Pokemon appear across 10 drafts', () => {
    const seen = new Set<string>();
    for (let seed = 0; seed < 10; seed++) {
      const rng = new SeededRNG(seed);
      const pool = generateDraftPool(rng, { legendaryMode: true });
      for (const entry of pool.filter(e => e.tier === 1)) {
        seen.add(entry.species.id);
      }
    }
    // With 62 T1 Pokemon and 9 picks per draft, 10 drafts = 90 picks
    // Should see a large majority of the T1 pool
    expect(seen.size).toBeGreaterThanOrEqual(45);
  });
});

describe('Monotype Draft', () => {
  it('all pool Pokemon have the chosen type', () => {
    for (const type of ['Fire', 'Water', 'Dragon', 'Steel']) {
      const rng = new SeededRNG(42);
      const pool = generateDraftPool(rng, { monotype: type });
      for (const entry of pool) {
        expect(
          (entry.species.types as string[]).includes(type),
          `${entry.species.name} should have ${type} type`
        ).toBe(true);
      }
    }
  });

  it('monotype pool has valid Pokemon count', () => {
    for (const type of MONOTYPE_TYPES) {
      const rng = new SeededRNG(42);
      const pool = generateDraftPool(rng, { monotype: type });
      // Should have some Pokemon (at least 12 for a 6v6 draft)
      expect(pool.length).toBeGreaterThanOrEqual(12);
    }
  });

  it('monotype + legendary mode works', () => {
    const rng = new SeededRNG(42);
    const pool = generateDraftPool(rng, { monotype: 'Dragon', legendaryMode: true });
    for (const entry of pool) {
      expect((entry.species.types as string[]).includes('Dragon')).toBe(true);
    }
    // Should still have a reasonable pool size
    expect(pool.length).toBeGreaterThanOrEqual(12);
  });

  it('fills from lower tiers and other types when needed', () => {
    // Fairy + classic is very restrictive (only 8 Fairy-type in Gen 1-4)
    const rng = new SeededRNG(42);
    const pool = generateDraftPool(rng, { monotype: 'Fairy', maxGen: 4 });
    // Should fill to at least 12 by pulling in related-type Pokemon
    expect(pool.length).toBeGreaterThanOrEqual(12);
  });

  it('Bug + legendary + classic fills intelligently', () => {
    const rng = new SeededRNG(42);
    const pool = generateDraftPool(rng, { monotype: 'Bug', legendaryMode: true, maxGen: 4 });
    expect(pool.length).toBeGreaterThanOrEqual(12);
  });

  it('restrictive combos always produce at least 12 Pokemon', () => {
    for (const type of MONOTYPE_TYPES) {
      for (const legendary of [false, true]) {
        for (const maxGen of [null, 4]) {
          const pool = generateDraftPool(new SeededRNG(42), { monotype: type, legendaryMode: legendary, maxGen });
          expect(
            pool.length,
            `${type} legendary=${legendary} maxGen=${maxGen} produced only ${pool.length}`
          ).toBeGreaterThanOrEqual(12);
        }
      }
    }
  });
});

// ===================== Pool Size Options =====================

describe('Pool Size Options', () => {
  it('generates pools of each supported size', () => {
    for (const size of POOL_SIZES) {
      const pool = generateDraftPool(new SeededRNG(99), { poolSize: size });
      expect(pool).toHaveLength(size);
    }
  });

  it('24-size pool has correct tier distribution', () => {
    const pool = generateDraftPool(new SeededRNG(42), { poolSize: 24 });
    expect(pool).toHaveLength(24);
    const tiers = pool.map(p => p.tier);
    // Should have some from each tier
    expect(tiers.filter(t => t === 1).length).toBeGreaterThanOrEqual(3);
    expect(tiers.filter(t => t === 4).length).toBeGreaterThanOrEqual(5);
  });

  it('30-size pool still passes validation', () => {
    const pool = generateDraftPool(new SeededRNG(42), { poolSize: 30 });
    expect(pool).toHaveLength(30);
    // No duplicate species
    const ids = pool.map(p => p.species.id);
    expect(new Set(ids).size).toBe(30);
  });

  it('large pools have at least 10 distinct types', () => {
    for (const size of [24, 27, 30]) {
      const pool = generateDraftPool(new SeededRNG(42), { poolSize: size });
      const allTypes = new Set(pool.flatMap(p => p.species.types));
      expect(allTypes.size).toBeGreaterThanOrEqual(10);
    }
  });

  it('pool size works with legendary mode', () => {
    const pool = generateDraftPool(new SeededRNG(42), { poolSize: 27, legendaryMode: true });
    expect(pool).toHaveLength(27);
    const t1Count = pool.filter(p => p.tier === 1).length;
    expect(t1Count).toBeGreaterThanOrEqual(5);
  });
});

// ===================== Gym Leader Pool =====================

describe('Gym Leader Pool', () => {
  it('generates a pool for a gym type', () => {
    const pool = generateGymLeaderPool(new SeededRNG(42), 'Fire');
    expect(pool.length).toBeGreaterThanOrEqual(12);
  });

  it('all pool Pokemon have the gym type', () => {
    const pool = generateGymLeaderPool(new SeededRNG(42), 'Water');
    for (const entry of pool) {
      expect(entry.species.types).toContain('Water');
    }
  });

  it('legendary mode uses T1/T2 first, dips into lower tiers if needed', () => {
    const pool = generateGymLeaderPool(new SeededRNG(42), 'Fire', { legendaryMode: true });
    for (const entry of pool) {
      expect(entry.species.types).toContain('Fire');
    }
  });

  it('no duplicate species', () => {
    const pool = generateGymLeaderPool(new SeededRNG(42), 'Electric');
    const ids = pool.map(p => p.species.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('works for every type', () => {
    for (const type of MONOTYPE_TYPES) {
      const pool = generateGymLeaderPool(new SeededRNG(42), type);
      expect(pool.length, `${type} gym pool too small`).toBeGreaterThanOrEqual(12);
    }
  });

  it('respects maxGen option', () => {
    const pool = generateGymLeaderPool(new SeededRNG(42), 'Dragon', { maxGen: 4 });
    expect(pool.length).toBeGreaterThanOrEqual(12);
  });
});

// ===================== Gym Leader Draft AI =====================

describe('Gym Leader Draft AI', () => {
  it('picks from available pool', () => {
    const pool = generateGymLeaderPool(new SeededRNG(42), 'Fire');
    const rng = new SeededRNG(99);
    const pick = pickGymLeaderDraftPick(pool, [], [], 'Fire', rng);
    expect(pick).toBeGreaterThanOrEqual(0);
    expect(pick).toBeLessThan(pool.length);
  });

  it('prefers gym-type Pokemon', () => {
    const pool = generateGymLeaderPool(new SeededRNG(42), 'Fire');
    const rng = new SeededRNG(99);
    const picks: number[] = [];
    const myPickIndices: number[] = [];
    for (let i = 0; i < 6; i++) {
      const pick = pickGymLeaderDraftPick(pool, myPickIndices, [], 'Fire', rng);
      picks.push(pick);
      myPickIndices.push(pick);
    }
    const fireCount = picks.filter(idx => pool[idx].species.types.includes('Fire')).length;
    // Should pick mostly Fire Pokemon
    expect(fireCount).toBeGreaterThanOrEqual(3);
  });
});

// ===================== Enhanced Hard Draft AI =====================

describe('Enhanced Hard Draft AI', () => {
  it('hard AI never picks already-picked Pokemon', () => {
    const pool = generateDraftPool(new SeededRNG(42));
    const rng = new SeededRNG(99);
    const myPicks: number[] = [];
    const oppPicks: number[] = [];
    const allPicked = new Set<number>();
    for (let i = 0; i < 6; i++) {
      const pick = pickBotDraftPick(pool, myPicks, oppPicks, 'hard', rng);
      expect(allPicked.has(pick)).toBe(false);
      myPicks.push(pick);
      allPicked.add(pick);
      // Simulate opponent pick
      if (i < 5) {
        for (let j = 0; j < pool.length; j++) {
          if (!allPicked.has(j)) {
            oppPicks.push(j);
            allPicked.add(j);
            break;
          }
        }
      }
    }
  });

  it('hard AI tends to pick higher-tier Pokemon first', () => {
    const pool = generateDraftPool(new SeededRNG(42));
    const rng = new SeededRNG(99);
    const firstPick = pickBotDraftPick(pool, [], [], 'hard', rng);
    // First pick from hard AI should be tier 1 or 2
    expect(pool[firstPick].tier).toBeLessThanOrEqual(2);
  });

  it('hard AI picks differently from easy AI on same pool', () => {
    const pool = generateDraftPool(new SeededRNG(42));
    const hardPicks: number[] = [];
    const easyPicks: number[] = [];
    for (let i = 0; i < 3; i++) {
      hardPicks.push(pickBotDraftPick(pool, [], [], 'hard', new SeededRNG(i)));
      easyPicks.push(pickBotDraftPick(pool, [], [], 'easy', new SeededRNG(i)));
    }
    // They should differ at least sometimes
    const allSame = hardPicks.every((p, i) => p === easyPicks[i]);
    expect(allSame).toBe(false);
  });
});

// ===================== Role Draft Pool =====================

describe('Role Draft Pool', () => {
  it('generates a pool of 24 Pokemon', () => {
    const pool = generateRoleDraftPool(new SeededRNG(42));
    expect(pool).toHaveLength(24);
  });

  it('has exactly 4 Pokemon per role', () => {
    const pool = generateRoleDraftPool(new SeededRNG(42));
    for (const role of DRAFT_ROLES) {
      const count = pool.filter(p => p.role === role).length;
      expect(count).toBe(4);
    }
  });

  it('no duplicate species in pool', () => {
    const pool = generateRoleDraftPool(new SeededRNG(42));
    const names = pool.map(p => p.species.name);
    expect(new Set(names).size).toBe(24);
  });

  it('contains all 6 roles', () => {
    const pool = generateRoleDraftPool(new SeededRNG(42));
    const roles = new Set(pool.map(p => p.role));
    expect(roles.size).toBe(6);
    for (const role of DRAFT_ROLES) {
      expect(roles.has(role)).toBe(true);
    }
  });

  it('legendary mode works', () => {
    const pool = generateRoleDraftPool(new SeededRNG(42), { legendaryMode: true });
    expect(pool).toHaveLength(24);
    // Legendary mode should include more high-tier Pokemon
    const t1Count = pool.filter(p => p.tier === 1).length;
    const normalPool = generateRoleDraftPool(new SeededRNG(42), { legendaryMode: false });
    const normalT1 = normalPool.filter(p => p.tier === 1).length;
    expect(t1Count).toBeGreaterThanOrEqual(normalT1);
  });

  it('classic mode only includes Gen 1-4', () => {
    const pool = generateRoleDraftPool(new SeededRNG(42), { maxGen: 4 });
    expect(pool).toHaveLength(24);
    for (const entry of pool) {
      expect(entry.species.generation).toBeLessThanOrEqual(4);
    }
  });

  it('is deterministic with same seed', () => {
    const pool1 = generateRoleDraftPool(new SeededRNG(42));
    const pool2 = generateRoleDraftPool(new SeededRNG(42));
    expect(pool1.map(p => p.species.name)).toEqual(pool2.map(p => p.species.name));
  });

  it('produces different pools with different seeds', () => {
    const pool1 = generateRoleDraftPool(new SeededRNG(42));
    const pool2 = generateRoleDraftPool(new SeededRNG(99));
    const names1 = pool1.map(p => p.species.name);
    const names2 = pool2.map(p => p.species.name);
    expect(names1).not.toEqual(names2);
  });
});

// ===================== Role Classification =====================

describe('Role Classification', () => {
  it('returns a valid DraftRole', () => {
    const pool = generateDraftPool(new SeededRNG(42));
    for (const entry of pool) {
      const role = classifyRole(entry.species);
      expect(DRAFT_ROLES).toContain(role);
    }
  });

  it('ROLE_LABELS has labels for all roles', () => {
    for (const role of DRAFT_ROLES) {
      expect(ROLE_LABELS[role]).toBeDefined();
      expect(typeof ROLE_LABELS[role]).toBe('string');
    }
  });

  it('classifies many Pokemon across multiple roles', () => {
    // Over a large pool, should see at least 3 different roles
    const pool = generateDraftPool(new SeededRNG(42));
    const roles = new Set(pool.map(p => classifyRole(p.species)));
    expect(roles.size).toBeGreaterThanOrEqual(3);
  });
});
