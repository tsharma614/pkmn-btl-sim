import React, { useState, useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { PokemonSprite } from './PokemonSprite';
import { PokemonDetailModal } from './PokemonDetailModal';
import { colors, spacing } from '../theme';
import { GAUNTLET_STARTERS } from '../../data/starters';
import pokedexData from '../../data/pokedex.json';
import type { PokemonSpecies } from '../../types';

const pokedex = pokedexData as Record<string, PokemonSpecies>;

interface Props {
  onPick: (speciesId: string) => void;
  onBack: () => void;
}

export function GauntletStarterScreen({ onPick, onBack }: Props) {
  const [selected, setSelected] = useState<string | null>(null);
  const [detailIdx, setDetailIdx] = useState(-1);
  const starterSpecies = useMemo(() =>
    GAUNTLET_STARTERS.map(id => Object.values(pokedex).find(p => p.id === id) ?? null),
    []
  );
  const detailSpecies = detailIdx >= 0 ? starterSpecies[detailIdx] : null;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn} activeOpacity={0.7}>
          <Text style={styles.backText}>{'< Back'}</Text>
        </TouchableOpacity>
        <Text style={styles.title}>CHOOSE YOUR STARTER</Text>
        <Text style={styles.subtitle}>Pick a Pokemon to begin the Gauntlet</Text>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.grid}>
        {GAUNTLET_STARTERS.map(id => (
          <TouchableOpacity
            key={id}
            style={[styles.card, selected === id && styles.cardSelected]}
            onPress={() => setSelected(id)}
            onLongPress={() => setDetailIdx(GAUNTLET_STARTERS.indexOf(id))}
            activeOpacity={0.7}
          >
            <PokemonSprite speciesId={id} facing="front" size={64} animated={false} />
            <Text style={[styles.cardName, selected === id && styles.cardNameSelected]}>
              {id.charAt(0).toUpperCase() + id.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.confirmBtn, !selected && styles.confirmBtnDisabled]}
          onPress={() => selected && onPick(selected)}
          activeOpacity={0.7}
          disabled={!selected}
        >
          <Text style={styles.confirmBtnText}>CONFIRM</Text>
        </TouchableOpacity>
      </View>
      <PokemonDetailModal
        visible={detailSpecies !== null}
        species={detailSpecies}
        onClose={() => setDetailIdx(-1)}
        onPrev={() => setDetailIdx(i => (i - 1 + GAUNTLET_STARTERS.length) % GAUNTLET_STARTERS.length)}
        onNext={() => setDetailIdx(i => (i + 1) % GAUNTLET_STARTERS.length)}
        currentIndex={detailIdx + 1}
        totalCount={GAUNTLET_STARTERS.length}
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
    fontSize: 20,
    fontWeight: '900',
    color: colors.accent,
    letterSpacing: 2,
  },
  subtitle: {
    fontSize: 12,
    color: colors.textDim,
    marginTop: spacing.xs,
  },
  scroll: {
    flex: 1,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: spacing.md,
    gap: spacing.sm,
    justifyContent: 'center',
  },
  card: {
    width: 90,
    alignItems: 'center',
    padding: spacing.sm,
    borderRadius: 12,
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  cardSelected: {
    borderColor: colors.accent,
    backgroundColor: 'rgba(233,69,96,0.15)',
  },
  cardName: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.textSecondary,
    marginTop: spacing.xs,
    textAlign: 'center',
  },
  cardNameSelected: {
    color: colors.accent,
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
