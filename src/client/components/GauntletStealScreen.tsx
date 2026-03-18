import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Image } from 'react-native';
import { PokemonSprite } from './PokemonSprite';
import { PokemonDetailModal } from './PokemonDetailModal';
import { colors, spacing } from '../theme';
import type { OwnPokemon } from '../../server/types';
import type { PokemonSpecies } from '../../types';

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
  const [detailSpecies, setDetailSpecies] = useState<PokemonSpecies | null>(null);

  const canConfirm = stealIndex !== null && (!mustDrop || dropIndex !== null);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>VICTORY!</Text>
        <View style={styles.trainerRow}>
          <Image
            source={{ uri: `https://play.pokemonshowdown.com/sprites/trainers/${trainerSprite}.png` }}
            style={styles.trainerSprite}
          />
          <Text style={styles.subtitle}>
            You defeated {trainerName}! Pick a Pokemon to add to your team.
          </Text>
        </View>
      </View>

      <ScrollView style={styles.scroll}>
        {/* Opponent's team — pick one to steal */}
        <Text style={styles.sectionTitle}>STEAL ONE</Text>
        <View style={styles.row}>
          {opponentTeam.map((p, i) => (
            <TouchableOpacity
              key={`steal-${i}`}
              style={[styles.card, stealIndex === i && styles.cardSelected]}
              onPress={() => setStealIndex(i)}
              onLongPress={() => setDetailSpecies(p.species as any)}
              activeOpacity={0.7}
            >
              <PokemonSprite speciesId={p.species.id} facing="front" size={52} />
              <Text style={[styles.cardName, stealIndex === i && styles.cardNameSelected]}>
                {p.species.name}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Player's team — drop one if full */}
        {mustDrop && (
          <>
            <Text style={[styles.sectionTitle, { marginTop: spacing.lg }]}>DROP ONE</Text>
            <Text style={styles.dropHint}>Your team is full — choose one to release</Text>
            <View style={styles.row}>
              {playerTeam.map((p, i) => (
                <TouchableOpacity
                  key={`drop-${i}`}
                  style={[styles.card, dropIndex === i && styles.cardDrop]}
                  onPress={() => setDropIndex(i)}
                  activeOpacity={0.7}
                >
                  <PokemonSprite speciesId={p.species.id} facing="front" size={52} />
                  <Text style={[styles.cardName, dropIndex === i && { color: '#f44336' }]}>
                    {p.species.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.confirmBtn, !canConfirm && styles.confirmBtnDisabled]}
          onPress={() => canConfirm && onComplete(stealIndex!, dropIndex)}
          activeOpacity={0.7}
          disabled={!canConfirm}
        >
          <Text style={styles.confirmBtnText}>CONFIRM</Text>
        </TouchableOpacity>
      </View>
      <PokemonDetailModal visible={detailSpecies !== null} species={detailSpecies} onClose={() => setDetailSpecies(null)} />
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
  title: {
    fontSize: 24,
    fontWeight: '900',
    color: '#4caf50',
    letterSpacing: 3,
    textAlign: 'center',
  },
  trainerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.md,
    gap: spacing.md,
  },
  trainerSprite: {
    width: 48,
    height: 48,
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
  sectionTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.textSecondary,
    letterSpacing: 2,
    marginBottom: spacing.sm,
  },
  dropHint: {
    fontSize: 11,
    color: colors.textDim,
    marginBottom: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  card: {
    width: 80,
    alignItems: 'center',
    padding: spacing.sm,
    borderRadius: 10,
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  cardSelected: {
    borderColor: '#4caf50',
    backgroundColor: 'rgba(76,175,80,0.15)',
  },
  cardDrop: {
    borderColor: '#f44336',
    backgroundColor: 'rgba(244,67,54,0.15)',
  },
  cardName: {
    fontSize: 9,
    fontWeight: '700',
    color: colors.textSecondary,
    marginTop: spacing.xs,
    textAlign: 'center',
  },
  cardNameSelected: {
    color: '#4caf50',
  },
  footer: {
    padding: spacing.lg,
  },
  confirmBtn: {
    backgroundColor: colors.accent,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  confirmBtnDisabled: {
    opacity: 0.4,
  },
  confirmBtnText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 2,
  },
});
