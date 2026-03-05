import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { io as ioc, Socket as ClientSocket } from 'socket.io-client';
import { RoomManager } from '../../src/server/room-manager';
import { DisconnectTracker } from '../../src/server/disconnect-tracker';
import { registerSocketHandlers } from '../../src/server/socket-handlers';
import type {
  ServerToClientEvents,
  ClientToServerEvents,
  BattleStartPayload,
  TurnResultPayload,
  BattleEndPayload,
} from '../../src/server/types';

type TypedClientSocket = ClientSocket<ServerToClientEvents, ClientToServerEvents>;

function waitForEvent<T>(socket: TypedClientSocket, event: string, timeoutMs = 5000): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timeout waiting for event: ${event}`)), timeoutMs);
    (socket as any).once(event, (data: T) => {
      clearTimeout(timer);
      resolve(data);
    });
  });
}

function connectClient(port: number): Promise<TypedClientSocket> {
  const client = ioc(`http://localhost:${port}`, {
    transports: ['websocket'],
    forceNew: true,
  }) as TypedClientSocket;
  return new Promise((resolve) => {
    client.on('connect', () => resolve(client));
  });
}

describe('Online Multiplayer Flow', () => {
  let httpServer: ReturnType<typeof createServer>;
  let io: Server;
  let roomManager: RoomManager;
  let disconnectTracker: DisconnectTracker;
  let port: number;

  beforeAll(async () => {
    httpServer = createServer();
    io = new Server(httpServer, { cors: { origin: '*' } });
    roomManager = new RoomManager();
    disconnectTracker = new DisconnectTracker(500);
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

  // ========== Room Creation ==========
  describe('room creation', () => {
    it('creates a room and returns 6-character code', async () => {
      const client = await connectClient(port);
      const roomCreated = waitForEvent<{ code: string }>(client, 'room_created');
      client.emit('create_room', { playerName: 'Tanmay' });
      const result = await roomCreated;
      expect(result.code).toHaveLength(6);
      expect(result.code).toMatch(/^[A-Z0-9]{6}$/);
      client.disconnect();
    });

    it('each room gets a unique code', async () => {
      const client1 = await connectClient(port);
      const client2 = await connectClient(port);

      const rc1 = waitForEvent<{ code: string }>(client1, 'room_created');
      const rc2 = waitForEvent<{ code: string }>(client2, 'room_created');

      client1.emit('create_room', { playerName: 'Tanmay' });
      client2.emit('create_room', { playerName: 'Nikhil' });

      const [r1, r2] = await Promise.all([rc1, rc2]);
      expect(r1.code).not.toBe(r2.code);

      client1.disconnect();
      client2.disconnect();
    });
  });

  // ========== Room Joining ==========
  describe('room joining', () => {
    it('second player joins and both get opponent_joined', async () => {
      const client1 = await connectClient(port);
      const client2 = await connectClient(port);

      const roomCreated = waitForEvent<{ code: string }>(client1, 'room_created');
      client1.emit('create_room', { playerName: 'Tanmay' });
      const { code } = await roomCreated;

      const opp1 = waitForEvent<{ name: string }>(client1, 'opponent_joined');
      const opp2 = waitForEvent<{ name: string }>(client2, 'opponent_joined');
      client2.emit('join_room', { code, playerName: 'Nikhil' });

      const [r1, r2] = await Promise.all([opp1, opp2]);
      expect(r1.name).toBe('Nikhil');
      expect(r2.name).toBe('Tanmay');

      client1.disconnect();
      client2.disconnect();
    });

    it('rejects join for non-existent room', async () => {
      const client = await connectClient(port);
      const errorEvent = waitForEvent<{ message: string }>(client, 'error');
      client.emit('join_room', { code: 'ZZZZZZ', playerName: 'Test' });
      const err = await errorEvent;
      expect(err.message).toBe('Room not found');
      client.disconnect();
    });

    it('rejects join for a room not accepting players', async () => {
      const client1 = await connectClient(port);
      const client2 = await connectClient(port);
      const client3 = await connectClient(port);

      const roomCreated = waitForEvent<{ code: string }>(client1, 'room_created');
      client1.emit('create_room', { playerName: 'Tanmay' });
      const { code } = await roomCreated;

      // Wait for join to complete (room transitions to team_preview)
      const opp1 = waitForEvent<{ name: string }>(client1, 'opponent_joined');
      client2.emit('join_room', { code, playerName: 'Nikhil' });
      await opp1;

      // Third player tries to join — room is in team_preview, not waiting
      const errorEvent = waitForEvent<{ message: string }>(client3, 'error');
      client3.emit('join_room', { code, playerName: 'Som' });
      const err = await errorEvent;
      expect(err.message).toBe('Room is not accepting new players');

      client1.disconnect();
      client2.disconnect();
      client3.disconnect();
    });
  });

  // ========== Battle Start with Opponent Lead ==========
  describe('battle_start payload', () => {
    it('includes opponentLead and opponentName when battle starts', async () => {
      const client1 = await connectClient(port);
      const client2 = await connectClient(port);

      // Create and join
      const roomCreated = waitForEvent<{ code: string }>(client1, 'room_created');
      client1.emit('create_room', { playerName: 'Tanmay' });
      const { code } = await roomCreated;

      client2.emit('join_room', { code, playerName: 'Nikhil' });
      await waitForEvent(client1, 'opponent_joined');

      // Select leads
      const bs1 = waitForEvent<BattleStartPayload>(client1, 'battle_start');
      const bs2 = waitForEvent<BattleStartPayload>(client2, 'battle_start');
      client1.emit('select_lead', { pokemonIndex: 0, itemMode: 'competitive' });
      client2.emit('select_lead', { pokemonIndex: 0, itemMode: 'competitive' });

      const [start1, start2] = await Promise.all([bs1, bs2]);

      // Both should have opponent lead info
      expect(start1.opponentLead).toBeDefined();
      expect(start1.opponentName).toBe('Nikhil');
      expect(start1.opponentLead!.species).toBeDefined();
      expect(start1.opponentLead!.currentHp).toBeGreaterThan(0);
      expect(start1.opponentLead!.isAlive).toBe(true);

      expect(start2.opponentLead).toBeDefined();
      expect(start2.opponentName).toBe('Tanmay');

      // Opponent lead should not have private info
      expect(start1.opponentLead).not.toHaveProperty('stats');
      expect(start1.opponentLead).not.toHaveProperty('moves');
      expect(start1.opponentLead).not.toHaveProperty('item');

      // Players should have different teams
      expect(start1.yourTeam[0].species.name).not.toBe(start2.yourTeam[0].species.name);

      client1.disconnect();
      client2.disconnect();
    });

    it('player indices are correct and complementary', async () => {
      const client1 = await connectClient(port);
      const client2 = await connectClient(port);

      const roomCreated = waitForEvent<{ code: string }>(client1, 'room_created');
      client1.emit('create_room', { playerName: 'Tanmay' });
      const { code } = await roomCreated;

      client2.emit('join_room', { code, playerName: 'Nikhil' });
      await waitForEvent(client1, 'opponent_joined');

      const bs1 = waitForEvent<BattleStartPayload>(client1, 'battle_start');
      const bs2 = waitForEvent<BattleStartPayload>(client2, 'battle_start');
      client1.emit('select_lead', { pokemonIndex: 0, itemMode: 'competitive' });
      client2.emit('select_lead', { pokemonIndex: 0, itemMode: 'competitive' });

      const [start1, start2] = await Promise.all([bs1, bs2]);
      expect(start1.yourPlayerIndex).toBe(0);
      expect(start2.yourPlayerIndex).toBe(1);

      client1.disconnect();
      client2.disconnect();
    });
  });

  // ========== Full Online Battle ==========
  describe('full online battle', () => {
    it('plays turns and forfeits correctly', async () => {
      const client1 = await connectClient(port);
      const client2 = await connectClient(port);

      // Setup
      const roomCreated = waitForEvent<{ code: string }>(client1, 'room_created');
      client1.emit('create_room', { playerName: 'Tanmay' });
      const { code } = await roomCreated;

      client2.emit('join_room', { code, playerName: 'Nikhil' });
      await waitForEvent(client1, 'opponent_joined');

      // Start battle
      const bs1 = waitForEvent<BattleStartPayload>(client1, 'battle_start');
      client1.emit('select_lead', { pokemonIndex: 0, itemMode: 'competitive' });
      client2.emit('select_lead', { pokemonIndex: 0, itemMode: 'competitive' });
      await bs1;

      // Play a turn
      const tr1 = waitForEvent<TurnResultPayload>(client1, 'turn_result');
      const tr2 = waitForEvent<TurnResultPayload>(client2, 'turn_result');
      client1.emit('submit_action', { type: 'move', index: 0 });
      client2.emit('submit_action', { type: 'move', index: 0 });
      const [turn1, turn2] = await Promise.all([tr1, tr2]);

      expect(turn1.turn).toBeGreaterThan(0);
      expect(turn2.turn).toBe(turn1.turn);
      expect(turn1.events.length).toBeGreaterThan(0);

      // Forfeit
      const be1 = waitForEvent<BattleEndPayload>(client1, 'battle_end');
      const be2 = waitForEvent<BattleEndPayload>(client2, 'battle_end');
      client1.emit('forfeit');
      const [end1, end2] = await Promise.all([be1, be2]);

      expect(end1.winner).toBe('Nikhil');
      expect(end2.winner).toBe('Nikhil');
      expect(end1.reason).toBe('forfeit');
      // Full reveal on battle end
      expect(end1.finalState.opponentTeam).toHaveLength(6);
      expect(end1.finalState.opponentTeam[0]).toHaveProperty('moves');

      client1.disconnect();
      client2.disconnect();
    });

    it('switch action works in online battle', async () => {
      const client1 = await connectClient(port);
      const client2 = await connectClient(port);

      const roomCreated = waitForEvent<{ code: string }>(client1, 'room_created');
      client1.emit('create_room', { playerName: 'Tanmay' });
      const { code } = await roomCreated;

      client2.emit('join_room', { code, playerName: 'Nikhil' });
      await waitForEvent(client1, 'opponent_joined');

      const bs1 = waitForEvent<BattleStartPayload>(client1, 'battle_start');
      client1.emit('select_lead', { pokemonIndex: 0, itemMode: 'competitive' });
      client2.emit('select_lead', { pokemonIndex: 0, itemMode: 'competitive' });
      await bs1;

      // Player 1 switches, player 2 attacks
      const tr1 = waitForEvent<TurnResultPayload>(client1, 'turn_result');
      client1.emit('submit_action', { type: 'switch', index: 1 });
      client2.emit('submit_action', { type: 'move', index: 0 });
      const turn = await tr1;

      expect(turn.yourState.activePokemonIndex).toBe(1);

      client1.disconnect();
      client2.disconnect();
    });
  });

  // ========== Error Cases ==========
  describe('error handling', () => {
    it('rejects action when not in a room', async () => {
      const client = await connectClient(port);
      const errorEvent = waitForEvent<{ message: string }>(client, 'error');
      client.emit('submit_action', { type: 'move', index: 0 });
      const err = await errorEvent;
      expect(err.message).toBe('Not in a room');
      client.disconnect();
    });

    it('rejects select_lead when not in a room', async () => {
      const client = await connectClient(port);
      const errorEvent = waitForEvent<{ message: string }>(client, 'error');
      client.emit('select_lead', { pokemonIndex: 0, itemMode: 'competitive' });
      const err = await errorEvent;
      expect(err.message).toBe('Not in a room');
      client.disconnect();
    });

    it('rejects create_room without player name', async () => {
      const client = await connectClient(port);
      const errorEvent = waitForEvent<{ message: string }>(client, 'error');
      client.emit('create_room', { playerName: '' });
      const err = await errorEvent;
      expect(err.message).toBe('Player name is required');
      client.disconnect();
    });
  });

  // ========== Disconnect + Auto-forfeit in Online ==========
  describe('disconnect in online mode', () => {
    it('auto-forfeits after disconnect timeout', async () => {
      const client1 = await connectClient(port);
      const client2 = await connectClient(port);

      const roomCreated = waitForEvent<{ code: string }>(client1, 'room_created');
      client1.emit('create_room', { playerName: 'Tanmay' });
      const { code } = await roomCreated;

      client2.emit('join_room', { code, playerName: 'Nikhil' });
      await waitForEvent(client1, 'opponent_joined');

      client1.emit('select_lead', { pokemonIndex: 0, itemMode: 'competitive' });
      client2.emit('select_lead', { pokemonIndex: 0, itemMode: 'competitive' });
      await waitForEvent(client1, 'battle_start');

      const battleEnd = waitForEvent<BattleEndPayload>(client2, 'battle_end');
      client1.disconnect();
      const endResult = await battleEnd;

      expect(endResult.winner).toBe('Nikhil');
      expect(endResult.reason).toBe('disconnect');

      client2.disconnect();
    }, 5000);
  });

  // ========== Rematch ==========
  describe('rematch flow', () => {
    it('both players can rematch after battle ends', async () => {
      const client1 = await connectClient(port);
      const client2 = await connectClient(port);

      // Setup + start battle
      const roomCreated = waitForEvent<{ code: string }>(client1, 'room_created');
      client1.emit('create_room', { playerName: 'Tanmay' });
      const { code } = await roomCreated;

      client2.emit('join_room', { code, playerName: 'Nikhil' });
      await waitForEvent(client1, 'opponent_joined');

      client1.emit('select_lead', { pokemonIndex: 0, itemMode: 'competitive' });
      client2.emit('select_lead', { pokemonIndex: 0, itemMode: 'competitive' });
      await waitForEvent(client1, 'battle_start');

      // Forfeit to end the battle
      const be1 = waitForEvent<BattleEndPayload>(client1, 'battle_end');
      client1.emit('forfeit');
      await be1;

      // Both request rematch — server emits team_preview for lead selection
      const bs1 = waitForEvent<BattleStartPayload>(client1, 'team_preview');
      const bs2 = waitForEvent<BattleStartPayload>(client2, 'team_preview');

      client1.emit('rematch_request');
      client2.emit('rematch_request');

      const [start1, start2] = await Promise.all([bs1, bs2]);
      expect(start1.yourTeam).toHaveLength(6);
      expect(start2.yourTeam).toHaveLength(6);

      client1.disconnect();
      client2.disconnect();
    }, 10000);
  });

  // ========== Solo room cleanup ==========
  describe('solo room cleanup', () => {
    it('cleans up room when creator disconnects before anyone joins', async () => {
      const client = await connectClient(port);

      const roomCreated = waitForEvent<{ code: string }>(client, 'room_created');
      client.emit('create_room', { playerName: 'Tanmay' });
      const { code } = await roomCreated;

      const roomBefore = roomManager.getRoom(code);
      expect(roomBefore).toBeDefined();

      client.disconnect();
      await new Promise((r) => setTimeout(r, 100));

      const roomAfter = roomManager.getRoom(code);
      expect(roomAfter).toBeUndefined();
    });
  });
});
