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
}

/**
 * Generate a balanced random team using the tiered draft system.
 * Distribution: 1 T1, 2 T2, 2 T3, 1 T4
 */
export function generateTeam(
  rng: SeededRNG,
  options: TeamGeneratorOptions = { itemMode: 'competitive' }
): BattlePokemon[] {
  const distribution: { tier: Tier; count: number }[] = [
    { tier: 1, count: 1 },
    { tier: 2, count: 2 },
    { tier: 3, count: 2 },
    { tier: 4, count: 1 },
  ];

  let team: PokemonSpecies[] = [];
  let attempts = 0;
  const maxAttempts = 100;

  while (attempts < maxAttempts) {
    attempts++;
    team = [];

    for (const { tier, count } of distribution) {
      const pool = [...TIERS[tier]];
      rng.shuffle(pool);

      let added = 0;
      for (const species of pool) {
        if (added >= count) break;
        if (team.some(t => t.id === species.id)) continue; // no duplicates
        team.push(species);
        added++;
      }
    }

    if (team.length === 6 && validateTeam(team)) {
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
  return team.map(species => {
    const set = pickSet(species, rng, options.itemMode);
    return createBattlePokemon(species, set);
  });
}

/**
 * Validate team constraints from the plan.
 */
function validateTeam(team: PokemonSpecies[]): boolean {
  // No more than 2 Pokemon sharing a type
  const typeCounts: Record<string, number> = {};
  for (const species of team) {
    for (const type of species.types) {
      typeCounts[type] = (typeCounts[type] || 0) + 1;
      if (typeCounts[type] > 2) return false;
    }
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
function pickSet(
  species: PokemonSpecies,
  rng: SeededRNG,
  itemMode: 'competitive' | 'casual'
): PokemonSet {
  const sets = species.sets || [];

  if (sets.length === 0) {
    return buildFallbackSet(species, rng);
  }

  // Pick a random set from available ones
  const baseSet = rng.pick(sets);

  // Select 4 moves from the set's move pool
  const movePool = [...(baseSet.moves || [])];
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

  // Casual mode item swaps
  let item = baseSet.item || 'Leftovers';
  if (itemMode === 'casual') {
    if (item === 'Choice Band' || item === 'Choice Specs') {
      item = 'Life Orb';
    } else if (item === 'Choice Scarf') {
      item = 'Leftovers';
    }
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
