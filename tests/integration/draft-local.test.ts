/**
 * Integration tests for CPU (local) draft mode.
 * Verifies the full flow: start → draft pool → picks → team preview → battle.
 */
import { describe, it, expect, vi } from 'vitest';
import { createLocalBattle } from '../../src/client/local-battle';
import { SNAKE_ORDER } from '../../src/engine/draft-pool';
import type { BattleAction } from '../../src/client/state/battle-reducer';

function collectDispatches(options: {
  draftMode?: boolean;
  maxGen?: number | null;
  legendaryMode?: boolean;
  difficulty?: 'easy' | 'normal' | 'hard';
}): { dispatches: BattleAction[]; local: ReturnType<typeof createLocalBattle> } {
  const dispatches: BattleAction[] = [];
  const dispatch = (action: BattleAction) => dispatches.push(action);

  const local = createLocalBattle({
    playerName: 'TestPlayer',
    itemMode: 'competitive',
    maxGen: options.maxGen ?? null,
    difficulty: options.difficulty ?? 'normal',
    legendaryMode: options.legendaryMode ?? false,
    draftMode: options.draftMode ?? true,
    dispatch,
  });

  return { dispatches, local };
}

/** Get the human's snake slot from a DRAFT_START dispatch. */
function getHumanSlot(dispatches: BattleAction[]): 0 | 1 {
  const ds = dispatches.find(d => d.type === 'DRAFT_START');
  if (ds?.type === 'DRAFT_START') return ds.yourPlayerIndex as 0 | 1;
  return 0;
}

describe('Local Draft Mode', () => {
  it('start dispatches DRAFT_START with pool of 21', () => {
    const { dispatches, local } = collectDispatches({ draftMode: true });
    local.start();

    const draftStart = dispatches.find(d => d.type === 'DRAFT_START');
    expect(draftStart).toBeDefined();
    expect(draftStart!.type).toBe('DRAFT_START');
    if (draftStart?.type === 'DRAFT_START') {
      expect(draftStart.pool).toHaveLength(21);
      // yourPlayerIndex should be 0 or 1 (randomized)
      expect([0, 1]).toContain(draftStart.yourPlayerIndex);
    }
  });

  it('non-draft mode skips DRAFT_START', () => {
    const { dispatches, local } = collectDispatches({ draftMode: false });
    local.start();

    const draftStart = dispatches.find(d => d.type === 'DRAFT_START');
    expect(draftStart).toBeUndefined();
    const teamPreview = dispatches.find(d => d.type === 'TEAM_PREVIEW');
    expect(teamPreview).toBeDefined();
  });

  it('human pick dispatches DRAFT_PICK with correct playerIndex', () => {
    vi.useFakeTimers();
    const { dispatches, local } = collectDispatches({ draftMode: true });
    local.start();

    const humanSlot = getHumanSlot(dispatches);
    const botSlot: 0 | 1 = (1 - humanSlot) as 0 | 1;

    // If bot picks first, advance time so bot picks happen before human tries
    if (SNAKE_ORDER[0] === botSlot) {
      vi.advanceTimersByTime(1200);
      vi.advanceTimersByTime(1200);
    }

    // Now it should be human's turn — find an unpicked index
    const allPicked = dispatches
      .filter(d => d.type === 'DRAFT_PICK')
      .map(d => (d as any).poolIndex);
    let poolIdx = 3;
    while (allPicked.includes(poolIdx)) poolIdx++;

    local.submitDraftPick(poolIdx);

    const humanPicks = dispatches.filter(
      d => d.type === 'DRAFT_PICK' && (d as any).playerIndex === humanSlot,
    );
    expect(humanPicks.length).toBeGreaterThanOrEqual(1);
    const lastHumanPick = humanPicks[humanPicks.length - 1];
    if (lastHumanPick.type === 'DRAFT_PICK') {
      expect(lastHumanPick.playerIndex).toBe(humanSlot);
      expect(lastHumanPick.poolIndex).toBe(poolIdx);
    }

    vi.useRealTimers();
  });

  it('bot responds with picks after human pick', async () => {
    vi.useFakeTimers();
    const { dispatches, local } = collectDispatches({ draftMode: true });
    local.start();

    const humanSlot = getHumanSlot(dispatches);
    const botSlot: 0 | 1 = (1 - humanSlot) as 0 | 1;

    // If bot picks first, advance timers
    if (SNAKE_ORDER[0] === botSlot) {
      vi.advanceTimersByTime(1200);
      vi.advanceTimersByTime(1200);
    }

    // Human picks
    const allPicked = dispatches
      .filter(d => d.type === 'DRAFT_PICK')
      .map(d => (d as any).poolIndex);
    let poolIdx = 0;
    while (allPicked.includes(poolIdx)) poolIdx++;

    local.submitDraftPick(poolIdx);

    // Bot should pick after 1200ms
    vi.advanceTimersByTime(1200);
    vi.advanceTimersByTime(1200);

    const botPicks = dispatches.filter(
      d => d.type === 'DRAFT_PICK' && (d as any).playerIndex === botSlot,
    );
    expect(botPicks.length).toBeGreaterThanOrEqual(1);

    vi.useRealTimers();
  });

  it('rejects pick when not human turn', () => {
    vi.useFakeTimers();
    const { dispatches, local } = collectDispatches({ draftMode: true });
    local.start();

    const humanSlot = getHumanSlot(dispatches);
    const botSlot: 0 | 1 = (1 - humanSlot) as 0 | 1;

    // Advance through any initial bot picks
    if (SNAKE_ORDER[0] === botSlot) {
      // Bot picks at consecutive snake positions
      for (let i = 0; i < SNAKE_ORDER.length && SNAKE_ORDER[i] === botSlot; i++) {
        vi.advanceTimersByTime(1200);
      }
    }

    // Human picks
    const allPicked = dispatches
      .filter(d => d.type === 'DRAFT_PICK')
      .map(d => (d as any).poolIndex);
    let poolIdx = 0;
    while (allPicked.includes(poolIdx)) poolIdx++;

    local.submitDraftPick(poolIdx);

    // Figure out how many picks have happened so far
    const picksSoFar = dispatches.filter(d => d.type === 'DRAFT_PICK').length;

    // Next snake position should be bot's turn — verify human can't pick
    // (Don't advance timers so bot hasn't acted yet)
    if (picksSoFar < SNAKE_ORDER.length && SNAKE_ORDER[picksSoFar] === botSlot) {
      const picksBefore = dispatches.filter(d => d.type === 'DRAFT_PICK').length;
      local.submitDraftPick(10); // try to pick
      const picksAfter = dispatches.filter(d => d.type === 'DRAFT_PICK').length;
      expect(picksAfter).toBe(picksBefore);
    }

    vi.useRealTimers();
  });

  it('rejects picking already-picked Pokemon', async () => {
    vi.useFakeTimers();
    const { dispatches, local } = collectDispatches({ draftMode: true });
    local.start();

    const humanSlot = getHumanSlot(dispatches);
    const botSlot: 0 | 1 = (1 - humanSlot) as 0 | 1;

    // If bot picks first, advance time
    if (SNAKE_ORDER[0] === botSlot) {
      vi.advanceTimersByTime(1200);
      vi.advanceTimersByTime(1200);
    }

    local.submitDraftPick(3);
    // Wait for bot picks
    vi.advanceTimersByTime(1200);
    vi.advanceTimersByTime(1200);

    // Now it should be human's turn again — try to pick the same index
    const picksBefore = dispatches.filter(d => d.type === 'DRAFT_PICK').length;
    local.submitDraftPick(3); // already picked by human
    const picksAfter = dispatches.filter(d => d.type === 'DRAFT_PICK').length;

    expect(picksAfter).toBe(picksBefore);
    vi.useRealTimers();
  });

  it('classic mode draft pool has only Gen 1-4 Pokemon', () => {
    const { dispatches, local } = collectDispatches({ draftMode: true, maxGen: 4 });
    local.start();

    const draftStart = dispatches.find(d => d.type === 'DRAFT_START');
    if (draftStart?.type === 'DRAFT_START') {
      for (const entry of draftStart.pool) {
        expect(entry.species.generation).toBeLessThanOrEqual(4);
      }
    }
  });

  it('full draft completes and dispatches DRAFT_COMPLETE', () => {
    vi.useFakeTimers();
    const { dispatches, local } = collectDispatches({ draftMode: true });
    local.start();

    const humanSlot = getHumanSlot(dispatches);
    const botSlot: 0 | 1 = (1 - humanSlot) as 0 | 1;

    // Simulate full draft using snake order with correct slot mapping
    for (let pick = 0; pick < SNAKE_ORDER.length; pick++) {
      const currentSlot = SNAKE_ORDER[pick];
      if (currentSlot === botSlot) {
        // Bot's turn — advance timers
        vi.advanceTimersByTime(1200);
      } else {
        // Human's turn — find an unpicked index
        const allPicked = dispatches
          .filter(d => d.type === 'DRAFT_PICK')
          .map(d => (d as any).poolIndex);
        let nextPoolIdx = 0;
        while (allPicked.includes(nextPoolIdx)) nextPoolIdx++;
        local.submitDraftPick(nextPoolIdx);
      }
    }

    // Give any remaining bot timers time to fire
    vi.advanceTimersByTime(1200);
    vi.advanceTimersByTime(1200);

    const complete = dispatches.find(d => d.type === 'DRAFT_COMPLETE');
    expect(complete).toBeDefined();
    if (complete?.type === 'DRAFT_COMPLETE') {
      expect(complete.yourTeam).toHaveLength(6);
    }

    vi.useRealTimers();
  });
});
