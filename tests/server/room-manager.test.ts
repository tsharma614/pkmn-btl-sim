import { describe, it, expect, beforeEach } from 'vitest';
import { RoomManager } from '../../src/server/room-manager';

describe('RoomManager', () => {
  let manager: RoomManager;

  beforeEach(() => {
    manager = new RoomManager();
  });

  describe('createRoom', () => {
    it('creates a room and returns code', () => {
      const { room, code } = manager.createRoom('socket1', 'Tanmay');
      expect(code).toHaveLength(6);
      expect(room.status).toBe('waiting');
      expect(room.playerCount).toBe(1);
      expect(manager.roomCount).toBe(1);
    });

    it('maps socket to room', () => {
      const { code } = manager.createRoom('socket1', 'Tanmay');
      const room = manager.getRoomBySocketId('socket1');
      expect(room).toBeDefined();
      expect(room!.code).toBe(code);
    });
  });

  describe('joinRoom', () => {
    it('joins existing room', () => {
      const { code } = manager.createRoom('socket1', 'Tanmay');
      const { room, error } = manager.joinRoom(code, 'socket2', 'Nikhil');
      expect(error).toBeUndefined();
      expect(room.playerCount).toBe(2);
      expect(room.status).toBe('team_preview');
    });

    it('is case-insensitive for room codes', () => {
      const { code } = manager.createRoom('socket1', 'Tanmay');
      const { room, error } = manager.joinRoom(code.toLowerCase(), 'socket2', 'Nikhil');
      expect(error).toBeUndefined();
      expect(room.playerCount).toBe(2);
    });

    it('returns error for non-existent room', () => {
      const { error } = manager.joinRoom('ZZZZZZ', 'socket1', 'Tanmay');
      expect(error).toBe('Room not found');
    });

    it('returns error for full room', () => {
      const { code } = manager.createRoom('socket1', 'Tanmay');
      manager.joinRoom(code, 'socket2', 'Nikhil');
      const { error } = manager.joinRoom(code, 'socket3', 'Som');
      expect(error).toBe('Room is not accepting new players');
    });
  });

  describe('getRoom', () => {
    it('finds room by code', () => {
      const { code } = manager.createRoom('socket1', 'Tanmay');
      const room = manager.getRoom(code);
      expect(room).toBeDefined();
      expect(room!.code).toBe(code);
    });

    it('returns undefined for non-existent code', () => {
      expect(manager.getRoom('ZZZZZZ')).toBeUndefined();
    });
  });

  describe('removeRoom', () => {
    it('removes room and cleans up socket mappings', () => {
      const { code } = manager.createRoom('socket1', 'Tanmay');
      manager.joinRoom(code, 'socket2', 'Nikhil');
      manager.removeRoom(code);
      expect(manager.roomCount).toBe(0);
      expect(manager.getRoomBySocketId('socket1')).toBeUndefined();
      expect(manager.getRoomBySocketId('socket2')).toBeUndefined();
    });
  });

  describe('removeSocket', () => {
    it('removes socket-to-room mapping', () => {
      manager.createRoom('socket1', 'Tanmay');
      manager.removeSocket('socket1');
      expect(manager.getRoomBySocketId('socket1')).toBeUndefined();
      // Room still exists
      expect(manager.roomCount).toBe(1);
    });
  });

  describe('cleanup', () => {
    it('removes finished rooms older than maxAge', () => {
      const { room, code } = manager.createRoom('socket1', 'Tanmay');
      manager.joinRoom(code, 'socket2', 'Nikhil');
      room.selectLead(0, 0, 'competitive');
      room.selectLead(1, 0, 'competitive');
      room.forfeit(0);

      // Set createdAt to the past
      room.createdAt = Date.now() - 20 * 60 * 1000; // 20 minutes ago

      const cleaned = manager.cleanup(10 * 60 * 1000);
      expect(cleaned).toBe(1);
      expect(manager.roomCount).toBe(0);
    });

    it('does not remove active rooms', () => {
      manager.createRoom('socket1', 'Tanmay');
      const cleaned = manager.cleanup(0);
      expect(cleaned).toBe(0);
      expect(manager.roomCount).toBe(1);
    });
  });

  describe('generateCode', () => {
    it('generates 6-character code with valid characters', () => {
      const code = manager.generateCode();
      expect(code).toHaveLength(6);
      expect(code).toMatch(/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/);
    });
  });
});
