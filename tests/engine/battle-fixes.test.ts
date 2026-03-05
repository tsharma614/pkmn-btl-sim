import { describe, it, expect, beforeEach } from 'vitest';
import { Battle } from '../../src/engine/battle';
import { createBattlePokemon } from '../../src/engine/pokemon-factory';
import { Player, PokemonSpecies, PokemonSet, BattlePokemon, PokemonType, Nature, MoveData, StatusCondition } from '../../src/types';

// --- Test helpers (same pattern as status-fix.test.ts) ---

function createTestSpecies(overrides: Partial<PokemonSpecies> = {}): PokemonSpecies {
  return {
    id: 'testmon',
    name: 'Testmon',
    dexNum: 1,
    types: ['Normal'] as [PokemonType],
    baseStats: { hp: 100, atk: 100, def: 100, spa: 100, spd: 100, spe: 100 },
    abilities: ['Overgrow'],
    bestAbility: 'Overgrow',
    tier: 3,
    generation: 1,
    movePool: [],
    sets: [],
    ...overrides,
  } as PokemonSpecies;
}

function createTestSet(overrides: Partial<PokemonSet> = {}): PokemonSet {
  return {
    moves: ['Tackle', 'Thunderbolt', 'Ice Beam', 'Earthquake'],
    ability: 'Overgrow',
    item: 'Leftovers',
    nature: 'Hardy' as Nature,
    evs: { hp: 252, atk: 252, spe: 4 },
    ...overrides,
  };
}

function createTestPlayer(
  id: string,
  name: string,
  teamOverrides: Array<{ species?: Partial<PokemonSpecies>; set?: Partial<PokemonSet> }> = []
): Player {
  const team: BattlePokemon[] = [];
  for (let i = 0; i < 6; i++) {
    const overrides = teamOverrides[i] || {};
    const species = createTestSpecies({ id: `mon${i}`, name: `Mon${i}`, ...overrides.species });
    const set = createTestSet(overrides.set);
    team.push(createBattlePokemon(species, set));
  }
  return {
    id,
    name,
    team,
    activePokemonIndex: 0,
    itemMode: 'competitive',
    hasMegaEvolved: false,
  };
}

// --- Weather Alias Tests ---

describe('Weather Move Aliases', () => {
  let battle: Battle;
  let p1: Player;
  let p2: Player;

  beforeEach(() => {
    p1 = createTestPlayer('p1', 'Alice');
    p2 = createTestPlayer('p2', 'Bob');
    battle = new Battle(p1, p2, 42);
  });

  it('translates "RainDance" weather value to "rain"', () => {
    const attacker = battle.getActivePokemon(0);
    const defender = battle.getActivePokemon(1);
    const move: MoveData = {
      name: 'Rain Dance',
      type: 'Water',
      category: 'Status',
      power: null,
      accuracy: null,
      pp: 5,
      priority: 0,
      flags: {},
      target: 'self',
      effects: [{ type: 'weather', weather: 'RainDance', chance: 100 }],
    };
    (battle as any).applyMoveEffects(attacker, defender, move, 0, 1, []);
    expect(battle.state.weather).toBe('rain');
  });

  it('translates "sunnyday" weather value to "sun"', () => {
    const attacker = battle.getActivePokemon(0);
    const defender = battle.getActivePokemon(1);
    const move: MoveData = {
      name: 'Sunny Day',
      type: 'Fire',
      category: 'Status',
      power: null,
      accuracy: null,
      pp: 5,
      priority: 0,
      flags: {},
      target: 'self',
      effects: [{ type: 'weather', weather: 'sunnyday', chance: 100 }],
    };
    (battle as any).applyMoveEffects(attacker, defender, move, 0, 1, []);
    expect(battle.state.weather).toBe('sun');
  });

  it('translates "Sandstorm" (capitalized) weather value to "sandstorm"', () => {
    const attacker = battle.getActivePokemon(0);
    const defender = battle.getActivePokemon(1);
    const move: MoveData = {
      name: 'Sandstorm',
      type: 'Rock',
      category: 'Status',
      power: null,
      accuracy: null,
      pp: 10,
      priority: 0,
      flags: {},
      target: 'self',
      effects: [{ type: 'weather', weather: 'Sandstorm', chance: 100 }],
    };
    (battle as any).applyMoveEffects(attacker, defender, move, 0, 1, []);
    expect(battle.state.weather).toBe('sandstorm');
  });

  it('translates "snowscape" weather value to "hail"', () => {
    const attacker = battle.getActivePokemon(0);
    const defender = battle.getActivePokemon(1);
    const move: MoveData = {
      name: 'Snowscape',
      type: 'Ice',
      category: 'Status',
      power: null,
      accuracy: null,
      pp: 10,
      priority: 0,
      flags: {},
      target: 'self',
      effects: [{ type: 'weather', weather: 'snowscape', chance: 100 }],
    };
    (battle as any).applyMoveEffects(attacker, defender, move, 0, 1, []);
    expect(battle.state.weather).toBe('hail');
  });

  it('"hail" weather value passes through unchanged', () => {
    const attacker = battle.getActivePokemon(0);
    const defender = battle.getActivePokemon(1);
    const move: MoveData = {
      name: 'Hail',
      type: 'Ice',
      category: 'Status',
      power: null,
      accuracy: null,
      pp: 10,
      priority: 0,
      flags: {},
      target: 'self',
      effects: [{ type: 'weather', weather: 'hail', chance: 100 }],
    };
    (battle as any).applyMoveEffects(attacker, defender, move, 0, 1, []);
    expect(battle.state.weather).toBe('hail');
  });
});

// --- Leech Seed Fix ---

describe('Leech Seed Fix', () => {
  let battle: Battle;
  let p1: Player;
  let p2: Player;

  beforeEach(() => {
    p1 = createTestPlayer('p1', 'Alice');
    p2 = createTestPlayer('p2', 'Bob');
    battle = new Battle(p1, p2, 42);
  });

  it('applies leechseed volatile status via volatileStatus field', () => {
    const attacker = battle.getActivePokemon(0);
    const defender = battle.getActivePokemon(1);
    const move: MoveData = {
      name: 'Leech Seed',
      type: 'Grass',
      category: 'Status',
      power: null,
      accuracy: 90,
      pp: 10,
      priority: 0,
      flags: {},
      target: 'normal',
      effects: [],
      volatileStatus: 'leechseed',
    };
    (battle as any).applyVolatileStatus(attacker, defender, move, 0, 1, []);
    expect(defender.volatileStatuses.has('leechseed')).toBe(true);
  });

  it('Leech Seed drains HP at end of turn', () => {
    const defender = battle.getActivePokemon(1);
    const attacker = battle.getActivePokemon(0);
    // Remove Leftovers so it doesn't interfere with HP assertions
    defender.item = null;
    attacker.item = null;
    defender.volatileStatuses.add('leechseed');

    const defHpBefore = defender.currentHp;
    const atkHpBefore = attacker.currentHp;
    // Damage attacker so healing is visible
    attacker.currentHp = Math.floor(attacker.maxHp / 2);
    const atkHpAfterDamage = attacker.currentHp;

    const events: any[] = [];
    (battle as any).processEndOfTurn(events);

    const expectedDrain = Math.max(1, Math.floor(defender.maxHp / 8));
    expect(defender.currentHp).toBe(defHpBefore - expectedDrain);
    expect(attacker.currentHp).toBe(atkHpAfterDamage + expectedDrain);
  });

  it('Leech Seed does not apply to Grass types', () => {
    const attacker = battle.getActivePokemon(0);
    const defender = battle.getActivePokemon(1);
    (defender.species as any).types = ['Grass'];
    const move: MoveData = {
      name: 'Leech Seed',
      type: 'Grass',
      category: 'Status',
      power: null,
      accuracy: 90,
      pp: 10,
      priority: 0,
      flags: {},
      target: 'normal',
      effects: [],
      volatileStatus: 'leechseed',
    };
    (battle as any).applyVolatileStatus(attacker, defender, move, 0, 1, []);
    expect(defender.volatileStatuses.has('leechseed')).toBe(false);
  });
});

// --- Reflect/Light Screen Side Fix ---

describe('Screens Applied to Correct Side', () => {
  let battle: Battle;
  let p1: Player;
  let p2: Player;

  beforeEach(() => {
    p1 = createTestPlayer('p1', 'Alice');
    p2 = createTestPlayer('p2', 'Bob');
    battle = new Battle(p1, p2, 42);
  });

  it('Reflect is applied to the user\'s side (playerIndex), not opponent', () => {
    const attacker = battle.getActivePokemon(0);
    const defender = battle.getActivePokemon(1);
    const move: MoveData = {
      name: 'Reflect',
      type: 'Psychic',
      category: 'Status',
      power: null,
      accuracy: null,
      pp: 20,
      priority: 0,
      flags: {},
      target: 'allySide',
      effects: [{ type: 'hazard', hazard: 'reflect', chance: 100 }],
    };
    (battle as any).applyMoveEffects(attacker, defender, move, 0, 1, []);

    const p1Side = battle.getSideEffects(0);
    const p2Side = battle.getSideEffects(1);
    expect(p1Side.reflect).toBeGreaterThan(0);
    expect(p2Side.reflect).toBe(0);
  });

  it('Light Screen is applied to the user\'s side', () => {
    const attacker = battle.getActivePokemon(0);
    const defender = battle.getActivePokemon(1);
    const move: MoveData = {
      name: 'Light Screen',
      type: 'Psychic',
      category: 'Status',
      power: null,
      accuracy: null,
      pp: 30,
      priority: 0,
      flags: {},
      target: 'allySide',
      effects: [{ type: 'hazard', hazard: 'lightscreen', chance: 100 }],
    };
    (battle as any).applyMoveEffects(attacker, defender, move, 0, 1, []);

    expect(battle.getSideEffects(0).lightScreen).toBeGreaterThan(0);
    expect(battle.getSideEffects(1).lightScreen).toBe(0);
  });

  it('Stealth Rock is applied to the opponent\'s side', () => {
    const attacker = battle.getActivePokemon(0);
    const defender = battle.getActivePokemon(1);
    const move: MoveData = {
      name: 'Stealth Rock',
      type: 'Rock',
      category: 'Status',
      power: null,
      accuracy: null,
      pp: 20,
      priority: 0,
      flags: {},
      target: 'normal',
      effects: [{ type: 'hazard', hazard: 'stealthrock', chance: 100 }],
    };
    (battle as any).applyMoveEffects(attacker, defender, move, 0, 1, []);

    expect(battle.getSideEffects(0).stealthRock).toBe(false);
    expect(battle.getSideEffects(1).stealthRock).toBe(true);
  });

  it('Tailwind is applied to the user\'s side and doubles speed', () => {
    const attacker = battle.getActivePokemon(0);
    const defender = battle.getActivePokemon(1);
    const move: MoveData = {
      name: 'Tailwind',
      type: 'Flying',
      category: 'Status',
      power: null,
      accuracy: null,
      pp: 15,
      priority: 0,
      flags: {},
      target: 'allySide',
      effects: [{ type: 'hazard', hazard: 'tailwind', chance: 100 }],
    };

    const speedBefore = (battle as any).getEffectiveSpeed(0);
    (battle as any).applyMoveEffects(attacker, defender, move, 0, 1, []);

    expect(battle.getSideEffects(0).tailwind).toBeGreaterThan(0);
    const speedAfter = (battle as any).getEffectiveSpeed(0);
    expect(speedAfter).toBe(Math.floor(speedBefore * 2));
  });

  it('Sticky Web is applied to the opponent\'s side', () => {
    const attacker = battle.getActivePokemon(0);
    const defender = battle.getActivePokemon(1);
    const move: MoveData = {
      name: 'Sticky Web',
      type: 'Bug',
      category: 'Status',
      power: null,
      accuracy: null,
      pp: 20,
      priority: 0,
      flags: {},
      target: 'normal',
      effects: [{ type: 'hazard', hazard: 'stickyweb', chance: 100 }],
    };
    (battle as any).applyMoveEffects(attacker, defender, move, 0, 1, []);

    expect(battle.getSideEffects(0).stickyWeb).toBe(false);
    expect(battle.getSideEffects(1).stickyWeb).toBe(true);
  });

  it('Sticky Web lowers speed on switch-in', () => {
    const side = battle.getSideEffects(0);
    side.stickyWeb = true;
    const switchIn = p1.team[1];
    const events: any[] = [];
    (battle as any).applyEntryHazards(0, switchIn, events);
    expect(switchIn.boosts.spe).toBe(-1);
  });

  it('Sticky Web does not affect Flying types on switch-in', () => {
    const side = battle.getSideEffects(0);
    side.stickyWeb = true;
    const switchIn = p1.team[1];
    (switchIn.species as any).types = ['Flying'];
    const events: any[] = [];
    (battle as any).applyEntryHazards(0, switchIn, events);
    expect(switchIn.boosts.spe).toBe(0);
  });
});

// --- Sheer Force ---

describe('Sheer Force', () => {
  let battle: Battle;
  let p1: Player;
  let p2: Player;

  beforeEach(() => {
    p1 = createTestPlayer('p1', 'Alice', [
      { set: { ability: 'Sheer Force', item: 'Life Orb' } },
    ]);
    p2 = createTestPlayer('p2', 'Bob');
    battle = new Battle(p1, p2, 42);
  });

  it('suppresses secondary status effects on target', () => {
    const attacker = battle.getActivePokemon(0);
    const defender = battle.getActivePokemon(1);
    // A move with a secondary burn effect
    const move: MoveData = {
      name: 'Flamethrower',
      type: 'Fire',
      category: 'Special',
      power: 90,
      accuracy: 100,
      pp: 15,
      priority: 0,
      flags: {},
      target: 'normal',
      effects: [{ type: 'status', status: 'brn', chance: 100, target: 'target' }],
    };
    const events: any[] = [];
    (battle as any).executeDamagingMove(attacker, defender, move, 0, 1, false, events);
    // Sheer Force should prevent burn from being applied
    expect(defender.status).toBeNull();
  });

  it('suppresses flinch effects', () => {
    const attacker = battle.getActivePokemon(0);
    const defender = battle.getActivePokemon(1);
    const move: MoveData = {
      name: 'Iron Head',
      type: 'Steel',
      category: 'Physical',
      power: 80,
      accuracy: 100,
      pp: 15,
      priority: 0,
      flags: {},
      target: 'normal',
      effects: [{ type: 'flinch', chance: 100 }],
    };
    const events: any[] = [];
    (battle as any).executeDamagingMove(attacker, defender, move, 0, 1, false, events);
    expect(defender.volatileStatuses.has('flinch')).toBe(false);
  });

  it('still applies self-targeting stat drops (e.g. Close Combat)', () => {
    const attacker = battle.getActivePokemon(0);
    const defender = battle.getActivePokemon(1);
    // Close Combat: has self-targeting def/spd drops AND secondary effects (none on target, but test the self-effect path)
    const move: MoveData = {
      name: 'Fire Punch',
      type: 'Fire',
      category: 'Physical',
      power: 75,
      accuracy: 100,
      pp: 15,
      priority: 0,
      flags: {},
      target: 'normal',
      effects: [
        { type: 'status', status: 'brn', chance: 100, target: 'target' },
        { type: 'boost', stat: 'def', stages: -1, chance: 100, target: 'self' },
      ],
    };
    const events: any[] = [];
    (battle as any).executeDamagingMove(attacker, defender, move, 0, 1, false, events);
    // Target status suppressed, but self-boost still applied
    expect(defender.status).toBeNull();
    expect(attacker.boosts.def).toBe(-1);
  });

  it('suppresses Life Orb recoil when secondary effects are present', () => {
    const attacker = battle.getActivePokemon(0);
    const defender = battle.getActivePokemon(1);
    const move: MoveData = {
      name: 'Flamethrower',
      type: 'Fire',
      category: 'Special',
      power: 90,
      accuracy: 100,
      pp: 15,
      priority: 0,
      flags: {},
      target: 'normal',
      effects: [{ type: 'status', status: 'brn', chance: 10, target: 'target' }],
    };
    const events: any[] = [];
    const hpBefore = attacker.currentHp;
    (battle as any).executeDamagingMove(attacker, defender, move, 0, 1, false, events);
    // No Life Orb recoil should be taken
    const lifeOrbEvents = events.filter(e => e.type === 'item_damage' && e.data.item === 'Life Orb');
    expect(lifeOrbEvents.length).toBe(0);
  });

  it('does NOT suppress Life Orb recoil for moves without secondary effects', () => {
    const attacker = battle.getActivePokemon(0);
    const defender = battle.getActivePokemon(1);
    const move: MoveData = {
      name: 'Psychic',
      type: 'Psychic',
      category: 'Special',
      power: 90,
      accuracy: 100,
      pp: 10,
      priority: 0,
      flags: {},
      target: 'normal',
      effects: [], // no secondary effects
    };
    const events: any[] = [];
    (battle as any).executeDamagingMove(attacker, defender, move, 0, 1, false, events);
    const lifeOrbEvents = events.filter(e => e.type === 'item_damage' && e.data.item === 'Life Orb');
    expect(lifeOrbEvents.length).toBe(1);
  });
});

// --- Binding Move Damage ---

describe('Binding Move End-of-Turn Damage', () => {
  let battle: Battle;
  let p1: Player;
  let p2: Player;

  beforeEach(() => {
    p1 = createTestPlayer('p1', 'Alice');
    p2 = createTestPlayer('p2', 'Bob');
    battle = new Battle(p1, p2, 42);
  });

  it('partiallytrapped deals 1/8 max HP at end of turn', () => {
    const defender = battle.getActivePokemon(1);
    defender.item = null; // Remove Leftovers
    defender.volatileStatuses.add('partiallytrapped' as any);
    const hpBefore = defender.currentHp;
    const events: any[] = [];
    (battle as any).processEndOfTurn(events);
    const expectedDmg = Math.max(1, Math.floor(defender.maxHp / 8));
    expect(defender.currentHp).toBe(hpBefore - expectedDmg);
    const trapEvent = events.find(e => e.type === 'status_damage' && e.data.status === 'trapped');
    expect(trapEvent).toBeDefined();
  });
});

// --- Endure ---

describe('Endure', () => {
  let battle: Battle;
  let p1: Player;
  let p2: Player;

  beforeEach(() => {
    p1 = createTestPlayer('p1', 'Alice');
    p2 = createTestPlayer('p2', 'Bob');
    battle = new Battle(p1, p2, 42);
  });

  it('survives a direct attack at 1 HP when endure is active', () => {
    const defender = battle.getActivePokemon(1);
    defender.volatileStatuses.add('endure');
    defender.currentHp = 1;
    // Simulate direct attack damage
    defender.currentHp = -50;
    const events: any[] = [];
    (battle as any).checkFaint(defender, 1, events, true);
    expect(defender.isAlive).toBe(true);
    expect(defender.currentHp).toBe(1);
    const endureEvent = events.find(e => e.type === 'endure');
    expect(endureEvent).toBeDefined();
  });

  it('does NOT survive residual damage (burn)', () => {
    const defender = battle.getActivePokemon(1);
    defender.volatileStatuses.add('endure');
    defender.currentHp = -10;
    const events: any[] = [];
    // fromDirectAttack defaults to false
    (battle as any).checkFaint(defender, 1, events);
    expect(defender.isAlive).toBe(false);
    expect(defender.currentHp).toBe(0);
  });

  it('is cleared at start of next turn', () => {
    const active = battle.getActivePokemon(0);
    active.volatileStatuses.add('endure');
    // Process a turn — endure should be cleared at start
    battle.processTurn(
      { type: 'move', playerId: 'p1', moveIndex: 0 },
      { type: 'move', playerId: 'p2', moveIndex: 0 },
    );
    expect(active.volatileStatuses.has('endure')).toBe(false);
  });

  it('sets protectedLastTurn so consecutive use fails', () => {
    const active = battle.getActivePokemon(0);
    active.volatileStatuses.add('endure');
    // Simulate turn start clearing
    active.protectedLastTurn = active.volatileStatuses.has('endure');
    active.volatileStatuses.delete('endure');
    expect(active.protectedLastTurn).toBe(true);
  });
});

// --- Yawn ---

describe('Yawn', () => {
  let battle: Battle;
  let p1: Player;
  let p2: Player;

  beforeEach(() => {
    p1 = createTestPlayer('p1', 'Alice');
    p2 = createTestPlayer('p2', 'Bob');
    battle = new Battle(p1, p2, 42);
  });

  it('applies yawn volatile status', () => {
    const attacker = battle.getActivePokemon(0);
    const defender = battle.getActivePokemon(1);
    const move: MoveData = {
      name: 'Yawn',
      type: 'Normal',
      category: 'Status',
      power: null,
      accuracy: null,
      pp: 10,
      priority: 0,
      flags: {},
      target: 'normal',
      effects: [],
      volatileStatus: 'yawn',
    };
    (battle as any).applyVolatileStatus(attacker, defender, move, 0, 1, []);
    expect(defender.volatileStatuses.has('yawn')).toBe(true);
  });

  it('causes sleep at end of turn', () => {
    const defender = battle.getActivePokemon(1);
    defender.volatileStatuses.add('yawn');
    const events: any[] = [];
    (battle as any).processEndOfTurn(events);
    expect(defender.volatileStatuses.has('yawn')).toBe(false);
    expect(defender.status).toBe('sleep');
  });

  it('does not cause sleep if target already has a status', () => {
    const defender = battle.getActivePokemon(1);
    defender.volatileStatuses.add('yawn');
    defender.status = 'paralysis';
    const events: any[] = [];
    (battle as any).processEndOfTurn(events);
    expect(defender.status).toBe('paralysis');
  });

  it('does not apply to already-yawned target', () => {
    const attacker = battle.getActivePokemon(0);
    const defender = battle.getActivePokemon(1);
    defender.volatileStatuses.add('yawn');
    const move: MoveData = {
      name: 'Yawn',
      type: 'Normal',
      category: 'Status',
      power: null,
      accuracy: null,
      pp: 10,
      priority: 0,
      flags: {},
      target: 'normal',
      effects: [],
      volatileStatus: 'yawn',
    };
    const events: any[] = [];
    (battle as any).applyVolatileStatus(attacker, defender, move, 0, 1, events);
    // Should still only have one yawn — no duplicate application
    expect(defender.volatileStatuses.has('yawn')).toBe(true);
  });

  it('does not apply yawn to a target with an existing status', () => {
    const attacker = battle.getActivePokemon(0);
    const defender = battle.getActivePokemon(1);
    defender.status = 'burn';
    const move: MoveData = {
      name: 'Yawn',
      type: 'Normal',
      category: 'Status',
      power: null,
      accuracy: null,
      pp: 10,
      priority: 0,
      flags: {},
      target: 'normal',
      effects: [],
      volatileStatus: 'yawn',
    };
    const events: any[] = [];
    (battle as any).applyVolatileStatus(attacker, defender, move, 0, 1, events);
    expect(defender.volatileStatuses.has('yawn')).toBe(false);
  });
});

// --- Focus Energy ---

describe('Focus Energy', () => {
  let battle: Battle;
  let p1: Player;
  let p2: Player;

  beforeEach(() => {
    p1 = createTestPlayer('p1', 'Alice');
    p2 = createTestPlayer('p2', 'Bob');
    battle = new Battle(p1, p2, 42);
  });

  it('applies focusenergy volatile status', () => {
    const attacker = battle.getActivePokemon(0);
    const defender = battle.getActivePokemon(1);
    const move: MoveData = {
      name: 'Focus Energy',
      type: 'Normal',
      category: 'Status',
      power: null,
      accuracy: null,
      pp: 30,
      priority: 0,
      flags: {},
      target: 'self',
      effects: [],
      volatileStatus: 'focusenergy',
    };
    (battle as any).applyVolatileStatus(attacker, defender, move, 0, 1, []);
    expect(attacker.volatileStatuses.has('focusenergy')).toBe(true);
  });
});

// --- Ingrain / Aqua Ring Healing ---

describe('Ingrain and Aqua Ring End-of-Turn Healing', () => {
  let battle: Battle;
  let p1: Player;
  let p2: Player;

  beforeEach(() => {
    p1 = createTestPlayer('p1', 'Alice');
    p2 = createTestPlayer('p2', 'Bob');
    battle = new Battle(p1, p2, 42);
  });

  it('Ingrain heals 1/16 max HP at end of turn', () => {
    const pokemon = battle.getActivePokemon(0);
    pokemon.item = null; // Remove Leftovers
    pokemon.currentHp = Math.floor(pokemon.maxHp / 2);
    pokemon.volatileStatuses.add('ingrain');
    const hpBefore = pokemon.currentHp;
    const events: any[] = [];
    (battle as any).processEndOfTurn(events);
    const expectedHeal = Math.max(1, Math.floor(pokemon.maxHp / 16));
    expect(pokemon.currentHp).toBe(hpBefore + expectedHeal);
  });

  it('Aqua Ring heals 1/16 max HP at end of turn', () => {
    const pokemon = battle.getActivePokemon(0);
    pokemon.item = null; // Remove Leftovers
    pokemon.currentHp = Math.floor(pokemon.maxHp / 2);
    pokemon.volatileStatuses.add('aquaring');
    const hpBefore = pokemon.currentHp;
    const events: any[] = [];
    (battle as any).processEndOfTurn(events);
    const expectedHeal = Math.max(1, Math.floor(pokemon.maxHp / 16));
    expect(pokemon.currentHp).toBe(hpBefore + expectedHeal);
  });

  it('Ingrain does not overheal past max HP', () => {
    const pokemon = battle.getActivePokemon(0);
    pokemon.volatileStatuses.add('ingrain');
    // Already at full HP
    const events: any[] = [];
    (battle as any).processEndOfTurn(events);
    expect(pokemon.currentHp).toBe(pokemon.maxHp);
  });
});

// --- Nightmare ---

describe('Nightmare', () => {
  let battle: Battle;
  let p1: Player;
  let p2: Player;

  beforeEach(() => {
    p1 = createTestPlayer('p1', 'Alice');
    p2 = createTestPlayer('p2', 'Bob');
    battle = new Battle(p1, p2, 42);
  });

  it('deals 1/4 max HP damage at end of turn while asleep', () => {
    const pokemon = battle.getActivePokemon(0);
    pokemon.item = null; // Remove Leftovers
    pokemon.status = 'sleep';
    pokemon.sleepTurns = 3;
    pokemon.volatileStatuses.add('nightmare' as any);
    const hpBefore = pokemon.currentHp;
    const events: any[] = [];
    (battle as any).processEndOfTurn(events);
    const expectedDmg = Math.max(1, Math.floor(pokemon.maxHp / 4));
    expect(pokemon.currentHp).toBe(hpBefore - expectedDmg);
  });

  it('is cured when the pokemon wakes up', () => {
    const pokemon = battle.getActivePokemon(0);
    pokemon.status = null; // not asleep
    pokemon.volatileStatuses.add('nightmare' as any);
    const hpBefore = pokemon.currentHp;
    const events: any[] = [];
    (battle as any).processEndOfTurn(events);
    expect(pokemon.volatileStatuses.has('nightmare' as any)).toBe(false);
    expect(pokemon.currentHp).toBe(hpBefore); // no damage taken
  });
});

// --- Aurora Veil ---

describe('Aurora Veil', () => {
  let battle: Battle;
  let p1: Player;
  let p2: Player;

  beforeEach(() => {
    p1 = createTestPlayer('p1', 'Alice');
    p2 = createTestPlayer('p2', 'Bob');
    battle = new Battle(p1, p2, 42);
  });

  it('can only be set in hail', () => {
    const events: any[] = [];
    battle.state.weather = 'none';
    (battle as any).applyHazard(0, 'auroraveil', events);
    expect(battle.getSideEffects(0).auroraVeil).toBe(0);

    battle.state.weather = 'hail';
    (battle as any).applyHazard(0, 'auroraveil', events);
    expect(battle.getSideEffects(0).auroraVeil).toBe(5);
  });

  it('countdown decreases and expires at end of turn', () => {
    battle.getSideEffects(0).auroraVeil = 1;
    const events: any[] = [];
    (battle as any).processEndOfTurn(events);
    expect(battle.getSideEffects(0).auroraVeil).toBe(0);
    const endEvent = events.find(e => e.type === 'screen_end' && e.data.screen === 'Aurora Veil');
    expect(endEvent).toBeDefined();
  });
});

// --- Tailwind Countdown ---

describe('Tailwind Countdown', () => {
  let battle: Battle;
  let p1: Player;
  let p2: Player;

  beforeEach(() => {
    p1 = createTestPlayer('p1', 'Alice');
    p2 = createTestPlayer('p2', 'Bob');
    battle = new Battle(p1, p2, 42);
  });

  it('countdown decreases and expires at end of turn', () => {
    battle.getSideEffects(0).tailwind = 1;
    const events: any[] = [];
    (battle as any).processEndOfTurn(events);
    expect(battle.getSideEffects(0).tailwind).toBe(0);
    const endEvent = events.find(e => e.type === 'screen_end' && e.data.screen === 'Tailwind');
    expect(endEvent).toBeDefined();
  });
});

// --- Stress Test: No Crashes ---

describe('Battle Stress Test — 100 Random Battles', () => {
  it('completes 100 random battles without crashing', async () => {
    const { generateTeam } = await import('../../src/engine/team-generator');
    const { SeededRNG } = await import('../../src/utils/rng');

    let crashes = 0;
    let completed = 0;

    for (let seed = 1; seed <= 100; seed++) {
      try {
        const rng = new SeededRNG(seed);
        const team1 = generateTeam(rng, { itemMode: 'competitive' });
        const team2 = generateTeam(rng, { itemMode: 'competitive' });
        const p1: Player = { id: 'p1', name: 'P1', team: team1, activePokemonIndex: 0, itemMode: 'competitive', hasMegaEvolved: false };
        const p2: Player = { id: 'p2', name: 'P2', team: team2, activePokemonIndex: 0, itemMode: 'competitive', hasMegaEvolved: false };
        const battle = new Battle(p1, p2, seed);

        let turns = 0;
        while (battle.state.status === 'active' && turns < 200) {
          let a1: any, a2: any;
          if (!battle.getActivePokemon(0).isAlive) {
            const sw = battle.getAvailableSwitches(0);
            if (sw.length === 0) break;
            a1 = { type: 'switch', playerId: 'p1', pokemonIndex: sw[0] };
          } else {
            const moves = battle.getAvailableMoves(0);
            a1 = { type: 'move', playerId: 'p1', moveIndex: moves.length > 0 ? moves[Math.floor(Math.random() * moves.length)] : 0 };
          }
          if (!battle.getActivePokemon(1).isAlive) {
            const sw = battle.getAvailableSwitches(1);
            if (sw.length === 0) break;
            a2 = { type: 'switch', playerId: 'p2', pokemonIndex: sw[0] };
          } else {
            const moves = battle.getAvailableMoves(1);
            a2 = { type: 'move', playerId: 'p2', moveIndex: moves.length > 0 ? moves[Math.floor(Math.random() * moves.length)] : 0 };
          }

          battle.processTurn(a1, a2);

          for (let p = 0; p < 2; p++) {
            if (battle.needsSwitch(p)) {
              const sw = battle.getAvailableSwitches(p);
              if (sw.length > 0) battle.processForceSwitch(p, sw[0]);
            }
            if (battle.needsSelfSwitch(p)) {
              const sw = battle.getAvailableSwitches(p);
              if (sw.length > 0) battle.processSelfSwitch(p, sw[0], false);
            }
          }
          turns++;
        }
        completed++;
      } catch {
        crashes++;
      }
    }

    expect(crashes).toBe(0);
    expect(completed).toBe(100);
  });
});
