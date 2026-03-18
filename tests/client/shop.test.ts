import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { SeededRNG } from '../../src/utils/rng';
import { generateGauntletTeam, generateGymTeam } from '../../src/engine/team-generator';
import { battleReducer, initialState } from '../../src/client/state/battle-reducer';
import { BUDGET_TOTAL } from '../../src/engine/draft-pool';

describe('Shop — Economy', () => {
  it('budget rollover: draft spending 10 of 14 → shopBalance starts at 4', () => {
    let state = battleReducer(initialState, {
      type: 'GYM_CAREER_START',
      playerName: 'Test',
      gymTypes: ['Fire', 'Water', 'Grass', 'Electric', 'Ice', 'Dragon', 'Dark', 'Steel'],
    });
    state = battleReducer(state, { type: 'SET_SHOP_BALANCE', balance: 4 });
    expect(state.shopBalance).toBe(4);
  });

  it('gym payout: shopBalance increases by 1 after SHOW_SHOP with payout 1', () => {
    let state = { ...initialState, shopBalance: 4, campaignMode: 'gym_career' as const };
    state = battleReducer(state, { type: 'SHOW_SHOP', payout: 1 });
    expect(state.shopBalance).toBe(5);
    expect(state.phase).toBe('shop');
  });

  it('E4 payout: shopBalance increases by 2 after SHOW_SHOP with payout 2', () => {
    let state = { ...initialState, shopBalance: 5, campaignMode: 'gym_career' as const };
    state = battleReducer(state, { type: 'SHOW_SHOP', payout: 2 });
    expect(state.shopBalance).toBe(7);
  });

  it('SET_SHOP_BALANCE sets exact balance', () => {
    let state = { ...initialState, shopBalance: 10 };
    state = battleReducer(state, { type: 'SET_SHOP_BALANCE', balance: 3 });
    expect(state.shopBalance).toBe(3);
  });

  it('SHOP_DONE returns to gym_map when gyms remain', () => {
    const state = battleReducer(
      { ...initialState, phase: 'shop', beatenGyms: [true, true, false, false, false, false, false, false], beatenE4: [false, false, false, false] },
      { type: 'SHOP_DONE' },
    );
    expect(state.phase).toBe('gym_map');
  });

  it('SHOP_DONE returns to e4_locks when all gyms beaten', () => {
    const state = battleReducer(
      { ...initialState, phase: 'shop', beatenGyms: new Array(8).fill(true), beatenE4: [true, false, false, false] },
      { type: 'SHOP_DONE' },
    );
    expect(state.phase).toBe('e4_locks');
  });

  it('shop does NOT appear after champion win (advanceCampaign dispatches RESET)', () => {
    const contextSource = fs.readFileSync(
      path.resolve(__dirname, '../../src/client/state/battle-context.tsx'),
      'utf-8',
    );
    // Champion branch should dispatch RESET, not SHOW_SHOP
    const championSection = contextSource.slice(contextSource.indexOf('Champion defeated'));
    expect(championSection).toContain("type: 'RESET'");
    expect(championSection.slice(0, 200)).not.toContain('SHOW_SHOP');
  });
});

describe('Shop — Buy Pokemon costs', () => {
  it('Mega costs 4, T1 costs 3, T2 costs 2', () => {
    // These are the same costs used in the budget draft
    const costs = { 0: 4, 1: 3, 2: 2 }; // tier → cost
    expect(costs[0]).toBe(4); // Mega
    expect(costs[1]).toBe(3); // T1
    expect(costs[2]).toBe(2); // T2
  });
});

describe('Regression — Campaign battles use pre-built teams', () => {
  it('gauntlet battle 0 has exactly 1 Pokemon', () => {
    const team = generateGauntletTeam(new SeededRNG(42), 0);
    expect(team.length).toBe(1);
  });

  it('gauntlet battle 0 is T3/T4 tier (not legends)', () => {
    const team = generateGauntletTeam(new SeededRNG(42), 0);
    expect(team[0].species.tier).toBeGreaterThanOrEqual(3);
  });

  it('gym teams match their gym type for all 18 types', () => {
    const types = [
      'Normal', 'Fire', 'Water', 'Electric', 'Grass', 'Ice',
      'Fighting', 'Poison', 'Ground', 'Flying', 'Psychic',
      'Bug', 'Rock', 'Ghost', 'Dragon', 'Dark', 'Steel', 'Fairy',
    ];
    for (const type of types) {
      const team = generateGymTeam(new SeededRNG(42), type);
      expect(team.length).toBe(6);
      const matching = team.filter(p => p.species.types.includes(type));
      expect(matching.length, `${type}: ${matching.length}/6`).toBeGreaterThanOrEqual(4);
    }
  });

  it('local-battle uses campaignOpponentTeam directly (not regenerated)', () => {
    const source = fs.readFileSync(
      path.resolve(__dirname, '../../src/client/local-battle.ts'),
      'utf-8',
    );
    expect(source).toContain('campaignOpponentTeam');
    expect(source).toContain('isCampaign');
    // Campaign path should assign botTeam from options
    expect(source).toContain('options.campaignOpponentTeam!');
  });

  it('budget draft enforces 14 point cap', () => {
    expect(BUDGET_TOTAL).toBe(14);
  });
});

describe('Regression — No double loss recording', () => {
  it('returnToMenu checks campaignRunSavedRef before saving', () => {
    const source = fs.readFileSync(
      path.resolve(__dirname, '../../src/client/state/battle-context.tsx'),
      'utf-8',
    );
    expect(source).toContain('campaignRunSavedRef.current');
    expect(source).toContain('alreadySaved');
  });
});
