import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, ScrollView } from 'react-native';
import { PokemonSprite } from './PokemonSprite';
import { colors, spacing, typeColors } from '../theme';
import type { PokemonSpecies } from '../../types';

interface Props {
  visible: boolean;
  species: PokemonSpecies | null;
  onClose: () => void;
}

export function PokemonDetailModal({ visible, species, onClose }: Props) {
  if (!species) return null;

  const { baseStats, types, abilities } = species;
  const bst = baseStats.hp + baseStats.atk + baseStats.def + baseStats.spa + baseStats.spd + baseStats.spe;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
        <View style={styles.modal} onStartShouldSetResponder={() => true}>
          <View style={styles.header}>
            <PokemonSprite speciesId={species.id} facing="front" size={72} />
            <View style={styles.headerInfo}>
              <Text style={styles.name}>{species.name}</Text>
              <View style={styles.typeRow}>
                {types.map(t => (
                  <View key={t} style={[styles.typeBadge, { backgroundColor: typeColors[t] || '#666' }]}>
                    <Text style={styles.typeText}>{t}</Text>
                  </View>
                ))}
              </View>
              <Text style={styles.ability}>{abilities[0]}</Text>
            </View>
          </View>

          <View style={styles.statsGrid}>
            {(['hp', 'atk', 'def', 'spa', 'spd', 'spe'] as const).map(stat => (
              <View key={stat} style={styles.statRow}>
                <Text style={styles.statLabel}>{stat.toUpperCase()}</Text>
                <View style={styles.statBarBg}>
                  <View style={[styles.statBar, { width: `${Math.min(100, baseStats[stat] / 1.8)}%` }]} />
                </View>
                <Text style={styles.statValue}>{baseStats[stat]}</Text>
              </View>
            ))}
            <View style={styles.statRow}>
              <Text style={styles.statLabel}>BST</Text>
              <View style={styles.statBarBg} />
              <Text style={styles.statValue}>{bst}</Text>
            </View>
          </View>

          <Text style={styles.closeHint}>Tap outside to close</Text>
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modal: {
    backgroundColor: colors.background,
    borderRadius: 16,
    padding: spacing.lg,
    width: '85%',
    maxHeight: '70%',
    borderWidth: 2,
    borderColor: colors.border,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  headerInfo: {
    marginLeft: spacing.md,
    flex: 1,
  },
  name: {
    fontSize: 20,
    fontWeight: '900',
    color: colors.text,
  },
  typeRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  typeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  typeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
  ability: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  statsGrid: {
    gap: spacing.xs,
  },
  statRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  statLabel: {
    width: 32,
    fontSize: 10,
    fontWeight: '700',
    color: colors.textDim,
  },
  statBarBg: {
    flex: 1,
    height: 6,
    backgroundColor: colors.surface,
    borderRadius: 3,
    overflow: 'hidden',
  },
  statBar: {
    height: '100%',
    backgroundColor: colors.accent,
    borderRadius: 3,
  },
  statValue: {
    width: 28,
    fontSize: 11,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'right',
  },
  closeHint: {
    fontSize: 10,
    color: colors.textDim,
    textAlign: 'center',
    marginTop: spacing.md,
  },
});
