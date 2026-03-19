import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { SeededRNG } from '../../src/utils/rng';
import { generateBudgetDraftOptions, BUDGET_ROLES, BUDGET_TOTAL } from '../../src/engine/draft-pool';

describe('Hotfix Bug 1: Budget Draft gets proper roleOptions', () => {
  it('generateBudgetDraftOptions returns 6 role sections', () => {
    const options = generateBudgetDraftOptions(new SeededRNG(42));
    expect(options).toHaveLength(6);
  });

  it('each role section has the correct role name', () => {
    const options = generateBudgetDraftOptions(new SeededRNG(42));
    const roleNames = options.map(s => s.role);
    expect(roleNames).toContain('Physical Sweeper');
    expect(roleNames).toContain('Special Sweeper');
    expect(roleNames).toContain('Tank');
    expect(roleNames).toContain('Support');
    expect(roleNames).toContain('Pivot');
    expect(roleNames).toContain('Wildcard');
  });

  it('each role has at least 3 options (some types may lack megas)', () => {
    const options = generateBudgetDraftOptions(new SeededRNG(42));
    for (const section of options) {
      expect(section.options.length, `${section.role} should have >= 3 options`).toBeGreaterThanOrEqual(3);
    }
  });

  it('options have correct costs: mega=4, T1=3, T2=2, T3=0', () => {
    const options = generateBudgetDraftOptions(new SeededRNG(42));
    for (const section of options) {
      for (const opt of section.options) {
        if (opt.tier === 0) expect(opt.cost).toBe(4); // mega
        else if (opt.tier === 1) expect(opt.cost).toBe(3);
        else if (opt.tier === 2) expect(opt.cost).toBe(2);
        else expect(opt.cost).toBe(0); // T3/T4
      }
    }
  });

  it('all options have valid species with id and name', () => {
    const options = generateBudgetDraftOptions(new SeededRNG(42));
    for (const section of options) {
      for (const opt of section.options) {
        expect(opt.species.id).toBeTruthy();
        expect(opt.species.name).toBeTruthy();
      }
    }
  });

  it('no duplicate species across all options', () => {
    const options = generateBudgetDraftOptions(new SeededRNG(42));
    const allIds = options.flatMap(s => s.options.map(o => o.species.id));
    expect(new Set(allIds).size).toBe(allIds.length);
  });

  it('BattleScreen passes generated options (not empty array)', () => {
    const source = fs.readFileSync(
      path.resolve(__dirname, '../../src/client/components/BattleScreen.tsx'),
      'utf-8',
    );
    expect(source).not.toContain('roleOptions={[]}');
    expect(source).toContain('generateBudgetDraftOptions');
  });

  it('budget total is 14', () => {
    expect(BUDGET_TOTAL).toBe(14);
  });

  it('has 6 roles', () => {
    expect(BUDGET_ROLES).toHaveLength(6);
  });

  it('different seeds produce different options', () => {
    const opts1 = generateBudgetDraftOptions(new SeededRNG(1));
    const opts2 = generateBudgetDraftOptions(new SeededRNG(999));
    const ids1 = opts1.flatMap(s => s.options.map(o => o.species.id));
    const ids2 = opts2.flatMap(s => s.options.map(o => o.species.id));
    // Not all the same
    const overlap = ids1.filter(id => ids2.includes(id)).length;
    expect(overlap).toBeLessThan(ids1.length);
  });
});

describe('Hotfix Bug 2: GymMapScreen named export', () => {
  it('GymMapScreen uses named export (not default)', () => {
    const source = fs.readFileSync(
      path.resolve(__dirname, '../../src/client/components/GymMapScreen.tsx'),
      'utf-8',
    );
    expect(source).toContain('export function GymMapScreen');
    expect(source).not.toContain('export default');
  });

  it('BattleScreen imports GymMapScreen as named import', () => {
    const source = fs.readFileSync(
      path.resolve(__dirname, '../../src/client/components/BattleScreen.tsx'),
      'utf-8',
    );
    expect(source).toContain("{ GymMapScreen }");
  });
});

describe('Hotfix Bug 3: advanceEliteFour removed', () => {
  it('BattleScreen does not reference advanceEliteFour', () => {
    const source = fs.readFileSync(
      path.resolve(__dirname, '../../src/client/components/BattleScreen.tsx'),
      'utf-8',
    );
    expect(source).not.toContain('advanceEliteFour');
  });

  it('battle-context does not export advanceEliteFour', () => {
    const source = fs.readFileSync(
      path.resolve(__dirname, '../../src/client/state/battle-context.tsx'),
      'utf-8',
    );
    expect(source).not.toContain('advanceEliteFour');
  });
});

describe('Gym Career flow trace', () => {
  const battleScreenSource = fs.readFileSync(
    path.resolve(__dirname, '../../src/client/components/BattleScreen.tsx'),
    'utf-8',
  );
  const contextSource = fs.readFileSync(
    path.resolve(__dirname, '../../src/client/state/battle-context.tsx'),
    'utf-8',
  );
  const reducerSource = fs.readFileSync(
    path.resolve(__dirname, '../../src/client/state/battle-reducer.ts'),
    'utf-8',
  );

  it('Campaign screen → Budget Draft: GYM_CAREER_START sets budget_draft phase', () => {
    expect(reducerSource).toContain("phase: 'budget_draft'");
  });

  it('Budget Draft → Move Select: gymCareerDraftComplete dispatches DRAFT_COMPLETE', () => {
    const fn = contextSource.slice(contextSource.indexOf('const gymCareerDraftComplete'));
    expect(fn).toContain("'DRAFT_COMPLETE'");
  });

  it('Move Select → Gym Map: moveSelectionComplete detects gym_career and dispatches SHOW_GYM_MAP', () => {
    expect(contextSource).toContain("campaignMode === 'gym_career'");
    expect(contextSource).toContain("'SHOW_GYM_MAP'");
  });

  it('Gym Map rendered for gym_map phase', () => {
    expect(battleScreenSource).toContain("state.phase === 'gym_map'");
    expect(battleScreenSource).toContain('GymMapScreen');
  });

  it('Gym Map → Intro Screen: challengeGym dispatches CAMPAIGN_INTRO', () => {
    const fn = contextSource.slice(contextSource.indexOf('const challengeGym'));
    expect(fn).toContain("'CAMPAIGN_INTRO'");
  });

  it('Intro Screen → Battle: beginCampaignBattle creates local battle', () => {
    expect(contextSource).toContain('createLocalBattle');
  });

  it('Battle → Back to Gym Map: advanceCampaign dispatches gym win advance', () => {
    expect(contextSource).toContain("'SHOW_GYM_MAP'");
    expect(contextSource).toContain("'GYM_WIN_ADVANCE'");
  });

  it('All 8 gyms → Shop → E4 Locks: shop appears after gym wins', () => {
    expect(contextSource).toContain("'GYM_WIN_ADVANCE'");
    expect(contextSource).toContain("'SHOP_DONE'");
  });
});
