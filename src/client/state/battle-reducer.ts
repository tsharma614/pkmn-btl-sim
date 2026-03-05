/**
 * useReducer state machine for the battle screen.
 * Phases: connecting → team_preview → battling ↔ waiting_for_turn → needs_switch → battle_end
 *
 * Key design: NEEDS_SWITCH and BATTLE_END are deferred into queued* fields
 * when events are still being animated. EVENTS_PROCESSED flushes them.
 */

import type {
  TeamPreviewPayload,
  BattleStartPayload,
  TurnResultPayload,
  NeedsSwitchPayload,
  BattleEndPayload,
  OwnPokemon,
} from '../../server/types';
import type { BattleEvent, Weather, SideEffects } from '../../types';

export type BattlePhase =
  | 'setup'
  | 'connecting'
  | 'online_lobby'
  | 'team_preview'
  | 'battling'
  | 'waiting_for_turn'
  | 'needs_switch'
  | 'battle_end'
  | 'disconnected';

export type GameMode = 'cpu' | 'online';

export interface BattleStats {
  playerDamageDealt: number;
  opponentDamageDealt: number;
  playerKOs: number;
  opponentKOs: number;
  biggestHitDealt: { pokemon: string; move: string; damage: number } | null;
  biggestHitTaken: { pokemon: string; move: string; damage: number } | null;
  /** Per-Pokemon damage dealt (by player's team) */
  pokemonDamage: Record<string, number>;
  pokemonKOs: Record<string, number>;
  playerCrits: number;
  opponentCrits: number;
  playerMisses: number;
  opponentMisses: number;
  playerMovesUsed: number;
  superEffectives: number;
  notVeryEffectives: number;
  statusesInflicted: number;
  playerSwitches: number;
  playerTotalHealing: number;
  protectsUsed: number;
  turnsPlayed: number;
}

export interface BattleState {
  phase: BattlePhase;
  /** Phase before disconnect, so we can restore it on reconnect */
  phaseBeforeDisconnect: BattlePhase | null;
  gameMode: GameMode;
  roomCode: string | null;
  botName: string | null;
  opponentName: string | null;
  playerName: string;
  itemMode: 'competitive' | 'casual';
  yourTeam: OwnPokemon[];
  yourPlayerIndex: 0 | 1;
  yourState: TurnResultPayload['yourState'] | null;
  opponentVisible: TurnResultPayload['opponentVisible'] | null;
  pendingEvents: BattleEvent[];
  weather: Weather;
  turn: number;
  availableSwitches: NeedsSwitchPayload['availableSwitches'];
  switchReason: 'faint' | 'self_switch';
  battleEndData: BattleEndPayload | null;
  actionView: 'moves' | 'switch';
  /** Queued payloads — applied after event animation finishes */
  queuedSwitch: NeedsSwitchPayload | null;
  queuedEnd: BattleEndPayload | null;
  /** Deferred state — applied after event animation so status badges don't jump ahead */
  queuedYourState: TurnResultPayload['yourState'] | null;
  queuedOpponentVisible: TurnResultPayload['opponentVisible'] | null;
  /** Events from a second turn_result that arrived while the first was still animating */
  queuedPendingEvents: BattleEvent[];
  /** Battle statistics accumulated across all turns */
  battleStats: BattleStats;
}

function emptyStats(): BattleStats {
  return {
    playerDamageDealt: 0,
    opponentDamageDealt: 0,
    playerKOs: 0,
    opponentKOs: 0,
    biggestHitDealt: null,
    biggestHitTaken: null,
    pokemonDamage: {},
    pokemonKOs: {},
    playerCrits: 0,
    opponentCrits: 0,
    playerMisses: 0,
    opponentMisses: 0,
    playerMovesUsed: 0,
    superEffectives: 0,
    notVeryEffectives: 0,
    statusesInflicted: 0,
    playerSwitches: 0,
    playerTotalHealing: 0,
    protectsUsed: 0,
    turnsPlayed: 0,
  };
}

export const initialState: BattleState = {
  phase: 'setup',
  phaseBeforeDisconnect: null,
  gameMode: 'cpu',
  roomCode: null,
  botName: null,
  opponentName: null,
  playerName: 'Player',
  itemMode: 'competitive',
  yourTeam: [],
  yourPlayerIndex: 0,
  yourState: null,
  opponentVisible: null,
  pendingEvents: [],
  weather: 'none',
  turn: 0,
  availableSwitches: [],
  switchReason: 'faint',
  battleEndData: null,
  actionView: 'moves',
  queuedSwitch: null,
  queuedEnd: null,
  queuedYourState: null,
  queuedOpponentVisible: null,
  queuedPendingEvents: [],
  battleStats: emptyStats(),
};

export type BattleAction =
  | { type: 'START_GAME'; playerName: string; itemMode: 'competitive' | 'casual' }
  | { type: 'START_ONLINE'; playerName: string; itemMode: 'competitive' | 'casual' }
  | { type: 'CONNECTED' }
  | { type: 'ROOM_CREATED'; code: string; botName: string }
  | { type: 'ONLINE_ROOM_CREATED'; code: string }
  | { type: 'OPPONENT_JOINED'; name?: string }
  | { type: 'TEAM_PREVIEW'; payload: TeamPreviewPayload }
  | { type: 'BATTLE_START'; payload: BattleStartPayload }
  | { type: 'BOT_LEAD_REVEALED'; lead: OwnPokemon; teamSize: number }
  | { type: 'TURN_RESULT'; payload: TurnResultPayload }
  | { type: 'NEEDS_SWITCH'; payload: NeedsSwitchPayload }
  | { type: 'BATTLE_END'; payload: BattleEndPayload }
  | { type: 'ACTION_SUBMITTED' }
  | { type: 'EVENTS_PROCESSED' }
  | { type: 'SET_ACTION_VIEW'; view: 'moves' | 'switch' }
  | { type: 'DISCONNECTED' }
  | { type: 'OPPONENT_DISCONNECTED' }
  | { type: 'RESET' };

const EMPTY_SIDE: SideEffects = {
  stealthRock: false,
  spikesLayers: 0,
  toxicSpikesLayers: 0,
  reflect: 0,
  lightScreen: 0,
  tailwind: 0,
};

/** Are events currently being animated? */
function hasActiveEvents(state: BattleState): boolean {
  return state.pendingEvents.length > 0;
}

/** Protect-class move names */
const PROTECT_MOVES = new Set(['Protect', 'Detect', 'Baneful Bunker', 'King\'s Shield', 'Spiky Shield', 'Obstruct', 'Silk Trap']);

/** Accumulate battle stats from a set of turn events. */
function accumulateStats(
  prev: BattleStats,
  events: BattleEvent[],
  playerTeamNames: Set<string>,
): BattleStats {
  const stats = { ...prev, pokemonDamage: { ...prev.pokemonDamage }, pokemonKOs: { ...prev.pokemonKOs } };
  let lastMoveUser: string | null = null;
  let lastMoveName: string | null = null;

  for (const event of events) {
    const d = event.data;
    switch (event.type) {
      case 'use_move': {
        lastMoveUser = d.pokemon as string;
        lastMoveName = d.move as string;
        if (playerTeamNames.has(lastMoveUser)) {
          stats.playerMovesUsed++;
          if (PROTECT_MOVES.has(lastMoveName)) {
            stats.protectsUsed++;
          }
        }
        break;
      }
      case 'damage': {
        const isPlayerAttacking = lastMoveUser !== null && playerTeamNames.has(lastMoveUser);
        const dmg = d.damage as number;
        const effectiveness = d.effectiveness as number | undefined;
        const isCritical = d.isCritical as boolean | undefined;
        if (isPlayerAttacking) {
          stats.playerDamageDealt += dmg;
          if (lastMoveUser) {
            stats.pokemonDamage[lastMoveUser] = (stats.pokemonDamage[lastMoveUser] || 0) + dmg;
          }
          if (!stats.biggestHitDealt || dmg > stats.biggestHitDealt.damage) {
            stats.biggestHitDealt = { pokemon: lastMoveUser!, move: lastMoveName || '?', damage: dmg };
          }
          if (isCritical) stats.playerCrits++;
          if (effectiveness !== undefined && effectiveness > 1) stats.superEffectives++;
          if (effectiveness !== undefined && effectiveness > 0 && effectiveness < 1) stats.notVeryEffectives++;
        } else {
          stats.opponentDamageDealt += dmg;
          if (!stats.biggestHitTaken || dmg > stats.biggestHitTaken.damage) {
            stats.biggestHitTaken = { pokemon: lastMoveUser || '?', move: lastMoveName || '?', damage: dmg };
          }
          if (isCritical) stats.opponentCrits++;
        }
        break;
      }
      case 'miss': {
        const missUser = d.pokemon as string;
        if (playerTeamNames.has(missUser)) {
          stats.playerMisses++;
        } else {
          stats.opponentMisses++;
        }
        break;
      }
      case 'status': {
        const statusTarget = d.pokemon as string;
        if (!playerTeamNames.has(statusTarget)) {
          stats.statusesInflicted++;
        }
        break;
      }
      case 'switch': {
        const switchPlayer = d.player as number;
        // Player index 0 = player's side when yourPlayerIndex is 0
        // We detect by checking if the "from" pokemon is on the player's team
        const fromName = d.from as string;
        if (playerTeamNames.has(fromName)) {
          stats.playerSwitches++;
        }
        break;
      }
      case 'drain':
      case 'heal':
      case 'ability_heal':
      case 'item_heal': {
        const healTarget = d.pokemon as string;
        const healAmount = (d.amount ?? d.healed ?? d.damage) as number | undefined;
        if (healTarget && playerTeamNames.has(healTarget) && healAmount && healAmount > 0) {
          stats.playerTotalHealing += healAmount;
        }
        break;
      }
      case 'faint': {
        const faintedName = d.pokemon as string;
        if (playerTeamNames.has(faintedName)) {
          stats.opponentKOs++; // opponent scored a KO on us
        } else {
          stats.playerKOs++; // we scored a KO
          // Credit the KO to the last attacker if it was ours
          if (lastMoveUser && playerTeamNames.has(lastMoveUser)) {
            stats.pokemonKOs[lastMoveUser] = (stats.pokemonKOs[lastMoveUser] || 0) + 1;
          }
        }
        break;
      }
    }
  }

  // Track turns from last event
  if (events.length > 0) {
    const lastTurn = events[events.length - 1].turn;
    if (lastTurn > stats.turnsPlayed) {
      stats.turnsPlayed = lastTurn;
    }
  }

  return stats;
}

export function battleReducer(state: BattleState, action: BattleAction): BattleState {
  switch (action.type) {
    case 'START_GAME':
      return {
        ...state,
        phase: 'connecting',
        gameMode: 'cpu',
        playerName: action.playerName,
        itemMode: action.itemMode,
      };

    case 'START_ONLINE':
      return {
        ...state,
        phase: 'connecting',
        gameMode: 'online',
        playerName: action.playerName,
        itemMode: action.itemMode,
      };

    case 'CONNECTED':
      return {
        ...state,
        phase: state.gameMode === 'online' ? 'online_lobby' : 'connecting',
      };

    case 'ROOM_CREATED':
      return { ...state, roomCode: action.code, botName: action.botName };

    case 'ONLINE_ROOM_CREATED':
      return { ...state, roomCode: action.code, phase: 'online_lobby' };

    case 'OPPONENT_JOINED':
      if (action.name && state.gameMode === 'online') {
        return { ...state, opponentName: action.name };
      }
      return state;

    case 'TEAM_PREVIEW':
      return {
        ...state,
        phase: 'team_preview',
        yourTeam: action.payload.yourTeam,
        yourPlayerIndex: action.payload.yourPlayerIndex,
      };

    case 'BATTLE_START': {
      const newState: BattleState = {
        ...state,
        phase: 'battling',
        yourTeam: action.payload.yourTeam,
        yourPlayerIndex: action.payload.yourPlayerIndex,
        yourState: {
          team: action.payload.yourTeam,
          activePokemonIndex: 0,
          sideEffects: { ...EMPTY_SIDE },
        },
        turn: 1,
      };
      // For online mode, populate opponent lead from payload
      if (action.payload.opponentLead) {
        newState.opponentVisible = {
          activePokemon: action.payload.opponentLead,
          scoutedPokemon: [],
          teamSize: 6,
          faintedCount: 0,
          sideEffects: { ...EMPTY_SIDE },
        };
        if (action.payload.opponentName) {
          newState.opponentName = action.payload.opponentName;
        }
      }
      return newState;
    }

    case 'BOT_LEAD_REVEALED': {
      const lead = action.lead;
      return {
        ...state,
        opponentVisible: {
          activePokemon: {
            species: lead.species,
            level: lead.level,
            currentHp: lead.currentHp,
            maxHp: lead.maxHp,
            status: null,
            volatileStatuses: [],
            boosts: lead.boosts,
            isAlive: true,
            ability: lead.ability,
          },
          scoutedPokemon: [],
          teamSize: action.teamSize,
          faintedCount: 0,
          sideEffects: { ...EMPTY_SIDE },
        },
      };
    }

    case 'ACTION_SUBMITTED':
      return { ...state, phase: 'waiting_for_turn' };

    case 'TURN_RESULT': {
      const hasEvents = action.payload.events.length > 0;
      const currentlyAnimating = state.pendingEvents.length > 0;

      // Accumulate battle stats from events
      const playerNames = new Set(
        (state.yourState?.team || state.yourTeam).map(p => p.species.name)
      );
      const updatedStats = hasEvents
        ? accumulateStats(state.battleStats, action.payload.events, playerNames)
        : state.battleStats;

      // If currently animating, DON'T replace pendingEvents — queue the new ones
      if (currentlyAnimating) {
        return {
          ...state,
          phaseBeforeDisconnect: null,
          // Append new events to the queue (or leave empty if no events)
          queuedPendingEvents: hasEvents
            ? [...state.queuedPendingEvents, ...action.payload.events]
            : state.queuedPendingEvents,
          // Always update the deferred final state
          queuedYourState: action.payload.yourState,
          queuedOpponentVisible: action.payload.opponentVisible,
          weather: action.payload.weather,
          turn: action.payload.turn,
          battleStats: updatedStats,
        };
      }

      return {
        ...state,
        phase: 'battling',
        phaseBeforeDisconnect: null,
        yourState: hasEvents ? state.yourState : action.payload.yourState,
        opponentVisible: hasEvents ? state.opponentVisible : action.payload.opponentVisible,
        queuedYourState: hasEvents ? action.payload.yourState : null,
        queuedOpponentVisible: hasEvents ? action.payload.opponentVisible : null,
        pendingEvents: action.payload.events,
        weather: action.payload.weather,
        turn: action.payload.turn,
        actionView: 'moves',
        queuedSwitch: null,
        queuedEnd: null,
        battleStats: updatedStats,
      };
    }

    case 'NEEDS_SWITCH':
      // If events are still animating, queue it for later
      if (hasActiveEvents(state)) {
        return { ...state, queuedSwitch: action.payload };
      }
      return {
        ...state,
        phase: 'needs_switch',
        availableSwitches: action.payload.availableSwitches,
        switchReason: action.payload.reason || 'faint',
      };

    case 'BATTLE_END':
      // If events are still animating, queue it for later
      if (hasActiveEvents(state)) {
        return { ...state, queuedEnd: action.payload };
      }
      return {
        ...state,
        phase: 'battle_end',
        battleEndData: action.payload,
      };

    case 'EVENTS_PROCESSED': {
      let next: BattleState = { ...state, pendingEvents: [] };

      // If there are queued events from a second turn_result, animate those FIRST
      if (next.queuedPendingEvents.length > 0) {
        return {
          ...next,
          pendingEvents: next.queuedPendingEvents,
          queuedPendingEvents: [],
          // DON'T flush queuedYourState/queuedOpponentVisible yet —
          // wait until ALL event batches are done
        };
      }

      // All event batches done — apply deferred state
      if (next.queuedYourState) {
        next = { ...next, yourState: next.queuedYourState, queuedYourState: null };
      }
      if (next.queuedOpponentVisible) {
        next = { ...next, opponentVisible: next.queuedOpponentVisible, queuedOpponentVisible: null };
      }

      // Flush queued overlays now that animations are done
      if (next.queuedSwitch) {
        next = {
          ...next,
          phase: 'needs_switch',
          availableSwitches: next.queuedSwitch.availableSwitches,
          switchReason: next.queuedSwitch.reason || 'faint',
          queuedSwitch: null,
        };
      }
      if (next.queuedEnd) {
        next = {
          ...next,
          phase: 'battle_end',
          battleEndData: next.queuedEnd,
          queuedEnd: null,
        };
      }
      return next;
    }

    case 'SET_ACTION_VIEW':
      return { ...state, actionView: action.view };

    case 'DISCONNECTED':
      return {
        ...state,
        phase: 'disconnected',
        phaseBeforeDisconnect: state.phase,
      };

    case 'OPPONENT_DISCONNECTED':
      // In online mode, show disconnected. In CPU mode, ignore (bot reconnects).
      if (state.gameMode === 'online') {
        return {
          ...state,
          phase: 'disconnected',
          phaseBeforeDisconnect: state.phase,
        };
      }
      return state;

    case 'RESET':
      return {
        ...initialState,
        playerName: state.playerName,
        itemMode: state.itemMode,
        battleStats: emptyStats(),
      };

    default:
      return state;
  }
}
