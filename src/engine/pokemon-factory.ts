import { BattlePokemon, BattleMove, PokemonSpecies, PokemonSet, BoostableStat, Nature } from '../types';
import { calculateAllStats } from '../utils/stats';
import movesData from '../data/moves.json';

/**
 * Create a BattlePokemon from a species and set.
 */
export function createBattlePokemon(
  species: PokemonSpecies,
  set: PokemonSet,
  level: number = 100,
  maxGen?: number | null,
): BattlePokemon {
  const stats = calculateAllStats(
    species.baseStats,
    set.evs,
    set.nature as Nature,
    level
  );

  const moves: BattleMove[] = set.moves.slice(0, 4).map(moveName => {
    const moveId = toId(moveName);
    const moveData = (movesData as Record<string, any>)[moveId];
    if (!moveData) {
      // Fallback for unknown moves
      return {
        data: {
          name: moveName,
          type: 'Normal' as const,
          category: 'Physical' as const,
          power: 50,
          accuracy: 100,
          pp: 20,
          priority: 0,
          flags: {},
          effects: [],
          target: 'normal' as const,
        },
        currentPp: 20,
        maxPp: 20,
        disabled: false,
      };
    }

    const pp = moveData.pp;
    return {
      data: {
        name: moveData.name,
        type: moveData.type,
        category: moveData.category,
        power: moveData.power,
        accuracy: moveData.accuracy,
        pp: pp,
        priority: moveData.priority,
        flags: moveData.flags || {},
        effects: moveData.effects || [],
        target: moveData.target,
        description: moveData.description,
        selfSwitch: moveData.selfSwitch || false,
        forceSwitch: moveData.forceSwitch || false,
        critRatio: moveData.critRatio,
        willCrit: moveData.willCrit || false,
        volatileStatus: moveData.volatileStatus || null,
        selfdestruct: moveData.selfdestruct || false,
      },
      currentPp: pp,
      maxPp: pp,
      disabled: false,
    };
  });

  const pokemon: BattlePokemon = {
    species,
    level,
    set,
    stats,
    currentHp: stats.hp,
    maxHp: stats.hp,
    status: null,
    volatileStatuses: new Set(),
    boosts: {
      atk: 0, def: 0, spa: 0, spd: 0, spe: 0,
      accuracy: 0, evasion: 0,
    },
    moves,
    item: set.item,
    ability: set.ability,
    isAlive: true,
    toxicCounter: 0,
    sleepTurns: 0,
    confusionTurns: 0,
    substituteHp: 0,
    lastMoveUsed: null,
    choiceLocked: null,
    hasMovedThisTurn: false,
    tookDamageThisTurn: false,
    protectedLastTurn: false,
    timesHit: 0,
    lastDamageTaken: null,
    encoreTurns: 0,
    encoreMove: null,
    truantNextTurn: false,
    mustRecharge: false,
    turnsOnField: 0,
    itemConsumed: false,
    flashFireActive: false,
    battleStats: { kos: 0, damageDealt: 0, timesFainted: 0 },
  };

  return pokemon;
}

/**
 * Convert a name to a Showdown-style ID (lowercase, no special chars).
 */
export function toId(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '');
}
