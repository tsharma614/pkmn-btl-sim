import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image } from 'react-native';
import { colors, spacing } from '../theme';

const TRAINER_SPRITE_BASE = 'https://play.pokemonshowdown.com/sprites/trainers/';

interface Props {
  /** e.g. "Gym 3 of 8", "Elite Four 2 of 4", "Champion" */
  stageLabel: string;
  /** Opponent trainer name */
  opponentName: string;
  /** Opponent trainer title (e.g. "Fire-type Gym Leader") */
  opponentTitle: string;
  /** Showdown trainer sprite filename */
  trainerSprite: string;
  /** Progress through the campaign (0-1) */
  progress: number;
  /** Total stages for progress dots */
  totalStages: number;
  /** Current stage index */
  currentStage: number;
  onBack: () => void;
  onBeginBattle: () => void;
}

export function CampaignIntroScreen({
  stageLabel,
  opponentName,
  opponentTitle,
  trainerSprite,
  progress,
  totalStages,
  currentStage,
  onBack,
  onBeginBattle,
}: Props) {
  return (
    <View style={styles.container}>
      <TouchableOpacity onPress={onBack} style={styles.backBtn} activeOpacity={0.7}>
        <Text style={styles.backText}>{'< Forfeit Run'}</Text>
      </TouchableOpacity>

      <View style={styles.center}>
        <Text style={styles.stageLabel}>{stageLabel}</Text>

        <Image
          source={{ uri: `${TRAINER_SPRITE_BASE}${trainerSprite}.png` }}
          style={styles.trainerSprite}
        />

        <Text style={styles.opponentName}>{opponentName}</Text>
        <Text style={styles.opponentTitle}>{opponentTitle}</Text>

        {/* Progress dots (only for finite campaigns) or battle number text */}
        {totalStages <= 20 ? (
          <>
            <View style={styles.dotsRow}>
              {Array.from({ length: totalStages }).map((_, i) => (
                <View
                  key={i}
                  style={[
                    styles.dot,
                    i < currentStage && styles.dotCompleted,
                    i === currentStage && styles.dotCurrent,
                  ]}
                />
              ))}
            </View>
            <Text style={styles.remaining}>
              Battle {currentStage + 1} of {totalStages}
            </Text>
          </>
        ) : (
          <Text style={styles.remaining}>
            Battle #{currentStage + 1}
          </Text>
        )}
      </View>

      <View style={styles.footer}>
        <TouchableOpacity style={styles.battleBtn} onPress={onBeginBattle} activeOpacity={0.7}>
          <Text style={styles.battleBtnText}>BATTLE</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    padding: spacing.lg,
  },
  backBtn: {
    marginBottom: spacing.lg,
  },
  backText: {
    color: colors.textDim,
    fontSize: 14,
    fontWeight: '600',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stageLabel: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.textSecondary,
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: spacing.lg,
  },
  trainerSprite: {
    width: 96,
    height: 96,
    marginBottom: spacing.md,
  },
  opponentName: {
    fontSize: 28,
    fontWeight: '900',
    color: colors.text,
    letterSpacing: 2,
  },
  opponentTitle: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  dotsRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: spacing.xl,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.border,
  },
  dotCompleted: {
    backgroundColor: '#4caf50',
  },
  dotCurrent: {
    backgroundColor: colors.accent,
  },
  remaining: {
    fontSize: 11,
    color: colors.textDim,
    marginTop: spacing.sm,
  },
  footer: {
    paddingTop: spacing.lg,
  },
  battleBtn: {
    backgroundColor: colors.accent,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: colors.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  battleBtnText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: 3,
  },
});
