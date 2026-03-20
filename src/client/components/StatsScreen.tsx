import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Image,
} from 'react-native';
import { colors, spacing } from '../theme';
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

  const winRate = overall && overall.totalBattles > 0
    ? Math.round((overall.totalWins / overall.totalBattles) * 100)
    : 0;

  // Campaign aggregates
  const gauntletRuns = campaignRuns.filter(r => r.mode === 'gauntlet');
  const gymRuns = campaignRuns.filter(r => r.mode === 'gym_career');
  const gauntletBestStreak = gauntletRuns.reduce((best, r) => {
    const num = r.stageNum ?? (parseInt(r.progress.match(/\d+/)?.[0] ?? '0', 10) || 0);
    return num > best ? num : best;
  }, 0);
  const gymBestRun = gymRuns.reduce((best, r) => {
    const num = r.stageNum ?? (parseInt(r.progress.match(/\d+/)?.[0] ?? '0', 10) || 0);
    return num > best ? num : best;
  }, 0);

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

      {/* Profile section — sticky */}
      {profile && (
        <View style={styles.profileSection}>
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
              <Text style={styles.profileRecord}>
                {overall.totalWins}W – {overall.totalLosses}L · {winRate}% win rate
              </Text>
            )}
          </View>
        </View>
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
            <TouchableOpacity onPress={() => setShowTrainerPicker(false)} style={styles.pickerClose} activeOpacity={0.7}>
              <Text style={styles.pickerCloseText}>Close</Text>
            </TouchableOpacity>
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
          <View>
            <StatCard label="Total Battles" value={overall?.totalBattles ?? 0} />
            <StatCard label="Favorite Pokemon" value={favPokemon ? `${favPokemon.name} (${favPokemon.kos} KOs)` : '–'} />
            <StatCard label="Longest Win Streak" value={overall?.longestWinStreak ?? 0} />
            <StatCard label="Time Played" value={formatTime(overall?.timePlayed ?? 0)} />
          </View>
        )}

        {tab === 'leaderboard' && (
          <View>
            {topPokemon.length === 0 && (
              <Text style={styles.emptyText}>No Pokemon stats recorded yet.</Text>
            )}
            {topPokemon.map((p, i) => (
              <View key={p.speciesId} style={styles.leaderRow}>
                <Text style={styles.leaderRank}>#{i + 1}</Text>
                <View style={styles.leaderSprite}>
                  <PokemonSprite speciesId={p.speciesId} facing="front" size={40} />
                </View>
                <View style={styles.leaderInfo}>
                  <Text style={styles.leaderName}>{p.name}</Text>
                  <Text style={styles.leaderStats}>{p.kos} KOs · {p.damageDealt.toLocaleString()} dmg</Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {tab === 'campaign' && (
          <View>
            <StatCard label="Gauntlet Best Streak" value={gauntletBestStreak} />
            <StatCard label="Gym Career Best Run" value={gymBestRun > 0 ? `Gym ${gymBestRun}` : '–'} />
            <StatCard label="Total Runs" value={campaignRuns.length} />
          </View>
        )}

        {tab === 'recent' && (
          <View>
            {campaignRuns.length === 0 && (
              <Text style={styles.emptyText}>No campaign runs yet.</Text>
            )}
            {campaignRuns.slice(0, 5).map((run, i) => (
              <View key={`${run.date}-${i}`} style={styles.recentRow}>
                <View style={styles.recentHeader}>
                  <Text style={styles.recentMode}>
                    {run.mode === 'gauntlet' ? 'Gauntlet' : 'Gym Career'}
                  </Text>
                  <Text style={[
                    styles.recentResult,
                    run.result === 'win' ? styles.recentWin : styles.recentLoss,
                  ]}>
                    {run.result === 'win' ? 'WIN' : run.result === 'abandoned' ? 'ABANDONED' : 'LOSS'}
                  </Text>
                </View>
                <Text style={styles.recentProgress}>{run.progress}</Text>
                <Text style={styles.recentTeam}>{run.team.join(', ')}</Text>
                <Text style={styles.recentDate}>
                  {new Date(run.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                </Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
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
    fontSize: 24,
    fontWeight: '900',
    color: colors.accent,
    letterSpacing: 3,
  },

  // Profile
  profileSection: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  trainerSprite: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.surface,
  },
  profileInfo: {
    marginLeft: spacing.md,
    flex: 1,
  },
  profileName: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.text,
  },
  profileRecord: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  nameEditRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  nameInput: {
    flex: 1,
    fontSize: 18,
    fontWeight: '800',
    color: colors.text,
    borderBottomWidth: 2,
    borderBottomColor: colors.accent,
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
    backgroundColor: colors.background,
    borderRadius: 16,
    padding: spacing.lg,
    width: '85%',
    maxHeight: '70%',
    borderWidth: 2,
    borderColor: colors.border,
  },
  pickerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.text,
    textAlign: 'center',
    marginBottom: spacing.md,
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
    borderRadius: 8,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  pickerItemSelected: {
    borderColor: colors.accent,
    backgroundColor: 'rgba(233,69,96,0.15)',
  },
  pickerSprite: {
    width: 40,
    height: 40,
  },
  pickerLabel: {
    fontSize: 9,
    color: colors.textDim,
    marginTop: 2,
  },
  pickerClose: {
    marginTop: spacing.md,
    alignSelf: 'center',
  },
  pickerCloseText: {
    color: colors.accent,
    fontSize: 14,
    fontWeight: '700',
  },

  // Tabs
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  tab: {
    flex: 1,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  tabActive: {
    borderBottomWidth: 2,
    borderBottomColor: colors.accent,
  },
  tabText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textDim,
    letterSpacing: 0.5,
  },
  tabTextActive: {
    color: colors.accent,
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
    fontSize: 13,
    textAlign: 'center',
    marginTop: spacing.xl,
  },

  // Stat card
  statCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  statValue: {
    fontSize: 18,
    fontWeight: '900',
    color: colors.text,
  },

  // Leaderboard
  leaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 10,
    padding: spacing.sm,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  leaderRank: {
    fontSize: 14,
    fontWeight: '900',
    color: colors.accent,
    width: 30,
    textAlign: 'center',
  },
  leaderSprite: {
    marginHorizontal: spacing.sm,
  },
  leaderInfo: {
    flex: 1,
  },
  leaderName: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },
  leaderStats: {
    fontSize: 11,
    color: colors.textDim,
    marginTop: 1,
  },

  // Recent runs
  recentRow: {
    backgroundColor: colors.surface,
    borderRadius: 10,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  recentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  recentMode: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text,
  },
  recentResult: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
  },
  recentWin: {
    color: '#4caf50',
  },
  recentLoss: {
    color: '#f44336',
  },
  recentProgress: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 4,
  },
  recentTeam: {
    fontSize: 10,
    color: colors.textDim,
    marginTop: 2,
  },
  recentDate: {
    fontSize: 10,
    color: colors.textDim,
    marginTop: 4,
  },
});
