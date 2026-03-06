/**
 * Draft mode: pool generation, bot AI, and team builder.
 * Generates a balanced pool of 18 Pokemon for snake draft.
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

export interface DraftPoolOptions {
  maxGen?: number | null;
  legendaryMode?: boolean;
  itemMode?: 'competitive' | 'casual';
}

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

/** Validate a draft pool meets diversity constraints. */
function validatePool(pool: PokemonSpecies[]): boolean {
  // No type appears on more than 5 Pokemon
  const typeCounts: Record<string, number> = {};
  const allTypes = new Set<string>();
  for (const species of pool) {
    for (const type of species.types) {
      typeCounts[type] = (typeCounts[type] || 0) + 1;
      allTypes.add(type);
      if (typeCounts[type] > 5) return false;
    }
  }

  // At least 10 distinct types
  if (allTypes.size < 10) return false;

  // No duplicate type combos
  const typeKeys = new Set<string>();
  for (const species of pool) {
    const key = typeKey(species);
    if (typeKeys.has(key)) return false;
    typeKeys.add(key);
  }

  // At least 2 physical + 2 special attackers
  const physical = pool.filter(s => s.baseStats.atk >= s.baseStats.spa);
  const special = pool.filter(s => s.baseStats.spa > s.baseStats.atk);
  if (physical.length < 2 || special.length < 2) return false;

  return true;
}

/**
 * Generate a balanced draft pool of 21 Pokemon.
 * Pyramid tier distribution:
 *   Normal:    3 T1, 5 T2, 6 T3, 7 T4 (ascending — more commons)
 *   Legendary: 5 T1, 7 T2, 9 T3 (ascending — no T4, all strong Pokemon)
 * If a tier has fewer Pokemon than requested, overflow redistributes to other tiers.
 */
export function generateDraftPool(
  rng: SeededRNG,
  options: DraftPoolOptions = {}
): DraftPoolEntry[] {
  const maxGen = options.maxGen ?? null;
  const legendary = options.legendaryMode ?? false;
  const tiers = getFilteredTiers(maxGen);

  // Pyramid distributions — ascending counts per tier
  // Normal:    3/5/6/7 (fewer legendaries, plenty of commons)
  // Legendary: 5/7/9   (T1-T3 only, no T4 — all strong Pokemon)
  const ideal: { tier: Tier; count: number }[] = legendary
    ? [
        { tier: 1, count: 5 },
        { tier: 2, count: 7 },
        { tier: 3, count: 9 },
      ]
    : [
        { tier: 1, count: 3 },
        { tier: 2, count: 5 },
        { tier: 3, count: 6 },
        { tier: 4, count: 7 },
      ];

  // Dynamic adjustment: if any tier has fewer Pokemon than requested,
  // cap it and redistribute overflow to other tiers (prefer lower tiers)
  const distribution = ideal.map(d => ({ ...d }));
  let overflow = 0;
  for (const d of distribution) {
    const available = tiers[d.tier].length;
    if (available < d.count) {
      overflow += d.count - available;
      d.count = available;
    }
  }
  // Redistribute overflow to tiers that can absorb more, lower tiers first (4, 3, 2, 1)
  const redistributionOrder: Tier[] = [4, 3, 2, 1];
  while (overflow > 0) {
    let distributed = false;
    for (const tier of redistributionOrder) {
      const d = distribution.find(x => x.tier === tier)!;
      const available = tiers[d.tier].length;
      if (d.count < available) {
        const canAdd = Math.min(overflow, available - d.count);
        d.count += canAdd;
        overflow -= canAdd;
        distributed = true;
        if (overflow === 0) break;
      }
    }
    if (!distributed) break; // can't place any more
  }

  let pool: PokemonSpecies[] = [];
  let attempts = 0;
  const maxAttempts = 100;

  while (attempts < maxAttempts) {
    attempts++;
    pool = [];

    for (const { tier, count } of distribution) {
      const tierPool = [...tiers[tier]];
      rng.shuffle(tierPool);

      let added = 0;
      for (const species of tierPool) {
        if (added >= count) break;
        if (pool.some(p => p.id === species.id)) continue;
        pool.push(species);
        added++;
      }
    }

    if (pool.length === 21 && validatePool(pool)) {
      break;
    }
  }

  // Fallback: unvalidated pool
  if (pool.length !== 21) {
    pool = [];
    const all = Object.values(pokedex).filter(s => !NO_SPRITE.has(s.id));
    if (maxGen) {
      const filtered = all.filter(s => s.generation <= maxGen);
      rng.shuffle(filtered);
      pool = filtered.slice(0, 21);
    } else {
      rng.shuffle(all);
      pool = all.slice(0, 21);
    }
  }

  return pool.map(species => ({
    species,
    tier: species.tier,
  }));
}

/**
 * Bot draft AI: picks from the remaining pool.
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

  // Get opponent's types for offensive advantage calc
  const oppTypes: PokemonType[] = [];
  for (const idx of opponentPicks) {
    for (const t of pool[idx].species.types) {
      oppTypes.push(t as PokemonType);
    }
  }

  const scored = remaining.map(({ entry, index }) => {
    let score = 0;

    // Tier value: higher tier = more valuable
    const tierValue = { 1: 40, 2: 30, 3: 20, 4: 10 }[entry.tier] ?? 15;
    score += tierValue;

    // Type coverage bonus: new types are worth more
    let newTypes = 0;
    for (const t of entry.species.types) {
      if (!myTypes.has(t)) newTypes++;
    }
    score += newTypes * (difficulty === 'hard' ? 12 : 8);

    // Offensive advantage against opponent's picks
    if (difficulty === 'hard' && oppTypes.length > 0) {
      const speciesTypes = entry.species.types as PokemonType[];
      for (const myType of speciesTypes) {
        for (const oppType of oppTypes) {
          const eff = getTypeEffectiveness(myType, [oppType]);
          if (eff > 1) score += 3;
        }
      }
    }

    // Oversaturation penalty: penalize types we already have too many of
    for (const t of entry.species.types) {
      const count = myPicks.filter(idx =>
        (pool[idx].species.types as string[]).includes(t)
      ).length;
      if (count >= 2) score -= 8;
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
 * Convert drafted species into BattlePokemon[] for battle.
 */
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
