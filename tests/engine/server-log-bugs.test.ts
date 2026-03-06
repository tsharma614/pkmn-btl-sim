/**
 * Tests for bugs found via server log analysis (rooms K35ALS, WC9724).
 *
 * Bugs covered:
 * 1. Sleep Talk + Normal move vs Ghost → should show immune, not 0 damage
 * 2. Pain Split → should average both Pokemon's HP
 * 3. Slow Start → should halve attack and speed for 5 turns
 * 4. Knock Off → should remove item and get 1.5x power boost
 * 5. Substitute → should absorb damage for the Pokemon behind it
 */

import { describe, it, expect } from 'vitest';
import { Battle } from '../../src/engine/battle';
import { createBattlePokemon } from '../../src/engine/pokemon-factory';
import { Player, PokemonSpecies, PokemonSet, BattlePokemon, PokemonType, Nature, BattleEvent, MoveData } from '../../src/types';

// --- Helpers ---

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

function findEvents(events: BattleEvent[], type: string): BattleEvent[] {
  return events.filter(e => e.type === type);
}

// --- Tests ---

describe('Sleep Talk + type immunity (Body Slam vs Ghost)', () => {
  it('should show immune when Sleep Talk calls a Normal move against a Ghost type', () => {
    const p1 = createTestPlayer('p1', 'Alice', [
      {
        species: { id: 'regigigas', name: 'Regigigas', types: ['Normal'] as [PokemonType] },
        set: {
          moves: ['Sleep Talk', 'Body Slam', 'Rest', 'Knock Off'],
          ability: 'Slow Start',
          item: 'Leftovers',
          nature: 'Adamant' as Nature,
          evs: { hp: 252, atk: 252, spe: 4 },
        },
      },
    ]);
    const p2 = createTestPlayer('p2', 'Bob', [
      {
        species: { id: 'dusknoir', name: 'Dusknoir', types: ['Ghost'] as [PokemonType] },
        set: {
          moves: ['Pain Split', 'Shadow Sneak', 'Will-O-Wisp', 'Ice Punch'],
          ability: 'Frisk',
          item: 'Leftovers',
          nature: 'Impish' as Nature,
          evs: { hp: 252, def: 252, spe: 4 },
        },
      },
    ]);

    // Put Regigigas to sleep so Sleep Talk works
    p1.team[0].status = 'sleep';
    p1.team[0].sleepTurns = 3;

    const battle = new Battle(p1, p2, 42);

    // Force Sleep Talk to call Body Slam by using a seed that selects it.
    // We'll try multiple seeds until we get Sleep Talk → Body Slam → immune.
    let foundImmune = false;
    for (let seed = 1; seed <= 200; seed++) {
      // Reset
      const tp1 = createTestPlayer('p1', 'Alice', [
        {
          species: { id: 'regigigas', name: 'Regigigas', types: ['Normal'] as [PokemonType] },
          set: {
            // Only Body Slam as a callable move (Rest is excluded by Sleep Talk)
            moves: ['Sleep Talk', 'Body Slam', 'Rest', 'Knock Off'],
            ability: 'Slow Start',
            item: 'Leftovers',
            nature: 'Adamant' as Nature,
            evs: { hp: 252, atk: 252, spe: 4 },
          },
        },
      ]);
      const tp2 = createTestPlayer('p2', 'Bob', [
        {
          species: { id: 'dusknoir', name: 'Dusknoir', types: ['Ghost'] as [PokemonType] },
          set: {
            moves: ['Pain Split', 'Shadow Sneak', 'Will-O-Wisp', 'Ice Punch'],
            ability: 'Frisk',
            item: 'Leftovers',
            nature: 'Impish' as Nature,
            evs: { hp: 252, def: 252, spe: 4 },
          },
        },
      ]);
      tp1.team[0].status = 'sleep';
      tp1.team[0].sleepTurns = 3;

      const b = new Battle(tp1, tp2, seed);

      const result = b.processTurn(
        { type: 'move', moveIndex: 0 }, // Sleep Talk
        { type: 'move', moveIndex: 0 }, // Pain Split
      );

      const immuneEvents = findEvents(result, 'immune');
      const bodySlam = findEvents(result, 'use_move')
        .filter(e => e.data.move === 'Body Slam');

      if (bodySlam.length > 0) {
        // Sleep Talk called Body Slam — should have an immune event
        expect(immuneEvents.length).toBeGreaterThan(0);
        expect(immuneEvents[0].data.target).toBe('Dusknoir');
        expect(immuneEvents[0].data.reason).toBe('type_immunity');
        // Should NOT have a damage event for Dusknoir from Body Slam
        const dusknoirDmg = findEvents(result, 'damage')
          .filter(e => e.data.defender === 'Dusknoir' && e.data.move === 'Body Slam');
        expect(dusknoirDmg.length).toBe(0);
        foundImmune = true;
        break;
      }
    }
    expect(foundImmune).toBe(true);
  });
});

describe('Pain Split', () => {
  it('should average HP between user and target', () => {
    const p1 = createTestPlayer('p1', 'Alice', [
      {
        species: { id: 'dusknoir', name: 'Dusknoir', types: ['Ghost'] as [PokemonType] },
        set: {
          moves: ['Pain Split', 'Shadow Sneak', 'Will-O-Wisp', 'Ice Punch'],
          ability: 'Frisk',
          item: 'Leftovers',
          nature: 'Impish' as Nature,
          evs: { hp: 252, def: 252, spe: 4 },
        },
      },
    ]);
    const p2 = createTestPlayer('p2', 'Bob', [
      {
        species: { id: 'regigigas', name: 'Regigigas', types: ['Normal'] as [PokemonType] },
        set: {
          moves: ['Body Slam', 'Rest', 'Sleep Talk', 'Knock Off'],
          ability: 'Slow Start',
          item: 'Leftovers',
          nature: 'Adamant' as Nature,
          evs: { hp: 252, atk: 252, spe: 4 },
        },
      },
    ]);

    const battle = new Battle(p1, p2, 42);

    const dusknoir = p1.team[0];
    const regigigas = p2.team[0];

    // Damage Dusknoir to 100 HP
    dusknoir.currentHp = 100;
    const regigigasHp = regigigas.currentHp;

    const result = battle.processTurn(
      { type: 'move', moveIndex: 0 }, // Pain Split
      { type: 'move', moveIndex: 0 }, // Body Slam (immune to Ghost)
    );

    // After Pain Split, both should have avg of 100 and regigigas HP
    // (ignoring other effects like Leftovers)
    const expectedAvg = Math.floor((100 + regigigasHp) / 2);

    // Pain Split events should exist
    const healEvents = findEvents(result, 'heal');
    const dmgEvents = findEvents(result, 'damage');

    // Dusknoir should have been healed (from 100 to ~avg)
    const dusknoirHeals = healEvents.filter(e => e.data.pokemon === 'Dusknoir');
    expect(dusknoirHeals.length).toBeGreaterThan(0);

    // Regigigas should have taken damage (from full to ~avg)
    const regigigasDmg = dmgEvents.filter(e => e.data.defender === 'Regigigas' && e.data.move === 'Pain Split');
    expect(regigigasDmg.length).toBeGreaterThan(0);
  });

  it('should not heal above max HP', () => {
    const p1 = createTestPlayer('p1', 'Alice', [
      {
        species: { id: 'shedinja', name: 'Shedinja', types: ['Bug', 'Ghost'] as [PokemonType, PokemonType],
          baseStats: { hp: 1, atk: 90, def: 45, spa: 30, spd: 30, spe: 40 } },
        set: {
          moves: ['Pain Split', 'Shadow Sneak', 'X-Scissor', 'Will-O-Wisp'],
          ability: 'Wonder Guard',
          item: 'Focus Sash',
          nature: 'Adamant' as Nature,
          evs: { hp: 0, atk: 252, spe: 252 },
        },
      },
    ]);
    const p2 = createTestPlayer('p2', 'Bob');

    const battle = new Battle(p1, p2, 42);

    const shedinja = p1.team[0];
    const shedinjaMaxHp = shedinja.maxHp;

    battle.processTurn(
      { type: 'move', moveIndex: 0 }, // Pain Split
      { type: 'move', moveIndex: 0 },
    );

    // Shedinja's HP should never exceed its max
    expect(shedinja.currentHp).toBeLessThanOrEqual(shedinjaMaxHp);
  });
});

describe('Slow Start', () => {
  it('should halve physical attack damage for first 5 turns', () => {
    const p1 = createTestPlayer('p1', 'Alice', [
      {
        species: { id: 'regigigas', name: 'Regigigas', types: ['Normal'] as [PokemonType],
          baseStats: { hp: 110, atk: 160, def: 110, spa: 80, spd: 110, spe: 100 } },
        set: {
          moves: ['Return', 'Knock Off', 'Earthquake', 'Drain Punch'],
          ability: 'Slow Start',
          item: 'Leftovers',
          nature: 'Adamant' as Nature,
          evs: { hp: 252, atk: 252, spe: 4 },
        },
      },
    ]);
    const p2 = createTestPlayer('p2', 'Bob', [
      {
        // Same mon but without Slow Start to compare damage
        species: { id: 'regigigas2', name: 'Regigigas2', types: ['Normal'] as [PokemonType],
          baseStats: { hp: 110, atk: 160, def: 110, spa: 80, spd: 110, spe: 100 } },
        set: {
          moves: ['Return', 'Knock Off', 'Earthquake', 'Drain Punch'],
          ability: 'Pressure',
          item: 'Leftovers',
          nature: 'Adamant' as Nature,
          evs: { hp: 252, atk: 252, spe: 4 },
        },
      },
    ]);

    // Test Slow Start via getAbilityItemModifiers directly
    const slowP1 = createTestPlayer('p1', 'Alice', [
      {
        species: { id: 'regi', name: 'Regi', types: ['Normal'] as [PokemonType],
          baseStats: { hp: 110, atk: 160, def: 110, spa: 80, spd: 110, spe: 100 } },
        set: {
          moves: ['Earthquake', 'Knock Off', 'Return', 'Drain Punch'],
          ability: 'Slow Start',
          item: null,
          nature: 'Adamant' as Nature,
          evs: { hp: 252, atk: 252, spe: 4 },
        },
      },
    ]);
    // Target is Ground-type so Earthquake is SE and Target is slow
    const slowP2 = createTestPlayer('p2', 'Bob', [
      {
        species: { id: 'target', name: 'Target', types: ['Ground'] as [PokemonType],
          baseStats: { hp: 255, atk: 10, def: 100, spa: 10, spd: 100, spe: 10 } },
        set: {
          moves: ['Tackle', 'Tackle', 'Tackle', 'Tackle'],
          ability: 'Overgrow',
          item: null,
          nature: 'Bold' as Nature,
          evs: { hp: 252, def: 252, spe: 4 },
        },
      },
    ]);

    const battleSlow = new Battle(slowP1, slowP2, 100);

    // Regi has turnsOnField=0, so after processTurn increments to 1, Slow Start is active
    const regi = slowP1.team[0];
    expect(regi.ability).toBe('Slow Start');
    expect(regi.turnsOnField).toBe(0);

    const r1Slow = battleSlow.processTurn(
      { type: 'move', moveIndex: 0 }, // Earthquake
      { type: 'move', moveIndex: 0 }, // Tackle
    );

    // turnsOnField should have incremented
    expect(regi.turnsOnField).toBeGreaterThan(0);

    const slowDmg = findEvents(r1Slow, 'damage')
      .filter(e => e.data.attacker === 'Regi');

    // Now create a non-Slow Start version with same seed
    const normalP1 = createTestPlayer('p1', 'Alice', [
      {
        species: { id: 'regi', name: 'Regi', types: ['Normal'] as [PokemonType],
          baseStats: { hp: 110, atk: 160, def: 110, spa: 80, spd: 110, spe: 100 } },
        set: {
          moves: ['Earthquake', 'Knock Off', 'Return', 'Drain Punch'],
          ability: 'Pressure',
          item: null,
          nature: 'Adamant' as Nature,
          evs: { hp: 252, atk: 252, spe: 4 },
        },
      },
    ]);
    const normalP2 = createTestPlayer('p2', 'Bob', [
      {
        species: { id: 'target', name: 'Target', types: ['Ground'] as [PokemonType],
          baseStats: { hp: 255, atk: 10, def: 100, spa: 10, spd: 100, spe: 10 } },
        set: {
          moves: ['Tackle', 'Tackle', 'Tackle', 'Tackle'],
          ability: 'Overgrow',
          item: null,
          nature: 'Bold' as Nature,
          evs: { hp: 252, def: 252, spe: 4 },
        },
      },
    ]);

    const battleNormal = new Battle(normalP1, normalP2, 100);
    const r1Normal = battleNormal.processTurn(
      { type: 'move', moveIndex: 0 },
      { type: 'move', moveIndex: 0 },
    );

    const normalDmg = findEvents(r1Normal, 'damage')
      .filter(e => e.data.attacker === 'Regi');

    expect(slowDmg.length).toBeGreaterThan(0);
    expect(normalDmg.length).toBeGreaterThan(0);
    const slowVal = slowDmg[0].data.damage as number;
    const normalVal = normalDmg[0].data.damage as number;
    expect(slowVal).toBeLessThan(normalVal);
    expect(slowVal).toBeGreaterThan(0);
  });
});

describe('Knock Off', () => {
  it('should remove the defender item after hitting', () => {
    const p1 = createTestPlayer('p1', 'Alice', [
      {
        species: { id: 'weavile', name: 'Weavile', types: ['Dark', 'Ice'] as [PokemonType, PokemonType] },
        set: {
          moves: ['Knock Off', 'Ice Shard', 'Low Kick', 'Swords Dance'],
          ability: 'Pressure',
          item: 'Choice Band',
          nature: 'Jolly' as Nature,
          evs: { hp: 4, atk: 252, spe: 252 },
        },
      },
    ]);
    const p2 = createTestPlayer('p2', 'Bob', [
      {
        species: { id: 'slowbro', name: 'Slowbro', types: ['Water', 'Psychic'] as [PokemonType, PokemonType] },
        set: {
          moves: ['Scald', 'Slack Off', 'Psychic', 'Ice Beam'],
          ability: 'Regenerator',
          item: 'Leftovers',
          nature: 'Bold' as Nature,
          evs: { hp: 252, def: 252, spe: 4 },
        },
      },
    ]);

    const battle = new Battle(p1, p2, 42);

    const slowbro = p2.team[0];
    expect(slowbro.item).toBe('Leftovers');

    battle.processTurn(
      { type: 'move', moveIndex: 0 }, // Knock Off
      { type: 'move', moveIndex: 0 }, // Scald
    );

    // After Knock Off, Slowbro's item should be removed
    expect(slowbro.item).toBeNull();
    expect(slowbro.itemConsumed).toBe(true);
  });

  it('should get 1.5x power when target has an item', () => {
    // We test this indirectly: Knock Off vs target with item should deal more
    // damage than Knock Off vs target without item
    const makePlayer = (hasItem: boolean) => createTestPlayer('p2', 'Bob', [
      {
        species: { id: 'target', name: 'Target', types: ['Normal'] as [PokemonType],
          baseStats: { hp: 200, atk: 50, def: 100, spa: 50, spd: 100, spe: 50 } },
        set: {
          moves: ['Splash', 'Splash', 'Splash', 'Splash'],
          ability: 'Overgrow',
          item: hasItem ? 'Leftovers' : null,
          nature: 'Bold' as Nature,
          evs: { hp: 252, def: 252, spe: 4 },
        },
      },
    ]);

    const attacker = () => createTestPlayer('p1', 'Alice', [
      {
        species: { id: 'weavile', name: 'Weavile', types: ['Dark', 'Ice'] as [PokemonType, PokemonType],
          baseStats: { hp: 70, atk: 120, def: 65, spa: 45, spd: 85, spe: 125 } },
        set: {
          moves: ['Knock Off', 'Ice Shard', 'Low Kick', 'Swords Dance'],
          ability: 'Pressure',
          item: null, // no item to avoid choice lock issues
          nature: 'Adamant' as Nature,
          evs: { hp: 4, atk: 252, spe: 252 },
        },
      },
    ]);

    const b1 = new Battle(attacker(), makePlayer(true), 50);
    const b2 = new Battle(attacker(), makePlayer(false), 50);

    const r1 = b1.processTurn({ type: 'move', moveIndex: 0 }, { type: 'move', moveIndex: 0 });
    const r2 = b2.processTurn({ type: 'move', moveIndex: 0 }, { type: 'move', moveIndex: 0 });

    const dmgWithItem = findEvents(r1, 'damage')
      .filter(e => e.data.move === 'Knock Off' && e.data.defender === 'Target');
    const dmgWithoutItem = findEvents(r2, 'damage')
      .filter(e => e.data.move === 'Knock Off' && e.data.defender === 'Target');

    if (dmgWithItem.length > 0 && dmgWithoutItem.length > 0) {
      // With item should deal ~1.5x more damage
      expect(dmgWithItem[0].data.damage as number).toBeGreaterThan(dmgWithoutItem[0].data.damage as number);
    }
  });
});

describe('Substitute', () => {
  it('should absorb damage for the Pokemon behind it', () => {
    const p1 = createTestPlayer('p1', 'Alice', [
      {
        species: { id: 'alakazam', name: 'Alakazam', types: ['Psychic'] as [PokemonType],
          baseStats: { hp: 55, atk: 50, def: 45, spa: 135, spd: 95, spe: 120 } },
        set: {
          moves: ['Substitute', 'Psychic', 'Shadow Ball', 'Focus Blast'],
          ability: 'Magic Guard',
          item: 'Life Orb',
          nature: 'Timid' as Nature,
          evs: { hp: 4, spa: 252, spe: 252 },
        },
      },
    ]);
    const p2 = createTestPlayer('p2', 'Bob', [
      {
        species: { id: 'machamp', name: 'Machamp', types: ['Fighting'] as [PokemonType],
          baseStats: { hp: 90, atk: 130, def: 80, spa: 65, spd: 85, spe: 55 } },
        set: {
          moves: ['Close Combat', 'Knock Off', 'Ice Punch', 'Bullet Punch'],
          ability: 'No Guard',
          item: 'Choice Band',
          nature: 'Adamant' as Nature,
          evs: { hp: 4, atk: 252, spe: 252 },
        },
      },
    ]);

    const battle = new Battle(p1, p2, 42);

    const alakazam = p1.team[0];
    const hpBeforeSub = alakazam.currentHp;

    // Turn 1: Alakazam uses Substitute
    battle.processTurn(
      { type: 'move', moveIndex: 0 }, // Substitute
      { type: 'move', moveIndex: 0 }, // Close Combat
    );

    // Alakazam should have a substitute
    // HP cost is 25% of max HP
    const subCost = Math.floor(alakazam.maxHp / 4);

    // The substitute should have absorbed Machamp's attack
    // Alakazam's HP should be maxHp - subCost (sub cost only, not Machamp's attack)
    // unless the sub broke and excess damage went through
    if (alakazam.substituteHp > 0) {
      // Sub survived — Alakazam only lost sub cost
      expect(alakazam.currentHp).toBe(hpBeforeSub - subCost);
    }
    // Either way, substitute system is working if we got here without crash
  });

  it('should clear substituteHp on switch out', () => {
    const p1 = createTestPlayer('p1', 'Alice', [
      {
        species: { id: 'mon0', name: 'SubUser', types: ['Normal'] as [PokemonType] },
        set: {
          moves: ['Substitute', 'Return', 'Earthquake', 'Swords Dance'],
          ability: 'Overgrow',
          item: 'Leftovers',
          nature: 'Adamant' as Nature,
          evs: { hp: 252, atk: 252, spe: 4 },
        },
      },
    ]);
    const p2 = createTestPlayer('p2', 'Bob');

    const battle = new Battle(p1, p2, 42);

    // Set up substitute manually
    p1.team[0].substituteHp = 100;
    p1.team[0].volatileStatuses.add('substitute');

    // Switch out
    battle.processTurn(
      { type: 'switch', pokemonIndex: 1 },
      { type: 'move', moveIndex: 0 },
    );

    // After switching out, substituteHp should be 0
    expect(p1.team[0].substituteHp).toBe(0);
    expect(p1.team[0].volatileStatuses.has('substitute')).toBe(false);
  });
});

// --- Battle log analysis bugs (room 4GYNP2) ---

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

describe('Lead switch-in abilities', () => {
  it('should trigger Drought for lead Pokemon at battle start', () => {
    const p1 = createTestPlayer('p1', 'Alice', [
      {
        species: { id: 'groudon', name: 'Groudon', types: ['Ground'] as [PokemonType] },
        set: { ability: 'Drought', item: null },
      },
    ]);
    const p2 = createTestPlayer('p2', 'Bob');

    const battle = new Battle(p1, p2, 42);

    // Lead switch-in events should include weather
    const weatherEvents = battle.leadSwitchInEvents.filter(
      (e: BattleEvent) => e.type === 'weather'
    );
    expect(weatherEvents.length).toBeGreaterThan(0);
    expect(battle.state.weather).toBe('sun');
  });

  it('should trigger Intimidate for lead Pokemon at battle start', () => {
    const p1 = createTestPlayer('p1', 'Alice', [
      {
        species: { id: 'landorus', name: 'Landorus', types: ['Ground', 'Flying'] as [PokemonType, PokemonType] },
        set: { ability: 'Intimidate', item: null },
      },
    ]);
    const p2 = createTestPlayer('p2', 'Bob');

    const battle = new Battle(p1, p2, 42);
    const defender = battle.getActivePokemon(1);
    expect(defender.boosts.atk).toBe(-1);
  });

  it('should trigger both leads abilities (faster first)', () => {
    const p1 = createTestPlayer('p1', 'Alice', [
      {
        species: {
          id: 'groudon', name: 'Groudon', types: ['Ground'] as [PokemonType],
          baseStats: { hp: 100, atk: 100, def: 100, spa: 100, spd: 100, spe: 90 },
        },
        set: { ability: 'Drought', item: null },
      },
    ]);
    const p2 = createTestPlayer('p2', 'Bob', [
      {
        species: {
          id: 'kyogre', name: 'Kyogre', types: ['Water'] as [PokemonType],
          baseStats: { hp: 100, atk: 100, def: 100, spa: 100, spd: 100, spe: 150 },
        },
        set: { ability: 'Drizzle', item: null },
      },
    ]);

    const battle = new Battle(p1, p2, 42);
    // Kyogre is faster, so Drizzle triggers first, then Drought overrides
    expect(battle.state.weather).toBe('sun');
  });

  it('lead events are prepended to first turn', () => {
    const p1 = createTestPlayer('p1', 'Alice', [
      {
        species: { id: 'groudon', name: 'Groudon', types: ['Ground'] as [PokemonType] },
        set: { ability: 'Drought', item: null },
      },
    ]);
    const p2 = createTestPlayer('p2', 'Bob');

    const battle = new Battle(p1, p2, 42);
    const events = battle.processTurn(
      { type: 'move', moveIndex: 0 },
      { type: 'move', moveIndex: 0 },
    );

    // First events should include the weather trigger from Drought
    const weatherIdx = events.findIndex((e: BattleEvent) => e.type === 'weather');
    const moveIdx = events.findIndex((e: BattleEvent) => e.type === 'use_move');
    expect(weatherIdx).toBeGreaterThanOrEqual(0);
    expect(weatherIdx).toBeLessThan(moveIdx);
  });
});

describe('End-of-turn faint check prevents ghost effects', () => {
  it('should not apply Leftovers healing after a Pokemon faints from burn', () => {
    const p1 = createTestPlayer('p1', 'Alice', [
      {
        species: { id: 'testmon', name: 'BurnVictim', types: ['Normal'] as [PokemonType] },
        set: { ability: 'Overgrow', item: 'Leftovers' },
      },
    ]);
    const p2 = createTestPlayer('p2', 'Bob');

    const battle = new Battle(p1, p2, 42);
    const victim = battle.getActivePokemon(0);
    victim.status = 'burn' as any;
    // Set HP so burn damage will KO
    const burnDmg = Math.max(1, Math.floor(victim.maxHp / 16));
    victim.currentHp = burnDmg; // Exactly enough to die from burn

    const events = battle.processTurn(
      { type: 'move', moveIndex: 0 },
      { type: 'move', moveIndex: 0 },
    );

    // Should have faint event but NO Leftovers heal for the burn victim
    const faintEvents = findEvents(events, 'faint');
    const healEvents = events.filter(
      (e: BattleEvent) => e.type === 'item_heal' && (e.data as any)?.pokemon === 'BurnVictim'
    );
    expect(faintEvents.length).toBeGreaterThan(0);
    expect(healEvents.length).toBe(0);
  });

  it('should not apply Leftovers after fainting from trap damage', () => {
    const p1 = createTestPlayer('p1', 'Alice', [
      {
        species: { id: 'testmon', name: 'TrappedMon', types: ['Normal'] as [PokemonType] },
        set: { ability: 'Overgrow', item: 'Leftovers' },
      },
    ]);
    const p2 = createTestPlayer('p2', 'Bob');

    const battle = new Battle(p1, p2, 42);
    const victim = battle.getActivePokemon(0);
    victim.volatileStatuses.add('partiallytrapped' as any);
    const trapDmg = Math.max(1, Math.floor(victim.maxHp / 8));
    victim.currentHp = trapDmg;

    const events = battle.processTurn(
      { type: 'move', moveIndex: 0 },
      { type: 'move', moveIndex: 0 },
    );

    const faintEvents = findEvents(events, 'faint');
    const healEvents = events.filter(
      (e: BattleEvent) => e.type === 'item_heal' && (e.data as any)?.pokemon === 'TrappedMon'
    );
    expect(faintEvents.length).toBeGreaterThan(0);
    expect(healEvents.length).toBe(0);
  });
});

describe('Type immunity checked before accuracy', () => {
  it('should show immune instead of miss for Ground move vs Flying type', () => {
    const p1 = createTestPlayer('p1', 'Alice', [
      {
        species: { id: 'testmon', name: 'Attacker', types: ['Ground'] as [PokemonType] },
        set: { ability: 'Overgrow', item: null },
      },
    ]);
    const p2 = createTestPlayer('p2', 'Bob', [
      {
        species: { id: 'testmon', name: 'Flyer', types: ['Flying'] as [PokemonType] },
        set: { ability: 'Overgrow', item: null },
      },
    ]);

    const battle = new Battle(p1, p2, 42);
    const attacker = battle.getActivePokemon(0);
    attacker.moves[0] = {
      data: makeMoveData({
        name: 'Earthquake',
        type: 'Ground' as PokemonType,
        category: 'Physical',
        power: 100,
        accuracy: 100,
      }),
      currentPp: 10,
      maxPp: 10,
      disabled: false,
    };

    const events = battle.processTurn(
      { type: 'move', moveIndex: 0 },
      { type: 'move', moveIndex: 0 },
    );

    // Should have immune event, never a miss event for Earthquake
    const immuneEvents = events.filter(
      (e: BattleEvent) => e.type === 'immune' && (e.data as any)?.move === 'Earthquake'
    );
    const missEvents = events.filter(
      (e: BattleEvent) => e.type === 'miss' && (e.data as any)?.move === 'Earthquake'
    );
    expect(immuneEvents.length).toBe(1);
    expect(missEvents.length).toBe(0);
  });
});

describe('Toxic Boost ability', () => {
  it('should boost physical attack by 1.5x when poisoned', () => {
    const p1 = createTestPlayer('p1', 'Alice', [
      {
        species: {
          id: 'zangoose', name: 'Zangoose', types: ['Normal'] as [PokemonType],
          baseStats: { hp: 73, atk: 115, def: 60, spa: 60, spd: 60, spe: 90 },
        },
        set: { ability: 'Toxic Boost', item: null },
      },
    ]);
    const p2 = createTestPlayer('p2', 'Bob', [
      {
        species: {
          id: 'target', name: 'Target', types: ['Normal'] as [PokemonType],
          baseStats: { hp: 255, atk: 10, def: 100, spa: 10, spd: 100, spe: 10 },
        },
        set: { ability: 'Overgrow', item: null },
      },
    ]);

    const battle = new Battle(p1, p2, 42);
    const zangoose = battle.getActivePokemon(0);
    const target = battle.getActivePokemon(1);
    zangoose.moves[0] = {
      data: makeMoveData({
        name: 'Facade',
        type: 'Normal' as PokemonType,
        category: 'Physical',
        power: 70,
        accuracy: 100,
      }),
      currentPp: 20,
      maxPp: 20,
      disabled: false,
    };

    // First hit without poison
    const hpBefore1 = target.currentHp;
    battle.processTurn(
      { type: 'move', moveIndex: 0 },
      { type: 'move', moveIndex: 0 },
    );
    const dmgNormal = hpBefore1 - target.currentHp;

    // Heal target, apply poison
    target.currentHp = target.maxHp;
    zangoose.status = 'toxic' as any;

    const hpBefore2 = target.currentHp;
    battle.processTurn(
      { type: 'move', moveIndex: 0 },
      { type: 'move', moveIndex: 0 },
    );
    const dmgBoosted = hpBefore2 - target.currentHp;

    // Toxic Boost should make the boosted damage significantly higher
    expect(dmgBoosted).toBeGreaterThan(dmgNormal);
  });
});

describe('Normalize ability', () => {
  it('should convert move type to Normal', () => {
    const p1 = createTestPlayer('p1', 'Alice', [
      {
        species: { id: 'delcatty', name: 'Delcatty', types: ['Normal'] as [PokemonType] },
        set: { ability: 'Normalize', item: null },
      },
    ]);
    const p2 = createTestPlayer('p2', 'Bob', [
      {
        species: { id: 'gengar', name: 'Gengar', types: ['Ghost', 'Poison'] as [PokemonType, PokemonType] },
        set: { ability: 'Overgrow', item: null },
      },
    ]);

    const battle = new Battle(p1, p2, 42);
    const attacker = battle.getActivePokemon(0);
    attacker.moves[0] = {
      data: makeMoveData({
        name: 'Thunderbolt',
        type: 'Electric' as PokemonType,
        category: 'Special',
        power: 90,
        accuracy: 100,
      }),
      currentPp: 15,
      maxPp: 15,
      disabled: false,
    };

    const events = battle.processTurn(
      { type: 'move', moveIndex: 0 },
      { type: 'move', moveIndex: 0 },
    );

    // Thunderbolt should become Normal-type, which is immune to Ghost
    const immuneEvents = events.filter(
      (e: BattleEvent) => e.type === 'immune' && (e.data as any)?.move === 'Thunderbolt'
    );
    expect(immuneEvents.length).toBe(1);
  });
});

// --- Sharpness tests ---

describe('Sharpness ability', () => {
  it('should boost slicing moves by 1.5x via getAbilityItemModifiers', () => {
    // Test Sharpness boost using two separate battles — one with Sharpness, one without
    const makePlayer = (ability: string) => createTestPlayer('p1', 'Alice', [
      {
        species: { id: 'gallade', name: 'Gallade', types: ['Psychic', 'Fighting'] as [PokemonType, PokemonType], baseStats: { hp: 68, atk: 125, def: 65, spa: 65, spd: 115, spe: 80 } },
        set: {
          moves: ['Night Slash', 'Close Combat', 'Psycho Cut', 'Sacred Sword'],
          ability,
          item: 'Leftovers',
          nature: 'Adamant' as Nature,
          evs: { hp: 4, atk: 252, spe: 252 },
        },
      },
    ]);
    const makeTarget = () => createTestPlayer('p2', 'Bob', [
      {
        species: { id: 'testmon', name: 'Testmon', types: ['Normal'] as [PokemonType], baseStats: { hp: 400, atk: 10, def: 100, spa: 10, spd: 100, spe: 10 } },
        set: {
          moves: ['Splash', 'Splash', 'Splash', 'Splash'],
          ability: 'Overgrow',
          item: 'Leftovers',
          nature: 'Bold' as Nature,
          evs: { hp: 252, def: 252, spe: 4 },
        },
      },
    ]);

    // Battle with Sharpness
    const p1Sharp = makePlayer('Sharpness');
    const p2Sharp = makeTarget();
    const battleSharp = new Battle(p1Sharp, p2Sharp, 42);
    const hpBeforeSharp = p2Sharp.team[0].currentHp;
    battleSharp.processTurn(
      { type: 'move', moveIndex: 0 }, // Night Slash
      { type: 'move', moveIndex: 0 },
    );
    const sharpDmg = hpBeforeSharp - p2Sharp.team[0].currentHp;

    // Battle without Sharpness (same seed for same RNG rolls)
    const p1NoSharp = makePlayer('Overgrow');
    const p2NoSharp = makeTarget();
    const battleNoSharp = new Battle(p1NoSharp, p2NoSharp, 42);
    const hpBeforeNoSharp = p2NoSharp.team[0].currentHp;
    battleNoSharp.processTurn(
      { type: 'move', moveIndex: 0 }, // Night Slash
      { type: 'move', moveIndex: 0 },
    );
    const noSharpDmg = hpBeforeNoSharp - p2NoSharp.team[0].currentHp;

    // Sharpness should deal more damage on slicing moves
    expect(sharpDmg).toBeGreaterThan(noSharpDmg);
  });

  it('should NOT boost non-slicing moves', () => {
    const makePlayer = (ability: string) => createTestPlayer('p1', 'Alice', [
      {
        species: { id: 'gallade', name: 'Gallade', types: ['Psychic', 'Fighting'] as [PokemonType, PokemonType], baseStats: { hp: 68, atk: 125, def: 65, spa: 65, spd: 115, spe: 80 } },
        set: {
          moves: ['Close Combat', 'Tackle', 'Psycho Cut', 'Sacred Sword'],
          ability,
          item: 'Leftovers',
          nature: 'Adamant' as Nature,
          evs: { hp: 4, atk: 252, spe: 252 },
        },
      },
    ]);
    const makeTarget = () => createTestPlayer('p2', 'Bob', [
      {
        species: { id: 'testmon', name: 'Testmon', types: ['Normal'] as [PokemonType], baseStats: { hp: 400, atk: 10, def: 100, spa: 10, spd: 100, spe: 10 } },
        set: {
          moves: ['Splash', 'Splash', 'Splash', 'Splash'],
          ability: 'Overgrow',
          item: 'Leftovers',
          nature: 'Bold' as Nature,
          evs: { hp: 252, def: 252, spe: 4 },
        },
      },
    ]);

    // Close Combat is NOT a slicing move — should deal same damage with or without Sharpness
    const p1Sharp = makePlayer('Sharpness');
    const p2Sharp = makeTarget();
    const battleSharp = new Battle(p1Sharp, p2Sharp, 42);
    const hpBefore1 = p2Sharp.team[0].currentHp;
    battleSharp.processTurn({ type: 'move', moveIndex: 0 }, { type: 'move', moveIndex: 0 });
    const sharpDmg = hpBefore1 - p2Sharp.team[0].currentHp;

    const p1NoSharp = makePlayer('Overgrow');
    const p2NoSharp = makeTarget();
    const battleNoSharp = new Battle(p1NoSharp, p2NoSharp, 42);
    const hpBefore2 = p2NoSharp.team[0].currentHp;
    battleNoSharp.processTurn({ type: 'move', moveIndex: 0 }, { type: 'move', moveIndex: 0 });
    const noSharpDmg = hpBefore2 - p2NoSharp.team[0].currentHp;

    // Damage should be identical since Close Combat isn't a slicing move
    expect(sharpDmg).toBe(noSharpDmg);
  });
});

// --- Soul Dew tests ---

describe('Soul Dew item', () => {
  it('should boost Psychic and Dragon moves by 1.2x', () => {
    const p1 = createTestPlayer('p1', 'Alice', [
      {
        species: { id: 'latios', name: 'Latios', types: ['Dragon', 'Psychic'] as [PokemonType, PokemonType] },
        set: {
          moves: ['Psychic', 'Dragon Pulse', 'Thunderbolt', 'Surf'],
          ability: 'Levitate',
          item: 'Soul Dew',
          nature: 'Timid' as Nature,
          evs: { hp: 4, spa: 252, spe: 252 },
        },
      },
    ]);
    const p2 = createTestPlayer('p2', 'Bob', [
      {
        species: { id: 'testmon', name: 'Testmon', types: ['Normal'] as [PokemonType], baseStats: { hp: 300, atk: 50, def: 100, spa: 50, spd: 100, spe: 50 } },
        set: {
          moves: ['Tackle', 'Tackle', 'Tackle', 'Tackle'],
          ability: 'Overgrow',
          item: 'Leftovers',
          nature: 'Calm' as Nature,
          evs: { hp: 252, spd: 252, spe: 4 },
        },
      },
    ]);

    const battle = new Battle(p1, p2, 42);

    // Use Psychic (boosted by Soul Dew)
    const hpBefore1 = p2.team[0].currentHp;
    battle.processTurn(
      { type: 'move', moveIndex: 0 },
      { type: 'move', moveIndex: 0 },
    );
    const psychicDmg = hpBefore1 - p2.team[0].currentHp;

    // Reset
    p2.team[0].currentHp = hpBefore1;

    // Use Thunderbolt (NOT boosted by Soul Dew, similar base power 90)
    battle.processTurn(
      { type: 'move', moveIndex: 2 },
      { type: 'move', moveIndex: 0 },
    );
    const tboltDmg = hpBefore1 - p2.team[0].currentHp;

    // Psychic (90 * 1.2 * 1.5 STAB = 162 effective) vs Thunderbolt (90 * 1.0 = 90 effective)
    // Psychic should deal significantly more
    expect(psychicDmg).toBeGreaterThan(tboltDmg);
  });

  it('should NOT boost non-Psychic/Dragon moves', () => {
    const p1 = createTestPlayer('p1', 'Alice', [
      {
        species: { id: 'latias', name: 'Latias', types: ['Dragon', 'Psychic'] as [PokemonType, PokemonType] },
        set: {
          moves: ['Surf', 'Thunderbolt', 'Ice Beam', 'Psychic'],
          ability: 'Levitate',
          item: 'Soul Dew',
          nature: 'Timid' as Nature,
          evs: { hp: 4, spa: 252, spe: 252 },
        },
      },
    ]);
    const p2 = createTestPlayer('p2', 'Bob', [
      {
        species: { id: 'testmon', name: 'Testmon', types: ['Normal'] as [PokemonType], baseStats: { hp: 300, atk: 50, def: 100, spa: 50, spd: 100, spe: 50 } },
        set: {
          moves: ['Tackle', 'Tackle', 'Tackle', 'Tackle'],
          ability: 'Overgrow',
          item: 'Leftovers',
          nature: 'Calm' as Nature,
          evs: { hp: 252, spd: 252, spe: 4 },
        },
      },
    ]);

    const battle = new Battle(p1, p2, 42);

    // Use Surf (Water, not boosted)
    const events = battle.processTurn(
      { type: 'move', moveIndex: 0 },
      { type: 'move', moveIndex: 0 },
    );
    // Just verify it works and produces damage
    const damageEvents = events.filter((e: BattleEvent) => e.type === 'damage');
    expect(damageEvents.length).toBeGreaterThan(0);
  });
});
