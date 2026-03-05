import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { io as ioc, Socket as ClientSocket } from 'socket.io-client';
import { RoomManager } from '../../src/server/room-manager';
import { DisconnectTracker } from '../../src/server/disconnect-tracker';
import { registerSocketHandlers } from '../../src/server/socket-handlers';
import type { ServerToClientEvents, ClientToServerEvents, BattleStartPayload, TurnResultPayload, BattleEndPayload, NeedsSwitchPayload } from '../../src/server/types';

type TypedClientSocket = ClientSocket<ServerToClientEvents, ClientToServerEvents>;

function waitForEvent<T>(socket: TypedClientSocket, event: string): Promise<T> {
  return new Promise((resolve) => {
    (socket as any).once(event, (data: T) => resolve(data));
  });
}

describe('Full Battle Flow', () => {
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

  afterAll(async () => {
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

  it('creates a room and returns a code', async () => {
    const roomCreated = waitForEvent<{ code: string }>(client1, 'room_created');
    client1.emit('create_room', { playerName: 'Tanmay' });
    const result = await roomCreated;
    expect(result.code).toHaveLength(6);
  });

  it('second player joins and both get opponent_joined', async () => {
    const roomCreated = waitForEvent<{ code: string }>(client1, 'room_created');
    client1.emit('create_room', { playerName: 'Tanmay' });
    const { code } = await roomCreated;

    const opponentJoined1 = waitForEvent<{ name: string }>(client1, 'opponent_joined');
    const opponentJoined2 = waitForEvent<{ name: string }>(client2, 'opponent_joined');

    client2.emit('join_room', { code, playerName: 'Nikhil' });

    const [opp1, opp2] = await Promise.all([opponentJoined1, opponentJoined2]);
    expect(opp1.name).toBe('Nikhil');
    expect(opp2.name).toBe('Tanmay');
  });

  it('plays a complete battle from create to finish', async () => {
    // Create room
    const roomCreated = waitForEvent<{ code: string }>(client1, 'room_created');
    client1.emit('create_room', { playerName: 'Tanmay' });
    const { code } = await roomCreated;

    // Join room
    const opponentJoined = waitForEvent<{ name: string }>(client1, 'opponent_joined');
    client2.emit('join_room', { code, playerName: 'Nikhil' });
    await opponentJoined;

    // Select leads
    const battleStart1 = waitForEvent<BattleStartPayload>(client1, 'battle_start');
    const battleStart2 = waitForEvent<BattleStartPayload>(client2, 'battle_start');

    client1.emit('select_lead', { pokemonIndex: 0, itemMode: 'competitive' });
    client2.emit('select_lead', { pokemonIndex: 0, itemMode: 'competitive' });

    const [start1, start2] = await Promise.all([battleStart1, battleStart2]);

    expect(start1.yourPlayerIndex).toBe(0);
    expect(start2.yourPlayerIndex).toBe(1);
    expect(start1.yourTeam).toHaveLength(6);
    expect(start2.yourTeam).toHaveLength(6);
    // Teams should be different
    expect(start1.yourTeam[0].species.name).not.toBe(start2.yourTeam[0].species.name);

    // Play a turn — both use move 0
    const turnResult1 = waitForEvent<TurnResultPayload>(client1, 'turn_result');
    const turnResult2 = waitForEvent<TurnResultPayload>(client2, 'turn_result');

    client1.emit('submit_action', { type: 'move', index: 0 });
    client2.emit('submit_action', { type: 'move', index: 0 });

    const [tr1, tr2] = await Promise.all([turnResult1, turnResult2]);

    expect(tr1.turn).toBeGreaterThan(0);
    expect(tr1.events.length).toBeGreaterThan(0);
    expect(tr1.yourState.team).toHaveLength(6);
    expect(tr1.opponentVisible.teamSize).toBe(6);
    // p1 should not see opponent's moves
    expect(tr1.opponentVisible.activePokemon).not.toHaveProperty('moves');

    // Forfeit
    const battleEnd1 = waitForEvent<BattleEndPayload>(client1, 'battle_end');
    const battleEnd2 = waitForEvent<BattleEndPayload>(client2, 'battle_end');

    client1.emit('forfeit');

    const [end1, end2] = await Promise.all([battleEnd1, battleEnd2]);

    expect(end1.winner).toBe('Nikhil');
    expect(end2.winner).toBe('Nikhil');
    expect(end1.reason).toBe('forfeit');
    // On battle end, opponent team is fully revealed
    expect(end1.finalState.opponentTeam).toHaveLength(6);
    expect(end1.finalState.opponentTeam[0]).toHaveProperty('moves');
  });

  it('handles switch actions', async () => {
    // Create and join room
    const roomCreated = waitForEvent<{ code: string }>(client1, 'room_created');
    client1.emit('create_room', { playerName: 'Tanmay' });
    const { code } = await roomCreated;

    client2.emit('join_room', { code, playerName: 'Nikhil' });
    await waitForEvent(client1, 'opponent_joined');

    // Start battle
    const battleStart1 = waitForEvent<BattleStartPayload>(client1, 'battle_start');
    client1.emit('select_lead', { pokemonIndex: 0, itemMode: 'competitive' });
    client2.emit('select_lead', { pokemonIndex: 0, itemMode: 'competitive' });
    await battleStart1;

    // Player 1 switches, player 2 attacks
    const turnResult1 = waitForEvent<TurnResultPayload>(client1, 'turn_result');
    client1.emit('submit_action', { type: 'switch', index: 1 });
    client2.emit('submit_action', { type: 'move', index: 0 });

    const tr = await turnResult1;
    expect(tr.turn).toBeGreaterThan(0);
    // After switch, active Pokemon index should have changed
    expect(tr.yourState.activePokemonIndex).toBe(1);
  });

  it('rejects join for non-existent room', async () => {
    const errorEvent = waitForEvent<{ message: string }>(client1, 'error');
    client1.emit('join_room', { code: 'ZZZZZZ', playerName: 'Test' });
    const err = await errorEvent;
    expect(err.message).toBe('Room not found');
  });

  it('rejects actions when not in a room', async () => {
    const errorEvent = waitForEvent<{ message: string }>(client1, 'error');
    client1.emit('submit_action', { type: 'move', index: 0 });
    const err = await errorEvent;
    expect(err.message).toBe('Not in a room');
  });
});
