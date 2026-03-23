import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { MONOTYPE_TYPES, POOL_SIZES } from '../../engine/draft-pool';
import type { PoolSize, DraftType } from '../../engine/draft-pool';
import { colors, spacing, typeColors } from '../theme';

interface Props {
  itemMode: 'competitive' | 'casual';
  setItemMode: (mode: 'competitive' | 'casual') => void;
  classicMode: boolean;
  setClassicMode: (v: boolean) => void;
  legendaryMode: boolean;
  setLegendaryMode: (v: boolean) => void;
  draftMode: boolean;
  setDraftMode: (v: boolean) => void;
  monotype: string | null;
  setMonotype: (v: string | null) => void;
  draftTypeMode: DraftType;
  setDraftTypeMode: (v: DraftType) => void;
  poolSize: PoolSize;
  setPoolSize: (v: PoolSize) => void;
  megaMode: boolean;
  setMegaMode: (v: boolean) => void;
  moveSelection: boolean;
  setMoveSelection: (v: boolean) => void;
  showPoolSize?: boolean;
  modifierLabel?: string;
  onDraftToggle?: () => void;
}

export function MatchSettingsForm({
  itemMode, setItemMode,
  classicMode, setClassicMode,
  legendaryMode, setLegendaryMode,
  draftMode, setDraftMode,
  monotype, setMonotype,
  draftTypeMode, setDraftTypeMode,
  poolSize, setPoolSize,
  megaMode, setMegaMode,
  moveSelection, setMoveSelection,
  showPoolSize = false,
  modifierLabel = 'Modifiers',
  onDraftToggle,
}: Props) {
  return (
    <>
      {/* Items */}
      <View style={styles.sectionCompact}>
        <Text style={styles.label}>Items</Text>
        <View style={styles.toggleRow}>
          <TouchableOpacity
            style={[styles.toggleBtn, itemMode === 'competitive' && styles.toggleBtnActive]}
            onPress={() => setItemMode('competitive')}
            activeOpacity={0.7}
          >
            <Text style={[styles.toggleText, itemMode === 'competitive' && styles.toggleTextActive]}>Competitive</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toggleBtn, itemMode === 'casual' && styles.toggleBtnActive]}
            onPress={() => setItemMode('casual')}
            activeOpacity={0.7}
          >
            <Text style={[styles.toggleText, itemMode === 'casual' && styles.toggleTextActive]}>Casual</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Modifiers */}
      <View style={styles.sectionCompact}>
        <Text style={styles.label}>{modifierLabel}</Text>
        <View style={styles.pillRow}>
          <TouchableOpacity
            style={[styles.pill, classicMode && styles.pillActive]}
            onPress={() => setClassicMode(!classicMode)}
            activeOpacity={0.7}
          >
            <Text style={[styles.pillText, classicMode && styles.pillTextActive]}>Classic</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.pill, legendaryMode && styles.pillActive]}
            onPress={() => setLegendaryMode(!legendaryMode)}
            activeOpacity={0.7}
          >
            <Text style={[styles.pillText, legendaryMode && styles.pillTextActive]}>Legendary</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.pill, draftMode && styles.pillActive]}
            onPress={() => {
              if (onDraftToggle) onDraftToggle();
              else setDraftMode(!draftMode);
            }}
            activeOpacity={0.7}
          >
            <Text style={[styles.pillText, draftMode && styles.pillTextActive]}>Draft</Text>
          </TouchableOpacity>
          {draftMode && (
            <TouchableOpacity
              style={[styles.pill, !!monotype && styles.pillActive]}
              onPress={() => { setMonotype(monotype ? null : 'random'); if (!monotype) setDraftTypeMode('snake'); }}
              activeOpacity={0.7}
            >
              <Text style={[styles.pillText, !!monotype && styles.pillTextActive]}>Monotype</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={[styles.pill, megaMode && styles.pillActive]}
            onPress={() => setMegaMode(!megaMode)}
            activeOpacity={0.7}
          >
            <Text style={[styles.pillText, megaMode && styles.pillTextActive]}>Mega</Text>
          </TouchableOpacity>
          {draftMode && (
            <TouchableOpacity
              style={[styles.pill, moveSelection && styles.pillActive]}
              onPress={() => setMoveSelection(!moveSelection)}
              activeOpacity={0.7}
            >
              <Text style={[styles.pillText, moveSelection && styles.pillTextActive]}>Pick Moves</Text>
            </TouchableOpacity>
          )}
        </View>
        {(classicMode || legendaryMode || draftMode || megaMode) && (
          <Text style={styles.modifierDesc}>
            {[
              classicMode && 'Gen 1–4 only',
              legendaryMode && 'T1 & T2 Pokemon',
              draftMode && (draftTypeMode === 'role' ? 'Role draft from shared pool' : 'Snake draft from shared pool'),
              showPoolSize && draftMode && poolSize !== 21 && `${poolSize} Pokemon pool`,
              monotype && (monotype === 'random' ? 'Random type' : monotype + ' type'),
              megaMode && (draftMode ? 'Mega evolutions in draft pool' : '~25% chance of a mega on each team'),
              moveSelection && 'Choose your moves after draft',
            ].filter(Boolean).join(' · ')}
          </Text>
        )}
      </View>

      {/* Draft options */}
      {draftMode && (
        <View style={styles.sectionCompact}>
          <Text style={styles.label}>Draft Options</Text>
          <View style={styles.toggleRow}>
            <TouchableOpacity
              style={[styles.toggleBtn, draftTypeMode === 'snake' && styles.toggleBtnActive]}
              onPress={() => setDraftTypeMode('snake')}
              activeOpacity={0.7}
            >
              <Text style={[styles.toggleText, draftTypeMode === 'snake' && styles.toggleTextActive]}>Snake</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.toggleBtn, draftTypeMode === 'role' && styles.toggleBtnActive, !!monotype && { opacity: 0.4 }]}
              onPress={() => !monotype && setDraftTypeMode('role')}
              activeOpacity={0.7}
              disabled={!!monotype}
            >
              <Text style={[styles.toggleText, draftTypeMode === 'role' && styles.toggleTextActive]}>Role</Text>
            </TouchableOpacity>
          </View>
          {showPoolSize && draftTypeMode === 'snake' && (
            <>
              <View style={[styles.toggleRow, { marginTop: spacing.sm }]}>
                {POOL_SIZES.map(size => (
                  <TouchableOpacity
                    key={size}
                    style={[styles.toggleBtn, poolSize === size && styles.toggleBtnActive]}
                    onPress={() => setPoolSize(size)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.toggleText, poolSize === size && styles.toggleTextActive]}>{size}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={styles.modifierDesc}>Pool size: {poolSize} Pokemon</Text>
            </>
          )}
          {draftTypeMode === 'role' && (
            <Text style={styles.modifierDesc}>Pick one from each role: Sweepers, Walls, Support, Mega</Text>
          )}
        </View>
      )}

      {/* Monotype picker */}
      {draftMode && monotype && (
        <View style={styles.sectionCompact}>
          <View style={styles.typeGrid}>
            <TouchableOpacity
              style={[styles.typeChip, { backgroundColor: colors.surfaceLight }, monotype === 'random' && styles.typeChipSelected]}
              onPress={() => setMonotype('random')}
              activeOpacity={0.7}
            >
              <Text style={[styles.typeChipText, monotype === 'random' && styles.typeChipTextSelected]}>Random</Text>
            </TouchableOpacity>
            {MONOTYPE_TYPES.map(t => (
              <TouchableOpacity
                key={t}
                style={[
                  styles.typeChip,
                  { backgroundColor: typeColors[t] || '#666' },
                  monotype === t && styles.typeChipSelected,
                ]}
                onPress={() => setMonotype(t)}
                activeOpacity={0.7}
              >
                <Text style={[styles.typeChipText, monotype === t && styles.typeChipTextSelected]}>{t}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  sectionCompact: {
    marginBottom: spacing.md,
  },
  label: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '600',
    marginBottom: spacing.sm,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  toggleRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  toggleBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  toggleBtnActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  toggleText: {
    color: colors.textSecondary,
    fontSize: 14,
    fontWeight: '600',
  },
  toggleTextActive: {
    color: '#fff',
  },
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  pill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pillActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  pillText: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '600',
  },
  pillTextActive: {
    color: '#fff',
  },
  modifierDesc: {
    color: colors.textDim,
    fontSize: 11,
    marginTop: spacing.sm,
  },
  typeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
  },
  typeChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    opacity: 0.7,
  },
  typeChipSelected: {
    opacity: 1,
    borderWidth: 2,
    borderColor: '#fff',
  },
  typeChipText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
  typeChipTextSelected: {
    fontWeight: '900',
  },
});
