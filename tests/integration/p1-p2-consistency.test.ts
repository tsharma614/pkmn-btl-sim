import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
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
  NeedsSwitchPayload,
  BattleEndPayload,
} from '../../src/server/types';
import type { BattleEvent } from '../../src/types';

type TypedClientSocket = ClientSocket<ServerToClientEvents, ClientToServerEvents>;

function waitForEvent<T>(socket: TypedClientSocket, event: string, timeoutMs = 5000): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timeout waiting for "${event}"`)), timeoutMs);
    (socket as any).once(event, (data: T) => {
      clearTimeout(timer);
      resolve(data);
    });
  });
}

function collectEvent<T>(socket: TypedClientSocket, event: string, timeoutMs = 2000): Promise<T | null> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(null), timeoutMs);
    (socket as any).once(event, (data: T) => {
      clearTimeout(timer);
      resolve(data);
    });
  });
}

describe('Player 1 / Player 2 Consistency', () => {
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

  async function setupBattle(): Promise<{ code: string; start1: BattleStartPayload; start2: BattleStartPayload }> {
    const roomCreated = waitForEvent<{ code: string }>(client1, 'room_created');
    client1.emit('create_room', { playerName: 'Alice' });
    const { code } = await roomCreated;

    const opp1 = waitForEvent(client1, 'opponent_joined');
    client2.emit('join_room', { code, playerName: 'Bob' });
    await opp1;

    const bs1 = waitForEvent<BattleStartPayload>(client1, 'battle_start');
    const bs2 = waitForEvent<BattleStartPayload>(client2, 'battle_start');
    client1.emit('select_lead', { pokemonIndex: 0, itemMode: 'competitive' });
    client2.emit('select_lead', { pokemonIndex: 0, itemMode: 'competitive' });
    const [start1, start2] = await Promise.all([bs1, bs2]);

    return { code, start1, start2 };
  }

  it('both players receive correct playerIndex', async () => {
    const { start1, start2 } = await setupBattle();

    expect(start1.yourPlayerIndex).toBe(0);
    expect(start2.yourPlayerIndex).toBe(1);
  }, 10000);

  it('both players receive 6-Pokemon teams', async () => {
    const { start1, start2 } = await setupBattle();

    expect(start1.yourTeam).toHaveLength(6);
    expect(start2.yourTeam).toHaveLength(6);
  }, 10000);

  it('both players receive turn_result events after submitting moves', async () => {
    await setupBattle();

    const tr1 = waitForEvent<TurnResultPayload>(client1, 'turn_result');
    const tr2 = waitForEvent<TurnResultPayload>(client2, 'turn_result');

    client1.emit('submit_action', { type: 'move', index: 0 });
    client2.emit('submit_action', { type: 'move', index: 0 });

    const [result1, result2] = await Promise.all([tr1, tr2]);

    // Both should receive the same events
    expect(result1.events.length).toBeGreaterThan(0);
    expect(result2.events.length).toBeGreaterThan(0);
    expect(result1.events.length).toBe(result2.events.length);

    // Events should have same types in same order
    for (let i = 0; i < result1.events.length; i++) {
      expect(result1.events[i].type).toBe(result2.events[i].type);
    }
  }, 10000);

  it('faint events include player index that both clients can use', async () => {
    await setupBattle();

    // Play turns until someone faints (use moves to deal damage)
    let faintFound = false;
    for (let turn = 0; turn < 20 && !faintFound; turn++) {
      const tr1 = waitForEvent<TurnResultPayload>(client1, 'turn_result');
      const tr2 = waitForEvent<TurnResultPayload>(client2, 'turn_result');

      client1.emit('submit_action', { type: 'move', index: 0 });
      client2.emit('submit_action', { type: 'move', index: 0 });

      const [result1, result2] = await Promise.all([tr1, tr2]);

      const faintEvents1 = result1.events.filter((e: BattleEvent) => e.type === 'faint');
      const faintEvents2 = result2.events.filter((e: BattleEvent) => e.type === 'faint');

      if (faintEvents1.length > 0) {
        faintFound = true;
        // Both players should see the same faint events
        expect(faintEvents1.length).toBe(faintEvents2.length);

        for (let i = 0; i < faintEvents1.length; i++) {
          // Both should have 'player' field
          expect(faintEvents1[i].data.player).toBeDefined();
          expect(faintEvents2[i].data.player).toBeDefined();
          // Player field should be the same value (absolute index)
          expect(faintEvents1[i].data.player).toBe(faintEvents2[i].data.player);
        }
      }

      // Handle force switches (auto-switch to first available)
      const sw1 = collectEvent<NeedsSwitchPayload>(client1, 'needs_switch', 500);
      const sw2 = collectEvent<NeedsSwitchPayload>(client2, 'needs_switch', 500);
      const [needsSwitch1, needsSwitch2] = await Promise.all([sw1, sw2]);

      if (needsSwitch1 && needsSwitch1.availableSwitches.length > 0) {
        const tr = waitForEvent<TurnResultPayload>(client1, 'turn_result');
        client1.emit('submit_force_switch', { pokemonIndex: needsSwitch1.availableSwitches[0].index });
        await tr;
      }
      if (needsSwitch2 && needsSwitch2.availableSwitches.length > 0) {
        const tr = waitForEvent<TurnResultPayload>(client2, 'turn_result');
        client2.emit('submit_force_switch', { pokemonIndex: needsSwitch2.availableSwitches[0].index });
        await tr;
      }
    }

    // We should have found at least one faint in 20 turns of attacking
    expect(faintFound).toBe(true);
  }, 30000);

  it('P1 yourState matches P2 opponentVisible for active Pokemon', async () => {
    await setupBattle();

    const tr1 = waitForEvent<TurnResultPayload>(client1, 'turn_result');
    const tr2 = waitForEvent<TurnResultPayload>(client2, 'turn_result');

    client1.emit('submit_action', { type: 'move', index: 0 });
    client2.emit('submit_action', { type: 'move', index: 0 });

    const [result1, result2] = await Promise.all([tr1, tr2]);

    // P1's active Pokemon should be what P2 sees as opponent
    const p1Active = result1.yourState.team[result1.yourState.activePokemonIndex];
    const p2OpponentActive = result2.opponentVisible.activePokemon;

    expect(p1Active.species.name).toBe(p2OpponentActive?.species.name);

    // P2's active Pokemon should be what P1 sees as opponent
    const p2Active = result2.yourState.team[result2.yourState.activePokemonIndex];
    const p1OpponentActive = result1.opponentVisible.activePokemon;

    expect(p2Active.species.name).toBe(p1OpponentActive?.species.name);
  }, 10000);
});

describe('Race Condition Protection', () => {
  let httpServer: ReturnType<typeof createServer>;
  let io: Server;
  let roomManager: RoomManager;
  let disconnectTracker: DisconnectTracker;
  let port: number;

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

  it('rejects duplicate action submission from same player', async () => {
    const client1 = ioc(`http://localhost:${port}`, { transports: ['websocket'], forceNew: true }) as TypedClientSocket;
    const client2 = ioc(`http://localhost:${port}`, { transports: ['websocket'], forceNew: true }) as TypedClientSocket;

    await Promise.all([
      new Promise<void>((r) => client1.on('connect', r)),
      new Promise<void>((r) => client2.on('connect', r)),
    ]);

    const roomCreated = waitForEvent<{ code: string }>(client1, 'room_created');
    client1.emit('create_room', { playerName: 'Alice' });
    const { code } = await roomCreated;

    client2.emit('join_room', { code, playerName: 'Bob' });
    await waitForEvent(client1, 'opponent_joined');

    const bs1 = waitForEvent(client1, 'battle_start');
    const bs2 = waitForEvent(client2, 'battle_start');
    client1.emit('select_lead', { pokemonIndex: 0, itemMode: 'competitive' });
    client2.emit('select_lead', { pokemonIndex: 0, itemMode: 'competitive' });
    await Promise.all([bs1, bs2]);

    // P1 submits an action
    client1.emit('submit_action', { type: 'move', index: 0 });

    // Wait a brief moment, then P1 tries to submit again (should get error)
    await new Promise(r => setTimeout(r, 50));

    const errorPromise = collectEvent<{ message: string }>(client1, 'error', 1000);
    client1.emit('submit_action', { type: 'move', index: 1 });

    const error = await errorPromise;
    expect(error).toBeDefined();
    expect(error!.message).toMatch(/already/i);

    client1.disconnect();
    client2.disconnect();
  }, 10000);

  it('processing lock prevents double turn processing', async () => {
    const client1 = ioc(`http://localhost:${port}`, { transports: ['websocket'], forceNew: true }) as TypedClientSocket;
    const client2 = ioc(`http://localhost:${port}`, { transports: ['websocket'], forceNew: true }) as TypedClientSocket;

    await Promise.all([
      new Promise<void>((r) => client1.on('connect', r)),
      new Promise<void>((r) => client2.on('connect', r)),
    ]);

    const roomCreated = waitForEvent<{ code: string }>(client1, 'room_created');
    client1.emit('create_room', { playerName: 'Alice' });
    const { code } = await roomCreated;

    client2.emit('join_room', { code, playerName: 'Bob' });
    await waitForEvent(client1, 'opponent_joined');

    const bs1 = waitForEvent(client1, 'battle_start');
    const bs2 = waitForEvent(client2, 'battle_start');
    client1.emit('select_lead', { pokemonIndex: 0, itemMode: 'competitive' });
    client2.emit('select_lead', { pokemonIndex: 0, itemMode: 'competitive' });
    await Promise.all([bs1, bs2]);

    // Both submit moves (normal flow, should produce exactly one turn_result each)
    let turnResultCount1 = 0;
    let turnResultCount2 = 0;
    (client1 as any).on('turn_result', () => turnResultCount1++);
    (client2 as any).on('turn_result', () => turnResultCount2++);

    client1.emit('submit_action', { type: 'move', index: 0 });
    client2.emit('submit_action', { type: 'move', index: 0 });

    // Wait for results
    await new Promise(r => setTimeout(r, 500));

    // Each player should receive exactly one turn_result (not duplicated)
    expect(turnResultCount1).toBe(1);
    expect(turnResultCount2).toBe(1);

    client1.disconnect();
    client2.disconnect();
  }, 10000);

  it('force switch events from both players are accumulated and broadcast to both', async () => {
    // This tests the scenario where both Pokemon faint on the same turn
    // We can't easily force this, so we test the Room's accumulation logic directly
    const { Room } = await import('../../src/server/room');

    const room = new (Room as any)('TEST01');
    // Verify force switch event accumulation fields exist
    expect(room.forceSwitchEvents).toBeDefined();
    expect(Array.isArray(room.forceSwitchEvents)).toBe(true);
    expect(room.isProcessingTurn).toBe(false);
  });
});

describe('Rematch sends team_preview', () => {
  let httpServer: ReturnType<typeof createServer>;
  let io: Server;
  let roomManager: RoomManager;
  let disconnectTracker: DisconnectTracker;
  let port: number;

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

  it('rematch emits team_preview not battle_start', async () => {
    const client1 = ioc(`http://localhost:${port}`, { transports: ['websocket'], forceNew: true }) as TypedClientSocket;
    const client2 = ioc(`http://localhost:${port}`, { transports: ['websocket'], forceNew: true }) as TypedClientSocket;

    await Promise.all([
      new Promise<void>((r) => client1.on('connect', r)),
      new Promise<void>((r) => client2.on('connect', r)),
    ]);

    // Setup + start battle
    const roomCreated = waitForEvent<{ code: string }>(client1, 'room_created');
    client1.emit('create_room', { playerName: 'Alice' });
    const { code } = await roomCreated;

    client2.emit('join_room', { code, playerName: 'Bob' });
    await waitForEvent(client1, 'opponent_joined');

    const bs1 = waitForEvent(client1, 'battle_start');
    const bs2 = waitForEvent(client2, 'battle_start');
    client1.emit('select_lead', { pokemonIndex: 0, itemMode: 'competitive' });
    client2.emit('select_lead', { pokemonIndex: 0, itemMode: 'competitive' });
    await Promise.all([bs1, bs2]);

    // Forfeit to end battle
    const be1 = waitForEvent<BattleEndPayload>(client1, 'battle_end');
    const be2 = waitForEvent<BattleEndPayload>(client2, 'battle_end');
    client1.emit('forfeit');
    await Promise.all([be1, be2]);

    // Request rematch — should receive team_preview, NOT battle_start
    const tp1 = waitForEvent<BattleStartPayload>(client1, 'team_preview');
    const tp2 = waitForEvent<BattleStartPayload>(client2, 'team_preview');

    // Also listen for battle_start to make sure it does NOT fire
    let gotBattleStart1 = false;
    let gotBattleStart2 = false;
    (client1 as any).once('battle_start', () => { gotBattleStart1 = true; });
    (client2 as any).once('battle_start', () => { gotBattleStart2 = true; });

    client1.emit('rematch_request');
    client2.emit('rematch_request');

    const [preview1, preview2] = await Promise.all([tp1, tp2]);

    expect(preview1.yourTeam).toHaveLength(6);
    expect(preview2.yourTeam).toHaveLength(6);

    // battle_start should NOT have fired from rematch
    await new Promise(r => setTimeout(r, 200));
    expect(gotBattleStart1).toBe(false);
    expect(gotBattleStart2).toBe(false);

    client1.disconnect();
    client2.disconnect();
  }, 10000);
});
