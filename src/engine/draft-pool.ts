/**
 * Draft mode: pool generation, bot AI, and team builder.
 * Supports snake draft, role draft, and gym leader challenge.
 */

import { PokemonSpecies, PokemonType, Tier, BattlePokemon } from '../types';
import { createBattlePokemon } from './pokemon-factory';
import { pickSet } from './team-generator';
import { SeededRNG } from '../utils/rng';
import { getTypeEffectiveness } from '../data/type-chart';
import pokedexData from '../data/pokedex.json';

const pokedex = pokedexData as Record<string, PokemonSpecies>;

// Pokemon without animated sprites on Showdown CDN
const NO_SPRITE: Set<string> = new Set([
  'ironleaves', 'okidogi', 'munkidori', 'fezandipiti',
  'ironboulder', 'ironcrown', 'terapagos', 'pecharunt',
]);

const TIERS: Record<Tier, PokemonSpecies[]> = { 1: [], 2: [], 3: [], 4: [] };

for (const species of Object.values(pokedex)) {
  if (NO_SPRITE.has(species.id)) continue;
  const tier = species.tier as Tier;
  if (TIERS[tier]) {
    TIERS[tier].push(species);
  }
}

export const SNAKE_ORDER: (0 | 1)[] = [0, 1, 1, 0, 0, 1, 1, 0, 0, 1, 1, 0];

export interface DraftPoolEntry {
  species: PokemonSpecies;
  tier: number;
}

export type DraftType = 'snake' | 'role';

export interface DraftPoolOptions {
  maxGen?: number | null;
  legendaryMode?: boolean;
  itemMode?: 'competitive' | 'casual';
  monotype?: string | null; // e.g. 'Fire' — only Pokemon with this type
  poolSize?: number; // 21 (default), 24, 27, or 30
}

/** Valid pool sizes. */
export const POOL_SIZES = [21, 24, 27, 30] as const;
export type PoolSize = typeof POOL_SIZES[number];

/** All types available for monotype draft. */
export const MONOTYPE_TYPES = [
  'Normal', 'Fire', 'Water', 'Electric', 'Grass', 'Ice',
  'Fighting', 'Poison', 'Ground', 'Flying', 'Psychic',
  'Bug', 'Rock', 'Ghost', 'Dragon', 'Dark', 'Steel', 'Fairy',
];

// --- Role Draft ---

export type DraftRole = 'physSweeper' | 'specSweeper' | 'physWall' | 'specWall' | 'support' | 'wildcard';

export const DRAFT_ROLES: DraftRole[] = ['physSweeper', 'specSweeper', 'physWall', 'specWall', 'support', 'wildcard'];

export const ROLE_LABELS: Record<DraftRole, string> = {
  physSweeper: 'Physical Sweeper',
  specSweeper: 'Special Sweeper',
  physWall: 'Physical Wall',
  specWall: 'Special Wall',
  support: 'Support',
  wildcard: 'Wildcard',
};

/** How many Pokemon to generate per role in the pool. */
const ROLE_POOL_SIZE = 4;

const SUPPORT_MOVES = new Set([
  'Stealth Rock', 'Spikes', 'Toxic Spikes', 'Sticky Web',
  'Reflect', 'Light Screen', 'Aurora Veil', 'Tailwind',
  'Defog', 'Rapid Spin', 'Wish', 'Heal Bell', 'Aromatherapy',
  'Thunder Wave', 'Will-O-Wisp', 'Toxic', 'Yawn',
  'Knock Off', 'Whirlwind', 'Roar', 'Haze',
]);

export interface RoleDraftPoolEntry extends DraftPoolEntry {
  role: DraftRole;
}

/** Classify a Pokemon into its best-fit role. */
export function classifyRole(species: PokemonSpecies): DraftRole {
  const { atk, def, spa, spd, spe, hp } = species.baseStats;

  // Support: check movepool for utility moves (at least 2)
  const supportMoveCount = species.movePool.filter(m => SUPPORT_MOVES.has(m)).length;
  if (supportMoveCount >= 3 && spe <= 100) return 'support';

  // Physical Sweeper: high atk + spe, offensive
  if (atk >= 90 && spe >= 80 && atk >= spa) return 'physSweeper';

  // Special Sweeper: high spa + spe, offensive
  if (spa >= 90 && spe >= 80 && spa > atk) return 'specSweeper';

  // Physical Wall: high def + hp
  if (hp + def >= 170 && def >= 80) return 'physWall';

  // Special Wall: high spd + hp
  if (hp + spd >= 170 && spd >= 80) return 'specWall';

  // Support fallback for bulky mons with utility moves
  if (supportMoveCount >= 2 && spe <= 90 && hp + def + spd >= 220) return 'support';

  // Fallback classification by best stat
  if (atk >= spa && spe >= 70) return 'physSweeper';
  if (spa > atk && spe >= 70) return 'specSweeper';
  if (def >= spd) return 'physWall';
  return 'specWall';
}

/**
 * Generate a role-based draft pool.
 * Returns 24 Pokemon: 4 per role (physSweeper, specSweeper, physWall, specWall, support, wildcard).
 */
export function generateRoleDraftPool(
  rng: SeededRNG,
  options: DraftPoolOptions = {},
): RoleDraftPoolEntry[] {
  const maxGen = options.maxGen ?? null;
  const legendaryMode = options.legendaryMode ?? false;
  const tiers = getFilteredTiers(maxGen);

  // Build flat list of all eligible species with tiers
  const allSpecies: { species: PokemonSpecies; tier: number }[] = [];
  for (const t of (legendaryMode ? [1, 2] : [1, 2, 3, 4]) as Tier[]) {
    for (const s of tiers[t]) {
      allSpecies.push({ species: s, tier: t });
    }
  }

  // Classify all species by role
  const byRole: Record<DraftRole, { species: PokemonSpecies; tier: number }[]> = {
    physSweeper: [], specSweeper: [], physWall: [], specWall: [], support: [], wildcard: [],
  };

  for (const entry of allSpecies) {
    const role = classifyRole(entry.species);
    byRole[role].push(entry);
  }

  // Wildcard gets everything
  byRole.wildcard = [...allSpecies];

  const pool: RoleDraftPoolEntry[] = [];
  const usedIds = new Set<string>();

  for (const role of DRAFT_ROLES) {
    const candidates = byRole[role].filter(e => !usedIds.has(e.species.id));
    rng.shuffle(candidates);

    // Try to get tier diversity within each role
    const picked: { species: PokemonSpecies; tier: number }[] = [];
    const tierBuckets: Record<number, typeof candidates> = {};
    for (const c of candidates) {
      if (!tierBuckets[c.tier]) tierBuckets[c.tier] = [];
      tierBuckets[c.tier].push(c);
    }

    // Pick one from each available tier first, then fill randomly
    for (const t of [1, 2, 3, 4]) {
      if (picked.length >= ROLE_POOL_SIZE) break;
      if (tierBuckets[t] && tierBuckets[t].length > 0) {
        picked.push(tierBuckets[t].shift()!);
      }
    }
    // Fill remaining slots
    const remaining = candidates.filter(c => !picked.includes(c));
    while (picked.length < ROLE_POOL_SIZE && remaining.length > 0) {
      picked.push(remaining.shift()!);
    }

    for (const entry of picked) {
      usedIds.add(entry.species.id);
      pool.push({ species: entry.species, tier: entry.tier, role });
    }
  }

  return pool;
}

// --- Pool Generation ---

/** Build filtered tier pools based on maxGen. */
function getFilteredTiers(maxGen: number | null): Record<Tier, PokemonSpecies[]> {
  if (!maxGen) return TIERS;
  const filtered: Record<Tier, PokemonSpecies[]> = { 1: [], 2: [], 3: [], 4: [] };
  for (const tier of [1, 2, 3, 4] as Tier[]) {
    filtered[tier] = TIERS[tier].filter(s => s.generation <= maxGen);
  }
  return filtered;
}

/** Get a canonical key for a Pokemon's type combination. */
function typeKey(species: PokemonSpecies): string {
  return [...species.types].sort().join('/');
}

/** Get the base stat total for a species. */
function getBST(species: PokemonSpecies): number {
  const s = species.baseStats;
  return s.hp + s.atk + s.def + s.spa + s.spd + s.spe;
}

/** Validate a draft pool meets diversity constraints. */
function validatePool(pool: PokemonSpecies[], isMonotype = false): boolean {
  const typeCounts: Record<string, number> = {};
  const allTypes = new Set<string>();
  for (const species of pool) {
    for (const type of species.types) {
      typeCounts[type] = (typeCounts[type] || 0) + 1;
      allTypes.add(type);
    }
  }

  if (isMonotype) {
    // Monotype: just ensure no type combo floods (max 3 repeats) and phys/special mix
    const typeKeyCounts: Record<string, number> = {};
    for (const species of pool) {
      const key = typeKey(species);
      typeKeyCounts[key] = (typeKeyCounts[key] || 0) + 1;
      if (typeKeyCounts[key] > 3) return false;
    }
  } else {
    // No single type appears on more than 6 Pokemon (scale with pool size)
    const maxPerType = Math.max(6, Math.ceil(pool.length / 3.5));
    for (const count of Object.values(typeCounts)) {
      if (count > maxPerType) return false;
    }

    // At least 10 distinct types
    if (allTypes.size < 10) return false;

    // No type combo appears more than twice (scale with pool size)
    const maxCombo = pool.length > 21 ? 3 : 2;
    const typeKeyCounts: Record<string, number> = {};
    for (const species of pool) {
      const key = typeKey(species);
      typeKeyCounts[key] = (typeKeyCounts[key] || 0) + 1;
      if (typeKeyCounts[key] > maxCombo) return false;
    }
  }

  // At least 2 physical + 2 special attackers
  const physical = pool.filter(s => s.baseStats.atk >= s.baseStats.spa);
  const special = pool.filter(s => s.baseStats.spa > s.baseStats.atk);
  if (physical.length < 2 || special.length < 2) return false;

  return true;
}

/**
 * Generate a balanced draft pool.
 * Default size is 21 Pokemon. Supports 21, 24, 27, 30.
 *
 * Tier distribution (for 21):
 *   Normal:    3 T1, 5 T2, 6 T3, 7 T4
 *   Legendary: 9 T1, 12 T2 (T1 + T2 only)
 *
 * For larger pools, extra slots are distributed proportionally.
 */
export function generateDraftPool(
  rng: SeededRNG,
  options: DraftPoolOptions = {}
): DraftPoolEntry[] {
  const maxGen = options.maxGen ?? null;
  const legendary = options.legendaryMode ?? false;
  const monotype = options.monotype ?? null;
  const targetPoolSize = options.poolSize ?? 21;

  // Monotype: filter all tiers to only include Pokemon with the chosen type
  let tiers = getFilteredTiers(maxGen);
  if (monotype) {
    const filtered: Record<Tier, PokemonSpecies[]> = { 1: [], 2: [], 3: [], 4: [] };
    for (const tier of [1, 2, 3, 4] as Tier[]) {
      filtered[tier] = tiers[tier].filter(s =>
        (s.types as string[]).includes(monotype)
      );
    }
    tiers = filtered;
  }

  // Calculate tier distribution based on pool size
  const extra = targetPoolSize - 21;
  const ideal: { tier: Tier; count: number }[] = legendary
    ? [
        { tier: 1, count: 9 + Math.floor(extra * 0.4) },
        { tier: 2, count: 12 + Math.ceil(extra * 0.6) },
      ]
    : [
        { tier: 1, count: 3 + Math.floor(extra * 0.1) },
        { tier: 2, count: 5 + Math.floor(extra * 0.25) },
        { tier: 3, count: 6 + Math.floor(extra * 0.3) },
        { tier: 4, count: 7 + (extra - Math.floor(extra * 0.1) - Math.floor(extra * 0.25) - Math.floor(extra * 0.3)) },
      ];

  // Dynamic adjustment: if any tier has fewer Pokemon than requested,
  // cap it and redistribute overflow to other tiers
  const distribution = ideal.map(d => ({ ...d }));
  let overflow = 0;
  for (const d of distribution) {
    const available = tiers[d.tier].length;
    if (available < d.count) {
      overflow += d.count - available;
      d.count = available;
    }
  }
  // Redistribute overflow to other tiers already in the distribution
  while (overflow > 0) {
    let distributed = false;
    for (const d of [...distribution].reverse()) {
      const available = tiers[d.tier].length;
      if (d.count < available) {
        const canAdd = Math.min(overflow, available - d.count);
        d.count += canAdd;
        overflow -= canAdd;
        distributed = true;
        if (overflow === 0) break;
      }
    }
    if (!distributed) break;
  }
  // If still short, pull from tiers not in the distribution
  if (overflow > 0) {
    const usedTiers = new Set(distribution.map(d => d.tier));
    for (const tier of [3, 4, 2, 1] as Tier[]) {
      if (usedTiers.has(tier) || overflow === 0) continue;
      const available = tiers[tier].length;
      if (available > 0) {
        const canAdd = Math.min(overflow, available);
        distribution.push({ tier, count: canAdd });
        overflow -= canAdd;
      }
    }
  }

  let pool: PokemonSpecies[] = [];
  let attempts = 0;
  const maxAttempts = 100;

  // Per-tier type cap
  function tierTypeCap(count: number): number {
    return Math.max(2, Math.ceil(count / 3));
  }

  while (attempts < maxAttempts) {
    attempts++;
    pool = [];

    for (const { tier, count } of distribution) {
      const tierPool = [...tiers[tier]];
      rng.shuffle(tierPool);
      const cap = tierTypeCap(count);
      const tierTypeCounts: Record<string, number> = {};

      let added = 0;
      for (const species of tierPool) {
        if (added >= count) break;
        if (pool.some(p => p.id === species.id)) continue;
        if (!monotype) {
          const wouldExceed = species.types.some((t: string) => (tierTypeCounts[t] || 0) >= cap);
          if (wouldExceed) continue;
        }
        pool.push(species);
        for (const t of species.types) {
          tierTypeCounts[t] = (tierTypeCounts[t] || 0) + 1;
        }
        added++;
      }
    }

    const targetSize = distribution.reduce((sum, d) => sum + d.count, 0);
    if (pool.length === targetSize && validatePool(pool, !!monotype)) {
      break;
    }
  }

  const targetSize = distribution.reduce((sum, d) => sum + d.count, 0);
  // Fallback: unvalidated pool
  if (pool.length !== targetSize) {
    pool = [];
    const allowedTiers = legendary ? [1, 2] : [1, 2, 3, 4];
    const all = Object.values(pokedex).filter(
      s => !NO_SPRITE.has(s.id) && allowedTiers.includes(s.tier as number)
        && (!maxGen || s.generation <= maxGen)
        && (!monotype || (s.types as string[]).includes(monotype))
    );
    rng.shuffle(all);
    pool = all.slice(0, Math.min(targetPoolSize, all.length));
  }

  // If still under 12, fill by relaxing restrictions
  const MIN_POOL = 12;
  if (pool.length < MIN_POOL) {
    const poolIds = new Set(pool.map(s => s.id));
    if (monotype) {
      const sameType = Object.values(pokedex).filter(
        s => !NO_SPRITE.has(s.id)
          && (s.types as string[]).includes(monotype)
          && !poolIds.has(s.id)
      );
      rng.shuffle(sameType);
      for (const s of sameType) {
        if (pool.length >= MIN_POOL) break;
        pool.push(s);
        poolIds.add(s.id);
      }
    }
    if (pool.length < MIN_POOL) {
      const any = Object.values(pokedex).filter(
        s => !NO_SPRITE.has(s.id)
          && (!maxGen || s.generation <= maxGen)
          && !poolIds.has(s.id)
      );
      rng.shuffle(any);
      for (const s of any) {
        if (pool.length >= MIN_POOL) break;
        pool.push(s);
      }
    }
  }

  return pool.map(species => ({
    species,
    tier: species.tier,
  }));
}

/**
 * Generate a gym leader challenge pool.
 * All Pokemon in the pool have the gym's type.
 * Fills from higher tiers first, dipping into lower tiers as needed.
 */
export function generateGymLeaderPool(
  rng: SeededRNG,
  gymType: string,
  options: DraftPoolOptions = {}
): DraftPoolEntry[] {
  const maxGen = options.maxGen ?? null;
  const legendary = options.legendaryMode ?? false;
  const targetPoolSize = options.poolSize ?? 21;
  const tiers = getFilteredTiers(maxGen);
  const allowedTiers = legendary ? [1, 2] as Tier[] : [1, 2, 3, 4] as Tier[];

  // Collect all Pokemon of this type, grouped by tier (higher tiers first)
  const byTier: Record<number, PokemonSpecies[]> = {};
  for (const tier of allowedTiers) {
    byTier[tier] = tiers[tier].filter(s => (s.types as string[]).includes(gymType));
    rng.shuffle(byTier[tier]);
  }

  const pool: PokemonSpecies[] = [];
  const poolIds = new Set<string>();

  // Fill pool from highest tier down
  for (const tier of allowedTiers) {
    for (const s of byTier[tier]) {
      if (pool.length >= targetPoolSize) break;
      if (poolIds.has(s.id)) continue;
      pool.push(s);
      poolIds.add(s.id);
    }
    if (pool.length >= targetPoolSize) break;
  }

  // If legendary mode didn't have enough, dip into T3/T4
  if (pool.length < targetPoolSize && legendary) {
    for (const tier of [3, 4] as Tier[]) {
      const extras = tiers[tier].filter(s =>
        (s.types as string[]).includes(gymType) && !poolIds.has(s.id)
      );
      rng.shuffle(extras);
      for (const s of extras) {
        if (pool.length >= targetPoolSize) break;
        pool.push(s);
        poolIds.add(s.id);
      }
      if (pool.length >= targetPoolSize) break;
    }
  }

  return pool.map(species => ({
    species,
    tier: species.tier,
  }));
}

// --- Bot Draft AI ---

/**
 * Bot draft AI: picks from the remaining pool.
 * Hard mode includes: deny-drafting, defensive coverage, BST consideration,
 * team composition awareness.
 */
export function pickBotDraftPick(
  pool: DraftPoolEntry[],
  myPicks: number[],
  opponentPicks: number[],
  difficulty: 'easy' | 'normal' | 'hard',
  rng: SeededRNG,
): number {
  const picked = new Set([...myPicks, ...opponentPicks]);
  const remaining = pool
    .map((entry, i) => ({ entry, index: i }))
    .filter(({ index }) => !picked.has(index));

  if (remaining.length === 0) return 0;

  if (difficulty === 'easy') {
    return rng.pick(remaining).index;
  }

  // Get types of my current picks for coverage calculation
  const myTypes = new Set<string>();
  for (const idx of myPicks) {
    for (const t of pool[idx].species.types) {
      myTypes.add(t);
    }
  }

  // Get opponent's types for offensive/defensive advantage calc
  const oppTypes: PokemonType[] = [];
  for (const idx of opponentPicks) {
    for (const t of pool[idx].species.types) {
      oppTypes.push(t as PokemonType);
    }
  }

  const isHard = difficulty === 'hard';

  const scored = remaining.map(({ entry, index }) => {
    let score = 0;
    const speciesTypes = entry.species.types as PokemonType[];

    // Tier value: higher tier = more valuable
    const tierValue = { 1: 40, 2: 30, 3: 20, 4: 10 }[entry.tier] ?? 15;
    score += tierValue;

    // Type coverage bonus: new types are worth more
    let newTypes = 0;
    for (const t of speciesTypes) {
      if (!myTypes.has(t as string)) newTypes++;
    }
    score += newTypes * (isHard ? 12 : 8);

    // Offensive advantage against opponent's picks
    if (oppTypes.length > 0) {
      for (const myType of speciesTypes) {
        for (const oppType of oppTypes) {
          const eff = getTypeEffectiveness(myType, [oppType]);
          if (eff > 1) score += isHard ? 6 : 3; // Increased deny-draft weight
        }
      }
    }

    // Oversaturation penalty: penalize types we already have too many of
    for (const t of entry.species.types) {
      const count = myPicks.filter(idx =>
        (pool[idx].species.types as string[]).includes(t as string)
      ).length;
      if (count >= 2) score -= 8;
    }

    // --- Hard mode enhancements ---
    if (isHard) {
      // Defensive coverage: resist opponent's types
      if (oppTypes.length > 0) {
        for (const myType of speciesTypes) {
          for (const oppType of oppTypes) {
            const eff = getTypeEffectiveness(oppType, [myType]);
            if (eff < 1) score += 5;
            if (eff === 0) score += 8;
          }
        }
      }

      // BST consideration: higher BST = stronger Pokemon
      const bst = getBST(entry.species);
      score += bst / 50; // ~10 points for 500 BST

      // Team composition: need mix of physical, special, and speed
      if (myPicks.length >= 2) {
        const hasPhysical = myPicks.some(i => pool[i].species.baseStats.atk > pool[i].species.baseStats.spa);
        const hasSpecial = myPicks.some(i => pool[i].species.baseStats.spa > pool[i].species.baseStats.atk);
        const hasFast = myPicks.some(i => pool[i].species.baseStats.spe >= 100);

        if (!hasPhysical && entry.species.baseStats.atk > entry.species.baseStats.spa) score += 10;
        if (!hasSpecial && entry.species.baseStats.spa > entry.species.baseStats.atk) score += 10;
        if (!hasFast && entry.species.baseStats.spe >= 100) score += 8;
      }
    }

    return { index, score };
  });

  if (difficulty === 'normal') {
    // Weighted random: use scores as weights
    const minScore = Math.min(...scored.map(s => s.score));
    const weights = scored.map(s => Math.max(s.score - minScore + 1, 1));
    const totalWeight = weights.reduce((a, b) => a + b, 0);
    let roll = rng.next() * totalWeight;
    for (let i = 0; i < scored.length; i++) {
      roll -= weights[i];
      if (roll <= 0) return scored[i].index;
    }
    return scored[scored.length - 1].index;
  }

  // Hard: greedy pick
  scored.sort((a, b) => b.score - a.score);
  return scored[0].index;
}

/**
 * Gym leader draft AI: strongly prefers the gym's type.
 */
export function pickGymLeaderDraftPick(
  pool: DraftPoolEntry[],
  myPicks: number[],
  opponentPicks: number[],
  gymType: string,
  rng: SeededRNG,
): number {
  const picked = new Set([...myPicks, ...opponentPicks]);
  const remaining = pool
    .map((entry, i) => ({ entry, index: i }))
    .filter(({ index }) => !picked.has(index));

  if (remaining.length === 0) return 0;

  const myTypes = new Set<string>();
  for (const idx of myPicks) {
    for (const t of pool[idx].species.types) {
      myTypes.add(t);
    }
  }

  const scored = remaining.map(({ entry, index }) => {
    let score = 0;
    const speciesTypes = entry.species.types as string[];

    // Massive bonus for gym type Pokemon
    if (speciesTypes.includes(gymType)) {
      score += 30;
    }

    // Tier value
    const tierValue = { 1: 40, 2: 30, 3: 20, 4: 10 }[entry.tier] ?? 15;
    score += tierValue;

    // BST bonus
    score += getBST(entry.species) / 50;

    // Type coverage within the team (avoid identical type combos)
    let newTypes = 0;
    for (const t of speciesTypes) {
      if (!myTypes.has(t)) newTypes++;
    }
    score += newTypes * 8;

    // Oversaturation penalty
    for (const t of speciesTypes) {
      const count = myPicks.filter(idx =>
        (pool[idx].species.types as string[]).includes(t)
      ).length;
      if (count >= 3) score -= 12;
    }

    // Occasionally pick a T1 non-type Pokemon to cover weaknesses
    if (!speciesTypes.includes(gymType) && entry.tier === 1) {
      score += 5;
    }

    return { index, score };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored[0].index;
}

// --- Team Builder ---

export function buildTeamFromDraftPicks(
  picks: PokemonSpecies[],
  rng: SeededRNG,
  options: DraftPoolOptions = {}
): BattlePokemon[] {
  const itemMode = options.itemMode ?? 'competitive';
  const maxGen = options.maxGen ?? null;
  return picks.map(species => {
    const set = pickSet(species, rng, itemMode);
    return createBattlePokemon(species, set, 100, maxGen);
  });
}
