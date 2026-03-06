import { describe, it, expect } from 'vitest';
import { generateTeam } from '../../src/engine/team-generator';
import { createBattlePokemon } from '../../src/engine/pokemon-factory';
import { SeededRNG } from '../../src/utils/rng';
import { PokemonType, Nature } from '../../src/types';

describe('Team Generator', () => {
  it('generates a team of 6 Pokemon', () => {
    const rng = new SeededRNG(42);
    const team = generateTeam(rng);
    expect(team).toHaveLength(6);
  });

  it('all Pokemon are alive and at full HP', () => {
    const rng = new SeededRNG(42);
    const team = generateTeam(rng);
    for (const pokemon of team) {
      expect(pokemon.isAlive).toBe(true);
      expect(pokemon.currentHp).toBe(pokemon.maxHp);
      expect(pokemon.currentHp).toBeGreaterThan(0);
    }
  });

  it('all Pokemon are level 100', () => {
    const rng = new SeededRNG(42);
    const team = generateTeam(rng);
    for (const pokemon of team) {
      expect(pokemon.level).toBe(100);
    }
  });

  it('all Pokemon have an ability', () => {
    const rng = new SeededRNG(42);
    const team = generateTeam(rng);
    for (const pokemon of team) {
      expect(pokemon.ability).toBeTruthy();
    }
  });

  it('all Pokemon have moves', () => {
    const rng = new SeededRNG(42);
    const team = generateTeam(rng);
    for (const pokemon of team) {
      expect(pokemon.moves.length).toBeGreaterThan(0);
      expect(pokemon.moves.length).toBeLessThanOrEqual(4);
    }
  });

  it('produces deterministic teams with same seed', () => {
    const team1 = generateTeam(new SeededRNG(42));
    const team2 = generateTeam(new SeededRNG(42));

    for (let i = 0; i < 6; i++) {
      expect(team1[i].species.name).toBe(team2[i].species.name);
    }
  });

  it('produces different teams with different seeds', () => {
    const team1 = generateTeam(new SeededRNG(42));
    const team2 = generateTeam(new SeededRNG(99));

    const names1 = team1.map(p => p.species.name).sort();
    const names2 = team2.map(p => p.species.name).sort();
    expect(names1).not.toEqual(names2);
  });

  it('no duplicate Pokemon on a team', () => {
    for (let seed = 0; seed < 20; seed++) {
      const rng = new SeededRNG(seed);
      const team = generateTeam(rng);
      const names = team.map(p => p.species.id);
      const uniqueNames = new Set(names);
      expect(uniqueNames.size).toBe(6);
    }
  });

  it('no more than 2 Pokemon share a type', () => {
    for (let seed = 0; seed < 20; seed++) {
      const rng = new SeededRNG(seed);
      const team = generateTeam(rng);
      const typeCounts: Record<string, number> = {};
      for (const pokemon of team) {
        for (const type of pokemon.species.types) {
          typeCounts[type] = (typeCounts[type] || 0) + 1;
        }
      }
      for (const [type, count] of Object.entries(typeCounts)) {
        expect(count, `Type ${type} appears ${count} times`).toBeLessThanOrEqual(2);
      }
    }
  });

  it('has tier distribution 1-2-2-1', () => {
    const rng = new SeededRNG(42);
    const team = generateTeam(rng);
    const tierCounts = { 1: 0, 2: 0, 3: 0, 4: 0 };
    for (const pokemon of team) {
      tierCounts[pokemon.species.tier as 1 | 2 | 3 | 4]++;
    }
    expect(tierCounts[1]).toBe(1);
    expect(tierCounts[2]).toBe(2);
    expect(tierCounts[3]).toBe(2);
    expect(tierCounts[4]).toBe(1);
  });

  it('casual mode swaps Choice items', () => {
    const rng = new SeededRNG(42);
    const team = generateTeam(rng, { itemMode: 'casual' });
    for (const pokemon of team) {
      expect(pokemon.item).not.toBe('Choice Band');
      expect(pokemon.item).not.toBe('Choice Specs');
      expect(pokemon.item).not.toBe('Choice Scarf');
    }
  });

  it('has at least 1 physical and 1 special attacker', () => {
    for (let seed = 0; seed < 20; seed++) {
      const rng = new SeededRNG(seed);
      const team = generateTeam(rng);
      const hasPhysical = team.some(p => p.species.baseStats.atk >= p.species.baseStats.spa);
      const hasSpecial = team.some(p => p.species.baseStats.spa > p.species.baseStats.atk);
      expect(hasPhysical).toBe(true);
      expect(hasSpecial).toBe(true);
    }
  });

  it('no two Pokemon share the exact same type combination', () => {
    for (let seed = 0; seed < 50; seed++) {
      const rng = new SeededRNG(seed);
      const team = generateTeam(rng);

      const typeKeys = team.map(p => [...p.species.types].sort().join('/'));
      const uniqueKeys = new Set(typeKeys);
      expect(
        uniqueKeys.size,
        `Seed ${seed}: duplicate type combo found in [${typeKeys.join(', ')}]`,
      ).toBe(typeKeys.length);
    }
  });

  it('pure single-type Pokemon can still appear on teams', () => {
    // Over many seeds, at least some teams should have a single-type Pokemon
    let foundSingleType = false;
    for (let seed = 0; seed < 100; seed++) {
      const rng = new SeededRNG(seed);
      const team = generateTeam(rng);
      if (team.some(p => p.species.types.length === 1)) {
        foundSingleType = true;
        break;
      }
    }
    expect(foundSingleType).toBe(true);
  });

  describe('Classic Mode (maxGen = 4)', () => {
    it('only includes Gen 1-4 Pokemon', () => {
      for (let seed = 0; seed < 20; seed++) {
        const rng = new SeededRNG(seed);
        const team = generateTeam(rng, { itemMode: 'competitive', maxGen: 4 });
        for (const pokemon of team) {
          expect(
            pokemon.species.generation,
            `${pokemon.species.name} is Gen ${pokemon.species.generation}`,
          ).toBeLessThanOrEqual(4);
        }
      }
    });

    it('generates a full team of 6', () => {
      const rng = new SeededRNG(42);
      const team = generateTeam(rng, { itemMode: 'competitive', maxGen: 4 });
      expect(team).toHaveLength(6);
    });
  });

  describe('Legendary Mode', () => {
    it('generates a team of 6', () => {
      const rng = new SeededRNG(42);
      const team = generateTeam(rng, { itemMode: 'competitive', legendaryMode: true });
      expect(team).toHaveLength(6);
    });

    it('has mostly Tier 1 Pokemon', () => {
      for (let seed = 0; seed < 10; seed++) {
        const rng = new SeededRNG(seed);
        const team = generateTeam(rng, { itemMode: 'competitive', legendaryMode: true });
        const t1Count = team.filter(p => p.species.tier === 1).length;
        // Should have at least 3 T1 (might be less if T1 pool is small with maxGen)
        expect(t1Count).toBeGreaterThanOrEqual(3);
      }
    });

    it('no duplicate Pokemon on legendary teams', () => {
      for (let seed = 0; seed < 20; seed++) {
        const rng = new SeededRNG(seed);
        const team = generateTeam(rng, { itemMode: 'competitive', legendaryMode: true });
        const ids = team.map(p => p.species.id);
        expect(new Set(ids).size).toBe(6);
      }
    });

    it('has type variety on legendary teams', () => {
      for (let seed = 0; seed < 20; seed++) {
        const rng = new SeededRNG(seed);
        const team = generateTeam(rng, { itemMode: 'competitive', legendaryMode: true });
        const typeCounts: Record<string, number> = {};
        for (const pokemon of team) {
          for (const type of pokemon.species.types) {
            typeCounts[type] = (typeCounts[type] || 0) + 1;
          }
        }
        // In legendary mode, max 3 of same type
        for (const [type, count] of Object.entries(typeCounts)) {
          expect(count, `Type ${type} appears ${count} times`).toBeLessThanOrEqual(3);
        }
      }
    });

    it('no duplicate type combinations on legendary teams', () => {
      for (let seed = 0; seed < 30; seed++) {
        const rng = new SeededRNG(seed);
        const team = generateTeam(rng, { itemMode: 'competitive', legendaryMode: true });
        const typeKeys = team.map(p => [...p.species.types].sort().join('/'));
        const uniqueKeys = new Set(typeKeys);
        expect(
          uniqueKeys.size,
          `Seed ${seed}: duplicate type combo in legendary [${typeKeys.join(', ')}]`,
        ).toBe(typeKeys.length);
      }
    });

    it('combines with classic mode (legendary + Gen 1-4)', () => {
      for (let seed = 0; seed < 10; seed++) {
        const rng = new SeededRNG(seed);
        const team = generateTeam(rng, { itemMode: 'competitive', maxGen: 4, legendaryMode: true });
        expect(team).toHaveLength(6);
        for (const pokemon of team) {
          expect(pokemon.species.generation).toBeLessThanOrEqual(4);
        }
        const t1Count = team.filter(p => p.species.tier === 1).length;
        expect(t1Count).toBeGreaterThanOrEqual(2); // might be fewer T1 in Gen 1-4 only
      }
    });
  });

  describe('Fairy Type Stripping (Classic Mode)', () => {
    it('strips Fairy type from Pokemon when maxGen < 6', () => {
      for (let seed = 0; seed < 30; seed++) {
        const rng = new SeededRNG(seed);
        const team = generateTeam(rng, { itemMode: 'competitive', maxGen: 4 });
        for (const pokemon of team) {
          expect(
            pokemon.species.types,
            `${pokemon.species.name} should not have Fairy type in classic mode`,
          ).not.toContain('Fairy');
        }
      }
    });

    it('does NOT strip Fairy type when maxGen >= 6 or null', () => {
      // Over many seeds with all gens, some teams should have Fairy types
      let foundFairy = false;
      for (let seed = 0; seed < 100 && !foundFairy; seed++) {
        const rng = new SeededRNG(seed);
        const team = generateTeam(rng, { itemMode: 'competitive' });
        if (team.some(p => (p.species.types as string[]).includes('Fairy'))) {
          foundFairy = true;
        }
      }
      expect(foundFairy).toBe(true);
    });

    it('Pokemon with only Fairy type become Normal type in classic mode', () => {
      // This is a defensive test — if a pure Fairy Pokemon ever appears in Gen 1-4,
      // it should become Normal. Currently no pure Fairy Gen 1-4 Pokemon exist,
      // but this validates the fallback logic.
      const fakeSpecies = {
        id: 'testfairy',
        name: 'TestFairy',
        types: ['Fairy'] as string[],
        baseStats: { hp: 100, atk: 100, def: 100, spa: 100, spd: 100, spe: 100 },
        generation: 3,
        tier: 3 as const,
        bestAbility: 'Levitate',
        dexNum: 999,
        abilities: ['Levitate'],
        movePool: [],
        sets: [],
      } as any;
      const fakeSet = {
        moves: [] as string[],
        ability: 'Levitate',
        item: 'Leftovers',
        nature: 'Adamant' as Nature,
        evs: { atk: 252, spe: 252, hp: 4 },
      };
      const pokemon = createBattlePokemon(fakeSpecies, fakeSet, 100, 4);
      expect(pokemon.species.types).toEqual(['Normal']);
    });

    it('dual-type Pokemon with Fairy lose only Fairy in classic mode', () => {
      // Simulates Gardevoir (Psychic/Fairy) in classic mode
      const gardeviorLike = {
        id: 'gardevoir',
        name: 'Gardevoir',
        types: ['Psychic', 'Fairy'] as string[],
        baseStats: { hp: 68, atk: 65, def: 65, spa: 125, spd: 115, spe: 80 },
        generation: 3,
        tier: 2 as const,
        bestAbility: 'Trace',
        dexNum: 282,
        abilities: ['Trace'],
        movePool: [],
        sets: [],
      } as any;
      const set = {
        moves: [] as string[],
        ability: 'Trace',
        item: 'Leftovers',
        nature: 'Modest' as Nature,
        evs: { spa: 252, spe: 252, hp: 4 },
      };
      const pokemon = createBattlePokemon(gardeviorLike, set, 100, 4);
      expect(pokemon.species.types).toEqual(['Psychic']);
    });

    it('does not strip Fairy when maxGen is null', () => {
      const gardeviorLike = {
        id: 'gardevoir',
        name: 'Gardevoir',
        types: ['Psychic', 'Fairy'] as string[],
        baseStats: { hp: 68, atk: 65, def: 65, spa: 125, spd: 115, spe: 80 },
        generation: 3,
        tier: 2 as const,
        bestAbility: 'Trace',
        dexNum: 282,
        abilities: ['Trace'],
        movePool: [],
        sets: [],
      } as any;
      const set = {
        moves: [] as string[],
        ability: 'Trace',
        item: 'Leftovers',
        nature: 'Modest' as Nature,
        evs: { spa: 252, spe: 252, hp: 4 },
      };
      const pokemon = createBattlePokemon(gardeviorLike, set, 100, null);
      expect(pokemon.species.types).toEqual(['Psychic', 'Fairy']);
    });
  });
});
