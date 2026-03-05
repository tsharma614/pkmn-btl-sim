import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { HpBar } from './HpBar';
import { StatusBadge } from './StatusBadge';
import { TypeBadge } from './TypeBadge';
import { SwitchPreviewModal } from './SwitchPreviewModal';
import { colors, spacing } from '../theme';
import type { NeedsSwitchPayload, OwnPokemon } from '../../server/types';

interface Props {
  availableSwitches: NeedsSwitchPayload['availableSwitches'];
  onSelect: (pokemonIndex: number) => void;
  reason?: 'faint' | 'self_switch';
  team?: OwnPokemon[];
  activePokemonIndex?: number;
}

export function ForceSwitch({ availableSwitches, onSelect, reason = 'faint', team, activePokemonIndex = 0 }: Props) {
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);
  const isSelfSwitch = reason === 'self_switch';
  return (
    <View style={styles.overlay}>
      <View style={styles.modal}>
        <Text style={styles.title}>
          {isSelfSwitch ? 'Switch out!' : 'Your Pokemon fainted!'}
        </Text>
        <Text style={styles.subtitle}>
          {isSelfSwitch ? 'Choose a Pokemon to switch to:' : 'Choose a replacement:'}
        </Text>
        <ScrollView style={styles.list}>
          {availableSwitches.map(({ index, pokemon }) => (
            <TouchableOpacity
              key={index}
              style={styles.row}
              onPress={() => onSelect(index)}
              onLongPress={() => team && setPreviewIndex(index)}
              delayLongPress={300}
              activeOpacity={0.7}
            >
              <View style={styles.left}>
                <Text style={styles.name}>{pokemon.species.name}</Text>
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
                <HpBar
                  currentHp={pokemon.currentHp}
                  maxHp={pokemon.maxHp}
                  width={80}
                  height={6}
                />
                <View style={styles.hpRow}>
                  <Text style={styles.hpText}>
                    {Math.round((pokemon.currentHp / pokemon.maxHp) * 100)}%
                  </Text>
                  <StatusBadge status={pokemon.status} />
                </View>
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {team && previewIndex !== null && (
          <SwitchPreviewModal
            team={team}
            initialIndex={previewIndex}
            activePokemonIndex={activePokemonIndex}
            visible
            onClose={() => setPreviewIndex(null)}
            onSelectSwitch={(idx) => { onSelect(idx); setPreviewIndex(null); }}
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  modal: {
    backgroundColor: colors.background,
    borderRadius: 16,
    padding: spacing.xl,
    width: '100%',
    maxHeight: '70%',
    borderWidth: 1,
    borderColor: colors.border,
  },
  title: {
    color: colors.accent,
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 4,
  },
  subtitle: {
    color: colors.textSecondary,
    fontSize: 14,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  list: {},
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderRadius: 8,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.sm,
  },
  left: {
    flex: 1,
  },
  name: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 3,
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
