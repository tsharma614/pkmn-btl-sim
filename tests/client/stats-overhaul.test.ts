import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

// Mock AsyncStorage
vi.mock('@react-native-async-storage/async-storage', () => {
  const store: Record<string, string> = {};
  return {
    default: {
      getItem: vi.fn((key: string) => Promise.resolve(store[key] ?? null)),
      setItem: vi.fn((key: string, value: string) => { store[key] = value; return Promise.resolve(); }),
      removeItem: vi.fn((key: string) => { delete store[key]; return Promise.resolve(); }),
    },
  };
});

describe('Phase 4 — Stats page overhaul', () => {
  describe('Storage layer', () => {
    beforeEach(() => {
      vi.resetModules();
    });

    it('recordBattlePokemonStats accumulates KOs and damage', async () => {
      const { recordBattlePokemonStats, getPokemonStats } = await import('../../src/client/utils/stats-storage');
      await recordBattlePokemonStats([
        { speciesId: 'charizard', name: 'Charizard', kos: 3, damageDealt: 500 },
        { speciesId: 'pikachu', name: 'Pikachu', kos: 1, damageDealt: 100 },
      ]);
      await recordBattlePokemonStats([
        { speciesId: 'charizard', name: 'Charizard', kos: 2, damageDealt: 300 },
      ]);
      const stats = await getPokemonStats();
      expect(stats['charizard'].kos).toBe(5);
      expect(stats['charizard'].damageDealt).toBe(800);
      expect(stats['pikachu'].kos).toBe(1);
    });

    it('getTopPokemonByKOs returns sorted top N', async () => {
      const { recordBattlePokemonStats, getTopPokemonByKOs } = await import('../../src/client/utils/stats-storage');
      await recordBattlePokemonStats([
        { speciesId: 'a', name: 'A', kos: 10, damageDealt: 0 },
        { speciesId: 'b', name: 'B', kos: 20, damageDealt: 0 },
        { speciesId: 'c', name: 'C', kos: 5, damageDealt: 0 },
      ]);
      const top = await getTopPokemonByKOs(2);
      expect(top).toHaveLength(2);
      expect(top[0].speciesId).toBe('b');
      expect(top[1].speciesId).toBe('a');
    });

    it('recordBattleResult tracks win streak and longest streak', async () => {
      const { recordBattleResult, getOverallStats } = await import('../../src/client/utils/stats-storage');
      await recordBattleResult(true, 60);
      await recordBattleResult(true, 90);
      await recordBattleResult(false, 30);
      await recordBattleResult(true, 45);

      const stats = await getOverallStats();
      expect(stats.totalBattles).toBe(4);
      expect(stats.totalWins).toBe(3);
      expect(stats.totalLosses).toBe(1);
      expect(stats.longestWinStreak).toBe(2);
      expect(stats.currentWinStreak).toBe(1);
      expect(stats.timePlayed).toBe(225);
    });

    it('saveCampaignRun stores runs in order', async () => {
      const { saveCampaignRun, getCampaignRuns } = await import('../../src/client/utils/stats-storage');
      await saveCampaignRun({
        mode: 'gauntlet', progress: 'Battle 5', team: ['Charizard', 'Pikachu'],
        result: 'loss', date: '2026-03-15T00:00:00Z',
      });
      await saveCampaignRun({
        mode: 'gym_career', progress: 'Gym 3', team: ['Mewtwo'],
        result: 'win', date: '2026-03-16T00:00:00Z',
      });
      const runs = await getCampaignRuns();
      expect(runs).toHaveLength(2);
      expect(runs[0].mode).toBe('gym_career'); // most recent first
      expect(runs[1].mode).toBe('gauntlet');
    });

    it('profile defaults and saves correctly', async () => {
      const { getProfile, saveProfile } = await import('../../src/client/utils/stats-storage');
      const defaultProfile = await getProfile();
      expect(defaultProfile.trainerName).toBe('Player');
      expect(defaultProfile.trainerSprite).toBe('red');

      await saveProfile({ trainerName: 'Ash', trainerSprite: 'ethan' });
      const updated = await getProfile();
      expect(updated.trainerName).toBe('Ash');
      expect(updated.trainerSprite).toBe('ethan');
    });
  });

  describe('StatsScreen component source', () => {
    const source = fs.readFileSync(
      path.resolve(__dirname, '../../src/client/components/StatsScreen.tsx'),
      'utf-8',
    );

    it('has tabs: General, Pokemon/Leaderboard, Campaign, Recent', () => {
      expect(source).toContain("'general'");
      expect(source).toContain("'leaderboard'");
      expect(source).toContain("'campaign'");
      expect(source).toContain("'recent'");
    });

    it('has profile section with trainer sprite and editable name', () => {
      expect(source).toContain('trainerSprite');
      expect(source).toContain('editingName');
      expect(source).toContain('profileName');
    });

    it('uses Showdown trainer sprite CDN', () => {
      expect(source).toContain('play.pokemonshowdown.com/sprites/trainers/');
    });

    it('removed old gym badge grid and E4 section', () => {
      expect(source).not.toContain('badgeGrid');
      expect(source).not.toContain('GYM BADGES');
      expect(source).not.toContain('ELITE FOUR');
      expect(source).not.toContain('BEGIN CHALLENGE');
    });

    it('removed old Stats & Badges naming', () => {
      expect(source).not.toContain('STATS & BADGES');
    });

    it('shows overall stats in general tab', () => {
      expect(source).toContain('Total Battles');
      expect(source).toContain('Favorite Pokemon');
      expect(source).toContain('Longest Win Streak');
      expect(source).toContain('Time Played');
    });

    it('shows Pokemon leaderboard with KOs and damage', () => {
      expect(source).toContain('leaderRow');
      expect(source).toContain('KOs');
      expect(source).toContain('dmg');
    });
  });
});
