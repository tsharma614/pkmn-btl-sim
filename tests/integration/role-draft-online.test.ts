/**
 * Integration tests for online role draft mode via Socket.io.
 * Verifies: draftType threading, role draft pool, role-constrained picks, completion.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { io as ioc, Socket as ClientSocket } from 'socket.io-client';
import { RoomManager } from '../../src/server/room-manager';
import { DisconnectTracker } from '../../src/server/disconnect-tracker';
import { registerSocketHandlers } from '../../src/server/socket-handlers';
import { SNAKE_ORDER, DRAFT_ROLES } from '../../src/engine/draft-pool';
import type {
  ServerToClientEvents,
  ClientToServerEvents,
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

describe('Online Role Draft', () => {
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

  it('role draft room emits draft_start with draftType and roleOrder', async () => {
    const host = await connectClient(port);
    const joiner = await connectClient(port);

    const roomCreated = waitForEvent<{ code: string }>(host, 'room_created');
    host.emit('create_room', {
      playerName: 'RoleHost',
      itemMode: 'competitive',
      draftMode: true,
      draftType: 'role',
    });
    const { code } = await roomCreated;

    const hostDraftStart = waitForEvent<any>(host, 'draft_start');
    const joinerDraftStart = waitForEvent<any>(joiner, 'draft_start');
    joiner.emit('join_room', { code, playerName: 'RoleJoiner', itemMode: 'competitive' });

    const [hds, jds] = await Promise.all([hostDraftStart, joinerDraftStart]);

    // Pool should be 24 (4 per role x 6 roles)
    expect(hds.pool).toHaveLength(24);
    expect(jds.pool).toHaveLength(24);

    // draftType should be 'role'
    expect(hds.draftType).toBe('role');
    expect(jds.draftType).toBe('role');

    // roleOrder should have 6 roles
    expect(hds.roleOrder).toHaveLength(6);
    expect(jds.roleOrder).toHaveLength(6);

    // roleOrder should contain all DRAFT_ROLES
    for (const role of DRAFT_ROLES) {
      expect(hds.roleOrder).toContain(role);
    }

    // Both players see same pool and roleOrder
    expect(hds.pool[0].species.id).toBe(jds.pool[0].species.id);
    expect(hds.roleOrder).toEqual(jds.roleOrder);

    host.disconnect();
    joiner.disconnect();
  });

  it('snake draft room does NOT include draftType or roleOrder', async () => {
    const host = await connectClient(port);
    const joiner = await connectClient(port);

    const roomCreated = waitForEvent<{ code: string }>(host, 'room_created');
    host.emit('create_room', {
      playerName: 'SnakeHost',
      itemMode: 'competitive',
      draftMode: true,
    });
    const { code } = await roomCreated;

    const hostDraftStart = waitForEvent<any>(host, 'draft_start');
    const joinerDraftStart = waitForEvent<any>(joiner, 'draft_start');
    joiner.emit('join_room', { code, playerName: 'SnakeJoiner', itemMode: 'competitive' });

    const [hds] = await Promise.all([hostDraftStart, joinerDraftStart]);

    expect(hds.pool).toHaveLength(21);
    // draftType should be undefined or 'snake'
    expect(hds.draftType === undefined || hds.draftType === 'snake').toBe(true);

    host.disconnect();
    joiner.disconnect();
  });

  it('role draft rejects pick from wrong role', async () => {
    const host = await connectClient(port);
    const joiner = await connectClient(port);

    const roomCreated = waitForEvent<{ code: string }>(host, 'room_created');
    host.emit('create_room', {
      playerName: 'WrongRoleHost',
      itemMode: 'competitive',
      draftMode: true,
      draftType: 'role',
    });
    const { code } = await roomCreated;

    const hostDraftStart = waitForEvent<any>(host, 'draft_start');
    const joinerDraftStart = waitForEvent<any>(joiner, 'draft_start');
    joiner.emit('join_room', { code, playerName: 'WrongRoleJoiner', itemMode: 'competitive' });

    const [hds] = await Promise.all([hostDraftStart, joinerDraftStart]);

    // Determine who picks first
    const firstSocket = hds.yourPlayerIndex === 0 ? host : joiner;
    const currentRole = hds.roleOrder[0]; // first round's role

    // Find a pool index whose role does NOT match the current role
    const wrongIndex = hds.pool.findIndex((p: any) => p.role !== currentRole);
    expect(wrongIndex).toBeGreaterThanOrEqual(0);

    const errorEvent = waitForEvent<{ message: string }>(firstSocket, 'error');
    firstSocket.emit('draft_pick', { poolIndex: wrongIndex });
    const err = await errorEvent;
    expect(err.message).toBeTruthy();

    host.disconnect();
    joiner.disconnect();
  });

  it('role draft accepts pick from correct role', async () => {
    const host = await connectClient(port);
    const joiner = await connectClient(port);

    const roomCreated = waitForEvent<{ code: string }>(host, 'room_created');
    host.emit('create_room', {
      playerName: 'CorrectRoleHost',
      itemMode: 'competitive',
      draftMode: true,
      draftType: 'role',
    });
    const { code } = await roomCreated;

    const hostDraftStart = waitForEvent<any>(host, 'draft_start');
    const joinerDraftStart = waitForEvent<any>(joiner, 'draft_start');
    joiner.emit('join_room', { code, playerName: 'CorrectRoleJoiner', itemMode: 'competitive' });

    const [hds] = await Promise.all([hostDraftStart, joinerDraftStart]);

    const firstSocket = hds.yourPlayerIndex === 0 ? host : joiner;
    const currentRole = hds.roleOrder[0];

    // Find a pool index whose role matches the current role
    const correctIndex = hds.pool.findIndex((p: any) => p.role === currentRole);
    expect(correctIndex).toBeGreaterThanOrEqual(0);

    const hostPick = waitForEvent<any>(host, 'draft_pick');
    const joinerPick = waitForEvent<any>(joiner, 'draft_pick');
    firstSocket.emit('draft_pick', { poolIndex: correctIndex });

    const [hp, jp] = await Promise.all([hostPick, joinerPick]);
    expect(hp.poolIndex).toBe(correctIndex);
    expect(jp.poolIndex).toBe(correctIndex);

    host.disconnect();
    joiner.disconnect();
  });

  it('full role draft completes and emits draft_complete', async () => {
    const host = await connectClient(port);
    const joiner = await connectClient(port);

    const roomCreated = waitForEvent<{ code: string }>(host, 'room_created');
    host.emit('create_room', {
      playerName: 'FullRoleHost',
      itemMode: 'competitive',
      draftMode: true,
      draftType: 'role',
    });
    const { code } = await roomCreated;

    const hostDraftStart = waitForEvent<any>(host, 'draft_start');
    const joinerDraftStart = waitForEvent<any>(joiner, 'draft_start');
    joiner.emit('join_room', { code, playerName: 'FullRoleJoiner', itemMode: 'competitive' });

    const [hds] = await Promise.all([hostDraftStart, joinerDraftStart]);

    const slot0Socket = hds.yourPlayerIndex === 0 ? host : joiner;
    const slot1Socket = hds.yourPlayerIndex === 0 ? joiner : host;

    // For each pick, find a valid pool index for the current role
    const picked = new Set<number>();
    for (let i = 0; i < 12; i++) {
      const currentSlot = SNAKE_ORDER[i];
      const socket = currentSlot === 0 ? slot0Socket : slot1Socket;
      const currentRound = Math.floor(i / 2);
      const currentRole = hds.roleOrder[currentRound];

      // Find an unpicked index matching the current role
      const validIndex = hds.pool.findIndex(
        (p: any, idx: number) => p.role === currentRole && !picked.has(idx)
      );
      expect(validIndex, `No valid pick for role ${currentRole} at pick ${i}`).toBeGreaterThanOrEqual(0);
      picked.add(validIndex);

      if (i < 11) {
        const hostPick = waitForEvent<any>(host, 'draft_pick');
        const joinerPick = waitForEvent<any>(joiner, 'draft_pick');
        socket.emit('draft_pick', { poolIndex: validIndex });
        await Promise.all([hostPick, joinerPick]);
      } else {
        // Last pick — listen for draft_complete
        const hostComplete = waitForEvent<any>(host, 'draft_complete', 5000);
        const joinerComplete = waitForEvent<any>(joiner, 'draft_complete', 5000);
        socket.emit('draft_pick', { poolIndex: validIndex });

        const [hc, jc] = await Promise.all([hostComplete, joinerComplete]);
        expect(hc.yourTeam).toHaveLength(6);
        expect(jc.yourTeam).toHaveLength(6);
      }
    }

    host.disconnect();
    joiner.disconnect();
  }, 15000);

  it('mega mode in online draft adds tier 0 entries to pool', async () => {
    const host = await connectClient(port);
    const joiner = await connectClient(port);

    const roomCreated = waitForEvent<{ code: string }>(host, 'room_created');
    host.emit('create_room', {
      playerName: 'MegaDraftHost',
      itemMode: 'competitive',
      draftMode: true,
      megaMode: true,
    });
    const { code } = await roomCreated;

    const hostDraftStart = waitForEvent<any>(host, 'draft_start');
    const joinerDraftStart = waitForEvent<any>(joiner, 'draft_start');
    joiner.emit('join_room', { code, playerName: 'MegaDraftJoiner', itemMode: 'competitive' });

    const [hds] = await Promise.all([hostDraftStart, joinerDraftStart]);

    // Pool should be 21 (19 regular + 2 mega, total = targetPoolSize)
    expect(hds.pool).toHaveLength(21);
    const megas = hds.pool.filter((p: any) => p.tier === 0);
    expect(megas).toHaveLength(2);

    host.disconnect();
    joiner.disconnect();
  });
});
