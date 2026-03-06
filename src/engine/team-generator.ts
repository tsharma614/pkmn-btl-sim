import { PokemonSpecies, PokemonSet, BattlePokemon, Tier, PokemonType, Nature } from '../types';
import { createBattlePokemon } from './pokemon-factory';
import { SeededRNG } from '../utils/rng';
import pokedexData from '../data/pokedex.json';

const pokedex = pokedexData as Record<string, PokemonSpecies>;

// Pokemon without animated sprites on Showdown CDN — exclude from generation
const NO_SPRITE: Set<string> = new Set([
  'ironleaves', 'okidogi', 'munkidori', 'fezandipiti',
  'ironboulder', 'ironcrown', 'terapagos', 'pecharunt',
]);

// Group Pokemon by tier, excluding those without sprites
const TIERS: Record<Tier, PokemonSpecies[]> = { 1: [], 2: [], 3: [], 4: [] };

for (const species of Object.values(pokedex)) {
  if (NO_SPRITE.has(species.id)) continue;
  const tier = species.tier as Tier;
  if (TIERS[tier]) {
    TIERS[tier].push(species);
  }
}

console.log(`Team generator loaded: T1=${TIERS[1].length}, T2=${TIERS[2].length}, T3=${TIERS[3].length}, T4=${TIERS[4].length}`);

interface TeamGeneratorOptions {
  itemMode: 'competitive' | 'casual';
  maxGen?: number | null;
  legendaryMode?: boolean;
}

/** Build filtered tier pools based on maxGen (null = no filter). */
function getFilteredTiers(maxGen: number | null): Record<Tier, PokemonSpecies[]> {
  if (!maxGen) return TIERS;
  const filtered: Record<Tier, PokemonSpecies[]> = { 1: [], 2: [], 3: [], 4: [] };
  for (const tier of [1, 2, 3, 4] as Tier[]) {
    filtered[tier] = TIERS[tier].filter(s => s.generation <= maxGen);
  }
  return filtered;
}

/**
 * Generate a balanced random team using the tiered draft system.
 * Distribution: 1 T1, 2 T2, 2 T3, 1 T4
 */
export function generateTeam(
  rng: SeededRNG,
  options: TeamGeneratorOptions = { itemMode: 'competitive' }
): BattlePokemon[] {
  const tiers = getFilteredTiers(options.maxGen ?? null);
  // Legendary Mode: mostly T1 (4 T1, 1 T2, 1 T3), dips into lower tiers if T1 pool is small
  const distribution: { tier: Tier; count: number }[] = options.legendaryMode
    ? [
        { tier: 1, count: Math.min(4, tiers[1].length) },
        { tier: 2, count: 1 },
        { tier: 3, count: 1 },
      ]
    : [
        { tier: 1, count: 1 },
        { tier: 2, count: 2 },
        { tier: 3, count: 2 },
        { tier: 4, count: 1 },
      ];

  // If legendary mode and T1 pool is small, fill remainder from T2
  if (options.legendaryMode) {
    const t1Count = distribution[0].count;
    if (t1Count < 4) {
      distribution[1].count += (4 - t1Count);
    }
  }

  let team: PokemonSpecies[] = [];
  let attempts = 0;
  const maxAttempts = 100;

  while (attempts < maxAttempts) {
    attempts++;
    team = [];

    for (const { tier, count } of distribution) {
      const pool = [...tiers[tier]];
      rng.shuffle(pool);

      let added = 0;
      for (const species of pool) {
        if (added >= count) break;
        if (team.some(t => t.id === species.id)) continue; // no duplicates
        team.push(species);
        added++;
      }
    }

    if (team.length === 6 && validateTeam(team, options.legendaryMode, options.maxGen)) {
      break;
    }
  }

  if (team.length !== 6) {
    // Fallback: just grab 6 random Pokemon
    const all = Object.values(pokedex);
    rng.shuffle(all);
    team = all.slice(0, 6);
  }

  // Build battle Pokemon from selected species
  const maxGen = options.maxGen ?? null;
  return team.map(species => {
    const set = pickSet(species, rng, options.itemMode);
    return createBattlePokemon(species, set, 100, maxGen);
  });
}

/** Get a canonical key for a Pokemon's type combination (sorted, joined). */
function typeKey(species: PokemonSpecies): string {
  return [...species.types].sort().join('/');
}

/**
 * Validate team constraints from the plan.
 */
function validateTeam(team: PokemonSpecies[], legendaryMode?: boolean, maxGen?: number | null): boolean {
  // No more than 2 of same type (3 in legendary mode since high-tier Pokemon overlap more)
  const maxTypeCount = legendaryMode ? 3 : 2;
  const typeCounts: Record<string, number> = {};
  for (const species of team) {
    const types = species.types;
    for (const type of types) {
      typeCounts[type] = (typeCounts[type] || 0) + 1;
      if (typeCounts[type] > maxTypeCount) return false;
    }
  }

  // No duplicate type combinations — two Pokemon with the exact same typing
  // (e.g. two pure Grass, or two Water/Ground) makes the team feel repetitive.
  // They must differ in at least one type.
  const typeKeyCounts: Record<string, number> = {};
  for (const species of team) {
    const key = typeKey(species);
    typeKeyCounts[key] = (typeKeyCounts[key] || 0) + 1;
    if (typeKeyCounts[key] > 1) return false;
  }

  // At least 1 physical attacker and 1 special attacker
  const hasPhysical = team.some(s => s.baseStats.atk >= s.baseStats.spa);
  const hasSpecial = team.some(s => s.baseStats.spa > s.baseStats.atk);
  if (!hasPhysical || !hasSpecial) return false;

  // At least 1 Pokemon with defensive bulk
  const hasBulk = team.some(s => {
    const physBulk = s.baseStats.hp + s.baseStats.def;
    const specBulk = s.baseStats.hp + s.baseStats.spd;
    return physBulk >= 180 || specBulk >= 180;
  });
  if (!hasBulk) return false;

  // Speed variety: not all fast, not all slow
  const speeds = team.map(s => s.baseStats.spe);
  const avgSpeed = speeds.reduce((a, b) => a + b, 0) / speeds.length;
  const hasFast = speeds.some(s => s >= 90);
  const hasSlow = speeds.some(s => s <= 60);
  if (!hasFast && avgSpeed > 85) return false;
  if (!hasSlow && avgSpeed < 50) return false;

  return true;
}

/**
 * Pick a competitive set for a Pokemon, choosing moves from the pool.
 */
export function pickSet(
  species: PokemonSpecies,
  rng: SeededRNG,
  itemMode: 'competitive' | 'casual'
): PokemonSet {
  const sets = species.sets || [];

  if (sets.length === 0) {
    return buildFallbackSet(species, rng);
  }

  // Exclude Tera moves — no Tera mechanic
  const EXCLUDED_MOVES = new Set(['Tera Blast', 'Tera Shift', 'Tera Starstorm']);

  // Shuffle sets and pick first one with 4+ usable moves; fall back to largest pool
  const shuffledSets = [...sets];
  rng.shuffle(shuffledSets);
  let baseSet = shuffledSets[0];
  let movePool = (baseSet.moves || []).filter(m => !EXCLUDED_MOVES.has(m));
  for (const s of shuffledSets) {
    const pool = (s.moves || []).filter(m => !EXCLUDED_MOVES.has(m));
    if (pool.length >= 4) {
      baseSet = s;
      movePool = pool;
      break;
    }
    if (pool.length > movePool.length) {
      baseSet = s;
      movePool = pool;
    }
  }
  rng.shuffle(movePool);

  // Ensure at least 2 attacking moves
  const attackingMoves = movePool.filter(m => {
    const moveData = getMoveData(m);
    return moveData && moveData.category !== 'Status';
  });
  const statusMoves = movePool.filter(m => {
    const moveData = getMoveData(m);
    return !moveData || moveData.category === 'Status';
  });

  let selectedMoves: string[] = [];

  // Pick 2 attacking moves first
  const shuffledAttacking = [...attackingMoves];
  rng.shuffle(shuffledAttacking);
  selectedMoves = shuffledAttacking.slice(0, Math.min(2, shuffledAttacking.length));

  // Fill remaining slots
  const remaining = [...statusMoves, ...shuffledAttacking.slice(selectedMoves.length)];
  rng.shuffle(remaining);
  for (const move of remaining) {
    if (selectedMoves.length >= 4) break;
    if (!selectedMoves.includes(move)) {
      selectedMoves.push(move);
    }
  }

  // If still not 4, pad from full movePool
  if (selectedMoves.length < 4) {
    for (const move of movePool) {
      if (selectedMoves.length >= 4) break;
      if (!selectedMoves.includes(move)) {
        selectedMoves.push(move);
      }
    }
  }

  // If STILL not 4, pull moves from other sets of the same species
  if (selectedMoves.length < 4) {
    for (const s of sets) {
      if (selectedMoves.length >= 4) break;
      for (const move of s.moves || []) {
        if (selectedMoves.length >= 4) break;
        if (!selectedMoves.includes(move) && !EXCLUDED_MOVES.has(move)) {
          selectedMoves.push(move);
        }
      }
    }
  }

  // If STILL not 4, pull from species movePool
  if (selectedMoves.length < 4 && species.movePool) {
    const poolMoves = species.movePool.filter(m => !EXCLUDED_MOVES.has(m) && !selectedMoves.includes(m));
    rng.shuffle(poolMoves);
    for (const move of poolMoves) {
      if (selectedMoves.length >= 4) break;
      selectedMoves.push(move);
    }
  }

  // Casual mode item swaps
  let item = baseSet.item || 'Leftovers';
  if (itemMode === 'casual') {
    if (item === 'Choice Band' || item === 'Choice Specs') {
      item = 'Life Orb';
    } else if (item === 'Choice Scarf') {
      item = 'Leftovers';
    }
  }

  // Truant + Choice items is a terrible combo — swap to Life Orb
  const ability = baseSet.ability || species.bestAbility;
  if (ability === 'Truant' && (item === 'Choice Band' || item === 'Choice Specs' || item === 'Choice Scarf')) {
    item = 'Life Orb';
  }

  return {
    moves: selectedMoves.slice(0, 4),
    ability: baseSet.ability || species.bestAbility,
    item,
    nature: (baseSet.nature || 'Adamant') as Nature,
    evs: baseSet.evs || { atk: 252, spe: 252, hp: 4 },
  };
}

function buildFallbackSet(species: PokemonSpecies, rng: SeededRNG): PokemonSet {
  const isPhysical = species.baseStats.atk >= species.baseStats.spa;

  // Try to pick some moves from the movePool
  const pool = [...(species.movePool || [])];
  rng.shuffle(pool);

  return {
    moves: pool.slice(0, 4),
    ability: species.bestAbility,
    item: 'Leftovers',
    nature: isPhysical ? 'Adamant' : 'Modest',
    evs: isPhysical ? { atk: 252, spe: 252, hp: 4 } : { spa: 252, spe: 252, hp: 4 },
  };
}

import movesJsonData from '../data/moves.json';
const movesLookup = movesJsonData as Record<string, any>;

function getMoveData(moveName: string): any | null {
  const id = moveName.toLowerCase().replace(/[^a-z0-9]/g, '');
  return movesLookup[id] || null;
}
