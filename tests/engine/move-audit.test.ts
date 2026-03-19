import { describe, it, expect, beforeEach } from 'vitest';
import { Battle } from '../../src/engine/battle';
import { createBattlePokemon } from '../../src/engine/pokemon-factory';
import { Player, PokemonSpecies, PokemonSet, BattlePokemon, PokemonType, Nature, MoveData } from '../../src/types';
import { SeededRNG } from '../../src/utils/rng';

function createTestSpecies(overrides: Partial<PokemonSpecies> = {}): PokemonSpecies {
  return {
    id: 'testmon', name: 'Testmon', dexNum: 1,
    types: ['Normal'] as [PokemonType],
    baseStats: { hp: 100, atk: 100, def: 100, spa: 100, spd: 100, spe: 100 },
    abilities: ['Overgrow'], bestAbility: 'Overgrow', tier: 3, generation: 1, movePool: [], sets: [],
    ...overrides,
  } as PokemonSpecies;
}

function createTestSet(overrides: Partial<PokemonSet> = {}): PokemonSet {
  return {
    moves: ['Tackle', 'Thunderbolt', 'Ice Beam', 'Earthquake'],
    ability: 'Overgrow', item: 'Leftovers', nature: 'Hardy' as Nature,
    evs: { hp: 252, atk: 252, spe: 4 },
    ...overrides,
  };
}

function createTestPlayer(id: string, name: string, teamOverrides: Array<{ species?: Partial<PokemonSpecies>; set?: Partial<PokemonSet> }> = []): Player {
  const team: BattlePokemon[] = [];
  for (let i = 0; i < 6; i++) {
    const overrides = teamOverrides[i] || {};
    const species = createTestSpecies({ id: `mon${i}`, name: `Mon${i}`, ...overrides.species });
    const set = createTestSet(overrides.set);
    team.push(createBattlePokemon(species, set));
  }
  return { id, name, team, activePokemonIndex: 0, itemMode: 'competitive', hasMegaEvolved: false };
}

function makeMoveData(overrides: Partial<MoveData> = {}): MoveData {
  return {
    name: 'Test Move', type: 'Normal' as PokemonType, category: 'Physical',
    power: 80, accuracy: 100, pp: 10, priority: 0, target: 'normal',
    flags: { contact: false, sound: false, bullet: false, punch: false, bite: false, pulse: false, protect: true, mirror: true, defrost: false, charge: false },
    effects: [], description: '', critRatio: 0, willCrit: false, forceSwitch: false, selfSwitch: false,
    status: null, volatileStatus: null, weather: null, sideCondition: null, boosts: null, selfBoosts: null,
    ...overrides,
  } as MoveData;
}

function makeStatBoostMove(name: string, effects: Array<{ stat: string; stages: number }>): MoveData {
  return makeMoveData({
    name,
    category: 'Status',
    power: null as any,
    accuracy: null as any,
    target: 'self',
    effects: effects.map(e => ({
      type: 'boost' as const,
      stat: e.stat as any,
      stages: e.stages,
      chance: 100,
      target: 'self' as const,
    })),
  });
}

function assignMove(pokemon: BattlePokemon, index: number, moveData: MoveData): void {
  pokemon.moves[index] = {
    data: moveData,
    currentPp: moveData.pp,
    maxPp: moveData.pp,
    disabled: false,
  };
}

function makeSplash(): MoveData {
  return makeMoveData({
    name: 'Splash', category: 'Status', power: null as any, accuracy: null as any,
    target: 'self', effects: [],
  });
}

// ========================
// 1. STAT BOOST MOVES
// ========================

describe('Stat boost moves', () => {
  let battle: Battle;

  beforeEach(() => {
    const p1 = createTestPlayer('p1', 'Alice');
    const p2 = createTestPlayer('p2', 'Bob');
    battle = new Battle(p1, p2, 42);
  });

  it('Swords Dance: +2 Atk', () => {
    const attacker = battle.getActivePokemon(0);
    assignMove(attacker, 0, makeStatBoostMove('Swords Dance', [{ stat: 'atk', stages: 2 }]));
    const defender = battle.getActivePokemon(1);
    assignMove(defender, 0, makeSplash());

    battle.processTurn({ type: 'move', moveIndex: 0 }, { type: 'move', moveIndex: 0 });

    expect(attacker.boosts.atk).toBe(2);
  });

  it('Dragon Dance: +1 Atk, +1 Spe', () => {
    const attacker = battle.getActivePokemon(0);
    assignMove(attacker, 0, makeStatBoostMove('Dragon Dance', [
      { stat: 'atk', stages: 1 },
      { stat: 'spe', stages: 1 },
    ]));
    const defender = battle.getActivePokemon(1);
    assignMove(defender, 0, makeSplash());

    battle.processTurn({ type: 'move', moveIndex: 0 }, { type: 'move', moveIndex: 0 });

    expect(attacker.boosts.atk).toBe(1);
    expect(attacker.boosts.spe).toBe(1);
  });

  it('Nasty Plot: +2 SpA', () => {
    const attacker = battle.getActivePokemon(0);
    assignMove(attacker, 0, makeStatBoostMove('Nasty Plot', [{ stat: 'spa', stages: 2 }]));
    const defender = battle.getActivePokemon(1);
    assignMove(defender, 0, makeSplash());

    battle.processTurn({ type: 'move', moveIndex: 0 }, { type: 'move', moveIndex: 0 });

    expect(attacker.boosts.spa).toBe(2);
  });

  it('Shell Smash: +2 Atk, +2 SpA, +2 Spe, -1 Def, -1 SpD', () => {
    const attacker = battle.getActivePokemon(0);
    assignMove(attacker, 0, makeStatBoostMove('Shell Smash', [
      { stat: 'atk', stages: 2 },
      { stat: 'spa', stages: 2 },
      { stat: 'spe', stages: 2 },
      { stat: 'def', stages: -1 },
      { stat: 'spd', stages: -1 },
    ]));
    const defender = battle.getActivePokemon(1);
    assignMove(defender, 0, makeSplash());

    battle.processTurn({ type: 'move', moveIndex: 0 }, { type: 'move', moveIndex: 0 });

    expect(attacker.boosts.atk).toBe(2);
    expect(attacker.boosts.spa).toBe(2);
    expect(attacker.boosts.spe).toBe(2);
    expect(attacker.boosts.def).toBe(-1);
    expect(attacker.boosts.spd).toBe(-1);
  });

  it('Quiver Dance: +1 SpA, +1 SpD, +1 Spe', () => {
    const attacker = battle.getActivePokemon(0);
    assignMove(attacker, 0, makeStatBoostMove('Quiver Dance', [
      { stat: 'spa', stages: 1 },
      { stat: 'spd', stages: 1 },
      { stat: 'spe', stages: 1 },
    ]));
    const defender = battle.getActivePokemon(1);
    assignMove(defender, 0, makeSplash());

    battle.processTurn({ type: 'move', moveIndex: 0 }, { type: 'move', moveIndex: 0 });

    expect(attacker.boosts.spa).toBe(1);
    expect(attacker.boosts.spd).toBe(1);
    expect(attacker.boosts.spe).toBe(1);
  });

  it('Iron Defense: +2 Def', () => {
    const attacker = battle.getActivePokemon(0);
    assignMove(attacker, 0, makeStatBoostMove('Iron Defense', [{ stat: 'def', stages: 2 }]));
    const defender = battle.getActivePokemon(1);
    assignMove(defender, 0, makeSplash());

    battle.processTurn({ type: 'move', moveIndex: 0 }, { type: 'move', moveIndex: 0 });

    expect(attacker.boosts.def).toBe(2);
  });

  it('Amnesia: +2 SpD', () => {
    const attacker = battle.getActivePokemon(0);
    assignMove(attacker, 0, makeStatBoostMove('Amnesia', [{ stat: 'spd', stages: 2 }]));
    const defender = battle.getActivePokemon(1);
    assignMove(defender, 0, makeSplash());

    battle.processTurn({ type: 'move', moveIndex: 0 }, { type: 'move', moveIndex: 0 });

    expect(attacker.boosts.spd).toBe(2);
  });

  it('Agility: +2 Spe', () => {
    const attacker = battle.getActivePokemon(0);
    assignMove(attacker, 0, makeStatBoostMove('Agility', [{ stat: 'spe', stages: 2 }]));
    const defender = battle.getActivePokemon(1);
    assignMove(defender, 0, makeSplash());

    battle.processTurn({ type: 'move', moveIndex: 0 }, { type: 'move', moveIndex: 0 });

    expect(attacker.boosts.spe).toBe(2);
  });

  it('Bulk Up: +1 Atk, +1 Def', () => {
    const attacker = battle.getActivePokemon(0);
    assignMove(attacker, 0, makeStatBoostMove('Bulk Up', [
      { stat: 'atk', stages: 1 },
      { stat: 'def', stages: 1 },
    ]));
    const defender = battle.getActivePokemon(1);
    assignMove(defender, 0, makeSplash());

    battle.processTurn({ type: 'move', moveIndex: 0 }, { type: 'move', moveIndex: 0 });

    expect(attacker.boosts.atk).toBe(1);
    expect(attacker.boosts.def).toBe(1);
  });

  it('Hone Claws: +1 Atk, +1 Accuracy', () => {
    const attacker = battle.getActivePokemon(0);
    assignMove(attacker, 0, makeStatBoostMove('Hone Claws', [
      { stat: 'atk', stages: 1 },
      { stat: 'accuracy', stages: 1 },
    ]));
    const defender = battle.getActivePokemon(1);
    assignMove(defender, 0, makeSplash());

    battle.processTurn({ type: 'move', moveIndex: 0 }, { type: 'move', moveIndex: 0 });

    expect(attacker.boosts.atk).toBe(1);
    expect(attacker.boosts.accuracy).toBe(1);
  });

  it('Cotton Guard: +3 Def', () => {
    const attacker = battle.getActivePokemon(0);
    assignMove(attacker, 0, makeStatBoostMove('Cotton Guard', [{ stat: 'def', stages: 3 }]));
    const defender = battle.getActivePokemon(1);
    assignMove(defender, 0, makeSplash());

    battle.processTurn({ type: 'move', moveIndex: 0 }, { type: 'move', moveIndex: 0 });

    expect(attacker.boosts.def).toBe(3);
  });

  it('Cosmic Power: +1 Def, +1 SpD', () => {
    const attacker = battle.getActivePokemon(0);
    assignMove(attacker, 0, makeStatBoostMove('Cosmic Power', [
      { stat: 'def', stages: 1 },
      { stat: 'spd', stages: 1 },
    ]));
    const defender = battle.getActivePokemon(1);
    assignMove(defender, 0, makeSplash());

    battle.processTurn({ type: 'move', moveIndex: 0 }, { type: 'move', moveIndex: 0 });

    expect(attacker.boosts.def).toBe(1);
    expect(attacker.boosts.spd).toBe(1);
  });

  it('Geomancy: +2 SpA, +2 SpD, +2 Spe', () => {
    const attacker = battle.getActivePokemon(0);
    assignMove(attacker, 0, makeStatBoostMove('Geomancy', [
      { stat: 'spa', stages: 2 },
      { stat: 'spd', stages: 2 },
      { stat: 'spe', stages: 2 },
    ]));
    const defender = battle.getActivePokemon(1);
    assignMove(defender, 0, makeSplash());

    battle.processTurn({ type: 'move', moveIndex: 0 }, { type: 'move', moveIndex: 0 });

    expect(attacker.boosts.spa).toBe(2);
    expect(attacker.boosts.spd).toBe(2);
    expect(attacker.boosts.spe).toBe(2);
  });

  it('Swords Dance +2 Atk results in ~2x damage on a physical move', () => {
    const attacker = battle.getActivePokemon(0);
    const defender = battle.getActivePokemon(1);
    attacker.item = null;
    defender.item = null;

    // Set up a physical attack on move slot 1
    const physicalMove = makeMoveData({ name: 'Tackle', type: 'Normal', category: 'Physical', power: 80 });
    assignMove(attacker, 1, physicalMove);
    assignMove(defender, 0, makeSplash());

    // Measure unboosted damage
    const hp1 = defender.currentHp;
    battle.processTurn({ type: 'move', moveIndex: 1 }, { type: 'move', moveIndex: 0 });
    const unboostedDmg = hp1 - defender.currentHp;

    // Reset defender HP
    defender.currentHp = defender.maxHp;

    // Apply +2 Atk (equivalent to Swords Dance)
    attacker.boosts.atk = 2;

    const hp2 = defender.currentHp;
    battle.processTurn({ type: 'move', moveIndex: 1 }, { type: 'move', moveIndex: 0 });
    const boostedDmg = hp2 - defender.currentHp;

    // +2 Atk = 2x multiplier; allow 1.8x to 2.2x for RNG variance
    expect(unboostedDmg).toBeGreaterThan(0);
    expect(boostedDmg).toBeGreaterThan(0);
    const ratio = boostedDmg / unboostedDmg;
    expect(ratio).toBeGreaterThanOrEqual(1.8);
    expect(ratio).toBeLessThanOrEqual(2.2);
  });
});

// ========================
// 2. SELF-DROPPING ATTACKING MOVES
// ========================

describe('Self-dropping attacking moves', () => {
  let battle: Battle;

  beforeEach(() => {
    const p1 = createTestPlayer('p1', 'Alice');
    const p2 = createTestPlayer('p2', 'Bob');
    battle = new Battle(p1, p2, 42);
  });

  it('Superpower: power 120, -1 Atk self, -1 Def self after dealing damage', () => {
    const attacker = battle.getActivePokemon(0);
    const defender = battle.getActivePokemon(1);
    attacker.item = null;
    defender.item = null;

    assignMove(attacker, 0, makeMoveData({
      name: 'Superpower', type: 'Fighting' as PokemonType, category: 'Physical', power: 120,
      effects: [
        { type: 'boost', stat: 'atk', stages: -1, chance: 100, target: 'self' },
        { type: 'boost', stat: 'def', stages: -1, chance: 100, target: 'self' },
      ],
    }));
    assignMove(defender, 0, makeSplash());

    const defHpBefore = defender.currentHp;
    battle.processTurn({ type: 'move', moveIndex: 0 }, { type: 'move', moveIndex: 0 });

    expect(defHpBefore - defender.currentHp).toBeGreaterThan(0); // Dealt damage
    expect(attacker.boosts.atk).toBe(-1);
    expect(attacker.boosts.def).toBe(-1);
  });

  it('Close Combat: power 120, -1 Def self, -1 SpD self', () => {
    const attacker = battle.getActivePokemon(0);
    const defender = battle.getActivePokemon(1);
    attacker.item = null;
    defender.item = null;

    assignMove(attacker, 0, makeMoveData({
      name: 'Close Combat', type: 'Fighting' as PokemonType, category: 'Physical', power: 120,
      effects: [
        { type: 'boost', stat: 'def', stages: -1, chance: 100, target: 'self' },
        { type: 'boost', stat: 'spd', stages: -1, chance: 100, target: 'self' },
      ],
    }));
    assignMove(defender, 0, makeSplash());

    const defHpBefore = defender.currentHp;
    battle.processTurn({ type: 'move', moveIndex: 0 }, { type: 'move', moveIndex: 0 });

    expect(defHpBefore - defender.currentHp).toBeGreaterThan(0);
    expect(attacker.boosts.def).toBe(-1);
    expect(attacker.boosts.spd).toBe(-1);
  });

  it('Draco Meteor: power 130 Special, -2 SpA self', () => {
    const attacker = battle.getActivePokemon(0);
    const defender = battle.getActivePokemon(1);
    attacker.item = null;
    defender.item = null;

    assignMove(attacker, 0, makeMoveData({
      name: 'Draco Meteor', type: 'Dragon' as PokemonType, category: 'Special', power: 130,
      effects: [
        { type: 'boost', stat: 'spa', stages: -2, chance: 100, target: 'self' },
      ],
    }));
    assignMove(defender, 0, makeSplash());

    const defHpBefore = defender.currentHp;
    battle.processTurn({ type: 'move', moveIndex: 0 }, { type: 'move', moveIndex: 0 });

    expect(defHpBefore - defender.currentHp).toBeGreaterThan(0);
    expect(attacker.boosts.spa).toBe(-2);
  });

  it('Overheat: power 130 Special, -2 SpA self', () => {
    const attacker = battle.getActivePokemon(0);
    const defender = battle.getActivePokemon(1);
    attacker.item = null;
    defender.item = null;

    assignMove(attacker, 0, makeMoveData({
      name: 'Overheat', type: 'Fire' as PokemonType, category: 'Special', power: 130,
      effects: [
        { type: 'boost', stat: 'spa', stages: -2, chance: 100, target: 'self' },
      ],
    }));
    assignMove(defender, 0, makeSplash());

    const defHpBefore = defender.currentHp;
    battle.processTurn({ type: 'move', moveIndex: 0 }, { type: 'move', moveIndex: 0 });

    expect(defHpBefore - defender.currentHp).toBeGreaterThan(0);
    expect(attacker.boosts.spa).toBe(-2);
  });

  it('Leaf Storm: power 130 Special, -2 SpA self', () => {
    const attacker = battle.getActivePokemon(0);
    const defender = battle.getActivePokemon(1);
    attacker.item = null;
    defender.item = null;

    assignMove(attacker, 0, makeMoveData({
      name: 'Leaf Storm', type: 'Grass' as PokemonType, category: 'Special', power: 130,
      effects: [
        { type: 'boost', stat: 'spa', stages: -2, chance: 100, target: 'self' },
      ],
    }));
    assignMove(defender, 0, makeSplash());

    const defHpBefore = defender.currentHp;
    battle.processTurn({ type: 'move', moveIndex: 0 }, { type: 'move', moveIndex: 0 });

    expect(defHpBefore - defender.currentHp).toBeGreaterThan(0);
    expect(attacker.boosts.spa).toBe(-2);
  });
});

// ========================
// 3. PRIORITY MOVES
// ========================

describe('Priority moves', () => {
  it('Quick Attack (priority 1): slower mon moves first', () => {
    // p1 has higher speed, p2 has lower speed but priority move
    const p1 = createTestPlayer('p1', 'Alice', [
      { species: { baseStats: { hp: 100, atk: 100, def: 100, spa: 100, spd: 100, spe: 150 } } },
    ]);
    const p2 = createTestPlayer('p2', 'Bob', [
      { species: { baseStats: { hp: 100, atk: 100, def: 100, spa: 100, spd: 100, spe: 50 } } },
    ]);
    const battle = new Battle(p1, p2, 42);

    const fast = battle.getActivePokemon(0);
    const slow = battle.getActivePokemon(1);
    fast.item = null;
    slow.item = null;

    // Fast mon uses priority 0 move
    assignMove(fast, 0, makeMoveData({ name: 'Tackle', power: 40, priority: 0 }));
    // Slow mon uses Quick Attack (priority 1)
    assignMove(slow, 0, makeMoveData({ name: 'Quick Attack', power: 40, priority: 1 }));

    const events = battle.processTurn(
      { type: 'move', moveIndex: 0 },
      { type: 'move', moveIndex: 0 }
    );

    // The first move event should be Quick Attack (from the slower mon)
    const moveEvents = events.filter(e => e.type === 'use_move');
    expect(moveEvents.length).toBeGreaterThanOrEqual(2);
    expect(moveEvents[0].data.move).toBe('Quick Attack');
  });

  it('Extreme Speed (priority 2): slower mon moves first', () => {
    const p1 = createTestPlayer('p1', 'Alice', [
      { species: { baseStats: { hp: 100, atk: 100, def: 100, spa: 100, spd: 100, spe: 150 } } },
    ]);
    const p2 = createTestPlayer('p2', 'Bob', [
      { species: { baseStats: { hp: 100, atk: 100, def: 100, spa: 100, spd: 100, spe: 50 } } },
    ]);
    const battle = new Battle(p1, p2, 42);

    const fast = battle.getActivePokemon(0);
    const slow = battle.getActivePokemon(1);
    fast.item = null;
    slow.item = null;

    assignMove(fast, 0, makeMoveData({ name: 'Tackle', power: 40, priority: 0 }));
    assignMove(slow, 0, makeMoveData({ name: 'Extreme Speed', power: 80, priority: 2 }));

    const events = battle.processTurn(
      { type: 'move', moveIndex: 0 },
      { type: 'move', moveIndex: 0 }
    );

    const moveEvents = events.filter(e => e.type === 'use_move');
    expect(moveEvents.length).toBeGreaterThanOrEqual(2);
    expect(moveEvents[0].data.move).toBe('Extreme Speed');
  });

  it('Bullet Punch (priority 1): slower mon moves first', () => {
    const p1 = createTestPlayer('p1', 'Alice', [
      { species: { baseStats: { hp: 100, atk: 100, def: 100, spa: 100, spd: 100, spe: 150 } } },
    ]);
    const p2 = createTestPlayer('p2', 'Bob', [
      { species: { baseStats: { hp: 100, atk: 100, def: 100, spa: 100, spd: 100, spe: 50 } } },
    ]);
    const battle = new Battle(p1, p2, 42);

    const fast = battle.getActivePokemon(0);
    const slow = battle.getActivePokemon(1);
    fast.item = null;
    slow.item = null;

    assignMove(fast, 0, makeMoveData({ name: 'Tackle', power: 40, priority: 0 }));
    assignMove(slow, 0, makeMoveData({ name: 'Bullet Punch', type: 'Steel' as PokemonType, power: 40, priority: 1 }));

    const events = battle.processTurn(
      { type: 'move', moveIndex: 0 },
      { type: 'move', moveIndex: 0 }
    );

    const moveEvents = events.filter(e => e.type === 'use_move');
    expect(moveEvents.length).toBeGreaterThanOrEqual(2);
    expect(moveEvents[0].data.move).toBe('Bullet Punch');
  });

  it('Aqua Jet (priority 1): slower mon moves first', () => {
    const p1 = createTestPlayer('p1', 'Alice', [
      { species: { baseStats: { hp: 100, atk: 100, def: 100, spa: 100, spd: 100, spe: 150 } } },
    ]);
    const p2 = createTestPlayer('p2', 'Bob', [
      { species: { baseStats: { hp: 100, atk: 100, def: 100, spa: 100, spd: 100, spe: 50 } } },
    ]);
    const battle = new Battle(p1, p2, 42);

    const fast = battle.getActivePokemon(0);
    const slow = battle.getActivePokemon(1);
    fast.item = null;
    slow.item = null;

    assignMove(fast, 0, makeMoveData({ name: 'Tackle', power: 40, priority: 0 }));
    assignMove(slow, 0, makeMoveData({ name: 'Aqua Jet', type: 'Water' as PokemonType, power: 40, priority: 1 }));

    const events = battle.processTurn(
      { type: 'move', moveIndex: 0 },
      { type: 'move', moveIndex: 0 }
    );

    const moveEvents = events.filter(e => e.type === 'use_move');
    expect(moveEvents.length).toBeGreaterThanOrEqual(2);
    expect(moveEvents[0].data.move).toBe('Aqua Jet');
  });
});

// ========================
// 4. RECOIL MOVES
// ========================

describe('Recoil moves', () => {
  let battle: Battle;

  beforeEach(() => {
    const p1 = createTestPlayer('p1', 'Alice');
    const p2 = createTestPlayer('p2', 'Bob');
    battle = new Battle(p1, p2, 42);
  });

  it('Brave Bird: 1/3 recoil', () => {
    const attacker = battle.getActivePokemon(0);
    const defender = battle.getActivePokemon(1);
    attacker.item = null;
    defender.item = null;

    assignMove(attacker, 0, makeMoveData({
      name: 'Brave Bird', type: 'Flying' as PokemonType, category: 'Physical', power: 120,
      flags: { contact: true, sound: false, bullet: false, punch: false, bite: false, pulse: false, protect: true, mirror: true, defrost: false, charge: false, recoil: 1 / 3 },
    }));
    assignMove(defender, 0, makeSplash());

    const attackerHpBefore = attacker.currentHp;
    const defenderHpBefore = defender.currentHp;
    battle.processTurn({ type: 'move', moveIndex: 0 }, { type: 'move', moveIndex: 0 });

    const damageDealt = defenderHpBefore - defender.currentHp;
    const recoilTaken = attackerHpBefore - attacker.currentHp;
    const expectedRecoil = Math.max(1, Math.floor(damageDealt / 3));

    expect(damageDealt).toBeGreaterThan(0);
    expect(recoilTaken).toBeGreaterThanOrEqual(expectedRecoil - 1);
    expect(recoilTaken).toBeLessThanOrEqual(expectedRecoil + 1);
  });

  it('Flare Blitz: 1/3 recoil', () => {
    const attacker = battle.getActivePokemon(0);
    const defender = battle.getActivePokemon(1);
    attacker.item = null;
    defender.item = null;

    assignMove(attacker, 0, makeMoveData({
      name: 'Flare Blitz', type: 'Fire' as PokemonType, category: 'Physical', power: 120,
      flags: { contact: true, sound: false, bullet: false, punch: false, bite: false, pulse: false, protect: true, mirror: true, defrost: true, charge: false, recoil: 1 / 3 },
    }));
    assignMove(defender, 0, makeSplash());

    const attackerHpBefore = attacker.currentHp;
    const defenderHpBefore = defender.currentHp;
    battle.processTurn({ type: 'move', moveIndex: 0 }, { type: 'move', moveIndex: 0 });

    const damageDealt = defenderHpBefore - defender.currentHp;
    const recoilTaken = attackerHpBefore - attacker.currentHp;
    const expectedRecoil = Math.max(1, Math.floor(damageDealt / 3));

    expect(damageDealt).toBeGreaterThan(0);
    expect(recoilTaken).toBeGreaterThanOrEqual(expectedRecoil - 1);
    expect(recoilTaken).toBeLessThanOrEqual(expectedRecoil + 1);
  });

  it('Wild Charge: 1/4 recoil', () => {
    const attacker = battle.getActivePokemon(0);
    const defender = battle.getActivePokemon(1);
    attacker.item = null;
    defender.item = null;

    assignMove(attacker, 0, makeMoveData({
      name: 'Wild Charge', type: 'Electric' as PokemonType, category: 'Physical', power: 90,
      flags: { contact: true, sound: false, bullet: false, punch: false, bite: false, pulse: false, protect: true, mirror: true, defrost: false, charge: false, recoil: 1 / 4 },
    }));
    assignMove(defender, 0, makeSplash());

    const attackerHpBefore = attacker.currentHp;
    const defenderHpBefore = defender.currentHp;
    battle.processTurn({ type: 'move', moveIndex: 0 }, { type: 'move', moveIndex: 0 });

    const damageDealt = defenderHpBefore - defender.currentHp;
    const recoilTaken = attackerHpBefore - attacker.currentHp;
    const expectedRecoil = Math.max(1, Math.floor(damageDealt / 4));

    expect(damageDealt).toBeGreaterThan(0);
    expect(recoilTaken).toBeGreaterThanOrEqual(expectedRecoil - 1);
    expect(recoilTaken).toBeLessThanOrEqual(expectedRecoil + 1);
  });

  it('Double-Edge: 1/3 recoil', () => {
    const attacker = battle.getActivePokemon(0);
    const defender = battle.getActivePokemon(1);
    attacker.item = null;
    defender.item = null;

    assignMove(attacker, 0, makeMoveData({
      name: 'Double-Edge', type: 'Normal' as PokemonType, category: 'Physical', power: 120,
      flags: { contact: true, sound: false, bullet: false, punch: false, bite: false, pulse: false, protect: true, mirror: true, defrost: false, charge: false, recoil: 1 / 3 },
    }));
    assignMove(defender, 0, makeSplash());

    const attackerHpBefore = attacker.currentHp;
    const defenderHpBefore = defender.currentHp;
    battle.processTurn({ type: 'move', moveIndex: 0 }, { type: 'move', moveIndex: 0 });

    const damageDealt = defenderHpBefore - defender.currentHp;
    const recoilTaken = attackerHpBefore - attacker.currentHp;
    const expectedRecoil = Math.max(1, Math.floor(damageDealt / 3));

    expect(damageDealt).toBeGreaterThan(0);
    expect(recoilTaken).toBeGreaterThanOrEqual(expectedRecoil - 1);
    expect(recoilTaken).toBeLessThanOrEqual(expectedRecoil + 1);
  });

  it('Head Smash: 1/2 recoil', () => {
    const attacker = battle.getActivePokemon(0);
    const defender = battle.getActivePokemon(1);
    attacker.item = null;
    defender.item = null;

    assignMove(attacker, 0, makeMoveData({
      name: 'Head Smash', type: 'Rock' as PokemonType, category: 'Physical', power: 150,
      flags: { contact: true, sound: false, bullet: false, punch: false, bite: false, pulse: false, protect: true, mirror: true, defrost: false, charge: false, recoil: 1 / 2 },
    }));
    assignMove(defender, 0, makeSplash());

    const attackerHpBefore = attacker.currentHp;
    const defenderHpBefore = defender.currentHp;
    battle.processTurn({ type: 'move', moveIndex: 0 }, { type: 'move', moveIndex: 0 });

    const damageDealt = defenderHpBefore - defender.currentHp;
    const recoilTaken = attackerHpBefore - attacker.currentHp;
    const expectedRecoil = Math.max(1, Math.floor(damageDealt / 2));

    expect(damageDealt).toBeGreaterThan(0);
    expect(recoilTaken).toBeGreaterThanOrEqual(expectedRecoil - 1);
    expect(recoilTaken).toBeLessThanOrEqual(expectedRecoil + 1);
  });
});

// ========================
// 5. DRAIN MOVES
// ========================

describe('Drain moves', () => {
  let battle: Battle;

  beforeEach(() => {
    const p1 = createTestPlayer('p1', 'Alice');
    const p2 = createTestPlayer('p2', 'Bob');
    battle = new Battle(p1, p2, 42);
  });

  it('Drain Punch: 50% drain', () => {
    const attacker = battle.getActivePokemon(0);
    const defender = battle.getActivePokemon(1);
    attacker.item = null;
    defender.item = null;

    assignMove(attacker, 0, makeMoveData({
      name: 'Drain Punch', type: 'Fighting' as PokemonType, category: 'Physical', power: 75,
      flags: { contact: true, sound: false, bullet: false, punch: true, bite: false, pulse: false, protect: true, mirror: true, defrost: false, charge: false, drain: 0.5 },
    }));
    assignMove(defender, 0, makeSplash());

    // Damage attacker first so healing is visible
    attacker.currentHp = Math.floor(attacker.maxHp / 2);
    const attackerHpBefore = attacker.currentHp;
    const defenderHpBefore = defender.currentHp;

    battle.processTurn({ type: 'move', moveIndex: 0 }, { type: 'move', moveIndex: 0 });

    const damageDealt = defenderHpBefore - defender.currentHp;
    const hpGained = attacker.currentHp - attackerHpBefore;
    const expectedDrain = Math.max(1, Math.floor(damageDealt * 0.5));

    expect(damageDealt).toBeGreaterThan(0);
    expect(hpGained).toBeGreaterThanOrEqual(expectedDrain - 1);
    expect(hpGained).toBeLessThanOrEqual(expectedDrain + 1);
  });

  it('Giga Drain: 50% drain', () => {
    const attacker = battle.getActivePokemon(0);
    const defender = battle.getActivePokemon(1);
    attacker.item = null;
    defender.item = null;

    assignMove(attacker, 0, makeMoveData({
      name: 'Giga Drain', type: 'Grass' as PokemonType, category: 'Special', power: 75,
      flags: { contact: false, sound: false, bullet: false, punch: false, bite: false, pulse: false, protect: true, mirror: true, defrost: false, charge: false, drain: 0.5 },
    }));
    assignMove(defender, 0, makeSplash());

    attacker.currentHp = Math.floor(attacker.maxHp / 2);
    const attackerHpBefore = attacker.currentHp;
    const defenderHpBefore = defender.currentHp;

    battle.processTurn({ type: 'move', moveIndex: 0 }, { type: 'move', moveIndex: 0 });

    const damageDealt = defenderHpBefore - defender.currentHp;
    const hpGained = attacker.currentHp - attackerHpBefore;
    const expectedDrain = Math.max(1, Math.floor(damageDealt * 0.5));

    expect(damageDealt).toBeGreaterThan(0);
    expect(hpGained).toBeGreaterThanOrEqual(expectedDrain - 1);
    expect(hpGained).toBeLessThanOrEqual(expectedDrain + 1);
  });

  it('Horn Leech: 50% drain', () => {
    const attacker = battle.getActivePokemon(0);
    const defender = battle.getActivePokemon(1);
    attacker.item = null;
    defender.item = null;

    assignMove(attacker, 0, makeMoveData({
      name: 'Horn Leech', type: 'Grass' as PokemonType, category: 'Physical', power: 75,
      flags: { contact: true, sound: false, bullet: false, punch: false, bite: false, pulse: false, protect: true, mirror: true, defrost: false, charge: false, drain: 0.5 },
    }));
    assignMove(defender, 0, makeSplash());

    attacker.currentHp = Math.floor(attacker.maxHp / 2);
    const attackerHpBefore = attacker.currentHp;
    const defenderHpBefore = defender.currentHp;

    battle.processTurn({ type: 'move', moveIndex: 0 }, { type: 'move', moveIndex: 0 });

    const damageDealt = defenderHpBefore - defender.currentHp;
    const hpGained = attacker.currentHp - attackerHpBefore;
    const expectedDrain = Math.max(1, Math.floor(damageDealt * 0.5));

    expect(damageDealt).toBeGreaterThan(0);
    expect(hpGained).toBeGreaterThanOrEqual(expectedDrain - 1);
    expect(hpGained).toBeLessThanOrEqual(expectedDrain + 1);
  });
});

// ========================
// 6. PROTECT
// ========================

describe('Protect', () => {
  let battle: Battle;

  beforeEach(() => {
    const p1 = createTestPlayer('p1', 'Alice');
    const p2 = createTestPlayer('p2', 'Bob');
    battle = new Battle(p1, p2, 42);
  });

  it('blocks an incoming damaging move', () => {
    const attacker = battle.getActivePokemon(0);
    const defender = battle.getActivePokemon(1);
    attacker.item = null;
    defender.item = null;

    // Attacker uses a strong move
    assignMove(attacker, 0, makeMoveData({ name: 'Tackle', power: 80 }));

    // Defender uses Protect
    assignMove(defender, 0, makeMoveData({
      name: 'Protect', category: 'Status', power: null as any, accuracy: null as any,
      target: 'self', priority: 4, effects: [],
    }));

    const defenderHpBefore = defender.currentHp;
    const events = battle.processTurn(
      { type: 'move', moveIndex: 0 },
      { type: 'move', moveIndex: 0 }
    );

    // Defender should have taken no damage from the attack
    expect(defender.currentHp).toBe(defenderHpBefore);

    // There should be a 'protected' event
    const protectedEvents = events.filter(e => e.type === 'protected');
    expect(protectedEvents.length).toBeGreaterThanOrEqual(1);
  });

  it('consecutive Protect has a high failure rate on turn 2', () => {
    const attacker = battle.getActivePokemon(0);
    const defender = battle.getActivePokemon(1);
    attacker.item = null;
    defender.item = null;

    assignMove(attacker, 0, makeMoveData({ name: 'Tackle', power: 40 }));
    assignMove(defender, 0, makeMoveData({
      name: 'Protect', category: 'Status', power: null as any, accuracy: null as any,
      target: 'self', priority: 4, effects: [],
    }));

    // Run many trials to check consecutive Protect failure rate
    let turn1Successes = 0;
    let turn2Successes = 0;
    const trials = 50;

    for (let i = 0; i < trials; i++) {
      const tp1 = createTestPlayer('p1', 'Alice');
      const tp2 = createTestPlayer('p2', 'Bob');
      const trialBattle = new Battle(tp1, tp2, i * 7 + 1);

      const att = trialBattle.getActivePokemon(0);
      const def = trialBattle.getActivePokemon(1);
      att.item = null;
      def.item = null;

      assignMove(att, 0, makeMoveData({ name: 'Tackle', power: 40 }));
      assignMove(def, 0, makeMoveData({
        name: 'Protect', category: 'Status', power: null as any, accuracy: null as any,
        target: 'self', priority: 4, effects: [],
      }));

      // Turn 1: Protect
      const hpBeforeTurn1 = def.currentHp;
      trialBattle.processTurn({ type: 'move', moveIndex: 0 }, { type: 'move', moveIndex: 0 });
      if (def.currentHp === hpBeforeTurn1) turn1Successes++;

      // Turn 2: Consecutive Protect
      const hpBeforeTurn2 = def.currentHp;
      trialBattle.processTurn({ type: 'move', moveIndex: 0 }, { type: 'move', moveIndex: 0 });
      if (def.currentHp === hpBeforeTurn2) turn2Successes++;
    }

    // Turn 1 should almost always succeed
    expect(turn1Successes).toBeGreaterThan(trials * 0.8);

    // Turn 2 consecutive Protect should fail most of the time (~67% failure rate)
    expect(turn2Successes).toBeLessThan(turn1Successes);
  });
});

// ========================
// 7. DEFINITIVE SWORDS DANCE DAMAGE TEST
// ========================

describe('Definitive Swords Dance damage test', () => {
  it('Swords Dance then physical attack deals ~2x damage vs unboosted', () => {
    // Run multiple trials and average to reduce RNG variance
    const unboostedDamages: number[] = [];
    const boostedDamages: number[] = [];

    for (let seed = 0; seed < 20; seed++) {
      // --- Unboosted trial ---
      {
        const p1 = createTestPlayer('p1', 'Alice');
        const p2 = createTestPlayer('p2', 'Bob');
        const b = new Battle(p1, p2, seed * 13 + 1);

        const att = b.getActivePokemon(0);
        const def = b.getActivePokemon(1);
        att.item = null;
        def.item = null;

        assignMove(att, 0, makeMoveData({ name: 'Tackle', power: 80, category: 'Physical' }));
        assignMove(def, 0, makeSplash());

        const hpBefore = def.currentHp;
        b.processTurn({ type: 'move', moveIndex: 0 }, { type: 'move', moveIndex: 0 });
        unboostedDamages.push(hpBefore - def.currentHp);
      }

      // --- Boosted trial (Swords Dance then attack) ---
      {
        const p1 = createTestPlayer('p1', 'Alice');
        const p2 = createTestPlayer('p2', 'Bob');
        const b = new Battle(p1, p2, seed * 13 + 1);

        const att = b.getActivePokemon(0);
        const def = b.getActivePokemon(1);
        att.item = null;
        def.item = null;

        assignMove(att, 0, makeStatBoostMove('Swords Dance', [{ stat: 'atk', stages: 2 }]));
        assignMove(att, 1, makeMoveData({ name: 'Tackle', power: 80, category: 'Physical' }));
        assignMove(def, 0, makeSplash());

        // Turn 1: Swords Dance (no damage)
        b.processTurn({ type: 'move', moveIndex: 0 }, { type: 'move', moveIndex: 0 });
        expect(att.boosts.atk).toBe(2);

        // Turn 2: Attack with boosted stats
        const hpBefore = def.currentHp;
        b.processTurn({ type: 'move', moveIndex: 1 }, { type: 'move', moveIndex: 0 });
        boostedDamages.push(hpBefore - def.currentHp);
      }
    }

    const avgUnboosted = unboostedDamages.reduce((a, b) => a + b, 0) / unboostedDamages.length;
    const avgBoosted = boostedDamages.reduce((a, b) => a + b, 0) / boostedDamages.length;

    expect(avgUnboosted).toBeGreaterThan(0);
    expect(avgBoosted).toBeGreaterThan(0);

    const ratio = avgBoosted / avgUnboosted;
    // +2 Atk = 2x damage multiplier; allow 1.8x to 2.2x for variance
    expect(ratio).toBeGreaterThanOrEqual(1.8);
    expect(ratio).toBeLessThanOrEqual(2.2);
  });
});
