/**
 * Respawn system + save flow tests.
 * Drives the reducer through gym career loss/win/save scenarios.
 */
import { describe, it, expect } from 'vitest';
import { battleReducer, initialState } from '../../src/client/state/battle-reducer';
import type { BattleState } from '../../src/client/state/battle-reducer';

function startGymCareer(): BattleState {
  return battleReducer(initialState, {
    type: 'GYM_CAREER_START',
    playerName: 'Red',
    gymTypes: ['Fire', 'Water', 'Grass', 'Electric', 'Ice', 'Dragon', 'Dark', 'Steel'],
  });
}

describe('Respawn system', () => {
  it('losing a gym battle preserves beaten gyms', () => {
    let state = startGymCareer();
    state = battleReducer(state, { type: 'SET_SHOP_BALANCE', balance: 5 });

    // Win gym 0
    state = battleReducer(state, { type: 'GYM_WIN_ADVANCE', gymIndex: 0, payout: 1 });
    expect(state.beatenGyms[0]).toBe(true);
    expect(state.phase).toBe('shop');
    state = battleReducer(state, { type: 'SHOP_DONE' });

    // Win gym 3
    state = battleReducer(state, { type: 'GYM_WIN_ADVANCE', gymIndex: 3, payout: 1 });
    state = battleReducer(state, { type: 'SHOP_DONE' });
    expect(state.beatenGyms[3]).toBe(true);
    expect(state.beatenGyms.filter(Boolean).length).toBe(2);

    // "Lose" gym 5 → return to gym map (simulated via SHOW_GYM_MAP)
    state = battleReducer(state, { type: 'SHOW_GYM_MAP' });
    expect(state.phase).toBe('gym_map');

    // Previous wins preserved
    expect(state.beatenGyms[0]).toBe(true);
    expect(state.beatenGyms[3]).toBe(true);
    expect(state.beatenGyms[5]).toBe(false);
  });

  it('shop balance preserved after loss return', () => {
    let state = startGymCareer();
    state = battleReducer(state, { type: 'SET_SHOP_BALANCE', balance: 8 });

    // Win gym → balance goes up
    state = battleReducer(state, { type: 'GYM_WIN_ADVANCE', gymIndex: 0, payout: 1 });
    expect(state.shopBalance).toBe(9);
    state = battleReducer(state, { type: 'SHOP_DONE' });

    // "Lose" → return to map
    state = battleReducer(state, { type: 'SHOW_GYM_MAP' });
    expect(state.shopBalance).toBe(9);
  });

  it('losing E4 battle preserves beaten E4 members', () => {
    let state = startGymCareer();

    // Beat all 8 gyms
    for (let i = 0; i < 8; i++) {
      state = battleReducer(state, { type: 'GYM_WIN_ADVANCE', gymIndex: i, payout: 1 });
      state = battleReducer(state, { type: 'SHOP_DONE' });
    }
    expect(state.phase).toBe('e4_locks');

    // Beat E4 member 0
    state = battleReducer(state, { type: 'E4_WIN_ADVANCE', memberIndex: 0, payout: 2 });
    state = battleReducer(state, { type: 'SHOP_DONE' });
    expect(state.beatenE4[0]).toBe(true);

    // "Lose" to E4 member 2 → return to E4 locks
    state = battleReducer(state, { type: 'SHOW_E4_LOCKS' });
    expect(state.phase).toBe('e4_locks');
    expect(state.beatenE4[0]).toBe(true);
    expect(state.beatenE4[2]).toBe(false);
  });

  it('forfeit run resets everything', () => {
    let state = startGymCareer();
    state = battleReducer(state, { type: 'GYM_WIN_ADVANCE', gymIndex: 0, payout: 1 });
    state = battleReducer(state, { type: 'SHOP_DONE' });

    state = battleReducer(state, { type: 'RESET' });
    expect(state.phase).toBe('setup');
    expect(state.beatenGyms).toEqual([]);
    expect(state.campaignMode).toBeNull();
  });
});

describe('Save flow', () => {
  it('save data after gym win has correct beaten gyms and balance', () => {
    let state = startGymCareer();
    state = battleReducer(state, { type: 'SET_SHOP_BALANCE', balance: 4 });

    state = battleReducer(state, { type: 'GYM_WIN_ADVANCE', gymIndex: 2, payout: 1 });
    expect(state.beatenGyms[2]).toBe(true);
    expect(state.shopBalance).toBe(5);
    expect(state.phase).toBe('shop');
  });

  it('multiple losses do not corrupt beaten gyms', () => {
    let state = startGymCareer();
    state = battleReducer(state, { type: 'SET_SHOP_BALANCE', balance: 3 });

    // Win gym 0
    state = battleReducer(state, { type: 'GYM_WIN_ADVANCE', gymIndex: 0, payout: 1 });
    state = battleReducer(state, { type: 'SHOP_DONE' });

    // Lose multiple times (return to map each time)
    state = battleReducer(state, { type: 'SHOW_GYM_MAP' }); // loss 1
    state = battleReducer(state, { type: 'SHOW_GYM_MAP' }); // loss 2
    state = battleReducer(state, { type: 'SHOW_GYM_MAP' }); // loss 3

    // State still correct
    expect(state.beatenGyms[0]).toBe(true);
    expect(state.beatenGyms.filter(Boolean).length).toBe(1);
    expect(state.shopBalance).toBe(4);
  });

  it('save after shop purchase reflects new balance', () => {
    let state = startGymCareer();
    state = battleReducer(state, { type: 'SET_SHOP_BALANCE', balance: 10 });

    state = battleReducer(state, { type: 'GYM_WIN_ADVANCE', gymIndex: 0, payout: 1 });
    expect(state.shopBalance).toBe(11);

    // Spend in shop
    state = battleReducer(state, { type: 'SET_SHOP_BALANCE', balance: 8 });
    state = battleReducer(state, { type: 'SHOP_DONE' });
    expect(state.shopBalance).toBe(8);
  });

  it('GYM_CAREER_RESUME restores beaten gyms, E4, and balance', () => {
    let state = battleReducer(initialState, {
      type: 'GYM_CAREER_RESUME',
      playerName: 'Red',
      gymTypes: ['Fire', 'Water', 'Grass', 'Electric', 'Ice', 'Dragon', 'Dark', 'Steel'],
      beatenGyms: [true, false, true, false, true, false, false, false],
      beatenE4: [false, false, false, false],
      shopBalance: 7,
      yourTeam: [],
    });

    expect(state.phase).toBe('gym_map');
    expect(state.beatenGyms[0]).toBe(true);
    expect(state.beatenGyms[2]).toBe(true);
    expect(state.beatenGyms[4]).toBe(true);
    expect(state.beatenGyms.filter(Boolean).length).toBe(3);
    expect(state.shopBalance).toBe(7);
  });

  it('GYM_CAREER_RESUME with all gyms beaten goes to e4_locks', () => {
    let state = battleReducer(initialState, {
      type: 'GYM_CAREER_RESUME',
      playerName: 'Red',
      gymTypes: ['Fire', 'Water', 'Grass', 'Electric', 'Ice', 'Dragon', 'Dark', 'Steel'],
      beatenGyms: new Array(8).fill(true),
      beatenE4: [true, false, true, false],
      shopBalance: 12,
      yourTeam: [],
    });

    expect(state.phase).toBe('e4_locks');
    expect(state.beatenE4[0]).toBe(true);
    expect(state.beatenE4[2]).toBe(true);
    expect(state.shopBalance).toBe(12);
  });

  it('GYM_CAREER_RESUME then win then loss preserves all progress', () => {
    let state = battleReducer(initialState, {
      type: 'GYM_CAREER_RESUME',
      playerName: 'Red',
      gymTypes: ['Fire', 'Water', 'Grass', 'Electric', 'Ice', 'Dragon', 'Dark', 'Steel'],
      beatenGyms: [true, true, false, false, false, false, false, false],
      beatenE4: [false, false, false, false],
      shopBalance: 5,
      yourTeam: [],
    });

    // Win gym 4
    state = battleReducer(state, { type: 'GYM_WIN_ADVANCE', gymIndex: 4, payout: 1 });
    state = battleReducer(state, { type: 'SHOP_DONE' });
    expect(state.beatenGyms[4]).toBe(true);

    // Lose to gym 6 → return to map
    state = battleReducer(state, { type: 'SHOW_GYM_MAP' });
    expect(state.beatenGyms[0]).toBe(true);
    expect(state.beatenGyms[1]).toBe(true);
    expect(state.beatenGyms[4]).toBe(true);
    expect(state.beatenGyms[6]).toBe(false);
    expect(state.shopBalance).toBe(6); // 5 + 1 from win
  });
});
