/**
 * RoomManager: manages all active rooms.
 * Handles room creation, lookup, join, and cleanup.
 */

import { Room } from './room';
import { SeededRNG } from '../utils/rng';

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no I/O/0/1 to avoid confusion
const CODE_LENGTH = 6;

export class RoomManager {
  private rooms: Map<string, Room> = new Map();
  /** Map from socket ID to room code for quick lookup */
  private socketToRoom: Map<string, string> = new Map();

  generateCode(): string {
    let code: string;
    let attempts = 0;
    do {
      code = '';
      for (let i = 0; i < CODE_LENGTH; i++) {
        code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
      }
      attempts++;
    } while (this.rooms.has(code) && attempts < 100);
    return code;
  }

  createRoom(socketId: string, playerName: string, itemMode: 'competitive' | 'casual' = 'competitive', maxGen: number | null = null, legendaryMode: boolean = false): { room: Room; code: string } {
    const code = this.generateCode();
    const room = new Room(code);
    room.maxGen = maxGen;
    room.legendaryMode = legendaryMode;
    room.addPlayer(socketId, playerName, itemMode);
    this.rooms.set(code, room);
    this.socketToRoom.set(socketId, code);
    return { room, code };
  }

  joinRoom(code: string, socketId: string, playerName: string, itemMode: 'competitive' | 'casual' = 'competitive'): {
    room: Room;
    error?: string;
  } {
    const room = this.rooms.get(code.toUpperCase());
    if (!room) {
      return { room: null!, error: 'Room not found' };
    }
    if (room.status !== 'waiting') {
      // Check for reconnect
      const reconnected = room.reconnect(socketId, playerName);
      if (reconnected) {
        this.socketToRoom.set(socketId, code);
        return { room };
      }
      return { room: null!, error: 'Room is not accepting new players' };
    }

    const result = room.addPlayer(socketId, playerName, itemMode);
    if (!result) {
      return { room: null!, error: 'Room is full' };
    }

    this.socketToRoom.set(socketId, code);
    return { room };
  }

  getRoom(code: string): Room | undefined {
    return this.rooms.get(code.toUpperCase());
  }

  getRoomBySocketId(socketId: string): Room | undefined {
    const code = this.socketToRoom.get(socketId);
    if (!code) return undefined;
    return this.rooms.get(code);
  }

  removeSocket(socketId: string): void {
    this.socketToRoom.delete(socketId);
  }

  removeRoom(code: string): void {
    const room = this.rooms.get(code);
    if (room) {
      for (const p of room.players) {
        if (p) this.socketToRoom.delete(p.socketId);
      }
      this.rooms.delete(code);
    }
  }

  /** Clean up rooms that have been finished for more than `maxAgeMs`. */
  cleanup(maxAgeMs: number = 10 * 60 * 1000): number {
    const now = Date.now();
    let cleaned = 0;
    for (const [code, room] of this.rooms) {
      if (room.status === 'finished' && (now - room.createdAt) > maxAgeMs) {
        this.removeRoom(code);
        cleaned++;
      }
    }
    return cleaned;
  }

  get roomCount(): number {
    return this.rooms.size;
  }

  get socketCount(): number {
    return this.socketToRoom.size;
  }
}
