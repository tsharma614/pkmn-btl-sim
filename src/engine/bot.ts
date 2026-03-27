import { Battle } from './battle';
import { BattleAction } from '../types';
import { SeededRNG } from '../utils/rng';
import { chooseCpuAction, AITier } from './ai';

export { chooseCpuAction, AITier } from './ai';

export const BOT_NAMES = [
  'Jonathan', 'Nikhil', 'Trusha', 'Som', 'Meha', 'Ishan',
  'Vikram', 'Amit', 'Tejal', 'Akshay', 'Tanmay', 'Ambi',
];

export function pickCpuName(rng: SeededRNG, exclude?: string): string {
  const available = exclude ? BOT_NAMES.filter(n => n !== exclude) : BOT_NAMES;
  return rng.pick(available);
}

/** Backward-compat wrapper — uses SMART tier by default. */
export function chooseBotAction(
  battle: Battle,
  playerIndex: number,
  rng: SeededRNG
): BattleAction {
  return chooseCpuAction(battle, playerIndex, rng, AITier.SMART);
}
