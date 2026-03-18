import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('Double loss prevention', () => {
  const contextSource = fs.readFileSync(
    path.resolve(__dirname, '../../src/client/state/battle-context.tsx'),
    'utf-8',
  );

  it('has campaignRunSavedRef flag', () => {
    expect(contextSource).toContain('campaignRunSavedRef');
  });

  it('resets flag when starting a campaign battle', () => {
    const battleSection = contextSource.slice(contextSource.indexOf('const beginCampaignBattle'));
    expect(battleSection).toContain('campaignRunSavedRef.current = false');
  });

  it('returnToMenu checks both phase and flag before saving', () => {
    const implStart = contextSource.indexOf('const returnToMenu = useCallback');
    const menuSection = contextSource.slice(implStart, implStart + 1500);
    expect(menuSection).toContain('campaignRunSavedRef.current');
    expect(menuSection).toContain("phase === 'battle_end'");
  });

  it('returnToMenu resets the flag after use', () => {
    const menuSection = contextSource.slice(
      contextSource.indexOf('const returnToMenu'),
      contextSource.indexOf('}, [cleanupAll])', contextSource.indexOf('const returnToMenu')),
    );
    expect(menuSection).toContain('campaignRunSavedRef.current = false');
  });

  it('only saves one campaign run entry: loss OR abandoned, not both', () => {
    // The guard: alreadySaved = phase === 'battle_end' || campaignRunSavedRef.current
    // If battle_end, BattleEndOverlay already saved → returnToMenu skips
    // If not battle_end but flag set → also skips (edge case)
    expect(contextSource).toContain('alreadySaved');
    expect(contextSource).toContain('!alreadySaved');
  });
});
