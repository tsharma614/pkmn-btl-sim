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

const SERVER_URL = getServerUrl();

interface BattleContextValue {
  state: BattleState;
  dispatch: React.Dispatch<BattleAction>;
  startGame: (playerName: string, itemMode: 'competitive' | 'casual', maxGen?: number | null, difficulty?: 'easy' | 'normal' | 'hard', legendaryMode?: boolean, draftMode?: boolean, monotype?: string | null, draftType?: 'snake' | 'role', poolSize?: number) => void;
  startOnline: (playerName: string, itemMode: 'competitive' | 'casual', maxGen?: number | null, legendaryMode?: boolean, draftMode?: boolean, monotype?: string | null) => void;
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

  const startGame = useCallback((playerName: string, itemMode: 'competitive' | 'casual', maxGen?: number | null, difficulty?: 'easy' | 'normal' | 'hard', legendaryMode?: boolean, draftMode?: boolean, monotype?: string | null, draftType?: 'snake' | 'role', poolSize?: number) => {
    console.log(`[battle-context] startGame — draft: ${draftMode}, type: ${draftType}, legendary: ${legendaryMode}, maxGen: ${maxGen}, difficulty: ${difficulty}, monotype: ${monotype}, poolSize: ${poolSize}`);
    cleanupAll();
    dispatch({ type: 'RESET' });
    dispatch({ type: 'START_GAME', playerName, itemMode, difficulty, monotype, legendaryMode });

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
      dispatch,
    });

    activeLocalBattle = local;
    localBattleRef.current = local;
    local.start();
  }, [cleanupAll]);

  // --- Online mode: socket connection ---

  const draftModeRef = useRef(false);
  const monotypeRef = useRef<string | null>(null);

  const startOnlineCreate = useCallback((playerName: string, itemMode: 'competitive' | 'casual', maxGen?: number | null, legendaryMode?: boolean, dm?: boolean, mono?: string | null) => {
    cleanupAll();
    draftModeRef.current = dm ?? false;
    monotypeRef.current = mono ?? null;
    dispatch({ type: 'RESET' });
    dispatch({ type: 'START_ONLINE', playerName, itemMode, maxGen, legendaryMode });
    const conn = createOnlineConnection(SERVER_URL, playerName, itemMode, dispatch, maxGen, legendaryMode);
    activeConnection = conn;
    connectionRef.current = conn;
    conn.start();
  }, [cleanupAll]);

  const createRoom = useCallback((playerName: string, itemMode: 'competitive' | 'casual', maxGen?: number | null, legendaryMode?: boolean, monotype?: string | null) => {
    const conn = connectionRef.current;
    if (conn) {
      conn.startCreateRoom?.(itemMode, maxGen, legendaryMode, draftModeRef.current, monotypeRef.current ?? monotype);
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
    dispatch({ type: 'RESET' });
  }, [cleanupAll]);

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
