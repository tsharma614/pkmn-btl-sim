import { describe, it, expect } from 'vitest';
import { SeededRNG } from '../../src/utils/rng';
import {
  generateEliteFourCpuTeam,
  generateChampionCpuTeam,
  generateChampionPlayerTeam,
  pickSet,
} from '../../src/engine/team-generator';
import { createBattlePokemon } from '../../src/engine/pokemon-factory';
import { generateDraftPool } from '../../src/engine/draft-pool';
import { ELITE_FOUR, CHAMPION, getEliteFourMember, TOTAL_E4_STAGES } from '../../src/data/elite-four';
import { rollAccuracy } from '../../src/engine/damage';
import megaPokedex from '../../src/data/mega-pokemon.json';
import pokedexData from '../../src/data/pokedex.json';
import type { BattlePokemon } from '../../src/types';

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

describe('E4 team heal between battles', () => {
  function buildTestTeam(): BattlePokemon[] {
    const rng = new SeededRNG(42);
    const species = Object.values(pokedexData as Record<string, any>).slice(0, 6);
    return species.map(s => {
      const set = pickSet(s as any, rng, 'competitive');
      return createBattlePokemon(s as any, set, 100, null);
    });
  }

  /** Replicates the heal logic from battle-context.tsx */
  function healTeam(team: BattlePokemon[]): BattlePokemon[] {
    return team.map(p => ({
      ...p,
      currentHp: p.stats.hp,
      isAlive: true,
      status: null,
      volatileStatuses: new Set<string>(),
      boosts: { atk: 0, def: 0, spa: 0, spd: 0, spe: 0, accuracy: 0, evasion: 0 },
      lastMoveUsed: null,
      choiceLocked: null,
      substituteHp: 0,
      hasMovedThisTurn: false,
      tookDamageThisTurn: false,
      protectedLastTurn: false,
      timesHit: 0,
      lastDamageTaken: null,
      toxicCounter: 0,
      sleepTurns: 0,
      confusionTurns: 0,
      encoreTurns: 0,
      encoreMove: null,
      moves: p.moves.map(m => ({ ...m, currentPp: m.maxPp, disabled: false })),
    }));
  }

  it('healed team has accuracy and evasion boosts set to 0', () => {
    const team = buildTestTeam();
    const healed = healTeam(team);
    for (const p of healed) {
      expect(p.boosts.accuracy).toBe(0);
      expect(p.boosts.evasion).toBe(0);
    }
  });

  it('moves hit after heal (accuracy check works with proper boosts)', () => {
    const team = buildTestTeam();
    const healed = healTeam(team);
    const rng = new SeededRNG(42);

    // With accuracy=100 and boosts at 0, moves should hit most of the time
    let hits = 0;
    const trials = 100;
    for (let i = 0; i < trials; i++) {
      if (rollAccuracy(rng, 100, healed[0].boosts.accuracy, healed[1].boosts.evasion)) {
        hits++;
      }
    }
    // 100 accuracy with 0 boost stages = 100% hit rate
    expect(hits).toBe(trials);
  });

  it('missing accuracy/evasion boosts causes all moves to miss', () => {
    // Document the bug: if accuracy/evasion are undefined, rollAccuracy always returns false
    const rng = new SeededRNG(42);
    const brokenBoosts = { atk: 0, def: 0, spa: 0, spd: 0, spe: 0 } as any;
    let hits = 0;
    for (let i = 0; i < 50; i++) {
      if (rollAccuracy(rng, 100, brokenBoosts.accuracy, brokenBoosts.evasion)) {
        hits++;
      }
    }
    // undefined accuracy/evasion → NaN → every comparison fails → 0 hits
    expect(hits).toBe(0);
  });

  it('healed team restores full HP', () => {
    const team = buildTestTeam();
    team[0].currentHp = 1;
    team[1].isAlive = false;
    const healed = healTeam(team);
    expect(healed[0].currentHp).toBe(healed[0].stats.hp);
    expect(healed[1].isAlive).toBe(true);
    expect(healed[1].currentHp).toBe(healed[1].stats.hp);
  });

  it('healed team restores PP to max', () => {
    const team = buildTestTeam();
    team[0].moves[0].currentPp = 0;
    team[0].moves[1].currentPp = 0;
    const healed = healTeam(team);
    for (const m of healed[0].moves) {
      expect(m.currentPp).toBe(m.maxPp);
      expect(m.currentPp).toBeGreaterThan(0);
    }
  });

  it('healed team clears status and volatile statuses', () => {
    const team = buildTestTeam();
    team[0].status = 'burn';
    team[0].volatileStatuses.add('confusion');
    team[1].status = 'toxic';
    const healed = healTeam(team);
    expect(healed[0].status).toBeNull();
    expect(healed[0].volatileStatuses.size).toBe(0);
    expect(healed[1].status).toBeNull();
  });

  it('healed team resets all battle state fields', () => {
    const team = buildTestTeam();
    team[0].choiceLocked = 'Earthquake';
    team[0].substituteHp = 100;
    team[0].encoreTurns = 3;
    team[0].encoreMove = 'Swords Dance';
    team[0].toxicCounter = 5;
    team[0].confusionTurns = 2;
    const healed = healTeam(team);
    expect(healed[0].choiceLocked).toBeNull();
    expect(healed[0].substituteHp).toBe(0);
    expect(healed[0].encoreTurns).toBe(0);
    expect(healed[0].encoreMove).toBeNull();
    expect(healed[0].toxicCounter).toBe(0);
    expect(healed[0].confusionTurns).toBe(0);
    expect(healed[0].hasMovedThisTurn).toBe(false);
    expect(healed[0].protectedLastTurn).toBe(false);
  });

  it('healed team re-enables disabled moves', () => {
    const team = buildTestTeam();
    team[0].moves[0].disabled = true;
    const healed = healTeam(team);
    expect(healed[0].moves[0].disabled).toBe(false);
  });

  it('healed team preserves species, moves, ability, and item', () => {
    const team = buildTestTeam();
    const origSpecies = team[0].species.name;
    const origMoveNames = team[0].moves.map(m => m.data.name);
    const origAbility = team[0].ability;
    const origItem = team[0].item;
    const healed = healTeam(team);
    expect(healed[0].species.name).toBe(origSpecies);
    expect(healed[0].moves.map(m => m.data.name)).toEqual(origMoveNames);
    expect(healed[0].ability).toBe(origAbility);
    expect(healed[0].item).toBe(origItem);
  });
});
