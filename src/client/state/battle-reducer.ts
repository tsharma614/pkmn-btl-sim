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
import type { DraftPoolEntry, DraftRole } from '../../engine/draft-pool';
import type { DraftType } from '../../engine/draft-pool';
import { SNAKE_ORDER, DRAFT_ROLES } from '../../engine/draft-pool';

export type BattlePhase =
  | 'setup'
  | 'connecting'
  | 'online_lobby'
  | 'drafting'
  | 'team_preview'
  | 'battling'
  | 'waiting_for_turn'
  | 'needs_switch'
  | 'battle_end'
  | 'disconnected'
  | 'move_selection'
  | 'elite_four_draft'
  | 'elite_four_intro';

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
  /** Human-readable battle log lines for sharing */
  battleLog: string[];
  /** True when socket is attempting to reconnect (shown as non-blocking banner) */
  isReconnecting: boolean;
  /** Team generation options (for online mode, host decides) */
  maxGen: number | null;
  legendaryMode: boolean;
  /** Room options received from server (for joining player to see host's settings) */
  roomOptions: { maxGen: number | null; legendaryMode: boolean } | null;
  /** Draft mode state */
  draftMode: boolean;
  draftType: DraftType;
  draftPool: DraftPoolEntry[];
  draftPicks: [number[], number[]];
  draftCurrentPick: number;
  draftCurrentPlayer: 0 | 1;
  draftRerolled: boolean;
  /** Role draft: which role round (0-5) we're on */
  roleRound: number;
  /** Role draft: the role order for this game */
  roleOrder: DraftRole[];
  /** CPU difficulty (for badge tracking) */
  difficulty: 'easy' | 'normal' | 'hard';
  /** Monotype filter used in this game (null if not monotype) */
  monotype: string | null;
  /** Whether move selection phase is enabled after draft */
  moveSelection: boolean;
  /** Elite Four challenge state (null if not in E4 mode) */
  eliteFourStage: number | null; // 0-3 = E4, 4 = Champion
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
  battleLog: [],
  isReconnecting: false,
  maxGen: null,
  legendaryMode: false,
  roomOptions: null,
  draftMode: false,
  draftType: 'snake' as DraftType,
  draftPool: [],
  draftPicks: [[], []],
  draftCurrentPick: 0,
  draftCurrentPlayer: 0,
  draftRerolled: false,
  roleRound: 0,
  roleOrder: [...DRAFT_ROLES],
  difficulty: 'normal',
  monotype: null,
  moveSelection: false,
  eliteFourStage: null,
};

export type BattleAction =
  | { type: 'START_GAME'; playerName: string; itemMode: 'competitive' | 'casual'; difficulty?: 'easy' | 'normal' | 'hard'; monotype?: string | null; legendaryMode?: boolean; eliteFourStage?: number | null; moveSelection?: boolean }
  | { type: 'START_ONLINE'; playerName: string; itemMode: 'competitive' | 'casual'; maxGen?: number | null; legendaryMode?: boolean; moveSelection?: boolean }
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
  | { type: 'RECONNECTING' }
  | { type: 'RECONNECTED' }
  | { type: 'OPPONENT_DISCONNECTED' }
  | { type: 'DRAFT_START'; pool: DraftPoolEntry[]; yourPlayerIndex: 0 | 1; draftType?: DraftType; roleOrder?: DraftRole[] }
  | { type: 'DRAFT_PICK'; playerIndex: 0 | 1; poolIndex: number }
  | { type: 'DRAFT_COMPLETE'; yourTeam: OwnPokemon[] }
  | { type: 'MOVE_SELECTION_COMPLETE'; yourTeam: OwnPokemon[] }
  | { type: 'E4_DRAFT_START'; pool: DraftPoolEntry[]; playerName: string }
  | { type: 'E4_ADVANCE'; stage: number; opponentName: string }
  | { type: 'RESET' };

const EMPTY_SIDE: SideEffects = {
  stealthRock: false,
  spikesLayers: 0,
  toxicSpikesLayers: 0,
  reflect: 0,
  lightScreen: 0,
  tailwind: 0,
  stickyWeb: false,
  auroraVeil: 0,
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
  yourPlayerIndex: 0 | 1 = 0,
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
        // Use player index from event when available (avoids name collision when both teams share a species)
        const isPlayerMon = d.player !== undefined
          ? (d.player as number) === yourPlayerIndex
          : playerTeamNames.has(faintedName);
        if (isPlayerMon) {
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

/** Convert battle events into human-readable log lines for sharing */
function eventsToLogLines(events: BattleEvent[]): string[] {
  const lines: string[] = [];
  let currentTurn = -1;

  for (const event of events) {
    const d = event.data;
    if (event.turn !== currentTurn) {
      currentTurn = event.turn;
      if (currentTurn > 0) lines.push(`--- Turn ${currentTurn} ---`);
    }

    switch (event.type) {
      case 'use_move':
        lines.push(`${d.pokemon} used ${d.move}!`);
        break;
      case 'damage': {
        const parts: string[] = [];
        if ((d.effectiveness as number) > 1) parts.push('super effective');
        if ((d.effectiveness as number) > 0 && (d.effectiveness as number) < 1) parts.push('not very effective');
        if ((d.effectiveness as number) === 0) parts.push('immune');
        if (d.isCritical) parts.push('critical hit');
        const suffix = parts.length > 0 ? ` (${parts.join(', ')})` : '';
        lines.push(`  ${d.defender || d.target} took ${d.damage} damage${suffix} [${d.remainingHp}/${d.maxHp} HP]`);
        break;
      }
      case 'miss':
        lines.push(`  ${d.pokemon}'s ${d.move} missed!`);
        break;
      case 'immune':
        lines.push(`  It doesn't affect ${d.target}...`);
        break;
      case 'faint':
        lines.push(`  ${d.pokemon} fainted!`);
        break;
      case 'switch':
      case 'send_out':
        lines.push(`${d.player !== undefined ? '' : ''}${d.to || d.pokemon} was sent out!`);
        break;
      case 'status':
        lines.push(`  ${d.pokemon} was ${d.status === 'burn' ? 'burned' : d.status === 'poison' ? 'poisoned' : d.status === 'paralysis' ? 'paralyzed' : d.status === 'sleep' ? 'put to sleep' : d.status === 'freeze' ? 'frozen' : d.status === 'toxic' ? 'badly poisoned' : 'afflicted with ' + d.status}!`);
        break;
      case 'status_fail':
        if (d.reason === 'type_immunity' || d.reason === 'ability_immunity') {
          lines.push(`  It doesn't affect ${d.pokemon}...`);
        } else {
          lines.push(`  ${d.pokemon} is already statused!`);
        }
        break;
      case 'status_damage':
        lines.push(`  ${d.pokemon} took ${d.damage} damage from ${d.status}!`);
        break;
      case 'item_damage':
        lines.push(`  ${d.pokemon} lost ${d.damage} HP from ${d.item}!`);
        break;
      case 'item_heal':
        lines.push(`  ${d.pokemon} restored ${d.amount} HP with ${d.item}!`);
        break;
      case 'heal':
      case 'ability_heal':
        lines.push(`  ${d.pokemon} restored ${d.amount} HP!`);
        break;
      case 'boost': {
        const stageChange = (d.stages ?? d.amount) as number;
        const dir = stageChange > 0 ? 'rose' : 'fell';
        const absStages = Math.abs(stageChange);
        const intensity = absStages >= 3 ? ' drastically' : absStages === 2 ? ' sharply' : '';
        lines.push(`  ${d.pokemon}'s ${d.stat}${intensity} ${dir}!`);
        break;
      }
      case 'weather_set':
        lines.push(`  The weather changed to ${d.weather}!`);
        break;
      case 'weather_end':
        lines.push(`  The ${d.weather} subsided.`);
        break;
      case 'weather_damage':
        lines.push(`  ${d.pokemon} took ${d.damage} damage from ${d.weather}!`);
        break;
      case 'protect':
        lines.push(`  ${d.pokemon} protected itself!`);
        break;
      case 'protect_blocked':
        lines.push(`  ${d.target} protected itself from ${d.move}!`);
        break;
      case 'cant_move':
        lines.push(`  ${d.pokemon} can't move! (${d.reason})`);
        break;
      case 'recoil':
        lines.push(`  ${d.pokemon} took ${d.damage} recoil damage!`);
        break;
      case 'move_fail':
        lines.push(`  ${d.pokemon}'s ${d.move} failed! (${d.reason})`);
        break;
      case 'boost_steal':
        lines.push(`  ${d.attacker} stole ${d.defender}'s stat boosts!`);
        break;
      case 'hazard_set':
        lines.push(`  ${d.hazard} was set on ${d.side === 0 ? 'the near' : 'the far'} side!`);
        break;
      case 'hazard_damage':
        lines.push(`  ${d.pokemon} took ${d.damage} damage from ${d.hazard}!`);
        break;
      case 'leech_seed':
        lines.push(`  ${d.pokemon} had ${d.damage} HP drained by Leech Seed!`);
        break;
      case 'drain':
        lines.push(`  ${d.pokemon} drained ${d.amount} HP!`);
        break;
      case 'ability':
        lines.push(`  [${d.pokemon}'s ${d.ability}]`);
        break;
      // Skip purely visual events
      default:
        break;
    }
  }

  return lines;
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
        difficulty: action.difficulty ?? 'normal',
        monotype: action.monotype ?? null,
        legendaryMode: action.legendaryMode ?? false,
        moveSelection: action.moveSelection ?? false,
        eliteFourStage: action.eliteFourStage ?? null,
      };

    case 'START_ONLINE':
      return {
        ...state,
        phase: 'connecting',
        gameMode: 'online',
        playerName: action.playerName,
        itemMode: action.itemMode,
        maxGen: action.maxGen ?? null,
        legendaryMode: action.legendaryMode ?? false,
        moveSelection: action.moveSelection ?? false,
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
      // Don't override move_selection phase — defer until MOVE_SELECTION_COMPLETE
      if (state.phase === 'move_selection') return state;
      return {
        ...state,
        phase: 'team_preview',
        yourTeam: action.payload.yourTeam,
        yourPlayerIndex: action.payload.yourPlayerIndex,
        // Clear previous battle state so useEventQueue resets sprite overrides on rematch
        yourState: null,
        opponentVisible: null,
        pendingEvents: [],
        queuedPendingEvents: [],
        queuedYourState: null,
        queuedOpponentVisible: null,
        queuedSwitch: null,
        queuedEnd: null,
        battleEndData: null,
        weather: 'none',
        turn: 0,
        // battleStats intentionally preserved across rematches
      };

    case 'BATTLE_START': {
      // Build battle log header with team info
      const yourTeamNames = action.payload.yourTeam.map(p =>
        `${p.species.name} (${p.species.types.join('/')}${p.item ? ', ' + p.item : ''}, ${p.ability})`
      );
      const logHeader = [
        `=== PBS Battle Log ===`,
        `Date: ${new Date().toLocaleString()}`,
        `Player: ${state.playerName}`,
        `Opponent: ${state.opponentName || state.botName || 'Unknown'}`,
        ``,
        `Your Team:`,
        ...yourTeamNames.map((n, i) => `  ${i + 1}. ${n}`),
        ``,
      ];

      const newState: BattleState = {
        ...state,
        phase: 'battling',
        yourTeam: action.payload.yourTeam,
        yourPlayerIndex: action.payload.yourPlayerIndex,
        yourState: {
          team: action.payload.yourTeam,
          activePokemonIndex: action.payload.activePokemonIndex ?? 0,
          sideEffects: { ...EMPTY_SIDE },
        },
        turn: 1,
        battleLog: logHeader,
      };
      // Store room options from server (joining player sees host's settings)
      if (action.payload.roomOptions) {
        newState.roomOptions = action.payload.roomOptions;
      }
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

      console.log(`[reducer] TURN_RESULT — events: ${action.payload.events.length}, animating: ${currentlyAnimating}, oppActive: ${action.payload.opponentVisible.activePokemon?.species.name ?? 'NULL'}, eventTypes: [${action.payload.events.map(e => e.type).join(', ')}]`);

      // Accumulate battle stats from events
      const playerNames = new Set(
        (state.yourState?.team || state.yourTeam).map(p => p.species.name)
      );
      const updatedStats = hasEvents
        ? accumulateStats(state.battleStats, action.payload.events, playerNames, state.yourPlayerIndex)
        : state.battleStats;
      const updatedLog = hasEvents
        ? [...state.battleLog, ...eventsToLogLines(action.payload.events)]
        : state.battleLog;

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
          battleLog: updatedLog,
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
        battleLog: updatedLog,
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
        console.log(`[reducer] EVENTS_PROCESSED — flushing ${next.queuedPendingEvents.length} queued events, types: [${next.queuedPendingEvents.map(e => e.type).join(', ')}]`);
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
        console.log(`[reducer] EVENTS_PROCESSED — flushing queued opponent: ${next.queuedOpponentVisible.activePokemon?.species.name ?? 'NULL'}`);
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
        isReconnecting: false,
      };

    case 'RECONNECTING':
      return {
        ...state,
        isReconnecting: true,
      };

    case 'RECONNECTED':
      return {
        ...state,
        isReconnecting: false,
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

    case 'DRAFT_START': {
      const dt = action.draftType ?? 'snake';
      return {
        ...state,
        phase: 'drafting',
        draftMode: true,
        draftType: dt,
        draftPool: action.pool,
        draftPicks: [[], []],
        draftCurrentPick: 0,
        draftCurrentPlayer: SNAKE_ORDER[0],
        yourPlayerIndex: action.yourPlayerIndex,
        draftRerolled: state.phase === 'drafting',
        roleRound: 0,
        roleOrder: action.roleOrder ?? [...DRAFT_ROLES],
        // Clear previous battle state so useEventQueue resets sprite overrides on rematch
        yourState: null,
        opponentVisible: null,
        pendingEvents: [],
        queuedPendingEvents: [],
        queuedYourState: null,
        queuedOpponentVisible: null,
        queuedSwitch: null,
        queuedEnd: null,
        battleEndData: null,
        weather: 'none',
        turn: 0,
        // battleStats intentionally preserved across rematches
      };
    }

    case 'DRAFT_PICK': {
      const newPicks: [number[], number[]] = [
        [...state.draftPicks[0]],
        [...state.draftPicks[1]],
      ];
      newPicks[action.playerIndex].push(action.poolIndex);
      const nextPick = state.draftCurrentPick + 1;
      // Role round advances every 2 picks (both players picked from the role)
      const nextRoleRound = Math.floor(nextPick / 2);
      return {
        ...state,
        draftPicks: newPicks,
        draftCurrentPick: nextPick,
        draftCurrentPlayer: nextPick < SNAKE_ORDER.length ? SNAKE_ORDER[nextPick] : 0,
        roleRound: nextRoleRound,
      };
    }

    case 'DRAFT_COMPLETE':
      return {
        ...state,
        phase: state.moveSelection ? 'move_selection' : 'team_preview',
        yourTeam: action.yourTeam,
      };

    case 'MOVE_SELECTION_COMPLETE':
      return {
        ...state,
        phase: 'team_preview',
        yourTeam: action.yourTeam,
      };

    case 'E4_DRAFT_START':
      return {
        ...initialState,
        phase: 'elite_four_draft',
        gameMode: 'cpu',
        playerName: action.playerName,
        itemMode: 'competitive',
        difficulty: 'hard',
        draftPool: action.pool,
        eliteFourStage: 0,
        battleStats: emptyStats(),
      };

    case 'E4_ADVANCE':
      return {
        ...state,
        phase: 'elite_four_intro',
        eliteFourStage: action.stage,
        botName: action.opponentName,
        // Clear battle state for next fight
        yourState: null,
        opponentVisible: null,
        pendingEvents: [],
        queuedPendingEvents: [],
        queuedYourState: null,
        queuedOpponentVisible: null,
        queuedSwitch: null,
        queuedEnd: null,
        battleEndData: null,
        weather: 'none',
        turn: 0,
        battleStats: emptyStats(),
        battleLog: [],
      };

    case 'RESET':
      return {
        ...initialState,
        battleStats: emptyStats(),
      };

    default:
      return state;
  }
}
