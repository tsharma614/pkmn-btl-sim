import React, { createContext, useContext, useReducer, useRef, useCallback, useEffect } from 'react';
import { AppState } from 'react-native';
import { battleReducer, initialState } from './battle-reducer';
import type { BattleState, BattleAction } from './battle-reducer';
import {
  createBattleConnection,
  createOnlineConnection,
  submitAction,
  submitLead,
  submitForceSwitch,
  requestRematch,
} from '../socket';
import type { BattleConnection } from '../socket';
import { getServerUrl } from '../config';

const SERVER_URL = getServerUrl();

interface BattleContextValue {
  state: BattleState;
  dispatch: React.Dispatch<BattleAction>;
  startGame: (playerName: string, itemMode: 'competitive' | 'casual', maxGen?: number | null, difficulty?: 'easy' | 'normal' | 'hard') => void;
  startOnline: (playerName: string, itemMode: 'competitive' | 'casual') => void;
  createRoom: (playerName: string, itemMode: 'competitive' | 'casual') => void;
  joinRoom: (playerName: string, itemMode: 'competitive' | 'casual', code: string) => void;
  selectLead: (index: number) => void;
  selectMove: (moveIndex: number) => void;
  selectSwitch: (pokemonIndex: number) => void;
  selectForceSwitch: (pokemonIndex: number) => void;
  playAgain: () => void;
  requestRematchOnline: () => void;
  returnToMenu: () => void;
}

const BattleContext = createContext<BattleContextValue | null>(null);

// Module-level connection survives hot reloads. Only one connection ever exists.
let activeConnection: BattleConnection | null = null;

export function BattleProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(battleReducer, initialState);
  const connectionRef = useRef<BattleConnection | null>(activeConnection);
  const mountedRef = useRef(false);
  // Track state in a ref so AppState callback can access current values
  const stateRef = useRef(state);
  stateRef.current = state;

  const cleanupConnection = useCallback(() => {
    if (activeConnection) {
      activeConnection.disconnect();
      activeConnection = null;
    }
    connectionRef.current = null;
  }, []);

  const startConnection = useCallback((playerName: string, itemMode: 'competitive' | 'casual', maxGen: number | null = null, difficulty: 'easy' | 'normal' | 'hard' = 'normal') => {
    cleanupConnection();
    dispatch({ type: 'RESET' });
    dispatch({ type: 'START_GAME', playerName, itemMode });
    const conn = createBattleConnection(SERVER_URL, playerName, itemMode, dispatch, maxGen, difficulty);
    activeConnection = conn;
    connectionRef.current = conn;
    conn.start();
  }, [cleanupConnection]);

  const startOnlineCreate = useCallback((playerName: string, itemMode: 'competitive' | 'casual') => {
    cleanupConnection();
    dispatch({ type: 'RESET' });
    dispatch({ type: 'START_ONLINE', playerName, itemMode });
    const conn = createOnlineConnection(SERVER_URL, playerName, itemMode, dispatch);
    activeConnection = conn;
    connectionRef.current = conn;
    conn.start();
    // Don't auto-create room — let OnlineLobby show create/join choice first
  }, [cleanupConnection]);

  /** Create a room on the already-connected online socket */
  const createRoom = useCallback((playerName: string, itemMode: 'competitive' | 'casual') => {
    const conn = connectionRef.current;
    if (conn) {
      conn.startCreateRoom?.(itemMode);
    }
  }, []);

  /** Join an existing room by code — reuses current connection if available */
  const joinRoom = useCallback((playerName: string, itemMode: 'competitive' | 'casual', code: string) => {
    const conn = connectionRef.current;
    if (conn && conn.gameMode === 'online') {
      // Already connected in online mode, just join
      conn.startJoinRoom?.(code.toUpperCase(), itemMode);
    } else {
      // No existing connection — create one and join
      cleanupConnection();
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
  }, [cleanupConnection]);

  // AppState listener: reconnect when app returns to foreground
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        const conn = connectionRef.current;
        const currentPhase = stateRef.current.phase;
        if (
          conn &&
          conn.roomCode &&
          currentPhase === 'disconnected'
        ) {
          console.log('[AppState] App returned to foreground, reconnecting...');
          conn.reconnect();
        }
      }
    });

    return () => subscription.remove();
  }, []);

  useEffect(() => {
    // StrictMode guard: only start on first mount
    if (mountedRef.current) return;
    mountedRef.current = true;

    // If module-level connection already exists (hot reload), reuse it
    if (activeConnection) {
      connectionRef.current = activeConnection;
      return;
    }

    // Don't auto-connect — wait for user to start from setup screen
  }, []);

  const startGame = useCallback((playerName: string, itemMode: 'competitive' | 'casual', maxGen?: number | null, difficulty?: 'easy' | 'normal' | 'hard') => {
    mountedRef.current = false; // allow re-init
    startConnection(playerName, itemMode, maxGen ?? null, difficulty ?? 'normal');
    mountedRef.current = true;
  }, [startConnection]);

  const selectLead = useCallback((index: number) => {
    if (connectionRef.current) {
      submitLead(connectionRef.current, index, stateRef.current.itemMode);
    }
  }, []);

  const selectMove = useCallback((moveIndex: number) => {
    if (connectionRef.current) {
      submitAction(connectionRef.current, { type: 'move', index: moveIndex });
      dispatch({ type: 'ACTION_SUBMITTED' });
    }
  }, []);

  const selectSwitch = useCallback((pokemonIndex: number) => {
    if (connectionRef.current) {
      submitAction(connectionRef.current, { type: 'switch', index: pokemonIndex });
      dispatch({ type: 'ACTION_SUBMITTED' });
    }
  }, []);

  const selectForceSwitch = useCallback((pokemonIndex: number) => {
    if (connectionRef.current) {
      submitForceSwitch(connectionRef.current, pokemonIndex);
    }
  }, []);

  const playAgain = useCallback(() => {
    // Go back to setup screen so the player can change name/settings
    cleanupConnection();
    dispatch({ type: 'RESET' });
  }, [cleanupConnection]);

  const requestRematchOnline = useCallback(() => {
    if (connectionRef.current) {
      requestRematch(connectionRef.current);
    }
  }, []);

  const returnToMenu = useCallback(() => {
    cleanupConnection();
    dispatch({ type: 'RESET' });
  }, [cleanupConnection]);

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
