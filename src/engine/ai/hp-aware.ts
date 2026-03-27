import type { BattlePokemon } from '../../types';
import type { Battle } from '../battle';
import type { MoveScore } from './types';

export function hpAwareScoring(
  scores: MoveScore[],
  pokemon: BattlePokemon,
  opponent: BattlePokemon,
  battle: Battle
): void {
  const myHpPct = pokemon.currentHp / pokemon.maxHp * 100;
  const theirHpPct = opponent.currentHp / opponent.maxHp * 100;

  for (const entry of scores) {
    if (entry.score <= 50) continue;
    const move = pokemon.moves[entry.moveIndex];
    const moveData = move.data;

    // === USER HP CHECKS ===
    if (myHpPct > 70) {
      if (moveData.selfdestruct) entry.score -= 2;
      if (isHealingMove(moveData)) entry.score -= 2;
      if (moveData.name === 'Destiny Bond') entry.score -= 2;
    } else if (myHpPct > 30) {
      if (isSetupMove(moveData)) entry.score -= 2;
    } else {
      if (isSetupMove(moveData)) entry.score -= 2;
      if (moveData.name === 'Destiny Bond') entry.score += 2;
      if (moveData.name === 'Endeavor') entry.score += 2;
    }

    // === TARGET HP CHECKS ===
    if (theirHpPct <= 30) {
      if (isSetupMove(moveData)) entry.score -= 2;
      if (moveData.status) entry.score -= 2;
      if (isHazardMove(moveData)) entry.score -= 2;
      if (moveData.status === 'toxic' || moveData.status === 'poison') entry.score -= 3;
    } else if (theirHpPct <= 70 && theirHpPct > 30) {
      if (isSetupMove(moveData)) entry.score -= 1;
    }
  }
}

function isHealingMove(move: { name: string; effects?: Array<{ type: string; target?: string }> }): boolean {
  return ['Recover', 'Roost', 'Soft-Boiled', 'Moonlight', 'Morning Sun',
          'Synthesis', 'Slack Off', 'Milk Drink', 'Rest', 'Shore Up',
          'Strength Sap'].includes(move.name)
    || !!move.effects?.some(e => e.type === 'heal' && e.target === 'self');
}

function isSetupMove(move: { selfBoosts?: Record<string, number> | null }): boolean {
  return !!move.selfBoosts && Object.values(move.selfBoosts).some(v => v > 0);
}

function isHazardMove(move: { name: string }): boolean {
  return ['Stealth Rock', 'Spikes', 'Toxic Spikes', 'Sticky Web'].includes(move.name);
}
