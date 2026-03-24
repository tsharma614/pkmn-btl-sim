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
import { colors, spacing } from '../theme';
import type { DraftPoolEntry } from '../../engine/draft-pool';
import type { DraftRole, RoleDraftPoolEntry } from '../../engine/draft-pool';
import { ROLE_LABELS, DRAFT_ROLES } from '../../engine/draft-pool';

const NUM_COLUMNS = 4;
const CARD_GAP = 8;

const TIER_COLORS: Record<number, string> = {
  1: '#FFD700',
  2: '#C0C0C0',
  3: '#CD7F32',
  4: '#666',
};

const ROLE_COLORS: Record<DraftRole, string> = {
  physSweeper: '#e94560',
  specSweeper: '#7b68ee',
  physWall: '#cd853f',
  specWall: '#4fc3f7',
  support: '#66bb6a',
  mega: '#FF6B9D',
};

interface RoleDraftScreenProps {
  pool: DraftPoolEntry[];
  yourPicks: DraftPoolEntry[];
  opponentPicks: DraftPoolEntry[];
  currentPlayer: 0 | 1;
  yourPlayerIndex: 0 | 1;
  pickNumber: number;
  roleRound: number;
  roleOrder: DraftRole[];
  onPick: (poolIndex: number) => void;
  onReroll?: () => void;
  draftRerolled?: boolean;
  opponentName: string;
  playerName: string;
  onBack?: () => void;
  gymLeaderTitle?: string | null;
}

export function RoleDraftScreen({
  pool,
  yourPicks,
  opponentPicks,
  currentPlayer,
  yourPlayerIndex,
  pickNumber,
  roleRound,
  roleOrder,
  onPick,
  onReroll,
  draftRerolled,
  opponentName,
  playerName,
  onBack,
  gymLeaderTitle,
}: RoleDraftScreenProps) {
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

  // Reset selection when role round changes
  useEffect(() => {
    setSelected(null);
  }, [roleRound]);

  const isYourTurn = currentPlayer === yourPlayerIndex;
  const totalPicks = 12;
  const pickedIndices = new Set<number>();
  const yourPickIndices = new Set<number>();
  const oppPickIndices = new Set<number>();

  for (const entry of yourPicks) {
    const idx = pool.findIndex(p => p.species.id === entry.species.id);
    if (idx >= 0) { pickedIndices.add(idx); yourPickIndices.add(idx); }
  }
  for (const entry of opponentPicks) {
    const idx = pool.findIndex(p => p.species.id === entry.species.id);
    if (idx >= 0) { pickedIndices.add(idx); oppPickIndices.add(idx); }
  }

  const currentRole = roleRound < roleOrder.length ? roleOrder[roleRound] : null;
  const isDraftComplete = pickNumber >= totalPicks;

  // Group pool by role
  const rolePool = pool as RoleDraftPoolEntry[];

  const handlePick = () => {
    if (selected === null || !isYourTurn || pickedIndices.has(selected)) return;
    // Verify pick is in current role
    if (currentRole && rolePool[selected]?.role !== currentRole) return;
    lightTap();
    onPick(selected);
    setSelected(null);
  };

  const handlePickFromModal = (poolIndex: number) => {
    if (currentRole && rolePool[poolIndex]?.role === currentRole && !pickedIndices.has(poolIndex)) {
      lightTap();
      onPick(poolIndex);
    }
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
          <Text style={styles.title}>{gymLeaderTitle || 'ROLE DRAFT'}</Text>
          {onReroll && pickNumber === 0 && (
            <TouchableOpacity style={styles.rerollBtn} onPress={onReroll}>
              <Text style={styles.rerollText}>REROLL</Text>
            </TouchableOpacity>
          )}
        </View>
        {showRerolled && (
          <Text style={styles.rerolledFlash}>Pool rerolled!</Text>
        )}
        <Text style={styles.pickCount}>Round {Math.min(roleRound + 1, 6)}/6</Text>
        {currentRole && !isDraftComplete && (
          <View style={[styles.roleBadge, { backgroundColor: ROLE_COLORS[currentRole] }]}>
            <Text style={styles.roleBadgeText}>{ROLE_LABELS[currentRole]}</Text>
          </View>
        )}
        <Text style={[styles.turnText, isYourTurn ? styles.yourTurn : styles.oppTurn]}>
          {isDraftComplete ? 'Draft Complete!' : isYourTurn ? 'Your Pick' : `${opponentName}'s Pick...`}
        </Text>
      </View>

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

        {/* Role sections */}
        {roleOrder.map((role, roundIdx) => {
          const roleEntries = rolePool
            .map((entry, i) => ({ entry, index: i }))
            .filter(({ entry }) => entry.role === role);
          const isCurrentRole = roundIdx === roleRound && !isDraftComplete;
          const isPastRole = roundIdx < roleRound;

          return (
            <View key={role} style={[styles.roleSection, isCurrentRole && styles.roleSectionActive]}>
              <View style={styles.roleLabelRow}>
                <View style={[styles.roleDot, { backgroundColor: ROLE_COLORS[role] }]} />
                <Text style={[styles.roleLabelText, isCurrentRole && styles.roleLabelTextActive]}>
                  {ROLE_LABELS[role]}
                </Text>
                {isPastRole && <Text style={styles.roleComplete}>Done</Text>}
              </View>
              <View style={styles.roleGrid}>
                {roleEntries.map(({ entry, index }) => {
                  const isPicked = pickedIndices.has(index);
                  const isYourPick = yourPickIndices.has(index);
                  const isSelected = selected === index;
                  const isDisabled = !isCurrentRole || isPicked;

                  return (
                    <TouchableOpacity
                      key={entry.species.id}
                      style={[
                        styles.poolCard,
                        { width: cardW },
                        isSelected && styles.poolCardSelected,
                        isPicked && styles.poolCardPicked,
                        !isCurrentRole && !isPicked && styles.poolCardInactive,
                      ]}
                      onPress={() => !isDisabled && isYourTurn && setSelected(index)}
                      onLongPress={() => setPreviewIndex(index)}
                      activeOpacity={isDisabled ? 1 : 0.7}
                      disabled={isDisabled && !isYourTurn}
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
            </View>
          );
        })}
      </ScrollView>

      {/* Confirm button */}
      <View style={styles.confirmBar}>
        {!isYourTurn && !isDraftComplete ? (
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
          canPick={isYourTurn && !isDraftComplete && currentRole === rolePool[previewIndex]?.role}
        />
      )}

      {/* Exit confirmation overlay */}
      {showExitConfirm && (
        <View style={styles.exitOverlay}>
          <View style={styles.exitModal}>
            <Text style={styles.exitTitle}>Exit Draft?</Text>
            <Text style={styles.exitSub}>Your draft progress will be lost.</Text>
            <TouchableOpacity
              style={styles.exitConfirmBtn}
              onPress={() => { setShowExitConfirm(false); onBack?.(); }}
              activeOpacity={0.7}
            >
              <Text style={styles.exitConfirmText}>Exit to Menu</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.exitCancelBtn}
              onPress={() => setShowExitConfirm(false)}
              activeOpacity={0.7}
            >
              <Text style={styles.exitCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
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
    paddingBottom: spacing.xs,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  rerollBtn: {
    backgroundColor: colors.surfaceLight,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.border,
  },
  rerollText: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
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
  roleBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: 4,
  },
  roleBadgeText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 1,
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
  roleSection: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    opacity: 0.5,
  },
  roleSectionActive: {
    opacity: 1,
    backgroundColor: 'rgba(255,255,255,0.02)',
  },
  roleLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  roleDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  roleLabelText: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.textDim,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  roleLabelTextActive: {
    color: colors.text,
  },
  roleComplete: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.textDim,
    marginLeft: 'auto',
  },
  roleGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: CARD_GAP,
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
  poolCardInactive: {
    opacity: 0.4,
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
    backgroundColor: colors.background,
    borderRadius: 16,
    padding: spacing.xl,
    width: '80%',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.border,
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
  exitConfirmBtn: {
    backgroundColor: colors.accent,
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 10,
    marginTop: spacing.lg,
  },
  exitConfirmText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
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
