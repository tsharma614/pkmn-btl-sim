import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, Animated, Easing } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PokemonSprite } from './PokemonSprite';
import { PkButton } from './shared/PkButton';
import { colors, spacing, shadows } from '../theme';
import type { OwnPokemon } from '../../server/types';
import type { BattleStats } from '../state/battle-reducer';

interface Props {
  playerName: string;
  team: OwnPokemon[];
  stats: BattleStats;
  onContinue: () => void;
}

export function HallOfFameScreen({ playerName, team, stats, onContinue }: Props) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const titleScale = useRef(new Animated.Value(0.5)).current;
  const sparkleAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.spring(titleScale, {
        toValue: 1,
        friction: 4,
        tension: 60,
        useNativeDriver: true,
      }),
    ]).start();

    Animated.loop(
      Animated.timing(sparkleAnim, {
        toValue: 1,
        duration: 3000,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    ).start();
  }, []);

  const totalKOs = stats.playerKOs;
  const totalDamage = stats.playerDamageDealt;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Animated.View style={[styles.header, { opacity: fadeAnim, transform: [{ scale: titleScale }] }]}>
          <Text style={styles.crownEmoji}>{'\uD83D\uDC51'}</Text>
          <Text style={styles.title}>HALL OF FAME</Text>
          <View style={styles.divider} />
          <Text style={styles.trainerName}>{playerName}</Text>
          <Text style={styles.subtitle}>Pokemon League Champion</Text>
        </Animated.View>

        <Animated.View style={[styles.teamGrid, { opacity: fadeAnim }]}>
          {team.map((mon, i) => (
            <Animated.View
              key={mon.species.id + i}
              style={[
                styles.pokemonCard,
                {
                  opacity: fadeAnim,
                  transform: [{
                    translateY: fadeAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [30, 0],
                    }),
                  }],
                },
              ]}
            >
              <View style={styles.spriteContainer}>
                <PokemonSprite speciesId={mon.species.id} facing="front" size={72} animated={false} />
              </View>
              <Text style={styles.pokemonName} numberOfLines={1}>{mon.species.name}</Text>
              <Text style={styles.pokemonLevel}>Lv. {mon.level}</Text>
            </Animated.View>
          ))}
        </Animated.View>

        <Animated.View style={[styles.statsCard, { opacity: fadeAnim }]}>
          <Text style={styles.statsTitle}>CAREER STATS</Text>
          <View style={styles.statRow}>
            <Text style={styles.statLabel}>Total KOs</Text>
            <Text style={styles.statValue}>{totalKOs}</Text>
          </View>
          <View style={styles.statRow}>
            <Text style={styles.statLabel}>Damage Dealt</Text>
            <Text style={styles.statValue}>{totalDamage.toLocaleString()}</Text>
          </View>
          {stats.biggestHitDealt && (
            <View style={styles.statRow}>
              <Text style={styles.statLabel}>Biggest Hit</Text>
              <Text style={styles.statValue}>{stats.biggestHitDealt.damage} ({stats.biggestHitDealt.move})</Text>
            </View>
          )}
          <View style={styles.statRow}>
            <Text style={styles.statLabel}>Crits Landed</Text>
            <Text style={styles.statValue}>{stats.playerCrits}</Text>
          </View>
        </Animated.View>

        <View style={styles.buttonContainer}>
          <PkButton
            title="CONTINUE"
            variant="primary"
            size="lg"
            onPress={onContinue}
            style={styles.continueButton}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const GOLD = '#F5C542';
const GOLD_DIM = 'rgba(245, 197, 66, 0.3)';

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scroll: {
    paddingHorizontal: spacing.lg,
    paddingBottom: 40,
    alignItems: 'center',
  },
  header: {
    alignItems: 'center',
    marginTop: spacing.xl,
    marginBottom: spacing.xl,
  },
  crownEmoji: {
    fontSize: 48,
    marginBottom: spacing.sm,
  },
  title: {
    fontSize: 32,
    fontWeight: '900',
    color: GOLD,
    letterSpacing: 4,
    textShadowColor: 'rgba(245, 197, 66, 0.5)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 12,
  },
  divider: {
    width: 120,
    height: 2,
    backgroundColor: GOLD_DIM,
    marginVertical: spacing.md,
    borderRadius: 1,
  },
  trainerName: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.white,
    letterSpacing: 2,
  },
  subtitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.accentGold,
    letterSpacing: 1,
    marginTop: spacing.xs,
  },
  teamGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: spacing.md,
    marginBottom: spacing.xl,
    width: '100%',
  },
  pokemonCard: {
    width: 100,
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: GOLD_DIM,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    ...shadows.md,
  },
  spriteContainer: {
    width: 72,
    height: 72,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  pokemonName: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.white,
    textAlign: 'center',
  },
  pokemonLevel: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.textSecondary,
    marginTop: 2,
  },
  statsCard: {
    width: '100%',
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: GOLD_DIM,
    padding: spacing.lg,
    marginBottom: spacing.xl,
    ...shadows.md,
  },
  statsTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: GOLD,
    letterSpacing: 2,
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  statLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  statValue: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.white,
  },
  buttonContainer: {
    width: '100%',
    alignItems: 'center',
  },
  continueButton: {
    width: '80%',
  },
});
