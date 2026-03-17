import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('Phase 3 — Main menu redesign', () => {
  const setupScreenPath = path.resolve(__dirname, '../../src/client/components/SetupScreen.tsx');
  const setupScreenSource = fs.readFileSync(setupScreenPath, 'utf-8');

  it('does not display "PBS" title text on main menu', () => {
    // Should not have a standalone PBS title (old: <Text style={styles.title}>PBS</Text>)
    expect(setupScreenSource).not.toMatch(/>PBS</);
  });

  it('does not show record text on main menu', () => {
    expect(setupScreenSource).not.toContain('recordText');
    expect(setupScreenSource).not.toContain('getWinLoss');
  });

  it('does not show trainer name input on main menu', () => {
    expect(setupScreenSource).not.toContain('TextInput');
    expect(setupScreenSource).not.toContain('handleNameChange');
  });

  it('has four main menu buttons: Play Now, Play Online, Campaign, Stats', () => {
    expect(setupScreenSource).toContain('PLAY NOW');
    expect(setupScreenSource).toContain('PLAY ONLINE');
    expect(setupScreenSource).toContain('CAMPAIGN');
    // Stats button (not "STATS & BADGES")
    expect(setupScreenSource).not.toMatch(/>STATS & BADGES</);
    expect(setupScreenSource).toContain('>STATS<');
  });

  it('has consistent button style (menuBtn)', () => {
    expect(setupScreenSource).toContain('menuBtn');
    expect(setupScreenSource).toContain('menuBtnText');
    // Should not have old mixed button styles
    expect(setupScreenSource).not.toContain('playNowBtn');
    expect(setupScreenSource).not.toContain('playOnlineBtn');
    expect(setupScreenSource).not.toContain('statsBtn');
  });

  it('uses PokeballLogo component with configurable size', () => {
    expect(setupScreenSource).toContain('PokeballLogo');
    expect(setupScreenSource).toContain('size =');
  });

  it('has campaign screen state', () => {
    expect(setupScreenSource).toContain("'campaign'");
    expect(setupScreenSource).toContain('CAMPAIGN');
  });

  it('has fewer background sprites (cleaner)', () => {
    const spriteMatches = setupScreenSource.match(/\{ id: '/g);
    // Old had 21 sprites, new should have ~10
    expect(spriteMatches).toBeTruthy();
    expect(spriteMatches!.length).toBeLessThanOrEqual(12);
    expect(spriteMatches!.length).toBeGreaterThanOrEqual(6);
  });
});
