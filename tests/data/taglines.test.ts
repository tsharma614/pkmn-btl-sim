import { describe, it, expect } from 'vitest';
import {
  getGauntletTagline,
  getGymTagline,
  getE4Tagline,
  getChampionTagline,
  GAUNTLET_TAGLINES,
  GYM_TAGLINES,
  E4_TAGLINES,
  CHAMPION_TAGLINES,
} from '../../src/data/taglines';

describe('Gauntlet taglines', () => {
  it('has milestone taglines for key battle numbers', () => {
    expect(GAUNTLET_TAGLINES[5]).toBeDefined();
    expect(GAUNTLET_TAGLINES[10]).toBeDefined();
    expect(GAUNTLET_TAGLINES[15]).toBeDefined();
    expect(GAUNTLET_TAGLINES[20]).toBeDefined();
    expect(GAUNTLET_TAGLINES[25]).toBeDefined();
    expect(GAUNTLET_TAGLINES[30]).toBeDefined();
  });

  it('milestone taglines contain profanity', () => {
    expect(GAUNTLET_TAGLINES[10].toLowerCase()).toMatch(/shit|fuck|hell|damn|ass/);
    expect(GAUNTLET_TAGLINES[15].toLowerCase()).toMatch(/shit|fuck|hell|damn|ass/);
    expect(GAUNTLET_TAGLINES[20].toLowerCase()).toMatch(/shit|fuck|hell|damn|ass/);
  });

  it('getGauntletTagline returns exact milestone match', () => {
    expect(getGauntletTagline(10)).toBe(GAUNTLET_TAGLINES[10]);
  });

  it('getGauntletTagline returns generic for non-milestone', () => {
    const tagline = getGauntletTagline(6);
    expect(tagline).toBeTruthy();
    expect(tagline).not.toBe(GAUNTLET_TAGLINES[5]); // not the milestone before
  });

  it('taglines get more surprised the further you go', () => {
    // Later milestones should be longer/more extreme
    expect(GAUNTLET_TAGLINES[30]!.length).toBeGreaterThan(GAUNTLET_TAGLINES[5]!.length);
  });
});

describe('Gym taglines', () => {
  it('has taglines for all 18 types', () => {
    const expectedTypes = [
      'Normal', 'Fire', 'Water', 'Electric', 'Grass', 'Ice',
      'Fighting', 'Poison', 'Ground', 'Flying', 'Psychic',
      'Bug', 'Rock', 'Ghost', 'Dragon', 'Dark', 'Steel', 'Fairy',
    ];
    for (const type of expectedTypes) {
      expect(GYM_TAGLINES[type], `${type} should have taglines`).toBeDefined();
      expect(GYM_TAGLINES[type].length, `${type} should have at least 1 tagline`).toBeGreaterThanOrEqual(1);
    }
  });

  it('gym taglines contain profanity', () => {
    for (const [type, taglines] of Object.entries(GYM_TAGLINES)) {
      const hasProfanity = taglines.some(t =>
        /shit|fuck|hell|damn|ass|bitch/i.test(t)
      );
      expect(hasProfanity, `${type} gym taglines should contain profanity`).toBe(true);
    }
  });

  it('getGymTagline returns a string for each type', () => {
    const rng = { next: () => 0.5 };
    for (const type of Object.keys(GYM_TAGLINES)) {
      const result = getGymTagline(type, rng);
      expect(result).toBeTruthy();
    }
  });
});

describe('E4 taglines', () => {
  it('has multiple E4 taglines', () => {
    expect(E4_TAGLINES.length).toBeGreaterThanOrEqual(3);
  });

  it('getE4Tagline returns a string', () => {
    const rng = { next: () => 0.5 };
    expect(getE4Tagline(rng)).toBeTruthy();
  });
});

describe('Champion taglines', () => {
  it('has multiple champion taglines', () => {
    expect(CHAMPION_TAGLINES.length).toBeGreaterThanOrEqual(2);
  });

  it('champion taglines contain profanity', () => {
    const hasProfanity = CHAMPION_TAGLINES.some(t =>
      /shit|fuck|hell|damn|ass|bitch/i.test(t)
    );
    expect(hasProfanity).toBe(true);
  });

  it('getChampionTagline returns a string', () => {
    const rng = { next: () => 0.5 };
    expect(getChampionTagline(rng)).toBeTruthy();
  });
});
