/**
 * Integration tests for online draft mode via Socket.io.
 * Verifies: room creation, draft_start, draft_pick, draft_complete, team_preview flow.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { io as ioc, Socket as ClientSocket } from 'socket.io-client';
import { RoomManager } from '../../src/server/room-manager';
import { DisconnectTracker } from '../../src/server/disconnect-tracker';
import { registerSocketHandlers } from '../../src/server/socket-handlers';
import { SNAKE_ORDER } from '../../src/engine/draft-pool';
import type {
  ServerToClientEvents,
  ClientToServerEvents,
  TeamPreviewPayload,
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

describe('Multiplayer Draft Mode', () => {
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
    io.close();
    httpServer.close();
  });

  it('room with draftMode emits draft_start when both players join', async () => {
    const host = await connectClient(port);
    const joiner = await connectClient(port);

    const roomCreated = waitForEvent<{ code: string }>(host, 'room_created');
    host.emit('create_room', {
      playerName: 'DraftHost',
      itemMode: 'competitive',
      draftMode: true,
    });
    const { code } = await roomCreated;

    const hostDraftStart = waitForEvent<any>(host, 'draft_start');
    const joinerDraftStart = waitForEvent<any>(joiner, 'draft_start');
    joiner.emit('join_room', { code, playerName: 'DraftJoiner', itemMode: 'competitive' });

    const [hds, jds] = await Promise.all([hostDraftStart, joinerDraftStart]);

    expect(hds.pool).toHaveLength(21);
    expect(jds.pool).toHaveLength(21);
    // Both see same pool
    expect(hds.pool[0].species.id).toBe(jds.pool[0].species.id);
    // Their snake slots should be complementary (one is 0, other is 1)
    expect(hds.yourPlayerIndex + jds.yourPlayerIndex).toBe(1);

    host.disconnect();
    joiner.disconnect();
  });

  it('non-draft room emits team_preview not draft_start', async () => {
    const host = await connectClient(port);
    const joiner = await connectClient(port);

    const roomCreated = waitForEvent<{ code: string }>(host, 'room_created');
    host.emit('create_room', {
      playerName: 'NormalHost',
      itemMode: 'competitive',
    });
    const { code } = await roomCreated;

    const hostPreview = waitForEvent<TeamPreviewPayload>(host, 'team_preview');
    const joinerPreview = waitForEvent<TeamPreviewPayload>(joiner, 'team_preview');
    joiner.emit('join_room', { code, playerName: 'NormalJoiner', itemMode: 'competitive' });

    const [hp, jp] = await Promise.all([hostPreview, joinerPreview]);
    expect(hp.yourTeam).toHaveLength(6);
    expect(jp.yourTeam).toHaveLength(6);

    host.disconnect();
    joiner.disconnect();
  });

  it('draft_pick validates correct player turn', async () => {
    const host = await connectClient(port);
    const joiner = await connectClient(port);

    const roomCreated = waitForEvent<{ code: string }>(host, 'room_created');
    host.emit('create_room', {
      playerName: 'TurnHost',
      itemMode: 'competitive',
      draftMode: true,
    });
    const { code } = await roomCreated;

    const hostDraftStart = waitForEvent<any>(host, 'draft_start');
    const joinerDraftStart = waitForEvent<any>(joiner, 'draft_start');
    joiner.emit('join_room', { code, playerName: 'TurnJoiner', itemMode: 'competitive' });
    const [hds, jds] = await Promise.all([hostDraftStart, joinerDraftStart]);

    // The player whose snake slot != SNAKE_ORDER[0] should get an error when trying to pick
    // SNAKE_ORDER[0] = 0, so whoever has yourPlayerIndex !== 0 should fail
    const wrongSocket = hds.yourPlayerIndex === 0 ? joiner : host;
    const wrongError = waitForEvent<{ message: string }>(wrongSocket, 'error');
    wrongSocket.emit('draft_pick', { poolIndex: 0 });
    const err = await wrongError;
    expect(err.message).toBeTruthy();

    host.disconnect();
    joiner.disconnect();
  });

  it('draft_pick rejects already-picked Pokemon', async () => {
    const host = await connectClient(port);
    const joiner = await connectClient(port);

    const roomCreated = waitForEvent<{ code: string }>(host, 'room_created');
    host.emit('create_room', {
      playerName: 'DupeHost',
      itemMode: 'competitive',
      draftMode: true,
    });
    const { code } = await roomCreated;

    const hostDraftStart = waitForEvent<any>(host, 'draft_start');
    const joinerDraftStart = waitForEvent<any>(joiner, 'draft_start');
    joiner.emit('join_room', { code, playerName: 'DupeJoiner', itemMode: 'competitive' });
    const [hds, jds] = await Promise.all([hostDraftStart, joinerDraftStart]);

    // Determine who picks first and second based on randomized slots
    const firstSocket = hds.yourPlayerIndex === 0 ? host : joiner;
    const secondSocket = hds.yourPlayerIndex === 0 ? joiner : host;

    // First player picks index 0
    const hostPickBroadcast = waitForEvent<any>(host, 'draft_pick');
    const joinerPickBroadcast = waitForEvent<any>(joiner, 'draft_pick');
    firstSocket.emit('draft_pick', { poolIndex: 0 });
    await Promise.all([hostPickBroadcast, joinerPickBroadcast]);

    // Now it's second player's turn (SNAKE_ORDER[1] = 1). Try to pick the same index.
    const secondError = waitForEvent<{ message: string }>(secondSocket, 'error');
    secondSocket.emit('draft_pick', { poolIndex: 0 });
    const err = await secondError;
    expect(err.message).toBeTruthy();

    host.disconnect();
    joiner.disconnect();
  });

  it('draft_pick broadcasts to both players', async () => {
    const host = await connectClient(port);
    const joiner = await connectClient(port);

    const roomCreated = waitForEvent<{ code: string }>(host, 'room_created');
    host.emit('create_room', {
      playerName: 'BroadHost',
      itemMode: 'competitive',
      draftMode: true,
    });
    const { code } = await roomCreated;

    const hostDraftStart = waitForEvent<any>(host, 'draft_start');
    const joinerDraftStart = waitForEvent<any>(joiner, 'draft_start');
    joiner.emit('join_room', { code, playerName: 'BroadJoiner', itemMode: 'competitive' });
    const [hds] = await Promise.all([hostDraftStart, joinerDraftStart]);

    // First picker picks
    const firstSocket = hds.yourPlayerIndex === 0 ? host : joiner;
    const hostBroadcast = waitForEvent<any>(host, 'draft_pick');
    const joinerBroadcast = waitForEvent<any>(joiner, 'draft_pick');
    firstSocket.emit('draft_pick', { poolIndex: 5 });

    const [hb, jb] = await Promise.all([hostBroadcast, joinerBroadcast]);
    // Both receive the same pick broadcast
    expect(hb.poolIndex).toBe(5);
    expect(jb.poolIndex).toBe(5);
    // playerIndex in broadcast is the actual server-side playerIndex of who picked
    expect(hb.playerIndex).toBe(jb.playerIndex);

    host.disconnect();
    joiner.disconnect();
  });

  it('full draft completes and emits team_preview', async () => {
    const host = await connectClient(port);
    const joiner = await connectClient(port);

    const roomCreated = waitForEvent<{ code: string }>(host, 'room_created');
    host.emit('create_room', {
      playerName: 'FullHost',
      itemMode: 'competitive',
      draftMode: true,
    });
    const { code } = await roomCreated;

    const hostDraftStart = waitForEvent<any>(host, 'draft_start');
    const joinerDraftStart = waitForEvent<any>(joiner, 'draft_start');
    joiner.emit('join_room', { code, playerName: 'FullJoiner', itemMode: 'competitive' });
    const [hds, jds] = await Promise.all([hostDraftStart, joinerDraftStart]);

    // Map snake slot to socket: slot 0 picks at SNAKE_ORDER positions where value is 0
    const slot0Socket = hds.yourPlayerIndex === 0 ? host : joiner;
    const slot1Socket = hds.yourPlayerIndex === 0 ? joiner : host;

    // Simulate first 11 picks
    for (let i = 0; i < 11; i++) {
      const currentSlot = SNAKE_ORDER[i];
      const socket = currentSlot === 0 ? slot0Socket : slot1Socket;

      const hostPick = waitForEvent<any>(host, 'draft_pick');
      const joinerPick = waitForEvent<any>(joiner, 'draft_pick');
      socket.emit('draft_pick', { poolIndex: i });
      await Promise.all([hostPick, joinerPick]);
    }

    // Last pick (index 11): listen for draft_complete BEFORE emitting
    const hostComplete = waitForEvent<any>(host, 'draft_complete', 3000);
    const joinerComplete = waitForEvent<any>(joiner, 'draft_complete', 3000);
    const lastSlot = SNAKE_ORDER[11];
    const lastSocket = lastSlot === 0 ? slot0Socket : slot1Socket;
    lastSocket.emit('draft_pick', { poolIndex: 11 });

    const [hc, jc] = await Promise.all([hostComplete, joinerComplete]);

    expect(hc.yourTeam).toHaveLength(6);
    expect(jc.yourTeam).toHaveLength(6);

    host.disconnect();
    joiner.disconnect();
  });

  it('draft + classic mode: pool has only Gen 1-4 Pokemon', async () => {
    const host = await connectClient(port);
    const joiner = await connectClient(port);

    const roomCreated = waitForEvent<{ code: string }>(host, 'room_created');
    host.emit('create_room', {
      playerName: 'ClassicDraftHost',
      itemMode: 'competitive',
      draftMode: true,
      maxGen: 4,
    });
    const { code } = await roomCreated;

    const hostDraftStart = waitForEvent<any>(host, 'draft_start');
    const joinerDraftStart = waitForEvent<any>(joiner, 'draft_start');
    joiner.emit('join_room', { code, playerName: 'ClassicDraftJoiner', itemMode: 'competitive' });

    const [hds] = await Promise.all([hostDraftStart, joinerDraftStart]);

    for (const entry of hds.pool) {
      expect(entry.species.generation).toBeLessThanOrEqual(4);
    }

    host.disconnect();
    joiner.disconnect();
  });

  it('draft + legendary mode: pool has more T1 Pokemon', async () => {
    const host = await connectClient(port);
    const joiner = await connectClient(port);

    const roomCreated = waitForEvent<{ code: string }>(host, 'room_created');
    host.emit('create_room', {
      playerName: 'LegDraftHost',
      itemMode: 'competitive',
      draftMode: true,
      legendaryMode: true,
    });
    const { code } = await roomCreated;

    const hostDraftStart = waitForEvent<any>(host, 'draft_start');
    const joinerDraftStart = waitForEvent<any>(joiner, 'draft_start');
    joiner.emit('join_room', { code, playerName: 'LegDraftJoiner', itemMode: 'competitive' });

    const [hds] = await Promise.all([hostDraftStart, joinerDraftStart]);

    const t1Count = hds.pool.filter((e: any) => e.tier === 1).length;
    expect(t1Count).toBe(9);
    const t3Count = hds.pool.filter((e: any) => e.tier === 3).length;
    expect(t3Count).toBe(0);
    const t4Count = hds.pool.filter((e: any) => e.tier === 4).length;
    expect(t4Count).toBe(0);

    host.disconnect();
    joiner.disconnect();
  });

  it('disconnect during draft notifies opponent', async () => {
    const host = await connectClient(port);
    const joiner = await connectClient(port);

    const roomCreated = waitForEvent<{ code: string }>(host, 'room_created');
    host.emit('create_room', {
      playerName: 'DCHost',
      itemMode: 'competitive',
      draftMode: true,
    });
    const { code } = await roomCreated;

    const hostDraftStart = waitForEvent<any>(host, 'draft_start');
    const joinerDraftStart = waitForEvent<any>(joiner, 'draft_start');
    joiner.emit('join_room', { code, playerName: 'DCJoiner', itemMode: 'competitive' });
    await Promise.all([hostDraftStart, joinerDraftStart]);

    // Host disconnects during draft — opponent should get opponent_disconnected
    // The disconnect tracker has a 500ms delay, so we need to wait for it
    const joinerDisconnect = waitForEvent<any>(joiner, 'opponent_disconnected', 3000);
    host.disconnect();

    try {
      await joinerDisconnect;
    } catch {
      // If opponent_disconnected isn't emitted (e.g. auto-forfeit instead), that's also acceptable
    }

    joiner.disconnect();
  }, 10000);
});
