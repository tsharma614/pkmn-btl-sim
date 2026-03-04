import { Battle } from './battle';
import { BattleAction, MoveAction, SwitchAction, BattlePokemon } from '../types';
import { SeededRNG } from '../utils/rng';
import { getTypeEffectiveness } from '../data/type-chart';
import type { PokemonType } from '../types';

const CPU_NAMES = [
  'Jonathan', 'Nikhil', 'Trusha', 'Som', 'Meha', 'Ishan',
  'Vikram', 'Amit', 'Tejal', 'Akshay', 'Tanmay', 'Ambi',
];

export function pickCpuName(rng: SeededRNG, exclude?: string): string {
  const available = exclude ? CPU_NAMES.filter(n => n !== exclude) : CPU_NAMES;
  return rng.pick(available);
}

/**
 * Simple bot AI that picks moves based on damage potential and type matchups.
 * Not super smart — just enough to test battles properly.
 */
export function chooseBotAction(
  battle: Battle,
  playerIndex: number,
  rng: SeededRNG
): BattleAction {
  const playerId = battle.state.players[playerIndex].id;
  const pokemon = battle.getActivePokemon(playerIndex);
  const opponentIndex = playerIndex === 0 ? 1 : 0;
  const opponent = battle.getActivePokemon(opponentIndex);

  // If current Pokemon is fainted, must switch
  if (!pokemon.isAlive) {
    const switches = battle.getAvailableSwitches(playerIndex);
    if (switches.length === 0) return { type: 'forfeit', playerId };
    return { type: 'switch', playerId, pokemonIndex: rng.pick(switches) };
  }

  // Get available moves
  const availableMoves = battle.getAvailableMoves(playerIndex);

  // 20% chance to switch (if good options available)
  if (rng.chance(20) && pokemon.currentHp > pokemon.maxHp * 0.3) {
    const switches = battle.getAvailableSwitches(playerIndex);
    if (switches.length > 0) {
      // Pick the best type matchup switch-in
      const bestSwitch = pickBestSwitch(battle, playerIndex, switches, opponent);
      if (bestSwitch !== null) {
        return { type: 'switch', playerId, pokemonIndex: bestSwitch };
      }
    }
  }

  // If low HP and can switch, consider switching
  if (pokemon.currentHp < pokemon.maxHp * 0.25) {
    const switches = battle.getAvailableSwitches(playerIndex);
    if (switches.length > 0 && rng.chance(50)) {
      const bestSwitch = pickBestSwitch(battle, playerIndex, switches, opponent);
      if (bestSwitch !== null) {
        return { type: 'switch', playerId, pokemonIndex: bestSwitch };
      }
    }
  }

  // Pick the best move
  if (availableMoves.length === 0) {
    // No moves available, will use Struggle
    return { type: 'move', playerId, moveIndex: 0 };
  }

  const bestMove = pickBestMove(pokemon, opponent, availableMoves, rng);
  return { type: 'move', playerId, moveIndex: bestMove };
}

function pickBestMove(
  pokemon: BattlePokemon,
  opponent: BattlePokemon,
  availableMoves: number[],
  rng: SeededRNG
): number {
  // Score each move
  const scored = availableMoves.map(idx => {
    const move = pokemon.moves[idx];
    let score = 0;

    if (move.data.category === 'Status') {
      // Status moves get a base score of 30
      score = 30;
      // Boost moves if not at max
      if (move.data.effects?.some(e => e.type === 'boost' && e.target === 'self')) {
        score = 40;
      }
    } else {
      // Attacking moves: base power * STAB * effectiveness
      const power = move.data.power || 0;
      const stab = pokemon.species.types.includes(move.data.type as PokemonType) ? 1.5 : 1;
      const effectiveness = getTypeEffectiveness(
        move.data.type as PokemonType,
        opponent.species.types as PokemonType[]
      );

      score = power * stab * effectiveness;

      // Bonus for super effective
      if (effectiveness > 1) score *= 1.2;
      // Penalty for not very effective
      if (effectiveness < 1) score *= 0.8;
    }

    return { index: idx, score };
  });

  // Sort by score (descending)
  scored.sort((a, b) => b.score - a.score);

  // Usually pick the best, but sometimes pick randomly for variety
  if (rng.chance(15)) {
    return rng.pick(scored).index;
  }

  return scored[0].index;
}

function pickBestSwitch(
  battle: Battle,
  playerIndex: number,
  switches: number[],
  opponent: BattlePokemon
): number | null {
  const player = battle.state.players[playerIndex];

  const scored = switches.map(idx => {
    const switchIn = player.team[idx];
    let score = 0;

    // Favor type advantage
    for (const type of switchIn.species.types) {
      const eff = getTypeEffectiveness(type as PokemonType, opponent.species.types as PokemonType[]);
      if (eff > 1) score += 50;
    }

    // Favor resistances to opponent
    for (const oppType of opponent.species.types) {
      const eff = getTypeEffectiveness(oppType as PokemonType, switchIn.species.types as PokemonType[]);
      if (eff < 1) score += 30;
      if (eff === 0) score += 60;
    }

    // Favor higher HP
    score += (switchIn.currentHp / switchIn.maxHp) * 20;

    return { index: idx, score };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored[0]?.index ?? null;
}
