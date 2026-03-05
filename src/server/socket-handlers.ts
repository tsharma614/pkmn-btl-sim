/**
 * Socket.io event handlers: wires all client→server events
 * to room logic and broadcasts sanitized state back.
 */

import { Server, Socket } from 'socket.io';
import { RoomManager } from './room-manager';
import { DisconnectTracker } from './disconnect-tracker';
import {
  ClientToServerEvents,
  ServerToClientEvents,
} from './types';
import {
  buildBattleStartPayload,
  buildTurnResultPayload,
  buildNeedsSwitchPayload,
  buildBattleEndPayload,
} from './state-sanitizer';

type TypedSocket = Socket<ClientToServerEvents, ServerToClientEvents>;
type TypedServer = Server<ClientToServerEvents, ServerToClientEvents>;

/** Pending disconnect notifications — cancelled if player reconnects quickly */
const pendingDisconnectNotify = new Map<string, ReturnType<typeof setTimeout>>();

export function registerSocketHandlers(
  io: TypedServer,
  roomManager: RoomManager,
  disconnectTracker: DisconnectTracker
): void {
  io.on('connection', (socket: TypedSocket) => {
    console.log(`[connect] ${socket.id}`);

    socket.on('create_room', (payload) => {
      const { playerName, itemMode } = payload;
      if (!playerName || typeof playerName !== 'string') {
        socket.emit('error', { message: 'Player name is required' });
        return;
      }

      const { room, code } = roomManager.createRoom(socket.id, playerName, itemMode || 'competitive');
      socket.join(code);
      socket.emit('room_created', { code });
      console.log(`[room] ${playerName} created room ${code}`);
    });

    socket.on('join_room', (payload) => {
      const { code, playerName } = payload;
      if (!code || !playerName) {
        socket.emit('error', { message: 'Room code and player name are required' });
        return;
      }

      const itemMode = payload.itemMode || 'competitive';
      const { room, error } = roomManager.joinRoom(code, socket.id, playerName, itemMode);
      if (error || !room) {
        socket.emit('error', { message: error || 'Failed to join room' });
        return;
      }

      socket.join(room.code);

      // Check if this is a reconnect
      const cancelled = disconnectTracker.cancelByRoomAndName(room.code, playerName);
      if (cancelled) {
        console.log(`[reconnect] ${playerName} reconnected to room ${room.code}`);
        // Cancel pending disconnect notification
        const playerIdx = room.getPlayerBySocketId(socket.id)?.index;
        if (playerIdx !== undefined) {
          const notifyKey = `${room.code}:${playerIdx}:notify`;
          const pending = pendingDisconnectNotify.get(notifyKey);
          if (pending) {
            clearTimeout(pending);
            pendingDisconnectNotify.delete(notifyKey);
          }
        }
        // Notify opponent that the disconnected player is back
        socket.to(room.code).emit('opponent_joined', { name: playerName });

        // If battle is in progress, resend current state
        if (room.status === 'battling' && room.battle) {
          const playerData = room.getPlayerBySocketId(socket.id);
          if (playerData) {
            const turnResult = buildTurnResultPayload(room, playerData.index, []);
            socket.emit('turn_result', turnResult);

            // Check if this player needs to submit a force switch
            if (room.pendingForceSwitch[playerData.index]) {
              socket.emit('needs_switch', buildNeedsSwitchPayload(room, playerData.index));
            }
          }
        }

        // If battle already ended (e.g. auto-forfeit), tell the client
        if (room.status === 'finished') {
          const playerData = room.getPlayerBySocketId(socket.id);
          if (playerData) {
            const endPayload = buildBattleEndPayload(room, playerData.index, 'disconnect');
            socket.emit('battle_end', endPayload);
          }
        }
        return;
      }

      // Not a reconnect by timer, but check if room is finished (auto-forfeit already happened)
      if (room.status === 'finished') {
        const playerData = room.getPlayerBySocketId(socket.id);
        if (playerData) {
          const endPayload = buildBattleEndPayload(room, playerData.index, 'disconnect');
          socket.emit('battle_end', endPayload);
        }
        return;
      }

      // Normal join — notify the room creator
      const otherPlayer = room.players[0]!; // creator is always slot 0
      socket.to(room.code).emit('opponent_joined', { name: playerName });
      socket.emit('opponent_joined', { name: otherPlayer.name });

      // If both players joined and teams are ready, send team_preview
      if (room.status === 'team_preview' && room.teams[0] && room.teams[1]) {
        for (let i = 0; i < 2; i++) {
          const p = room.players[i as 0 | 1]!;
          const targetSocket = i === 1 ? socket : io.sockets.sockets.get(p.socketId);
          if (targetSocket) {
            const previewPayload = buildBattleStartPayload(room, i as 0 | 1);
            targetSocket.emit('team_preview', previewPayload);
          }
        }
      }

      console.log(`[room] ${playerName} joined room ${room.code}`);
    });

    socket.on('select_lead', (payload) => {
      const room = roomManager.getRoomBySocketId(socket.id);
      if (!room) {
        socket.emit('error', { message: 'Not in a room' });
        return;
      }

      const playerData = room.getPlayerBySocketId(socket.id);
      if (!playerData) {
        socket.emit('error', { message: 'Player not found in room' });
        return;
      }

      const { pokemonIndex, itemMode } = payload;
      const success = room.selectLead(playerData.index, pokemonIndex, itemMode);
      if (!success) {
        socket.emit('error', { message: 'Invalid lead selection' });
        return;
      }

      // If both players have selected leads, battle starts
      if (room.status === 'battling' && room.battle) {
        for (let i = 0; i < 2; i++) {
          const p = room.players[i as 0 | 1]!;
          const targetSocket = io.sockets.sockets.get(p.socketId);
          if (targetSocket) {
            const startPayload = buildBattleStartPayload(room, i as 0 | 1);
            targetSocket.emit('battle_start', startPayload);
          }
        }
        console.log(`[battle] Battle started in room ${room.code}`);
      }
    });

    socket.on('submit_action', (payload) => {
      const room = roomManager.getRoomBySocketId(socket.id);
      if (!room) {
        socket.emit('error', { message: 'Not in a room' });
        return;
      }

      const playerData = room.getPlayerBySocketId(socket.id);
      if (!playerData) {
        socket.emit('error', { message: 'Player not found in room' });
        return;
      }

      const { type, index } = payload;
      const playerId = playerData.index === 0 ? 'p1' : 'p2';

      const action = type === 'move'
        ? { type: 'move' as const, playerId, moveIndex: index }
        : { type: 'switch' as const, playerId, pokemonIndex: index };

      const result = room.submitAction(playerData.index, action);
      if (!result.valid) {
        socket.emit('error', { message: result.error || 'Invalid action' });
        return;
      }

      // If both actions submitted, process the turn
      if (room.bothActionsReady()) {
        processTurnAndBroadcast(io, room, roomManager, disconnectTracker);
      }
    });

    socket.on('submit_force_switch', (payload) => {
      const room = roomManager.getRoomBySocketId(socket.id);
      if (!room) {
        socket.emit('error', { message: 'Not in a room' });
        return;
      }

      const playerData = room.getPlayerBySocketId(socket.id);
      if (!playerData) {
        socket.emit('error', { message: 'Player not found in room' });
        return;
      }

      const { pokemonIndex } = payload;
      const result = room.processForceSwitch(playerData.index, pokemonIndex);

      if (result.error) {
        socket.emit('error', { message: result.error });
        return;
      }

      // If this player needs to switch again (hazard KO), ask again
      if (result.needsMoreSwitches) {
        socket.emit('needs_switch', buildNeedsSwitchPayload(room, playerData.index));
        return;
      }

      // If battle ended from the switch
      if (room.status === 'finished') {
        broadcastBattleEnd(io, room, 'all_fainted');
        return;
      }

      // If all force switches are resolved, send turn results
      if (room.allForceSwitchesResolved()) {
        broadcastTurnResult(io, room, result.events);
      }
    });

    socket.on('forfeit', () => {
      const room = roomManager.getRoomBySocketId(socket.id);
      if (!room) return;

      const playerData = room.getPlayerBySocketId(socket.id);
      if (!playerData) return;

      room.forfeit(playerData.index);
      broadcastBattleEnd(io, room, 'forfeit');
      console.log(`[forfeit] ${playerData.player.name} forfeited in room ${room.code}`);
    });

    socket.on('rematch_request', () => {
      const room = roomManager.getRoomBySocketId(socket.id);
      if (!room) return;

      const playerData = room.getPlayerBySocketId(socket.id);
      if (!playerData) return;

      const bothReady = room.requestRematch(playerData.index);
      if (bothReady) {
        // Both want rematch — send new teams
        for (let i = 0; i < 2; i++) {
          const p = room.players[i as 0 | 1]!;
          const targetSocket = io.sockets.sockets.get(p.socketId);
          if (targetSocket) {
            // Send team preview data (same as battle_start but for team preview phase)
            const startPayload = buildBattleStartPayload(room, i as 0 | 1);
            targetSocket.emit('battle_start', startPayload);
          }
        }
        console.log(`[rematch] Rematch started in room ${room.code}`);
      }
    });

    socket.on('disconnect', (reason) => {
      const room = roomManager.getRoomBySocketId(socket.id);
      if (!room) {
        roomManager.removeSocket(socket.id);
        console.log(`[disconnect] ${socket.id} (not in room) reason: ${reason}`);
        return;
      }

      const playerData = room.getPlayerBySocketId(socket.id);
      if (!playerData) {
        roomManager.removeSocket(socket.id);
        return;
      }

      console.log(`[disconnect] ${playerData.player.name} disconnected from room ${room.code} (reason: ${reason})`);

      if (room.status === 'waiting') {
        // No opponent yet — just clean up the room
        roomManager.removeRoom(room.code);
        return;
      }

      // Delay opponent_disconnected notification so brief reconnects don't trigger it
      const disconnectKey = `${room.code}:${playerData.index}:notify`;
      pendingDisconnectNotify.set(disconnectKey, setTimeout(() => {
        pendingDisconnectNotify.delete(disconnectKey);
        // Only notify if room still exists and is active
        if (room.status === 'battling' || room.status === 'team_preview') {
          io.to(room.code).emit('opponent_disconnected');
        }
      }, 5000));

      if (room.status === 'battling' || room.status === 'team_preview') {
        // Start auto-forfeit timer
        disconnectTracker.startTimer(
          room.code,
          playerData.index,
          playerData.player.name,
          () => {
            // Timer expired — auto-forfeit
            console.log(`[auto-forfeit] ${playerData.player.name} auto-forfeited in room ${room.code}`);
            room.forfeit(playerData.index);
            broadcastBattleEnd(io, room, 'disconnect');
          }
        );
      }

      roomManager.removeSocket(socket.id);
    });
  });
}

/** Log battle events to server console for debugging */
function logBattleEvents(roomCode: string, events: import('../types').BattleEvent[]): void {
  for (const event of events) {
    const d = event.data;
    switch (event.type) {
      case 'use_move':
        console.log(`  [${roomCode}] ${d.pokemon} used ${d.move}`);
        break;
      case 'damage':
        console.log(`  [${roomCode}] ${d.defender} took ${d.damage} dmg${d.isCritical ? ' (CRIT)' : ''}`);
        break;
      case 'faint':
        console.log(`  [${roomCode}] ${d.pokemon} fainted`);
        break;
      case 'status':
        console.log(`  [${roomCode}] ${d.pokemon} → ${d.status}`);
        break;
      case 'boost':
        console.log(`  [${roomCode}] ${d.pokemon} ${d.stat} ${(d.stages as number) > 0 ? '+' : ''}${d.stages}`);
        break;
      case 'switch':
        console.log(`  [${roomCode}] ${d.from} → ${d.to}`);
        break;
      case 'miss':
        console.log(`  [${roomCode}] ${d.pokemon} ${d.move} MISSED`);
        break;
      case 'immune':
        console.log(`  [${roomCode}] ${d.target} immune`);
        break;
      default:
        break;
    }
  }
}

/** Process a turn and broadcast results to both players. */
function processTurnAndBroadcast(
  io: TypedServer,
  room: import('./room').Room,
  roomManager: RoomManager,
  disconnectTracker: DisconnectTracker
): void {
  const events = room.processTurn();
  logBattleEvents(room.code, events);

  // Check if battle ended — send final turn events BEFORE battle_end
  if (room.status === 'finished') {
    broadcastTurnResult(io, room, events);
    broadcastBattleEnd(io, room, 'all_fainted');
    return;
  }

  // Check for force switches
  let anyNeedsSwitch = false;
  for (let i = 0; i < 2; i++) {
    if (room.pendingForceSwitch[i as 0 | 1]) {
      anyNeedsSwitch = true;
      const p = room.players[i as 0 | 1]!;
      const targetSocket = io.sockets.sockets.get(p.socketId);
      if (targetSocket) {
        // Send turn events first so the client sees what happened
        const turnResult = buildTurnResultPayload(room, i as 0 | 1, events);
        targetSocket.emit('turn_result', turnResult);
        targetSocket.emit('needs_switch', buildNeedsSwitchPayload(room, i as 0 | 1));
      }
    }
  }

  // If no force switches needed, broadcast normal turn result
  if (!anyNeedsSwitch) {
    broadcastTurnResult(io, room, events);
  } else {
    // Send turn result to players that DON'T need to switch
    for (let i = 0; i < 2; i++) {
      if (!room.pendingForceSwitch[i as 0 | 1]) {
        const p = room.players[i as 0 | 1]!;
        const targetSocket = io.sockets.sockets.get(p.socketId);
        if (targetSocket) {
          const turnResult = buildTurnResultPayload(room, i as 0 | 1, events);
          targetSocket.emit('turn_result', turnResult);
        }
      }
    }
  }
}

/** Broadcast turn result to both players with sanitized state. */
function broadcastTurnResult(
  io: TypedServer,
  room: import('./room').Room,
  events: import('../types').BattleEvent[]
): void {
  for (let i = 0; i < 2; i++) {
    const p = room.players[i as 0 | 1]!;
    const targetSocket = io.sockets.sockets.get(p.socketId);
    if (targetSocket) {
      const turnResult = buildTurnResultPayload(room, i as 0 | 1, events);
      targetSocket.emit('turn_result', turnResult);
    }
  }
}

/** Broadcast battle end to both players. */
function broadcastBattleEnd(
  io: TypedServer,
  room: import('./room').Room,
  reason: string
): void {
  for (let i = 0; i < 2; i++) {
    const p = room.players[i as 0 | 1];
    if (!p) continue;
    const targetSocket = io.sockets.sockets.get(p.socketId);
    if (targetSocket) {
      const endPayload = buildBattleEndPayload(room, i as 0 | 1, reason);
      targetSocket.emit('battle_end', endPayload);
    }
  }
}
