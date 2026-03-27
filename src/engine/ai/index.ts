import { Battle } from '../battle';
import type { BattleAction } from '../../types';
import type { SeededRNG } from '../../utils/rng';
import { AITier, AI_TIER_FLAGS, AIFlag } from './types';
import { scoreMoves } from './score-move';
import { evaluateSwitching, pickBestSwitchIn } from './score-switch';
import { assessThreat } from './threat-calc';

export { AITier, AI_TIER_FLAGS, AIFlag } from './types';

export function chooseCpuAction(
  battle: Battle,
  playerIndex: number,
  rng: SeededRNG,
  tier: AITier = AITier.SMART
): BattleAction {
  const playerId = battle.state.players[playerIndex].id;
  const pokemon = battle.getActivePokemon(playerIndex);
  const opponentIndex = playerIndex === 0 ? 1 : 0;
  const flags = AI_TIER_FLAGS[tier];

  // Forced switch (fainted)
  if (!pokemon.isAlive) {
    return chooseForcedSwitch(battle, playerIndex, opponentIndex, rng, flags);
  }

  // Step 1: Assess the threat situation
  const threat = assessThreat(battle, playerIndex, opponentIndex);

  // Step 2: Score all available moves
  const availableMoves = battle.getAvailableMoves(playerIndex);

  // No moves available — must switch or Struggle
  if (availableMoves.length === 0) {
    const switches = battle.getAvailableSwitches(playerIndex);
    if (switches.length > 0) {
      const opponent = battle.getActivePokemon(opponentIndex);
      const best = pickBestSwitchIn(battle, playerIndex, switches, opponent);
      return { type: 'switch', playerId, pokemonIndex: best ?? rng.pick(switches) };
    }
    return { type: 'move', playerId, moveIndex: 0 }; // Struggle
  }

  const moveScores = scoreMoves(battle, playerIndex, opponentIndex, availableMoves, flags, rng, threat);

  // Step 3: Consider switching (before committing to a move)
  const shouldSwitch = evaluateSwitching(battle, playerIndex, opponentIndex, flags, rng, threat, moveScores);
  if (shouldSwitch !== null) {
    return { type: 'switch', playerId, pokemonIndex: shouldSwitch };
  }

  // Step 4: Pick the best move (ties broken randomly)
  const bestScore = Math.max(...moveScores.map(m => m.score));
  const bestMoves = moveScores.filter(m => m.score === bestScore);
  const chosen = rng.pick(bestMoves);

  return { type: 'move', playerId, moveIndex: chosen.moveIndex };
}

function chooseForcedSwitch(
  battle: Battle,
  playerIndex: number,
  opponentIndex: number,
  rng: SeededRNG,
  flags: number
): BattleAction {
  const playerId = battle.state.players[playerIndex].id;
  const opponent = battle.getActivePokemon(opponentIndex);
  const switches = battle.getAvailableSwitches(playerIndex);

  if (switches.length === 0) return { type: 'forfeit', playerId };
  if (switches.length === 1) return { type: 'switch', playerId, pokemonIndex: switches[0] };

  // BASIC tier: random
  if (!(flags & AIFlag.CHECK_VIABILITY)) {
    return { type: 'switch', playerId, pokemonIndex: rng.pick(switches) };
  }

  // SMART+ tier: pick best matchup
  const best = pickBestSwitchIn(battle, playerIndex, switches, opponent);
  return { type: 'switch', playerId, pokemonIndex: best ?? rng.pick(switches) };
}
