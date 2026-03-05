import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { HpBar } from './HpBar';
import { StatusBadge } from './StatusBadge';
import { TypeBadge } from './TypeBadge';
import { SwitchPreviewModal } from './SwitchPreviewModal';
import { colors, spacing } from '../theme';
import type { OwnPokemon } from '../../server/types';

interface Props {
  team: OwnPokemon[];
  activePokemonIndex: number;
  onSelectSwitch: (pokemonIndex: number) => void;
  disabled: boolean;
}

export function SwitchList({ team, activePokemonIndex, onSelectSwitch, disabled }: Props) {
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {team.map((pokemon, i) => {
        const isActive = i === activePokemonIndex;
        const isFainted = !pokemon.isAlive;
        const isDisabled = disabled || isActive || isFainted;

        return (
          <TouchableOpacity
            key={i}
            style={[
              styles.row,
              isActive && styles.rowActive,
              isFainted && styles.rowFainted,
            ]}
            onPress={() => onSelectSwitch(i)}
            onLongPress={() => setPreviewIndex(i)}
            delayLongPress={300}
            disabled={isDisabled}
            activeOpacity={0.7}
          >
            <View style={styles.left}>
              <Text style={[styles.name, isFainted && styles.nameFainted]}>
                {pokemon.species.name}
                {isActive ? ' (active)' : ''}
              </Text>
              <View style={styles.meta}>
                <View style={styles.types}>
                  {pokemon.species.types.map(t => (
                    <TypeBadge key={t} type={t} small />
                  ))}
                </View>
                {pokemon.item && (
                  <Text style={styles.item}>@ {pokemon.item}</Text>
                )}
              </View>
            </View>
            <View style={styles.right}>
              <HpBar currentHp={pokemon.currentHp} maxHp={pokemon.maxHp} width={80} height={6} />
              <View style={styles.hpRow}>
                <Text style={styles.hpText}>
                  {isFainted ? 'FNT' : `${Math.round((pokemon.currentHp / pokemon.maxHp) * 100)}%`}
                </Text>
                <StatusBadge status={pokemon.status} />
              </View>
            </View>
          </TouchableOpacity>
        );
      })}

      {previewIndex !== null && (
        <SwitchPreviewModal
          team={team}
          initialIndex={previewIndex}
          activePokemonIndex={activePokemonIndex}
          visible
          onClose={() => setPreviewIndex(null)}
          onSelectSwitch={onSelectSwitch}
        />
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    maxHeight: 250,
  },
  content: {
    padding: spacing.sm,
    gap: spacing.xs,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderRadius: 8,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  rowActive: {
    borderColor: colors.accent,
    opacity: 0.5,
  },
  rowFainted: {
    opacity: 0.3,
  },
  left: {
    flex: 1,
  },
  name: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 3,
  },
  nameFainted: {
    color: colors.textDim,
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  types: {
    flexDirection: 'row',
  },
  item: {
    color: colors.textDim,
    fontSize: 10,
    fontStyle: 'italic',
  },
  right: {
    alignItems: 'flex-end',
  },
  hpRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  hpText: {
    color: colors.textSecondary,
    fontSize: 10,
  },
});
