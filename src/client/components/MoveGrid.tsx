import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Pressable,
} from 'react-native';
import { CategoryIcon } from './CategoryIcon';
import { typeColors, colors, spacing } from '../theme';
import type { OwnPokemon } from '../../server/types';

interface Props {
  active: OwnPokemon;
  onSelectMove: (index: number) => void;
  disabled: boolean;
}

export function MoveGrid({ active, onSelectMove, disabled }: Props) {
  const [tooltip, setTooltip] = useState<{
    move: OwnPokemon['moves'][0];
    index: number;
  } | null>(null);

  return (
    <View style={styles.grid}>
      {active.moves.map((move, i) => {
        const isDisabled =
          disabled ||
          move.currentPp <= 0 ||
          move.disabled ||
          (active.choiceLocked !== null && move.name !== active.choiceLocked);

        const bg = typeColors[move.type] || '#555';
        const ppRatio = move.maxPp > 0 ? move.currentPp / move.maxPp : 0;
        // Darker shade for border (multiply RGB by ~0.65)
        const borderColor = darkenColor(bg, 0.55);
        const highlightColor = lightenColor(bg, 0.25);

        return (
          <TouchableOpacity
            key={i}
            style={[
              styles.moveBtn,
              {
                backgroundColor: bg,
                borderColor,
                shadowColor: borderColor,
              },
              isDisabled && styles.moveBtnDisabled,
            ]}
            onPress={() => onSelectMove(i)}
            onLongPress={() => setTooltip({ move, index: i })}
            delayLongPress={300}
            disabled={isDisabled}
            activeOpacity={0.8}
          >
            {/* Top highlight edge */}
            <View style={[styles.topHighlight, { backgroundColor: highlightColor }]} />

            {/* Move name */}
            <Text style={styles.moveName} numberOfLines={1}>
              {move.name}
            </Text>

            {/* Middle row: category + type label ... power pill */}
            <View style={styles.midRow}>
              <View style={styles.catType}>
                <CategoryIcon category={move.category} size={13} />
                <Text style={styles.typeLabel}>{move.type}</Text>
              </View>
              {move.power ? (
                <View style={styles.powerPill}>
                  <Text style={styles.powerText}>{move.power}</Text>
                </View>
              ) : null}
            </View>

            {/* PP bar along the bottom */}
            <View style={styles.ppTrack}>
              <View style={[styles.ppFill, { width: `${ppRatio * 100}%` }]} />
            </View>
            <Text style={styles.ppLabel}>
              PP {move.currentPp}/{move.maxPp}
            </Text>
          </TouchableOpacity>
        );
      })}

      {/* Long-press tooltip modal */}
      {tooltip && (
        <Modal transparent animationType="fade" visible onRequestClose={() => setTooltip(null)}>
          <Pressable style={styles.tooltipBackdrop} onPress={() => setTooltip(null)}>
            <View style={styles.tooltipCard}>
              {/* Header */}
              <View style={[styles.tooltipHeader, { backgroundColor: typeColors[tooltip.move.type] || '#555' }]}>
                <Text style={styles.tooltipName}>{tooltip.move.name}</Text>
                <CategoryIcon category={tooltip.move.category} size={16} />
              </View>

              {/* Stats row */}
              <View style={styles.tooltipStats}>
                <View style={styles.tooltipStat}>
                  <Text style={styles.tooltipStatLabel}>Type</Text>
                  <Text style={styles.tooltipStatValue}>{tooltip.move.type}</Text>
                </View>
                <View style={styles.tooltipStat}>
                  <Text style={styles.tooltipStatLabel}>Power</Text>
                  <Text style={styles.tooltipStatValue}>{tooltip.move.power ?? '—'}</Text>
                </View>
                <View style={styles.tooltipStat}>
                  <Text style={styles.tooltipStatLabel}>Accuracy</Text>
                  <Text style={styles.tooltipStatValue}>
                    {tooltip.move.accuracy ? `${tooltip.move.accuracy}%` : '—'}
                  </Text>
                </View>
                <View style={styles.tooltipStat}>
                  <Text style={styles.tooltipStatLabel}>Category</Text>
                  <Text style={styles.tooltipStatValue}>{tooltip.move.category}</Text>
                </View>
              </View>

              {/* Description */}
              {tooltip.move.description ? (
                <Text style={styles.tooltipDesc}>{tooltip.move.description}</Text>
              ) : (
                <Text style={[styles.tooltipDesc, { fontStyle: 'italic', color: colors.textDim }]}>
                  No description available.
                </Text>
              )}

              {/* PP */}
              <Text style={styles.tooltipPp}>
                PP: {tooltip.move.currentPp}/{tooltip.move.maxPp}
              </Text>
            </View>
          </Pressable>
        </Modal>
      )}
    </View>
  );
}

/** Darken a hex color by a factor (0-1). */
function darkenColor(hex: string, factor: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgb(${Math.round(r * factor)}, ${Math.round(g * factor)}, ${Math.round(b * factor)})`;
}

/** Lighten a hex color by mixing with white. */
function lightenColor(hex: string, amount: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${Math.min(255, r + Math.round((255 - r) * amount))}, ${Math.min(255, g + Math.round((255 - g) * amount))}, ${Math.min(255, b + Math.round((255 - b) * amount))}, 0.6)`;
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    padding: spacing.sm,
  },
  moveBtn: {
    width: '47%',
    flexGrow: 1,
    borderRadius: 12,
    padding: spacing.md,
    paddingBottom: spacing.sm,
    minHeight: 76,
    justifyContent: 'space-between',
    overflow: 'hidden',
    // 3D raised border
    borderWidth: 2.5,
    borderBottomWidth: 4,
    borderRightWidth: 3.5,
    // Shadow for depth
    shadowOffset: { width: 2, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 5,
    elevation: 8,
  },
  topHighlight: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 3,
    borderTopLeftRadius: 10,
    borderTopRightRadius: 10,
  },
  moveBtnDisabled: {
    opacity: 0.35,
  },
  moveName: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '800',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
    marginBottom: 6,
  },
  midRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  catType: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  typeLabel: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 11,
    fontWeight: '600',
  },
  powerPill: {
    backgroundColor: 'rgba(0,0,0,0.35)',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  powerText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '800',
  },
  ppTrack: {
    height: 3,
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: 2,
    marginBottom: 3,
    overflow: 'hidden',
  },
  ppFill: {
    height: 3,
    backgroundColor: 'rgba(255,255,255,0.6)',
    borderRadius: 2,
  },
  ppLabel: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 9,
    fontWeight: '600',
    textAlign: 'right',
  },

  // Tooltip modal styles
  tooltipBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  tooltipCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    width: '90%',
    maxWidth: 340,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 12,
  },
  tooltipHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  tooltipName: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '800',
    textShadowColor: 'rgba(0,0,0,0.4)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  tooltipStats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    gap: spacing.xs,
  },
  tooltipStat: {
    width: '46%',
    marginBottom: spacing.sm,
  },
  tooltipStatLabel: {
    color: colors.textDim,
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  tooltipStatValue: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
    marginTop: 2,
  },
  tooltipDesc: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 19,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  tooltipPp: {
    color: colors.textDim,
    fontSize: 11,
    fontWeight: '600',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
  },
});
