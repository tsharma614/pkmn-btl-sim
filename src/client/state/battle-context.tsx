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
  startGame: (playerName: string, itemMode: 'competitive' | 'casual') => void;
  startOnlineCreate: (playerName: string, itemMode: 'competitive' | 'casual') => void;
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

  const startConnection = useCallback((playerName: string, itemMode: 'competitive' | 'casual') => {
    cleanupConnection();
    dispatch({ type: 'RESET' });
    dispatch({ type: 'START_GAME', playerName, itemMode });
    const conn = createBattleConnection(SERVER_URL, playerName, itemMode, dispatch);
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
    // Once connected, create the room
    const waitConnect = conn.humanSocket.connected
      ? Promise.resolve()
      : new Promise<void>(r => conn.humanSocket.once('connect', r));
    waitConnect.then(() => {
      conn.startCreateRoom?.(itemMode);
    });
  }, [cleanupConnection]);

  const joinRoom = useCallback((playerName: string, itemMode: 'competitive' | 'casual', code: string) => {
    cleanupConnection();
    dispatch({ type: 'RESET' });
    dispatch({ type: 'START_ONLINE', playerName, itemMode });
    const conn = createOnlineConnection(SERVER_URL, playerName, itemMode, dispatch);
    activeConnection = conn;
    connectionRef.current = conn;
    conn.start();
    const waitConnect = conn.humanSocket.connected
      ? Promise.resolve()
      : new Promise<void>(r => conn.humanSocket.once('connect', r));
    waitConnect.then(() => {
      conn.startJoinRoom?.(code.toUpperCase(), itemMode);
    });
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

  const startGame = useCallback((playerName: string, itemMode: 'competitive' | 'casual') => {
    mountedRef.current = false; // allow re-init
    startConnection(playerName, itemMode);
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
    const name = stateRef.current.playerName;
    const mode = stateRef.current.itemMode;
    mountedRef.current = false;
    startConnection(name, mode);
    mountedRef.current = true;
  }, [startConnection]);

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
        startOnlineCreate,
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
