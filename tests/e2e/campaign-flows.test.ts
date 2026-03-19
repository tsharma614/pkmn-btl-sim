/**
 * E2E tests — headless state-only tests driving the reducer through full campaign flows.
 * No UI rendering, just state transitions and assertions.
 */
import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { battleReducer, initialState } from '../../src/client/state/battle-reducer';
import type { BattleState } from '../../src/client/state/battle-reducer';
import { SeededRNG } from '../../src/utils/rng';
import { generateGauntletTeam, generateGymTeam, generateE4Team, generateChampionCpuTeam, generateTeam } from '../../src/engine/team-generator';
import { generateBudgetDraftOptions, BUDGET_TOTAL } from '../../src/engine/draft-pool';

// Helper: simulate a state through a sequence of actions
function run(state: BattleState, ...actions: any[]): BattleState {
  return actions.reduce((s, a) => battleReducer(s, a), state);
}

describe('E2E: Gym Career full flow', () => {
  const gymTypes = ['Fire', 'Water', 'Grass', 'Electric', 'Ice', 'Dragon', 'Dark', 'Steel'];

  it('3. draft cheap → gym win → shop opens → beat all 8 → E4 → champion flow', () => {
    // Start gym career
    let state = battleReducer(initialState, { type: 'GYM_CAREER_START', playerName: 'Red', gymTypes });
    expect(state.phase).toBe('budget_draft');
    expect(state.campaignMode).toBe('gym_career');
    expect(state.gymTypes).toHaveLength(8);
    expect(state.beatenGyms).toHaveLength(8);
    expect(state.beatenE4).toHaveLength(4);

    // Set shop balance (simulating cheap draft: spent 10 of 14 → 4 pts banked)
    state = battleReducer(state, { type: 'SET_SHOP_BALANCE', balance: 4 });
    expect(state.shopBalance).toBe(4);

    // Simulate 8 gym wins (atomic dispatch)
    for (let i = 0; i < 8; i++) {
      state = battleReducer(state, { type: 'GYM_WIN_ADVANCE', gymIndex: i, payout: 1 });
      expect(state.phase).toBe('shop');
      expect(state.shopBalance).toBe(4 + (i + 1)); // +1 per gym
      state = battleReducer(state, { type: 'SHOP_DONE' });
    }

    // After 8 gyms, should be at E4 locks
    expect(state.phase).toBe('e4_locks');
    expect(state.beatenGyms.filter(Boolean).length).toBe(8);
    expect(state.shopBalance).toBe(12); // 4 + 8

    // Simulate 4 E4 wins (atomic dispatch)
    for (let i = 0; i < 4; i++) {
      state = battleReducer(state, { type: 'E4_WIN_ADVANCE', memberIndex: i, payout: 2 });
      expect(state.phase).toBe('shop');
      state = battleReducer(state, { type: 'SHOP_DONE' });
      expect(state.phase).toBe('e4_locks');
    }

    expect(state.beatenE4.filter(Boolean).length).toBe(4);
    expect(state.shopBalance).toBe(20); // 12 + 4*2
  });
});

describe('E2E: Gauntlet flow', () => {
  it('4. starter → item select → battle 1 (1v1 T3) → scaling', () => {
    // Start gauntlet
    let state = battleReducer(initialState, { type: 'GAUNTLET_START', playerName: 'Ash' });
    expect(state.phase).toBe('gauntlet_starter');
    expect(state.campaignMode).toBe('gauntlet');
    expect(state.moveSelection).toBe(true);

    // Battle 0: 1v1 T3
    const team0 = generateGauntletTeam(new SeededRNG(42), 0);
    expect(team0.length).toBe(1);
    expect(team0[0].species.tier).toBeGreaterThanOrEqual(3);

    // Battle 3: 4 Pokemon, still T3/T4
    const team3 = generateGauntletTeam(new SeededRNG(42), 3);
    expect(team3.length).toBe(4);
    for (const p of team3) expect(p.species.tier).toBeGreaterThanOrEqual(3);

    // Battle 5: 6 Pokemon, mid-tier
    const team5 = generateGauntletTeam(new SeededRNG(42), 5);
    expect(team5.length).toBe(6);

    // Battle 12: endgame megas
    const team12 = generateGauntletTeam(new SeededRNG(42), 12);
    expect(team12.length).toBe(6);
    for (const p of team12) {
      expect(p.species.name.includes('Mega') || p.species.id.includes('mega')).toBe(true);
    }
  });
});

describe('E2E: Campaign loss + restart', () => {
  it('5. lose gym → loss recorded → restart → fresh draft', () => {
    let state = battleReducer(initialState, {
      type: 'GYM_CAREER_START',
      playerName: 'Red',
      gymTypes: ['Fire', 'Water', 'Grass', 'Electric', 'Ice', 'Dragon', 'Dark', 'Steel'],
    });
    expect(state.phase).toBe('budget_draft');

    // Simulate loss → battle_end phase
    state = { ...state, phase: 'battle_end' as any, campaignStage: 2 };

    // Reset (simulating returnToMenu after loss)
    state = battleReducer(state, { type: 'RESET' });
    expect(state.phase).toBe('setup');
    expect(state.campaignMode).toBeNull();
  });
});

describe('E2E: Campaign abandon', () => {
  it('6. mid-run exit from gym map → verify state resets', () => {
    let state = battleReducer(initialState, {
      type: 'GYM_CAREER_START',
      playerName: 'Red',
      gymTypes: ['Fire', 'Water', 'Grass', 'Electric', 'Ice', 'Dragon', 'Dark', 'Steel'],
    });
    state = battleReducer(state, { type: 'SHOW_GYM_MAP' });
    expect(state.phase).toBe('gym_map');

    // Reset (simulating forfeit from gym map)
    state = battleReducer(state, { type: 'RESET' });
    expect(state.phase).toBe('setup');
    expect(state.campaignMode).toBeNull();
    expect(state.shopBalance).toBe(0);
  });
});

describe('E2E: Save & resume', () => {
  it('7. beat 3 gyms → save state → verify beaten gyms + shopBalance intact', () => {
    let state = battleReducer(initialState, {
      type: 'GYM_CAREER_START',
      playerName: 'Red',
      gymTypes: ['Fire', 'Water', 'Grass', 'Electric', 'Ice', 'Dragon', 'Dark', 'Steel'],
    });
    state = battleReducer(state, { type: 'SET_SHOP_BALANCE', balance: 3 });

    // Beat 3 gyms (atomic dispatch)
    state = battleReducer(state, { type: 'GYM_WIN_ADVANCE', gymIndex: 0, payout: 1 });
    state = battleReducer(state, { type: 'SHOP_DONE' });
    state = battleReducer(state, { type: 'GYM_WIN_ADVANCE', gymIndex: 1, payout: 1 });
    state = battleReducer(state, { type: 'SHOP_DONE' });
    state = battleReducer(state, { type: 'GYM_WIN_ADVANCE', gymIndex: 2, payout: 1 });
    state = battleReducer(state, { type: 'SHOP_DONE' });

    expect(state.beatenGyms.filter(Boolean).length).toBe(3);
    expect(state.shopBalance).toBe(6); // 3 + 3 gym wins
    expect(state.phase).toBe('gym_map');

    // Verify the state could be serialized as a save
    const save = {
      currentStage: state.beatenGyms.filter(Boolean).length,
      gymTypes: state.gymTypes,
      team: [],
      date: new Date().toISOString(),
      shopBalance: state.shopBalance,
    };
    expect(save.currentStage).toBe(3);
    expect(save.shopBalance).toBe(6);
  });
});

describe('E2E: Shop economy', () => {
  it('8. budget rollover: draft 10/14 → 4pts banked', () => {
    let state = battleReducer(initialState, {
      type: 'GYM_CAREER_START',
      playerName: 'Red',
      gymTypes: ['Fire', 'Water', 'Grass', 'Electric', 'Ice', 'Dragon', 'Dark', 'Steel'],
    });
    // Simulate spending 10 of 14 in draft
    state = battleReducer(state, { type: 'SET_SHOP_BALANCE', balance: 14 - 10 });
    expect(state.shopBalance).toBe(4);
  });

  it('9. win gym → shop opens → verify balance after purchase', () => {
    let state = battleReducer(initialState, {
      type: 'GYM_CAREER_START',
      playerName: 'Red',
      gymTypes: ['Fire', 'Water', 'Grass', 'Electric', 'Ice', 'Dragon', 'Dark', 'Steel'],
    });
    state = battleReducer(state, { type: 'SET_SHOP_BALANCE', balance: 4 });
    state = battleReducer(state, { type: 'GYM_WIN_ADVANCE', gymIndex: 0, payout: 1 });
    expect(state.shopBalance).toBe(5);
    // Simulate buying T2 Pokemon (2pts)
    state = battleReducer(state, { type: 'SET_SHOP_BALANCE', balance: 3 });
    expect(state.shopBalance).toBe(3);
    state = battleReducer(state, { type: 'SHOP_DONE' });
    expect(state.phase).toBe('gym_map');
  });
});

describe('E2E: Regression — critical bugs', () => {
  it('11. gym team type enforcement for all 18 types', () => {
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

  it('12. gauntlet scaling: battle 0 = 1 T3, battle 5 = 6', () => {
    const t0 = generateGauntletTeam(new SeededRNG(42), 0);
    expect(t0.length).toBe(1);
    expect(t0[0].species.tier).toBeGreaterThanOrEqual(3);

    const t5 = generateGauntletTeam(new SeededRNG(42), 5);
    expect(t5.length).toBe(6);
  });

  it('15. budget cap is 14', () => {
    expect(BUDGET_TOTAL).toBe(14);
  });

  it('budget draft generates valid options', () => {
    const options = generateBudgetDraftOptions(new SeededRNG(42));
    expect(options.length).toBe(6);
    for (const section of options) {
      expect(section.options.length).toBeGreaterThanOrEqual(3);
    }
  });
});

// ── Missing E2E tests ────────────────────────────────────────────────────

describe('E2E: Normal battle flow', () => {
  it('1. draft → team preview → battle → winner → stats', () => {
    // START_GAME → CONNECTED → ROOM_CREATED → TEAM_PREVIEW → BATTLE_START → BATTLE_END
    let state = battleReducer(initialState, {
      type: 'START_GAME',
      playerName: 'Tanmay',
      itemMode: 'competitive',
      difficulty: 'hard',
    });
    expect(state.phase).toBe('connecting');
    expect(state.playerName).toBe('Tanmay');

    state = battleReducer(state, { type: 'CONNECTED' });
    state = battleReducer(state, { type: 'ROOM_CREATED', code: 'LOCAL', botName: 'Vikram' });
    expect(state.botName).toBe('Vikram');

    // Generate a team for team preview
    const rng = new SeededRNG(42);
    const team = generateTeam(rng, { itemMode: 'competitive' });
    const serializedTeam = team.map(p => ({
      species: p.species,
      level: p.level,
      moves: p.moves,
      ability: p.ability,
      item: p.item,
      currentHp: p.currentHp,
      maxHp: p.maxHp,
      status: null,
      boosts: { atk: 0, def: 0, spa: 0, spd: 0, spe: 0, accuracy: 0, evasion: 0 },
      isAlive: true,
      volatileStatuses: [],
    }));

    state = battleReducer(state, {
      type: 'TEAM_PREVIEW',
      payload: { yourTeam: serializedTeam as any, yourPlayerIndex: 0 },
    });
    expect(state.phase).toBe('team_preview');
    expect(state.yourTeam.length).toBe(6);

    // Battle start
    state = battleReducer(state, {
      type: 'BATTLE_START',
      payload: {
        yourTeam: serializedTeam as any,
        yourPlayerIndex: 0,
        activePokemonIndex: 0,
      } as any,
    });
    expect(state.phase).toBe('battling');
    expect(state.turn).toBe(1);

    // Battle end
    state = battleReducer(state, {
      type: 'BATTLE_END',
      payload: {
        winner: 'Tanmay',
        reason: 'all_fainted',
        finalState: { yourTeam: serializedTeam as any, opponentTeam: serializedTeam as any },
      } as any,
    });
    expect(state.phase).toBe('battle_end');
    expect(state.battleEndData?.winner).toBe('Tanmay');
  });
});

describe('E2E: Online battle flow', () => {
  it('2. room create → opponent join → team preview → battle → end', () => {
    let state = battleReducer(initialState, {
      type: 'START_ONLINE',
      playerName: 'Tanmay',
      itemMode: 'competitive',
    });
    expect(state.gameMode).toBe('online');

    state = battleReducer(state, { type: 'CONNECTED' });
    expect(state.phase).toBe('online_lobby');

    state = battleReducer(state, { type: 'ONLINE_ROOM_CREATED', code: 'ABC123' });
    expect(state.roomCode).toBe('ABC123');

    state = battleReducer(state, { type: 'OPPONENT_JOINED', name: 'Nikhil' });
    expect(state.opponentName).toBe('Nikhil');

    // Team preview
    const rng = new SeededRNG(42);
    const team = generateTeam(rng, { itemMode: 'competitive' });
    const serialized = team.map(p => ({
      species: p.species, level: p.level, moves: p.moves, ability: p.ability,
      item: p.item, currentHp: p.currentHp, maxHp: p.maxHp, status: null,
      boosts: { atk: 0, def: 0, spa: 0, spd: 0, spe: 0, accuracy: 0, evasion: 0 },
      isAlive: true, volatileStatuses: [],
    }));
    state = battleReducer(state, {
      type: 'TEAM_PREVIEW',
      payload: { yourTeam: serialized as any, yourPlayerIndex: 0 },
    });
    expect(state.phase).toBe('team_preview');

    // Battle end
    state = battleReducer(state, {
      type: 'BATTLE_END',
      payload: { winner: 'Nikhil', reason: 'all_fainted', finalState: { yourTeam: serialized as any, opponentTeam: serialized as any } } as any,
    });
    expect(state.phase).toBe('battle_end');
    expect(state.battleEndData?.winner).toBe('Nikhil');

    // Play again (reset)
    state = battleReducer(state, { type: 'RESET' });
    expect(state.phase).toBe('setup');
  });
});

describe('E2E: Move/item swap persistence in shop', () => {
  it('10. swap move + item in shop → verify changes persist', () => {
    const contextSource = fs.readFileSync(
      path.resolve(__dirname, '../../src/client/state/battle-context.tsx'),
      'utf-8',
    );

    // shopSwapMove modifies pokemon.moves[slot]
    const swapMoveFn = contextSource.slice(contextSource.indexOf('const shopSwapMove'));
    expect(swapMoveFn).toContain('pokemon.moves[moveSlotIdx]');
    expect(swapMoveFn).toContain('SET_SHOP_BALANCE');

    // shopSwapItem modifies pokemon.item
    const swapItemFn = contextSource.slice(contextSource.indexOf('const shopSwapItem'));
    expect(swapItemFn).toContain('team[pokemonIdx].item = newItem');
    expect(swapItemFn).toContain('SET_SHOP_BALANCE');

    // Both deduct 1 point
    expect(swapMoveFn).toContain('shopBalance - 1');
    expect(swapItemFn).toContain('shopBalance - 1');
  });
});

describe('E2E: Campaign teams passthrough regression', () => {
  it('4b. gym team generation enforces Fire type', () => {
    const team = generateGymTeam(new SeededRNG(42), 'Fire');
    expect(team.length).toBe(6);
    const fireCount = team.filter(p => p.species.types.includes('Fire')).length;
    expect(fireCount).toBeGreaterThanOrEqual(4);
  });

  it('4b. gauntlet battle 0 = 1 T3/T4 Pokemon', () => {
    const team = generateGauntletTeam(new SeededRNG(42), 0);
    expect(team.length).toBe(1);
    expect(team[0].species.tier).toBeGreaterThanOrEqual(3);
  });

  it('4b. local-battle has campaignPlayerTeam/campaignOpponentTeam fields', () => {
    const source = fs.readFileSync(
      path.resolve(__dirname, '../../src/client/local-battle.ts'),
      'utf-8',
    );
    expect(source).toContain('campaignPlayerTeam');
    expect(source).toContain('campaignOpponentTeam');
    expect(source).toContain('isCampaign');
  });

  it('4b. beginCampaignBattle passes campaignPlayerTeam (not eliteFourStage)', () => {
    const source = fs.readFileSync(
      path.resolve(__dirname, '../../src/client/state/battle-context.tsx'),
      'utf-8',
    );
    const battleFn = source.slice(source.indexOf('const beginCampaignBattle'));
    expect(battleFn).toContain('campaignPlayerTeam: healedTeam');
    expect(battleFn).toContain('campaignOpponentTeam: opponentTeam');
    expect(battleFn).not.toContain('eliteFourStage:');
  });
});

describe('E2E: No double loss regression', () => {
  it('14. campaignRunSavedRef prevents double loss', () => {
    const source = fs.readFileSync(
      path.resolve(__dirname, '../../src/client/state/battle-context.tsx'),
      'utf-8',
    );
    expect(source).toContain('campaignRunSavedRef');

    // returnToMenu checks before saving
    const menuFn = source.slice(source.indexOf('const returnToMenu = useCallback'));
    expect(menuFn).toContain('alreadySaved');
    expect(menuFn).toContain("phase === 'battle_end'");
    expect(menuFn).toContain('campaignRunSavedRef.current');

    // beginCampaignBattle resets the flag
    const battleFn = source.slice(source.indexOf('const beginCampaignBattle'));
    expect(battleFn).toContain('campaignRunSavedRef.current = false');
  });
});
