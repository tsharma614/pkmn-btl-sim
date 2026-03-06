/**
 * Tests for Classic Mode and Legendary Team toggles in multiplayer.
 * Verifies that:
 * 1. Host's team options are sent when creating a room
 * 2. Both players' teams are generated with the same settings
 * 3. Room options are included in battle_start payload
 * 4. Classic mode strips Fairy type for both players
 */
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

describe('Multiplayer Team Options', () => {
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

  it('host can create room with maxGen and legendaryMode', async () => {
    const host = await connectClient(port);

    const roomCreated = waitForEvent<{ code: string }>(host, 'room_created');
    host.emit('create_room', {
      playerName: 'Host',
      itemMode: 'competitive',
      maxGen: 4,
      legendaryMode: true,
    });
    const { code } = await roomCreated;
    expect(code).toBeTruthy();
    expect(code.length).toBe(6);

    host.disconnect();
  });

  it('classic mode room generates Gen 1-4 only teams for both players', async () => {
    const host = await connectClient(port);
    const joiner = await connectClient(port);

    const roomCreated = waitForEvent<{ code: string }>(host, 'room_created');
    host.emit('create_room', {
      playerName: 'ClassicHost',
      itemMode: 'competitive',
      maxGen: 4,
    });
    const { code } = await roomCreated;

    // Both get team_preview
    const hostPreview = waitForEvent<TeamPreviewPayload>(host, 'team_preview');
    const joinerPreview = waitForEvent<TeamPreviewPayload>(joiner, 'team_preview');
    joiner.emit('join_room', { code, playerName: 'ClassicJoiner', itemMode: 'competitive' });

    const [hp, jp] = await Promise.all([hostPreview, joinerPreview]);

    // Host and joiner teams should not have Fairy type
    for (const pokemon of hp.yourTeam) {
      expect(
        pokemon.species.types,
        `Host's ${pokemon.species.name} should not have Fairy type`,
      ).not.toContain('Fairy');
    }
    for (const pokemon of jp.yourTeam) {
      expect(
        pokemon.species.types,
        `Joiner's ${pokemon.species.name} should not have Fairy type`,
      ).not.toContain('Fairy');
    }

    host.disconnect();
    joiner.disconnect();
  });

  it('battle_start payload includes roomOptions', async () => {
    const host = await connectClient(port);
    const joiner = await connectClient(port);

    const roomCreated = waitForEvent<{ code: string }>(host, 'room_created');
    host.emit('create_room', {
      playerName: 'OptHost',
      itemMode: 'competitive',
      maxGen: 4,
      legendaryMode: true,
    });
    const { code } = await roomCreated;

    // Wait for team_preview then select leads
    const hostPreview = waitForEvent<TeamPreviewPayload>(host, 'team_preview');
    const joinerPreview = waitForEvent<TeamPreviewPayload>(joiner, 'team_preview');
    joiner.emit('join_room', { code, playerName: 'OptJoiner', itemMode: 'competitive' });
    await Promise.all([hostPreview, joinerPreview]);

    const hostBattleStart = waitForEvent<BattleStartPayload>(host, 'battle_start');
    const joinerBattleStart = waitForEvent<BattleStartPayload>(joiner, 'battle_start');
    host.emit('select_lead', { pokemonIndex: 0, itemMode: 'competitive' });
    joiner.emit('select_lead', { pokemonIndex: 0, itemMode: 'competitive' });

    const [hbs, jbs] = await Promise.all([hostBattleStart, joinerBattleStart]);

    // Both payloads should include roomOptions
    expect(hbs.roomOptions).toBeDefined();
    expect(hbs.roomOptions?.maxGen).toBe(4);
    expect(hbs.roomOptions?.legendaryMode).toBe(true);

    expect(jbs.roomOptions).toBeDefined();
    expect(jbs.roomOptions?.maxGen).toBe(4);
    expect(jbs.roomOptions?.legendaryMode).toBe(true);

    host.disconnect();
    joiner.disconnect();
  });

  it('legendary mode gives both players mostly T1 Pokemon', async () => {
    const host = await connectClient(port);
    const joiner = await connectClient(port);

    const roomCreated = waitForEvent<{ code: string }>(host, 'room_created');
    host.emit('create_room', {
      playerName: 'LegHost',
      itemMode: 'competitive',
      legendaryMode: true,
    });
    const { code } = await roomCreated;

    const hostPreview = waitForEvent<TeamPreviewPayload>(host, 'team_preview');
    const joinerPreview = waitForEvent<TeamPreviewPayload>(joiner, 'team_preview');
    joiner.emit('join_room', { code, playerName: 'LegJoiner', itemMode: 'competitive' });

    const [hp, jp] = await Promise.all([hostPreview, joinerPreview]);

    // Both teams should have 6 Pokemon
    expect(hp.yourTeam).toHaveLength(6);
    expect(jp.yourTeam).toHaveLength(6);

    host.disconnect();
    joiner.disconnect();
  });

  it('default room has no maxGen and no legendaryMode', async () => {
    const host = await connectClient(port);
    const joiner = await connectClient(port);

    const roomCreated = waitForEvent<{ code: string }>(host, 'room_created');
    host.emit('create_room', {
      playerName: 'DefaultHost',
      itemMode: 'competitive',
    });
    const { code } = await roomCreated;

    const hostPreview = waitForEvent<TeamPreviewPayload>(host, 'team_preview');
    const joinerPreview = waitForEvent<TeamPreviewPayload>(joiner, 'team_preview');
    joiner.emit('join_room', { code, playerName: 'DefaultJoiner', itemMode: 'competitive' });
    await Promise.all([hostPreview, joinerPreview]);

    const hostBattleStart = waitForEvent<BattleStartPayload>(host, 'battle_start');
    const joinerBattleStart = waitForEvent<BattleStartPayload>(joiner, 'battle_start');
    host.emit('select_lead', { pokemonIndex: 0, itemMode: 'competitive' });
    joiner.emit('select_lead', { pokemonIndex: 0, itemMode: 'competitive' });

    const [hbs, jbs] = await Promise.all([hostBattleStart, joinerBattleStart]);

    expect(hbs.roomOptions?.maxGen).toBeNull();
    expect(hbs.roomOptions?.legendaryMode).toBe(false);
    expect(jbs.roomOptions?.maxGen).toBeNull();
    expect(jbs.roomOptions?.legendaryMode).toBe(false);

    host.disconnect();
    joiner.disconnect();
  });

  it('classic + legendary combined works in multiplayer', async () => {
    const host = await connectClient(port);
    const joiner = await connectClient(port);

    const roomCreated = waitForEvent<{ code: string }>(host, 'room_created');
    host.emit('create_room', {
      playerName: 'ComboHost',
      itemMode: 'competitive',
      maxGen: 4,
      legendaryMode: true,
    });
    const { code } = await roomCreated;

    const hostPreview = waitForEvent<TeamPreviewPayload>(host, 'team_preview');
    const joinerPreview = waitForEvent<TeamPreviewPayload>(joiner, 'team_preview');
    joiner.emit('join_room', { code, playerName: 'ComboJoiner', itemMode: 'competitive' });

    const [hp, jp] = await Promise.all([hostPreview, joinerPreview]);

    // No Fairy type on either team
    for (const pokemon of [...hp.yourTeam, ...jp.yourTeam]) {
      expect(pokemon.species.types).not.toContain('Fairy');
    }

    host.disconnect();
    joiner.disconnect();
  });
});
