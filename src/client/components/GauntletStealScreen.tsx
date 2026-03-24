import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Image } from 'react-native';
import { PokemonSprite } from './PokemonSprite';
import { PokemonDetailModal } from './PokemonDetailModal';
import { PkCard } from './shared/PkCard';
import { PkButton } from './shared/PkButton';
import { colors, spacing, shadows } from '../theme';
import type { OwnPokemon } from '../../server/types';
import type { PokemonSpecies } from '../../types';
import TRAINER_SPRITE_MAP from '../trainer-sprite-map';

interface Props {
  /** Opponent's team to steal from */
  opponentTeam: OwnPokemon[];
  /** Player's current team */
  playerTeam: OwnPokemon[];
  /** Battle number (for display) */
  battleNumber: number;
  /** If true, player must also drop one (team is full at 6) */
  mustDrop: boolean;
  onComplete: (stealIndex: number, dropIndex: number | null) => void;
  trainerName: string;
  trainerSprite: string;
}

export function GauntletStealScreen({
  opponentTeam,
  playerTeam,
  battleNumber,
  mustDrop,
  onComplete,
  trainerName,
  trainerSprite,
}: Props) {
  const [stealIndex, setStealIndex] = useState<number | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);
  const [detailIdx, setDetailIdx] = useState(-1);
  const detailSpecies = detailIdx >= 0 ? (opponentTeam[detailIdx]?.species as any) ?? null : null;

  const canConfirm = stealIndex !== null && (!mustDrop || dropIndex !== null);

  return (
    <View style={styles.container}>
      {/* Victory header */}
      <View style={styles.header}>
        <Text style={styles.title}>VICTORY!</Text>
        <PkCard style={styles.trainerCard} padding="compact" accentColor={colors.hpGreen}>
          <View style={styles.trainerRow}>
            <Image
              source={TRAINER_SPRITE_MAP[trainerSprite] ?? { uri: '' }}
              style={styles.trainerSprite}
            />
            <Text style={styles.subtitle}>
              You defeated {trainerName}! Pick a Pokemon to add to your team.
            </Text>
          </View>
        </PkCard>
      </View>

      <ScrollView style={styles.scroll}>
        {/* Opponent's team -- steal section */}
        <View style={styles.sectionHeader}>
          <View style={styles.sectionAccent} />
          <Text style={styles.sectionTitle}>STEAL ONE</Text>
        </View>
        <View style={styles.row}>
          {opponentTeam.map((p, i) => (
            <PkCard
              key={`steal-${i}`}
              padding="compact"
              accentColor={stealIndex === i ? colors.hpGreen : undefined}
              style={[
                styles.card,
                stealIndex === i && styles.cardSteal,
              ] as any}
            >
              <TouchableOpacity
                style={styles.cardInner}
                onPress={() => setStealIndex(i)}
                onLongPress={() => setDetailIdx(i)}
                activeOpacity={0.7}
              >
                <PokemonSprite speciesId={p.species.id} facing="front" size={52} />
                <Text style={[styles.cardName, stealIndex === i && styles.cardNameSteal]}>
                  {p.species.name}
                </Text>
              </TouchableOpacity>
            </PkCard>
          ))}
        </View>

        {/* Player's team -- drop section */}
        {mustDrop && (
          <>
            <View style={[styles.sectionHeader, { marginTop: spacing.xl }]}>
              <View style={[styles.sectionAccent, { backgroundColor: colors.primary }]} />
              <Text style={[styles.sectionTitle, { color: colors.primary }]}>DROP ONE</Text>
            </View>
            <Text style={styles.dropHint}>Your team is full -- choose one to release</Text>
            <View style={styles.row}>
              {playerTeam.map((p, i) => (
                <PkCard
                  key={`drop-${i}`}
                  padding="compact"
                  accentColor={dropIndex === i ? colors.primary : undefined}
                  style={[
                    styles.card,
                    dropIndex === i && styles.cardDrop,
                  ] as any}
                >
                  <TouchableOpacity
                    style={styles.cardInner}
                    onPress={() => setDropIndex(i)}
                    activeOpacity={0.7}
                  >
                    <PokemonSprite speciesId={p.species.id} facing="front" size={52} />
                    <Text style={[styles.cardName, dropIndex === i && styles.cardNameDrop]}>
                      {p.species.name}
                    </Text>
                  </TouchableOpacity>
                </PkCard>
              ))}
            </View>
          </>
        )}
      </ScrollView>

      <View style={styles.footer}>
        <PkButton
          title="CONFIRM"
          variant="primary"
          size="lg"
          onPress={() => canConfirm && onComplete(stealIndex!, dropIndex)}
          disabled={!canConfirm}
        />
      </View>
      <PokemonDetailModal
        visible={detailSpecies !== null}
        species={detailSpecies}
        onClose={() => setDetailIdx(-1)}
        onPrev={() => setDetailIdx(i => (i - 1 + opponentTeam.length) % opponentTeam.length)}
        onNext={() => setDetailIdx(i => (i + 1) % opponentTeam.length)}
        currentIndex={detailIdx + 1}
        totalCount={opponentTeam.length}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    paddingTop: spacing.xl,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  title: {
    fontSize: 28,
    fontWeight: '900',
    color: colors.hpGreen,
    letterSpacing: 4,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  trainerCard: {
    flexDirection: 'row',
  },
  trainerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  trainerSprite: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.surfaceLight,
  },
  subtitle: {
    fontSize: 13,
    color: colors.textSecondary,
    flex: 1,
    lineHeight: 20,
  },
  scroll: {
    flex: 1,
    paddingHorizontal: spacing.lg,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  sectionAccent: {
    width: 4,
    height: 20,
    borderRadius: 2,
    backgroundColor: colors.hpGreen,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.hpGreen,
    letterSpacing: 2,
  },
  dropHint: {
    fontSize: 12,
    color: colors.textDim,
    marginBottom: spacing.md,
    paddingLeft: spacing.lg,
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  card: {
    width: 88,
  },
  cardInner: {
    alignItems: 'center',
    paddingVertical: spacing.xs,
  },
  cardSteal: {
    borderColor: colors.hpGreen,
    borderWidth: 2,
  },
  cardDrop: {
    borderColor: colors.primary,
    borderWidth: 2,
  },
  cardName: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.textSecondary,
    marginTop: spacing.xs,
    textAlign: 'center',
  },
  cardNameSteal: {
    color: colors.hpGreen,
    fontWeight: '800',
  },
  cardNameDrop: {
    color: colors.primary,
    fontWeight: '800',
  },
  footer: {
    padding: spacing.lg,
  },
});
