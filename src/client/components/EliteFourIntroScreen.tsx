/**
 * Transition screen shown between Elite Four battles.
 * Shows the next opponent's name, title, and stage number.
 */
import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, TouchableOpacity } from 'react-native';
import { colors, spacing } from '../theme';

interface Props {
  stage: number; // 0-3 = E4, 4 = Champion
  memberName: string;
  memberTitle: string;
  onBack: () => void;
  onBeginBattle: () => void;
}

const STAGE_LABELS = ['ELITE FOUR #1', 'ELITE FOUR #2', 'ELITE FOUR #3', 'ELITE FOUR #4', 'CHAMPION'];

export function EliteFourIntroScreen({ stage, memberName, memberTitle, onBack, onBeginBattle }: Props) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 600, useNativeDriver: true }),
    ]).start();
  }, [stage]);

  const isChampion = stage === 4;

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.backBtn} onPress={onBack} activeOpacity={0.7}>
        <Text style={styles.backText}>{'< Forfeit Run'}</Text>
      </TouchableOpacity>

      <View style={styles.center}>
        {/* Progress dots */}
        <View style={styles.progressRow}>
          {[0, 1, 2, 3, 4].map(i => (
            <View
              key={i}
              style={[
                styles.progressDot,
                i < stage && styles.progressDotComplete,
                i === stage && styles.progressDotCurrent,
                i === 4 && styles.progressDotChampion,
              ]}
            />
          ))}
        </View>

        <Animated.View style={[styles.intro, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
          <Text style={[styles.stageLabel, isChampion && styles.championLabel]}>
            {STAGE_LABELS[stage] ?? `STAGE ${stage + 1}`}
          </Text>
          <Text style={[styles.name, isChampion && styles.championName]}>{memberName}</Text>
          <Text style={styles.title}>{memberTitle}</Text>
        </Animated.View>

        <TouchableOpacity style={[styles.battleBtn, isChampion && styles.championBtn]} onPress={onBeginBattle} activeOpacity={0.7}>
          <Text style={styles.battleBtnText}>BATTLE</Text>
        </TouchableOpacity>

        <Text style={styles.hint}>
          {isChampion ? 'The final challenge awaits...' : `${4 - stage} battle${4 - stage > 1 ? 's' : ''} until the Champion`}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  backBtn: {
    paddingTop: spacing.lg,
    paddingHorizontal: spacing.lg,
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
    padding: spacing.xl,
  },
  progressRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: spacing.xl,
  },
  progressDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  progressDotComplete: {
    backgroundColor: colors.hpGreen,
    borderColor: colors.hpGreen,
  },
  progressDotCurrent: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
    transform: [{ scale: 1.3 }],
  },
  progressDotChampion: {
    borderColor: '#FFD700',
  },
  intro: {
    alignItems: 'center',
  },
  stageLabel: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.textSecondary,
    letterSpacing: 3,
    marginBottom: spacing.sm,
  },
  championLabel: {
    color: '#FFD700',
  },
  name: {
    fontSize: 36,
    fontWeight: '900',
    color: colors.text,
    letterSpacing: 2,
  },
  championName: {
    color: '#FFD700',
  },
  title: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: spacing.sm,
    fontStyle: 'italic',
  },
  battleBtn: {
    backgroundColor: colors.accent,
    paddingHorizontal: 48,
    paddingVertical: 16,
    borderRadius: 12,
    marginTop: spacing.xl * 2,
  },
  championBtn: {
    backgroundColor: '#FFD700',
  },
  battleBtnText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: 3,
  },
  hint: {
    fontSize: 12,
    color: colors.textDim,
    marginTop: spacing.lg,
  },
});
