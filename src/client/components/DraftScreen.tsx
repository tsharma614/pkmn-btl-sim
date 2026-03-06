import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  useWindowDimensions,
  ActivityIndicator,
} from 'react-native';
import { PokemonSprite } from './PokemonSprite';
import { TypeBadge } from './TypeBadge';
import { DraftPreviewModal } from './DraftPreviewModal';
import { colors, spacing } from '../theme';
import type { DraftPoolEntry } from '../../engine/draft-pool';

const NUM_COLUMNS = 3;
const CARD_GAP = 8;

const TIER_COLORS: Record<number, string> = {
  1: '#FFD700', // gold
  2: '#C0C0C0', // silver
  3: '#CD7F32', // bronze
  4: '#666',    // gray
};

interface DraftScreenProps {
  pool: DraftPoolEntry[];
  yourPicks: DraftPoolEntry[];
  opponentPicks: DraftPoolEntry[];
  currentPlayer: 0 | 1;
  yourPlayerIndex: 0 | 1;
  pickNumber: number;
  onPick: (poolIndex: number) => void;
  opponentName: string;
  playerName: string;
}

export function DraftScreen({
  pool,
  yourPicks,
  opponentPicks,
  currentPlayer,
  yourPlayerIndex,
  pickNumber,
  onPick,
  opponentName,
  playerName,
}: DraftScreenProps) {
  const { width: screenW } = useWindowDimensions();
  const cardW = (screenW - spacing.lg * 2 - CARD_GAP * (NUM_COLUMNS - 1)) / NUM_COLUMNS;

  const [selected, setSelected] = useState<number | null>(null);
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);

  const isYourTurn = currentPlayer === yourPlayerIndex;
  const totalPicks = 12;
  const pickedIndices = new Set<number>();
  const yourPickIndices = new Set<number>();
  const oppPickIndices = new Set<number>();

  // Build picked indices from the picks arrays
  for (const entry of yourPicks) {
    const idx = pool.findIndex(p => p.species.id === entry.species.id);
    if (idx >= 0) {
      pickedIndices.add(idx);
      yourPickIndices.add(idx);
    }
  }
  for (const entry of opponentPicks) {
    const idx = pool.findIndex(p => p.species.id === entry.species.id);
    if (idx >= 0) {
      pickedIndices.add(idx);
      oppPickIndices.add(idx);
    }
  }

  const handlePick = () => {
    if (selected === null || !isYourTurn || pickedIndices.has(selected)) return;
    onPick(selected);
    setSelected(null);
  };

  const handlePickFromModal = (poolIndex: number) => {
    onPick(poolIndex);
    setPreviewIndex(null);
    setSelected(null);
  };

  const selectedEntry = selected !== null ? pool[selected] : null;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>DRAFT MODE</Text>
        <Text style={styles.pickCount}>Pick {Math.min(pickNumber + 1, totalPicks)}/{totalPicks}</Text>
        <Text style={[styles.turnText, isYourTurn ? styles.yourTurn : styles.oppTurn]}>
          {pickNumber >= totalPicks ? 'Draft Complete!' : isYourTurn ? 'Your Pick' : `${opponentName}'s Pick...`}
        </Text>
      </View>

      {/* Pool grid with sticky teams header */}
      <ScrollView style={styles.poolScroll} stickyHeaderIndices={[0]}>
        {/* Sticky teams section */}
        <View style={styles.teamsSticky}>
          <View style={styles.teamStrip}>
            <Text style={styles.teamLabel}>{playerName}</Text>
            <View style={styles.teamMinis}>
              {yourPicks.map((entry, i) => (
                <View key={i} style={styles.miniSlot}>
                  <PokemonSprite speciesId={entry.species.id} facing="front" size={32} />
                </View>
              ))}
              {Array.from({ length: 6 - yourPicks.length }).map((_, i) => (
                <View key={`empty-${i}`} style={styles.miniSlotEmpty} />
              ))}
            </View>
          </View>
          <View style={styles.teamStrip}>
            <Text style={styles.teamLabel}>{opponentName}</Text>
            <View style={styles.teamMinis}>
              {opponentPicks.map((entry, i) => (
                <View key={i} style={styles.miniSlot}>
                  <PokemonSprite speciesId={entry.species.id} facing="front" size={32} />
                </View>
              ))}
              {Array.from({ length: 6 - opponentPicks.length }).map((_, i) => (
                <View key={`empty-${i}`} style={styles.miniSlotEmpty} />
              ))}
            </View>
          </View>
        </View>

        {/* Pool grid */}
        <View style={styles.poolGrid}>
        {pool.map((entry, i) => {
          const isPicked = pickedIndices.has(i);
          const isYourPick = yourPickIndices.has(i);
          const isOppPick = oppPickIndices.has(i);
          const isSelected = selected === i;

          return (
            <TouchableOpacity
              key={entry.species.id}
              style={[
                styles.poolCard,
                { width: cardW },
                isSelected && styles.poolCardSelected,
                isPicked && styles.poolCardPicked,
              ]}
              onPress={() => !isPicked && isYourTurn && setSelected(i)}
              onLongPress={() => setPreviewIndex(i)}
              activeOpacity={isPicked ? 1 : 0.7}
              disabled={isPicked && !isYourTurn}
            >
              {isPicked && (
                <View style={[
                  styles.pickedOverlay,
                  isYourPick ? styles.yourPickOverlay : styles.oppPickOverlay,
                ]} />
              )}
              <View style={styles.tierDot}>
                <View style={[styles.tierDotInner, { backgroundColor: TIER_COLORS[entry.tier] || '#666' }]} />
              </View>
              <PokemonSprite speciesId={entry.species.id} facing="front" size={48} />
              <Text style={[styles.cardName, isPicked && styles.cardNamePicked]} numberOfLines={1}>
                {entry.species.name}
              </Text>
              <View style={styles.cardTypes}>
                {entry.species.types.map(t => (
                  <TypeBadge key={t} type={t} small />
                ))}
              </View>
              {isPicked && (
                <Text style={styles.pickedLabel}>
                  {isYourPick ? playerName : opponentName}
                </Text>
              )}
            </TouchableOpacity>
          );
        })}
        </View>
      </ScrollView>

      {/* Confirm button */}
      <View style={styles.confirmBar}>
        {!isYourTurn && pickNumber < totalPicks ? (
          <View style={styles.waitingRow}>
            <ActivityIndicator size="small" color={colors.accent} />
            <Text style={styles.waitingText}>{opponentName} is picking...</Text>
          </View>
        ) : (
          <TouchableOpacity
            style={[styles.confirmBtn, (!isYourTurn || selected === null) && styles.confirmBtnDisabled]}
            onPress={handlePick}
            disabled={!isYourTurn || selected === null}
            activeOpacity={0.7}
          >
            <Text style={styles.confirmText}>
              {selected !== null ? `PICK ${selectedEntry?.species.name?.toUpperCase()}` : 'SELECT A POKEMON'}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Preview modal */}
      {previewIndex !== null && (
        <DraftPreviewModal
          pool={pool}
          pickedIndices={pickedIndices}
          initialIndex={previewIndex}
          visible={true}
          onClose={() => setPreviewIndex(null)}
          onPick={handlePickFromModal}
          canPick={isYourTurn && pickNumber < totalPicks}
        />
      )}
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
  },
  title: {
    fontSize: 22,
    fontWeight: '900',
    color: colors.accent,
    letterSpacing: 3,
  },
  pickCount: {
    fontSize: 13,
    color: colors.textSecondary,
    fontWeight: '600',
    marginTop: 2,
  },
  turnText: {
    fontSize: 14,
    fontWeight: '700',
    marginTop: 4,
  },
  yourTurn: {
    color: '#4fc3f7',
  },
  oppTurn: {
    color: colors.textDim,
  },
  teamsSticky: {
    backgroundColor: colors.background,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
    gap: spacing.xs,
  },
  teamStrip: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: 10,
    padding: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  teamLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.textDim,
    textTransform: 'uppercase',
    letterSpacing: 1,
    textAlign: 'center',
    marginBottom: 4,
  },
  teamMinis: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 2,
  },
  miniSlot: {
    width: 32,
    height: 32,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.05)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  miniSlotEmpty: {
    width: 32,
    height: 32,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    borderStyle: 'dashed',
  },
  poolScroll: {
    flex: 1,
  },
  poolGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: CARD_GAP,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.lg,
  },
  poolCard: {
    backgroundColor: colors.surface,
    borderRadius: 10,
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: 4,
    borderWidth: 2,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  poolCardSelected: {
    borderColor: '#4fc3f7',
    backgroundColor: 'rgba(79,195,247,0.1)',
  },
  poolCardPicked: {
    opacity: 0.5,
  },
  pickedOverlay: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 8,
    zIndex: 1,
  },
  yourPickOverlay: {
    backgroundColor: 'rgba(79,195,247,0.12)',
  },
  oppPickOverlay: {
    backgroundColor: 'rgba(233,69,96,0.12)',
  },
  tierDot: {
    position: 'absolute',
    top: 4,
    right: 4,
    zIndex: 2,
  },
  tierDotInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  cardName: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.text,
    marginTop: 2,
    textAlign: 'center',
  },
  cardNamePicked: {
    color: colors.textDim,
  },
  cardTypes: {
    flexDirection: 'row',
    gap: 2,
    marginTop: 3,
  },
  pickedLabel: {
    fontSize: 8,
    fontWeight: '700',
    color: colors.textDim,
    marginTop: 2,
    zIndex: 2,
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
  waitingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: 14,
  },
  waitingText: {
    color: colors.textDim,
    fontSize: 14,
    fontWeight: '600',
  },
});
