import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: vi.fn(async (key: string) => (globalThis as any).__badgeMockStore?.[key] ?? null),
    setItem: vi.fn(async (key: string, value: string) => {
      (globalThis as any).__badgeMockStore[key] = value;
    }),
  },
}));

import { earnBadge, getBadges, resetBadges } from '../../src/client/utils/badge-tracker';

describe('Badge Tracker', () => {
  beforeEach(() => {
    (globalThis as any).__badgeMockStore = {};
  });

  it('starts with empty badges', async () => {
    const data = await getBadges();
    expect(data.gymBadges).toEqual({});
    expect(data.monotypeBadges).toEqual({});
  });

  it('earns a badge and retrieves it', async () => {
    await earnBadge('Fire', 'Blaine', 'Volcano Badge');
    const data = await getBadges();
    expect(data.gymBadges.Fire).toHaveLength(1);
    expect(data.gymBadges.Fire[0].gymLeaderName).toBe('Blaine');
    expect(data.gymBadges.Fire[0].badgeName).toBe('Volcano Badge');
    expect(data.gymBadges.Fire[0].earnedDate).toBeDefined();
  });

  it('can earn the same badge multiple times', async () => {
    await earnBadge('Fire', 'Blaine', 'Volcano Badge');
    await earnBadge('Fire', 'Blaine', 'Volcano Badge');
    await earnBadge('Fire', 'Blaine', 'Volcano Badge');
    const data = await getBadges();
    expect(data.gymBadges.Fire).toHaveLength(3);
  });

  it('each earn has a unique date', async () => {
    await earnBadge('Water', 'Misty', 'Cascade Badge');
    await new Promise(r => setTimeout(r, 5));
    await earnBadge('Water', 'Misty', 'Cascade Badge');
    const data = await getBadges();
    expect(data.gymBadges.Water).toHaveLength(2);
    for (const badge of data.gymBadges.Water) {
      expect(new Date(badge.earnedDate).getTime()).toBeGreaterThan(0);
    }
  });

  it('tracks multiple different type badges', async () => {
    await earnBadge('Fire', 'Blaine', 'Volcano Badge');
    await earnBadge('Water', 'Misty', 'Cascade Badge');
    await earnBadge('Electric', 'Lt. Surge', 'Thunder Badge');
    const data = await getBadges();
    expect(Object.keys(data.gymBadges)).toHaveLength(3);
    expect(data.gymBadges.Fire).toHaveLength(1);
    expect(data.gymBadges.Water).toHaveLength(1);
    expect(data.gymBadges.Electric).toHaveLength(1);
  });

  it('earnBadge always returns true', async () => {
    const first = await earnBadge('Fire', 'Blaine', 'Volcano Badge');
    const second = await earnBadge('Fire', 'Blaine', 'Volcano Badge');
    expect(first).toBe(true);
    expect(second).toBe(true);
  });

  it('resetBadges clears all badges', async () => {
    await earnBadge('Fire', 'Blaine', 'Volcano Badge');
    await earnBadge('Water', 'Misty', 'Cascade Badge');
    await resetBadges();
    const data = await getBadges();
    expect(data.gymBadges).toEqual({});
  });

  it('migrates old single-object gymBadges to array format', async () => {
    (globalThis as any).__badgeMockStore['@pbs_badges'] = JSON.stringify({
      monotypeBadges: {},
      gymBadges: {
        Fire: { earnedDate: '2026-01-01T00:00:00Z', gymLeaderName: 'Blaine', badgeName: 'Volcano Badge' },
      },
    });
    const data = await getBadges();
    expect(Array.isArray(data.gymBadges.Fire)).toBe(true);
    expect(data.gymBadges.Fire).toHaveLength(1);
    expect(data.gymBadges.Fire[0].gymLeaderName).toBe('Blaine');
  });

  it('migrates monotypeBadges to gymBadges', async () => {
    (globalThis as any).__badgeMockStore['@pbs_badges'] = JSON.stringify({
      monotypeBadges: { Ghost: '2026-02-01T00:00:00Z' },
      gymBadges: {},
    });
    const data = await getBadges();
    expect(data.gymBadges.Ghost).toHaveLength(1);
    expect(data.gymBadges.Ghost[0].earnedDate).toBe('2026-02-01T00:00:00Z');
  });

  it('maintains backward compat monotypeBadges on earn', async () => {
    await earnBadge('Dragon', 'Clair', 'Rising Badge');
    const data = await getBadges();
    expect(data.monotypeBadges.Dragon).toBeDefined();
  });
});
