import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  useWindowDimensions,
} from 'react-native';
import { PokemonSprite } from './PokemonSprite';
import { PokemonDetailModal } from './PokemonDetailModal';
import { colors, spacing } from '../theme';
import type { PokemonSpecies } from '../../types';
import movesData from '../../data/moves.json';

const TIER_LABELS: Record<number, string> = {
  4: 'MEGA',
  3: 'T1',
  2: 'T2',
  0: 'T3',
};

const TIER_BADGE_COLORS: Record<number, string> = {
  4: '#FF6B9D',
  3: '#FFD700',
  2: '#C0C0C0',
  0: '#606070',
};

const TOTAL_BUDGET = 14;
const NUM_TIERS = 4;
const CARD_GAP = 8;

interface BudgetOption {
  species: PokemonSpecies;
  tier: number;
  cost: number;
}

interface RoleSection {
  role: string;
  options: BudgetOption[];
}

interface Props {
  /** Pool of Pokemon organized by role and tier */
  roleOptions: RoleSection[];
  onComplete: (picks: { speciesId: string; tier: number }[]) => void;
  onBack: () => void;
  playerName: string;
}

export function BudgetDraftScreen({
  roleOptions,
  onComplete,
  onBack,
  playerName,
}: Props) {
  const { width: screenW } = useWindowDimensions();
  const cardW =
    (screenW - spacing.lg * 2 - CARD_GAP * (NUM_TIERS - 1)) / NUM_TIERS;

  const [selections, setSelections] = useState<Record<string, number>>({});
  const [detailSpecies, setDetailSpecies] = useState<PokemonSpecies | null>(null);

  const detailMoves = useMemo(() => {
    if (!detailSpecies?.movePool) return undefined;
    const allMoves = (movesData as Record<string, any>);
    return detailSpecies.movePool
      .map(name => {
        const id = name.toLowerCase().replace(/[^a-z0-9]/g, '');
        const m = allMoves[id];
        if (!m) return null;
        return { name: m.name, type: m.type, category: m.category, power: m.power, accuracy: m.accuracy };
      })
      .filter(Boolean)
      .sort((a: any, b: any) => (b.power ?? 0) - (a.power ?? 0))
      .slice(0, 10) as { name: string; type: string; category: string; power: number | null; accuracy: number | null }[];
  }, [detailSpecies]);

  const spent = useMemo(() => {
    let total = 0;
    for (const role of roleOptions) {
      const idx = selections[role.role];
      if (idx !== undefined) {
        total += role.options[idx].cost;
      }
    }
    return total;
  }, [selections, roleOptions]);

  const remaining = TOTAL_BUDGET - spent;
  const allPicked = roleOptions.length > 0 && roleOptions.every(r => selections[r.role] !== undefined);

  const handleSelect = (role: string, optionIdx: number, cost: number) => {
    setSelections(prev => {
      const currentIdx = prev[role];
      // Deselect if tapping the already-selected card
      if (currentIdx === optionIdx) {
        const next = { ...prev };
        delete next[role];
        return next;
      }
      // Check if selecting this would exceed the budget
      const currentCost = currentIdx !== undefined
        ? roleOptions.find(r => r.role === role)!.options[currentIdx].cost
        : 0;
      const newSpent = spent - currentCost + cost;
      if (newSpent > TOTAL_BUDGET) return prev;
      return { ...prev, [role]: optionIdx };
    });
  };

  const handleConfirm = () => {
    if (!allPicked) return;
    const picks = roleOptions.map(r => {
      const opt = r.options[selections[r.role]];
      return { speciesId: opt.species.id, tier: opt.tier };
    });
    onComplete(picks);
  };

  const canAfford = (role: string, cost: number): boolean => {
    const currentIdx = selections[role];
    const currentCost =
      currentIdx !== undefined
        ? roleOptions.find(r => r.role === role)!.options[currentIdx].cost
        : 0;
    return spent - currentCost + cost <= TOTAL_BUDGET;
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={onBack} hitSlop={8}>
            <Text style={styles.backBtn}>{'<'}</Text>
          </TouchableOpacity>
          <Text style={styles.title}>BUDGET DRAFT</Text>
          <View style={styles.budgetPill}>
            <Text style={[styles.budgetText, remaining === 0 && styles.budgetSpent]}>
              {remaining} pts remaining
            </Text>
          </View>
        </View>
        <Text style={styles.playerLabel}>{playerName}</Text>
      </View>

      {/* Role sections */}
      <ScrollView style={styles.scrollArea} contentContainerStyle={styles.scrollContent}>
        {roleOptions.map(section => {
          const selectedIdx = selections[section.role];
          return (
            <View key={section.role} style={styles.roleSection}>
              <Text style={styles.roleName}>{section.role}</Text>
              <View style={styles.optionRow}>
                {section.options.map((opt, idx) => {
                  const isSelected = selectedIdx === idx;
                  const affordable = canAfford(section.role, opt.cost);
                  const disabled = !affordable && !isSelected;

                  return (
                    <TouchableOpacity
                      key={opt.species.id}
                      style={[
                        styles.card,
                        { width: cardW },
                        isSelected && styles.cardSelected,
                        disabled && styles.cardDisabled,
                      ]}
                      onPress={() => !disabled && handleSelect(section.role, idx, opt.cost)}
                      onLongPress={() => setDetailSpecies(opt.species)}
                      activeOpacity={disabled ? 1 : 0.7}
                      disabled={disabled}
                    >
                      <View
                        style={[
                          styles.tierBadge,
                          { backgroundColor: TIER_BADGE_COLORS[opt.cost] ?? '#606070' },
                        ]}
                      >
                        <Text style={styles.tierBadgeText}>
                          {TIER_LABELS[opt.cost] ?? `T${opt.tier}`} {opt.cost > 0 ? `${opt.cost}pt` : 'FREE'}
                        </Text>
                      </View>
                      <PokemonSprite speciesId={opt.species.id} facing="front" size={56} />
                      <Text
                        style={[styles.cardName, disabled && styles.cardNameDisabled]}
                        numberOfLines={1}
                      >
                        {opt.species.name}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          );
        })}
      </ScrollView>

      {/* Confirm bar */}
      <View style={styles.confirmBar}>
        <TouchableOpacity
          style={[styles.confirmBtn, !allPicked && styles.confirmBtnDisabled]}
          onPress={handleConfirm}
          disabled={!allPicked}
          activeOpacity={0.7}
        >
          <Text style={styles.confirmText}>
            {allPicked ? 'CONFIRM TEAM' : `PICK ${roleOptions.length - Object.keys(selections).length} MORE`}
          </Text>
        </TouchableOpacity>
      </View>
      <PokemonDetailModal visible={detailSpecies !== null} species={detailSpecies} moves={detailMoves} onClose={() => setDetailSpecies(null)} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    alignItems: 'center',
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  backBtn: {
    color: colors.textSecondary,
    fontSize: 22,
    fontWeight: '700',
    paddingHorizontal: spacing.xs,
  },
  title: {
    flex: 1,
    fontSize: 22,
    fontWeight: '900',
    color: colors.accent,
    letterSpacing: 3,
  },
  budgetPill: {
    backgroundColor: colors.surface,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  budgetText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '800',
  },
  budgetSpent: {
    color: colors.textDim,
  },
  playerLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textDim,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginTop: spacing.xs,
  },
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    paddingVertical: spacing.md,
  },
  roleSection: {
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.lg,
  },
  roleName: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginBottom: spacing.sm,
  },
  optionRow: {
    flexDirection: 'row',
    gap: CARD_GAP,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 10,
    alignItems: 'center',
    paddingTop: spacing.xl,
    paddingBottom: spacing.sm,
    paddingHorizontal: spacing.xs,
    borderWidth: 2,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  cardSelected: {
    borderColor: colors.accent,
    backgroundColor: 'rgba(233,69,96,0.1)',
  },
  cardDisabled: {
    opacity: 0.35,
  },
  tierBadge: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingVertical: 2,
  },
  tierBadgeText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  cardName: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.text,
    marginTop: spacing.xs,
    textAlign: 'center',
  },
  cardNameDisabled: {
    color: colors.textDim,
  },
  confirmBar: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  confirmBtn: {
    backgroundColor: colors.accent,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  confirmBtnDisabled: {
    backgroundColor: colors.surface,
    opacity: 0.5,
  },
  confirmText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 1,
  },
});
