import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  useWindowDimensions,
  ActivityIndicator,
} from 'react-native';
import { lightTap } from '../utils/haptics';
import { PokemonSprite } from './PokemonSprite';
import { TypeBadge } from './TypeBadge';
import { DraftPreviewModal } from './DraftPreviewModal';
import { PkButton } from './shared/PkButton';
import { PkCard } from './shared/PkCard';
import { colors, spacing, shadows, typeColors } from '../theme';
import type { DraftPoolEntry } from '../../engine/draft-pool';

const NUM_COLUMNS = 3;
const CARD_GAP = 10;

const TIER_META: Record<number, { label: string; color: string; bg: string }> = {
  0: { label: 'MEGA', color: '#FFFFFF', bg: '#F59E0B' },
  1: { label: 'T1', color: '#FFFFFF', bg: '#C0C0C0' },
  2: { label: 'T2', color: '#FFFFFF', bg: '#CD7F32' },
  3: { label: 'T3', color: '#FFFFFF', bg: '#6B7280' },
  4: { label: 'T4', color: '#FFFFFF', bg: '#4B5563' },
};

interface DraftScreenProps {
  pool: DraftPoolEntry[];
  yourPicks: DraftPoolEntry[];
  opponentPicks: DraftPoolEntry[];
  currentPlayer: 0 | 1;
  yourPlayerIndex: 0 | 1;
  pickNumber: number;
  onPick: (poolIndex: number) => void;
  onReroll?: () => void;
  draftRerolled?: boolean;
  opponentName: string;
  playerName: string;
  onBack?: () => void;
  gymLeaderTitle?: string | null;
}

export function DraftScreen({
  pool,
  yourPicks,
  opponentPicks,
  currentPlayer,
  yourPlayerIndex,
  pickNumber,
  onPick,
  onReroll,
  draftRerolled,
  opponentName,
  playerName,
  onBack,
  gymLeaderTitle,
}: DraftScreenProps) {
  const { width: screenW } = useWindowDimensions();
  const cardW = (screenW - spacing.lg * 2 - CARD_GAP * (NUM_COLUMNS - 1)) / NUM_COLUMNS;

  const [selected, setSelected] = useState<number | null>(null);
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);
  const [showRerolled, setShowRerolled] = useState(false);
  const [showExitConfirm, setShowExitConfirm] = useState(false);

  useEffect(() => {
    setSelected(null);
    setPreviewIndex(null);
    if (draftRerolled) {
      setShowRerolled(true);
      const timer = setTimeout(() => setShowRerolled(false), 2500);
      return () => clearTimeout(timer);
    }
  }, [draftRerolled, pool]);

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
    lightTap();
    onPick(selected);
    setSelected(null);
  };

  const handlePickFromModal = (poolIndex: number) => {
    lightTap();
    onPick(poolIndex);
    setPreviewIndex(null);
    setSelected(null);
  };

  const selectedEntry = selected !== null ? pool[selected] : null;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerRow}>
          {onBack && (
            <TouchableOpacity onPress={() => setShowExitConfirm(true)} hitSlop={8}>
              <Text style={styles.backBtn}>✕</Text>
            </TouchableOpacity>
          )}
          <Text style={styles.title}>{gymLeaderTitle || 'DRAFT MODE'}</Text>
          {onReroll && pickNumber === 0 && (
            <PkButton
              title="REROLL"
              variant="secondary"
              size="sm"
              onPress={onReroll}
            />
          )}
        </View>
        {showRerolled && (
          <Text style={styles.rerolledFlash}>Pool rerolled!</Text>
        )}
        <Text style={styles.pickCount}>Pick {Math.min(pickNumber + 1, totalPicks)}/{totalPicks}</Text>
        <Text style={[styles.turnText, isYourTurn ? styles.yourTurn : styles.oppTurn]}>
          {pickNumber >= totalPicks ? 'Draft Complete!' : isYourTurn ? 'Your Pick' : `${opponentName}'s Pick...`}
        </Text>
      </View>

      {/* Pool grid with sticky teams header */}
      <ScrollView style={styles.poolScroll} stickyHeaderIndices={[0]}>
        {/* Sticky teams section */}
        <View style={styles.teamsSticky}>
          <View style={styles.teamsRow}>
            <View style={[styles.teamStrip, styles.yourTeamStrip]}>
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
            <View style={[styles.teamStrip, styles.oppTeamStrip]}>
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
        </View>

        {/* Pool grid -- megas first, then by tier */}
        <View style={styles.poolGrid}>
        {pool
          .map((entry, i) => ({ entry, i }))
          .sort((a, b) => a.entry.tier - b.entry.tier)
          .map(({ entry, i }) => {
          const isPicked = pickedIndices.has(i);
          const isYourPick = yourPickIndices.has(i);
          const isOppPick = oppPickIndices.has(i);
          const isSelected = selected === i;
          const tierMeta = TIER_META[entry.tier] || TIER_META[4];
          const primaryType = entry.species.types[0];
          const accentColor = typeColors[primaryType] || colors.border;

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
              {/* Type accent bar at top */}
              <View style={[styles.accentBar, { backgroundColor: accentColor }]} />

              {isPicked && (
                <View style={[
                  styles.pickedOverlay,
                  isYourPick ? styles.yourPickOverlay : styles.oppPickOverlay,
                ]} />
              )}

              {/* Tier badge */}
              <View style={[styles.tierBadge, { backgroundColor: tierMeta.bg }]}>
                <Text style={[styles.tierBadgeText, { color: tierMeta.color }]}>{tierMeta.label}</Text>
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
          <PkButton
            title={selected !== null ? `PICK ${selectedEntry?.species.name?.toUpperCase()}` : 'SELECT A POKEMON'}
            variant="primary"
            size="md"
            onPress={handlePick}
            disabled={!isYourTurn || selected === null}
            style={{ width: '100%' }}
          />
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

      {/* Exit confirmation overlay */}
      {showExitConfirm && (
        <View style={styles.exitOverlay}>
          <PkCard style={styles.exitModal} padding="spacious">
            <Text style={styles.exitTitle}>Exit Draft?</Text>
            <Text style={styles.exitSub}>Your draft progress will be lost.</Text>
            <PkButton
              title="Exit to Menu"
              variant="primary"
              size="md"
              onPress={() => { setShowExitConfirm(false); onBack?.(); }}
              style={{ marginTop: spacing.lg, width: '100%' }}
            />
            <TouchableOpacity
              style={styles.exitCancelBtn}
              onPress={() => setShowExitConfirm(false)}
              activeOpacity={0.7}
            >
              <Text style={styles.exitCancelText}>Cancel</Text>
            </TouchableOpacity>
          </PkCard>
        </View>
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
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  rerolledFlash: {
    color: '#4fc3f7',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 2,
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
  },
  teamsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  teamStrip: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: spacing.sm,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  yourTeamStrip: {
    borderColor: 'rgba(79,195,247,0.3)',
  },
  oppTeamStrip: {
    borderColor: 'rgba(233,69,96,0.3)',
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
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.05)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  miniSlotEmpty: {
    width: 32,
    height: 32,
    borderRadius: 6,
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
    borderRadius: 12,
    alignItems: 'center',
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    paddingHorizontal: 4,
    borderWidth: 2,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  accentBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 3,
    borderTopLeftRadius: 10,
    borderTopRightRadius: 10,
  },
  poolCardSelected: {
    borderColor: colors.accentGold,
    shadowColor: colors.accentGold,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 8,
  },
  poolCardPicked: {
    opacity: 0.45,
  },
  pickedOverlay: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 10,
    zIndex: 1,
  },
  yourPickOverlay: {
    backgroundColor: 'rgba(79,195,247,0.12)',
  },
  oppPickOverlay: {
    backgroundColor: 'rgba(233,69,96,0.12)',
  },
  tierBadge: {
    position: 'absolute',
    top: 6,
    right: 4,
    zIndex: 2,
    borderRadius: 6,
    paddingHorizontal: 5,
    paddingVertical: 1,
    minWidth: 22,
    alignItems: 'center',
  },
  tierBadgeText: {
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  cardName: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.text,
    marginTop: 4,
    textAlign: 'center',
  },
  cardNamePicked: {
    color: colors.textDim,
  },
  cardTypes: {
    flexDirection: 'row',
    gap: 2,
    marginTop: 4,
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
  backBtn: {
    color: colors.textDim,
    fontSize: 16,
    fontWeight: '700',
    paddingHorizontal: 4,
  },
  exitOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
  },
  exitModal: {
    width: '80%',
    alignItems: 'center',
  },
  exitTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '800',
  },
  exitSub: {
    color: colors.textSecondary,
    fontSize: 13,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
  exitCancelBtn: {
    marginTop: spacing.md,
  },
  exitCancelText: {
    color: colors.textDim,
    fontSize: 14,
    fontWeight: '600',
  },
});
