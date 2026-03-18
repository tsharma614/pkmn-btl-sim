/**
 * Tests for online play connection fixes — error feedback, reconnection cap,
 * and join validation. Complements the existing online-multiplayer.test.ts.
 */
import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { battleReducer, initialState } from '../../src/client/state/battle-reducer';

describe('Online connection — error feedback', () => {
  const socketSource = fs.readFileSync(
    path.resolve(__dirname, '../../src/client/socket.ts'),
    'utf-8',
  );

  it('socket error dispatches DISCONNECTED (not silent)', () => {
    expect(socketSource).toContain("humanSocket.on('error'");
    // After the error handler, should dispatch DISCONNECTED
    const errorHandler = socketSource.slice(socketSource.indexOf("humanSocket.on('error'"));
    expect(errorHandler.slice(0, 200)).toContain("dispatch({ type: 'DISCONNECTED' })");
  });

  it('room_error event handler exists and dispatches DISCONNECTED', () => {
    expect(socketSource).toContain("humanSocket.on('room_error'");
    const roomErrorHandler = socketSource.slice(socketSource.indexOf("humanSocket.on('room_error'"));
    expect(roomErrorHandler.slice(0, 200)).toContain("dispatch({ type: 'DISCONNECTED' })");
  });

  it('startJoinRoom does NOT set hasCreated prematurely', () => {
    const joinSection = socketSource.slice(socketSource.indexOf('startJoinRoom'));
    // Should NOT call setHasCreated before server validates
    const joinImpl = joinSection.slice(0, joinSection.indexOf('};'));
    expect(joinImpl).not.toContain('setHasCreated()');
  });
});

describe('Online connection — reconnection cap', () => {
  const socketSource = fs.readFileSync(
    path.resolve(__dirname, '../../src/client/socket.ts'),
    'utf-8',
  );

  it('reconnection attempts are capped (not Infinity)', () => {
    const match = socketSource.match(/reconnectionAttempts:\s*(\d+|Infinity)/);
    expect(match).not.toBeNull();
    const value = match![1];
    expect(value).not.toBe('Infinity');
    expect(parseInt(value, 10)).toBeLessThanOrEqual(20);
    expect(parseInt(value, 10)).toBeGreaterThanOrEqual(5);
  });

  it('reconnection delay starts at 2 seconds', () => {
    expect(socketSource).toContain('reconnectionDelay: 2000');
  });

  it('reconnection delay max is 10 seconds', () => {
    expect(socketSource).toContain('reconnectionDelayMax: 10000');
  });
});

describe('Online connection — reducer state machine', () => {
  it('DISCONNECTED sets phase to disconnected', () => {
    const state = battleReducer(
      { ...initialState, phase: 'battling', gameMode: 'online' },
      { type: 'DISCONNECTED' },
    );
    expect(state.phase).toBe('disconnected');
    expect(state.phaseBeforeDisconnect).toBe('battling');
  });

  it('RECONNECTING sets isReconnecting flag', () => {
    const state = battleReducer(initialState, { type: 'RECONNECTING' });
    expect(state.isReconnecting).toBe(true);
  });

  it('RECONNECTED clears isReconnecting flag', () => {
    const state = battleReducer(
      { ...initialState, isReconnecting: true },
      { type: 'RECONNECTED' },
    );
    expect(state.isReconnecting).toBe(false);
  });

  it('OPPONENT_DISCONNECTED in online mode sets disconnected', () => {
    const state = battleReducer(
      { ...initialState, phase: 'battling', gameMode: 'online' },
      { type: 'OPPONENT_DISCONNECTED' },
    );
    expect(state.phase).toBe('disconnected');
  });

  it('OPPONENT_DISCONNECTED in CPU mode is ignored', () => {
    const state = battleReducer(
      { ...initialState, phase: 'battling', gameMode: 'cpu' },
      { type: 'OPPONENT_DISCONNECTED' },
    );
    expect(state.phase).toBe('battling'); // unchanged
  });

  it('START_ONLINE sets online mode', () => {
    const state = battleReducer(initialState, {
      type: 'START_ONLINE',
      playerName: 'Test',
      itemMode: 'competitive',
    });
    expect(state.gameMode).toBe('online');
    expect(state.phase).toBe('connecting');
  });

  it('CONNECTED in online mode goes to online_lobby', () => {
    const state = battleReducer(
      { ...initialState, gameMode: 'online' },
      { type: 'CONNECTED' },
    );
    expect(state.phase).toBe('online_lobby');
  });

  it('ONLINE_ROOM_CREATED stores room code', () => {
    const state = battleReducer(
      { ...initialState, phase: 'online_lobby', gameMode: 'online' },
      { type: 'ONLINE_ROOM_CREATED', code: 'ABC123' },
    );
    expect(state.roomCode).toBe('ABC123');
  });

  it('OPPONENT_JOINED stores opponent name', () => {
    const state = battleReducer(
      { ...initialState, phase: 'online_lobby', gameMode: 'online' },
      { type: 'OPPONENT_JOINED', name: 'Nikhil' },
    );
    expect(state.opponentName).toBe('Nikhil');
  });
});

describe('Online connection — socket timeout', () => {
  const socketSource = fs.readFileSync(
    path.resolve(__dirname, '../../src/client/socket.ts'),
    'utf-8',
  );

  it('socket timeout is 20 seconds', () => {
    expect(socketSource).toContain('timeout: 20000');
  });

  it('uses WebSocket transport only (no polling)', () => {
    expect(socketSource).toContain("transports: ['websocket']");
  });
});
