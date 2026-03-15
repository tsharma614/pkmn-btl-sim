import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { getWinLoss } from '../utils/battle-history';
import { getBadges } from '../utils/badge-tracker';
import type { BadgeData } from '../utils/badge-tracker';
import { MONOTYPE_TYPES } from '../../engine/draft-pool';
import { GYM_LEADERS } from '../../data/gym-leaders';
import { colors, spacing, typeColors } from '../theme';

interface Props {
  onBack: () => void;
}

export function StatsScreen({ onBack }: Props) {
  const [record, setRecord] = useState<{ wins: number; losses: number } | null>(null);
  const [badges, setBadges] = useState<BadgeData | null>(null);

  useEffect(() => {
    getWinLoss().then(setRecord);
    getBadges().then(setBadges);
  }, []);

  const earnedCount = badges ? Object.keys(badges.gymBadges).length : 0;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn} activeOpacity={0.7}>
          <Text style={styles.backText}>{'< Back'}</Text>
        </TouchableOpacity>
        <Text style={styles.title}>STATS</Text>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {/* Win/Loss Record */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>BATTLE RECORD</Text>
          {record && (
            <View style={styles.recordRow}>
              <View style={styles.recordItem}>
                <Text style={styles.recordNumber}>{record.wins}</Text>
                <Text style={styles.recordLabel}>Wins</Text>
              </View>
              <View style={styles.recordDivider} />
              <View style={styles.recordItem}>
                <Text style={styles.recordNumber}>{record.losses}</Text>
                <Text style={styles.recordLabel}>Losses</Text>
              </View>
              <View style={styles.recordDivider} />
              <View style={styles.recordItem}>
                <Text style={styles.recordNumber}>
                  {record.wins + record.losses > 0
                    ? Math.round((record.wins / (record.wins + record.losses)) * 100) + '%'
                    : '-'}
                </Text>
                <Text style={styles.recordLabel}>Win Rate</Text>
              </View>
            </View>
          )}
        </View>

        {/* Gym Badges */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>GYM BADGES</Text>
          <Text style={styles.sectionSubtitle}>
            Defeat the Gym Leaders in Monotype Draft ({earnedCount}/{MONOTYPE_TYPES.length})
          </Text>
          <View style={styles.badgeGrid}>
            {MONOTYPE_TYPES.map(type => {
              const gymBadge = badges?.gymBadges[type];
              const leader = GYM_LEADERS[type];
              const earned = !!gymBadge;
              return (
                <View
                  key={type}
                  style={[
                    styles.badgeCard,
                    earned
                      ? { backgroundColor: typeColors[type] || '#666', borderColor: typeColors[type] || '#666' }
                      : styles.badgeCardLocked,
                  ]}
                >
                  <Text style={[styles.badgeType, earned ? styles.badgeTypeEarned : styles.badgeTypeLocked]}>
                    {leader?.badgeName || type}
                  </Text>
                  <Text style={[styles.badgeLeader, earned ? styles.badgeLeaderEarned : styles.badgeLeaderLocked]}>
                    {leader?.name || type}
                  </Text>
                  <Text style={[styles.badgeTypeLabel, earned ? styles.badgeTypeLabelEarned : styles.badgeTypeLabelLocked]}>
                    {type}
                  </Text>
                  {earned && gymBadge && (
                    <Text style={styles.badgeDate}>
                      {new Date(gymBadge.earnedDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                    </Text>
                  )}
                </View>
              );
            })}
          </View>
        </View>
      </ScrollView>
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
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
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
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.lg,
    paddingBottom: 40,
  },
  section: {
    marginBottom: spacing.xl,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.textSecondary,
    letterSpacing: 2,
    marginBottom: spacing.sm,
  },
  sectionSubtitle: {
    fontSize: 11,
    color: colors.textDim,
    marginBottom: spacing.md,
  },
  recordRow: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  recordItem: {
    flex: 1,
    alignItems: 'center',
  },
  recordNumber: {
    fontSize: 28,
    fontWeight: '900',
    color: colors.text,
  },
  recordLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textDim,
    marginTop: 2,
  },
  recordDivider: {
    width: 1,
    backgroundColor: colors.border,
    marginHorizontal: spacing.sm,
  },
  badgeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  badgeCard: {
    width: '30%',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 2,
  },
  badgeCardLocked: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderColor: 'rgba(255,255,255,0.08)',
    borderStyle: 'dashed',
  },
  badgeType: {
    fontSize: 10,
    fontWeight: '800',
  },
  badgeTypeEarned: {
    color: '#fff',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  badgeTypeLocked: {
    color: colors.textDim,
    fontSize: 9,
  },
  badgeLeader: {
    fontSize: 11,
    fontWeight: '800',
    marginTop: 1,
  },
  badgeLeaderEarned: {
    color: '#fff',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  badgeLeaderLocked: {
    color: colors.textDim,
  },
  badgeTypeLabel: {
    fontSize: 8,
    fontWeight: '600',
    marginTop: 1,
  },
  badgeTypeLabelEarned: {
    color: 'rgba(255,255,255,0.7)',
  },
  badgeTypeLabelLocked: {
    color: 'rgba(255,255,255,0.2)',
  },
  badgeDate: {
    fontSize: 8,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 2,
    fontWeight: '600',
  },
});
