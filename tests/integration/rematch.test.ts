import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { io as ioc, Socket as ClientSocket } from 'socket.io-client';
import { RoomManager } from '../../src/server/room-manager';
import { DisconnectTracker } from '../../src/server/disconnect-tracker';
import { registerSocketHandlers } from '../../src/server/socket-handlers';
import type { ServerToClientEvents, ClientToServerEvents, BattleStartPayload, BattleEndPayload } from '../../src/server/types';

type TypedClientSocket = ClientSocket<ServerToClientEvents, ClientToServerEvents>;

function waitForEvent<T>(socket: TypedClientSocket, event: string, timeoutMs = 3000): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timeout waiting for "${event}"`)), timeoutMs);
    (socket as any).once(event, (data: T) => {
      clearTimeout(timer);
      resolve(data);
    });
  });
}

describe('Rematch', () => {
  let httpServer: ReturnType<typeof createServer>;
  let io: Server;
  let roomManager: RoomManager;
  let disconnectTracker: DisconnectTracker;
  let port: number;
  let client1: TypedClientSocket;
  let client2: TypedClientSocket;

  beforeAll(async () => {
    httpServer = createServer();
    io = new Server(httpServer, { cors: { origin: '*' } });
    roomManager = new RoomManager();
    disconnectTracker = new DisconnectTracker();
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

  beforeEach(async () => {
    client1 = ioc(`http://localhost:${port}`, {
      transports: ['websocket'],
      forceNew: true,
    }) as TypedClientSocket;
    client2 = ioc(`http://localhost:${port}`, {
      transports: ['websocket'],
      forceNew: true,
    }) as TypedClientSocket;

    await Promise.all([
      new Promise<void>((r) => client1.on('connect', r)),
      new Promise<void>((r) => client2.on('connect', r)),
    ]);
  });

  afterEach(() => {
    client1.disconnect();
    client2.disconnect();
  });

  it('starts a new battle with fresh teams on rematch', async () => {
    // Create room
    const roomCreated = waitForEvent<{ code: string }>(client1, 'room_created');
    client1.emit('create_room', { playerName: 'Tanmay' });
    const { code } = await roomCreated;

    // Join room
    const opp1 = waitForEvent<{ name: string }>(client1, 'opponent_joined');
    const opp2 = waitForEvent<{ name: string }>(client2, 'opponent_joined');
    client2.emit('join_room', { code, playerName: 'Nikhil' });
    await Promise.all([opp1, opp2]);

    // Select leads — both listen for battle_start
    const bs1 = waitForEvent<BattleStartPayload>(client1, 'battle_start');
    const bs2 = waitForEvent<BattleStartPayload>(client2, 'battle_start');
    client1.emit('select_lead', { pokemonIndex: 0, itemMode: 'competitive' });
    client2.emit('select_lead', { pokemonIndex: 0, itemMode: 'competitive' });
    await Promise.all([bs1, bs2]);

    // Forfeit to end the battle
    const be1 = waitForEvent<BattleEndPayload>(client1, 'battle_end');
    const be2 = waitForEvent<BattleEndPayload>(client2, 'battle_end');
    client1.emit('forfeit');
    await Promise.all([be1, be2]);

    // Both request rematch — listen for team_preview (not battle_start)
    const rs1 = waitForEvent<BattleStartPayload>(client1, 'team_preview');
    const rs2 = waitForEvent<BattleStartPayload>(client2, 'team_preview');
    client1.emit('rematch_request');
    client2.emit('rematch_request');
    const [rematch1, rematch2] = await Promise.all([rs1, rs2]);

    expect(rematch1.yourTeam).toHaveLength(6);
    expect(rematch2.yourTeam).toHaveLength(6);
    expect(rematch1.yourPlayerIndex).toBe(0);
    expect(rematch2.yourPlayerIndex).toBe(1);

    // Select leads again to start new battle
    const bs3 = waitForEvent<BattleStartPayload>(client1, 'battle_start');
    const bs4 = waitForEvent<BattleStartPayload>(client2, 'battle_start');
    client1.emit('select_lead', { pokemonIndex: 0, itemMode: 'competitive' });
    client2.emit('select_lead', { pokemonIndex: 0, itemMode: 'competitive' });
    await Promise.all([bs3, bs4]);

    const room = roomManager.getRoom(code);
    expect(room).toBeDefined();
    expect(room!.status).toBe('battling');
  }, 10000);

  it('ignores rematch request from only one player', async () => {
    // Create, join, start battle
    const roomCreated = waitForEvent<{ code: string }>(client1, 'room_created');
    client1.emit('create_room', { playerName: 'Tanmay' });
    const { code } = await roomCreated;

    const opp = waitForEvent(client1, 'opponent_joined');
    client2.emit('join_room', { code, playerName: 'Nikhil' });
    await opp;

    const bs1 = waitForEvent(client1, 'battle_start');
    const bs2 = waitForEvent(client2, 'battle_start');
    client1.emit('select_lead', { pokemonIndex: 0, itemMode: 'competitive' });
    client2.emit('select_lead', { pokemonIndex: 0, itemMode: 'competitive' });
    await Promise.all([bs1, bs2]);

    // Forfeit
    const be1 = waitForEvent<BattleEndPayload>(client1, 'battle_end');
    const be2 = waitForEvent<BattleEndPayload>(client2, 'battle_end');
    client1.emit('forfeit');
    await Promise.all([be1, be2]);

    // Only one player requests rematch
    client1.emit('rematch_request');

    await new Promise((r) => setTimeout(r, 200));

    const room = roomManager.getRoom(code);
    expect(room).toBeDefined();
    expect(room!.status).toBe('finished');
  });
});
