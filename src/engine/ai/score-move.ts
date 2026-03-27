import type { Battle } from '../battle';
import type { BattlePokemon, PokemonType } from '../../types';
import type { SeededRNG } from '../../utils/rng';
import type { AIFlag as AIFlagType, MoveScore, ThreatAssessment } from './types';
import { AIFlag } from './types';
import { checkBadMove } from './check-bad-move';
import { tryToFaint } from './try-to-faint';
import { checkViability } from './check-viability';
import { setupFirstTurn } from './setup-logic';
import { hpAwareScoring } from './hp-aware';
import { getTypeEffectiveness } from '../../data/type-chart';
import { estimateDamage } from './threat-calc';

export function scoreMoves(
  battle: Battle,
  playerIndex: number,
  opponentIndex: number,
  availableMoves: number[],
  flags: number,
  rng: SeededRNG,
  threat: ThreatAssessment
): MoveScore[] {
  const pokemon = battle.getActivePokemon(playerIndex);
  const opponent = battle.getActivePokemon(opponentIndex);

  // Initialize all moves at score 100
  const scores: MoveScore[] = availableMoves.map(idx => {
    const move = pokemon.moves[idx];
    const effectiveness = move.data.category !== 'Status'
      ? getTypeEffectiveness(move.data.type as PokemonType, opponent.species.types as PokemonType[])
      : 1;
    const estDmg = move.data.category !== 'Status'
      ? estimateDamage(pokemon, opponent, move.data, battle)
      : 0;

    return {
      moveIndex: idx,
      score: 100,
      canKO: estDmg >= opponent.currentHp,
      effectiveness,
      estimatedDamage: estDmg,
      estimatedDamagePercent: opponent.maxHp > 0 ? (estDmg / opponent.maxHp * 100) : 0,
    };
  });

  // Run scoring scripts in order based on flags
  if (flags & AIFlag.CHECK_BAD_MOVE) {
    checkBadMove(scores, pokemon, opponent, battle);
  }
  if (flags & AIFlag.TRY_TO_FAINT) {
    tryToFaint(scores, pokemon, opponent, battle, threat);
  }
  if (flags & AIFlag.CHECK_VIABILITY) {
    checkViability(scores, pokemon, opponent, battle, threat, rng);
  }
  if (flags & AIFlag.SETUP_FIRST_TURN) {
    setupFirstTurn(scores, pokemon, opponent, battle, rng);
  }
  if (flags & AIFlag.HP_AWARE) {
    hpAwareScoring(scores, pokemon, opponent, battle);
  }

  // Add small random noise to prevent perfectly predictable play
  for (const entry of scores) {
    if (entry.score > 50) {
      entry.score += rng.int(-5, 5);
    }
  }

  return scores;
}
