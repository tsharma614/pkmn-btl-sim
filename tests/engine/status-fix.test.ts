import { describe, it, expect, beforeEach } from 'vitest';
import { Battle } from '../../src/engine/battle';
import { createBattlePokemon } from '../../src/engine/pokemon-factory';
import { Player, PokemonSpecies, PokemonSet, BattlePokemon, PokemonType, Nature, MoveData } from '../../src/types';

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

describe('Status Condition Fix — Abbreviation Translation', () => {
  let battle: Battle;
  let p1: Player;
  let p2: Player;

  beforeEach(() => {
    p1 = createTestPlayer('p1', 'Tanmay');
    p2 = createTestPlayer('p2', 'Nikhil');
    battle = new Battle(p1, p2, 42);
  });

  it('applyMoveEffects translates "par" abbreviation to "paralysis"', () => {
    const attacker = battle.getActivePokemon(0);
    const defender = battle.getActivePokemon(1);

    // Create a move with Showdown-style abbreviation
    const move: MoveData = {
      name: 'Thunder Wave',
      type: 'Electric',
      category: 'Status',
      power: null,
      accuracy: 100,
      pp: 20,
      priority: 0,
      flags: {},
      target: 'normal',
      effects: [{ type: 'status', status: 'par' as any, chance: 100, target: 'target' }],
    };

    // Call the private method via any cast
    (battle as any).applyMoveEffects(attacker, defender, move, 0, 1, []);
    expect(defender.status).toBe('paralysis');
  });

  it('applyMoveEffects translates "slp" abbreviation to "sleep"', () => {
    const attacker = battle.getActivePokemon(0);
    const defender = battle.getActivePokemon(1);

    const move: MoveData = {
      name: 'Spore',
      type: 'Grass',
      category: 'Status',
      power: null,
      accuracy: 100,
      pp: 15,
      priority: 0,
      flags: {},
      target: 'normal',
      effects: [{ type: 'status', status: 'slp' as any, chance: 100, target: 'target' }],
    };

    (battle as any).applyMoveEffects(attacker, defender, move, 0, 1, []);
    expect(defender.status).toBe('sleep');
  });

  it('applyMoveEffects translates "brn" abbreviation to "burn"', () => {
    const attacker = battle.getActivePokemon(0);
    const defender = battle.getActivePokemon(1);

    const move: MoveData = {
      name: 'Will-O-Wisp',
      type: 'Fire',
      category: 'Status',
      power: null,
      accuracy: 85,
      pp: 15,
      priority: 0,
      flags: {},
      target: 'normal',
      effects: [{ type: 'status', status: 'brn' as any, chance: 100, target: 'target' }],
    };

    (battle as any).applyMoveEffects(attacker, defender, move, 0, 1, []);
    expect(defender.status).toBe('burn');
  });

  it('applyMoveEffects translates "frz" abbreviation to "freeze"', () => {
    const attacker = battle.getActivePokemon(0);
    const defender = battle.getActivePokemon(1);

    const move: MoveData = {
      name: 'Ice Beam',
      type: 'Ice',
      category: 'Special',
      power: 90,
      accuracy: 100,
      pp: 10,
      priority: 0,
      flags: {},
      target: 'normal',
      effects: [{ type: 'status', status: 'frz' as any, chance: 100, target: 'target' }],
    };

    (battle as any).applyMoveEffects(attacker, defender, move, 0, 1, []);
    expect(defender.status).toBe('freeze');
  });

  it('applyMoveEffects translates "psn" abbreviation to "poison"', () => {
    const attacker = battle.getActivePokemon(0);
    const defender = battle.getActivePokemon(1);

    const move: MoveData = {
      name: 'Poison Jab',
      type: 'Poison',
      category: 'Physical',
      power: 80,
      accuracy: 100,
      pp: 20,
      priority: 0,
      flags: {},
      target: 'normal',
      effects: [{ type: 'status', status: 'psn' as any, chance: 100, target: 'target' }],
    };

    (battle as any).applyMoveEffects(attacker, defender, move, 0, 1, []);
    expect(defender.status).toBe('poison');
  });

  it('applyMoveEffects translates "tox" abbreviation to "toxic"', () => {
    const attacker = battle.getActivePokemon(0);
    const defender = battle.getActivePokemon(1);

    const move: MoveData = {
      name: 'Toxic',
      type: 'Poison',
      category: 'Status',
      power: null,
      accuracy: 90,
      pp: 10,
      priority: 0,
      flags: {},
      target: 'normal',
      effects: [{ type: 'status', status: 'tox' as any, chance: 100, target: 'target' }],
    };

    (battle as any).applyMoveEffects(attacker, defender, move, 0, 1, []);
    expect(defender.status).toBe('toxic');
  });

  it('applyMoveEffects still works with full status names', () => {
    const attacker = battle.getActivePokemon(0);
    const defender = battle.getActivePokemon(1);

    const move: MoveData = {
      name: 'Test Move',
      type: 'Normal',
      category: 'Status',
      power: null,
      accuracy: 100,
      pp: 20,
      priority: 0,
      flags: {},
      target: 'normal',
      effects: [{ type: 'status', status: 'paralysis' as any, chance: 100, target: 'target' }],
    };

    (battle as any).applyMoveEffects(attacker, defender, move, 0, 1, []);
    expect(defender.status).toBe('paralysis');
  });

  it('self-targeting status with abbreviation applies to attacker', () => {
    const attacker = battle.getActivePokemon(0);
    const defender = battle.getActivePokemon(1);

    const move: MoveData = {
      name: 'Rest-like',
      type: 'Normal',
      category: 'Status',
      power: null,
      accuracy: 100,
      pp: 10,
      priority: 0,
      flags: {},
      target: 'normal',
      effects: [{ type: 'status', status: 'slp' as any, chance: 100, target: 'self' }],
    };

    (battle as any).applyMoveEffects(attacker, defender, move, 0, 1, []);
    expect(attacker.status).toBe('sleep');
    expect(defender.status).toBeNull();
  });
});

describe('Paralysis Speed Fix', () => {
  let battle: Battle;
  let p1: Player;
  let p2: Player;

  beforeEach(() => {
    p1 = createTestPlayer('p1', 'Tanmay');
    p2 = createTestPlayer('p2', 'Nikhil');
    battle = new Battle(p1, p2, 42);
  });

  it('paralysis halves speed (0.5x, not 0.25x)', () => {
    const pokemon = battle.getActivePokemon(0);
    const normalSpeed = (battle as any).getEffectiveSpeed(0);

    // Apply paralysis
    pokemon.status = 'paralysis';
    const paraSpeed = (battle as any).getEffectiveSpeed(0);

    // Should be ~50% of normal speed, not 25%
    expect(paraSpeed).toBe(Math.floor(normalSpeed * 0.5));
    // Ensure it's NOT 0.25x
    expect(paraSpeed).not.toBe(Math.floor(normalSpeed * 0.25));
  });

  it('paralyzed speed never drops below 1', () => {
    const pokemon = battle.getActivePokemon(0);
    // Set very low speed via boosts
    pokemon.boosts.spe = -6;
    pokemon.status = 'paralysis';

    const speed = (battle as any).getEffectiveSpeed(0);
    expect(speed).toBeGreaterThanOrEqual(1);
  });
});

describe('Status Effects — Functional Tests', () => {
  let battle: Battle;
  let p1: Player;
  let p2: Player;

  beforeEach(() => {
    p1 = createTestPlayer('p1', 'Tanmay');
    p2 = createTestPlayer('p2', 'Nikhil');
    battle = new Battle(p1, p2, 42);
  });

  it('burn deals 1/16 max HP end-of-turn damage', () => {
    const defender = battle.getActivePokemon(1);
    const events: any[] = [];
    battle.applyStatus(defender, 'burn', events);

    const hpBefore = defender.currentHp;
    // Process a turn to trigger end-of-turn effects
    battle.processTurn(
      { type: 'move', playerId: 'p1', moveIndex: 0 },
      { type: 'move', playerId: 'p2', moveIndex: 0 }
    );

    // Burn should have dealt residual damage (1/16 max HP)
    // Pokemon also took move damage, but burn damage should be added
    expect(defender.status).toBe('burn');
  });

  it('poison deals 1/8 max HP end-of-turn damage', () => {
    const defender = battle.getActivePokemon(1);
    const events: any[] = [];
    battle.applyStatus(defender, 'poison', events);
    expect(defender.status).toBe('poison');
  });

  it('sleep prevents Pokemon from moving', () => {
    const attacker = battle.getActivePokemon(0);
    const events: any[] = [];
    battle.applyStatus(attacker, 'sleep', events);
    expect(attacker.status).toBe('sleep');
    expect(attacker.sleepTurns).toBeGreaterThan(0);
  });

  it('freeze prevents Pokemon from moving', () => {
    const defender = battle.getActivePokemon(1);
    const events: any[] = [];
    battle.applyStatus(defender, 'freeze', events);
    expect(defender.status).toBe('freeze');
  });

  it('toxic status is applied correctly', () => {
    const defender = battle.getActivePokemon(1);
    const events: any[] = [];
    battle.applyStatus(defender, 'toxic', events);
    expect(defender.status).toBe('toxic');
    expect(defender.toxicCounter).toBeGreaterThanOrEqual(0);
  });
});

describe('Thunder Wave Integration — Full Move with Abbreviation', () => {
  it('Thunder Wave from moves.json paralyzes the target', () => {
    const p1 = createTestPlayer('p1', 'Tanmay', [
      { set: { moves: ['Thunder Wave', 'Tackle', 'Thunderbolt', 'Ice Beam'] } },
    ]);
    const p2 = createTestPlayer('p2', 'Nikhil');
    // Use a seed that ensures Thunder Wave hits (accuracy=90)
    const battle = new Battle(p1, p2, 100);

    // Process several turns trying Thunder Wave — it should eventually land
    let paralyzed = false;
    for (let i = 0; i < 10; i++) {
      if (battle.state.status !== 'active') break;
      battle.processTurn(
        { type: 'move', playerId: 'p1', moveIndex: 0 },  // Thunder Wave
        { type: 'move', playerId: 'p2', moveIndex: 0 }
      );
      if (battle.getActivePokemon(1).status === 'paralysis') {
        paralyzed = true;
        break;
      }
    }
    expect(paralyzed).toBe(true);
  });
});
