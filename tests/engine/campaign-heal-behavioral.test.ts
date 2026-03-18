import { describe, it, expect } from 'vitest';
import type { BattlePokemon, BattleMove } from '../../src/types';

/** Simulates the heal logic from battle-context.tsx beginCampaignBattle */
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

function makeDamagedPokemon(): BattlePokemon {
  const moves: BattleMove[] = [
    { name: 'Flamethrower', type: 'Fire', category: 'special', basePower: 90, accuracy: 100, maxPp: 15, currentPp: 3, priority: 0, flags: {}, disabled: true },
    { name: 'Earthquake', type: 'Ground', category: 'physical', basePower: 100, accuracy: 100, maxPp: 10, currentPp: 0, priority: 0, flags: {}, disabled: false },
    { name: 'Protect', type: 'Normal', category: 'status', basePower: 0, accuracy: 100, maxPp: 10, currentPp: 7, priority: 4, flags: {}, disabled: false },
    { name: 'Dragon Dance', type: 'Dragon', category: 'status', basePower: 0, accuracy: 100, maxPp: 20, currentPp: 18, priority: 0, flags: {}, disabled: false },
  ];

  return {
    species: { id: 'charizard', name: 'Charizard', types: ['Fire', 'Flying'], baseStats: { hp: 78, atk: 84, def: 78, spa: 109, spd: 85, spe: 100 }, tier: 2, generation: 1, movePool: [], abilities: ['Blaze'], weight: 90.5 },
    level: 100,
    nature: { name: 'Timid', plus: 'spe', minus: 'atk' },
    ability: 'Blaze',
    item: 'Life Orb',
    stats: { hp: 297, atk: 183, def: 192, spa: 317, spd: 206, spe: 328 },
    evs: { hp: 0, atk: 0, def: 0, spa: 252, spd: 4, spe: 252 },
    moves,
    currentHp: 47, // heavily damaged
    maxHp: 297,
    isAlive: true,
    status: 'burn' as any,
    volatileStatuses: new Set(['confusion', 'leechseed']),
    boosts: { atk: -2, def: 0, spa: 3, spd: 0, spe: -1, accuracy: -1, evasion: 0 },
    lastMoveUsed: 'Flamethrower',
    choiceLocked: 'Flamethrower',
    substituteHp: 50,
    hasMovedThisTurn: true,
    tookDamageThisTurn: true,
    protectedLastTurn: true,
    timesHit: 3,
    lastDamageTaken: 120,
    toxicCounter: 4,
    sleepTurns: 2,
    confusionTurns: 3,
    encoreTurns: 2,
    encoreMove: 'Flamethrower',
  } as any;
}

function makeFaintedPokemon(): BattlePokemon {
  const base = makeDamagedPokemon();
  return {
    ...base,
    currentHp: 0,
    isAlive: false,
  } as any;
}

describe('Campaign heal — behavioral tests', () => {
  it('restores HP to full', () => {
    const team = healTeam([makeDamagedPokemon()]);
    expect(team[0].currentHp).toBe(team[0].stats.hp);
    expect(team[0].currentHp).toBe(297);
  });

  it('revives fainted Pokemon', () => {
    const team = healTeam([makeFaintedPokemon()]);
    expect(team[0].isAlive).toBe(true);
    expect(team[0].currentHp).toBe(297);
  });

  it('clears burn status', () => {
    const team = healTeam([makeDamagedPokemon()]);
    expect(team[0].status).toBeNull();
  });

  it('resets all stat boosts to 0', () => {
    const team = healTeam([makeDamagedPokemon()]);
    const { boosts } = team[0];
    expect(boosts.atk).toBe(0);
    expect(boosts.def).toBe(0);
    expect(boosts.spa).toBe(0);
    expect(boosts.spd).toBe(0);
    expect(boosts.spe).toBe(0);
    expect(boosts.accuracy).toBe(0);
    expect(boosts.evasion).toBe(0);
  });

  it('clears volatile statuses (confusion, leech seed, etc.)', () => {
    const team = healTeam([makeDamagedPokemon()]);
    expect(team[0].volatileStatuses.size).toBe(0);
  });

  it('restores all PP to max', () => {
    const team = healTeam([makeDamagedPokemon()]);
    for (const move of team[0].moves) {
      expect(move.currentPp).toBe(move.maxPp);
    }
    // Verify specific moves
    expect(team[0].moves[0].currentPp).toBe(15); // Flamethrower was at 3
    expect(team[0].moves[1].currentPp).toBe(10); // Earthquake was at 0
  });

  it('clears disabled state on moves', () => {
    const team = healTeam([makeDamagedPokemon()]);
    for (const move of team[0].moves) {
      expect(move.disabled).toBe(false);
    }
  });

  it('clears substitute', () => {
    const team = healTeam([makeDamagedPokemon()]);
    expect(team[0].substituteHp).toBe(0);
  });

  it('resets toxic counter', () => {
    const team = healTeam([makeDamagedPokemon()]);
    expect(team[0].toxicCounter).toBe(0);
  });

  it('resets sleep and confusion turns', () => {
    const team = healTeam([makeDamagedPokemon()]);
    expect(team[0].sleepTurns).toBe(0);
    expect(team[0].confusionTurns).toBe(0);
  });

  it('clears choice lock', () => {
    const team = healTeam([makeDamagedPokemon()]);
    expect(team[0].choiceLocked).toBeNull();
  });

  it('clears encore', () => {
    const team = healTeam([makeDamagedPokemon()]);
    expect(team[0].encoreTurns).toBe(0);
    expect(team[0].encoreMove).toBeNull();
  });

  it('clears last move and damage state', () => {
    const team = healTeam([makeDamagedPokemon()]);
    expect(team[0].lastMoveUsed).toBeNull();
    expect(team[0].lastDamageTaken).toBeNull();
    expect(team[0].hasMovedThisTurn).toBe(false);
    expect(team[0].tookDamageThisTurn).toBe(false);
    expect(team[0].protectedLastTurn).toBe(false);
    expect(team[0].timesHit).toBe(0);
  });

  it('preserves species, moves, ability, item, nature, EVs', () => {
    const original = makeDamagedPokemon();
    const team = healTeam([original]);
    expect(team[0].species.id).toBe('charizard');
    expect(team[0].ability).toBe('Blaze');
    expect(team[0].item).toBe('Life Orb');
    expect(team[0].nature.name).toBe('Timid');
    expect(team[0].moves.length).toBe(4);
    expect(team[0].moves[0].name).toBe('Flamethrower');
  });

  it('heals full team of 6', () => {
    const team = healTeam([
      makeDamagedPokemon(),
      makeFaintedPokemon(),
      makeDamagedPokemon(),
      makeFaintedPokemon(),
      makeDamagedPokemon(),
      makeFaintedPokemon(),
    ]);
    expect(team.length).toBe(6);
    for (const p of team) {
      expect(p.isAlive).toBe(true);
      expect(p.currentHp).toBe(p.stats.hp);
      expect(p.status).toBeNull();
    }
  });
});
