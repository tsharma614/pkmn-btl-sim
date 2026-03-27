import type { BattlePokemon } from '../../types';
import type { Battle } from '../battle';
import type { MoveScore, ThreatAssessment } from './types';

export function tryToFaint(
  scores: MoveScore[],
  pokemon: BattlePokemon,
  opponent: BattlePokemon,
  battle: Battle,
  threat: ThreatAssessment
): void {
  const koMoves = scores.filter(s => s.canKO && s.score > 50);

  if (koMoves.length > 0) {
    for (const entry of scores) {
      if (entry.canKO && entry.score > 50) {
        entry.score += 4;

        // Bonus for priority moves when we can KO
        const move = pokemon.moves[entry.moveIndex];
        if (move.data.priority > 0) entry.score += 2;
      } else if (!entry.canKO && entry.score > 50) {
        entry.score -= 1;
      }
    }

    // Among KO moves, prefer the one with best effectiveness
    const bestKOEff = Math.max(...koMoves.map(m => m.effectiveness));
    for (const entry of koMoves) {
      if (entry.effectiveness >= 4 && entry.effectiveness === bestKOEff) {
        entry.score += 2;
      }
    }
  }

  // If no move can KO, prefer the strongest damage dealer
  if (koMoves.length === 0) {
    const attacking = scores.filter(s =>
      pokemon.moves[s.moveIndex].data.category !== 'Status' && s.score > 50
    );
    if (attacking.length > 0) {
      const maxDmg = Math.max(...attacking.map(s => s.estimatedDamage));
      for (const entry of attacking) {
        if (entry.estimatedDamage < maxDmg) {
          entry.score -= 1;
        }
      }
    }
  }
}
