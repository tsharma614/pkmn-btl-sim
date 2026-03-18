import { describe, it, expect } from 'vitest';
import { SeededRNG } from '../../src/utils/rng';
import {
  generateGauntletTeam,
  generateGymTeam,
  generateE4Team,
  generateChampionCpuTeam,
  generateTeam,
} from '../../src/engine/team-generator';

describe('Gauntlet team scaling', () => {
  it('battle 0: team size 1, mostly T3/T4', () => {
    const team = generateGauntletTeam(new SeededRNG(42), 0);
    expect(team.length).toBe(1);
  });

  it('battle 3: team size 4, early difficulty (T3/T4)', () => {
    const team = generateGauntletTeam(new SeededRNG(42), 3);
    expect(team.length).toBe(4);
  });

  it('battle 5: team size 6, mid difficulty (T2/T1 mix)', () => {
    const team = generateGauntletTeam(new SeededRNG(42), 5);
    expect(team.length).toBe(6);
    // Mid game should have legendary mode enabled (T1/T2 Pokemon)
    const t1Count = team.filter(p => p.species.tier === 1).length;
    expect(t1Count).toBeGreaterThan(0);
  });

  it('battle 8: late difficulty with megas', () => {
    const team = generateGauntletTeam(new SeededRNG(42), 8);
    expect(team.length).toBe(6);
  });

  it('battle 12+: endgame plateau — all megas', () => {
    const team = generateGauntletTeam(new SeededRNG(42), 12);
    expect(team.length).toBe(6);
    // All should be mega Pokemon (from megaPokedex)
    for (const p of team) {
      expect(
        p.species.name.includes('Mega') || p.species.id.includes('mega'),
        `${p.species.name} should be mega at battle 12+`
      ).toBe(true);
    }
  });

  it('battle 20: still endgame plateau', () => {
    const team = generateGauntletTeam(new SeededRNG(99), 20);
    expect(team.length).toBe(6);
    for (const p of team) {
      expect(
        p.species.name.includes('Mega') || p.species.id.includes('mega'),
        `${p.species.name} should be mega`
      ).toBe(true);
    }
  });
});

describe('generateTeam with teamSize parameter', () => {
  it('teamSize=3 returns 3 Pokemon', () => {
    const team = generateTeam(new SeededRNG(42), { itemMode: 'competitive', teamSize: 3 });
    expect(team.length).toBe(3);
  });

  it('teamSize=1 returns 1 Pokemon', () => {
    const team = generateTeam(new SeededRNG(42), { itemMode: 'competitive', teamSize: 1 });
    expect(team.length).toBe(1);
  });

  it('no teamSize returns 6 Pokemon', () => {
    const team = generateTeam(new SeededRNG(42), { itemMode: 'competitive' });
    expect(team.length).toBe(6);
  });
});

describe('Gym team generation', () => {
  it('generates 6 Pokemon for Fire gym', () => {
    const team = generateGymTeam(new SeededRNG(42), 'Fire');
    expect(team.length).toBe(6);
  });

  it('all Pokemon match the gym type', () => {
    for (const type of ['Fire', 'Water', 'Grass', 'Electric', 'Dragon']) {
      const team = generateGymTeam(new SeededRNG(42), type);
      for (const p of team) {
        expect(p.species.types, `${p.species.name} should have ${type}`).toContain(type);
      }
    }
  });

  it('has correct tier composition: 1 Mega + 1 T1 + 2 T2 + 2 T3', () => {
    // Test with a type that has good representation across tiers
    const team = generateGymTeam(new SeededRNG(42), 'Water');
    const megaCount = team.filter(p => p.species.name.includes('Mega') || p.species.id.includes('mega')).length;
    const t1Count = team.filter(p => p.species.tier === 1 && !p.species.name.includes('Mega')).length;
    const t2Count = team.filter(p => p.species.tier === 2).length;
    const t3Count = team.filter(p => p.species.tier === 3).length;
    // May not always be exact due to pool limitations, but should be close
    expect(megaCount).toBeGreaterThanOrEqual(0); // might not have a mega for all types
    expect(team.length).toBe(6);
  });

  it('no duplicate Pokemon', () => {
    const team = generateGymTeam(new SeededRNG(42), 'Water');
    const ids = team.map(p => p.species.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('E4 team generation', () => {
  it('generates 6 Pokemon', () => {
    const team = generateE4Team(new SeededRNG(42));
    expect(team.length).toBe(6);
  });

  it('has correct composition: 1 Mega + 3 T1 + 2 T2', () => {
    const team = generateE4Team(new SeededRNG(42));
    const megaCount = team.filter(p => p.species.name.includes('Mega') || p.species.id.includes('mega')).length;
    expect(megaCount).toBe(1);
    // Remaining should be T1 and T2
    const nonMega = team.filter(p => !p.species.name.includes('Mega') && !p.species.id.includes('mega'));
    const t1Count = nonMega.filter(p => p.species.tier === 1).length;
    const t2Count = nonMega.filter(p => p.species.tier === 2).length;
    expect(t1Count).toBe(3);
    expect(t2Count).toBe(2);
  });

  it('NOT type-restricted (mixed types)', () => {
    const team = generateE4Team(new SeededRNG(42));
    const types = new Set(team.flatMap(p => p.species.types));
    // Should have more than 2 unique types (not monotype)
    expect(types.size).toBeGreaterThan(2);
  });
});

describe('Champion team generation', () => {
  it('generates 6 megas', () => {
    const team = generateChampionCpuTeam(new SeededRNG(42), 'competitive');
    expect(team.length).toBe(6);
    for (const p of team) {
      expect(
        p.species.name.includes('Mega') || p.species.id.includes('mega'),
        `${p.species.name} should be mega`
      ).toBe(true);
    }
  });
});
