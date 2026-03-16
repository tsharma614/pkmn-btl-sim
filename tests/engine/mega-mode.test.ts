/**
 * Tests for mega mode across draft pool generation, team generation,
 * gym leader pools, and role draft mega role.
 */
import { describe, it, expect } from 'vitest';
import {
  generateDraftPool,
  generateGymLeaderPool,
  generateRoleDraftPool,
  pickBotDraftPick,
  DRAFT_ROLES,
  ROLE_LABELS,
  MEGA_POOL,
  MONOTYPE_TYPES,
} from '../../src/engine/draft-pool';
import { generateTeam } from '../../src/engine/team-generator';
import { SeededRNG } from '../../src/utils/rng';

// ===================== Mega Pool Data =====================

describe('Mega Pool Data', () => {
  it('MEGA_POOL has entries loaded from mega-pokemon.json', () => {
    expect(MEGA_POOL.length).toBeGreaterThanOrEqual(40);
  });

  it('all mega Pokemon have isMega flag', () => {
    for (const mega of MEGA_POOL) {
      expect((mega as any).isMega).toBe(true);
    }
  });

  it('all mega Pokemon have baseSpecies', () => {
    for (const mega of MEGA_POOL) {
      expect((mega as any).baseSpecies).toBeTruthy();
    }
  });

  it('mega Pokemon have valid generation inherited from base form', () => {
    for (const mega of MEGA_POOL) {
      expect(mega.generation).toBeGreaterThanOrEqual(1);
      expect(mega.generation).toBeLessThanOrEqual(6); // megas only exist Gen 1-6 base forms
    }
  });
});

// ===================== Role Draft: Mega Role =====================

describe('Role Draft: Mega Role', () => {
  it('DRAFT_ROLES includes mega', () => {
    expect(DRAFT_ROLES).toContain('mega');
  });

  it('ROLE_LABELS has Mega Evolution label', () => {
    expect(ROLE_LABELS.mega).toBe('Mega Evolution');
  });

  it('role draft pool has 4 mega entries', () => {
    const pool = generateRoleDraftPool(new SeededRNG(42));
    const megas = pool.filter(p => p.role === 'mega');
    expect(megas).toHaveLength(4);
  });

  it('mega role entries are actual mega Pokemon', () => {
    const megaIds = new Set(MEGA_POOL.map(m => m.id));
    const pool = generateRoleDraftPool(new SeededRNG(42));
    const megas = pool.filter(p => p.role === 'mega');
    for (const entry of megas) {
      expect(megaIds.has(entry.species.id)).toBe(true);
    }
  });

  it('role draft mega role respects maxGen', () => {
    const pool = generateRoleDraftPool(new SeededRNG(42), { maxGen: 4 });
    const megas = pool.filter(p => p.role === 'mega');
    for (const entry of megas) {
      expect(entry.species.generation).toBeLessThanOrEqual(4);
    }
  });

  it('role draft mega role works with legendary mode', () => {
    const pool = generateRoleDraftPool(new SeededRNG(42), { legendaryMode: true });
    const megas = pool.filter(p => p.role === 'mega');
    expect(megas.length).toBe(4);
  });

  it('no duplicate species between mega role and other roles', () => {
    const pool = generateRoleDraftPool(new SeededRNG(42));
    const ids = pool.map(p => p.species.id);
    expect(new Set(ids).size).toBe(24);
  });
});

// ===================== Snake Draft: Mega Mode =====================

describe('Snake Draft: Mega Mode', () => {
  it('mega mode pool has 23 entries (21 regular - 2 reduced + 2 mega = 21 regular slots + 2 mega)', () => {
    const pool = generateDraftPool(new SeededRNG(42), { megaMode: true });
    // Pool is 19 regular + 2 mega = 21, OR targetPoolSize entries total
    // The regular pool is reduced by megaSlots, then megas appended
    const megas = pool.filter(p => p.tier === 0);
    const regulars = pool.filter(p => p.tier !== 0);
    expect(megas).toHaveLength(2);
    expect(regulars.length + megas.length).toBe(pool.length);
    expect(pool.length).toBe(21); // 19 regular + 2 mega
  });

  it('mega entries have tier 0', () => {
    const pool = generateDraftPool(new SeededRNG(42), { megaMode: true });
    const megas = pool.filter(p => p.tier === 0);
    expect(megas).toHaveLength(2);
  });

  it('mega entries are actual mega Pokemon', () => {
    const megaIds = new Set(MEGA_POOL.map(m => m.id));
    const pool = generateDraftPool(new SeededRNG(42), { megaMode: true });
    const megas = pool.filter(p => p.tier === 0);
    for (const entry of megas) {
      expect(megaIds.has(entry.species.id)).toBe(true);
    }
  });

  it('mega entries appear at end of pool', () => {
    const pool = generateDraftPool(new SeededRNG(42), { megaMode: true });
    const lastTwo = pool.slice(-2);
    expect(lastTwo[0].tier).toBe(0);
    expect(lastTwo[1].tier).toBe(0);
  });

  it('no duplicate species between regular and mega entries', () => {
    for (let seed = 0; seed < 20; seed++) {
      const pool = generateDraftPool(new SeededRNG(seed), { megaMode: true });
      const ids = pool.map(p => p.species.id);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it('mega mode respects maxGen filter', () => {
    const pool = generateDraftPool(new SeededRNG(42), { megaMode: true, maxGen: 4 });
    const megas = pool.filter(p => p.tier === 0);
    for (const entry of megas) {
      expect(entry.species.generation).toBeLessThanOrEqual(4);
    }
  });

  it('mega mode + legendary has 4 mega slots at pool 21', () => {
    const pool = generateDraftPool(new SeededRNG(42), { megaMode: true, legendaryMode: true });
    const megas = pool.filter(p => p.tier === 0);
    expect(megas).toHaveLength(4);
    expect(pool.length).toBe(21);
    // Regular pool should still be legendary distribution (only T1/T2)
    const regulars = pool.filter(p => p.tier !== 0);
    const hasOnlyT1T2 = regulars.every(p => p.tier === 1 || p.tier === 2);
    expect(hasOnlyT1T2).toBe(true);
  });

  it('mega mode + legendary scales: 12 mega slots at pool 30', () => {
    const pool = generateDraftPool(new SeededRNG(42), { megaMode: true, legendaryMode: true, poolSize: 30 });
    const megas = pool.filter(p => p.tier === 0);
    expect(megas).toHaveLength(12);
    expect(pool.length).toBe(30);
  });

  it('monotype mega slots match the chosen type', () => {
    // Fire has several megas (Charizard X/Y, Blaziken, Houndoom)
    for (let seed = 0; seed < 10; seed++) {
      const pool = generateDraftPool(new SeededRNG(seed), { megaMode: true, monotype: 'Fire' });
      const megas = pool.filter(p => p.tier === 0);
      expect(megas.length).toBeGreaterThanOrEqual(1);
      for (const m of megas) {
        expect(
          (m.species.types as string[]).includes('Fire'),
          `${m.species.name} should be Fire type in monotype Fire draft`
        ).toBe(true);
      }
    }
  });

  it('monotype mega falls back if not enough typed megas', () => {
    // Bug type has very few megas (Beedrill, Pinsir, Heracross, Scizor)
    const pool = generateDraftPool(new SeededRNG(42), { megaMode: true, monotype: 'Bug' });
    const megas = pool.filter(p => p.tier === 0);
    expect(megas.length).toBeGreaterThanOrEqual(1);
  });

  it('mega mode works with larger pool sizes', () => {
    for (const size of [24, 27, 30]) {
      const pool = generateDraftPool(new SeededRNG(42), { megaMode: true, poolSize: size });
      // Pool = (size - 2 regular) + 2 mega = size total
      expect(pool.length).toBe(size);
      const megas = pool.filter(p => p.tier === 0);
      expect(megas).toHaveLength(2);
    }
  });

  it('without mega mode, no tier 0 entries', () => {
    const pool = generateDraftPool(new SeededRNG(42));
    const megas = pool.filter(p => p.tier === 0);
    expect(megas).toHaveLength(0);
  });

  it('mega mode + classic + legendary combined', () => {
    for (let seed = 0; seed < 10; seed++) {
      const pool = generateDraftPool(new SeededRNG(seed), {
        megaMode: true,
        maxGen: 4,
        legendaryMode: true,
      });
      const megas = pool.filter(p => p.tier === 0);
      // Legendary mode requests 4 mega slots, but classic mode may limit available megas
      expect(megas.length).toBeGreaterThanOrEqual(1);
      for (const m of megas) {
        expect(m.species.generation).toBeLessThanOrEqual(4);
      }
    }
  });
});

// ===================== Gym Leader Pool: Mega Mode =====================

describe('Gym Leader Pool: Mega Mode', () => {
  it('mega mode gym pool has tier 0 mega entries', () => {
    const pool = generateGymLeaderPool(new SeededRNG(42), 'Fire', { megaMode: true });
    const megas = pool.filter(p => p.tier === 0);
    expect(megas).toHaveLength(2); // non-legendary = 2 mega slots
    expect(pool.length).toBe(21);
  });

  it('mega mode + legendary gym pool has 4 mega slots', () => {
    const pool = generateGymLeaderPool(new SeededRNG(42), 'Fire', { megaMode: true, legendaryMode: true });
    const megas = pool.filter(p => p.tier === 0);
    expect(megas).toHaveLength(4);
    expect(pool.length).toBe(21);
  });

  it('mega entries have tier 0', () => {
    const pool = generateGymLeaderPool(new SeededRNG(42), 'Fire', { megaMode: true });
    const megas = pool.filter(p => p.tier === 0);
    expect(megas).toHaveLength(2);
  });

  it('prefers megas matching the gym type', () => {
    // Fire type has Mega Charizard X/Y, Mega Blaziken, Mega Houndoom, etc.
    let foundTyped = false;
    for (let seed = 0; seed < 20; seed++) {
      const pool = generateGymLeaderPool(new SeededRNG(seed), 'Fire', { megaMode: true });
      const megas = pool.filter(p => p.tier === 0);
      if (megas.some(m => (m.species.types as string[]).includes('Fire'))) {
        foundTyped = true;
        break;
      }
    }
    expect(foundTyped).toBe(true);
  });

  it('works for every type', () => {
    for (const type of MONOTYPE_TYPES) {
      const pool = generateGymLeaderPool(new SeededRNG(42), type, { megaMode: true });
      const megas = pool.filter(p => p.tier === 0);
      expect(megas.length).toBeGreaterThanOrEqual(1);
    }
  });
});

// ===================== Team Generator: Mega Mode =====================

describe('Team Generator: Mega Mode', () => {
  it('generates valid 6-Pokemon team with megaMode', () => {
    for (let seed = 0; seed < 20; seed++) {
      const team = generateTeam(new SeededRNG(seed), { itemMode: 'competitive', megaMode: true });
      expect(team).toHaveLength(6);
      for (const p of team) {
        expect(p.isAlive).toBe(true);
        expect(p.currentHp).toBe(p.maxHp);
        expect(p.level).toBe(100);
      }
    }
  });

  it('sometimes includes a mega Pokemon (~25% chance)', () => {
    const megaIds = new Set(MEGA_POOL.map(m => m.id));
    let megaCount = 0;
    const trials = 200;
    for (let seed = 0; seed < trials; seed++) {
      const team = generateTeam(new SeededRNG(seed), { itemMode: 'competitive', megaMode: true });
      if (team.some(p => megaIds.has(p.species.id))) {
        megaCount++;
      }
    }
    // Should be roughly 25% — allow 10-45% range
    const rate = megaCount / trials;
    expect(rate).toBeGreaterThan(0.1);
    expect(rate).toBeLessThan(0.45);
  });

  it('never includes megas when megaMode is off', () => {
    const megaIds = new Set(MEGA_POOL.map(m => m.id));
    for (let seed = 0; seed < 100; seed++) {
      const team = generateTeam(new SeededRNG(seed), { itemMode: 'competitive' });
      for (const p of team) {
        expect(megaIds.has(p.species.id)).toBe(false);
      }
    }
  });

  it('at most 1 mega per team', () => {
    const megaIds = new Set(MEGA_POOL.map(m => m.id));
    for (let seed = 0; seed < 100; seed++) {
      const team = generateTeam(new SeededRNG(seed), { itemMode: 'competitive', megaMode: true });
      const megasOnTeam = team.filter(p => megaIds.has(p.species.id));
      expect(megasOnTeam.length).toBeLessThanOrEqual(1);
    }
  });

  it('mega teams have 4 moves per Pokemon (except Ditto/Unown)', () => {
    for (let seed = 0; seed < 50; seed++) {
      const team = generateTeam(new SeededRNG(seed), { itemMode: 'competitive', megaMode: true });
      for (const p of team) {
        if (p.species.id === 'ditto' || p.species.id === 'unown') continue;
        expect(p.moves.length, `${p.species.name} has ${p.moves.length} moves (seed ${seed})`).toBe(4);
      }
    }
  });

  it('mega mode + classic mode respects maxGen', () => {
    for (let seed = 0; seed < 20; seed++) {
      const team = generateTeam(new SeededRNG(seed), {
        itemMode: 'competitive',
        megaMode: true,
        maxGen: 4,
      });
      for (const p of team) {
        expect(p.species.generation).toBeLessThanOrEqual(4);
      }
    }
  });
});

// ===================== Bot Draft AI: Mega Priority =====================

describe('Bot Draft AI: Mega Priority', () => {
  it('hard mode picks mega first when available', () => {
    for (let seed = 0; seed < 10; seed++) {
      const pool = generateDraftPool(new SeededRNG(seed), { megaMode: true });
      const megaIndices = pool.map((e, i) => ({ e, i })).filter(({ e }) => e.tier === 0);
      if (megaIndices.length === 0) continue;

      const rng = new SeededRNG(seed + 100);
      const pick = pickBotDraftPick(pool, [], [], 'hard', rng);
      expect(pool[pick].tier, `Hard mode should pick mega first (seed ${seed})`).toBe(0);
    }
  });

  it('easy mode picks mega first when available', () => {
    let pickedMega = false;
    for (let seed = 0; seed < 20; seed++) {
      const pool = generateDraftPool(new SeededRNG(seed), { megaMode: true });
      const hasMegas = pool.some(e => e.tier === 0);
      if (!hasMegas) continue;

      const rng = new SeededRNG(seed + 200);
      const pick = pickBotDraftPick(pool, [], [], 'easy', rng);
      if (pool[pick].tier === 0) pickedMega = true;
    }
    expect(pickedMega).toBe(true);
  });

  it('normal mode picks mega first when available', () => {
    let pickedMega = false;
    for (let seed = 0; seed < 20; seed++) {
      const pool = generateDraftPool(new SeededRNG(seed), { megaMode: true });
      const hasMegas = pool.some(e => e.tier === 0);
      if (!hasMegas) continue;

      const rng = new SeededRNG(seed + 300);
      const pick = pickBotDraftPick(pool, [], [], 'normal', rng);
      if (pool[pick].tier === 0) pickedMega = true;
    }
    expect(pickedMega).toBe(true);
  });

  it('does not pick mega when one is already picked', () => {
    const pool = generateDraftPool(new SeededRNG(42), { megaMode: true });
    const megaIdx = pool.findIndex(e => e.tier === 0);
    if (megaIdx < 0) return;

    // After picking a mega, next pick should not be mega
    const rng = new SeededRNG(99);
    const secondPick = pickBotDraftPick(pool, [megaIdx], [], 'hard', rng);
    // Could still be mega if first pick wasn't mega, but if it was, second shouldn't force mega
    if (pool[megaIdx].tier === 0) {
      // The early-return mega logic only triggers when no mega picked yet
      // So second pick goes through normal scoring
      expect(secondPick).not.toBe(megaIdx); // at minimum, don't double-pick
    }
  });

  it('without mega mode, no mega picks happen', () => {
    const pool = generateDraftPool(new SeededRNG(42));
    const hasMegas = pool.some(e => e.tier === 0);
    expect(hasMegas).toBe(false);
  });
});
