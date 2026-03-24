/**
 * Lock screen for the Elite Four gauntlet.
 * Shows 4 E4 member locks in a 2x2 grid + 1 champion lock below.
 * Player picks the order they challenge the E4.
 * Champion unlocks only after all 4 E4 members are beaten.
 */
import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Dimensions,
} from 'react-native';
import { PkCard } from './shared/PkCard';
import { PkButton } from './shared/PkButton';
import { colors, spacing, shadows } from '../theme';

interface Member {
  name: string;
  title: string;
  sprite: string;
  tagline: string;
}

interface Props {
  members: Member[];
  champion: Member;
  beatenMembers: boolean[];
  championBeaten: boolean;
  onChallenge: (memberIndex: number) => void;
  onChallengeChampion: () => void;
  onBack: () => void;
  onSaveQuit?: () => void;
  onShop?: () => void;
  shopBalance?: number;
  team?: import('../../server/types').OwnPokemon[];
}

import TRAINER_SPRITE_MAP from '../trainer-sprite-map';
const GOLD = '#FFD700';
const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_GAP = spacing.md;
const CARD_WIDTH = (SCREEN_WIDTH - spacing.xl * 2 - CARD_GAP) / 2;

export function E4LockScreen({
  members,
  champion,
  beatenMembers,
  championBeaten,
  onChallenge,
  onChallengeChampion,
  onBack,
  onSaveQuit,
  onShop,
  shopBalance,
}: Props) {
  // Track which cards have been "revealed" (tapped once to show trainer, second tap starts battle)
  const [revealed, setRevealed] = useState<boolean[]>(members.map(() => false));
  const [championRevealed, setChampionRevealed] = useState(false);

  const beatenCount = useMemo(() => beatenMembers.filter(Boolean).length, [beatenMembers]);
  const allE4Beaten = beatenCount >= 4;

  const handleMemberPress = (index: number) => {
    if (beatenMembers[index]) return; // already beaten, no-op
    if (!revealed[index]) {
      // First tap: reveal the trainer
      setRevealed(prev => {
        const next = [...prev];
        next[index] = true;
        return next;
      });
      return;
    }
    // Second tap: start battle
    onChallenge(index);
  };

  const handleChampionPress = () => {
    if (!allE4Beaten || championBeaten) return;
    if (!championRevealed) {
      setChampionRevealed(true);
      return;
    }
    onChallengeChampion();
  };

  const renderMemberCard = (member: Member, index: number) => {
    const beaten = beatenMembers[index];
    const isRevealed = revealed[index] || beaten;

    return (
      <PkCard
        key={index}
        accentColor={beaten ? undefined : GOLD}
        padding="compact"
        style={[
          styles.card,
          beaten && styles.cardBeaten,
        ] as any}
      >
        <TouchableOpacity
          style={styles.cardTouchable}
          onPress={() => handleMemberPress(index)}
          activeOpacity={beaten ? 1 : 0.7}
        >
          {isRevealed ? (
            <View style={styles.cardInner}>
              <View style={[styles.spriteContainer, beaten && styles.spriteGreyed]}>
                <Image
                  source={TRAINER_SPRITE_MAP[member.sprite] ?? { uri: '' }}
                  style={styles.sprite}
                  resizeMode="contain"
                />
                {beaten && (
                  <View style={styles.checkOverlay}>
                    <Text style={styles.checkmark}>✓</Text>
                  </View>
                )}
              </View>
              <Text style={[styles.memberName, beaten && styles.textGreyed]} numberOfLines={1}>
                {member.name}
              </Text>
              <Text style={[styles.tagline, beaten && styles.textGreyed]} numberOfLines={2}>
                {member.tagline}
              </Text>
            </View>
          ) : (
            <View style={styles.cardInner}>
              <View style={styles.lockContainer}>
                <Text style={styles.lockIcon}>🔒</Text>
              </View>
              <Text style={styles.memberTitle}>{member.title}</Text>
              <Text style={styles.tapHint}>Tap to reveal</Text>
            </View>
          )}
        </TouchableOpacity>
      </PkCard>
    );
  };

  const championLocked = !allE4Beaten;
  const champRevealed = championRevealed || championBeaten;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTopRow}>
          <TouchableOpacity onPress={onBack} activeOpacity={0.7} style={styles.backBtn}>
            <Text style={styles.backText}>{'< Forfeit'}</Text>
          </TouchableOpacity>
          <View style={styles.headerActions}>
            {onShop && (
              <TouchableOpacity onPress={onShop} activeOpacity={0.7} style={styles.headerAction}>
                <Text style={[styles.headerActionText, { color: colors.hpGreen }]}>Shop ({shopBalance ?? 0})</Text>
              </TouchableOpacity>
            )}
            {onSaveQuit && (
              <TouchableOpacity onPress={onSaveQuit} activeOpacity={0.7} style={styles.headerAction}>
                <Text style={styles.headerActionText}>Save</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
        <Text style={styles.title}>ELITE FOUR</Text>
        <View style={styles.progressRow}>
          {[0, 1, 2, 3].map(i => (
            <View
              key={i}
              style={[
                styles.progressDot,
                beatenMembers[i] && styles.progressDotFilled,
              ]}
            />
          ))}
          <Text style={styles.progressText}>{beatenCount}/4 Defeated</Text>
        </View>
      </View>

      {/* 2x2 E4 Grid */}
      <View style={styles.grid}>
        <View style={styles.gridRow}>
          {members.slice(0, 2).map((m, i) => renderMemberCard(m, i))}
        </View>
        <View style={styles.gridRow}>
          {members.slice(2, 4).map((m, i) => renderMemberCard(m, i + 2))}
        </View>
      </View>

      {/* Champion Card */}
      <PkCard
        accentColor={championLocked ? undefined : GOLD}
        padding="normal"
        style={[
          styles.championCard,
          championLocked && styles.championLocked,
          championBeaten && styles.cardBeaten,
        ] as any}
      >
        <TouchableOpacity
          style={styles.championTouchable}
          onPress={handleChampionPress}
          activeOpacity={championLocked || championBeaten ? 1 : 0.7}
        >
          {champRevealed && !championLocked ? (
            <View style={styles.championInner}>
              <View style={[styles.championSpriteContainer, championBeaten && styles.spriteGreyed]}>
                <Image
                  source={TRAINER_SPRITE_MAP[champion.sprite] ?? { uri: '' }}
                  style={styles.championSprite}
                  resizeMode="contain"
                />
                {championBeaten && (
                  <View style={styles.checkOverlay}>
                    <Text style={styles.checkmark}>✓</Text>
                  </View>
                )}
              </View>
              <View style={styles.championText}>
                <Text style={[styles.championName, championBeaten && styles.textGreyed]}>
                  {champion.name}
                </Text>
                <Text style={[styles.championTagline, championBeaten && styles.textGreyed]}>
                  {champion.tagline}
                </Text>
              </View>
            </View>
          ) : (
            <View style={styles.championInner}>
              <View style={styles.championLockContainer}>
                <Text style={styles.championLockIcon}>
                  {championLocked ? '🔒' : '🔓'}
                </Text>
              </View>
              <View style={styles.championText}>
                <Text style={[styles.championLabel, !championLocked && { color: GOLD }]}>
                  CHAMPION
                </Text>
                <Text style={styles.championHint}>
                  {championLocked ? `Defeat all 4 E4 members to unlock` : 'Tap to reveal'}
                </Text>
              </View>
            </View>
          )}
        </TouchableOpacity>
      </PkCard>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
  },

  // Header
  header: {
    marginBottom: spacing.xl,
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  backBtn: {
    paddingVertical: spacing.xs,
  },
  backText: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '600',
  },
  headerActions: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  headerAction: {
    paddingVertical: spacing.xs,
  },
  headerActionText: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '600',
  },
  title: {
    color: colors.accentGold,
    fontSize: 26,
    fontWeight: '900',
    letterSpacing: 4,
    textAlign: 'center',
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  progressDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.surfaceLight,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  progressDotFilled: {
    backgroundColor: colors.accentGold,
    borderColor: colors.accentGold,
    ...shadows.glow(colors.accentGold),
  },
  progressText: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '600',
    marginLeft: spacing.xs,
  },

  // 2x2 Grid
  grid: {
    gap: CARD_GAP,
  },
  gridRow: {
    flexDirection: 'row',
    gap: CARD_GAP,
  },

  // E4 Member Card
  card: {
    width: CARD_WIDTH,
  },
  cardBeaten: {
    opacity: 0.5,
  },
  cardTouchable: {
    minHeight: 140,
  },
  cardInner: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    paddingVertical: spacing.sm,
  },

  // Lock state
  lockContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
    borderWidth: 2,
    borderColor: 'rgba(245,158,11,0.2)',
  },
  lockIcon: {
    fontSize: 28,
  },
  memberTitle: {
    color: colors.accentGold,
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: spacing.xs,
    letterSpacing: 1,
  },
  tapHint: {
    color: colors.textDim,
    fontSize: 11,
  },

  // Revealed state
  spriteContainer: {
    width: 72,
    height: 72,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  spriteGreyed: {
    opacity: 0.4,
  },
  sprite: {
    width: 64,
    height: 64,
  },
  checkOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkmark: {
    fontSize: 32,
    color: colors.accentGold,
    fontWeight: '800',
  },
  memberName: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  tagline: {
    color: colors.textSecondary,
    fontSize: 11,
    textAlign: 'center',
    lineHeight: 15,
  },
  textGreyed: {
    color: colors.textDim,
  },

  // Champion Card
  championCard: {
    marginTop: spacing.xl,
    borderWidth: 2,
    borderColor: GOLD,
  },
  championLocked: {
    borderColor: colors.border,
  },
  championTouchable: {
    minHeight: 80,
  },
  championInner: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  championLockContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.lg,
    borderWidth: 2,
    borderColor: 'rgba(245,158,11,0.2)',
  },
  championLockIcon: {
    fontSize: 26,
  },
  championSpriteContainer: {
    width: 80,
    height: 80,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.lg,
  },
  championSprite: {
    width: 72,
    height: 72,
  },
  championText: {
    flex: 1,
  },
  championLabel: {
    color: colors.textSecondary,
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 3,
    marginBottom: spacing.xs,
  },
  championName: {
    color: GOLD,
    fontSize: 20,
    fontWeight: '900',
    marginBottom: spacing.xs,
    letterSpacing: 1,
  },
  championTagline: {
    color: colors.textSecondary,
    fontSize: 12,
    lineHeight: 17,
  },
  championHint: {
    color: colors.textDim,
    fontSize: 12,
  },
});
