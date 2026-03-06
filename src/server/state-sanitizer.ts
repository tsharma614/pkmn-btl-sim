/**
 * State sanitizer: strips hidden opponent info before sending to clients.
 * Converts Sets to arrays. Removes movePool and sets from species payloads.
 */

import { BattlePokemon, Player, SideEffects } from '../types';
import { OwnPokemon, VisiblePokemon, TurnResultPayload, BattleStartPayload, NeedsSwitchPayload, BattleEndPayload } from './types';
import { Room } from './room';

/** Convert a BattlePokemon to the full info version sent to its owner. */
export function serializeOwnPokemon(pokemon: BattlePokemon): OwnPokemon {
  return {
    species: {
      id: pokemon.species.id,
      name: pokemon.species.name,
      types: [...pokemon.species.types],
      baseStats: { ...pokemon.species.baseStats },
    },
    level: pokemon.level,
    stats: { ...pokemon.stats },
    currentHp: pokemon.currentHp,
    maxHp: pokemon.maxHp,
    status: pokemon.status,
    volatileStatuses: Array.from(pokemon.volatileStatuses),
    boosts: { ...pokemon.boosts },
    moves: pokemon.moves.map(m => ({
      name: m.data.name,
      type: m.data.type,
      category: m.data.category,
      power: m.data.power,
      accuracy: m.data.accuracy,
      priority: m.data.priority,
      currentPp: m.currentPp,
      maxPp: m.maxPp,
      disabled: m.disabled,
      description: m.data.description || null,
    })),
    item: pokemon.item,
    ability: pokemon.ability,
    isAlive: pokemon.isAlive,
    choiceLocked: pokemon.choiceLocked,
  };
}

/** Convert a BattlePokemon to the limited info version visible to the opponent. */
export function serializeVisiblePokemon(pokemon: BattlePokemon): VisiblePokemon {
  return {
    species: {
      id: pokemon.species.id,
      name: pokemon.species.name,
      types: [...pokemon.species.types],
      baseStats: { ...pokemon.species.baseStats },
    },
    level: pokemon.level,
    currentHp: pokemon.currentHp,
    maxHp: pokemon.maxHp,
    status: pokemon.status,
    volatileStatuses: Array.from(pokemon.volatileStatuses),
    boosts: { ...pokemon.boosts },
    isAlive: pokemon.isAlive,
    ability: pokemon.ability,
  };
}

/** Build the battle_start payload for a specific player. */
export function buildBattleStartPayload(room: Room, playerIndex: 0 | 1): BattleStartPayload {
  const team = room.teams[playerIndex]!;
  const opponentIndex = (1 - playerIndex) as 0 | 1;
  const payload: BattleStartPayload = {
    yourTeam: team.map(serializeOwnPokemon),
    yourPlayerIndex: playerIndex,
    // The server swaps lead to index 0 in selectLead, so active is always 0 after swap
    activePokemonIndex: 0,
  };

  // If battle has started, include opponent's lead info
  if (room.battle) {
    const oppTeam = room.teams[opponentIndex]!;
    payload.opponentLead = serializeVisiblePokemon(oppTeam[0]);
    payload.opponentName = room.players[opponentIndex]?.name;
  }

  // Include room options so joining player can see settings
  payload.roomOptions = {
    maxGen: room.maxGen,
    legendaryMode: room.legendaryMode,
  };

  return payload;
}

/** Build the turn_result payload for a specific player. */
export function buildTurnResultPayload(
  room: Room,
  playerIndex: 0 | 1,
  events: import('../types').BattleEvent[]
): TurnResultPayload {
  const battle = room.battle!;
  const opponentIndex = (1 - playerIndex) as 0 | 1;
  const player = battle.state.players[playerIndex];
  const opponent = battle.state.players[opponentIndex];

  // Player's own state: full info
  const yourState = {
    team: player.team.map(serializeOwnPokemon),
    activePokemonIndex: player.activePokemonIndex,
    sideEffects: { ...battle.getSideEffects(playerIndex) },
  };

  // Opponent state: only scouted Pokemon are visible
  const scoutedIndices = room.scoutedPokemon[playerIndex];
  const activePokemon = opponent.team[opponent.activePokemonIndex];
  const scoutedPokemon: VisiblePokemon[] = [];
  for (const idx of scoutedIndices) {
    if (idx !== opponent.activePokemonIndex) {
      scoutedPokemon.push(serializeVisiblePokemon(opponent.team[idx]));
    }
  }

  const faintedCount = opponent.team.filter(p => !p.isAlive).length;

  const opponentVisible = {
    activePokemon: activePokemon.isAlive ? serializeVisiblePokemon(activePokemon) : null,
    scoutedPokemon,
    teamSize: opponent.team.length,
    faintedCount,
    sideEffects: { ...battle.getSideEffects(opponentIndex) },
  };

  return {
    events,
    yourState,
    opponentVisible,
    turn: battle.state.turn,
    weather: battle.state.weather,
  };
}

/** Build the needs_switch payload for a player. */
export function buildNeedsSwitchPayload(room: Room, playerIndex: 0 | 1): NeedsSwitchPayload {
  const battle = room.battle!;
  const availableIndices = battle.getAvailableSwitches(playerIndex);
  const player = battle.state.players[playerIndex];

  const isSelfSwitch = battle.needsSelfSwitch(playerIndex);
  return {
    availableSwitches: availableIndices.map(idx => ({
      index: idx,
      pokemon: serializeOwnPokemon(player.team[idx]),
    })),
    reason: isSelfSwitch ? 'self_switch' : 'faint',
  };
}

/** Build the battle_end payload for a specific player. */
export function buildBattleEndPayload(
  room: Room,
  playerIndex: 0 | 1,
  reason: string
): BattleEndPayload {
  const battle = room.battle!;
  const opponentIndex = (1 - playerIndex) as 0 | 1;
  const player = battle.state.players[playerIndex];
  const opponent = battle.state.players[opponentIndex];

  const winnerPlayerId = battle.state.winner;
  const winnerName = winnerPlayerId === 'p1'
    ? room.players[0]!.name
    : room.players[1]!.name;

  return {
    winner: winnerName,
    reason,
    finalState: {
      yourTeam: player.team.map(serializeOwnPokemon),
      opponentTeam: opponent.team.map(serializeOwnPokemon), // fully revealed on battle end
      turn: battle.state.turn,
      weather: battle.state.weather,
    },
  };
}
