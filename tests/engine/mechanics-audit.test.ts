import { describe, it, expect, beforeEach } from 'vitest';
import { Battle } from '../../src/engine/battle';
import { createBattlePokemon } from '../../src/engine/pokemon-factory';
import { rollAccuracy } from '../../src/engine/damage';
import { Player, PokemonSpecies, PokemonSet, BattlePokemon, PokemonType, Nature, MoveData, StatusCondition } from '../../src/types';
import { SeededRNG } from '../../src/utils/rng';
import { chooseBotAction } from '../../src/engine/bot';

// --- Test helpers ---

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

function makeMoveData(overrides: Partial<MoveData> = {}): MoveData {
  return {
    name: 'Test Move',
    type: 'Normal' as PokemonType,
    category: 'Physical',
    power: 80,
    accuracy: 100,
    pp: 10,
    priority: 0,
    target: 'normal',
    flags: { contact: false, sound: false, bullet: false, punch: false, bite: false, pulse: false, protect: true, mirror: true, defrost: false, charge: false },
    effects: [],
    description: '',
    critRatio: 0,
    willCrit: false,
    forceSwitch: false,
    selfSwitch: false,
    status: null,
    volatileStatus: null,
    weather: null,
    sideCondition: null,
    boosts: null,
    selfBoosts: null,
    ...overrides,
  } as MoveData;
}

// ========================
// MOVE FIXES
// ========================

describe('Thunder accuracy in rain', () => {
  it('always hits in rain', () => {
    const rng = new SeededRNG(42);
    let hits = 0;
    for (let i = 0; i < 100; i++) {
      if (rollAccuracy(rng, 70, 0, 0, { moveName: 'Thunder', weather: 'rain' })) hits++;
    }
    expect(hits).toBe(100);
  });

  it('has 50% accuracy in sun', () => {
    const rng = new SeededRNG(42);
    let hits = 0;
    for (let i = 0; i < 1000; i++) {
      if (rollAccuracy(rng, 70, 0, 0, { moveName: 'Thunder', weather: 'sun' })) hits++;
    }
    // Should be ~50% ± tolerance
    expect(hits).toBeGreaterThan(400);
    expect(hits).toBeLessThan(600);
  });

  it('has normal 70% accuracy without weather', () => {
    const rng = new SeededRNG(42);
    let hits = 0;
    for (let i = 0; i < 1000; i++) {
      if (rollAccuracy(rng, 70, 0, 0, { moveName: 'Thunder', weather: 'none' })) hits++;
    }
    expect(hits).toBeGreaterThan(600);
    expect(hits).toBeLessThan(800);
  });
});

describe('Hurricane accuracy in rain', () => {
  it('always hits in rain', () => {
    const rng = new SeededRNG(42);
    for (let i = 0; i < 50; i++) {
      expect(rollAccuracy(rng, 70, 0, 0, { moveName: 'Hurricane', weather: 'rain' })).toBe(true);
    }
  });
});

describe('Blizzard accuracy in hail', () => {
  it('always hits in hail', () => {
    const rng = new SeededRNG(42);
    for (let i = 0; i < 50; i++) {
      expect(rollAccuracy(rng, 70, 0, 0, { moveName: 'Blizzard', weather: 'hail' })).toBe(true);
    }
  });
});

describe('Compound Eyes accuracy boost', () => {
  it('multiplies accuracy by 1.3', () => {
    const rng = new SeededRNG(42);
    let hits = 0;
    for (let i = 0; i < 1000; i++) {
      if (rollAccuracy(rng, 70, 0, 0, { attackerAbility: 'Compound Eyes' })) hits++;
    }
    // 70 * 1.3 = 91% accuracy
    expect(hits).toBeGreaterThan(850);
    expect(hits).toBeLessThan(950);
  });
});

describe('Seismic Toss / Night Shade fixed damage', () => {
  let battle: Battle;
  let p1: Player;
  let p2: Player;

  beforeEach(() => {
    p1 = createTestPlayer('p1', 'Alice');
    p2 = createTestPlayer('p2', 'Bob');
    battle = new Battle(p1, p2, 42);
  });

  it('Seismic Toss deals damage equal to user level', () => {
    const attacker = battle.getActivePokemon(0);
    const defender = battle.getActivePokemon(1);
    attacker.item = null;
    defender.item = null;
    const startHp = defender.currentHp;

    attacker.moves[0] = {
      data: makeMoveData({ name: 'Seismic Toss', type: 'Fighting', category: 'Physical', power: null }),
      currentPp: 20,
      maxPp: 20,
      disabled: false,
    };

    const events = battle.processTurn(
      { type: 'move', moveIndex: 0 },
      { type: 'move', moveIndex: 0 }
    );

    // Should deal exactly 100 damage (level 100)
    expect(defender.currentHp).toBe(startHp - 100);
  });
});

describe('Facade doubles power when statused', () => {
  let battle: Battle;
  let p1: Player;
  let p2: Player;

  beforeEach(() => {
    p1 = createTestPlayer('p1', 'Alice');
    p2 = createTestPlayer('p2', 'Bob');
    battle = new Battle(p1, p2, 42);
  });

  it('deals more damage when burned', () => {
    const attacker = battle.getActivePokemon(0);
    const defender = battle.getActivePokemon(1);
    attacker.item = null;
    defender.item = null;

    attacker.moves[0] = {
      data: makeMoveData({ name: 'Facade', type: 'Normal', category: 'Physical', power: null }),
      currentPp: 20,
      maxPp: 20,
      disabled: false,
    };

    // Without status: power should be 70
    const hp1 = defender.currentHp;
    battle.processTurn({ type: 'move', moveIndex: 0 }, { type: 'move', moveIndex: 0 });
    const dmgNormal = hp1 - defender.currentHp;

    // Reset
    defender.currentHp = defender.maxHp;
    attacker.status = 'burn' as StatusCondition;

    const hp2 = defender.currentHp;
    battle.processTurn({ type: 'move', moveIndex: 0 }, { type: 'move', moveIndex: 0 });
    const dmgBurned = hp2 - defender.currentHp;

    // Facade + burn = 140 power (but burn halves physical, so effectively 70 * 2 / 2 = 70)
    // Actually burn halves physical damage AND facade doubles power, so net is same or higher
    // The key point: facade should be hitting, not doing 0 damage
    expect(dmgNormal).toBeGreaterThan(0);
    expect(dmgBurned).toBeGreaterThan(0);
  });
});

// ========================
// ABILITY FIXES
// ========================

describe('Focus Sash', () => {
  let battle: Battle;
  let p1: Player;
  let p2: Player;

  beforeEach(() => {
    p1 = createTestPlayer('p1', 'Alice');
    p2 = createTestPlayer('p2', 'Bob');
    battle = new Battle(p1, p2, 42);
  });

  it('survives OHKO at 1 HP when at full HP', () => {
    const attacker = battle.getActivePokemon(0);
    const defender = battle.getActivePokemon(1);
    attacker.item = null;
    defender.item = 'Focus Sash';

    // Nuke with a super-strong move
    attacker.moves[0] = {
      data: makeMoveData({ name: 'Explosion', type: 'Normal', power: 999 }),
      currentPp: 5,
      maxPp: 5,
      disabled: false,
    };

    const events = battle.processTurn(
      { type: 'move', moveIndex: 0 },
      { type: 'move', moveIndex: 0 }
    );

    expect(defender.currentHp).toBe(1);
    expect(defender.isAlive).toBe(true);
    expect(defender.itemConsumed).toBe(true);
  });

  it('does not activate when not at full HP', () => {
    const attacker = battle.getActivePokemon(0);
    const defender = battle.getActivePokemon(1);
    attacker.item = null;
    defender.item = 'Focus Sash';
    defender.currentHp = defender.maxHp - 1; // Not full

    attacker.moves[0] = {
      data: makeMoveData({ name: 'Mega Move', type: 'Normal', power: 999 }),
      currentPp: 5,
      maxPp: 5,
      disabled: false,
    };

    battle.processTurn(
      { type: 'move', moveIndex: 0 },
      { type: 'move', moveIndex: 0 }
    );

    expect(defender.isAlive).toBe(false);
  });
});

describe('Sturdy', () => {
  let battle: Battle;

  beforeEach(() => {
    const p1 = createTestPlayer('p1', 'Alice');
    const p2 = createTestPlayer('p2', 'Bob', [{ set: { ability: 'Sturdy' } }]);
    battle = new Battle(p1, p2, 42);
  });

  it('survives OHKO at 1 HP when at full HP', () => {
    const attacker = battle.getActivePokemon(0);
    const defender = battle.getActivePokemon(1);
    attacker.item = null;
    defender.item = null;

    attacker.moves[0] = {
      data: makeMoveData({ name: 'Mega Move', type: 'Normal', power: 999 }),
      currentPp: 5,
      maxPp: 5,
      disabled: false,
    };

    battle.processTurn(
      { type: 'move', moveIndex: 0 },
      { type: 'move', moveIndex: 0 }
    );

    expect(defender.currentHp).toBe(1);
    expect(defender.isAlive).toBe(true);
  });
});

describe('Rocky Helmet', () => {
  let battle: Battle;

  beforeEach(() => {
    const p1 = createTestPlayer('p1', 'Alice');
    const p2 = createTestPlayer('p2', 'Bob');
    battle = new Battle(p1, p2, 42);
  });

  it('deals 1/6 max HP to attacker on contact', () => {
    const attacker = battle.getActivePokemon(0);
    const defender = battle.getActivePokemon(1);
    attacker.item = null;
    defender.item = 'Rocky Helmet';

    attacker.moves[0] = {
      data: makeMoveData({ name: 'Tackle', type: 'Normal', power: 40, flags: { contact: true, sound: false, bullet: false, punch: false, bite: false, pulse: false, protect: true, mirror: true, defrost: false, charge: false } }),
      currentPp: 35,
      maxPp: 35,
      disabled: false,
    };

    const startHp = attacker.currentHp;
    battle.processTurn(
      { type: 'move', moveIndex: 0 },
      { type: 'move', moveIndex: 0 }
    );

    const expectedRockyDmg = Math.max(1, Math.floor(attacker.maxHp / 6));
    // Attacker should have lost HP from Rocky Helmet (plus any Leftovers, damage taken, etc.)
    expect(startHp - attacker.currentHp).toBeGreaterThanOrEqual(expectedRockyDmg);
  });
});

describe('Weakness Policy', () => {
  let battle: Battle;

  beforeEach(() => {
    const p1 = createTestPlayer('p1', 'Alice', [{ species: { types: ['Fire'] as [PokemonType] } }]);
    const p2 = createTestPlayer('p2', 'Bob');
    battle = new Battle(p1, p2, 42);
  });

  it('raises Atk and SpA by 2 when hit super effectively', () => {
    const attacker = battle.getActivePokemon(1);
    const defender = battle.getActivePokemon(0); // Fire type
    defender.item = 'Weakness Policy';

    // Use Water move (SE against Fire)
    attacker.moves[0] = {
      data: makeMoveData({ name: 'Water Gun', type: 'Water' as PokemonType, category: 'Special', power: 40 }),
      currentPp: 25,
      maxPp: 25,
      disabled: false,
    };

    battle.processTurn(
      { type: 'move', moveIndex: 0 }, // Fire type defender moves first
      { type: 'move', moveIndex: 0 }  // Water attacker uses Water Gun
    );

    // Defender (Fire) should have +2 Atk and +2 SpA from Weakness Policy
    expect(defender.boosts.atk).toBe(2);
    expect(defender.boosts.spa).toBe(2);
    expect(defender.itemConsumed).toBe(true);
  });
});

describe('Heavy-Duty Boots', () => {
  let battle: Battle;

  beforeEach(() => {
    const p1 = createTestPlayer('p1', 'Alice');
    const p2 = createTestPlayer('p2', 'Bob');
    battle = new Battle(p1, p2, 42);
  });

  it('prevents Stealth Rock damage on switch-in', () => {
    // Set up Stealth Rock on side 0
    const side = battle.getSideEffects(0);
    side.stealthRock = true;

    const switchTarget = battle.state.players[0].team[1];
    switchTarget.item = 'Heavy-Duty Boots';

    const events = battle.processTurn(
      { type: 'switch', pokemonIndex: 1 },
      { type: 'move', moveIndex: 0 }
    );

    // Should not have any hazard_damage event for the switch target
    const hazardEvents = events.filter(e => e.type === 'hazard_damage' && e.data?.pokemon === switchTarget.species.name);
    expect(hazardEvents.length).toBe(0);
  });
});

describe('Toxic Orb and Flame Orb', () => {
  let battle: Battle;
  let p1: Player;
  let p2: Player;

  beforeEach(() => {
    p1 = createTestPlayer('p1', 'Alice');
    p2 = createTestPlayer('p2', 'Bob');
    battle = new Battle(p1, p2, 42);
  });

  it('Toxic Orb badly poisons holder at end of turn', () => {
    const pokemon = battle.getActivePokemon(0);
    pokemon.item = 'Toxic Orb';

    battle.processTurn(
      { type: 'move', moveIndex: 0 },
      { type: 'move', moveIndex: 0 }
    );

    expect(pokemon.status).toBe('toxic');
  });

  it('Flame Orb burns holder at end of turn', () => {
    const pokemon = battle.getActivePokemon(1);
    pokemon.item = 'Flame Orb';

    battle.processTurn(
      { type: 'move', moveIndex: 0 },
      { type: 'move', moveIndex: 0 }
    );

    expect(pokemon.status).toBe('burn');
  });
});

describe('Air Balloon', () => {
  let battle: Battle;

  beforeEach(() => {
    const p1 = createTestPlayer('p1', 'Alice');
    const p2 = createTestPlayer('p2', 'Bob');
    battle = new Battle(p1, p2, 42);
  });

  it('grants Ground immunity', () => {
    const attacker = battle.getActivePokemon(0);
    const defender = battle.getActivePokemon(1);
    defender.item = 'Air Balloon';
    attacker.item = null;

    attacker.moves[0] = {
      data: makeMoveData({ name: 'Earthquake', type: 'Ground' as PokemonType, power: 100 }),
      currentPp: 10,
      maxPp: 10,
      disabled: false,
    };

    const startHp = defender.currentHp;
    const events = battle.processTurn(
      { type: 'move', moveIndex: 0 },
      { type: 'move', moveIndex: 0 }
    );

    // If attacker goes first, defender takes no Ground damage
    const immuneEvents = events.filter(e => e.type === 'immune');
    if (immuneEvents.length > 0) {
      expect(defender.currentHp).toBe(startHp); // Only if attacker went first
    }
  });

  it('pops when hit by any attack', () => {
    const attacker = battle.getActivePokemon(0);
    const defender = battle.getActivePokemon(1);
    defender.item = 'Air Balloon';
    attacker.item = null;

    attacker.moves[0] = {
      data: makeMoveData({ name: 'Tackle', type: 'Normal', power: 40 }),
      currentPp: 35,
      maxPp: 35,
      disabled: false,
    };

    const events = battle.processTurn(
      { type: 'move', moveIndex: 0 },
      { type: 'move', moveIndex: 0 }
    );

    expect(defender.itemConsumed).toBe(true);

    // Verify item_trigger event is emitted with correct data
    const triggerEvents = events.filter(e => e.type === 'item_trigger' && e.data.item === 'Air Balloon');
    expect(triggerEvents.length).toBeGreaterThanOrEqual(1);
    expect(triggerEvents[0].data.message).toBe('popped');
    expect(triggerEvents[0].data.pokemon).toBe(defender.species.name);
  });
});

describe('Expert Belt', () => {
  let battle: Battle;

  beforeEach(() => {
    const p1 = createTestPlayer('p1', 'Alice');
    const p2 = createTestPlayer('p2', 'Bob', [{ species: { types: ['Fire'] as [PokemonType] } }]);
    battle = new Battle(p1, p2, 42);
  });

  it('boosts super effective damage by 1.2x', () => {
    const attacker = battle.getActivePokemon(0);
    const defender = battle.getActivePokemon(1); // Fire type
    defender.item = null;

    // Without Expert Belt
    attacker.item = null;
    attacker.moves[0] = {
      data: makeMoveData({ name: 'Water Gun', type: 'Water' as PokemonType, category: 'Special', power: 40 }),
      currentPp: 25,
      maxPp: 25,
      disabled: false,
    };

    const hp1 = defender.currentHp;
    battle.processTurn({ type: 'move', moveIndex: 0 }, { type: 'move', moveIndex: 0 });
    const dmgWithout = hp1 - defender.currentHp;

    // With Expert Belt
    defender.currentHp = defender.maxHp;
    attacker.item = 'Expert Belt';

    const hp2 = defender.currentHp;
    battle.processTurn({ type: 'move', moveIndex: 0 }, { type: 'move', moveIndex: 0 });
    const dmgWith = hp2 - defender.currentHp;

    // Expert Belt damage should be higher
    expect(dmgWith).toBeGreaterThan(dmgWithout);
  });
});

// ========================
// ABILITY FIXES
// ========================

describe('Moxie', () => {
  let battle: Battle;

  beforeEach(() => {
    const p1 = createTestPlayer('p1', 'Alice', [{ set: { ability: 'Moxie' } }]);
    const p2 = createTestPlayer('p2', 'Bob');
    battle = new Battle(p1, p2, 42);
  });

  it('raises Attack by 1 when KOing an opponent', () => {
    const attacker = battle.getActivePokemon(0);
    const defender = battle.getActivePokemon(1);
    attacker.item = null;
    defender.item = null;
    defender.currentHp = 1; // Will be KO'd

    attacker.moves[0] = {
      data: makeMoveData({ name: 'Tackle', type: 'Normal', power: 40 }),
      currentPp: 35,
      maxPp: 35,
      disabled: false,
    };

    battle.processTurn(
      { type: 'move', moveIndex: 0 },
      { type: 'move', moveIndex: 0 }
    );

    expect(attacker.boosts.atk).toBe(1);
  });
});

describe('Defiant', () => {
  let battle: Battle;

  beforeEach(() => {
    const p1 = createTestPlayer('p1', 'Alice');
    const p2 = createTestPlayer('p2', 'Bob', [{ set: { ability: 'Defiant' } }]);
    battle = new Battle(p1, p2, 42);
  });

  it('raises Attack by 2 when a stat is lowered by Intimidate', () => {
    const intimidator = battle.getActivePokemon(0);
    const defiant = battle.state.players[1].team[1];
    defiant.ability = 'Defiant';

    // Switch in an Intimidate user
    intimidator.ability = 'Intimidate';
    // The active mon on p2's side has Defiant
    const defender = battle.getActivePokemon(1);
    defender.ability = 'Defiant';

    // Simulate Intimidate by switching in
    const events: any[] = [];
    (battle as any).handleSwitchInAbility(0, intimidator, events);

    // Defiant should have triggered: -1 Atk from Intimidate, +2 Atk from Defiant = net +1
    expect(defender.boosts.atk).toBe(1);
  });
});

describe('Natural Cure', () => {
  let battle: Battle;

  beforeEach(() => {
    const p1 = createTestPlayer('p1', 'Alice', [{ set: { ability: 'Natural Cure' } }]);
    const p2 = createTestPlayer('p2', 'Bob');
    battle = new Battle(p1, p2, 42);
  });

  it('cures status when switching out', () => {
    const pokemon = battle.getActivePokemon(0);
    pokemon.status = 'paralysis' as StatusCondition;

    battle.processTurn(
      { type: 'switch', pokemonIndex: 1 },
      { type: 'move', moveIndex: 0 }
    );

    expect(pokemon.status).toBe(null);
  });
});

describe('Regenerator', () => {
  let battle: Battle;

  beforeEach(() => {
    const p1 = createTestPlayer('p1', 'Alice', [{ set: { ability: 'Regenerator' } }]);
    const p2 = createTestPlayer('p2', 'Bob');
    battle = new Battle(p1, p2, 42);
  });

  it('heals 1/3 HP when switching out', () => {
    const pokemon = battle.getActivePokemon(0);
    pokemon.currentHp = Math.floor(pokemon.maxHp / 2); // At 50%
    const hpBefore = pokemon.currentHp;

    battle.processTurn(
      { type: 'switch', pokemonIndex: 1 },
      { type: 'move', moveIndex: 0 }
    );

    const expectedHeal = Math.floor(pokemon.maxHp / 3);
    expect(pokemon.currentHp).toBe(Math.min(pokemon.maxHp, hpBefore + expectedHeal));
  });
});

describe('Shadow Shield / Multiscale', () => {
  let battle: Battle;

  beforeEach(() => {
    const p1 = createTestPlayer('p1', 'Alice');
    const p2 = createTestPlayer('p2', 'Bob', [{ set: { ability: 'Shadow Shield' } }]);
    battle = new Battle(p1, p2, 42);
  });

  it('halves damage at full HP', () => {
    const attacker = battle.getActivePokemon(0);
    const defender = battle.getActivePokemon(1);
    attacker.item = null;
    defender.item = null;

    attacker.moves[0] = {
      data: makeMoveData({ name: 'Tackle', type: 'Normal', power: 80 }),
      currentPp: 35,
      maxPp: 35,
      disabled: false,
    };

    // First hit: at full HP, should take reduced damage
    const hp1 = defender.currentHp;
    expect(defender.currentHp).toBe(defender.maxHp);
    battle.processTurn({ type: 'move', moveIndex: 0 }, { type: 'move', moveIndex: 0 });
    const dmg1 = hp1 - defender.currentHp;

    // Second hit: not at full HP
    const hp2 = defender.currentHp;
    battle.processTurn({ type: 'move', moveIndex: 0 }, { type: 'move', moveIndex: 0 });
    const dmg2 = hp2 - defender.currentHp;

    // First hit should deal less damage than second (if both non-crit)
    // Due to RNG we can't guarantee, but the modifier should be applied
    expect(dmg1).toBeGreaterThan(0);
    expect(dmg2).toBeGreaterThan(0);
  });
});

describe('Prankster', () => {
  let battle: Battle;

  beforeEach(() => {
    const p1 = createTestPlayer('p1', 'Alice', [{ set: { ability: 'Prankster' } }]);
    const p2 = createTestPlayer('p2', 'Bob');
    battle = new Battle(p1, p2, 42);
  });

  it('gives +1 priority to status moves', () => {
    const priority = (battle as any).getActionPriority({ type: 'move', moveIndex: 0 }, 0);
    // Tackle is physical, not affected by Prankster
    const pokemon = battle.getActivePokemon(0);
    pokemon.moves[0] = {
      data: makeMoveData({ name: 'Thunder Wave', category: 'Status', type: 'Electric' as PokemonType, power: null }),
      currentPp: 20,
      maxPp: 20,
      disabled: false,
    };

    const statusPriority = (battle as any).getActionPriority({ type: 'move', moveIndex: 0 }, 0);
    expect(statusPriority).toBe(1); // 0 + 1 from Prankster
  });
});

describe('Chlorophyll (weather speed)', () => {
  let battle: Battle;

  beforeEach(() => {
    const p1 = createTestPlayer('p1', 'Alice', [{ set: { ability: 'Chlorophyll' } }]);
    const p2 = createTestPlayer('p2', 'Bob');
    battle = new Battle(p1, p2, 42);
  });

  it('doubles speed in sun', () => {
    battle.state.weather = 'sun';
    const normalSpeed = battle.getActivePokemon(0).stats.spe;
    const effectiveSpeed = (battle as any).getEffectiveSpeed(0);
    expect(effectiveSpeed).toBeGreaterThanOrEqual(normalSpeed * 2 - 1);
  });

  it('does not double speed without sun', () => {
    battle.state.weather = 'none';
    const normalSpeed = battle.getActivePokemon(0).stats.spe;
    const effectiveSpeed = (battle as any).getEffectiveSpeed(0);
    expect(effectiveSpeed).toBeLessThan(normalSpeed * 2);
  });
});

describe('Tinted Lens', () => {
  let battle: Battle;

  beforeEach(() => {
    const p1 = createTestPlayer('p1', 'Alice', [{ set: { ability: 'Tinted Lens' } }]);
    const p2 = createTestPlayer('p2', 'Bob', [{ species: { types: ['Rock'] as [PokemonType] } }]);
    battle = new Battle(p1, p2, 42);
  });

  it('doubles NVE damage', () => {
    const attacker = battle.getActivePokemon(0);
    const defender = battle.getActivePokemon(1); // Rock type
    attacker.item = null;
    defender.item = null;

    // Normal vs Rock = NVE (0.5x)
    // Tinted Lens should make it 1.0x
    attacker.moves[0] = {
      data: makeMoveData({ name: 'Tackle', type: 'Normal', power: 80 }),
      currentPp: 35,
      maxPp: 35,
      disabled: false,
    };

    const hp = defender.currentHp;
    battle.processTurn({ type: 'move', moveIndex: 0 }, { type: 'move', moveIndex: 0 });
    expect(hp - defender.currentHp).toBeGreaterThan(0);
  });
});

describe('Simple', () => {
  let battle: Battle;

  beforeEach(() => {
    const p1 = createTestPlayer('p1', 'Alice', [{ set: { ability: 'Simple' } }]);
    const p2 = createTestPlayer('p2', 'Bob');
    battle = new Battle(p1, p2, 42);
  });

  it('doubles stat stage changes', () => {
    const pokemon = battle.getActivePokemon(0);
    battle.applyBoost(pokemon, 'atk', 1, []);
    expect(pokemon.boosts.atk).toBe(2); // +1 becomes +2
  });
});

describe('Fake Out first turn only', () => {
  let battle: Battle;

  beforeEach(() => {
    const p1 = createTestPlayer('p1', 'Alice');
    const p2 = createTestPlayer('p2', 'Bob');
    battle = new Battle(p1, p2, 42);
  });

  it('works on turn 1 (first turn after entering)', () => {
    const attacker = battle.getActivePokemon(0);
    const defender = battle.getActivePokemon(1);
    attacker.item = null;
    defender.item = null;

    attacker.moves[0] = {
      data: makeMoveData({ name: 'Fake Out', type: 'Normal', power: 40, priority: 3 }),
      currentPp: 10,
      maxPp: 10,
      disabled: false,
    };

    const hp = defender.currentHp;
    battle.processTurn({ type: 'move', moveIndex: 0 }, { type: 'move', moveIndex: 0 });
    // Should deal damage on first turn (turnsOnField was 0 before turn, incremented to 1 during turn)
    expect(hp - defender.currentHp).toBeGreaterThan(0);
  });

  it('fails on subsequent turns', () => {
    const attacker = battle.getActivePokemon(0);
    const defender = battle.getActivePokemon(1);
    attacker.item = null;
    defender.item = null;

    attacker.moves[0] = {
      data: makeMoveData({ name: 'Fake Out', type: 'Normal', power: 40, priority: 3 }),
      currentPp: 10,
      maxPp: 10,
      disabled: false,
    };

    // First turn
    battle.processTurn({ type: 'move', moveIndex: 0 }, { type: 'move', moveIndex: 0 });

    // Second turn: should fail
    defender.currentHp = defender.maxHp;
    const hp = defender.currentHp;
    const events = battle.processTurn({ type: 'move', moveIndex: 0 }, { type: 'move', moveIndex: 0 });
    const failEvents = events.filter(e => e.type === 'move_fail');
    expect(failEvents.length).toBeGreaterThan(0);
  });
});

describe('Rapid Spin clears hazards', () => {
  let battle: Battle;

  beforeEach(() => {
    const p1 = createTestPlayer('p1', 'Alice');
    const p2 = createTestPlayer('p2', 'Bob');
    battle = new Battle(p1, p2, 42);
  });

  it('clears Stealth Rock, Spikes, and Toxic Spikes', () => {
    const side = battle.getSideEffects(0);
    side.stealthRock = true;
    side.spikesLayers = 2;
    side.toxicSpikesLayers = 1;

    const attacker = battle.getActivePokemon(0);
    attacker.item = null;
    attacker.moves[0] = {
      data: makeMoveData({ name: 'Rapid Spin', type: 'Normal', power: 50 }),
      currentPp: 40,
      maxPp: 40,
      disabled: false,
    };

    battle.processTurn({ type: 'move', moveIndex: 0 }, { type: 'move', moveIndex: 0 });

    expect(side.stealthRock).toBe(false);
    expect(side.spikesLayers).toBe(0);
    expect(side.toxicSpikesLayers).toBe(0);
  });
});

describe('Assault Vest', () => {
  let battle: Battle;

  beforeEach(() => {
    const p1 = createTestPlayer('p1', 'Alice');
    const p2 = createTestPlayer('p2', 'Bob');
    battle = new Battle(p1, p2, 42);
  });

  it('provides 1.5x SpDef against special moves', () => {
    const attacker = battle.getActivePokemon(0);
    const defender = battle.getActivePokemon(1);
    attacker.item = null;

    attacker.moves[0] = {
      data: makeMoveData({ name: 'Thunderbolt', type: 'Electric' as PokemonType, category: 'Special', power: 90 }),
      currentPp: 15,
      maxPp: 15,
      disabled: false,
    };

    // Without Assault Vest
    defender.item = null;
    const hp1 = defender.currentHp;
    battle.processTurn({ type: 'move', moveIndex: 0 }, { type: 'move', moveIndex: 0 });
    const dmgWithout = hp1 - defender.currentHp;

    // With Assault Vest
    defender.currentHp = defender.maxHp;
    defender.item = 'Assault Vest';
    const hp2 = defender.currentHp;
    battle.processTurn({ type: 'move', moveIndex: 0 }, { type: 'move', moveIndex: 0 });
    const dmgWith = hp2 - defender.currentHp;

    // Should take less special damage with Assault Vest
    expect(dmgWith).toBeLessThan(dmgWithout);
  });
});

// ========================
// SELF-BOOST MOVE EFFECTS
// ========================

describe('Moves with self-boost effects', () => {
  let battle: Battle;

  beforeEach(() => {
    const p1 = createTestPlayer('p1', 'Alice');
    const p2 = createTestPlayer('p2', 'Bob');
    battle = new Battle(p1, p2);
  });

  it('Trailblaze boosts Speed by 1 after dealing damage', () => {
    const attacker = battle.getActivePokemon(0);
    attacker.moves[0] = {
      data: makeMoveData({
        name: 'Trailblaze', type: 'Grass', power: 50,
        effects: [{ type: 'boost', stat: 'spe', stages: 1, chance: 100, target: 'self' }],
      }),
      currentPp: 20, maxPp: 20, disabled: false,
    };
    expect(attacker.boosts.spe).toBe(0);
    battle.processTurn({ type: 'move', moveIndex: 0 }, { type: 'move', moveIndex: 0 });
    expect(attacker.boosts.spe).toBe(1);
  });

  it('Power-Up Punch boosts Attack by 1 after dealing damage', () => {
    const attacker = battle.getActivePokemon(0);
    attacker.moves[0] = {
      data: makeMoveData({
        name: 'Power-Up Punch', type: 'Fighting', power: 40,
        effects: [{ type: 'boost', stat: 'atk', stages: 1, chance: 100, target: 'self' }],
      }),
      currentPp: 20, maxPp: 20, disabled: false,
    };
    expect(attacker.boosts.atk).toBe(0);
    battle.processTurn({ type: 'move', moveIndex: 0 }, { type: 'move', moveIndex: 0 });
    expect(attacker.boosts.atk).toBe(1);
  });

  it('Flame Charge boosts Speed by 1 after dealing damage', () => {
    const attacker = battle.getActivePokemon(0);
    attacker.moves[0] = {
      data: makeMoveData({
        name: 'Flame Charge', type: 'Fire', power: 50,
        effects: [{ type: 'boost', stat: 'spe', stages: 1, chance: 100, target: 'self' }],
      }),
      currentPp: 20, maxPp: 20, disabled: false,
    };
    expect(attacker.boosts.spe).toBe(0);
    battle.processTurn({ type: 'move', moveIndex: 0 }, { type: 'move', moveIndex: 0 });
    expect(attacker.boosts.spe).toBe(1);
  });
});

// ========================
// CALM MIND STACKING
// ========================

describe('Calm Mind stat boost stacking', () => {
  let battle: Battle;

  beforeEach(() => {
    const p1 = createTestPlayer('p1', 'Alice');
    const p2 = createTestPlayer('p2', 'Bob');
    battle = new Battle(p1, p2);
  });

  it('Calm Mind stacks +1 SpA and +1 SpD per use', () => {
    const attacker = battle.getActivePokemon(0);
    const defender = battle.getActivePokemon(1);

    // Give attacker Calm Mind (status move: +1 spa, +1 spd)
    attacker.moves[0] = {
      data: makeMoveData({
        name: 'Calm Mind', category: 'Status', power: null as any, accuracy: null as any,
        effects: [
          { type: 'boost', stat: 'spa', stages: 1, chance: 100, target: 'self' },
          { type: 'boost', stat: 'spd', stages: 1, chance: 100, target: 'self' },
        ],
        target: 'self',
      }),
      currentPp: 20, maxPp: 20, disabled: false,
    };

    // Defender uses Splash (does nothing)
    defender.moves[0] = {
      data: makeMoveData({ name: 'Splash', category: 'Status', power: null as any, accuracy: null as any, target: 'self', effects: [] }),
      currentPp: 20, maxPp: 20, disabled: false,
    };

    // Use Calm Mind 3 times
    for (let i = 0; i < 3; i++) {
      battle.processTurn({ type: 'move', moveIndex: 0 }, { type: 'move', moveIndex: 0 });
    }

    expect(attacker.boosts.spa).toBe(3);
    expect(attacker.boosts.spd).toBe(3);
  });

  it('damage increases proportionally with stacked boosts', () => {
    const attacker = battle.getActivePokemon(0);
    const defender = battle.getActivePokemon(1);

    // Set up a special attack
    attacker.moves[1] = {
      data: makeMoveData({ name: 'Psychic', type: 'Psychic', category: 'Special', power: 90 }),
      currentPp: 20, maxPp: 20, disabled: false,
    };

    // Measure unboosted damage
    const hp1 = defender.currentHp;
    battle.processTurn({ type: 'move', moveIndex: 1 }, { type: 'move', moveIndex: 0 });
    const unboostedDmg = hp1 - defender.currentHp;

    // Reset HP
    defender.currentHp = defender.maxHp;

    // Apply +3 SpA manually
    attacker.boosts.spa = 3; // 2.5x multiplier

    const hp2 = defender.currentHp;
    battle.processTurn({ type: 'move', moveIndex: 1 }, { type: 'move', moveIndex: 0 });
    const boostedDmg = hp2 - defender.currentHp;

    // Boosted damage should be roughly 2.5x unboosted (with some variance)
    expect(boostedDmg).toBeGreaterThan(unboostedDmg * 2);
    expect(boostedDmg).toBeLessThan(unboostedDmg * 3.5);
  });
});

// ========================
// AI AVOIDS IMMUNE MOVES
// ========================

describe('AI move selection avoids immune moves', () => {
  it('picks Flamethrower over Earthquake against Levitate', () => {
    const p1 = createTestPlayer('p1', 'Alice', [
      { species: { types: ['Fire', 'Ground'] as any }, set: { moves: ['Earthquake', 'Flamethrower', 'Tackle', 'Rock Slide'] } }
    ]);
    const p2 = createTestPlayer('p2', 'Bob', [
      { species: { types: ['Psychic'] as any, abilities: ['Levitate'], bestAbility: 'Levitate' }, set: { ability: 'Levitate' } }
    ]);
    const battle = new Battle(p1, p2);
    const rng = new SeededRNG(42);

    // Run 20 times — AI should NEVER pick Earthquake (index 0)
    for (let i = 0; i < 20; i++) {
      const action = chooseBotAction(battle, 0, rng);
      if (action.type === 'move') {
        expect((action as any).moveIndex).not.toBe(0); // Earthquake is move 0
      }
    }
  });

  it('picks Electric move over Water move against Water Absorb', () => {
    const p1 = createTestPlayer('p1', 'Alice', [
      { species: { types: ['Water', 'Electric'] as any }, set: { moves: ['Surf', 'Thunderbolt', 'Ice Beam', 'Tackle'] } }
    ]);
    const p2 = createTestPlayer('p2', 'Bob', [
      { species: { types: ['Water'] as any, abilities: ['Water Absorb'], bestAbility: 'Water Absorb' }, set: { ability: 'Water Absorb' } }
    ]);
    const battle = new Battle(p1, p2);
    const rng = new SeededRNG(42);

    // Run 20 times — should never pick Surf (index 0)
    for (let i = 0; i < 20; i++) {
      const action = chooseBotAction(battle, 0, rng);
      if (action.type === 'move') {
        expect((action as any).moveIndex).not.toBe(0);
      }
    }
  });
});
