import React, { createContext, useContext, useReducer, useRef, useCallback, useEffect } from 'react';
import { AppState } from 'react-native';
import { battleReducer, initialState } from './battle-reducer';
import type { BattleState, BattleAction } from './battle-reducer';
import {
  createOnlineConnection,
  submitAction as submitOnlineAction,
  submitLead as submitOnlineLead,
  submitForceSwitch as submitOnlineForceSwitch,
  submitDraftReroll,
  requestRematch,
} from '../socket';
import type { BattleConnection } from '../socket';
import { createLocalBattle } from '../local-battle';
import type { LocalBattle } from '../local-battle';
import { getServerUrl } from '../config';
import { generateDraftPool, buildTeamFromDraftPicks } from '../../engine/draft-pool';
import type { DraftPoolEntry } from '../../engine/draft-pool';
import { generateEliteFourCpuTeam, generateChampionCpuTeam, pickSet } from '../../engine/team-generator';
import { createBattlePokemon } from '../../engine/pokemon-factory';
import pokedexData from '../../data/pokedex.json';
import megaPokedexData from '../../data/mega-pokemon.json';
import type { PokemonSpecies } from '../../types';
import { getEliteFourMember, TOTAL_E4_STAGES } from '../../data/elite-four';
import { SeededRNG } from '../../utils/rng';
import { BattlePokemon } from '../../types';
import { serializeOwnPokemon } from '../../server/state-sanitizer';
import { saveEliteFourProgress, getEliteFourProgress } from '../utils/badge-tracker';

const SERVER_URL = getServerUrl();

// Build species lookup by ID for move selection (need full PokemonSpecies for pickSet/createBattlePokemon)
const fullSpeciesById: Record<string, PokemonSpecies> = {};
for (const entry of Object.values(pokedexData as Record<string, any>)) {
  fullSpeciesById[entry.id] = entry as PokemonSpecies;
}
for (const entry of Object.values(megaPokedexData as Record<string, any>)) {
  fullSpeciesById[entry.id] = entry as PokemonSpecies;
}

interface BattleContextValue {
  state: BattleState;
  dispatch: React.Dispatch<BattleAction>;
  startGame: (playerName: string, itemMode: 'competitive' | 'casual', maxGen?: number | null, difficulty?: 'easy' | 'normal' | 'hard', legendaryMode?: boolean, draftMode?: boolean, monotype?: string | null, draftType?: 'snake' | 'role', poolSize?: number, megaMode?: boolean, moveSelection?: boolean) => void;
  startOnline: (playerName: string, itemMode: 'competitive' | 'casual', maxGen?: number | null, legendaryMode?: boolean, draftMode?: boolean, monotype?: string | null, draftType?: 'snake' | 'role', megaMode?: boolean, moveSelection?: boolean) => void;
  createRoom: (playerName: string, itemMode: 'competitive' | 'casual', maxGen?: number | null, legendaryMode?: boolean, monotype?: string | null) => void;
  joinRoom: (playerName: string, itemMode: 'competitive' | 'casual', code: string) => void;
  selectLead: (index: number) => void;
  selectMove: (moveIndex: number) => void;
  selectSwitch: (pokemonIndex: number) => void;
  selectForceSwitch: (pokemonIndex: number) => void;
  submitDraftPick: (poolIndex: number) => void;
  rerollDraftPool: () => void;
  playAgain: () => void;
  requestRematchOnline: () => void;
  returnToMenu: () => void;
  moveSelectionComplete: (moveSelections: Record<number, string[]>) => void;
  startEliteFour: (playerName: string) => void;
  e4DraftComplete: (pickedIndices: number[], moveSelections: Record<number, string[]>) => void;
  advanceEliteFour: () => void;
  beginE4Battle: () => void;
}

const BattleContext = createContext<BattleContextValue | null>(null);

// Module-level refs survive hot reloads
let activeConnection: BattleConnection | null = null;
let activeLocalBattle: LocalBattle | null = null;

export function BattleProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(battleReducer, initialState);
  const connectionRef = useRef<BattleConnection | null>(activeConnection);
  const localBattleRef = useRef<LocalBattle | null>(activeLocalBattle);
  const mountedRef = useRef(false);
  const stateRef = useRef(state);
  stateRef.current = state;
  /** Guard against double-tap: set true on action submit, cleared when turn result arrives */
  const actionPendingRef = useRef(false);

  // Elite Four state preserved across battles
  const e4PlayerTeamRef = useRef<BattlePokemon[] | null>(null);
  const e4PlayerNameRef = useRef<string>('Player');

  const cleanupAll = useCallback(() => {
    if (activeConnection) {
      activeConnection.disconnect();
      activeConnection = null;
    }
    connectionRef.current = null;
    if (activeLocalBattle) {
      activeLocalBattle.disconnect();
      activeLocalBattle = null;
    }
    localBattleRef.current = null;
    actionPendingRef.current = false;
  }, []);

  // --- CPU mode: local battle (no server) ---

  const startGame = useCallback((playerName: string, itemMode: 'competitive' | 'casual', maxGen?: number | null, difficulty?: 'easy' | 'normal' | 'hard', legendaryMode?: boolean, draftMode?: boolean, monotype?: string | null, draftType?: 'snake' | 'role', poolSize?: number, megaMode?: boolean, moveSelection?: boolean) => {
    console.log(`[battle-context] startGame — draft: ${draftMode}, type: ${draftType}, legendary: ${legendaryMode}, maxGen: ${maxGen}, difficulty: ${difficulty}, monotype: ${monotype}, poolSize: ${poolSize}, mega: ${megaMode}, moveSelect: ${moveSelection}`);
    cleanupAll();
    dispatch({ type: 'RESET' });
    dispatch({ type: 'START_GAME', playerName, itemMode, difficulty, monotype, legendaryMode, moveSelection });

    // Skip 'connecting' phase — go directly to team preview
    dispatch({ type: 'CONNECTED' });

    const local = createLocalBattle({
      playerName,
      itemMode,
      maxGen: maxGen ?? null,
      difficulty: difficulty ?? 'normal',
      legendaryMode: legendaryMode ?? false,
      draftMode: draftMode ?? false,
      draftType: draftType ?? 'snake',
      monotype: monotype ?? null,
      poolSize: poolSize ?? 21,
      megaMode: megaMode ?? false,
      dispatch,
    });

    activeLocalBattle = local;
    localBattleRef.current = local;
    local.start();
  }, [cleanupAll]);

  // --- Online mode: socket connection ---

  const draftModeRef = useRef(false);
  const monotypeRef = useRef<string | null>(null);
  const draftTypeRef = useRef<'snake' | 'role'>('snake');
  const megaModeRef = useRef(false);

  const startOnlineCreate = useCallback((playerName: string, itemMode: 'competitive' | 'casual', maxGen?: number | null, legendaryMode?: boolean, dm?: boolean, mono?: string | null, dt?: 'snake' | 'role', mega?: boolean, moveSelect?: boolean) => {
    cleanupAll();
    draftModeRef.current = dm ?? false;
    monotypeRef.current = mono ?? null;
    draftTypeRef.current = dt ?? 'snake';
    megaModeRef.current = mega ?? false;
    dispatch({ type: 'RESET' });
    dispatch({ type: 'START_ONLINE', playerName, itemMode, maxGen, legendaryMode, moveSelection: moveSelect });
    const conn = createOnlineConnection(SERVER_URL, playerName, itemMode, dispatch, maxGen, legendaryMode);
    activeConnection = conn;
    connectionRef.current = conn;
    conn.start();
  }, [cleanupAll]);

  const createRoom = useCallback((playerName: string, itemMode: 'competitive' | 'casual', maxGen?: number | null, legendaryMode?: boolean, monotype?: string | null) => {
    const conn = connectionRef.current;
    if (conn) {
      conn.startCreateRoom?.(itemMode, maxGen, legendaryMode, draftModeRef.current, monotypeRef.current ?? monotype, draftTypeRef.current, megaModeRef.current);
    }
  }, []);

  const joinRoom = useCallback((playerName: string, itemMode: 'competitive' | 'casual', code: string) => {
    const conn = connectionRef.current;
    if (conn && conn.gameMode === 'online') {
      conn.startJoinRoom?.(code.toUpperCase(), itemMode);
    } else {
      cleanupAll();
      dispatch({ type: 'RESET' });
      dispatch({ type: 'START_ONLINE', playerName, itemMode });
      const newConn = createOnlineConnection(SERVER_URL, playerName, itemMode, dispatch);
      activeConnection = newConn;
      connectionRef.current = newConn;
      newConn.start();
      const waitConnect = newConn.humanSocket.connected
        ? Promise.resolve()
        : new Promise<void>(r => newConn.humanSocket.once('connect', r));
      waitConnect.then(() => {
        newConn.startJoinRoom?.(code.toUpperCase(), itemMode);
      });
    }
  }, [cleanupAll]);

  // AppState listener: reconnect online when app returns to foreground
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        const conn = connectionRef.current;
        const currentPhase = stateRef.current.phase;
        if (conn && conn.roomCode && currentPhase === 'disconnected') {
          console.log('[AppState] App returned to foreground, reconnecting...');
          conn.reconnect();
        }
      }
    });
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (mountedRef.current) return;
    mountedRef.current = true;
    if (activeConnection) connectionRef.current = activeConnection;
    if (activeLocalBattle) localBattleRef.current = activeLocalBattle;
  }, []);

  // Clear online action guard when turn results arrive from server
  useEffect(() => {
    if (actionPendingRef.current && connectionRef.current && (state.pendingEvents.length > 0 || state.phase !== 'battling')) {
      actionPendingRef.current = false;
    }
  }, [state.pendingEvents, state.phase]);

  // --- Actions: route to local battle or online socket ---

  const selectLead = useCallback((index: number) => {
    const local = localBattleRef.current;
    if (local) {
      local.selectLead(index);
      return;
    }
    const conn = connectionRef.current;
    if (conn) {
      submitOnlineLead(conn, index, stateRef.current.itemMode);
    }
  }, []);

  const selectMove = useCallback((moveIndex: number) => {
    if (actionPendingRef.current) return;
    if (stateRef.current.phase !== 'battling' || stateRef.current.pendingEvents.length > 0 || stateRef.current.queuedPendingEvents.length > 0) return;
    const local = localBattleRef.current;
    if (local) {
      actionPendingRef.current = true;
      dispatch({ type: 'ACTION_SUBMITTED' });
      // Use setTimeout to let the UI update to 'waiting' before processing
      setTimeout(() => {
        local.submitAction({ type: 'move', index: moveIndex });
        actionPendingRef.current = false;
      }, 50);
      return;
    }
    const conn = connectionRef.current;
    if (conn) {
      actionPendingRef.current = true;
      submitOnlineAction(conn, { type: 'move', index: moveIndex });
      dispatch({ type: 'ACTION_SUBMITTED' });
    }
  }, []);

  const selectSwitch = useCallback((pokemonIndex: number) => {
    if (actionPendingRef.current) return;
    if (stateRef.current.phase !== 'battling' || stateRef.current.pendingEvents.length > 0 || stateRef.current.queuedPendingEvents.length > 0) return;
    const local = localBattleRef.current;
    if (local) {
      actionPendingRef.current = true;
      dispatch({ type: 'ACTION_SUBMITTED' });
      setTimeout(() => {
        local.submitAction({ type: 'switch', index: pokemonIndex });
        actionPendingRef.current = false;
      }, 50);
      return;
    }
    const conn = connectionRef.current;
    if (conn) {
      actionPendingRef.current = true;
      submitOnlineAction(conn, { type: 'switch', index: pokemonIndex });
      dispatch({ type: 'ACTION_SUBMITTED' });
    }
  }, []);

  const selectForceSwitch = useCallback((pokemonIndex: number) => {
    if (actionPendingRef.current) return;
    const local = localBattleRef.current;
    if (local) {
      actionPendingRef.current = true;
      dispatch({ type: 'ACTION_SUBMITTED' });
      setTimeout(() => {
        local.submitForceSwitch(pokemonIndex);
        actionPendingRef.current = false;
      }, 50);
      return;
    }
    const conn = connectionRef.current;
    if (conn) {
      actionPendingRef.current = true;
      submitOnlineForceSwitch(conn, pokemonIndex);
      dispatch({ type: 'ACTION_SUBMITTED' });
    }
  }, []);

  const submitDraftPick = useCallback((poolIndex: number) => {
    const local = localBattleRef.current;
    if (local) {
      local.submitDraftPick(poolIndex);
      return;
    }
    // Online: TODO — emit draft_pick event
    const conn = connectionRef.current;
    if (conn) {
      conn.humanSocket.emit('draft_pick' as any, { poolIndex });
    }
  }, []);

  const rerollDraftPool = useCallback(() => {
    const local = localBattleRef.current;
    if (local) {
      local.rerollDraftPool();
      return;
    }
    const conn = connectionRef.current;
    if (conn) {
      submitDraftReroll(conn);
    }
  }, []);

  const playAgain = useCallback(() => {
    console.log('[battle-context] playAgain — cleaning up');
    cleanupAll();
    dispatch({ type: 'RESET' });
  }, [cleanupAll]);

  const requestRematchOnline = useCallback(() => {
    const conn = connectionRef.current;
    if (conn) {
      requestRematch(conn);
    }
  }, []);

  const returnToMenu = useCallback(() => {
    console.log('[battle-context] returnToMenu — cleaning up');
    cleanupAll();
    e4PlayerTeamRef.current = null;
    dispatch({ type: 'RESET' });
  }, [cleanupAll]);

  // --- Move Selection Complete ---

  const moveSelectionComplete = useCallback((moveSelections: Record<number, string[]>) => {
    const currentState = stateRef.current;
    const team = currentState.yourTeam;
    const rng = new SeededRNG();

    // Rebuild team with custom moves using the engine
    // Must look up full PokemonSpecies from pokedex — OwnPokemon.species is stripped
    const rebuiltTeam: BattlePokemon[] = team.map((poke, i) => {
      const fullSpecies = fullSpeciesById[poke.species.id];
      if (!fullSpecies) {
        // Fallback: shouldn't happen, but use partial species
        const baseSet = pickSet(poke.species as any, rng, currentState.itemMode);
        return createBattlePokemon(poke.species as any, baseSet, 100, null);
      }
      const customMoves = moveSelections[i];
      if (!customMoves || customMoves.length !== 4) {
        const baseSet = pickSet(fullSpecies, rng, currentState.itemMode);
        return createBattlePokemon(fullSpecies, baseSet, 100, null);
      }
      const baseSet = pickSet(fullSpecies, rng, currentState.itemMode);
      baseSet.moves = customMoves;
      return createBattlePokemon(fullSpecies, baseSet, 100, null);
    });

    // Update local battle's team if CPU mode
    const local = localBattleRef.current;
    if (local) {
      local.updateHumanTeam(rebuiltTeam);
    }

    // For online mode, send move selections to server
    const conn = connectionRef.current;
    if (conn) {
      conn.humanSocket.emit('moves_selected' as any, { moveSelections });
    }

    // Dispatch with serialized team
    dispatch({
      type: 'MOVE_SELECTION_COMPLETE',
      yourTeam: rebuiltTeam.map(serializeOwnPokemon),
    });
  }, []);

  // --- Elite Four ---

  const startEliteFour = useCallback((playerName: string) => {
    console.log('[battle-context] startEliteFour');
    cleanupAll();
    e4PlayerNameRef.current = playerName;
    e4PlayerTeamRef.current = null;

    // Generate a standard mega draft pool (21 Pokemon)
    const rng = new SeededRNG();
    const pool = generateDraftPool(rng, {
      maxGen: null,
      legendaryMode: false,
      megaMode: true,
      targetPoolSize: 21,
      monotype: null,
    });

    dispatch({ type: 'E4_DRAFT_START', pool, playerName });
  }, [cleanupAll]);

  /** Called when player finishes picking 6 from the E4 draft pool + moves. */
  const e4DraftComplete = useCallback((pickedIndices: number[], moveSelections: Record<number, string[]>) => {
    const currentState = stateRef.current;
    const pool = currentState.draftPool;
    const rng = new SeededRNG();

    // Build player team from picks with custom moves
    const playerTeam = pickedIndices.map((poolIdx, pickIdx) => {
      const species = pool[poolIdx].species;
      const baseSet = pickSet(species, rng, 'competitive');
      const customMoves = moveSelections[pickIdx];
      if (customMoves && customMoves.length === 4) {
        baseSet.moves = customMoves;
      }
      return createBattlePokemon(species, baseSet, 100, null);
    });
    e4PlayerTeamRef.current = playerTeam;

    // Show intro for first E4 battle
    const member = getEliteFourMember(0)!;
    dispatch({ type: 'E4_ADVANCE', stage: 0, opponentName: member.name });
  }, []);

  /** Start an E4/Champion battle at the given stage. */
  const startE4Battle = useCallback((stage: number) => {
    cleanupAll();
    const playerName = e4PlayerNameRef.current;
    const playerTeam = e4PlayerTeamRef.current;
    if (!playerTeam) return;

    // Heal player team to full
    const healedTeam = playerTeam.map(p => ({
      ...p,
      currentHp: p.stats.hp,
      isAlive: true,
      status: null,
      volatileStatuses: new Set<string>(),
      boosts: { atk: 0, def: 0, spa: 0, spd: 0, spe: 0 },
      hasActed: false,
      lastMoveUsed: null,
      protectCount: 0,
      choiceLocked: null,
      substituteHp: 0,
      moves: p.moves.map(m => ({ ...m, currentPp: m.maxPp })),
    }));
    e4PlayerTeamRef.current = healedTeam;

    const member = getEliteFourMember(stage)!;

    const local = createLocalBattle({
      playerName,
      itemMode: 'competitive',
      maxGen: null,
      difficulty: 'hard',
      legendaryMode: false,
      draftMode: false,
      draftType: 'snake',
      monotype: null,
      poolSize: 21,
      megaMode: false,
      dispatch,
      // E4 options
      eliteFourStage: stage,
      eliteFourPlayerTeam: healedTeam,
      eliteFourOpponentName: member.name,
    });

    activeLocalBattle = local;
    localBattleRef.current = local;
    local.start();
  }, [cleanupAll]);

  /** Called after winning an E4 battle to advance to the next one. */
  const advanceEliteFour = useCallback(() => {
    const currentStage = stateRef.current.eliteFourStage;
    if (currentStage === null) return;

    const nextStage = currentStage + 1;

    if (nextStage >= TOTAL_E4_STAGES) {
      // Champion defeated! Save progress and return to menu
      console.log('[battle-context] Champion defeated!');
      getEliteFourProgress().then(progress => {
        progress.championDefeated = true;
        progress.completedDate = new Date().toISOString();
        if (!progress.clearedStages.includes(currentStage)) {
          progress.clearedStages.push(currentStage);
        }
        saveEliteFourProgress(progress);
      });
      cleanupAll();
      e4PlayerTeamRef.current = null;
      dispatch({ type: 'RESET' });
      return;
    }

    // Save stage progress
    getEliteFourProgress().then(progress => {
      if (!progress.clearedStages.includes(currentStage)) {
        progress.clearedStages.push(currentStage);
      }
      saveEliteFourProgress(progress);
    });

    const member = getEliteFourMember(nextStage)!;
    dispatch({ type: 'E4_ADVANCE', stage: nextStage, opponentName: member.name });
  }, [cleanupAll, startE4Battle]);

  /** Called from intro screen BATTLE button to start the current E4 stage. */
  const beginE4Battle = useCallback(() => {
    const stage = stateRef.current.eliteFourStage;
    if (stage === null) return;
    startE4Battle(stage);
  }, [startE4Battle]);

  return (
    <BattleContext.Provider
      value={{
        state,
        dispatch,
        startGame,
        startOnline: startOnlineCreate,
        createRoom,
        joinRoom,
        selectLead,
        selectMove,
        selectSwitch,
        selectForceSwitch,
        submitDraftPick,
        rerollDraftPool,
        playAgain,
        requestRematchOnline,
        returnToMenu,
        moveSelectionComplete,
        startEliteFour,
        e4DraftComplete,
        advanceEliteFour,
        beginE4Battle,
      }}
    >
      {children}
    </BattleContext.Provider>
  );
}

export function useBattle(): BattleContextValue {
  const ctx = useContext(BattleContext);
  if (!ctx) throw new Error('useBattle must be used within BattleProvider');
  return ctx;
}
