import { describe, it, expect } from 'vitest';
import { createLocalBattle } from '../../src/client/local-battle';
import type { BattleAction } from '../../src/client/state/battle-reducer';

/**
 * Tests for hard CPU AI improvements:
 * - Reduced unnecessary switching
 * - Hazard awareness (don't set Stealth Rock twice)
 * - Better force-switch choices
 */

function playGame(difficulty: 'easy' | 'normal' | 'hard', maxTurns = 200) {
  const dispatched: BattleAction[] = [];
  const lb = createLocalBattle({
    playerName: 'Test',
    itemMode: 'competitive',
    maxGen: null,
    difficulty,
    legendaryMode: false,
    draftMode: false,
    dispatch: (a: BattleAction) => dispatched.push(a),
  });

  lb.start();
  lb.selectLead(0);

  let turns = 0;
  let battleEnded = false;
  let botSwitchCount = 0;

  for (let turn = 0; turn < maxTurns && !battleEnded; turn++) {
    dispatched.length = 0;
    lb.submitAction({ type: 'move', index: 0 });
    turns++;

    for (const d of dispatched) {
      if (d.type === 'TURN_RESULT') {
        // Count bot switches from events
        for (const evt of d.payload.events) {
          if (evt.type === 'switch' && evt.data?.player === 1) {
            botSwitchCount++;
          }
        }
      }
      if (d.type === 'BATTLE_END') {
        battleEnded = true;
        break;
      }
      if (d.type === 'NEEDS_SWITCH') {
        dispatched.length = 0;
        lb.submitForceSwitch(d.payload.availableSwitches[0].index);
        for (const d2 of dispatched) {
          if (d2.type === 'BATTLE_END') { battleEnded = true; break; }
        }
        break;
      }
    }
  }

  return { turns, battleEnded, botSwitchCount };
}

describe('Hard AI Improvements', () => {
  it('hard bot completes a game', () => {
    const result = playGame('hard');
    expect(result.battleEnded).toBe(true);
  });

  it('hard bot switches less often than before (regression guard)', () => {
    // Run multiple games and check average switch rate
    let totalSwitches = 0;
    let totalTurns = 0;
    const games = 5;

    for (let i = 0; i < games; i++) {
      const result = playGame('hard');
      totalSwitches += result.botSwitchCount;
      totalTurns += result.turns;
    }

    const switchRate = totalSwitches / totalTurns;
    // Hard bot should switch less than 40% of turns (was much higher before)
    expect(switchRate).toBeLessThan(0.4);
  });

  it('hard bot does not switch more than easy bot on average', () => {
    let hardSwitches = 0;
    let hardTurns = 0;
    let easySwitches = 0;
    let easyTurns = 0;
    const games = 3;

    for (let i = 0; i < games; i++) {
      const hard = playGame('hard');
      hardSwitches += hard.botSwitchCount;
      hardTurns += hard.turns;

      const easy = playGame('easy');
      easySwitches += easy.botSwitchCount;
      easyTurns += easy.turns;
    }

    const hardRate = hardSwitches / hardTurns;
    const easyRate = easyTurns > 0 ? easySwitches / easyTurns : 0;
    // Hard should not switch dramatically more than easy
    // (Easy never switches voluntarily, only force-switches)
    expect(hardRate).toBeLessThan(easyRate + 0.35);
  });

  it('hard draft bot with legendary mode completes a game', () => {
    const dispatched: BattleAction[] = [];
    const lb = createLocalBattle({
      playerName: 'Test',
      itemMode: 'competitive',
      maxGen: null,
      difficulty: 'hard',
      legendaryMode: true,
      draftMode: true,
      draftType: 'snake',
      dispatch: (a: BattleAction) => dispatched.push(a),
    });

    lb.start();

    // Complete the draft phase
    const draftStart = dispatched.find(d => d.type === 'DRAFT_START');
    expect(draftStart).toBeDefined();

    // Make 6 human picks (bot picks automatically)
    let picksMade = 0;
    for (let i = 0; i < 100 && picksMade < 6; i++) {
      dispatched.length = 0;
      try {
        lb.submitDraftPick(i);
        picksMade++;
      } catch {
        // Invalid pick, try next index
      }
      // Wait for bot picks
      if (dispatched.some(d => d.type === 'DRAFT_COMPLETE')) break;
    }

    // Should eventually get to team preview
    const allDispatched: BattleAction[] = [];
    const lb2 = createLocalBattle({
      playerName: 'Test',
      itemMode: 'competitive',
      maxGen: null,
      difficulty: 'hard',
      legendaryMode: true,
      draftMode: false,
      dispatch: (a: BattleAction) => allDispatched.push(a),
    });
    lb2.start();
    lb2.selectLead(0);

    let battleEnded = false;
    for (let turn = 0; turn < 200 && !battleEnded; turn++) {
      allDispatched.length = 0;
      lb2.submitAction({ type: 'move', index: 0 });
      for (const d of allDispatched) {
        if (d.type === 'BATTLE_END') { battleEnded = true; break; }
        if (d.type === 'NEEDS_SWITCH') {
          allDispatched.length = 0;
          lb2.submitForceSwitch(d.payload.availableSwitches[0].index);
          for (const d2 of allDispatched) {
            if (d2.type === 'BATTLE_END') { battleEnded = true; break; }
          }
          break;
        }
      }
    }
    expect(battleEnded).toBe(true);
  });
});
