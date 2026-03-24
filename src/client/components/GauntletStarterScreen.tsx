import React, { useState, useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { PokemonSprite } from './PokemonSprite';
import { PokemonDetailModal } from './PokemonDetailModal';
import { PkCard } from './shared/PkCard';
import { PkButton } from './shared/PkButton';
import { colors, spacing, typeColors, shadows } from '../theme';
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

  const selectedSpecies = useMemo(() => {
    if (!selected) return null;
    return Object.values(pokedex).find(p => p.id === selected) ?? null;
  }, [selected]);

  const primaryTypeColor = useMemo(() => {
    if (!selectedSpecies) return colors.primary;
    return typeColors[selectedSpecies.types[0]] ?? colors.primary;
  }, [selectedSpecies]);

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
        {GAUNTLET_STARTERS.map(id => {
          const species = starterSpecies[GAUNTLET_STARTERS.indexOf(id)];
          const typeColor = species ? typeColors[species.types[0]] ?? colors.surfaceLight : colors.surfaceLight;
          const isSelected = selected === id;

          return (
            <PkCard
              key={id}
              accentColor={typeColor}
              padding="compact"
              style={[
                styles.card,
                isSelected && { borderColor: typeColor, borderWidth: 2 },
              ] as any}
            >
              <TouchableOpacity
                style={styles.cardInner}
                onPress={() => setSelected(id)}
                onLongPress={() => setDetailIdx(GAUNTLET_STARTERS.indexOf(id))}
                activeOpacity={0.7}
              >
                <PokemonSprite speciesId={id} facing="front" size={64} />
                <Text style={[styles.cardName, isSelected && { color: colors.text }]}>
                  {id.charAt(0).toUpperCase() + id.slice(1)}
                </Text>
                {species && (
                  <View style={styles.typeRow}>
                    {species.types.map(t => (
                      <View key={t} style={[styles.typePill, { backgroundColor: typeColors[t] ?? colors.surfaceLight }]}>
                        <Text style={styles.typeText}>{t}</Text>
                      </View>
                    ))}
                  </View>
                )}
              </TouchableOpacity>
            </PkCard>
          );
        })}
      </ScrollView>

      <View style={styles.footer}>
        <PkButton
          title="CONFIRM"
          variant="primary"
          size="lg"
          onPress={() => selected && onPick(selected)}
          disabled={!selected}
        />
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
    paddingTop: spacing.xl,
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
    fontSize: 22,
    fontWeight: '900',
    color: colors.primary,
    letterSpacing: 2,
  },
  subtitle: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  scroll: {
    flex: 1,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: spacing.lg,
    gap: spacing.md,
    justifyContent: 'center',
  },
  card: {
    width: 100,
  },
  cardInner: {
    alignItems: 'center',
    paddingVertical: spacing.xs,
  },
  cardName: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.textSecondary,
    marginTop: spacing.xs,
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  typeRow: {
    flexDirection: 'row',
    gap: 3,
    marginTop: spacing.xs,
  },
  typePill: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  typeText: {
    fontSize: 8,
    fontWeight: '700',
    color: '#fff',
  },
  footer: {
    padding: spacing.lg,
  },
});
