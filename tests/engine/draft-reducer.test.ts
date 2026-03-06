import { describe, it, expect } from 'vitest';
import { battleReducer, initialState } from '../../src/client/state/battle-reducer';
import type { BattleState, BattleAction } from '../../src/client/state/battle-reducer';
import { generateDraftPool, SNAKE_ORDER } from '../../src/engine/draft-pool';
import { SeededRNG } from '../../src/utils/rng';

function dispatch(state: BattleState, action: BattleAction): BattleState {
  return battleReducer(state, action);
}

describe('Draft Reducer', () => {
  const pool = generateDraftPool(new SeededRNG(42));

  it('DRAFT_START sets phase to drafting and stores pool', () => {
    let state = dispatch(initialState, { type: 'START_GAME', playerName: 'Test', itemMode: 'competitive' });
    state = dispatch(state, { type: 'CONNECTED' });
    state = dispatch(state, { type: 'DRAFT_START', pool, yourPlayerIndex: 0 });

    expect(state.phase).toBe('drafting');
    expect(state.draftMode).toBe(true);
    expect(state.draftPool).toHaveLength(21);
    expect(state.draftPicks).toEqual([[], []]);
    expect(state.draftCurrentPick).toBe(0);
    expect(state.draftCurrentPlayer).toBe(SNAKE_ORDER[0]);
  });

  it('DRAFT_PICK adds pick to correct player and advances counter', () => {
    let state = dispatch(initialState, { type: 'START_GAME', playerName: 'Test', itemMode: 'competitive' });
    state = dispatch(state, { type: 'CONNECTED' });
    state = dispatch(state, { type: 'DRAFT_START', pool, yourPlayerIndex: 0 });

    // P1 picks (SNAKE_ORDER[0] = 0)
    state = dispatch(state, { type: 'DRAFT_PICK', playerIndex: 0, poolIndex: 5 });
    expect(state.draftPicks[0]).toEqual([5]);
    expect(state.draftPicks[1]).toEqual([]);
    expect(state.draftCurrentPick).toBe(1);
    expect(state.draftCurrentPlayer).toBe(SNAKE_ORDER[1]); // 1
  });

  it('DRAFT_PICK follows snake order', () => {
    let state = dispatch(initialState, { type: 'START_GAME', playerName: 'Test', itemMode: 'competitive' });
    state = dispatch(state, { type: 'CONNECTED' });
    state = dispatch(state, { type: 'DRAFT_START', pool, yourPlayerIndex: 0 });

    // Simulate full 12 picks following snake order
    for (let i = 0; i < 12; i++) {
      const playerIndex = SNAKE_ORDER[i];
      state = dispatch(state, { type: 'DRAFT_PICK', playerIndex, poolIndex: i });
    }

    expect(state.draftPicks[0]).toHaveLength(6);
    expect(state.draftPicks[1]).toHaveLength(6);
    expect(state.draftCurrentPick).toBe(12);

    // Verify P1 picked at positions 0, 3, 4, 7, 8, 11
    expect(state.draftPicks[0]).toEqual([0, 3, 4, 7, 8, 11]);
    // Verify P2 picked at positions 1, 2, 5, 6, 9, 10
    expect(state.draftPicks[1]).toEqual([1, 2, 5, 6, 9, 10]);
  });

  it('DRAFT_COMPLETE transitions to team_preview and stores team', () => {
    let state = dispatch(initialState, { type: 'START_GAME', playerName: 'Test', itemMode: 'competitive' });
    state = dispatch(state, { type: 'CONNECTED' });
    state = dispatch(state, { type: 'DRAFT_START', pool, yourPlayerIndex: 0 });

    const mockTeam = pool.slice(0, 6).map((e, i) => ({
      species: e.species,
      level: 100,
      currentHp: 100,
      maxHp: 100,
      moves: [],
      ability: 'Test',
      item: 'Leftovers',
      status: null,
      isAlive: true,
      boosts: { atk: 0, def: 0, spa: 0, spd: 0, spe: 0, accuracy: 0, evasion: 0 },
      choiceLocked: null,
    })) as any;

    state = dispatch(state, { type: 'DRAFT_COMPLETE', yourTeam: mockTeam });
    expect(state.phase).toBe('team_preview');
    expect(state.yourTeam).toHaveLength(6);
  });

  it('draft state resets on RESET', () => {
    let state = dispatch(initialState, { type: 'START_GAME', playerName: 'Test', itemMode: 'competitive' });
    state = dispatch(state, { type: 'CONNECTED' });
    state = dispatch(state, { type: 'DRAFT_START', pool, yourPlayerIndex: 0 });
    state = dispatch(state, { type: 'DRAFT_PICK', playerIndex: 0, poolIndex: 0 });

    state = dispatch(state, { type: 'RESET' });
    expect(state.draftMode).toBe(false);
    expect(state.draftPool).toEqual([]);
    expect(state.draftPicks).toEqual([[], []]);
    expect(state.draftCurrentPick).toBe(0);
  });
});
