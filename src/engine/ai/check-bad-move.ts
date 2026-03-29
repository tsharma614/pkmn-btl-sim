import type { Battle } from '../battle';
import type { BattlePokemon, PokemonType } from '../../types';
import { getTypeEffectiveness } from '../../data/type-chart';
import type { MoveScore } from './types';

const SCORE_ELIMINATE = -10;
const SCORE_STRONG_DISCOURAGE = -8;
const SCORE_MODERATE_DISCOURAGE = -5;

export function checkBadMove(
  scores: MoveScore[],
  pokemon: BattlePokemon,
  opponent: BattlePokemon,
  battle: Battle
): void {
  for (const entry of scores) {
    const move = pokemon.moves[entry.moveIndex];
    const moveData = move.data;

    // === TYPE IMMUNITY ===
    if (moveData.category !== 'Status') {
      const eff = getTypeEffectiveness(moveData.type as PokemonType, opponent.species.types as PokemonType[]);
      if (eff === 0) {
        entry.score += SCORE_ELIMINATE;
        continue;
      }
    }

    // === ABILITY IMMUNITY ===
    if (moveData.type === 'Electric' && ['Volt Absorb', 'Lightning Rod', 'Motor Drive'].includes(opponent.ability)) {
      entry.score += SCORE_ELIMINATE - 2;
      continue;
    }
    if (moveData.type === 'Water' && ['Water Absorb', 'Storm Drain', 'Dry Skin'].includes(opponent.ability)) {
      entry.score += SCORE_ELIMINATE - 2;
      continue;
    }
    if (moveData.type === 'Fire' && opponent.ability === 'Flash Fire') {
      entry.score += SCORE_ELIMINATE - 2;
      continue;
    }
    if (moveData.type === 'Ground' && opponent.ability === 'Levitate') {
      entry.score += SCORE_ELIMINATE;
      continue;
    }
    if (moveData.type === 'Grass' && opponent.ability === 'Sap Sipper') {
      entry.score += SCORE_ELIMINATE - 2;
      continue;
    }
    // Wonder Guard: only SE moves work
    if (opponent.ability === 'Wonder Guard' && entry.effectiveness <= 1) {
      entry.score += SCORE_ELIMINATE;
      continue;
    }
    // Sound moves on Soundproof
    if (moveData.flags?.sound && opponent.ability === 'Soundproof') {
      entry.score += SCORE_ELIMINATE;
      continue;
    }
    // Bullet moves on Bulletproof
    if (moveData.flags?.bullet && opponent.ability === 'Bulletproof') {
      entry.score += SCORE_ELIMINATE;
      continue;
    }

    // === STATUS MOVE CHECKS ===
    if (moveData.status && opponent.status) {
      entry.score += SCORE_ELIMINATE;
      continue;
    }
    if (moveData.status === 'sleep' && ['Insomnia', 'Vital Spirit'].includes(opponent.ability)) {
      entry.score += SCORE_ELIMINATE;
      continue;
    }
    if ((moveData.status === 'poison' || moveData.status === 'toxic') &&
        (opponent.species.types.includes('Steel' as PokemonType) || opponent.species.types.includes('Poison' as PokemonType))) {
      entry.score += SCORE_ELIMINATE;
      continue;
    }
    if (moveData.status === 'paralysis' && opponent.species.types.includes('Electric' as PokemonType)) {
      entry.score += SCORE_ELIMINATE;
      continue;
    }
    if (moveData.status === 'burn' && opponent.species.types.includes('Fire' as PokemonType)) {
      entry.score += SCORE_ELIMINATE;
      continue;
    }
    // Thunder Wave on Ground types
    if (moveData.name === 'Thunder Wave' && opponent.species.types.includes('Ground' as PokemonType)) {
      entry.score += SCORE_ELIMINATE;
      continue;
    }
    // Grass powder moves on Grass types
    if (['Sleep Powder', 'Stun Spore', 'Spore'].includes(moveData.name) &&
        opponent.species.types.includes('Grass' as PokemonType)) {
      entry.score += SCORE_ELIMINATE;
      continue;
    }
    // Confusion on already confused
    if (moveData.volatileStatus === 'confusion' && opponent.volatileStatuses.has('confusion')) {
      entry.score += SCORE_MODERATE_DISCOURAGE;
    }
    // Own Tempo blocks confusion
    if (moveData.volatileStatus === 'confusion' && opponent.ability === 'Own Tempo') {
      entry.score += SCORE_ELIMINATE;
    }

    // === STAT BOOST CHECKS ===
    if (moveData.selfBoosts) {
      const allMaxed = Object.entries(moveData.selfBoosts).every(([stat, stages]) => {
        const currentBoost = pokemon.boosts[stat as keyof typeof pokemon.boosts] ?? 0;
        return (stages as number) > 0 && currentBoost >= 6;
      });
      if (allMaxed) entry.score += SCORE_ELIMINATE;
    }
    if (moveData.boosts) {
      const allMinned = Object.entries(moveData.boosts).every(([stat, stages]) => {
        const currentBoost = opponent.boosts[stat as keyof typeof opponent.boosts] ?? 0;
        return (stages as number) < 0 && currentBoost <= -6;
      });
      if (allMinned) entry.score += SCORE_ELIMINATE;
    }

    // === SELF-DESTRUCTING MOVES ===
    if (moveData.selfdestruct) {
      const aliveTeammates = countAliveTeammates(battle, playerIndexOf(battle, pokemon));
      if (aliveTeammates === 0) {
        const opponentAlive = countAliveTeammates(battle, playerIndexOf(battle, opponent));
        if (opponentAlive > 0) entry.score += SCORE_ELIMINATE;
      }
      // Never Explosion on turn 1
      if (battle.state.turn <= 1) entry.score += SCORE_ELIMINATE;
    }

    // === SCREENS already active ===
    if (moveData.name === 'Reflect' || moveData.name === 'Light Screen' || moveData.name === 'Aurora Veil') {
      const pIdx = playerIndexOf(battle, pokemon);
      const sideKey = pIdx === 0 ? 'player1Side' : 'player2Side';
      const side = battle.state.fieldEffects[sideKey];
      if (moveData.name === 'Reflect' && side.reflect > 0) entry.score += SCORE_STRONG_DISCOURAGE;
      if (moveData.name === 'Light Screen' && side.lightScreen > 0) entry.score += SCORE_STRONG_DISCOURAGE;
      if (moveData.name === 'Aurora Veil' && side.auroraVeil > 0) entry.score += SCORE_STRONG_DISCOURAGE;
    }

    // === HAZARDS already set ===
    if (moveData.name === 'Stealth Rock' || moveData.name === 'Spikes' || moveData.name === 'Toxic Spikes' || moveData.name === 'Sticky Web') {
      const oppIdx = playerIndexOf(battle, opponent);
      const sideKey = oppIdx === 0 ? 'player1Side' : 'player2Side';
      const side = battle.state.fieldEffects[sideKey];
      if (moveData.name === 'Stealth Rock' && side.stealthRock) entry.score += SCORE_STRONG_DISCOURAGE;
      if (moveData.name === 'Spikes' && side.spikesLayers >= 3) entry.score += SCORE_STRONG_DISCOURAGE;
      if (moveData.name === 'Toxic Spikes' && side.toxicSpikesLayers >= 2) entry.score += SCORE_STRONG_DISCOURAGE;
      if (moveData.name === 'Sticky Web' && side.stickyWeb) entry.score += SCORE_STRONG_DISCOURAGE;
    }

    // === SUBSTITUTE ===
    if (moveData.volatileStatus === 'substitute') {
      if (pokemon.volatileStatuses.has('substitute')) entry.score += SCORE_STRONG_DISCOURAGE;
      if (pokemon.currentHp < pokemon.maxHp * 0.26) entry.score += SCORE_ELIMINATE;
    }

    // === DREAM EATER ===
    if (moveData.name === 'Dream Eater' && opponent.status !== 'sleep') {
      entry.score += SCORE_STRONG_DISCOURAGE;
    }

    // === ROAR/WHIRLWIND on last Pokemon ===
    if (moveData.forceSwitch) {
      const opponentAlive = countAliveTeammates(battle, playerIndexOf(battle, opponent));
      if (opponentAlive === 0) entry.score += SCORE_ELIMINATE;
    }

    // === PROTECT spam prevention (BUG 3 FIX: never use Protect two turns in a row) ===
    const PROTECT_MOVES = ['Protect', 'Detect', 'Baneful Bunker', 'Spiky Shield', 'King\'s Shield', 'Obstruct', 'Silk Trap'];
    if (PROTECT_MOVES.includes(moveData.name) &&
        (pokemon.protectedLastTurn || (pokemon.lastMoveUsed && PROTECT_MOVES.includes(pokemon.lastMoveUsed)))) {
      entry.score += SCORE_ELIMINATE * 2; // -20: hard eliminate, never pick consecutive protect
    }
  }
}

function playerIndexOf(battle: Battle, pokemon: BattlePokemon): number {
  return battle.state.players[0].team.includes(pokemon) ? 0 : 1;
}

export function countAliveTeammates(battle: Battle, playerIndex: number): number {
  const player = battle.state.players[playerIndex];
  return player.team.filter((p, i) =>
    i !== player.activePokemonIndex && p.isAlive
  ).length;
}
