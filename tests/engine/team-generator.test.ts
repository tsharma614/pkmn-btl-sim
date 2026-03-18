import { describe, it, expect } from 'vitest';
import { generateTeam, pickSet } from '../../src/engine/team-generator';
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

  it('all Pokemon have exactly 4 moves (except Ditto/Unown)', () => {
    for (let seed = 0; seed < 50; seed++) {
      const rng = new SeededRNG(seed);
      const team = generateTeam(rng);
      for (const pokemon of team) {
        if (pokemon.species.id === 'ditto' || pokemon.species.id === 'unown') continue;
        expect(
          pokemon.moves.length,
          `${pokemon.species.name} (seed ${seed}) has ${pokemon.moves.length} moves`,
        ).toBe(4);
      }
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

  it('casual mode never has Choice items across many seeds', () => {
    for (let seed = 0; seed < 100; seed++) {
      const rng = new SeededRNG(seed);
      const team = generateTeam(rng, { itemMode: 'casual' });
      for (const pokemon of team) {
        expect(
          pokemon.item,
          `${pokemon.species.name} has ${pokemon.item} in casual mode (seed ${seed})`,
        ).not.toMatch(/^Choice/);
      }
    }
  });

  it('casual mode never has Choice items in classic + legendary combos', () => {
    const configs = [
      { itemMode: 'casual' as const, maxGen: 4 },
      { itemMode: 'casual' as const, legendaryMode: true },
      { itemMode: 'casual' as const, maxGen: 4, legendaryMode: true },
    ];
    for (const config of configs) {
      for (let seed = 0; seed < 50; seed++) {
        const rng = new SeededRNG(seed);
        const team = generateTeam(rng, config);
        for (const pokemon of team) {
          expect(
            pokemon.item,
            `${pokemon.species.name} has ${pokemon.item} in casual mode (seed ${seed}, config ${JSON.stringify(config)})`,
          ).not.toMatch(/^Choice/);
        }
      }
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

  describe('pickSet — Tera move filtering', () => {
    it('never includes Tera Blast, Tera Shift, or Tera Starstorm', () => {
      const pokedex = require('../../src/data/pokedex.json');
      const TERA_MOVES = ['Tera Blast', 'Tera Shift', 'Tera Starstorm'];
      for (let seed = 0; seed < 30; seed++) {
        const rng = new SeededRNG(seed);
        const team = generateTeam(rng);
        for (const pokemon of team) {
          for (const move of pokemon.moves) {
            expect(
              TERA_MOVES,
              `${pokemon.species.name} has Tera move ${move.data.name}`,
            ).not.toContain(move.data.name);
          }
        }
      }
    });

    it('prefers sets with 4+ moves after Tera filtering', () => {
      // Gyarados: set 1 has 5 non-Tera moves, set 2 has 3 (Tera Blast filtered out)
      const pokedex = require('../../src/data/pokedex.json');
      const gyarados = pokedex['gyarados'];
      expect(gyarados).toBeTruthy();

      for (let seed = 0; seed < 20; seed++) {
        const rng = new SeededRNG(seed);
        const set = pickSet(gyarados, rng, 'competitive');
        expect(
          set.moves.length,
          `Gyarados got ${set.moves.length} moves with seed ${seed}: ${set.moves.join(', ')}`,
        ).toBe(4);
      }
    });

    it('fills from other sets when chosen set has < 4 moves', () => {
      // Create a species where ALL sets have Tera moves, leaving < 4 each
      // but combined they have enough unique moves
      const fakeSpecies = {
        id: 'fakemon',
        name: 'Fakemon',
        types: ['Normal'],
        baseStats: { hp: 100, atk: 100, def: 100, spa: 100, spd: 100, spe: 100 },
        generation: 9,
        tier: 2,
        bestAbility: 'Intimidate',
        abilities: ['Intimidate'],
        movePool: [],
        sets: [
          { moves: ['Tackle', 'Tera Blast', 'Return'], ability: 'Intimidate', item: 'Leftovers', nature: 'Adamant', evs: { atk: 252, spe: 252, hp: 4 } },
          { moves: ['Body Slam', 'Earthquake', 'Tera Blast'], ability: 'Intimidate', item: 'Leftovers', nature: 'Adamant', evs: { atk: 252, spe: 252, hp: 4 } },
        ],
      } as any;

      const rng = new SeededRNG(42);
      const set = pickSet(fakeSpecies, rng, 'competitive');
      // Should pull from both sets to get 4 moves
      expect(set.moves.length).toBe(4);
      expect(set.moves).not.toContain('Tera Blast');
    });

    it('all Pokemon across many seeds have exactly 4 moves (except Ditto/Unown)', () => {
      const pokedex = require('../../src/data/pokedex.json');
      const allSpecies = Object.values(pokedex) as any[];
      const issues: string[] = [];

      for (const species of allSpecies) {
        if (species.id === 'ditto' || species.id === 'unown') continue;
        if (!species.sets || species.sets.length === 0) continue;
        for (let seed = 0; seed < 5; seed++) {
          const rng = new SeededRNG(seed);
          const set = pickSet(species, rng, 'competitive');
          if (set.moves.length < 4) {
            issues.push(`${species.name} (seed ${seed}): ${set.moves.length} moves`);
          }
        }
      }

      expect(issues, `Pokemon with < 4 moves:\n${issues.join('\n')}`).toHaveLength(0);
    });
  });

  describe('Truant + Choice item prevention', () => {
    it('Slaking never gets a Choice item', () => {
      const pokedex = require('../../src/data/pokedex.json');
      const slaking = pokedex['slaking'];
      expect(slaking).toBeTruthy();

      for (let seed = 0; seed < 50; seed++) {
        const rng = new SeededRNG(seed);
        const set = pickSet(slaking, rng, 'competitive');
        expect(
          set.item,
          `Slaking got ${set.item} with seed ${seed}`,
        ).not.toMatch(/^Choice/);
      }
    });

    it('Slaking gets Life Orb instead of its Choice Band set', () => {
      const pokedex = require('../../src/data/pokedex.json');
      const slaking = pokedex['slaking'];

      const rng = new SeededRNG(42);
      const set = pickSet(slaking, rng, 'competitive');
      expect(set.item).toBe('Life Orb');
    });

    it('Truant Pokemon never appear on generated teams with Choice items', () => {
      for (let seed = 0; seed < 100; seed++) {
        const rng = new SeededRNG(seed);
        const team = generateTeam(rng);
        for (const pokemon of team) {
          if (pokemon.ability === 'Truant') {
            expect(
              pokemon.item,
              `${pokemon.species.name} has Truant + ${pokemon.item} (seed ${seed})`,
            ).not.toMatch(/^Choice/);
          }
        }
      }
    });
  });

  describe('Fairy Type Preservation', () => {
    it('preserves Fairy type in classic mode (maxGen < 6)', () => {
      // Fairy type is never stripped — classic mode only restricts to Gen 1-4 Pokemon
      let foundFairy = false;
      for (let seed = 0; seed < 100 && !foundFairy; seed++) {
        const rng = new SeededRNG(seed);
        const team = generateTeam(rng, { itemMode: 'competitive', maxGen: 4 });
        if (team.some(p => (p.species.types as string[]).includes('Fairy'))) {
          foundFairy = true;
        }
      }
      // Some Gen 1-4 Pokemon have Fairy type (e.g. Clefable, Togekiss)
      expect(foundFairy).toBe(true);
    });

    it('preserves Fairy type when maxGen is null', () => {
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

    it('Fairy-type Pokemon keep their Fairy type with maxGen=4', () => {
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
      expect(pokemon.species.types).toEqual(['Psychic', 'Fairy']);
    });
  });
});
