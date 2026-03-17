import { describe, it, expect, beforeEach } from 'vitest';
import { Room } from '../../src/server/room';

describe('Room', () => {
  let room: Room;

  beforeEach(() => {
    room = new Room('ABCD12', 42);
  });

  describe('constructor', () => {
    it('starts in waiting status', () => {
      expect(room.status).toBe('waiting');
      expect(room.code).toBe('ABCD12');
      expect(room.playerCount).toBe(0);
    });
  });

  describe('addPlayer', () => {
    it('adds first player to slot 0', () => {
      const result = room.addPlayer('socket1', 'Tanmay');
      expect(result).not.toBeNull();
      expect(result!.index).toBe(0);
      expect(result!.player.name).toBe('Tanmay');
      expect(room.playerCount).toBe(1);
      expect(room.status).toBe('waiting');
    });

    it('adds second player to slot 1 and transitions to team_preview', () => {
      room.addPlayer('socket1', 'Tanmay');
      const result = room.addPlayer('socket2', 'Nikhil');
      expect(result).not.toBeNull();
      expect(result!.index).toBe(1);
      expect(room.playerCount).toBe(2);
      expect(room.status).toBe('team_preview');
    });

    it('generates teams when both players join', () => {
      room.addPlayer('socket1', 'Tanmay');
      room.addPlayer('socket2', 'Nikhil');
      expect(room.teams[0]).not.toBeNull();
      expect(room.teams[1]).not.toBeNull();
      expect(room.teams[0]!.length).toBe(6);
      expect(room.teams[1]!.length).toBe(6);
    });

    it('rejects third player', () => {
      room.addPlayer('socket1', 'Tanmay');
      room.addPlayer('socket2', 'Nikhil');
      // Status is now team_preview, so addPlayer returns null
      const result = room.addPlayer('socket3', 'Som');
      expect(result).toBeNull();
    });
  });

  describe('getPlayerBySocketId', () => {
    it('finds player by socket ID', () => {
      room.addPlayer('socket1', 'Tanmay');
      const result = room.getPlayerBySocketId('socket1');
      expect(result).not.toBeNull();
      expect(result!.player.name).toBe('Tanmay');
      expect(result!.index).toBe(0);
    });

    it('returns null for unknown socket', () => {
      expect(room.getPlayerBySocketId('unknown')).toBeNull();
    });
  });

  describe('selectLead', () => {
    beforeEach(() => {
      room.addPlayer('socket1', 'Tanmay');
      room.addPlayer('socket2', 'Nikhil');
    });

    it('allows lead selection in team_preview', () => {
      expect(room.selectLead(0, 0, 'competitive')).toBe(true);
      expect(room.players[0]!.leadSelected).toBe(true);
      expect(room.status).toBe('team_preview'); // still waiting for p2
    });

    it('starts battle when both leads selected', () => {
      room.selectLead(0, 0, 'competitive');
      room.selectLead(1, 0, 'competitive');
      expect(room.status).toBe('battling');
      expect(room.battle).not.toBeNull();
    });

    it('swaps lead to front if not index 0', () => {
      const originalFirst = room.teams[0]![0].species.name;
      const originalThird = room.teams[0]![2].species.name;
      room.selectLead(0, 2, 'competitive');
      expect(room.teams[0]![0].species.name).toBe(originalThird);
      expect(room.teams[0]![2].species.name).toBe(originalFirst);
    });

    it('rejects lead selection after already selected', () => {
      room.selectLead(0, 0, 'competitive');
      expect(room.selectLead(0, 1, 'competitive')).toBe(false);
    });

    it('rejects invalid pokemon index', () => {
      expect(room.selectLead(0, -1, 'competitive')).toBe(false);
      expect(room.selectLead(0, 6, 'competitive')).toBe(false);
    });
  });

  describe('submitAction + processTurn', () => {
    beforeEach(() => {
      room.addPlayer('socket1', 'Tanmay');
      room.addPlayer('socket2', 'Nikhil');
      room.selectLead(0, 0, 'competitive');
      room.selectLead(1, 0, 'competitive');
    });

    it('accepts valid move action', () => {
      const moves = room.battle!.getAvailableMoves(0);
      const result = room.submitAction(0, {
        type: 'move',
        playerId: 'p1',
        moveIndex: moves[0],
      });
      expect(result.valid).toBe(true);
    });

    it('rejects duplicate action submission', () => {
      const moves = room.battle!.getAvailableMoves(0);
      room.submitAction(0, { type: 'move', playerId: 'p1', moveIndex: moves[0] });
      const result = room.submitAction(0, { type: 'move', playerId: 'p1', moveIndex: moves[0] });
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Action already submitted');
    });

    it('processes turn when both actions submitted', () => {
      const moves0 = room.battle!.getAvailableMoves(0);
      const moves1 = room.battle!.getAvailableMoves(1);
      room.submitAction(0, { type: 'move', playerId: 'p1', moveIndex: moves0[0] });
      room.submitAction(1, { type: 'move', playerId: 'p2', moveIndex: moves1[0] });

      expect(room.bothActionsReady()).toBe(true);
      const events = room.processTurn();
      expect(events.length).toBeGreaterThan(0);
      expect(room.battle!.state.turn).toBe(1);
    });

    it('validates switch targets', () => {
      const result = room.submitAction(0, {
        type: 'switch',
        playerId: 'p1',
        pokemonIndex: 0, // Can't switch to self (active)
      });
      expect(result.valid).toBe(false);
    });

    it('rejects action before battle starts', () => {
      const freshRoom = new Room('TEST01', 42);
      freshRoom.addPlayer('s1', 'A');
      const result = freshRoom.submitAction(0, {
        type: 'move',
        playerId: 'p1',
        moveIndex: 0,
      });
      expect(result.valid).toBe(false);
    });
  });

  describe('forfeit', () => {
    beforeEach(() => {
      room.addPlayer('socket1', 'Tanmay');
      room.addPlayer('socket2', 'Nikhil');
      room.selectLead(0, 0, 'competitive');
      room.selectLead(1, 0, 'competitive');
    });

    it('ends battle with opponent as winner', () => {
      const events = room.forfeit(0);
      expect(room.status).toBe('finished');
      expect(room.battle!.state.winner).toBe('p2');
      expect(events.length).toBe(1);
      expect(events[0].type).toBe('battle_end');
    });
  });

  describe('rematch', () => {
    beforeEach(() => {
      room.addPlayer('socket1', 'Tanmay');
      room.addPlayer('socket2', 'Nikhil');
      room.selectLead(0, 0, 'competitive');
      room.selectLead(1, 0, 'competitive');
      room.forfeit(0); // End the battle
    });

    it('requires both players to request rematch', () => {
      expect(room.requestRematch(0)).toBe(false);
      expect(room.status).toBe('finished');
    });

    it('starts new team_preview when both request', () => {
      room.requestRematch(0);
      const result = room.requestRematch(1);
      expect(result).toBe(true);
      expect(room.status).toBe('team_preview');
      expect(room.battle).toBeNull();
      expect(room.teams[0]).not.toBeNull();
      expect(room.teams[1]).not.toBeNull();
      expect(room.players[0]!.leadSelected).toBe(false);
      expect(room.players[1]!.leadSelected).toBe(false);
    });
  });

  describe('reconnect', () => {
    it('updates socket ID for matching player name', () => {
      room.addPlayer('socket1', 'Tanmay');
      room.addPlayer('socket2', 'Nikhil');

      const result = room.reconnect('socket3', 'Tanmay');
      expect(result).not.toBeNull();
      expect(result!.player.socketId).toBe('socket3');
      expect(result!.index).toBe(0);
    });

    it('returns null for unknown name', () => {
      room.addPlayer('socket1', 'Tanmay');
      expect(room.reconnect('socket2', 'Unknown')).toBeNull();
    });
  });

  describe('updatePlayerMoves', () => {
    it('updates team moves for a player', () => {
      room.addPlayer('socket1', 'Tanmay');
      room.addPlayer('socket2', 'Nikhil');
      expect(room.teams[0]).not.toBeNull();

      const originalMoves = room.teams[0]![0].moves.map(m => m.data.name);
      const newMoves = room.teams[0]![0].species.movePool.slice(0, 4);

      // Only update if we have enough moves in the pool
      if (newMoves.length === 4) {
        const result = room.updatePlayerMoves(0, { 0: newMoves });
        expect(result).toBe(true);
        const updatedMoves = room.teams[0]![0].moves.map(m => m.data.name);
        expect(updatedMoves).toEqual(newMoves);
      }
    });

    it('returns false when no team exists', () => {
      const emptyRoom = new Room('EMPTY1', 99);
      expect(emptyRoom.updatePlayerMoves(0, { 0: ['Tackle', 'Ember', 'Scratch', 'Growl'] })).toBe(false);
    });
  });
});
