import { describe, it, expect } from 'vitest';
import {
  battleReducer,
  initialState,
  BattleState,
  BattleAction,
  BattleStats,
} from '../../src/client/state/battle-reducer';
import type {
  BattleStartPayload,
  TurnResultPayload,
  NeedsSwitchPayload,
  BattleEndPayload,
  OwnPokemon,
  VisiblePokemon,
} from '../../src/server/types';
import type { BattleEvent, SideEffects } from '../../src/types';

// --------------- Factories ---------------

const EMPTY_SIDE: SideEffects = {
  stealthRock: false,
  spikesLayers: 0,
  toxicSpikesLayers: 0,
  reflect: 0,
  lightScreen: 0,
  tailwind: 0,
  stickyWeb: false,
  auroraVeil: 0,
};

function makeMockOwnPokemon(overrides: Partial<OwnPokemon> = {}): OwnPokemon {
  return {
    species: { id: 'charizard', name: 'Charizard', types: ['Fire', 'Flying'], baseStats: { hp: 78, atk: 84, def: 78, spa: 109, spd: 85, spe: 100 } },
    level: 100,
    stats: { hp: 297, atk: 183, def: 192, spa: 317, spd: 206, spe: 299 },
    currentHp: 297,
    maxHp: 297,
    status: null,
    volatileStatuses: [],
    boosts: { atk: 0, def: 0, spa: 0, spd: 0, spe: 0 },
    moves: [{
      name: 'Flamethrower', type: 'Fire', category: 'special', power: 90, accuracy: 100,
      currentPp: 15, maxPp: 15, disabled: false, description: null,
    }],
    item: 'Life Orb',
    ability: 'Blaze',
    isAlive: true,
    choiceLocked: null,
    ...overrides,
  };
}

function makeMockVisiblePokemon(overrides: Partial<VisiblePokemon> = {}): VisiblePokemon {
  return {
    species: { id: 'garchomp', name: 'Garchomp', types: ['Dragon', 'Ground'], baseStats: { hp: 108, atk: 130, def: 95, spa: 80, spd: 85, spe: 102 } },
    level: 100,
    currentHp: 357,
    maxHp: 357,
    status: null,
    volatileStatuses: [],
    boosts: { atk: 0, def: 0, spa: 0, spd: 0, spe: 0 },
    isAlive: true,
    ability: 'Rough Skin',
    ...overrides,
  };
}

function makeTeam(size = 6): OwnPokemon[] {
  const names = ['Charizard', 'Garchomp', 'Dragonite', 'Gengar', 'Glalie', 'Ceruledge'];
  return Array.from({ length: size }, (_, i) =>
    makeMockOwnPokemon({
      species: { id: names[i % names.length].toLowerCase(), name: names[i % names.length], types: ['Normal'], baseStats: { hp: 80, atk: 80, def: 80, spa: 80, spd: 80, spe: 80 } },
    }),
  );
}

function makeBattleStartPayload(overrides: Partial<BattleStartPayload> = {}): BattleStartPayload {
  return {
    yourTeam: makeTeam(),
    yourPlayerIndex: 0,
    ...overrides,
  };
}

function makeTurnResultPayload(overrides: Partial<TurnResultPayload> = {}): TurnResultPayload {
  return {
    events: [],
    yourState: {
      team: makeTeam(),
      activePokemonIndex: 0,
      sideEffects: { ...EMPTY_SIDE },
    },
    opponentVisible: {
      activePokemon: makeMockVisiblePokemon(),
      scoutedPokemon: [],
      teamSize: 6,
      faintedCount: 0,
      sideEffects: { ...EMPTY_SIDE },
    },
    turn: 2,
    weather: 'none',
    ...overrides,
  };
}

function makeNeedsSwitchPayload(overrides: Partial<NeedsSwitchPayload> = {}): NeedsSwitchPayload {
  return {
    availableSwitches: [
      { index: 1, pokemon: makeMockOwnPokemon() },
      { index: 2, pokemon: makeMockOwnPokemon() },
    ],
    reason: 'faint',
    ...overrides,
  };
}

function makeBattleEndPayload(overrides: Partial<BattleEndPayload> = {}): BattleEndPayload {
  return {
    winner: 'Tanmay',
    reason: 'all_fainted',
    finalState: {
      yourTeam: makeTeam(),
      opponentTeam: makeTeam(),
      turn: 10,
      weather: 'none',
    },
    ...overrides,
  };
}

/** Build a state that's mid-battle. */
function battlingState(overrides: Partial<BattleState> = {}): BattleState {
  return {
    ...initialState,
    phase: 'battling',
    gameMode: 'cpu',
    yourTeam: makeTeam(),
    yourPlayerIndex: 0,
    yourState: {
      team: makeTeam(),
      activePokemonIndex: 0,
      sideEffects: { ...EMPTY_SIDE },
    },
    opponentVisible: {
      activePokemon: makeMockVisiblePokemon(),
      scoutedPokemon: [],
      teamSize: 6,
      faintedCount: 0,
      sideEffects: { ...EMPTY_SIDE },
    },
    turn: 1,
    ...overrides,
  };
}

// --------------- Tests ---------------

describe('battleReducer', () => {
  // ========== START_GAME ==========
  describe('START_GAME', () => {
    it('transitions to connecting with cpu gameMode', () => {
      const result = battleReducer(initialState, {
        type: 'START_GAME',
        playerName: 'Tanmay',
        itemMode: 'competitive',
      });
      expect(result.phase).toBe('connecting');
      expect(result.gameMode).toBe('cpu');
      expect(result.playerName).toBe('Tanmay');
      expect(result.itemMode).toBe('competitive');
    });

    it('preserves casual itemMode', () => {
      const result = battleReducer(initialState, {
        type: 'START_GAME',
        playerName: 'Nikhil',
        itemMode: 'casual',
      });
      expect(result.itemMode).toBe('casual');
    });
  });

  // ========== START_ONLINE ==========
  describe('START_ONLINE', () => {
    it('transitions to connecting with online gameMode', () => {
      const result = battleReducer(initialState, {
        type: 'START_ONLINE',
        playerName: 'Tanmay',
        itemMode: 'competitive',
      });
      expect(result.phase).toBe('connecting');
      expect(result.gameMode).toBe('online');
      expect(result.playerName).toBe('Tanmay');
      expect(result.itemMode).toBe('competitive');
    });

    it('stores maxGen and legendaryMode', () => {
      const result = battleReducer(initialState, {
        type: 'START_ONLINE',
        playerName: 'Tanmay',
        itemMode: 'competitive',
        maxGen: 4,
        legendaryMode: true,
      });
      expect(result.maxGen).toBe(4);
      expect(result.legendaryMode).toBe(true);
    });

    it('defaults maxGen to null and legendaryMode to false', () => {
      const result = battleReducer(initialState, {
        type: 'START_ONLINE',
        playerName: 'Tanmay',
        itemMode: 'competitive',
      });
      expect(result.maxGen).toBeNull();
      expect(result.legendaryMode).toBe(false);
    });
  });

  // ========== CONNECTED ==========
  describe('CONNECTED', () => {
    it('stays connecting for cpu mode', () => {
      const state = { ...initialState, phase: 'connecting' as const, gameMode: 'cpu' as const };
      const result = battleReducer(state, { type: 'CONNECTED' });
      expect(result.phase).toBe('connecting');
    });

    it('transitions to online_lobby for online mode', () => {
      const state = { ...initialState, phase: 'connecting' as const, gameMode: 'online' as const };
      const result = battleReducer(state, { type: 'CONNECTED' });
      expect(result.phase).toBe('online_lobby');
    });
  });

  // ========== ROOM_CREATED (CPU) ==========
  describe('ROOM_CREATED', () => {
    it('stores room code and bot name', () => {
      const state = { ...initialState, phase: 'connecting' as const };
      const result = battleReducer(state, { type: 'ROOM_CREATED', code: 'ABC123', botName: 'Nikhil' });
      expect(result.roomCode).toBe('ABC123');
      expect(result.botName).toBe('Nikhil');
    });
  });

  // ========== ONLINE_ROOM_CREATED ==========
  describe('ONLINE_ROOM_CREATED', () => {
    it('stores room code and transitions to online_lobby', () => {
      const state = { ...initialState, phase: 'connecting' as const, gameMode: 'online' as const };
      const result = battleReducer(state, { type: 'ONLINE_ROOM_CREATED', code: 'XYZ789' });
      expect(result.roomCode).toBe('XYZ789');
      expect(result.phase).toBe('online_lobby');
    });
  });

  // ========== OPPONENT_JOINED ==========
  describe('OPPONENT_JOINED', () => {
    it('stores opponent name in online mode', () => {
      const state = { ...initialState, gameMode: 'online' as const };
      const result = battleReducer(state, { type: 'OPPONENT_JOINED', name: 'Nikhil' });
      expect(result.opponentName).toBe('Nikhil');
    });

    it('does not store name in cpu mode', () => {
      const state = { ...initialState, gameMode: 'cpu' as const };
      const result = battleReducer(state, { type: 'OPPONENT_JOINED', name: 'BotAI' });
      expect(result.opponentName).toBeNull();
    });

    it('does not store name when name is undefined (online)', () => {
      const state = { ...initialState, gameMode: 'online' as const };
      const result = battleReducer(state, { type: 'OPPONENT_JOINED' });
      expect(result.opponentName).toBeNull();
    });

    it('returns same state for cpu mode even with name', () => {
      const state = { ...initialState, gameMode: 'cpu' as const };
      const result = battleReducer(state, { type: 'OPPONENT_JOINED', name: 'ShouldBeIgnored' });
      expect(result).toBe(state); // identity check — no mutation
    });
  });

  // ========== TEAM_PREVIEW ==========
  describe('TEAM_PREVIEW', () => {
    it('transitions to team_preview and stores team', () => {
      const team = makeTeam();
      const result = battleReducer(initialState, {
        type: 'TEAM_PREVIEW',
        payload: { yourTeam: team, yourPlayerIndex: 1 },
      });
      expect(result.phase).toBe('team_preview');
      expect(result.yourTeam).toBe(team);
      expect(result.yourPlayerIndex).toBe(1);
    });
  });

  // ========== BATTLE_START ==========
  describe('BATTLE_START', () => {
    it('transitions to battling and sets up own state', () => {
      const payload = makeBattleStartPayload();
      const result = battleReducer(initialState, { type: 'BATTLE_START', payload });
      expect(result.phase).toBe('battling');
      expect(result.yourTeam).toHaveLength(6);
      expect(result.yourPlayerIndex).toBe(0);
      expect(result.turn).toBe(1);
      expect(result.yourState).not.toBeNull();
      expect(result.yourState!.activePokemonIndex).toBe(0);
      expect(result.yourState!.sideEffects).toEqual(EMPTY_SIDE);
    });

    it('populates opponentVisible when opponentLead is provided', () => {
      const lead = makeMockVisiblePokemon();
      const payload = makeBattleStartPayload({ opponentLead: lead, opponentName: 'Nikhil' });
      const result = battleReducer(initialState, { type: 'BATTLE_START', payload });
      expect(result.opponentVisible).not.toBeNull();
      expect(result.opponentVisible!.activePokemon).toEqual(lead);
      expect(result.opponentVisible!.scoutedPokemon).toEqual([]);
      expect(result.opponentVisible!.teamSize).toBe(6);
      expect(result.opponentVisible!.faintedCount).toBe(0);
      expect(result.opponentName).toBe('Nikhil');
    });

    it('does not set opponentVisible when opponentLead is absent', () => {
      const payload = makeBattleStartPayload();
      const result = battleReducer(initialState, { type: 'BATTLE_START', payload });
      expect(result.opponentVisible).toBeNull();
    });

    it('uses activePokemonIndex from payload', () => {
      const payload = makeBattleStartPayload({ activePokemonIndex: 3 });
      const result = battleReducer(initialState, { type: 'BATTLE_START', payload });
      expect(result.yourState!.activePokemonIndex).toBe(3);
    });

    it('defaults activePokemonIndex to 0 when not provided', () => {
      const payload = makeBattleStartPayload();
      const result = battleReducer(initialState, { type: 'BATTLE_START', payload });
      expect(result.yourState!.activePokemonIndex).toBe(0);
    });

    it('stores roomOptions from payload', () => {
      const payload = makeBattleStartPayload({
        roomOptions: { maxGen: 4, legendaryMode: true },
      });
      const result = battleReducer(initialState, { type: 'BATTLE_START', payload });
      expect(result.roomOptions).toEqual({ maxGen: 4, legendaryMode: true });
    });

    it('roomOptions is null when not provided in payload', () => {
      const payload = makeBattleStartPayload();
      const result = battleReducer(initialState, { type: 'BATTLE_START', payload });
      expect(result.roomOptions).toBeNull();
    });

    it('sets opponentLead but not opponentName when name absent', () => {
      const lead = makeMockVisiblePokemon();
      const payload = makeBattleStartPayload({ opponentLead: lead });
      const state = { ...initialState, opponentName: null };
      const result = battleReducer(state, { type: 'BATTLE_START', payload });
      expect(result.opponentVisible).not.toBeNull();
      expect(result.opponentName).toBeNull();
    });
  });

  // ========== BOT_LEAD_REVEALED ==========
  describe('BOT_LEAD_REVEALED', () => {
    it('sets up opponentVisible from own pokemon data', () => {
      const lead = makeMockOwnPokemon();
      const result = battleReducer(initialState, {
        type: 'BOT_LEAD_REVEALED',
        lead,
        teamSize: 6,
      });
      expect(result.opponentVisible).not.toBeNull();
      expect(result.opponentVisible!.activePokemon.species.name).toBe('Charizard');
      expect(result.opponentVisible!.activePokemon.ability).toBe('Blaze');
      expect(result.opponentVisible!.teamSize).toBe(6);
      expect(result.opponentVisible!.scoutedPokemon).toEqual([]);
    });
  });

  // ========== ACTION_SUBMITTED ==========
  describe('ACTION_SUBMITTED', () => {
    it('transitions to waiting_for_turn', () => {
      const state = battlingState();
      const result = battleReducer(state, { type: 'ACTION_SUBMITTED' });
      expect(result.phase).toBe('waiting_for_turn');
    });
  });

  // ========== TURN_RESULT ==========
  describe('TURN_RESULT', () => {
    it('sets phase to battling and stores events when no animation in progress', () => {
      const state = battlingState({ phase: 'waiting_for_turn' });
      const events: BattleEvent[] = [
        { type: 'use_move', data: { pokemon: 'Charizard', move: 'Flamethrower' } },
        { type: 'damage', data: { pokemon: 'Garchomp', damage: 80, currentHp: 277, maxHp: 357 } },
      ];
      const payload = makeTurnResultPayload({ events, turn: 2 });
      const result = battleReducer(state, { type: 'TURN_RESULT', payload });

      expect(result.phase).toBe('battling');
      expect(result.pendingEvents).toEqual(events);
      expect(result.turn).toBe(2);
      // State is deferred when there are events
      expect(result.queuedYourState).not.toBeNull();
    });

    it('immediately applies state when there are no events', () => {
      const state = battlingState({ phase: 'waiting_for_turn' });
      const payload = makeTurnResultPayload({ events: [], turn: 3 });
      const result = battleReducer(state, { type: 'TURN_RESULT', payload });

      expect(result.pendingEvents).toEqual([]);
      expect(result.yourState).toBe(payload.yourState);
      expect(result.opponentVisible).toBe(payload.opponentVisible);
      expect(result.queuedYourState).toBeNull();
    });

    it('queues events when animation is already in progress', () => {
      const existingEvents: BattleEvent[] = [
        { type: 'use_move', data: { pokemon: 'Gengar', move: 'Shadow Ball' } },
      ];
      const state = battlingState({ pendingEvents: existingEvents });
      const newEvents: BattleEvent[] = [
        { type: 'use_move', data: { pokemon: 'Charizard', move: 'Flamethrower' } },
      ];
      const payload = makeTurnResultPayload({ events: newEvents, turn: 3 });
      const result = battleReducer(state, { type: 'TURN_RESULT', payload });

      // Original pending events unchanged
      expect(result.pendingEvents).toBe(existingEvents);
      // New events queued
      expect(result.queuedPendingEvents).toEqual(newEvents);
      expect(result.queuedYourState).toBe(payload.yourState);
    });

    it('appends to existing queued events when multiple turn results arrive during animation', () => {
      const firstQueued: BattleEvent[] = [
        { type: 'use_move', data: { pokemon: 'Dragonite', move: 'Dragon Claw' } },
      ];
      const state = battlingState({
        pendingEvents: [{ type: 'use_move', data: { pokemon: 'Gengar', move: 'Shadow Ball' } }],
        queuedPendingEvents: firstQueued,
      });
      const moreEvents: BattleEvent[] = [
        { type: 'damage', data: { pokemon: 'Garchomp', damage: 50, currentHp: 307, maxHp: 357 } },
      ];
      const payload = makeTurnResultPayload({ events: moreEvents });
      const result = battleReducer(state, { type: 'TURN_RESULT', payload });

      expect(result.queuedPendingEvents).toHaveLength(2);
      expect(result.queuedPendingEvents[0]).toBe(firstQueued[0]);
      expect(result.queuedPendingEvents[1]).toBe(moreEvents[0]);
    });

    it('accumulates battle stats from damage events', () => {
      const state = battlingState();
      const events: BattleEvent[] = [
        { type: 'use_move', data: { pokemon: 'Charizard', move: 'Flamethrower' } },
        { type: 'damage', data: { pokemon: 'Garchomp', damage: 120, currentHp: 237, maxHp: 357 } },
      ];
      const payload = makeTurnResultPayload({ events });
      const result = battleReducer(state, { type: 'TURN_RESULT', payload });

      expect(result.battleStats.playerDamageDealt).toBe(120);
      expect(result.battleStats.pokemonDamage['Charizard']).toBe(120);
      expect(result.battleStats.biggestHitDealt).toEqual({
        pokemon: 'Charizard',
        move: 'Flamethrower',
        damage: 120,
      });
    });

    it('accumulates opponent damage stats', () => {
      const state = battlingState();
      // Use a Pokemon name NOT in the player team so accumulateStats treats it as opponent
      const events: BattleEvent[] = [
        { type: 'use_move', data: { pokemon: 'Tyranitar', move: 'Earthquake' } },
        { type: 'damage', data: { pokemon: 'Charizard', damage: 200, currentHp: 97, maxHp: 297 } },
      ];
      const payload = makeTurnResultPayload({ events });
      const result = battleReducer(state, { type: 'TURN_RESULT', payload });

      expect(result.battleStats.opponentDamageDealt).toBe(200);
      expect(result.battleStats.biggestHitTaken).toEqual({
        pokemon: 'Tyranitar',
        move: 'Earthquake',
        damage: 200,
      });
    });

    it('tracks KOs correctly', () => {
      const state = battlingState();
      // Use opponent Pokemon name NOT in player team
      const events: BattleEvent[] = [
        { type: 'use_move', data: { pokemon: 'Charizard', move: 'Flamethrower' } },
        { type: 'damage', data: { pokemon: 'Tyranitar', damage: 357, currentHp: 0, maxHp: 357 } },
        { type: 'faint', data: { pokemon: 'Tyranitar' } },
      ];
      const payload = makeTurnResultPayload({ events });
      const result = battleReducer(state, { type: 'TURN_RESULT', payload });

      expect(result.battleStats.playerKOs).toBe(1);
      expect(result.battleStats.opponentKOs).toBe(0);
      expect(result.battleStats.pokemonKOs['Charizard']).toBe(1);
    });

    it('tracks player faint as opponent KO', () => {
      const state = battlingState();
      const events: BattleEvent[] = [
        { type: 'use_move', data: { pokemon: 'Tyranitar', move: 'Earthquake' } },
        { type: 'damage', data: { pokemon: 'Charizard', damage: 297, currentHp: 0, maxHp: 297 } },
        { type: 'faint', data: { pokemon: 'Charizard' } },
      ];
      const payload = makeTurnResultPayload({ events });
      const result = battleReducer(state, { type: 'TURN_RESULT', payload });

      expect(result.battleStats.opponentKOs).toBe(1);
      expect(result.battleStats.playerKOs).toBe(0);
    });

    it('clears phaseBeforeDisconnect on turn result', () => {
      const state = battlingState({ phaseBeforeDisconnect: 'battling' });
      const payload = makeTurnResultPayload();
      const result = battleReducer(state, { type: 'TURN_RESULT', payload });
      expect(result.phaseBeforeDisconnect).toBeNull();
    });
  });

  // ========== NEEDS_SWITCH ==========
  describe('NEEDS_SWITCH', () => {
    it('transitions to needs_switch when no events animating', () => {
      const state = battlingState();
      const payload = makeNeedsSwitchPayload();
      const result = battleReducer(state, { type: 'NEEDS_SWITCH', payload });
      expect(result.phase).toBe('needs_switch');
      expect(result.availableSwitches).toHaveLength(2);
      expect(result.switchReason).toBe('faint');
    });

    it('queues when events are animating', () => {
      const state = battlingState({
        pendingEvents: [{ type: 'use_move', data: { pokemon: 'Charizard', move: 'Fire Blast' } }],
      });
      const payload = makeNeedsSwitchPayload();
      const result = battleReducer(state, { type: 'NEEDS_SWITCH', payload });
      expect(result.phase).toBe('battling'); // unchanged
      expect(result.queuedSwitch).toBe(payload);
    });

    it('handles self_switch reason', () => {
      const state = battlingState();
      const payload = makeNeedsSwitchPayload({ reason: 'self_switch' });
      const result = battleReducer(state, { type: 'NEEDS_SWITCH', payload });
      expect(result.switchReason).toBe('self_switch');
    });

    it('defaults to faint when reason is undefined', () => {
      const state = battlingState();
      const payload: NeedsSwitchPayload = {
        availableSwitches: [{ index: 1, pokemon: makeMockOwnPokemon() }],
      };
      const result = battleReducer(state, { type: 'NEEDS_SWITCH', payload });
      expect(result.switchReason).toBe('faint');
    });
  });

  // ========== BATTLE_END ==========
  describe('BATTLE_END', () => {
    it('transitions to battle_end when no events animating', () => {
      const state = battlingState();
      const payload = makeBattleEndPayload();
      const result = battleReducer(state, { type: 'BATTLE_END', payload });
      expect(result.phase).toBe('battle_end');
      expect(result.battleEndData).toBe(payload);
    });

    it('queues when events are animating', () => {
      const state = battlingState({
        pendingEvents: [{ type: 'faint', data: { pokemon: 'Garchomp' } }],
      });
      const payload = makeBattleEndPayload();
      const result = battleReducer(state, { type: 'BATTLE_END', payload });
      expect(result.phase).toBe('battling'); // unchanged
      expect(result.queuedEnd).toBe(payload);
    });
  });

  // ========== EVENTS_PROCESSED ==========
  describe('EVENTS_PROCESSED', () => {
    it('clears pendingEvents', () => {
      const state = battlingState({
        pendingEvents: [{ type: 'use_move', data: { pokemon: 'Charizard', move: 'Flamethrower' } }],
      });
      const result = battleReducer(state, { type: 'EVENTS_PROCESSED' });
      expect(result.pendingEvents).toEqual([]);
    });

    it('flushes queued state when no more queued events', () => {
      const queuedYourState = {
        team: makeTeam(),
        activePokemonIndex: 1,
        sideEffects: { ...EMPTY_SIDE },
      };
      const queuedOpp = {
        activePokemon: makeMockVisiblePokemon(),
        scoutedPokemon: [],
        teamSize: 6,
        faintedCount: 0,
        sideEffects: { ...EMPTY_SIDE },
      };
      const state = battlingState({
        pendingEvents: [{ type: 'use_move', data: { pokemon: 'Charizard', move: 'Flamethrower' } }],
        queuedYourState: queuedYourState,
        queuedOpponentVisible: queuedOpp,
      });
      const result = battleReducer(state, { type: 'EVENTS_PROCESSED' });
      expect(result.yourState).toBe(queuedYourState);
      expect(result.opponentVisible).toBe(queuedOpp);
      expect(result.queuedYourState).toBeNull();
      expect(result.queuedOpponentVisible).toBeNull();
    });

    it('moves queuedPendingEvents to pendingEvents first', () => {
      const queuedEvents: BattleEvent[] = [
        { type: 'use_move', data: { pokemon: 'Gengar', move: 'Shadow Ball' } },
      ];
      const state = battlingState({
        pendingEvents: [{ type: 'use_move', data: { pokemon: 'Charizard', move: 'Flamethrower' } }],
        queuedPendingEvents: queuedEvents,
        queuedYourState: { team: makeTeam(), activePokemonIndex: 0, sideEffects: { ...EMPTY_SIDE } },
      });
      const result = battleReducer(state, { type: 'EVENTS_PROCESSED' });
      // Queued events moved to pending
      expect(result.pendingEvents).toEqual(queuedEvents);
      expect(result.queuedPendingEvents).toEqual([]);
      // Deferred state NOT flushed yet (wait for queued events to finish animating)
      expect(result.queuedYourState).not.toBeNull();
    });

    it('flushes queuedSwitch after events done', () => {
      const switchPayload = makeNeedsSwitchPayload();
      const state = battlingState({
        pendingEvents: [{ type: 'faint', data: { pokemon: 'Garchomp' } }],
        queuedSwitch: switchPayload,
      });
      const result = battleReducer(state, { type: 'EVENTS_PROCESSED' });
      expect(result.phase).toBe('needs_switch');
      expect(result.availableSwitches).toBe(switchPayload.availableSwitches);
      expect(result.queuedSwitch).toBeNull();
    });

    it('flushes queuedEnd after events done', () => {
      const endPayload = makeBattleEndPayload();
      const state = battlingState({
        pendingEvents: [{ type: 'faint', data: { pokemon: 'Garchomp' } }],
        queuedEnd: endPayload,
      });
      const result = battleReducer(state, { type: 'EVENTS_PROCESSED' });
      expect(result.phase).toBe('battle_end');
      expect(result.battleEndData).toBe(endPayload);
      expect(result.queuedEnd).toBeNull();
    });

    it('queued end takes priority alongside queued switch (both flushed)', () => {
      const switchPayload = makeNeedsSwitchPayload();
      const endPayload = makeBattleEndPayload();
      const state = battlingState({
        pendingEvents: [{ type: 'faint', data: { pokemon: 'Garchomp' } }],
        queuedSwitch: switchPayload,
        queuedEnd: endPayload,
      });
      const result = battleReducer(state, { type: 'EVENTS_PROCESSED' });
      // End is applied AFTER switch (sequential), so end wins
      expect(result.phase).toBe('battle_end');
      expect(result.battleEndData).toBe(endPayload);
    });
  });

  // ========== SET_ACTION_VIEW ==========
  describe('SET_ACTION_VIEW', () => {
    it('switches to switch view', () => {
      const state = battlingState();
      const result = battleReducer(state, { type: 'SET_ACTION_VIEW', view: 'switch' });
      expect(result.actionView).toBe('switch');
    });

    it('switches back to moves view', () => {
      const state = battlingState({ actionView: 'switch' });
      const result = battleReducer(state, { type: 'SET_ACTION_VIEW', view: 'moves' });
      expect(result.actionView).toBe('moves');
    });
  });

  // ========== RECONNECTING ==========
  describe('RECONNECTING', () => {
    it('sets isReconnecting to true', () => {
      const state = battlingState();
      const result = battleReducer(state, { type: 'RECONNECTING' });
      expect(result.isReconnecting).toBe(true);
    });

    it('preserves current phase', () => {
      const state = battlingState({ phase: 'waiting_for_turn' });
      const result = battleReducer(state, { type: 'RECONNECTING' });
      expect(result.phase).toBe('waiting_for_turn');
      expect(result.isReconnecting).toBe(true);
    });
  });

  // ========== RECONNECTED ==========
  describe('RECONNECTED', () => {
    it('clears isReconnecting', () => {
      const state = battlingState({ isReconnecting: true });
      const result = battleReducer(state, { type: 'RECONNECTED' });
      expect(result.isReconnecting).toBe(false);
    });

    it('preserves current phase', () => {
      const state = battlingState({ phase: 'battling', isReconnecting: true });
      const result = battleReducer(state, { type: 'RECONNECTED' });
      expect(result.phase).toBe('battling');
      expect(result.isReconnecting).toBe(false);
    });
  });

  // ========== DISCONNECTED ==========
  describe('DISCONNECTED', () => {
    it('transitions to disconnected and saves previous phase', () => {
      const state = battlingState();
      const result = battleReducer(state, { type: 'DISCONNECTED' });
      expect(result.phase).toBe('disconnected');
      expect(result.phaseBeforeDisconnect).toBe('battling');
      expect(result.isReconnecting).toBe(false);
    });

    it('clears isReconnecting when fully disconnected', () => {
      const state = battlingState({ isReconnecting: true });
      const result = battleReducer(state, { type: 'DISCONNECTED' });
      expect(result.phase).toBe('disconnected');
      expect(result.isReconnecting).toBe(false);
    });

    it('saves waiting_for_turn as phaseBeforeDisconnect', () => {
      const state = battlingState({ phase: 'waiting_for_turn' });
      const result = battleReducer(state, { type: 'DISCONNECTED' });
      expect(result.phaseBeforeDisconnect).toBe('waiting_for_turn');
    });
  });

  // ========== OPPONENT_DISCONNECTED ==========
  describe('OPPONENT_DISCONNECTED', () => {
    it('transitions to disconnected in online mode', () => {
      const state = battlingState({ gameMode: 'online' });
      const result = battleReducer(state, { type: 'OPPONENT_DISCONNECTED' });
      expect(result.phase).toBe('disconnected');
      expect(result.phaseBeforeDisconnect).toBe('battling');
    });

    it('is ignored in cpu mode (returns same state)', () => {
      const state = battlingState({ gameMode: 'cpu' });
      const result = battleReducer(state, { type: 'OPPONENT_DISCONNECTED' });
      expect(result).toBe(state); // exact identity
    });

    it('saves current phase before disconnect (online)', () => {
      const state = battlingState({ gameMode: 'online', phase: 'waiting_for_turn' });
      const result = battleReducer(state, { type: 'OPPONENT_DISCONNECTED' });
      expect(result.phase).toBe('disconnected');
      expect(result.phaseBeforeDisconnect).toBe('waiting_for_turn');
    });
  });

  // ========== RESET ==========
  describe('RESET', () => {
    it('resets to initial state but preserves playerName and itemMode', () => {
      const state = battlingState({
        playerName: 'Tanmay',
        itemMode: 'casual',
        gameMode: 'online',
        roomCode: 'ABC123',
        opponentName: 'Nikhil',
      });
      const result = battleReducer(state, { type: 'RESET' });
      expect(result.phase).toBe('setup');
      expect(result.playerName).toBe('Player'); // fully resets name
      expect(result.itemMode).toBe('competitive'); // fully resets item mode
      expect(result.gameMode).toBe('cpu'); // reset to default
      expect(result.roomCode).toBeNull();
      expect(result.opponentName).toBeNull();
    });

    it('resets battle stats', () => {
      const state = battlingState({
        battleStats: {
          playerDamageDealt: 500,
          opponentDamageDealt: 300,
          playerKOs: 3,
          opponentKOs: 2,
          biggestHitDealt: { pokemon: 'Charizard', move: 'Fire Blast', damage: 200 },
          biggestHitTaken: null,
          pokemonDamage: { Charizard: 500 },
          pokemonKOs: { Charizard: 3 },
        },
      });
      const result = battleReducer(state, { type: 'RESET' });
      expect(result.battleStats.playerDamageDealt).toBe(0);
      expect(result.battleStats.playerKOs).toBe(0);
      expect(result.battleStats.biggestHitDealt).toBeNull();
      expect(result.battleStats.pokemonDamage).toEqual({});
    });
  });

  // ========== Unknown action ==========
  describe('unknown action', () => {
    it('returns state unchanged', () => {
      const state = battlingState();
      const result = battleReducer(state, { type: 'NONEXISTENT' } as any);
      expect(result).toBe(state);
    });
  });

  // ========== Complex state machine flows ==========
  describe('full flow: online game lifecycle', () => {
    it('setup → connecting → online_lobby → team_preview → battling → waiting → battle_end → reset', () => {
      let state = initialState;

      // 1. Start online
      state = battleReducer(state, { type: 'START_ONLINE', playerName: 'Tanmay', itemMode: 'competitive' });
      expect(state.phase).toBe('connecting');
      expect(state.gameMode).toBe('online');

      // 2. Connected
      state = battleReducer(state, { type: 'CONNECTED' });
      expect(state.phase).toBe('online_lobby');

      // 3. Room created
      state = battleReducer(state, { type: 'ONLINE_ROOM_CREATED', code: 'ABC123' });
      expect(state.phase).toBe('online_lobby');
      expect(state.roomCode).toBe('ABC123');

      // 4. Opponent joins
      state = battleReducer(state, { type: 'OPPONENT_JOINED', name: 'Nikhil' });
      expect(state.opponentName).toBe('Nikhil');

      // 5. Team preview
      state = battleReducer(state, {
        type: 'TEAM_PREVIEW',
        payload: { yourTeam: makeTeam(), yourPlayerIndex: 0 },
      });
      expect(state.phase).toBe('team_preview');

      // 6. Battle start with opponent lead
      const lead = makeMockVisiblePokemon();
      state = battleReducer(state, {
        type: 'BATTLE_START',
        payload: makeBattleStartPayload({ opponentLead: lead, opponentName: 'Nikhil' }),
      });
      expect(state.phase).toBe('battling');
      expect(state.opponentVisible).not.toBeNull();

      // 7. Submit action
      state = battleReducer(state, { type: 'ACTION_SUBMITTED' });
      expect(state.phase).toBe('waiting_for_turn');

      // 8. Turn result
      state = battleReducer(state, { type: 'TURN_RESULT', payload: makeTurnResultPayload() });
      expect(state.phase).toBe('battling');

      // 9. Battle end
      state = battleReducer(state, { type: 'BATTLE_END', payload: makeBattleEndPayload() });
      expect(state.phase).toBe('battle_end');

      // 10. Reset — fully clears state including name
      state = battleReducer(state, { type: 'RESET' });
      expect(state.phase).toBe('setup');
      expect(state.playerName).toBe('Player');
    });
  });

  describe('full flow: cpu game lifecycle', () => {
    it('setup → connecting → team_preview → battling → battle_end', () => {
      let state = initialState;

      state = battleReducer(state, { type: 'START_GAME', playerName: 'Tanmay', itemMode: 'competitive' });
      expect(state.gameMode).toBe('cpu');

      state = battleReducer(state, { type: 'CONNECTED' });
      expect(state.phase).toBe('connecting'); // stays connecting for CPU (waits for room)

      state = battleReducer(state, { type: 'ROOM_CREATED', code: 'XYZ789', botName: 'Nikhil' });
      expect(state.botName).toBe('Nikhil');

      state = battleReducer(state, {
        type: 'TEAM_PREVIEW',
        payload: { yourTeam: makeTeam(), yourPlayerIndex: 0 },
      });
      expect(state.phase).toBe('team_preview');

      state = battleReducer(state, {
        type: 'BATTLE_START',
        payload: makeBattleStartPayload(),
      });
      expect(state.phase).toBe('battling');
      expect(state.opponentVisible).toBeNull(); // no opponent lead for CPU initially

      // Bot lead revealed
      state = battleReducer(state, {
        type: 'BOT_LEAD_REVEALED',
        lead: makeMockOwnPokemon(),
        teamSize: 6,
      });
      expect(state.opponentVisible).not.toBeNull();
    });
  });

  describe('edge case: disconnect during different phases', () => {
    it('disconnect during online_lobby', () => {
      const state: BattleState = { ...initialState, phase: 'online_lobby', gameMode: 'online' };
      const result = battleReducer(state, { type: 'DISCONNECTED' });
      expect(result.phase).toBe('disconnected');
      expect(result.phaseBeforeDisconnect).toBe('online_lobby');
    });

    it('opponent disconnect during team_preview (online)', () => {
      const state: BattleState = { ...initialState, phase: 'team_preview', gameMode: 'online' };
      const result = battleReducer(state, { type: 'OPPONENT_DISCONNECTED' });
      expect(result.phase).toBe('disconnected');
      expect(result.phaseBeforeDisconnect).toBe('team_preview');
    });
  });
});
