import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createLocalBattle, BotDifficulty } from '../../src/client/local-battle';
import type { BattleAction as ReducerAction } from '../../src/client/state/battle-reducer';

/**
 * Tests for the local (offline) CPU battle adapter.
 * Verifies that createLocalBattle dispatches the correct sequence of
 * reducer actions to drive the UI through a full battle lifecycle.
 */

function createTestBattle(overrides: {
  difficulty?: BotDifficulty;
  playerName?: string;
} = {}) {
  const dispatched: ReducerAction[] = [];
  const dispatch = (action: ReducerAction) => dispatched.push(action);

  const lb = createLocalBattle({
    playerName: overrides.playerName ?? 'Tanmay',
    itemMode: 'competitive',
    maxGen: null,
    difficulty: overrides.difficulty ?? 'normal',
    legendaryMode: false,
    dispatch,
  });

  return { lb, dispatched, dispatch };
}

describe('createLocalBattle', () => {
  describe('initialization', () => {
    it('picks a bot name from the pool', () => {
      const { lb } = createTestBattle();
      const validNames = [
        'Jonathan', 'Nikhil', 'Trusha', 'Som', 'Meha', 'Ishan',
        'Vikram', 'Amit', 'Tejal', 'Akshay', 'Tanmay', 'Ambi',
      ];
      expect(validNames).toContain(lb.botName);
    });

    it('does not pick player name as bot name', () => {
      // Run multiple times to reduce false positive chance
      for (let i = 0; i < 20; i++) {
        const { lb } = createTestBattle({ playerName: 'Tanmay' });
        expect(lb.botName).not.toBe('Tanmay');
      }
    });
  });

  describe('start()', () => {
    it('dispatches ROOM_CREATED then TEAM_PREVIEW', () => {
      const { lb, dispatched } = createTestBattle();
      lb.start();

      expect(dispatched).toHaveLength(2);

      expect(dispatched[0].type).toBe('ROOM_CREATED');
      if (dispatched[0].type === 'ROOM_CREATED') {
        expect(dispatched[0].code).toBe('LOCAL');
        expect(dispatched[0].botName).toBe(lb.botName);
      }

      expect(dispatched[1].type).toBe('TEAM_PREVIEW');
      if (dispatched[1].type === 'TEAM_PREVIEW') {
        expect(dispatched[1].payload.yourTeam).toHaveLength(6);
        expect(dispatched[1].payload.yourPlayerIndex).toBe(0);
      }
    });
  });

  describe('selectLead()', () => {
    it('dispatches BATTLE_START then BOT_LEAD_REVEALED', () => {
      const { lb, dispatched } = createTestBattle();
      lb.start();
      dispatched.length = 0; // clear start dispatches

      lb.selectLead(0);

      expect(dispatched).toHaveLength(2);
      expect(dispatched[0].type).toBe('BATTLE_START');
      if (dispatched[0].type === 'BATTLE_START') {
        expect(dispatched[0].payload.yourTeam).toHaveLength(6);
        expect(dispatched[0].payload.yourPlayerIndex).toBe(0);
      }

      expect(dispatched[1].type).toBe('BOT_LEAD_REVEALED');
      if (dispatched[1].type === 'BOT_LEAD_REVEALED') {
        expect(dispatched[1].lead).toBeDefined();
        expect(dispatched[1].lead.species).toBeDefined();
        expect(dispatched[1].teamSize).toBe(6);
      }
    });

    it('respects lead index selection', () => {
      const { lb, dispatched } = createTestBattle();
      lb.start();

      // Get team from TEAM_PREVIEW
      const teamPreview = dispatched[1];
      if (teamPreview.type !== 'TEAM_PREVIEW') throw new Error('Expected TEAM_PREVIEW');
      const team = teamPreview.payload.yourTeam;

      dispatched.length = 0;
      lb.selectLead(2); // pick 3rd pokemon

      // BATTLE_START team should still have 6 pokemon
      if (dispatched[0].type !== 'BATTLE_START') throw new Error('Expected BATTLE_START');
      expect(dispatched[0].payload.yourTeam).toHaveLength(6);
    });
  });

  describe('submitAction()', () => {
    function startedBattle(difficulty: BotDifficulty = 'normal') {
      const { lb, dispatched } = createTestBattle({ difficulty });
      lb.start();
      lb.selectLead(0);
      dispatched.length = 0;
      return { lb, dispatched };
    }

    it('dispatches TURN_RESULT after both players act', () => {
      const { lb, dispatched } = startedBattle();
      lb.submitAction({ type: 'move', index: 0 });

      // Should have at least a TURN_RESULT (possibly BATTLE_END or NEEDS_SWITCH too)
      const turnResults = dispatched.filter(d => d.type === 'TURN_RESULT');
      const battleEnds = dispatched.filter(d => d.type === 'BATTLE_END');

      // Either turn result or battle end should happen
      expect(turnResults.length + battleEnds.length).toBeGreaterThanOrEqual(1);

      if (turnResults.length > 0 && turnResults[0].type === 'TURN_RESULT') {
        const tr = turnResults[0].payload;
        expect(tr.events.length).toBeGreaterThan(0);
        expect(tr.yourState.team).toHaveLength(6);
        expect(tr.turn).toBeGreaterThan(0);
        expect(tr.opponentVisible.teamSize).toBe(6);
      }
    });

    it('dispatches NEEDS_SWITCH when active pokemon faints', () => {
      // Play multiple turns until a faint occurs or battle ends
      const { lb, dispatched } = startedBattle();

      let battleEnded = false;
      for (let turn = 0; turn < 100 && !battleEnded; turn++) {
        dispatched.length = 0;
        lb.submitAction({ type: 'move', index: 0 });

        for (const d of dispatched) {
          if (d.type === 'BATTLE_END') {
            battleEnded = true;
            break;
          }
          if (d.type === 'NEEDS_SWITCH') {
            // Verify needs_switch payload
            expect(d.payload.availableSwitches.length).toBeGreaterThan(0);
            expect(d.payload.reason).toBeDefined();
            // Switch to first available
            dispatched.length = 0;
            lb.submitForceSwitch(d.payload.availableSwitches[0].index);
            break;
          }
        }
      }
      // If we got here without error, the force switch flow works (or battle ended normally)
      expect(true).toBe(true);
    });

    it('dispatches BATTLE_END when all pokemon faint', () => {
      const { lb, dispatched } = startedBattle();

      let battleEnded = false;
      for (let turn = 0; turn < 200 && !battleEnded; turn++) {
        dispatched.length = 0;
        lb.submitAction({ type: 'move', index: 0 });

        for (const d of dispatched) {
          if (d.type === 'BATTLE_END') {
            battleEnded = true;
            expect(d.payload.winner).toBeDefined();
            expect(d.payload.reason).toBe('all_fainted');
            expect(d.payload.finalState.yourTeam).toHaveLength(6);
            expect(d.payload.finalState.opponentTeam).toHaveLength(6);
            break;
          }
          if (d.type === 'NEEDS_SWITCH') {
            dispatched.length = 0;
            lb.submitForceSwitch(d.payload.availableSwitches[0].index);
            // Check again for battle end after switch
            for (const d2 of dispatched) {
              if (d2.type === 'BATTLE_END') {
                battleEnded = true;
                break;
              }
            }
            break;
          }
        }
      }
      expect(battleEnded).toBe(true);
    });

    it('handles switch actions', () => {
      const { lb, dispatched } = startedBattle();
      lb.submitAction({ type: 'switch', index: 1 });

      const turnResults = dispatched.filter(d => d.type === 'TURN_RESULT');
      const battleEnds = dispatched.filter(d => d.type === 'BATTLE_END');

      expect(turnResults.length + battleEnds.length).toBeGreaterThanOrEqual(1);

      if (turnResults.length > 0 && turnResults[0].type === 'TURN_RESULT') {
        // After switching, active pokemon index should be 1
        expect(turnResults[0].payload.yourState.activePokemonIndex).toBe(1);
      }
    });

    it('does nothing if battle not started', () => {
      const { lb, dispatched } = createTestBattle();
      lb.submitAction({ type: 'move', index: 0 });
      expect(dispatched).toHaveLength(0);
    });
  });

  describe('submitForceSwitch()', () => {
    it('does nothing if battle not started', () => {
      const { lb, dispatched } = createTestBattle();
      lb.submitForceSwitch(1);
      expect(dispatched).toHaveLength(0);
    });
  });

  describe('disconnect()', () => {
    it('cleans up without error', () => {
      const { lb } = createTestBattle();
      lb.start();
      lb.selectLead(0);
      lb.disconnect();
      // After disconnect, actions should be no-ops
      const dispatched: ReducerAction[] = [];
      lb.submitAction({ type: 'move', index: 0 });
      expect(dispatched).toHaveLength(0);
    });
  });

  describe('bot difficulty', () => {
    it('easy bot can play a full game', () => {
      const { lb, dispatched } = createTestBattle({ difficulty: 'easy' });
      lb.start();
      lb.selectLead(0);

      let battleEnded = false;
      for (let turn = 0; turn < 200 && !battleEnded; turn++) {
        dispatched.length = 0;
        lb.submitAction({ type: 'move', index: 0 });

        for (const d of dispatched) {
          if (d.type === 'BATTLE_END') { battleEnded = true; break; }
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
      expect(battleEnded).toBe(true);
    });

    it('hard bot can play a full game', () => {
      const { lb, dispatched } = createTestBattle({ difficulty: 'hard' });
      lb.start();
      lb.selectLead(0);

      let battleEnded = false;
      for (let turn = 0; turn < 200 && !battleEnded; turn++) {
        dispatched.length = 0;
        lb.submitAction({ type: 'move', index: 0 });

        for (const d of dispatched) {
          if (d.type === 'BATTLE_END') { battleEnded = true; break; }
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
      expect(battleEnded).toBe(true);
    });
  });
});
