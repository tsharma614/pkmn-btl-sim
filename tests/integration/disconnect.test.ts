import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { io as ioc, Socket as ClientSocket } from 'socket.io-client';
import { RoomManager } from '../../src/server/room-manager';
import { DisconnectTracker } from '../../src/server/disconnect-tracker';
import { registerSocketHandlers } from '../../src/server/socket-handlers';
import type { ServerToClientEvents, ClientToServerEvents, BattleStartPayload, BattleEndPayload } from '../../src/server/types';

type TypedClientSocket = ClientSocket<ServerToClientEvents, ClientToServerEvents>;

function waitForEvent<T>(socket: TypedClientSocket, event: string): Promise<T> {
  return new Promise((resolve) => {
    (socket as any).once(event, (data: T) => resolve(data));
  });
}

describe('Disconnect Handling', () => {
  let httpServer: ReturnType<typeof createServer>;
  let io: Server;
  let roomManager: RoomManager;
  let disconnectTracker: DisconnectTracker;
  let port: number;

  beforeAll(async () => {
    // Use short timeout for tests (500ms instead of 2 minutes)
    httpServer = createServer();
    io = new Server(httpServer, { cors: { origin: '*' } });
    roomManager = new RoomManager();
    disconnectTracker = new DisconnectTracker(500); // 500ms for testing
    registerSocketHandlers(io, roomManager, disconnectTracker);

    await new Promise<void>((resolve) => {
      httpServer.listen(0, () => {
        const addr = httpServer.address();
        port = typeof addr === 'object' && addr ? addr.port : 0;
        resolve();
      });
    });
  });

  afterAll(() => {
    disconnectTracker.clearAll();
    io.close();
    httpServer.close();
  });

  it('opponent receives battle_end after disconnect auto-forfeit', async () => {
    const client1 = ioc(`http://localhost:${port}`, { transports: ['websocket'], forceNew: true }) as TypedClientSocket;
    const client2 = ioc(`http://localhost:${port}`, { transports: ['websocket'], forceNew: true }) as TypedClientSocket;

    await Promise.all([
      new Promise<void>((r) => client1.on('connect', r)),
      new Promise<void>((r) => client2.on('connect', r)),
    ]);

    // Create room and join
    const roomCreated = waitForEvent<{ code: string }>(client1, 'room_created');
    client1.emit('create_room', { playerName: 'Tanmay' });
    const { code } = await roomCreated;

    client2.emit('join_room', { code, playerName: 'Nikhil' });
    await waitForEvent(client1, 'opponent_joined');

    // Start battle
    client1.emit('select_lead', { pokemonIndex: 0, itemMode: 'competitive' });
    client2.emit('select_lead', { pokemonIndex: 0, itemMode: 'competitive' });
    await waitForEvent(client1, 'battle_start');

    // Player 1 disconnects — auto-forfeit fires after 500ms
    const battleEnd = waitForEvent<BattleEndPayload>(client2, 'battle_end');
    client1.disconnect();
    const endResult = await battleEnd;
    expect(endResult.winner).toBe('Nikhil');
    expect(endResult.reason).toBe('disconnect');

    client2.disconnect();
  }, 5000);

  it('auto-forfeits after disconnect timeout', async () => {
    const client1 = ioc(`http://localhost:${port}`, { transports: ['websocket'], forceNew: true }) as TypedClientSocket;
    const client2 = ioc(`http://localhost:${port}`, { transports: ['websocket'], forceNew: true }) as TypedClientSocket;

    await Promise.all([
      new Promise<void>((r) => client1.on('connect', r)),
      new Promise<void>((r) => client2.on('connect', r)),
    ]);

    // Create room and join
    const roomCreated = waitForEvent<{ code: string }>(client1, 'room_created');
    client1.emit('create_room', { playerName: 'Tanmay' });
    const { code } = await roomCreated;

    client2.emit('join_room', { code, playerName: 'Nikhil' });
    await waitForEvent(client1, 'opponent_joined');

    // Start battle
    client1.emit('select_lead', { pokemonIndex: 0, itemMode: 'competitive' });
    client2.emit('select_lead', { pokemonIndex: 0, itemMode: 'competitive' });
    await waitForEvent(client1, 'battle_start');

    // Player 1 disconnects — auto-forfeit should trigger after 500ms
    const battleEnd = waitForEvent<BattleEndPayload>(client2, 'battle_end');
    client1.disconnect();

    const endResult = await battleEnd;
    expect(endResult.winner).toBe('Nikhil');
    expect(endResult.reason).toBe('disconnect');

    client2.disconnect();
  }, 5000);

  it('cancels auto-forfeit on reconnect', async () => {
    const client1 = ioc(`http://localhost:${port}`, { transports: ['websocket'], forceNew: true }) as TypedClientSocket;
    const client2 = ioc(`http://localhost:${port}`, { transports: ['websocket'], forceNew: true }) as TypedClientSocket;

    await Promise.all([
      new Promise<void>((r) => client1.on('connect', r)),
      new Promise<void>((r) => client2.on('connect', r)),
    ]);

    // Create room and join
    const roomCreated = waitForEvent<{ code: string }>(client1, 'room_created');
    client1.emit('create_room', { playerName: 'Tanmay' });
    const { code } = await roomCreated;

    client2.emit('join_room', { code, playerName: 'Nikhil' });
    await waitForEvent(client1, 'opponent_joined');

    // Start battle
    client1.emit('select_lead', { pokemonIndex: 0, itemMode: 'competitive' });
    client2.emit('select_lead', { pokemonIndex: 0, itemMode: 'competitive' });
    await waitForEvent(client1, 'battle_start');

    // Player 1 disconnects — reconnect immediately (before 500ms auto-forfeit)
    client1.disconnect();

    // Small delay to let disconnect handler register
    await new Promise((r) => setTimeout(r, 50));

    // Reconnect quickly (well before 500ms timeout)
    const client1Reconnected = ioc(`http://localhost:${port}`, {
      transports: ['websocket'],
      forceNew: true,
    }) as TypedClientSocket;
    await new Promise<void>((r) => client1Reconnected.on('connect', r));

    // Set up listener before emitting join
    const opponentBack = waitForEvent<{ name: string }>(client2, 'opponent_joined');
    client1Reconnected.emit('join_room', { code, playerName: 'Tanmay' });
    const result = await opponentBack;
    expect(result.name).toBe('Tanmay');

    // Wait past the auto-forfeit timeout to verify it doesn't happen
    await new Promise((r) => setTimeout(r, 700));

    // Battle should still be in progress
    const room = roomManager.getRoomBySocketId(client1Reconnected.id!);
    expect(room).toBeDefined();
    expect(room!.status).toBe('battling');

    client1Reconnected.disconnect();
    client2.disconnect();
  }, 5000);

  it('cleans up room when solo player disconnects', async () => {
    const client1 = ioc(`http://localhost:${port}`, { transports: ['websocket'], forceNew: true }) as TypedClientSocket;
    await new Promise<void>((r) => client1.on('connect', r));

    const roomCreated = waitForEvent<{ code: string }>(client1, 'room_created');
    client1.emit('create_room', { playerName: 'Tanmay' });
    const { code } = await roomCreated;

    const roomBefore = roomManager.getRoom(code);
    expect(roomBefore).toBeDefined();

    client1.disconnect();

    // Give the disconnect handler time to run
    await new Promise((r) => setTimeout(r, 100));

    const roomAfter = roomManager.getRoom(code);
    expect(roomAfter).toBeUndefined();
  });
});
