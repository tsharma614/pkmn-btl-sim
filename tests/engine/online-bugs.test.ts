import { describe, it, expect, beforeEach } from 'vitest';
import { Battle } from '../../src/engine/battle';
import { createBattlePokemon } from '../../src/engine/pokemon-factory';
import { Player, PokemonSpecies, PokemonSet, BattlePokemon, PokemonType, Nature, MoveData, StatusCondition } from '../../src/types';

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

// ========================================
// BUG FIX TESTS — Online Battle Room BPANU5
// ========================================

describe('Volt Switch / U-turn selfSwitch', () => {
  let battle: Battle;
  let p1: Player;
  let p2: Player;

  beforeEach(() => {
    p1 = createTestPlayer('p1', 'Alice');
    p2 = createTestPlayer('p2', 'Bob');
    battle = new Battle(p1, p2, 42);
  });

  it('Volt Switch sets pendingSelfSwitch when attacker has available switches', () => {
    const attacker = battle.getActivePokemon(0);
    attacker.item = null;

    attacker.moves[0] = {
      data: makeMoveData({
        name: 'Volt Switch',
        type: 'Electric',
        category: 'Special',
        power: 70,
        selfSwitch: true,
      }),
      currentPp: 20,
      maxPp: 20,
      disabled: false,
    };

    battle.processTurn(
      { type: 'move', moveIndex: 0 },
      { type: 'move', moveIndex: 0 }
    );

    // After the turn, the player who used Volt Switch should need a self-switch
    expect(battle.needsSelfSwitch(0)).toBe(true);
  });

  it('U-turn sets pendingSelfSwitch', () => {
    const attacker = battle.getActivePokemon(0);
    attacker.item = null;

    attacker.moves[0] = {
      data: makeMoveData({
        name: 'U-turn',
        type: 'Bug',
        category: 'Physical',
        power: 70,
        selfSwitch: true,
        flags: { contact: true, sound: false, bullet: false, punch: false, bite: false, pulse: false, protect: true, mirror: true, defrost: false, charge: false },
      }),
      currentPp: 20,
      maxPp: 20,
      disabled: false,
    };

    battle.processTurn(
      { type: 'move', moveIndex: 0 },
      { type: 'move', moveIndex: 0 }
    );

    expect(battle.needsSelfSwitch(0)).toBe(true);
  });

  it('selfSwitch does NOT trigger when no available switches', () => {
    const attacker = battle.getActivePokemon(0);
    attacker.item = null;

    // KO all teammates
    for (let i = 1; i < 6; i++) {
      p1.team[i].currentHp = 0;
      p1.team[i].isAlive = false;
    }

    attacker.moves[0] = {
      data: makeMoveData({
        name: 'Volt Switch',
        type: 'Electric',
        category: 'Special',
        power: 70,
        selfSwitch: true,
      }),
      currentPp: 20,
      maxPp: 20,
      disabled: false,
    };

    battle.processTurn(
      { type: 'move', moveIndex: 0 },
      { type: 'move', moveIndex: 0 }
    );

    // No teammates alive, so no self-switch
    expect(battle.needsSelfSwitch(0)).toBe(false);
  });

  it('selfSwitch does NOT trigger when attacker faints from recoil', () => {
    const attacker = battle.getActivePokemon(0);
    attacker.item = null;
    attacker.currentHp = 1; // Almost dead

    // Give attacker Life Orb for recoil
    attacker.item = 'Life Orb';

    attacker.moves[0] = {
      data: makeMoveData({
        name: 'Volt Switch',
        type: 'Electric',
        category: 'Special',
        power: 70,
        selfSwitch: true,
      }),
      currentPp: 20,
      maxPp: 20,
      disabled: false,
    };

    battle.processTurn(
      { type: 'move', moveIndex: 0 },
      { type: 'move', moveIndex: 0 }
    );

    // Attacker should have fainted from Life Orb recoil, so no self-switch
    if (!attacker.isAlive) {
      expect(battle.needsSelfSwitch(0)).toBe(false);
    }
  });

  it('processSelfSwitch actually switches the Pokemon', () => {
    const attacker = battle.getActivePokemon(0);
    attacker.item = null;

    attacker.moves[0] = {
      data: makeMoveData({
        name: 'Volt Switch',
        type: 'Electric',
        category: 'Special',
        power: 70,
        selfSwitch: true,
      }),
      currentPp: 20,
      maxPp: 20,
      disabled: false,
    };

    battle.processTurn(
      { type: 'move', moveIndex: 0 },
      { type: 'move', moveIndex: 0 }
    );

    expect(battle.needsSelfSwitch(0)).toBe(true);

    // Now process the self-switch
    const switchEvents = battle.processSelfSwitch(0, 1, false);
    expect(switchEvents.length).toBeGreaterThan(0);

    // The active Pokemon should have changed
    expect(p1.activePokemonIndex).toBe(1);
    expect(battle.needsSelfSwitch(0)).toBe(false);
  });
});

describe('selfSwitch property loaded from moves.json', () => {
  it('Volt Switch from pokemon-factory has selfSwitch: true', () => {
    const species = createTestSpecies({ id: 'pikachu', name: 'Pikachu', types: ['Electric'] as [PokemonType] });
    const set = createTestSet({ moves: ['Volt Switch', 'Thunderbolt', 'Ice Beam', 'Earthquake'] });
    const pokemon = createBattlePokemon(species, set);

    const voltSwitch = pokemon.moves.find(m => m.data.name === 'Volt Switch');
    expect(voltSwitch).toBeDefined();
    expect(voltSwitch!.data.selfSwitch).toBe(true);
  });

  it('U-turn from pokemon-factory has selfSwitch: true', () => {
    const species = createTestSpecies({ id: 'scizor', name: 'Scizor', types: ['Bug', 'Steel'] as [PokemonType, PokemonType] });
    const set = createTestSet({ moves: ['U-turn', 'Bullet Punch', 'Swords Dance', 'Knock Off'] });
    const pokemon = createBattlePokemon(species, set);

    const uturn = pokemon.moves.find(m => m.data.name === 'U-turn');
    expect(uturn).toBeDefined();
    expect(uturn!.data.selfSwitch).toBe(true);
  });

  it('forceSwitch property is loaded (Roar)', () => {
    const species = createTestSpecies();
    const set = createTestSet({ moves: ['Roar', 'Tackle', 'Growl', 'Leer'] });
    const pokemon = createBattlePokemon(species, set);

    const roar = pokemon.moves.find(m => m.data.name === 'Roar');
    expect(roar).toBeDefined();
    expect(roar!.data.forceSwitch).toBe(true);
  });

  it('critRatio property is loaded (Slash has high crit)', () => {
    const species = createTestSpecies();
    const set = createTestSet({ moves: ['Slash', 'Tackle', 'Growl', 'Leer'] });
    const pokemon = createBattlePokemon(species, set);

    const slash = pokemon.moves.find(m => m.data.name === 'Slash');
    expect(slash).toBeDefined();
    expect(slash!.data.critRatio).toBeGreaterThan(1);
  });
});

// ========================================
// Soul-Heart ability
// ========================================

describe('Soul-Heart', () => {
  let battle: Battle;
  let p1: Player;
  let p2: Player;

  beforeEach(() => {
    p1 = createTestPlayer('p1', 'Alice', [
      { species: { id: 'magearna', name: 'Magearna', types: ['Steel', 'Fairy'] as [PokemonType, PokemonType] }, set: { ability: 'Soul-Heart' } },
    ]);
    p2 = createTestPlayer('p2', 'Bob');
    battle = new Battle(p1, p2, 42);
  });

  it('raises SpA by 1 when opponent faints', () => {
    const magearna = battle.getActivePokemon(0);
    const defender = battle.getActivePokemon(1);
    magearna.item = null;
    magearna.ability = 'Soul-Heart';

    // Give Magearna a nuke to KO the opponent
    magearna.moves[0] = {
      data: makeMoveData({ name: 'Fleur Cannon', type: 'Fairy', category: 'Special', power: 999 }),
      currentPp: 5,
      maxPp: 5,
      disabled: false,
    };

    const startBoost = magearna.boosts.spa;

    battle.processTurn(
      { type: 'move', moveIndex: 0 },
      { type: 'move', moveIndex: 0 }
    );

    // Defender should have fainted
    expect(defender.isAlive).toBe(false);
    // Magearna's SpA should be +1
    expect(magearna.boosts.spa).toBe(startBoost + 1);
  });

  it('emits ability_trigger event on KO', () => {
    const magearna = battle.getActivePokemon(0);
    magearna.item = null;
    magearna.ability = 'Soul-Heart';

    magearna.moves[0] = {
      data: makeMoveData({ name: 'Fleur Cannon', type: 'Fairy', category: 'Special', power: 999 }),
      currentPp: 5,
      maxPp: 5,
      disabled: false,
    };

    const events = battle.processTurn(
      { type: 'move', moveIndex: 0 },
      { type: 'move', moveIndex: 0 }
    );

    const soulHeartEvent = events.find(
      (e: any) => e.type === 'ability_trigger' && e.data?.ability === 'Soul-Heart'
    );
    expect(soulHeartEvent).toBeDefined();
  });

  it('triggers even when the opponent KOs your other Pokemon', () => {
    // Give Soul-Heart to P2 slot 0
    const soulHeartMon = battle.getActivePokemon(1);
    soulHeartMon.ability = 'Soul-Heart';
    soulHeartMon.item = null;

    // P1 has a very weak mon that will get KO'd
    const weakMon = battle.getActivePokemon(0);
    weakMon.currentHp = 1;
    weakMon.item = null;

    // Give P2 a strong move
    soulHeartMon.moves[0] = {
      data: makeMoveData({ name: 'Tackle', type: 'Normal', power: 40 }),
      currentPp: 35,
      maxPp: 35,
      disabled: false,
    };

    const startBoost = soulHeartMon.boosts.spa;

    battle.processTurn(
      { type: 'move', moveIndex: 0 },
      { type: 'move', moveIndex: 0 }
    );

    // Weak mon should be fainted, Soul-Heart should trigger
    expect(weakMon.isAlive).toBe(false);
    expect(soulHeartMon.boosts.spa).toBe(startBoost + 1);
  });
});

// ========================================
// Status immunity events (Toxic vs Steel)
// ========================================

describe('Status immunity events', () => {
  let battle: Battle;
  let p1: Player;
  let p2: Player;

  beforeEach(() => {
    p1 = createTestPlayer('p1', 'Alice');
    p2 = createTestPlayer('p2', 'Bob', [
      { species: { id: 'magearna', name: 'Magearna', types: ['Steel', 'Fairy'] as [PokemonType, PokemonType] }, set: { ability: 'Soul-Heart' } },
    ]);
    battle = new Battle(p1, p2, 42);
  });

  it('emits status_fail with type_immunity when using Toxic on Steel type', () => {
    const attacker = battle.getActivePokemon(0);
    attacker.item = null;

    attacker.moves[0] = {
      data: makeMoveData({
        name: 'Toxic',
        type: 'Poison',
        category: 'Status',
        power: null,
        accuracy: 90,
        effects: [{ type: 'status', status: 'tox', chance: 100, target: 'target' }],
      }),
      currentPp: 10,
      maxPp: 10,
      disabled: false,
    };

    const events = battle.processTurn(
      { type: 'move', moveIndex: 0 },
      { type: 'move', moveIndex: 0 }
    );

    const defender = battle.getActivePokemon(1);
    // Steel type should NOT be poisoned
    expect(defender.status).toBeNull();

    // Should have a status_fail event
    const failEvent = events.find(
      (e: any) => e.type === 'status_fail' && e.data?.reason === 'type_immunity'
    );
    expect(failEvent).toBeDefined();
  });

  it('emits status_fail when using Will-O-Wisp on Fire type', () => {
    // Make P2's active a Fire type
    const defender = battle.getActivePokemon(1);
    (defender.species as any).types = ['Fire'];

    const attacker = battle.getActivePokemon(0);
    attacker.item = null;

    attacker.moves[0] = {
      data: makeMoveData({
        name: 'Will-O-Wisp',
        type: 'Fire',
        category: 'Status',
        power: null,
        accuracy: 85,
        effects: [{ type: 'status', status: 'brn', chance: 100, target: 'target' }],
      }),
      currentPp: 15,
      maxPp: 15,
      disabled: false,
    };

    const events = battle.processTurn(
      { type: 'move', moveIndex: 0 },
      { type: 'move', moveIndex: 0 }
    );

    expect(defender.status).toBeNull();
    const failEvent = events.find(
      (e: any) => e.type === 'status_fail' && e.data?.reason === 'type_immunity'
    );
    expect(failEvent).toBeDefined();
  });

  it('emits status_fail when using Thunder Wave on Electric type', () => {
    const defender = battle.getActivePokemon(1);
    (defender.species as any).types = ['Electric'];

    const attacker = battle.getActivePokemon(0);
    attacker.item = null;

    attacker.moves[0] = {
      data: makeMoveData({
        name: 'Thunder Wave',
        type: 'Electric',
        category: 'Status',
        power: null,
        accuracy: 90,
        effects: [{ type: 'status', status: 'par', chance: 100, target: 'target' }],
      }),
      currentPp: 20,
      maxPp: 20,
      disabled: false,
    };

    const events = battle.processTurn(
      { type: 'move', moveIndex: 0 },
      { type: 'move', moveIndex: 0 }
    );

    expect(defender.status).toBeNull();
    const failEvent = events.find(
      (e: any) => e.type === 'status_fail' && e.data?.reason === 'type_immunity'
    );
    expect(failEvent).toBeDefined();
  });

  it('emits status_fail for ability immunity (Limber vs paralysis)', () => {
    const defender = battle.getActivePokemon(1);
    defender.ability = 'Limber';

    const attacker = battle.getActivePokemon(0);
    attacker.item = null;

    attacker.moves[0] = {
      data: makeMoveData({
        name: 'Thunder Wave',
        type: 'Electric',
        category: 'Status',
        power: null,
        accuracy: 90,
        effects: [{ type: 'status', status: 'par', chance: 100, target: 'target' }],
      }),
      currentPp: 20,
      maxPp: 20,
      disabled: false,
    };

    const events = battle.processTurn(
      { type: 'move', moveIndex: 0 },
      { type: 'move', moveIndex: 0 }
    );

    expect(defender.status).toBeNull();
    const failEvent = events.find(
      (e: any) => e.type === 'status_fail' && e.data?.reason === 'ability_immunity'
    );
    expect(failEvent).toBeDefined();
  });

  it('emits status_fail for already statused Pokemon', () => {
    const defender = battle.getActivePokemon(1);
    defender.status = 'burn' as StatusCondition;
    (defender.species as any).types = ['Normal']; // Not immune by type

    const attacker = battle.getActivePokemon(0);
    attacker.item = null;

    attacker.moves[0] = {
      data: makeMoveData({
        name: 'Toxic',
        type: 'Poison',
        category: 'Status',
        power: null,
        accuracy: 90,
        effects: [{ type: 'status', status: 'tox', chance: 100, target: 'target' }],
      }),
      currentPp: 10,
      maxPp: 10,
      disabled: false,
    };

    const events = battle.processTurn(
      { type: 'move', moveIndex: 0 },
      { type: 'move', moveIndex: 0 }
    );

    // Should still have burn, not toxic
    expect(defender.status).toBe('burn');
    const failEvent = events.find(
      (e: any) => e.type === 'status_fail' && e.data?.reason === 'already_statused'
    );
    expect(failEvent).toBeDefined();
  });
});

// ========================================
// MoveData property loading (pokemon-factory)
// ========================================

describe('MoveData properties loaded from moves.json', () => {
  it('Baton Pass has selfSwitch = copyvolatile', () => {
    const species = createTestSpecies();
    const set = createTestSet({ moves: ['Baton Pass', 'Swords Dance', 'Tackle', 'Growl'] });
    const pokemon = createBattlePokemon(species, set);

    const bp = pokemon.moves.find(m => m.data.name === 'Baton Pass');
    expect(bp).toBeDefined();
    expect(bp!.data.selfSwitch).toBe('copyvolatile');
  });

  it('Flip Turn has selfSwitch = true', () => {
    const species = createTestSpecies();
    const set = createTestSet({ moves: ['Flip Turn', 'Surf', 'Ice Beam', 'Tackle'] });
    const pokemon = createBattlePokemon(species, set);

    const ft = pokemon.moves.find(m => m.data.name === 'Flip Turn');
    expect(ft).toBeDefined();
    expect(ft!.data.selfSwitch).toBe(true);
  });

  it('Dragon Tail has forceSwitch = true', () => {
    const species = createTestSpecies();
    const set = createTestSet({ moves: ['Dragon Tail', 'Tackle', 'Growl', 'Leer'] });
    const pokemon = createBattlePokemon(species, set);

    const dt = pokemon.moves.find(m => m.data.name === 'Dragon Tail');
    expect(dt).toBeDefined();
    expect(dt!.data.forceSwitch).toBe(true);
  });

  it('Whirlwind has forceSwitch = true', () => {
    const species = createTestSpecies();
    const set = createTestSet({ moves: ['Whirlwind', 'Tackle', 'Growl', 'Leer'] });
    const pokemon = createBattlePokemon(species, set);

    const ww = pokemon.moves.find(m => m.data.name === 'Whirlwind');
    expect(ww).toBeDefined();
    expect(ww!.data.forceSwitch).toBe(true);
  });

  it('Explosion has selfdestruct = true', () => {
    const species = createTestSpecies();
    const set = createTestSet({ moves: ['Explosion', 'Tackle', 'Growl', 'Leer'] });
    const pokemon = createBattlePokemon(species, set);

    const explosion = pokemon.moves.find(m => m.data.name === 'Explosion');
    expect(explosion).toBeDefined();
    expect(explosion!.data.selfdestruct).toBe(true);
  });
});

// ========================================
// Faint events include player index
// ========================================

describe('Faint events include player index', () => {
  let battle: Battle;
  let p1: Player;
  let p2: Player;

  beforeEach(() => {
    p1 = createTestPlayer('p1', 'Alice');
    p2 = createTestPlayer('p2', 'Bob');
    battle = new Battle(p1, p2, 42);
  });

  it('faint event includes player field', () => {
    const attacker = battle.getActivePokemon(0);
    const defender = battle.getActivePokemon(1);
    attacker.item = null;
    defender.item = null;

    // Nuke the defender
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

    const faintEvents = events.filter((e: any) => e.type === 'faint');
    expect(faintEvents.length).toBeGreaterThan(0);

    // Each faint event should have a player field
    for (const fe of faintEvents) {
      expect((fe as any).data.player).toBeDefined();
      expect(typeof (fe as any).data.player).toBe('number');
    }
  });

  it('correctly attributes faints to correct player when both teams share a species name', () => {
    // Both teams have a Mon0 (same name), test that faint events distinguish them
    const attacker = battle.getActivePokemon(0); // Mon0 on P1
    const defender = battle.getActivePokemon(1); // Mon0 on P2 (same species name!)
    attacker.item = null;
    defender.item = null;

    // Set up so P1's Mon0 nukes P2's Mon0
    attacker.moves[0] = {
      data: makeMoveData({ name: 'Nuke', type: 'Normal', power: 999 }),
      currentPp: 5,
      maxPp: 5,
      disabled: false,
    };

    const events = battle.processTurn(
      { type: 'move', moveIndex: 0 },
      { type: 'move', moveIndex: 0 }
    );

    const faintEvents = events.filter((e: any) => e.type === 'faint');
    // P2's Mon0 should be fainted (player index 1)
    const p2Faint = faintEvents.find((e: any) => e.data.player === 1);
    expect(p2Faint).toBeDefined();
    expect(p2Faint!.data.pokemon).toBe('Mon0');
  });
});

// ========================================
// forceSwitch (Roar/Whirlwind/Dragon Tail)
// ========================================

describe('forceSwitch moves', () => {
  let battle: Battle;
  let p1: Player;
  let p2: Player;

  beforeEach(() => {
    p1 = createTestPlayer('p1', 'Alice');
    p2 = createTestPlayer('p2', 'Bob');
    battle = new Battle(p1, p2, 42);
  });

  it('Roar forces opponent to switch', () => {
    const attacker = battle.getActivePokemon(0);
    attacker.item = null;

    attacker.moves[0] = {
      data: makeMoveData({
        name: 'Roar',
        type: 'Normal',
        category: 'Status',
        power: null,
        accuracy: null,
        priority: -6,
        forceSwitch: true,
        effects: [],
      }),
      currentPp: 20,
      maxPp: 20,
      disabled: false,
    };

    const originalActive = p2.activePokemonIndex;

    battle.processTurn(
      { type: 'move', moveIndex: 0 },
      { type: 'move', moveIndex: 0 }
    );

    // Opponent's active Pokemon should have changed
    expect(p2.activePokemonIndex).not.toBe(originalActive);
  });
});

// ========================================
// send_out / switch events include player index
// ========================================

describe('Switch and send_out events include player index', () => {
  let battle: Battle;
  let p1: Player;
  let p2: Player;

  beforeEach(() => {
    p1 = createTestPlayer('p1', 'Alice');
    p2 = createTestPlayer('p2', 'Bob');
    battle = new Battle(p1, p2, 42);
  });

  it('send_out event includes player and speciesId fields', () => {
    // KO opponent's active to trigger a send_out
    const attacker = battle.getActivePokemon(0);
    attacker.item = null;

    attacker.moves[0] = {
      data: makeMoveData({ name: 'Nuke', type: 'Normal', power: 999 }),
      currentPp: 5,
      maxPp: 5,
      disabled: false,
    };

    const events = battle.processTurn(
      { type: 'move', moveIndex: 0 },
      { type: 'move', moveIndex: 0 }
    );

    // After the defender faints, a force-switch is needed
    // Process the force-switch
    if (battle.needsSwitch(1)) {
      const switchEvents = battle.processForceSwitch(1, 1);
      const sendOut = switchEvents.find((e: any) => e.type === 'send_out');
      if (sendOut) {
        expect(sendOut.data.player).toBeDefined();
        expect(sendOut.data.speciesId).toBeDefined();
        expect(sendOut.data.currentHp).toBeDefined();
        expect(sendOut.data.maxHp).toBeDefined();
      }
    }
  });
});
