import type { BattlePokemon } from '../../types';
import type { Battle } from '../battle';
import type { SeededRNG } from '../../utils/rng';
import type { MoveScore } from './types';

export function setupFirstTurn(
  scores: MoveScore[],
  pokemon: BattlePokemon,
  opponent: BattlePokemon,
  battle: Battle,
  rng: SeededRNG
): void {
  if (battle.state.turn > 1) return;

  for (const entry of scores) {
    if (entry.score <= 50) continue;
    const move = pokemon.moves[entry.moveIndex];
    const moveData = move.data;

    const isSetup =
      isStatBoostMove(moveData) ||
      isScreenMove(moveData) ||
      isHazardMove(moveData) ||
      !!moveData.status ||
      moveData.name === 'Substitute' ||
      moveData.name === 'Leech Seed';

    if (isSetup && rng.chance(80)) {
      entry.score += 2;
    }
  }
}

function isStatBoostMove(move: { selfBoosts?: Record<string, number> | null; boosts?: Record<string, number> | null }): boolean {
  return (!!move.selfBoosts && Object.values(move.selfBoosts).some(v => v !== 0))
    || (!!move.boosts && Object.values(move.boosts).some(v => v !== 0));
}

function isScreenMove(move: { name: string }): boolean {
  return ['Reflect', 'Light Screen', 'Aurora Veil'].includes(move.name);
}

function isHazardMove(move: { name: string }): boolean {
  return ['Stealth Rock', 'Spikes', 'Toxic Spikes', 'Sticky Web'].includes(move.name);
}
