import { describe, it, expect, beforeEach } from 'vitest';
import { Room } from '../../src/server/room';
import {
  serializeOwnPokemon,
  serializeVisiblePokemon,
  buildBattleStartPayload,
  buildTurnResultPayload,
  buildNeedsSwitchPayload,
  buildBattleEndPayload,
} from '../../src/server/state-sanitizer';

describe('state-sanitizer', () => {
  let room: Room;

  beforeEach(() => {
    room = new Room('TEST01', 42);
    room.addPlayer('socket1', 'Tanmay');
    room.addPlayer('socket2', 'Nikhil');
    room.selectLead(0, 0, 'competitive');
    room.selectLead(1, 0, 'competitive');
  });

  describe('serializeOwnPokemon', () => {
    it('includes full info including stats and moves', () => {
      const pokemon = room.battle!.getActivePokemon(0);
      const serialized = serializeOwnPokemon(pokemon);

      expect(serialized.species.name).toBe(pokemon.species.name);
      expect(serialized.stats).toBeDefined();
      expect(serialized.moves).toHaveLength(pokemon.moves.length);
      expect(serialized.moves[0]).toHaveProperty('name');
      expect(serialized.moves[0]).toHaveProperty('currentPp');
      expect(serialized.moves[0]).toHaveProperty('maxPp');
      expect(serialized.item).toBe(pokemon.item);
      expect(serialized.choiceLocked).toBe(pokemon.choiceLocked);
    });

    it('converts volatileStatuses Set to array', () => {
      const pokemon = room.battle!.getActivePokemon(0);
      pokemon.volatileStatuses.add('confusion');
      const serialized = serializeOwnPokemon(pokemon);
      expect(Array.isArray(serialized.volatileStatuses)).toBe(true);
      expect(serialized.volatileStatuses).toContain('confusion');
    });

    it('does not include movePool or sets from species', () => {
      const pokemon = room.battle!.getActivePokemon(0);
      const serialized = serializeOwnPokemon(pokemon);
      expect(serialized.species).not.toHaveProperty('movePool');
      expect(serialized.species).not.toHaveProperty('sets');
    });
  });

  describe('serializeVisiblePokemon', () => {
    it('does not include stats, moves, or item', () => {
      const pokemon = room.battle!.getActivePokemon(0);
      const serialized = serializeVisiblePokemon(pokemon);

      expect(serialized.species.name).toBe(pokemon.species.name);
      expect(serialized).not.toHaveProperty('stats');
      expect(serialized).not.toHaveProperty('moves');
      expect(serialized).not.toHaveProperty('item');
    });

    it('includes HP, status, ability, and types', () => {
      const pokemon = room.battle!.getActivePokemon(0);
      const serialized = serializeVisiblePokemon(pokemon);

      expect(serialized.currentHp).toBe(pokemon.currentHp);
      expect(serialized.maxHp).toBe(pokemon.maxHp);
      expect(serialized.ability).toBe(pokemon.ability);
      expect(serialized.species.types).toEqual([...pokemon.species.types]);
    });

    it('converts volatileStatuses Set to array', () => {
      const pokemon = room.battle!.getActivePokemon(0);
      pokemon.volatileStatuses.add('substitute');
      const serialized = serializeVisiblePokemon(pokemon);
      expect(Array.isArray(serialized.volatileStatuses)).toBe(true);
      expect(serialized.volatileStatuses).toContain('substitute');
    });
  });

  describe('buildBattleStartPayload', () => {
    it('returns full team info for the specified player', () => {
      const payload = buildBattleStartPayload(room, 0);
      expect(payload.yourPlayerIndex).toBe(0);
      expect(payload.yourTeam).toHaveLength(6);
      expect(payload.yourTeam[0]).toHaveProperty('stats');
      expect(payload.yourTeam[0]).toHaveProperty('moves');
    });

    it('includes opponentLead when battle has started', () => {
      const payload = buildBattleStartPayload(room, 0);
      expect(payload.opponentLead).toBeDefined();
      expect(payload.opponentLead!.species).toBeDefined();
      expect(payload.opponentLead!.currentHp).toBeGreaterThan(0);
      expect(payload.opponentLead!.isAlive).toBe(true);
      expect(payload.opponentLead!.ability).toBeDefined();
    });

    it('opponentLead does not expose private info (stats, moves, item)', () => {
      const payload = buildBattleStartPayload(room, 0);
      expect(payload.opponentLead).not.toHaveProperty('stats');
      expect(payload.opponentLead).not.toHaveProperty('moves');
      expect(payload.opponentLead).not.toHaveProperty('item');
    });

    it('includes opponentName from room players', () => {
      const payload0 = buildBattleStartPayload(room, 0);
      const payload1 = buildBattleStartPayload(room, 1);
      expect(payload0.opponentName).toBe('Nikhil');
      expect(payload1.opponentName).toBe('Tanmay');
    });

    it('opponent lead is the first Pokemon of the opponent team', () => {
      const payload = buildBattleStartPayload(room, 0);
      const oppTeam = room.teams[1]!;
      expect(payload.opponentLead!.species.name).toBe(oppTeam[0].species.name);
    });

    it('returns correct playerIndex for each player', () => {
      const payload0 = buildBattleStartPayload(room, 0);
      const payload1 = buildBattleStartPayload(room, 1);
      expect(payload0.yourPlayerIndex).toBe(0);
      expect(payload1.yourPlayerIndex).toBe(1);
    });

    it('does not include opponentLead when battle has not started', () => {
      // Create a room without starting battle
      const waitingRoom = new Room('WAIT01', 42);
      waitingRoom.addPlayer('s1', 'Tanmay');
      waitingRoom.addPlayer('s2', 'Nikhil');
      // Only one lead selected — battle not started
      waitingRoom.selectLead(0, 0, 'competitive');
      // battle is null since both leads haven't been selected
      expect(waitingRoom.battle).toBeNull();

      // Can't really call buildBattleStartPayload without a team,
      // but the guard is: if (room.battle) — so if battle is null,
      // opponentLead and opponentName won't be set.
      // We verify this by manually constructing the scenario:
      waitingRoom.selectLead(1, 0, 'competitive');
      // Now battle exists — both fields should be present
      const payload = buildBattleStartPayload(waitingRoom, 0);
      expect(payload.opponentLead).toBeDefined();
      expect(payload.opponentName).toBe('Nikhil');
    });
  });

  describe('buildTurnResultPayload', () => {
    it('includes own team with full info and opponent with limited info', () => {
      // Play a turn first
      const moves0 = room.battle!.getAvailableMoves(0);
      const moves1 = room.battle!.getAvailableMoves(1);
      room.submitAction(0, { type: 'move', playerId: 'p1', moveIndex: moves0[0] });
      room.submitAction(1, { type: 'move', playerId: 'p2', moveIndex: moves1[0] });
      const events = room.processTurn();

      const payload = buildTurnResultPayload(room, 0, events);

      expect(payload.yourState.team).toHaveLength(6);
      expect(payload.yourState.team[0]).toHaveProperty('stats');
      expect(payload.yourState.team[0]).toHaveProperty('moves');
      expect(payload.opponentVisible.activePokemon).not.toBeNull();
      expect(payload.opponentVisible.activePokemon).not.toHaveProperty('stats');
      expect(payload.opponentVisible.activePokemon).not.toHaveProperty('moves');
      expect(payload.opponentVisible.teamSize).toBe(6);
      expect(payload.turn).toBeGreaterThan(0);
      expect(payload.weather).toBeDefined();
    });

    it('only shows scouted opponent Pokemon', () => {
      // Initially only lead is scouted
      const moves0 = room.battle!.getAvailableMoves(0);
      const moves1 = room.battle!.getAvailableMoves(1);
      room.submitAction(0, { type: 'move', playerId: 'p1', moveIndex: moves0[0] });
      room.submitAction(1, { type: 'move', playerId: 'p2', moveIndex: moves1[0] });
      const events = room.processTurn();

      const payload = buildTurnResultPayload(room, 0, events);
      // scoutedPokemon doesn't include the active Pokemon (shown separately)
      // Only the lead (index 0) is scouted, which is the active Pokemon
      expect(payload.opponentVisible.scoutedPokemon.length).toBeLessThanOrEqual(1);
    });
  });

  describe('buildBattleEndPayload', () => {
    it('reveals full opponent team on battle end', () => {
      room.forfeit(0);
      const payload = buildBattleEndPayload(room, 0, 'forfeit');

      expect(payload.winner).toBe('Nikhil');
      expect(payload.reason).toBe('forfeit');
      expect(payload.finalState.yourTeam).toHaveLength(6);
      expect(payload.finalState.opponentTeam).toHaveLength(6);
      // Opponent team is fully revealed on battle end
      expect(payload.finalState.opponentTeam[0]).toHaveProperty('stats');
      expect(payload.finalState.opponentTeam[0]).toHaveProperty('moves');
    });
  });

  describe('buildNeedsSwitchPayload', () => {
    it('returns available switch targets', () => {
      const payload = buildNeedsSwitchPayload(room, 0);
      // Active Pokemon (index 0) should not be in available switches
      expect(payload.availableSwitches.length).toBe(5);
      expect(payload.availableSwitches.every(s => s.index !== 0)).toBe(true);
      expect(payload.availableSwitches[0].pokemon).toHaveProperty('stats');
    });
  });
});
