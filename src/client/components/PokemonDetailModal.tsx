import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, ScrollView } from 'react-native';
import { PokemonSprite } from './PokemonSprite';
import { colors, spacing, typeColors } from '../theme';
import type { PokemonSpecies } from '../../types';
import abilitiesData from '../../data/abilities.json';

const TIER_LABELS: Record<number, { label: string; color: string }> = {
  0: { label: 'MEGA', color: '#FF6B9D' },
  1: { label: 'T1', color: '#FFD700' },
  2: { label: 'T2', color: '#C0C0C0' },
  3: { label: 'T3', color: '#CD7F32' },
  4: { label: 'T4', color: '#666' },
};

const CATEGORY_COLORS: Record<string, string> = {
  Physical: '#C92112',
  Special: '#4F5870',
  Status: '#8C888C',
};

interface Props {
  visible: boolean;
  species: PokemonSpecies | null;
  /** Optional: show moves if the Pokemon has been built */
  moves?: { name: string; type: string; category: string; power: number | null; accuracy: number | null }[];
  /** Optional: show held item */
  item?: string | null;
  /** Optional: show specific ability (overrides species default) */
  ability?: string;
  onClose: () => void;
  /** Cycling: navigate to previous Pokemon */
  onPrev?: () => void;
  /** Cycling: navigate to next Pokemon */
  onNext?: () => void;
  /** Cycling: current index (1-based display) */
  currentIndex?: number;
  /** Cycling: total count */
  totalCount?: number;
}

export function PokemonDetailModal({ visible, species, moves, item, ability, onClose, onPrev, onNext, currentIndex, totalCount }: Props) {
  if (!species) return null;

  const { baseStats, types, abilities } = species;
  const bst = baseStats.hp + baseStats.atk + baseStats.def + baseStats.spa + baseStats.spd + baseStats.spe;
  const tier = TIER_LABELS[species.tier] ?? TIER_LABELS[3];
  const displayAbility = ability ?? abilities?.[0] ?? 'Unknown';
  const abilityId = displayAbility.toLowerCase().replace(/[^a-z0-9]/g, '');
  const abilityDesc = (abilitiesData as Record<string, any>)[abilityId]?.shortDesc ?? '';
  const hasCycling = onPrev && onNext && totalCount && totalCount > 1;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.modal} onStartShouldSetResponder={() => true}>
            {/* Cycling nav */}
            {hasCycling && (
              <View style={styles.cycleRow}>
                <TouchableOpacity onPress={onPrev} style={styles.cycleBtn} hitSlop={12}>
                  <Text style={styles.cycleBtnText}>{'<'}</Text>
                </TouchableOpacity>
                <Text style={styles.cycleIndicator}>{currentIndex}/{totalCount}</Text>
                <TouchableOpacity onPress={onNext} style={styles.cycleBtn} hitSlop={12}>
                  <Text style={styles.cycleBtnText}>{'>'}</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Header: sprite + name + types + tier */}
            <View style={styles.header}>
              <PokemonSprite speciesId={species.id} facing="front" size={80} animated={false} />
              <View style={styles.headerInfo}>
                <View style={styles.nameRow}>
                  <Text style={styles.name}>{species.name}</Text>
                  <View style={[styles.tierBadge, { backgroundColor: tier.color }]}>
                    <Text style={styles.tierText}>{tier.label}</Text>
                  </View>
                </View>
                <View style={styles.typeRow}>
                  {types.map(t => (
                    <View key={t} style={[styles.typeBadge, { backgroundColor: typeColors[t] || '#666' }]}>
                      <Text style={styles.typeText}>{t}</Text>
                    </View>
                  ))}
                </View>
                <Text style={styles.ability}>{displayAbility}</Text>
                {abilityDesc ? <Text style={styles.abilityDesc}>{abilityDesc}</Text> : null}
                {item && <Text style={styles.item}>Held: {item}</Text>}
              </View>
            </View>

            {/* Base Stats */}
            <Text style={styles.sectionTitle}>BASE STATS</Text>
            <View style={styles.statsGrid}>
              {(['hp', 'atk', 'def', 'spa', 'spd', 'spe'] as const).map(stat => {
                const val = baseStats[stat];
                const pct = Math.min(100, val / 1.8);
                const barColor = val >= 100 ? '#4caf50' : val >= 70 ? '#ff9800' : '#f44336';
                const label: Record<string, string> = { hp: 'HP', atk: 'Atk', def: 'Def', spa: 'SpA', spd: 'SpD', spe: 'Spe' };
                return (
                  <View key={stat} style={styles.statRow}>
                    <Text style={styles.statLabel}>{label[stat]}</Text>
                    <View style={styles.statBarBg}>
                      <View style={[styles.statBar, { width: `${pct}%`, backgroundColor: barColor }]} />
                    </View>
                    <Text style={styles.statValue}>{val}</Text>
                  </View>
                );
              })}
              <View style={styles.statRow}>
                <Text style={styles.statLabel}>BST</Text>
                <View style={styles.statBarBg} />
                <Text style={[styles.statValue, { fontWeight: '900' }]}>{bst}</Text>
              </View>
            </View>

            {/* Moves (if provided) */}
            {moves && moves.length > 0 && (
              <>
                <Text style={styles.sectionTitle}>MOVES</Text>
                {moves.map((m, i) => (
                  <View key={i} style={styles.moveRow}>
                    <View style={[styles.moveCat, { backgroundColor: CATEGORY_COLORS[m.category] || '#666' }]} />
                    <View style={[styles.moveType, { backgroundColor: typeColors[m.type] || '#666' }]}>
                      <Text style={styles.moveTypeText}>{m.type}</Text>
                    </View>
                    <Text style={styles.moveName} numberOfLines={1}>{m.name}</Text>
                    <Text style={styles.moveStat}>{m.power ?? '-'}</Text>
                    <Text style={styles.moveStat}>{m.accuracy ? `${m.accuracy}%` : '-'}</Text>
                  </View>
                ))}
              </>
            )}

            <Text style={styles.closeHint}>Tap outside to close</Text>
          </View>
        </ScrollView>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  modal: {
    backgroundColor: colors.background,
    borderRadius: 16,
    padding: spacing.lg,
    width: '100%',
    maxWidth: 360,
    borderWidth: 2,
    borderColor: colors.border,
  },
  cycleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  cycleBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  cycleBtnText: {
    color: colors.accent,
    fontSize: 22,
    fontWeight: '900',
  },
  cycleIndicator: {
    color: colors.textDim,
    fontSize: 12,
    fontWeight: '700',
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
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  name: {
    fontSize: 20,
    fontWeight: '900',
    color: colors.text,
    flex: 1,
  },
  tierBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  tierText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '900',
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
  abilityDesc: {
    fontSize: 10,
    color: colors.textDim,
    marginTop: 1,
    fontStyle: 'italic',
  },
  item: {
    fontSize: 11,
    color: colors.textDim,
    marginTop: 2,
  },
  sectionTitle: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.textDim,
    letterSpacing: 2,
    marginBottom: spacing.xs,
    marginTop: spacing.sm,
  },
  statsGrid: {
    gap: 5,
  },
  statRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  statLabel: {
    width: 34,
    fontSize: 11,
    fontWeight: '800',
    color: colors.textSecondary,
  },
  statBarBg: {
    flex: 1,
    height: 10,
    backgroundColor: colors.surface,
    borderRadius: 5,
    overflow: 'hidden',
  },
  statBar: {
    height: '100%',
    borderRadius: 5,
  },
  statValue: {
    width: 30,
    fontSize: 12,
    fontWeight: '800',
    color: colors.text,
    textAlign: 'right',
  },
  moveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: 3,
  },
  moveCat: {
    width: 4,
    height: 16,
    borderRadius: 2,
  },
  moveType: {
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  moveTypeText: {
    color: '#fff',
    fontSize: 8,
    fontWeight: '700',
  },
  moveName: {
    flex: 1,
    fontSize: 12,
    color: colors.text,
    fontWeight: '600',
  },
  moveStat: {
    fontSize: 10,
    color: colors.textDim,
    width: 30,
    textAlign: 'right',
  },
  closeHint: {
    fontSize: 10,
    color: colors.textDim,
    textAlign: 'center',
    marginTop: spacing.md,
  },
});
