import { describe, it, expect } from 'vitest';
import { GYM_LEADERS } from '../../src/data/gym-leaders';
import { MONOTYPE_TYPES } from '../../src/engine/draft-pool';
import * as fs from 'fs';
import * as path from 'path';

describe('Phase 1 — Monotype rebrand on setup screen', () => {
  const setupScreenPath = path.resolve(__dirname, '../../src/client/components/SetupScreen.tsx');
  const setupScreenSource = fs.readFileSync(setupScreenPath, 'utf-8');

  it('SetupScreen does not import GYM_LEADERS', () => {
    expect(setupScreenSource).not.toContain("import { GYM_LEADERS }");
    expect(setupScreenSource).not.toContain("from '../../data/gym-leaders'");
  });

  it('SetupScreen does not show gym leader names on type chips', () => {
    expect(setupScreenSource).not.toContain('leader.name');
    expect(setupScreenSource).not.toContain('showLeader');
  });

  it('SetupScreen button always says START BATTLE, not CHALLENGE GYM', () => {
    expect(setupScreenSource).not.toContain('CHALLENGE GYM');
    expect(setupScreenSource).toContain('START BATTLE');
  });

  it('SetupScreen does not show "vs {leader}" in modifier descriptions', () => {
    expect(setupScreenSource).not.toMatch(/vs \$\{GYM_LEADERS/);
  });

  it('GYM_LEADERS data still exists for campaign mode use', () => {
    expect(Object.keys(GYM_LEADERS).length).toBe(MONOTYPE_TYPES.length);
    for (const type of MONOTYPE_TYPES) {
      const leader = GYM_LEADERS[type];
      expect(leader).toBeDefined();
      expect(leader.name).toBeTruthy();
      expect(leader.badgeName).toBeTruthy();
    }
  });
});
