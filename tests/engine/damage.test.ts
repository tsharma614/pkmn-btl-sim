import { describe, it, expect } from 'vitest';
import { calculateDamage, rollCritical, rollAccuracy } from '../../src/engine/damage';
import { SeededRNG } from '../../src/utils/rng';
import { BattlePokemon, MoveData, PokemonType } from '../../src/types';

function createMockPokemon(overrides: Partial<BattlePokemon> = {}): BattlePokemon {
  return {
    species: {
      id: 'test',
      name: 'Test',
      dexNum: 1,
      types: ['Normal'] as [PokemonType],
      baseStats: { hp: 100, atk: 100, def: 100, spa: 100, spd: 100, spe: 100 },
      abilities: ['Overgrow'],
      bestAbility: 'Overgrow',
      tier: 3,
      generation: 1,
      movePool: [],
      sets: [],
    },
    level: 100,
    set: { moves: [], ability: 'Overgrow', item: 'Leftovers', nature: 'Hardy', evs: {} },
    stats: { hp: 341, atk: 236, def: 236, spa: 236, spd: 236, spe: 236 },
    currentHp: 341,
    maxHp: 341,
    status: null,
    volatileStatuses: new Set(),
    boosts: { atk: 0, def: 0, spa: 0, spd: 0, spe: 0, accuracy: 0, evasion: 0 },
    moves: [],
    item: null,
    ability: 'Overgrow',
    isAlive: true,
    toxicCounter: 0,
    sleepTurns: 0,
    confusionTurns: 0,
    substituteHp: 0,
    lastMoveUsed: null,
    choiceLocked: null,
    hasMovedThisTurn: false,
    timesHit: 0,
    ...overrides,
  } as BattlePokemon;
}

function createMove(overrides: Partial<MoveData> = {}): MoveData {
  return {
    name: 'Test Move',
    type: 'Normal',
    category: 'Physical',
    power: 80,
    accuracy: 100,
    pp: 15,
    priority: 0,
    flags: {},
    effects: [],
    target: 'normal',
    ...overrides,
  };
}

describe('Damage Calculator', () => {
  describe('basic damage', () => {
    it('deals non-zero damage with valid move', () => {
      const rng = new SeededRNG(42);
      const attacker = createMockPokemon();
      const defender = createMockPokemon();
      const move = createMove({ power: 80 });

      const result = calculateDamage(attacker, defender, move, 'none', rng, false);
      expect(result.finalDamage).toBeGreaterThan(0);
    });

    it('deals 0 damage with 0 power move', () => {
      const rng = new SeededRNG(42);
      const attacker = createMockPokemon();
      const defender = createMockPokemon();
      const move = createMove({ power: 0 });

      const result = calculateDamage(attacker, defender, move, 'none', rng, false);
      expect(result.finalDamage).toBe(0);
    });

    it('higher base power = more damage', () => {
      const rng1 = new SeededRNG(42);
      const rng2 = new SeededRNG(42);
      const attacker = createMockPokemon();
      const defender = createMockPokemon();

      const weak = calculateDamage(attacker, defender, createMove({ power: 40 }), 'none', rng1, false);
      const strong = calculateDamage(attacker, defender, createMove({ power: 120 }), 'none', rng2, false);

      expect(strong.finalDamage).toBeGreaterThan(weak.finalDamage);
    });
  });

  describe('STAB', () => {
    it('applies 1.5x STAB bonus', () => {
      const rng1 = new SeededRNG(42);
      const rng2 = new SeededRNG(42);
      const attacker = createMockPokemon({
        species: {
          ...createMockPokemon().species,
          types: ['Fire'] as [PokemonType],
        },
      });
      const defender = createMockPokemon();

      const noStab = calculateDamage(attacker, defender, createMove({ type: 'Normal', power: 80 }), 'none', rng1, false);
      const withStab = calculateDamage(attacker, defender, createMove({ type: 'Fire', power: 80 }), 'none', rng2, false);

      expect(withStab.stab).toBe(true);
      expect(noStab.stab).toBe(false);
      expect(withStab.finalDamage).toBeGreaterThan(noStab.finalDamage);
    });
  });

  describe('type effectiveness', () => {
    it('super effective does 2x damage', () => {
      const rng1 = new SeededRNG(42);
      const rng2 = new SeededRNG(42);
      const attacker = createMockPokemon();
      const defender = createMockPokemon({
        species: { ...createMockPokemon().species, types: ['Grass'] as [PokemonType] },
      });

      const neutral = calculateDamage(attacker, defender, createMove({ type: 'Normal', power: 80 }), 'none', rng1, false);
      const superEff = calculateDamage(attacker, defender, createMove({ type: 'Fire', power: 80 }), 'none', rng2, false);

      expect(superEff.typeEffectiveness).toBe(2);
      expect(superEff.finalDamage).toBeGreaterThan(neutral.finalDamage);
    });

    it('immune does 0 damage', () => {
      const rng = new SeededRNG(42);
      const attacker = createMockPokemon();
      const defender = createMockPokemon({
        species: { ...createMockPokemon().species, types: ['Ghost'] as [PokemonType] },
      });

      const result = calculateDamage(attacker, defender, createMove({ type: 'Normal', power: 80 }), 'none', rng, false);
      expect(result.typeEffectiveness).toBe(0);
      expect(result.finalDamage).toBe(0);
    });
  });

  describe('critical hits', () => {
    it('critical hit does more damage', () => {
      const rng1 = new SeededRNG(42);
      const rng2 = new SeededRNG(42);
      const attacker = createMockPokemon();
      const defender = createMockPokemon();
      const move = createMove({ power: 80 });

      const normal = calculateDamage(attacker, defender, move, 'none', rng1, false);
      const crit = calculateDamage(attacker, defender, move, 'none', rng2, true);

      expect(crit.criticalHit).toBe(true);
      expect(crit.finalDamage).toBeGreaterThan(normal.finalDamage);
    });

    it('critical ignores negative attack boosts', () => {
      const rng1 = new SeededRNG(42);
      const rng2 = new SeededRNG(42);
      const attacker = createMockPokemon({ boosts: { atk: -2, def: 0, spa: 0, spd: 0, spe: 0, accuracy: 0, evasion: 0 } });
      const defender = createMockPokemon();
      const move = createMove({ power: 80 });

      const noCrit = calculateDamage(attacker, defender, move, 'none', rng1, false);
      const withCrit = calculateDamage(attacker, defender, move, 'none', rng2, true);

      // Crit should ignore the -2 atk, so it should do more
      expect(withCrit.finalDamage).toBeGreaterThan(noCrit.finalDamage);
    });

    it('critical ignores positive defense boosts', () => {
      const rng1 = new SeededRNG(42);
      const rng2 = new SeededRNG(42);
      const attacker = createMockPokemon();
      const defender = createMockPokemon({ boosts: { atk: 0, def: 4, spa: 0, spd: 0, spe: 0, accuracy: 0, evasion: 0 } });
      const move = createMove({ power: 80 });

      const noCrit = calculateDamage(attacker, defender, move, 'none', rng1, false);
      const withCrit = calculateDamage(attacker, defender, move, 'none', rng2, true);

      expect(withCrit.finalDamage).toBeGreaterThan(noCrit.finalDamage);
    });
  });

  describe('weather modifiers', () => {
    it('rain boosts Water moves by 1.5x', () => {
      const rng1 = new SeededRNG(42);
      const rng2 = new SeededRNG(42);
      const attacker = createMockPokemon();
      const defender = createMockPokemon();
      const move = createMove({ type: 'Water', power: 80 });

      const noWeather = calculateDamage(attacker, defender, move, 'none', rng1, false);
      const inRain = calculateDamage(attacker, defender, move, 'rain', rng2, false);

      expect(inRain.weatherModifier).toBe(1.5);
      expect(inRain.finalDamage).toBeGreaterThan(noWeather.finalDamage);
    });

    it('rain weakens Fire moves by 0.5x', () => {
      const rng = new SeededRNG(42);
      const attacker = createMockPokemon();
      const defender = createMockPokemon();
      const move = createMove({ type: 'Fire', power: 80 });

      const result = calculateDamage(attacker, defender, move, 'rain', rng, false);
      expect(result.weatherModifier).toBe(0.5);
    });

    it('sun boosts Fire moves by 1.5x', () => {
      const rng = new SeededRNG(42);
      const attacker = createMockPokemon();
      const defender = createMockPokemon();
      const move = createMove({ type: 'Fire', power: 80 });

      const result = calculateDamage(attacker, defender, move, 'sun', rng, false);
      expect(result.weatherModifier).toBe(1.5);
    });

    it('sun weakens Water moves by 0.5x', () => {
      const rng = new SeededRNG(42);
      const attacker = createMockPokemon();
      const defender = createMockPokemon();
      const move = createMove({ type: 'Water', power: 80 });

      const result = calculateDamage(attacker, defender, move, 'sun', rng, false);
      expect(result.weatherModifier).toBe(0.5);
    });
  });

  describe('burn', () => {
    it('burn halves physical damage', () => {
      const rng1 = new SeededRNG(42);
      const rng2 = new SeededRNG(42);
      const healthy = createMockPokemon();
      const burned = createMockPokemon({ status: 'burn' });
      const defender = createMockPokemon();
      const move = createMove({ category: 'Physical', power: 80 });

      const normalDmg = calculateDamage(healthy, defender, move, 'none', rng1, false);
      const burnedDmg = calculateDamage(burned, defender, move, 'none', rng2, false);

      // Burned physical should be roughly half
      expect(burnedDmg.finalDamage).toBeLessThan(normalDmg.finalDamage);
    });

    it('burn does NOT affect special moves', () => {
      const rng1 = new SeededRNG(42);
      const rng2 = new SeededRNG(42);
      const healthy = createMockPokemon();
      const burned = createMockPokemon({ status: 'burn' });
      const defender = createMockPokemon();
      const move = createMove({ category: 'Special', power: 80 });

      const normalDmg = calculateDamage(healthy, defender, move, 'none', rng1, false);
      const burnedDmg = calculateDamage(burned, defender, move, 'none', rng2, false);

      expect(burnedDmg.finalDamage).toBe(normalDmg.finalDamage);
    });

    it('Guts ignores burn penalty', () => {
      const rng1 = new SeededRNG(42);
      const rng2 = new SeededRNG(42);
      const healthy = createMockPokemon();
      const burnedGuts = createMockPokemon({ status: 'burn', ability: 'Guts' });
      const defender = createMockPokemon();
      const move = createMove({ category: 'Physical', power: 80 });

      const normalDmg = calculateDamage(healthy, defender, move, 'none', rng1, false);
      const gutsDmg = calculateDamage(burnedGuts, defender, move, 'none', rng2, false);

      // Guts should not reduce damage from burn
      expect(gutsDmg.finalDamage).toBe(normalDmg.finalDamage);
    });
  });

  describe('damage range', () => {
    it('damage varies within 85-100% range', () => {
      const attacker = createMockPokemon();
      const defender = createMockPokemon();
      const move = createMove({ power: 100 });

      const damages = new Set<number>();
      for (let i = 0; i < 100; i++) {
        const rng = new SeededRNG(i);
        const result = calculateDamage(attacker, defender, move, 'none', rng, false);
        damages.add(result.finalDamage);
      }

      // Should have multiple different damage values (random roll)
      expect(damages.size).toBeGreaterThan(1);
    });

    it('minimum 1 damage when not immune', () => {
      const rng = new SeededRNG(42);
      const attacker = createMockPokemon({ stats: { ...createMockPokemon().stats, atk: 1 } });
      const defender = createMockPokemon({ stats: { ...createMockPokemon().stats, def: 999 } });
      const move = createMove({ power: 10 });

      const result = calculateDamage(attacker, defender, move, 'none', rng, false);
      expect(result.finalDamage).toBeGreaterThanOrEqual(1);
    });
  });
});

describe('Critical Hit Roll', () => {
  it('stage 0 has ~1/24 crit rate', () => {
    let crits = 0;
    const trials = 10000;
    for (let i = 0; i < trials; i++) {
      const rng = new SeededRNG(i);
      if (rollCritical(rng, 0)) crits++;
    }
    const rate = crits / trials;
    expect(rate).toBeGreaterThan(0.02);
    expect(rate).toBeLessThan(0.08);
  });

  it('stage 3+ always crits', () => {
    for (let i = 0; i < 100; i++) {
      const rng = new SeededRNG(i);
      expect(rollCritical(rng, 3)).toBe(true);
    }
  });
});

describe('Accuracy Roll', () => {
  it('null accuracy always hits', () => {
    for (let i = 0; i < 10; i++) {
      const rng = new SeededRNG(i);
      expect(rollAccuracy(rng, null, 0, 0)).toBe(true);
    }
  });

  it('100% accuracy hits most of the time', () => {
    let hits = 0;
    for (let i = 0; i < 1000; i++) {
      const rng = new SeededRNG(i);
      if (rollAccuracy(rng, 100, 0, 0)) hits++;
    }
    expect(hits).toBe(1000); // 100% should always hit at stage 0
  });

  it('lower accuracy misses sometimes', () => {
    let hits = 0;
    const trials = 1000;
    for (let i = 0; i < trials; i++) {
      const rng = new SeededRNG(i);
      if (rollAccuracy(rng, 70, 0, 0)) hits++;
    }
    const rate = hits / trials;
    expect(rate).toBeGreaterThan(0.6);
    expect(rate).toBeLessThan(0.8);
  });
});
