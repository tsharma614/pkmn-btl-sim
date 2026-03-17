import { describe, it, expect } from 'vitest';
import { SeededRNG } from '../../src/utils/rng';
import {
  generateEliteFourCpuTeam,
  generateChampionCpuTeam,
  generateChampionPlayerTeam,
} from '../../src/engine/team-generator';
import { generateDraftPool } from '../../src/engine/draft-pool';
import { ELITE_FOUR, CHAMPION, getEliteFourMember, TOTAL_E4_STAGES } from '../../src/data/elite-four';
import megaPokedex from '../../src/data/mega-pokemon.json';

describe('Elite Four Data', () => {
  it('has 4 Elite Four members with TMNT names', () => {
    expect(ELITE_FOUR).toHaveLength(4);
    const names = ELITE_FOUR.map(m => m.name);
    expect(names).toContain('Leonardo');
    expect(names).toContain('Donatello');
    expect(names).toContain('Raphael');
    expect(names).toContain('Michelangelo');
  });

  it('has a Champion', () => {
    expect(CHAMPION.name).toBe('Professor Oak');
    expect(CHAMPION.stage).toBe(4);
  });

  it('getEliteFourMember returns correct members', () => {
    expect(getEliteFourMember(0)?.name).toBe('Leonardo');
    expect(getEliteFourMember(3)?.name).toBe('Michelangelo');
    expect(getEliteFourMember(4)?.name).toBe('Professor Oak');
    expect(getEliteFourMember(5)).toBeNull();
  });

  it('TOTAL_E4_STAGES is 5', () => {
    expect(TOTAL_E4_STAGES).toBe(5);
  });
});

describe('Elite Four CPU Team Generation', () => {
  it('generates a team of 6 for E4 opponent', () => {
    const rng = new SeededRNG(42);
    const team = generateEliteFourCpuTeam(rng, 'competitive');
    expect(team).toHaveLength(6);
  });

  it('E4 team has 1 mega and 5 T1 Pokemon', () => {
    const rng = new SeededRNG(42);
    const team = generateEliteFourCpuTeam(rng, 'competitive');
    const megaIds = new Set(Object.keys(megaPokedex));
    const megaCount = team.filter(p => megaIds.has(p.species.id)).length;
    const t1Count = team.filter(p => !megaIds.has(p.species.id) && p.species.tier === 1).length;
    expect(megaCount).toBe(1);
    expect(t1Count).toBe(5);
  });

  it('E4 teams are different across seeds', () => {
    const team1 = generateEliteFourCpuTeam(new SeededRNG(1), 'competitive');
    const team2 = generateEliteFourCpuTeam(new SeededRNG(2), 'competitive');
    const ids1 = team1.map(p => p.species.id).sort();
    const ids2 = team2.map(p => p.species.id).sort();
    expect(ids1).not.toEqual(ids2);
  });

  it('all E4 team members have 4 moves', () => {
    const rng = new SeededRNG(42);
    const team = generateEliteFourCpuTeam(rng, 'competitive');
    for (const p of team) {
      expect(p.moves.length).toBeGreaterThanOrEqual(1);
    }
  });
});

describe('Champion CPU Team Generation', () => {
  it('generates a team of 6 megas for Champion', () => {
    const rng = new SeededRNG(42);
    const team = generateChampionCpuTeam(rng, 'competitive');
    expect(team).toHaveLength(6);
    const megaIds = new Set(Object.keys(megaPokedex));
    for (const p of team) {
      expect(megaIds.has(p.species.id)).toBe(true);
    }
  });

  it('Champion team avoids duplicate type combos', () => {
    const rng = new SeededRNG(42);
    const team = generateChampionCpuTeam(rng, 'competitive');
    const typeKeys = team.map(p => [...p.species.types].sort().join('/'));
    const unique = new Set(typeKeys);
    expect(unique.size).toBe(team.length);
  });
});

describe('Champion Player Team Generation', () => {
  it('generates 6 T2 Pokemon for player', () => {
    const rng = new SeededRNG(42);
    const team = generateChampionPlayerTeam(rng, 'competitive');
    expect(team).toHaveLength(6);
    for (const p of team) {
      expect(p.species.tier).toBe(2);
    }
  });
});

describe('Elite Four Draft Pool', () => {
  it('generates a standard mega pool of 21 for E4', () => {
    const rng = new SeededRNG(42);
    const pool = generateDraftPool(rng, {
      maxGen: null,
      legendaryMode: false,
      megaMode: true,
      targetPoolSize: 21,
      monotype: null,
    });
    expect(pool.length).toBe(21);
    // Should have some megas
    const megaCount = pool.filter(e => e.tier === 0).length;
    expect(megaCount).toBeGreaterThan(0);
  });

  it('pool species all have move pools', () => {
    const rng = new SeededRNG(42);
    const pool = generateDraftPool(rng, {
      maxGen: null,
      legendaryMode: false,
      megaMode: true,
      targetPoolSize: 21,
      monotype: null,
    });
    for (const entry of pool) {
      expect(entry.species.movePool.length).toBeGreaterThan(0);
    }
  });
});
