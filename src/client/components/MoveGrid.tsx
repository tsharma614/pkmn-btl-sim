import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Pressable,
  Animated,
} from 'react-native';
import { CategoryIcon } from './CategoryIcon';
import { lightTap } from '../utils/haptics';
import { typeColors, colors, spacing, shadows } from '../theme';
import { getTypeEffectiveness } from '../../data/type-chart';
import type { OwnPokemon } from '../../server/types';
import type { PokemonType } from '../../types';

interface Props {
  active: OwnPokemon;
  onSelectMove: (index: number) => void;
  disabled: boolean;
  opponentTypes?: PokemonType[];
}

function getEffBadge(move: OwnPokemon['moves'][0], opponentTypes?: PokemonType[]): { label: string; color: string } | null {
  if (!opponentTypes || opponentTypes.length === 0) return null;
  if (move.category === 'Status') return null;
  const eff = getTypeEffectiveness(move.type as PokemonType, opponentTypes);
  if (eff === 0) return { label: 'IMMUNE', color: colors.hpRed };
  if (eff >= 2) return { label: 'SE', color: colors.hpGreen };
  if (eff < 1) return { label: 'NVE', color: colors.greyDark };
  return null;
}

function MoveButton({ move, index, isDisabled, onPress, onLongPress, opponentTypes }: {
  move: OwnPokemon['moves'][0];
  index: number;
  isDisabled: boolean;
  onPress: () => void;
  onLongPress: () => void;
  opponentTypes?: PokemonType[];
}) {
  const scale = useRef(new Animated.Value(1)).current;
  const bg = typeColors[move.type] || '#555';
  const ppRatio = move.maxPp > 0 ? move.currentPp / move.maxPp : 0;
  const darkerBg = darkenColor(bg, 0.65);
  const effBadge = getEffBadge(move, opponentTypes);

  const handlePressIn = () => {
    Animated.spring(scale, {
      toValue: 0.95,
      useNativeDriver: true,
      speed: 50,
      bounciness: 4,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: true,
      speed: 50,
      bounciness: 4,
    }).start();
  };

  return (
    <Animated.View style={[styles.moveBtnWrap, { transform: [{ scale }] }]}>
      <TouchableOpacity
        style={[
          styles.moveBtn,
          {
            backgroundColor: bg,
            shadowColor: darkerBg,
          },
          isDisabled && styles.moveBtnDisabled,
        ]}
        onPress={() => { lightTap(); onPress(); }}
        onLongPress={onLongPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        delayLongPress={300}
        disabled={isDisabled}
        activeOpacity={1}
      >
        {/* Gradient-like bottom darkening */}
        <View style={[styles.gradientOverlay, { backgroundColor: darkerBg }]} />

        {/* Effectiveness badge pill */}
        {effBadge && (
          <View style={[styles.effBadge, { backgroundColor: effBadge.color }]}>
            <Text style={styles.effBadgeText}>{effBadge.label}</Text>
          </View>
        )}

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
          <View style={[
            styles.ppFill,
            {
              width: `${ppRatio * 100}%`,
              backgroundColor: ppRatio > 0.5
                ? 'rgba(255,255,255,0.7)'
                : ppRatio > 0.25
                  ? colors.hpYellow
                  : colors.hpRed,
            },
          ]} />
        </View>
        <Text style={styles.ppLabel}>
          PP {move.currentPp}/{move.maxPp}
        </Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

export function MoveGrid({ active, onSelectMove, disabled, opponentTypes }: Props) {
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
          (active.choiceLocked !== null && move.name !== active.choiceLocked) ||
          (active.encoreMove != null && move.name !== active.encoreMove);

        return (
          <MoveButton
            key={i}
            move={move}
            index={i}
            isDisabled={isDisabled}
            onPress={() => onSelectMove(i)}
            onLongPress={() => setTooltip({ move, index: i })}
            opponentTypes={opponentTypes}
          />
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

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    padding: spacing.md,
  },
  moveBtnWrap: {
    width: '47%',
    flexGrow: 1,
  },
  moveBtn: {
    borderRadius: 14,
    padding: spacing.md,
    paddingBottom: spacing.sm,
    minHeight: 84,
    justifyContent: 'space-between',
    overflow: 'hidden',
    // Shadow for depth
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 6,
  },
  gradientOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '45%',
    opacity: 0.3,
    borderBottomLeftRadius: 14,
    borderBottomRightRadius: 14,
  },
  moveBtnDisabled: {
    opacity: 0.35,
  },
  effBadge: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
    zIndex: 2,
  },
  effBadgeText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  moveName: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '800',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
    marginBottom: spacing.sm,
  },
  midRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
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
    height: 5,
    backgroundColor: 'rgba(0,0,0,0.35)',
    borderRadius: 3,
    marginBottom: 4,
    overflow: 'hidden',
  },
  ppFill: {
    height: 5,
    borderRadius: 3,
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
    ...shadows.lg,
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
