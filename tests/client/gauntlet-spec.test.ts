import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('Gauntlet — spec requirements', () => {
  const contextSource = fs.readFileSync(
    path.resolve(__dirname, '../../src/client/state/battle-context.tsx'),
    'utf-8',
  );

  it('opponents are numbered: Opponent #1, #2, etc.', () => {
    expect(contextSource).toContain("opponentName: 'Opponent #1'");
    expect(contextSource).toContain('`Opponent #${nextBattle + 1}`');
  });

  it('move select phase on starter only (moveSelection: true in GAUNTLET_START)', () => {
    const reducerSource = fs.readFileSync(
      path.resolve(__dirname, '../../src/client/state/battle-reducer.ts'),
      'utf-8',
    );
    // GAUNTLET_START should set moveSelection: true
    const gauntletStartSection = reducerSource.slice(reducerSource.indexOf("case 'GAUNTLET_START'"));
    expect(gauntletStartSection).toContain('moveSelection: true');
  });

  it('gauntletStarterPicked dispatches DRAFT_COMPLETE to trigger move selection', () => {
    // Find the gauntletStarterPicked implementation
    const implStart = contextSource.indexOf('const gauntletStarterPicked = useCallback');
    const implEnd = contextSource.indexOf('}, [])', implStart);
    const starterImpl = contextSource.slice(implStart, implEnd);
    expect(starterImpl).toContain("'DRAFT_COMPLETE'");
  });

  it('moveSelectionComplete handles gauntlet mode — shows campaign intro', () => {
    // Find the moveSelectionComplete implementation
    const implStart = contextSource.indexOf('const moveSelectionComplete = useCallback');
    const implEnd = contextSource.indexOf('}, [])', implStart);
    const moveSelImpl = contextSource.slice(implStart, implEnd);
    expect(moveSelImpl).toContain("campaignMode === 'gauntlet'");
    expect(moveSelImpl).toContain("'CAMPAIGN_INTRO'");
  });

  it('uses proper difficulty scaling via generateGauntletTeam', () => {
    expect(contextSource).toContain('generateGauntletTeam');
  });

  it('uses taglines from taglines module', () => {
    expect(contextSource).toContain('getGauntletTagline');
  });

  it('stolen Pokemon kept as-is (no move customization on steal)', () => {
    // Find the gauntletStealComplete implementation (the useCallback, not the interface)
    const implStart = contextSource.indexOf('const gauntletStealComplete = useCallback');
    const implEnd = contextSource.indexOf('}, [])', implStart);
    const stealImpl = contextSource.slice(implStart, implEnd);
    // Should NOT contain pickSet (no re-building moves on stolen Pokemon)
    expect(stealImpl).not.toContain('pickSet');
  });

  it('full heal between battles (healedTeam in beginCampaignBattle)', () => {
    const battleSection = contextSource.slice(contextSource.indexOf('beginCampaignBattle'));
    expect(battleSection).toContain('currentHp: p.stats.hp');
    expect(battleSection).toContain('isAlive: true');
    expect(battleSection).toContain('status: null');
  });
});

describe('Gym Career — spec requirements', () => {
  const contextSource = fs.readFileSync(
    path.resolve(__dirname, '../../src/client/state/battle-context.tsx'),
    'utf-8',
  );

  it('uses generateGymTeam for gym battles', () => {
    expect(contextSource).toContain('generateGymTeam');
  });

  it('uses generateE4Team for E4 battles', () => {
    expect(contextSource).toContain('generateE4Team');
  });

  it('uses generateChampionCpuTeam for champion', () => {
    expect(contextSource).toContain('generateChampionCpuTeam');
  });

  it('E4 uses friend pool names (TMNT from elite-four.ts)', () => {
    expect(contextSource).toContain('getEliteFourMember');
    // E4 names used in BattleScreen E4LockScreen or battle-context
    const battleScreenSource = fs.readFileSync(
      path.resolve(__dirname, '../../src/client/components/BattleScreen.tsx'),
      'utf-8',
    );
    expect(battleScreenSource).toContain('Leonardo');
    expect(battleScreenSource).toContain('Donatello');
  });

  it('champion uses friend pool name', () => {
    const battleScreenSource = fs.readFileSync(
      path.resolve(__dirname, '../../src/client/components/BattleScreen.tsx'),
      'utf-8',
    );
    expect(battleScreenSource).toContain('Professor Oak');
  });

  it('uses type-specific trash talk for gyms', () => {
    expect(contextSource).toContain('getGymTagline');
  });

  it('uses E4 taglines', () => {
    expect(contextSource).toContain('getE4Tagline');
  });

  it('uses champion taglines', () => {
    expect(contextSource).toContain('getChampionTagline');
  });

  it('auto-saves after each battle via saveGymCareer', () => {
    const advanceSection = contextSource.slice(contextSource.indexOf('advanceCampaign'));
    expect(advanceSection).toContain('saveGymCareer');
  });

  it('clears save on champion win', () => {
    expect(contextSource).toContain('clearGymCareerSave');
  });
});
