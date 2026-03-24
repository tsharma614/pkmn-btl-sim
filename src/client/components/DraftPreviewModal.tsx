import React, { useState } from 'react';
import { View, Text, Modal, Pressable, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { PokemonSprite } from './PokemonSprite';
import { TypeBadge } from './TypeBadge';
import { colors, spacing, typeColors } from '../theme';
import abilitiesData from '../../data/abilities.json';
import type { DraftPoolEntry } from '../../engine/draft-pool';

const TIER_LABELS: Record<number, string> = {
  1: 'Tier 1',
  2: 'Tier 2',
  3: 'Tier 3',
  4: 'Tier 4',
};

const TIER_COLORS: Record<number, string> = {
  1: '#FFD700',
  2: '#C0C0C0',
  3: '#CD7F32',
  4: '#666',
};

const STAT_LABELS: Record<string, string> = {
  hp: 'HP', atk: 'ATK', def: 'DEF', spa: 'SPA', spd: 'SPD', spe: 'SPE',
};

function toId(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function getAbilityDesc(name: string): string | null {
  const id = toId(name);
  const entry = (abilitiesData as Record<string, { shortDesc?: string }>)[id];
  return entry?.shortDesc || null;
}

interface DraftPreviewModalProps {
  pool: DraftPoolEntry[];
  pickedIndices: Set<number>;
  initialIndex: number;
  visible: boolean;
  onClose: () => void;
  onPick: (poolIndex: number) => void;
  canPick: boolean;
}

export function DraftPreviewModal({
  pool,
  pickedIndices,
  initialIndex,
  visible,
  onClose,
  onPick,
  canPick,
}: DraftPreviewModalProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);

  const entry = pool[currentIndex];
  if (!entry) return null;

  const species = entry.species;
  const isPicked = pickedIndices.has(currentIndex);
  const canPickThis = canPick && !isPicked;

  // Navigate to next/prev unpicked (or any)
  const navigate = (dir: 1 | -1) => {
    let next = currentIndex;
    for (let i = 0; i < pool.length; i++) {
      next = (next + dir + pool.length) % pool.length;
      break; // show all, not just unpicked
    }
    setCurrentIndex(next);
  };

  // Collect unique moves from sets
  const movesSet = new Set<string>();
  for (const set of species.sets || []) {
    for (const move of set.moves || []) {
      movesSet.add(move);
    }
  }
  const moves = Array.from(movesSet).slice(0, 12);

  return (
    <Modal transparent animationType="fade" visible={visible} onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.card} onPress={e => e.stopPropagation()}>
          <ScrollView bounces={false} showsVerticalScrollIndicator={false}>
            {/* Navigation arrows + header */}
            <View style={styles.navRow}>
              <TouchableOpacity onPress={() => navigate(-1)} style={styles.navBtn}>
                <Text style={styles.navArrow}>{'<'}</Text>
              </TouchableOpacity>
              <View style={styles.headerCenter}>
                <PokemonSprite speciesId={species.id} facing="front" size={90} animated={false} />
              </View>
              <TouchableOpacity onPress={() => navigate(1)} style={styles.navBtn}>
                <Text style={styles.navArrow}>{'>'}</Text>
              </TouchableOpacity>
            </View>

            {/* Name + tier + types */}
            <Text style={styles.name}>{species.name}</Text>
            <View style={styles.metaRow}>
              <View style={[styles.tierBadge, { backgroundColor: TIER_COLORS[entry.tier] || '#666' }]}>
                <Text style={styles.tierText}>{TIER_LABELS[entry.tier] || `T${entry.tier}`}</Text>
              </View>
              {species.types.map(t => (
                <TypeBadge key={t} type={t} />
              ))}
            </View>

            {isPicked && (
              <Text style={styles.pickedText}>ALREADY PICKED</Text>
            )}

            {/* Base Stats */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>BASE STATS</Text>
              <View style={styles.statsGrid}>
                {Object.entries(species.baseStats).map(([stat, value]) => (
                  <View key={stat} style={styles.statRow}>
                    <Text style={styles.statName}>{STAT_LABELS[stat] || stat.toUpperCase()}</Text>
                    <View style={styles.statBarTrack}>
                      <View style={[styles.statBarFill, {
                        width: `${Math.min((value as number) / 255 * 100, 100)}%`,
                        backgroundColor: (value as number) >= 100 ? colors.hpGreen : (value as number) >= 60 ? colors.hpYellow : colors.hpRed,
                      }]} />
                    </View>
                    <Text style={styles.statValue}>{value as number}</Text>
                  </View>
                ))}
              </View>
              <Text style={styles.bstText}>
                BST: {Object.values(species.baseStats).reduce((a, b) => (a as number) + (b as number), 0) as number}
              </Text>
            </View>

            {/* Ability */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>ABILITY</Text>
              <Text style={styles.abilityName}>{species.bestAbility}</Text>
              {getAbilityDesc(species.bestAbility) && (
                <Text style={styles.desc}>{getAbilityDesc(species.bestAbility)}</Text>
              )}
            </View>

            {/* Move pool preview */}
            {moves.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>MOVE POOL</Text>
                <View style={styles.moveGrid}>
                  {moves.map(move => (
                    <View key={move} style={styles.movePill}>
                      <Text style={styles.moveText}>{move}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}
          </ScrollView>

          {/* Pick button */}
          <TouchableOpacity
            style={[styles.pickBtn, !canPickThis && styles.pickBtnDisabled]}
            onPress={() => canPickThis && onPick(currentIndex)}
            disabled={!canPickThis}
            activeOpacity={0.7}
          >
            <Text style={styles.pickBtnText}>
              {isPicked ? 'ALREADY PICKED' : canPick ? `PICK ${species.name.toUpperCase()}` : 'NOT YOUR TURN'}
            </Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    width: '92%',
    maxHeight: '85%',
    borderWidth: 2,
    borderColor: colors.border,
    overflow: 'hidden',
    padding: spacing.lg,
  },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  navBtn: {
    padding: spacing.md,
  },
  navArrow: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.textSecondary,
  },
  headerCenter: {
    alignItems: 'center',
  },
  name: {
    fontSize: 24,
    fontWeight: '900',
    color: colors.text,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    marginTop: spacing.sm,
    marginBottom: spacing.md,
  },
  tierBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  tierText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#000',
  },
  pickedText: {
    color: colors.hpRed,
    fontSize: 12,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  section: {
    marginBottom: spacing.md,
  },
  sectionLabel: {
    color: colors.textDim,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: 4,
  },
  statsGrid: {
    gap: 4,
  },
  statRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statName: {
    color: colors.textDim,
    fontSize: 10,
    fontWeight: '700',
    width: 30,
  },
  statBarTrack: {
    flex: 1,
    height: 6,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  statBarFill: {
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.accent,
  },
  statValue: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '700',
    width: 30,
    textAlign: 'right',
  },
  bstText: {
    color: colors.textDim,
    fontSize: 11,
    fontWeight: '700',
    marginTop: 4,
    textAlign: 'right',
  },
  abilityName: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
  },
  desc: {
    color: colors.textSecondary,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 3,
  },
  moveGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  movePill: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  moveText: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '600',
  },
  pickBtn: {
    backgroundColor: colors.accent,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: spacing.md,
  },
  pickBtnDisabled: {
    backgroundColor: colors.surface,
    opacity: 0.5,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pickBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 1,
  },
});
