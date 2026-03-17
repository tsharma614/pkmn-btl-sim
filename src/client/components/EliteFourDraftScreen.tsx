/**
 * Solo draft screen for Elite Four challenge.
 * Phase 1: Player picks 6 Pokemon freely from a pool of 21.
 * Phase 2: For each Pokemon, player picks 4 moves from the move pool.
 */
import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  useWindowDimensions,
} from 'react-native';
import { PokemonSprite } from './PokemonSprite';
import { TypeBadge } from './TypeBadge';
import { DraftPreviewModal } from './DraftPreviewModal';
import { colors, spacing, typeColors } from '../theme';
import type { DraftPoolEntry } from '../../engine/draft-pool';
import movesJsonData from '../../data/moves.json';

const movesLookup = movesJsonData as Record<string, any>;

function getMoveData(moveName: string) {
  const id = moveName.toLowerCase().replace(/[^a-z0-9]/g, '');
  return movesLookup[id] || null;
}

const NUM_COLUMNS = 3;
const CARD_GAP = 8;

const TIER_COLORS: Record<number, string> = {
  0: '#FF6B9D',
  1: '#FFD700',
  2: '#C0C0C0',
  3: '#CD7F32',
  4: '#666',
};

const CATEGORY_COLORS: Record<string, string> = {
  Physical: '#C22E28',
  Special: '#6390F0',
  Status: '#A8A77A',
};

interface Props {
  pool: DraftPoolEntry[];
  onComplete: (pickedIndices: number[], moveSelections: Record<number, string[]>) => void;
  onBack: () => void;
  playerName: string;
}

type Phase = 'pick_pokemon' | 'pick_moves';

export function EliteFourDraftScreen({ pool, onComplete, onBack, playerName }: Props) {
  const { width: screenW } = useWindowDimensions();
  const cardW = (screenW - spacing.lg * 2 - CARD_GAP * (NUM_COLUMNS - 1)) / NUM_COLUMNS;

  const [phase, setPhase] = useState<Phase>('pick_pokemon');
  const [picks, setPicks] = useState<number[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);
  const [showExitConfirm, setShowExitConfirm] = useState(false);

  // Move selection state: which Pokemon we're selecting moves for (0-5), and chosen moves per Pokemon
  const [currentMovePickIdx, setCurrentMovePickIdx] = useState(0);
  const [moveSelections, setMoveSelections] = useState<Record<number, string[]>>({});

  const pickedSet = new Set(picks);

  // --- Phase 1: Pick Pokemon ---

  const handleTap = (idx: number) => {
    if (pickedSet.has(idx)) {
      setPicks(picks.filter(i => i !== idx));
      if (selected === idx) setSelected(null);
    } else if (picks.length < 6) {
      setPicks([...picks, idx]);
      setSelected(idx);
    }
  };

  const handleConfirmTeam = () => {
    if (picks.length === 6) {
      setPhase('pick_moves');
      setCurrentMovePickIdx(0);
      setMoveSelections({});
    }
  };

  const handlePickFromModal = (poolIndex: number) => {
    if (pickedSet.has(poolIndex)) {
      setPicks(picks.filter(i => i !== poolIndex));
    } else if (picks.length < 6) {
      setPicks([...picks, poolIndex]);
    }
    setPreviewIndex(null);
  };

  // --- Phase 2: Pick Moves ---

  const currentSpecies = phase === 'pick_moves' && picks[currentMovePickIdx] !== undefined
    ? pool[picks[currentMovePickIdx]].species
    : null;

  const currentMoves = moveSelections[currentMovePickIdx] ?? [];

  const toggleMove = (moveName: string) => {
    const current = moveSelections[currentMovePickIdx] ?? [];
    if (current.includes(moveName)) {
      setMoveSelections({ ...moveSelections, [currentMovePickIdx]: current.filter(m => m !== moveName) });
    } else if (current.length < 4) {
      setMoveSelections({ ...moveSelections, [currentMovePickIdx]: [...current, moveName] });
    }
  };

  const handleConfirmMoves = () => {
    if (currentMoves.length !== 4) return;

    if (currentMovePickIdx < 5) {
      setCurrentMovePickIdx(currentMovePickIdx + 1);
    } else {
      // All done — submit
      onComplete(picks, moveSelections);
    }
  };

  const handleBackToTeam = () => {
    if (currentMovePickIdx > 0) {
      setCurrentMovePickIdx(currentMovePickIdx - 1);
    } else {
      setPhase('pick_pokemon');
    }
  };

  // --- Render ---

  if (phase === 'pick_moves' && currentSpecies) {
    // Competitive status moves worth showing
    const GOOD_STATUS_MOVES = new Set([
      'Swords Dance', 'Calm Mind', 'Dragon Dance', 'Nasty Plot', 'Shell Smash',
      'Quiver Dance', 'Bulk Up', 'Iron Defense', 'Amnesia', 'Agility', 'Rock Polish',
      'Shift Gear', 'Coil', 'Belly Drum', 'Tail Glow', 'Growth', 'Work Up',
      'Stealth Rock', 'Spikes', 'Toxic Spikes', 'Sticky Web',
      'Toxic', 'Will-O-Wisp', 'Thunder Wave', 'Glare', 'Stun Spore', 'Spore', 'Sleep Powder', 'Hypnosis',
      'Recover', 'Roost', 'Soft-Boiled', 'Slack Off', 'Moonlight', 'Morning Sun', 'Synthesis', 'Shore Up', 'Wish',
      'Protect', 'Substitute', 'Encore', 'Taunt', 'Trick', 'Switcheroo',
      'Defog', 'Rapid Spin', 'Haze', 'Whirlwind', 'Roar',
      'Leech Seed', 'Pain Split', 'Destiny Bond', 'Trick Room',
      'Light Screen', 'Reflect', 'Aurora Veil', 'Tailwind',
    ]);

    // Moves already in the Pokemon's competitive sets — always shown
    const setMoves = new Set(
      (currentSpecies.sets || []).flatMap(s => s.moves),
    );

    // Keep all set moves + new damaging 60+ power + competitive status moves
    const allMoves = (currentSpecies.movePool || [])
      .map(name => ({ name, data: getMoveData(name) }))
      .filter(m => {
        if (!m.data) return false;
        if (setMoves.has(m.name)) return true;
        if (m.data.category === 'Status') return GOOD_STATUS_MOVES.has(m.name);
        const power = m.data.basePower ?? m.data.power ?? 0;
        return power >= 60;
      })
      .sort((a, b) => {
        // Attacking moves first (by power desc), then status
        if (a.data.category === 'Status' && b.data.category !== 'Status') return 1;
        if (a.data.category !== 'Status' && b.data.category === 'Status') return -1;
        const powerA = a.data.basePower ?? a.data.power ?? 0;
        const powerB = b.data.basePower ?? b.data.power ?? 0;
        return powerB - powerA;
      });

    const selectedSet = new Set(currentMoves);

    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <View style={styles.headerRow}>
            <TouchableOpacity onPress={handleBackToTeam} hitSlop={8}>
              <Text style={styles.backBtn}>{'<'} Back</Text>
            </TouchableOpacity>
            <Text style={styles.title}>PICK MOVES</Text>
            <Text style={styles.moveCounter}>{currentMovePickIdx + 1}/6</Text>
          </View>
        </View>

        {/* Current Pokemon */}
        <View style={styles.movePokemonRow}>
          <PokemonSprite speciesId={currentSpecies.id} facing="front" size={56} />
          <View style={styles.movePokemonInfo}>
            <Text style={styles.movePokemonName}>{currentSpecies.name}</Text>
            <View style={styles.moveTypesRow}>
              {currentSpecies.types.map(t => <TypeBadge key={t} type={t} small />)}
            </View>
          </View>
          <Text style={styles.movePickCount}>{currentMoves.length}/4</Text>
        </View>

        {/* Selected moves preview */}
        <View style={styles.selectedMovesRow}>
          {currentMoves.map(name => {
            const md = getMoveData(name);
            return (
              <TouchableOpacity key={name} style={[styles.selectedMoveChip, { backgroundColor: typeColors[md?.type] || '#666' }]} onPress={() => toggleMove(name)}>
                <Text style={styles.selectedMoveChipText}>{name}</Text>
              </TouchableOpacity>
            );
          })}
          {Array.from({ length: 4 - currentMoves.length }).map((_, i) => (
            <View key={`empty-${i}`} style={styles.emptyMoveChip} />
          ))}
        </View>

        {/* Move list */}
        <ScrollView style={styles.moveScroll}>
          {allMoves.map(({ name, data: md }) => {
            const isSelected = selectedSet.has(name);
            const power = md.basePower ?? md.power ?? 0;
            return (
              <TouchableOpacity
                key={name}
                style={[styles.moveRow, isSelected && styles.moveRowSelected]}
                onPress={() => toggleMove(name)}
                activeOpacity={0.7}
              >
                <View style={[styles.moveCategoryDot, { backgroundColor: CATEGORY_COLORS[md.category] || '#666' }]} />
                <View style={[styles.moveTypeBadge, { backgroundColor: typeColors[md.type] || '#666' }]}>
                  <Text style={styles.moveTypeBadgeText}>{md.type}</Text>
                </View>
                <Text style={[styles.moveName, isSelected && styles.moveNameSelected]}>{name}</Text>
                <Text style={styles.movePower}>{power > 0 ? power : '-'}</Text>
                <Text style={styles.moveAcc}>{md.accuracy ? `${md.accuracy}%` : '-'}</Text>
                {isSelected && <Text style={styles.moveCheck}>{'>'}</Text>}
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Confirm moves button */}
        <View style={styles.confirmBar}>
          <TouchableOpacity
            style={[styles.confirmBtn, currentMoves.length < 4 && styles.confirmBtnDisabled]}
            onPress={handleConfirmMoves}
            disabled={currentMoves.length < 4}
            activeOpacity={0.7}
          >
            <Text style={styles.confirmText}>
              {currentMoves.length < 4
                ? `SELECT ${4 - currentMoves.length} MORE MOVE${4 - currentMoves.length > 1 ? 'S' : ''}`
                : currentMovePickIdx < 5 ? 'NEXT POKEMON' : 'BEGIN THE CHALLENGE'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // --- Phase 1: Pokemon picking ---
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => setShowExitConfirm(true)} hitSlop={8}>
            <Text style={styles.backBtn}>{'<'} Back</Text>
          </TouchableOpacity>
          <Text style={styles.title}>ELITE FOUR</Text>
          <View style={{ width: 50 }} />
        </View>
        <Text style={styles.subtitle}>Build your team for the gauntlet</Text>
        <Text style={styles.pickCount}>{picks.length}/6 Pokemon selected</Text>
      </View>

      <ScrollView style={styles.poolScroll} stickyHeaderIndices={[0]}>
        {/* Sticky team preview */}
        <View style={styles.teamSticky}>
          <View style={styles.teamStrip}>
            <Text style={styles.teamLabel}>{playerName}'s Team</Text>
            <View style={styles.teamMinis}>
              {picks.map((idx, i) => (
                <TouchableOpacity key={i} style={styles.miniSlot} onPress={() => handleTap(idx)}>
                  <PokemonSprite speciesId={pool[idx].species.id} facing="front" size={32} />
                </TouchableOpacity>
              ))}
              {Array.from({ length: 6 - picks.length }).map((_, i) => (
                <View key={`empty-${i}`} style={styles.miniSlotEmpty} />
              ))}
            </View>
          </View>
        </View>

        {/* Pool grid */}
        <View style={styles.poolGrid}>
          {pool
            .map((entry, i) => ({ entry, i }))
            .sort((a, b) => a.entry.tier - b.entry.tier)
            .map(({ entry, i }) => {
              const isPicked = pickedSet.has(i);
              const isSelected = selected === i;

              return (
                <TouchableOpacity
                  key={entry.species.id}
                  style={[
                    styles.poolCard,
                    { width: cardW },
                    entry.tier === 0 && styles.poolCardMega,
                    isSelected && styles.poolCardSelected,
                    isPicked && styles.poolCardPicked,
                  ]}
                  onPress={() => handleTap(i)}
                  onLongPress={() => setPreviewIndex(i)}
                  activeOpacity={0.7}
                >
                  {isPicked && (
                    <View style={styles.pickedBadge}>
                      <Text style={styles.pickedBadgeText}>{picks.indexOf(i) + 1}</Text>
                    </View>
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
                </TouchableOpacity>
              );
            })}
        </View>
      </ScrollView>

      {/* Confirm button */}
      <View style={styles.confirmBar}>
        <TouchableOpacity
          style={[styles.confirmBtn, picks.length < 6 && styles.confirmBtnDisabled]}
          onPress={handleConfirmTeam}
          disabled={picks.length < 6}
          activeOpacity={0.7}
        >
          <Text style={styles.confirmText}>
            {picks.length < 6 ? `SELECT ${6 - picks.length} MORE` : 'PICK MOVES'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Preview modal */}
      {previewIndex !== null && (
        <DraftPreviewModal
          pool={pool}
          pickedIndices={pickedSet}
          initialIndex={previewIndex}
          visible={true}
          onClose={() => setPreviewIndex(null)}
          onPick={handlePickFromModal}
          canPick={picks.length < 6}
        />
      )}

      {/* Exit confirmation */}
      {showExitConfirm && (
        <View style={styles.exitOverlay}>
          <View style={styles.exitModal}>
            <Text style={styles.exitTitle}>Leave Elite Four?</Text>
            <Text style={styles.exitSub}>Your progress will be lost.</Text>
            <TouchableOpacity
              style={styles.exitConfirmBtn}
              onPress={() => { setShowExitConfirm(false); onBack(); }}
              activeOpacity={0.7}
            >
              <Text style={styles.exitConfirmText}>Leave</Text>
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
  container: { flex: 1, backgroundColor: colors.background },
  header: { alignItems: 'center', paddingTop: spacing.md, paddingBottom: spacing.sm },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '100%', paddingHorizontal: spacing.lg },
  backBtn: { color: colors.textSecondary, fontSize: 14, fontWeight: '600' },
  title: { fontSize: 22, fontWeight: '900', color: colors.accent, letterSpacing: 3 },
  subtitle: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  pickCount: { fontSize: 13, color: '#4fc3f7', fontWeight: '700', marginTop: 4 },
  moveCounter: { fontSize: 13, color: '#4fc3f7', fontWeight: '700' },
  teamSticky: { backgroundColor: colors.background, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  teamStrip: { backgroundColor: colors.surface, borderRadius: 10, padding: spacing.sm, borderWidth: 1, borderColor: colors.border },
  teamLabel: { fontSize: 10, fontWeight: '700', color: colors.textDim, textTransform: 'uppercase', letterSpacing: 1, textAlign: 'center', marginBottom: 4 },
  teamMinis: { flexDirection: 'row', justifyContent: 'center', gap: 2 },
  miniSlot: { width: 32, height: 32, borderRadius: 4, backgroundColor: 'rgba(79,195,247,0.1)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(79,195,247,0.3)' },
  miniSlotEmpty: { width: 32, height: 32, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.03)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)', borderStyle: 'dashed' },
  poolScroll: { flex: 1 },
  poolGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: CARD_GAP, paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.lg },
  poolCard: { backgroundColor: colors.surface, borderRadius: 10, alignItems: 'center', paddingVertical: spacing.sm, paddingHorizontal: 4, borderWidth: 2, borderColor: colors.border, overflow: 'hidden' },
  poolCardMega: { borderColor: '#FF6B9D', backgroundColor: 'rgba(255,107,157,0.08)' },
  poolCardSelected: { borderColor: '#4fc3f7', backgroundColor: 'rgba(79,195,247,0.1)' },
  poolCardPicked: { borderColor: '#4fc3f7', backgroundColor: 'rgba(79,195,247,0.08)' },
  pickedBadge: { position: 'absolute', top: 3, left: 3, width: 16, height: 16, borderRadius: 8, backgroundColor: '#4fc3f7', alignItems: 'center', justifyContent: 'center', zIndex: 2 },
  pickedBadgeText: { color: '#fff', fontSize: 9, fontWeight: '900' },
  tierDot: { position: 'absolute', top: 4, right: 4, zIndex: 2 },
  tierDotInner: { width: 8, height: 8, borderRadius: 4 },
  cardName: { fontSize: 10, fontWeight: '700', color: colors.text, marginTop: 2, textAlign: 'center' },
  cardNamePicked: { color: '#4fc3f7' },
  cardTypes: { flexDirection: 'row', gap: 2, marginTop: 3 },
  confirmBar: { paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderTopWidth: 1, borderTopColor: colors.border },
  confirmBtn: { backgroundColor: colors.accent, paddingVertical: 14, borderRadius: 10, alignItems: 'center' },
  confirmBtnDisabled: { backgroundColor: colors.surface, opacity: 0.5 },
  confirmText: { color: '#fff', fontSize: 16, fontWeight: '800', letterSpacing: 1 },
  // Move selection styles
  movePokemonRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, gap: spacing.md, backgroundColor: colors.surface, marginHorizontal: spacing.md, borderRadius: 10, borderWidth: 1, borderColor: colors.border },
  movePokemonInfo: { flex: 1 },
  movePokemonName: { fontSize: 16, fontWeight: '800', color: colors.text },
  moveTypesRow: { flexDirection: 'row', gap: 4, marginTop: 2 },
  movePickCount: { fontSize: 18, fontWeight: '900', color: '#4fc3f7' },
  selectedMovesRow: { flexDirection: 'row', paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, gap: 4, flexWrap: 'wrap' },
  selectedMoveChip: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  selectedMoveChipText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  emptyMoveChip: { width: 60, height: 24, borderRadius: 6, backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', borderStyle: 'dashed' },
  moveScroll: { flex: 1 },
  moveRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border, gap: 8 },
  moveRowSelected: { backgroundColor: 'rgba(79,195,247,0.08)' },
  moveCategoryDot: { width: 6, height: 6, borderRadius: 3 },
  moveTypeBadge: { paddingHorizontal: 6, paddingVertical: 1, borderRadius: 3 },
  moveTypeBadgeText: { color: '#fff', fontSize: 9, fontWeight: '700' },
  moveName: { flex: 1, fontSize: 13, fontWeight: '600', color: colors.text },
  moveNameSelected: { color: '#4fc3f7' },
  movePower: { fontSize: 12, fontWeight: '700', color: colors.textSecondary, width: 30, textAlign: 'right' },
  moveAcc: { fontSize: 11, color: colors.textDim, width: 35, textAlign: 'right' },
  moveCheck: { color: '#4fc3f7', fontSize: 14, fontWeight: '800' },
  // Exit overlay
  exitOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center', zIndex: 100 },
  exitModal: { backgroundColor: colors.background, borderRadius: 16, padding: spacing.xl, width: '80%', alignItems: 'center', borderWidth: 2, borderColor: colors.border },
  exitTitle: { color: colors.text, fontSize: 20, fontWeight: '800' },
  exitSub: { color: colors.textSecondary, fontSize: 13, marginTop: spacing.sm, textAlign: 'center' },
  exitConfirmBtn: { backgroundColor: colors.accent, paddingHorizontal: 32, paddingVertical: 12, borderRadius: 10, marginTop: spacing.lg },
  exitConfirmText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  exitCancelBtn: { marginTop: spacing.md },
  exitCancelText: { color: colors.textDim, fontSize: 14, fontWeight: '600' },
});
