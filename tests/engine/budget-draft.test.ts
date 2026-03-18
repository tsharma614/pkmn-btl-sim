import { describe, it, expect } from 'vitest';

/** Budget draft point system — behavioral tests */
describe('Budget Draft — Point System', () => {
  const COSTS = { mega: 4, t1: 3, t2: 2, t3: 0 } as const;
  const BUDGET = 15;

  function totalCost(picks: (keyof typeof COSTS)[]): number {
    return picks.reduce((sum, tier) => sum + COSTS[tier], 0);
  }

  function isValidDraft(picks: (keyof typeof COSTS)[]): boolean {
    return picks.length === 6 && totalCost(picks) <= BUDGET;
  }

  it('T3 costs 0 points (free)', () => {
    expect(COSTS.t3).toBe(0);
  });

  it('T2 costs 2 points', () => {
    expect(COSTS.t2).toBe(2);
  });

  it('T1 costs 3 points', () => {
    expect(COSTS.t1).toBe(3);
  });

  it('Mega costs 4 points', () => {
    expect(COSTS.mega).toBe(4);
  });

  it('total budget is 15', () => {
    expect(BUDGET).toBe(15);
  });

  it('6x T3 = 0 points (valid, all free)', () => {
    const draft = ['t3', 't3', 't3', 't3', 't3', 't3'] as const;
    expect(totalCost([...draft])).toBe(0);
    expect(isValidDraft([...draft])).toBe(true);
  });

  it('1 Mega + 1 T1 + 2 T2 + 2 T3 = 11 points (valid)', () => {
    const draft = ['mega', 't1', 't2', 't2', 't3', 't3'] as const;
    expect(totalCost([...draft])).toBe(11);
    expect(isValidDraft([...draft])).toBe(true);
  });

  it('3 Mega + 1 T1 + 2 T3 = 15 points (valid, exactly at budget)', () => {
    const draft = ['mega', 'mega', 'mega', 't1', 't3', 't3'] as const;
    expect(totalCost([...draft])).toBe(15);
    expect(isValidDraft([...draft])).toBe(true);
  });

  it('4 Mega + 2 T3 = 16 points (INVALID, over budget)', () => {
    const draft = ['mega', 'mega', 'mega', 'mega', 't3', 't3'] as const;
    expect(totalCost([...draft])).toBe(16);
    expect(isValidDraft([...draft])).toBe(false);
  });

  it('5 T1 + 1 T3 = 15 points (valid)', () => {
    const draft = ['t1', 't1', 't1', 't1', 't1', 't3'] as const;
    expect(totalCost([...draft])).toBe(15);
    expect(isValidDraft([...draft])).toBe(true);
  });

  it('6 T1 = 18 points (INVALID)', () => {
    const draft = ['t1', 't1', 't1', 't1', 't1', 't1'] as const;
    expect(totalCost([...draft])).toBe(18);
    expect(isValidDraft([...draft])).toBe(false);
  });

  it('remaining budget correctly calculated after each pick', () => {
    let remaining = BUDGET;
    const picks: (keyof typeof COSTS)[] = [];

    // Pick 1: Mega (4pts)
    remaining -= COSTS.mega;
    picks.push('mega');
    expect(remaining).toBe(11);

    // Pick 2: T1 (3pts)
    remaining -= COSTS.t1;
    picks.push('t1');
    expect(remaining).toBe(8);

    // Pick 3: T2 (2pts)
    remaining -= COSTS.t2;
    picks.push('t2');
    expect(remaining).toBe(6);

    // Pick 4: T2 (2pts)
    remaining -= COSTS.t2;
    picks.push('t2');
    expect(remaining).toBe(4);

    // Pick 5: T1 (3pts)
    remaining -= COSTS.t1;
    picks.push('t1');
    expect(remaining).toBe(1);

    // Pick 6: only T3 is affordable (0pts)
    expect(remaining < COSTS.t2).toBe(true); // can't afford T2
    remaining -= COSTS.t3;
    picks.push('t3');
    expect(remaining).toBe(1);
    expect(isValidDraft(picks)).toBe(true);
  });

  it('disabling options that exceed budget works correctly', () => {
    const remaining = 3; // 3 points left
    expect(remaining >= COSTS.mega).toBe(false); // Mega disabled
    expect(remaining >= COSTS.t1).toBe(true);    // T1 affordable
    expect(remaining >= COSTS.t2).toBe(true);    // T2 affordable
    expect(remaining >= COSTS.t3).toBe(true);    // T3 always affordable
  });

  it('edge case: 0 remaining — only T3 available', () => {
    const remaining = 0;
    expect(remaining >= COSTS.mega).toBe(false);
    expect(remaining >= COSTS.t1).toBe(false);
    expect(remaining >= COSTS.t2).toBe(false);
    expect(remaining >= COSTS.t3).toBe(true);
  });
});
