import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Image,
} from 'react-native';
import { PkCard } from './shared/PkCard';
import { PkButton } from './shared/PkButton';
import { colors, spacing, shadows } from '../theme';
import {
  getOverallStats,
  getTopPokemonByKOs,
  getCampaignRuns,
  getProfile,
  saveProfile,
} from '../utils/stats-storage';
import type {
  OverallStats,
  PokemonStats,
  CampaignRun,
  PlayerProfile,
} from '../utils/stats-storage';
import { PokemonSprite } from './PokemonSprite';

import TRAINER_SPRITE_MAP from '../trainer-sprite-map';

const TRAINER_OPTIONS = [
  'red', 'leaf', 'ethan', 'lyra', 'brendan', 'may',
  'lucas', 'dawn', 'hilbert', 'hilda', 'nate', 'rosa',
  'calem', 'serena', 'elio', 'selene', 'victor', 'gloria',
  'cynthia', 'steven', 'lance', 'blue', 'n', 'iris',
];

type Tab = 'general' | 'leaderboard' | 'campaign' | 'recent';

interface Props {
  onBack: () => void;
  onStartEliteFour?: () => void;
}

function formatTime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  const rm = m % 60;
  return rm > 0 ? `${h}h ${rm}m` : `${h}h`;
}

export function StatsScreen({ onBack }: Props) {
  const [tab, setTab] = useState<Tab>('general');
  const [profile, setProfile] = useState<PlayerProfile | null>(null);
  const [overall, setOverall] = useState<OverallStats | null>(null);
  const [topPokemon, setTopPokemon] = useState<PokemonStats[]>([]);
  const [campaignRuns, setCampaignRuns] = useState<CampaignRun[]>([]);
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [showTrainerPicker, setShowTrainerPicker] = useState(false);

  useEffect(() => {
    let mounted = true;
    Promise.all([
      getProfile(),
      getOverallStats(),
      getTopPokemonByKOs(10),
      getCampaignRuns(),
    ]).then(([p, overall, topPokemon, runs]) => {
      if (!mounted) return;
      setProfile(p);
      setNameInput(p.trainerName);
      setOverall(overall);
      setTopPokemon(topPokemon);
      setCampaignRuns(runs);
    });
    return () => { mounted = false; };
  }, []);

  const handleSaveName = () => {
    const trimmed = nameInput.trim() || 'Player';
    setEditingName(false);
    if (profile) {
      const updated = { ...profile, trainerName: trimmed };
      setProfile(updated);
      saveProfile(updated);
    }
  };

  const handlePickTrainer = (sprite: string) => {
    setShowTrainerPicker(false);
    if (profile) {
      const updated = { ...profile, trainerSprite: sprite };
      setProfile(updated);
      saveProfile(updated);
    }
  };

  const winRate = useMemo(() =>
    overall && overall.totalBattles > 0
      ? Math.round((overall.totalWins / overall.totalBattles) * 100)
      : 0,
    [overall],
  );

  // Campaign aggregates
  const { gauntletBestStreak, gymBestRun } = useMemo(() => {
    const gauntletRuns = campaignRuns.filter(r => r.mode === 'gauntlet');
    const gymRuns = campaignRuns.filter(r => r.mode === 'gym_career');
    const gauntletBest = gauntletRuns.reduce((best, r) => {
      const num = r.stageNum ?? (parseInt(r.progress.match(/\d+/)?.[0] ?? '0', 10) || 0);
      return num > best ? num : best;
    }, 0);
    const gymBest = gymRuns.reduce((best, r) => {
      const num = r.stageNum ?? (parseInt(r.progress.match(/\d+/)?.[0] ?? '0', 10) || 0);
      return num > best ? num : best;
    }, 0);
    return { gauntletBestStreak: gauntletBest, gymBestRun: gymBest };
  }, [campaignRuns]);

  // Favorite Pokemon (most KOs)
  const favPokemon = topPokemon.length > 0 ? topPokemon[0] : null;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn} activeOpacity={0.7}>
          <Text style={styles.backText}>{'< Back'}</Text>
        </TouchableOpacity>
        <Text style={styles.title}>STATS</Text>
      </View>

      {/* Profile section */}
      {profile && (
        <PkCard style={styles.profileCard} accentColor={colors.primary}>
          <TouchableOpacity onPress={() => setShowTrainerPicker(true)} activeOpacity={0.7}>
            <Image
              source={TRAINER_SPRITE_MAP[profile.trainerSprite] ?? { uri: '' }}
              style={styles.trainerSprite}
            />
          </TouchableOpacity>
          <View style={styles.profileInfo}>
            {editingName ? (
              <View style={styles.nameEditRow}>
                <TextInput
                  style={styles.nameInput}
                  value={nameInput}
                  onChangeText={setNameInput}
                  onSubmitEditing={handleSaveName}
                  onBlur={handleSaveName}
                  maxLength={16}
                  autoFocus
                  autoCapitalize="words"
                  autoCorrect={false}
                />
              </View>
            ) : (
              <TouchableOpacity onPress={() => setEditingName(true)} activeOpacity={0.7}>
                <Text style={styles.profileName}>{profile.trainerName}</Text>
              </TouchableOpacity>
            )}
            {overall && (
              <View style={styles.profileRecordRow}>
                <Text style={styles.profileWins}>{overall.totalWins}W</Text>
                <Text style={styles.profileDash}> - </Text>
                <Text style={styles.profileLosses}>{overall.totalLosses}L</Text>
                <View style={styles.winRatePill}>
                  <Text style={styles.winRateText}>{winRate}%</Text>
                </View>
              </View>
            )}
          </View>
        </PkCard>
      )}

      {/* Trainer sprite picker modal */}
      {showTrainerPicker && (
        <View style={styles.pickerOverlay}>
          <View style={styles.pickerModal}>
            <Text style={styles.pickerTitle}>Choose Trainer</Text>
            <ScrollView contentContainerStyle={styles.pickerGrid}>
              {TRAINER_OPTIONS.map(sprite => (
                <TouchableOpacity
                  key={sprite}
                  style={[
                    styles.pickerItem,
                    profile?.trainerSprite === sprite && styles.pickerItemSelected,
                  ]}
                  onPress={() => handlePickTrainer(sprite)}
                  activeOpacity={0.7}
                >
                  <Image
                    source={TRAINER_SPRITE_MAP[sprite] ?? { uri: '' }}
                    style={styles.pickerSprite}
                  />
                  <Text style={styles.pickerLabel}>{sprite}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <PkButton
              title="Close"
              variant="ghost"
              size="sm"
              onPress={() => setShowTrainerPicker(false)}
            />
          </View>
        </View>
      )}

      {/* Tab bar */}
      <View style={styles.tabBar}>
        {([
          { key: 'general' as Tab, label: 'General' },
          { key: 'leaderboard' as Tab, label: 'Pokemon' },
          { key: 'campaign' as Tab, label: 'Campaign' },
          { key: 'recent' as Tab, label: 'Recent' },
        ]).map(t => (
          <TouchableOpacity
            key={t.key}
            style={[styles.tab, tab === t.key && styles.tabActive]}
            onPress={() => setTab(t.key)}
            activeOpacity={0.7}
          >
            <Text style={[styles.tabText, tab === t.key && styles.tabTextActive]}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Tab content */}
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {tab === 'general' && (
          <View style={styles.statGrid}>
            <StatCard label="Total Battles" value={overall?.totalBattles ?? 0} accent={colors.primary} />
            <StatCard label="Favorite Pokemon" value={favPokemon ? `${favPokemon.name}` : '--'} sub={favPokemon ? `${favPokemon.kos} KOs` : undefined} accent={colors.accentGold} />
            <StatCard label="Win Streak" value={overall?.longestWinStreak ?? 0} accent={colors.hpGreen} />
            <StatCard label="Time Played" value={formatTime(overall?.timePlayed ?? 0)} accent={colors.textSecondary} />
          </View>
        )}

        {tab === 'leaderboard' && (
          <View>
            {topPokemon.length === 0 && (
              <Text style={styles.emptyText}>No Pokemon stats recorded yet.</Text>
            )}
            {topPokemon.map((p, i) => (
              <PkCard key={p.speciesId} style={styles.leaderCard} padding="compact">
                <View style={styles.leaderRow}>
                  <View style={[styles.leaderRankBadge, i === 0 && styles.leaderRankGold, i === 1 && styles.leaderRankSilver, i === 2 && styles.leaderRankBronze]}>
                    <Text style={styles.leaderRank}>#{i + 1}</Text>
                  </View>
                  <View style={styles.leaderSprite}>
                    <PokemonSprite speciesId={p.speciesId} facing="front" size={44} />
                  </View>
                  <View style={styles.leaderInfo}>
                    <Text style={styles.leaderName}>{p.name}</Text>
                    <View style={styles.leaderStatRow}>
                      <Text style={styles.leaderKOs}>{p.kos} KOs</Text>
                      <Text style={styles.leaderDmg}>{p.damageDealt.toLocaleString()} dmg</Text>
                    </View>
                  </View>
                </View>
              </PkCard>
            ))}
          </View>
        )}

        {tab === 'campaign' && (
          <View style={styles.statGrid}>
            <StatCard label="Gauntlet Best" value={gauntletBestStreak} accent={colors.primary} />
            <StatCard label="Gym Career Best" value={gymBestRun > 0 ? `Gym ${gymBestRun}` : '--'} accent={colors.accentGold} />
            <StatCard label="Total Runs" value={campaignRuns.length} accent={colors.textSecondary} />
          </View>
        )}

        {tab === 'recent' && (
          <View>
            {campaignRuns.length === 0 && (
              <Text style={styles.emptyText}>No campaign runs yet.</Text>
            )}
            {campaignRuns.slice(0, 5).map((run, i) => (
              <PkCard key={`${run.date}-${i}`} style={styles.recentCard} padding="normal">
                <View style={styles.recentHeader}>
                  <Text style={styles.recentMode}>
                    {run.mode === 'gauntlet' ? 'Gauntlet' : 'Gym Career'}
                  </Text>
                  <View style={[styles.recentResultBadge, run.result === 'win' ? styles.recentWinBadge : styles.recentLossBadge]}>
                    <Text style={[styles.recentResult, run.result === 'win' ? styles.recentWin : styles.recentLoss]}>
                      {run.result === 'win' ? 'WIN' : run.result === 'abandoned' ? 'QUIT' : 'LOSS'}
                    </Text>
                  </View>
                </View>
                <Text style={styles.recentProgress}>{run.progress}</Text>
                <Text style={styles.recentTeam}>{run.team.join(', ')}</Text>
                <Text style={styles.recentDate}>
                  {new Date(run.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                </Text>
              </PkCard>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

function StatCard({ label, value, sub, accent }: { label: string; value: string | number; sub?: string; accent?: string }) {
  return (
    <PkCard style={styles.statCard} accentColor={accent}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
      {sub ? <Text style={styles.statSub}>{sub}</Text> : null}
    </PkCard>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    paddingTop: spacing.lg,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  backBtn: {
    marginBottom: spacing.sm,
  },
  backText: {
    color: colors.textSecondary,
    fontSize: 14,
    fontWeight: '600',
  },
  title: {
    fontSize: 28,
    fontWeight: '900',
    color: colors.primary,
    letterSpacing: 4,
  },

  // Profile
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm,
  },
  trainerSprite: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.surfaceLight,
    borderWidth: 2,
    borderColor: colors.border,
  },
  profileInfo: {
    marginLeft: spacing.md,
    flex: 1,
  },
  profileName: {
    fontSize: 20,
    fontWeight: '900',
    color: colors.text,
    letterSpacing: 1,
  },
  profileRecordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  profileWins: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.hpGreen,
  },
  profileDash: {
    fontSize: 14,
    color: colors.textDim,
  },
  profileLosses: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.primary,
  },
  winRatePill: {
    marginLeft: spacing.sm,
    backgroundColor: 'rgba(245,158,11,0.15)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  winRateText: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.accentGold,
  },
  nameEditRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  nameInput: {
    flex: 1,
    fontSize: 20,
    fontWeight: '800',
    color: colors.text,
    borderBottomWidth: 2,
    borderBottomColor: colors.primary,
    paddingVertical: 2,
  },

  // Trainer picker
  pickerOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
  },
  pickerModal: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    padding: spacing.lg,
    width: '85%',
    maxHeight: '70%',
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.lg,
  },
  pickerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.text,
    textAlign: 'center',
    marginBottom: spacing.md,
    letterSpacing: 1,
  },
  pickerGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  pickerItem: {
    alignItems: 'center',
    padding: spacing.xs,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  pickerItemSelected: {
    borderColor: colors.primary,
    backgroundColor: 'rgba(227,53,13,0.12)',
  },
  pickerSprite: {
    width: 44,
    height: 44,
  },
  pickerLabel: {
    fontSize: 9,
    color: colors.textDim,
    marginTop: 2,
    fontWeight: '600',
  },

  // Tabs
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    marginTop: spacing.xs,
  },
  tab: {
    flex: 1,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  tabActive: {
    borderBottomWidth: 3,
    borderBottomColor: colors.primary,
  },
  tabText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textDim,
    letterSpacing: 0.5,
  },
  tabTextActive: {
    color: colors.text,
    fontWeight: '800',
  },

  // Content
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.lg,
    paddingBottom: 40,
  },
  emptyText: {
    color: colors.textDim,
    fontSize: 14,
    textAlign: 'center',
    marginTop: spacing.xl,
  },

  // Stat card grid
  statGrid: {
    gap: spacing.md,
  },
  statCard: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
  },
  statLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
    letterSpacing: 0.5,
    marginBottom: spacing.sm,
  },
  statValue: {
    fontSize: 36,
    fontWeight: '900',
    color: colors.text,
    letterSpacing: 1,
  },
  statSub: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.accentGold,
    marginTop: spacing.xs,
  },

  // Leaderboard
  leaderCard: {
    marginBottom: spacing.sm,
  },
  leaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  leaderRankBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.surfaceLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  leaderRankGold: {
    backgroundColor: 'rgba(245,158,11,0.2)',
  },
  leaderRankSilver: {
    backgroundColor: 'rgba(192,192,192,0.2)',
  },
  leaderRankBronze: {
    backgroundColor: 'rgba(205,127,50,0.2)',
  },
  leaderRank: {
    fontSize: 13,
    fontWeight: '900',
    color: colors.accentGold,
  },
  leaderSprite: {
    marginHorizontal: spacing.sm,
  },
  leaderInfo: {
    flex: 1,
  },
  leaderName: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.text,
  },
  leaderStatRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: 2,
  },
  leaderKOs: {
    fontSize: 12,
    color: colors.primary,
    fontWeight: '700',
  },
  leaderDmg: {
    fontSize: 12,
    color: colors.textDim,
    fontWeight: '600',
  },

  // Recent runs
  recentCard: {
    marginBottom: spacing.md,
  },
  recentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  recentMode: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: 0.5,
  },
  recentResultBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: 6,
  },
  recentWinBadge: {
    backgroundColor: 'rgba(34,197,94,0.15)',
  },
  recentLossBadge: {
    backgroundColor: 'rgba(227,53,13,0.12)',
  },
  recentResult: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
  },
  recentWin: {
    color: colors.hpGreen,
  },
  recentLoss: {
    color: colors.primary,
  },
  recentProgress: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: spacing.sm,
    fontWeight: '600',
  },
  recentTeam: {
    fontSize: 11,
    color: colors.textDim,
    marginTop: 3,
  },
  recentDate: {
    fontSize: 10,
    color: colors.textDim,
    marginTop: spacing.xs,
    fontWeight: '600',
  },
});
