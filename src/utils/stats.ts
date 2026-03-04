import { BaseStats, Nature, StatName } from '../types';
import { getNatureMultiplier } from '../data/natures';

const DEFAULT_IV = 31;

/**
 * Calculate a single stat at a given level.
 * HP uses a different formula than other stats.
 * All IVs are 31 as per the project spec.
 */
export function calculateStat(
  base: number,
  ev: number,
  iv: number,
  level: number,
  nature: Nature,
  stat: StatName
): number {
  if (stat === 'hp') {
    // Shedinja special case
    if (base === 1) return 1;
    return Math.floor(((2 * base + iv + Math.floor(ev / 4)) * level) / 100) + level + 10;
  }
  const raw = Math.floor(((2 * base + iv + Math.floor(ev / 4)) * level) / 100) + 5;
  return Math.floor(raw * getNatureMultiplier(nature, stat));
}

/**
 * Calculate all stats for a Pokemon at the given level.
 */
export function calculateAllStats(
  baseStats: BaseStats,
  evs: Partial<BaseStats>,
  nature: Nature,
  level: number = 100
): BaseStats {
  const statNames: StatName[] = ['hp', 'atk', 'def', 'spa', 'spd', 'spe'];
  const result = {} as BaseStats;
  for (const stat of statNames) {
    result[stat] = calculateStat(
      baseStats[stat],
      evs[stat] || 0,
      DEFAULT_IV,
      level,
      nature,
      stat
    );
  }
  return result;
}

/**
 * Get the stat boost multiplier for a given stage (-6 to +6).
 */
export function getStatStageMultiplier(stage: number): number {
  const clamped = Math.max(-6, Math.min(6, stage));
  if (clamped >= 0) {
    return (2 + clamped) / 2;
  }
  return 2 / (2 - clamped);
}

/**
 * Get accuracy/evasion stage multiplier.
 */
export function getAccuracyStageMultiplier(stage: number): number {
  const clamped = Math.max(-6, Math.min(6, stage));
  if (clamped >= 0) {
    return (3 + clamped) / 3;
  }
  return 3 / (3 - clamped);
}

/**
 * Clamp HP to valid range
 */
export function clampHp(hp: number, maxHp: number): number {
  return Math.max(0, Math.min(maxHp, hp));
}
