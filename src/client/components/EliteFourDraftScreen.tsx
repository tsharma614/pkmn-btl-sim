/**
 * Solo draft screen for Elite Four challenge.
 * Phase 1: Player picks 6 Pokemon freely from a pool of 21.
 * Phase 2: For each Pokemon, player picks 4 moves from the move pool.
 */
import React, { useState, useMemo } from 'react';
import { lightTap } from '../utils/haptics';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Modal,
  useWindowDimensions,
} from 'react-native';
import { PokemonSprite } from './PokemonSprite';
import { TypeBadge } from './TypeBadge';
import { DraftPreviewModal } from './DraftPreviewModal';
import { PkCard } from './shared/PkCard';
import { PkButton } from './shared/PkButton';
import { colors, spacing, typeColors, shadows } from '../theme';
import type { DraftPoolEntry } from '../../engine/draft-pool';
import movesJsonData from '../../data/moves.json';

const movesLookup = movesJsonData as Record<string, any>;
const GOLD = '#FFD700';

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

const STAT_LABELS: Record<string, string> = {
  hp: 'HP', atk: 'Atk', def: 'Def', spa: 'SpA', spd: 'SpD', spe: 'Spe',
};

const STAT_COLORS: Record<string, string> = {
  hp: '#FF5959', atk: '#F5AC78', def: '#FAE078', spa: '#9DB7F5', spd: '#A7DB8D', spe: '#FA92B2',
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

  // Move selection state
  const [currentMovePickIdx, setCurrentMovePickIdx] = useState(0);
  const [moveSelections, setMoveSelections] = useState<Record<number, string[]>>({});
  const [detailMove, setDetailMove] = useState<{ name: string; data: any } | null>(null);

  const pickedSet = new Set(picks);

  // --- Sorted pool (memoized) ---
  const sortedPool = useMemo(() =>
    pool
      .map((entry, i) => ({ entry, i }))
      .sort((a, b) => a.entry.tier - b.entry.tier),
    [pool],
  );

  // --- Phase 1: Pick Pokemon ---

  const handleTap = (idx: number) => {
    lightTap();
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
      // All done -- submit
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

  // --- Filtered moves (memoized) ---
  const allMoves = useMemo(() => {
    if (!currentSpecies) return [];

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

    const setMoveNames = new Set(
      (currentSpecies.sets || []).flatMap(s => s.moves),
    );

    return (currentSpecies.movePool || [])
      .map(name => ({ name, data: getMoveData(name) }))
      .filter(m => {
        if (!m.data) return false;
        if (setMoveNames.has(m.name)) return true;
        if (m.data.category === 'Status') return GOOD_STATUS_MOVES.has(m.name);
        const power = m.data.basePower ?? m.data.power ?? 0;
        return power >= 60;
      })
      .sort((a, b) => {
        if (a.data.category === 'Status' && b.data.category !== 'Status') return 1;
        if (a.data.category !== 'Status' && b.data.category === 'Status') return -1;
        const powerA = a.data.basePower ?? a.data.power ?? 0;
        const powerB = b.data.basePower ?? b.data.power ?? 0;
        return powerB - powerA;
      });
  }, [currentSpecies]);

  // --- Render ---

  if (phase === 'pick_moves' && currentSpecies) {
    const setMoveNames = new Set(
      (currentSpecies.sets || []).flatMap(s => s.moves),
    );
    const selectedSet = new Set(currentMoves);
    const baseStats = currentSpecies.baseStats;
    const bst = Object.values(baseStats).reduce((a: number, b: number) => a + b, 0);

    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <View style={styles.headerRow}>
            <TouchableOpacity onPress={handleBackToTeam} hitSlop={8}>
              <Text style={styles.backBtn}>{'<'} Back</Text>
            </TouchableOpacity>
            <Text style={styles.title}>PICK MOVES</Text>
            <View style={styles.moveCounterPill}>
              <Text style={styles.moveCounter}>{currentMovePickIdx + 1}/6</Text>
            </View>
          </View>
        </View>

        {/* Current Pokemon + stats */}
        <PkCard padding="compact" style={styles.movePokemonCard}>
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

          {/* Base stats bars */}
          <View style={styles.moveStatsRow}>
            {Object.entries(baseStats).map(([stat, value]) => (
              <View key={stat} style={styles.moveStatItem}>
                <Text style={[styles.moveStatLabel, { color: STAT_COLORS[stat] || '#aaa' }]}>{STAT_LABELS[stat] || stat}</Text>
                <View style={styles.moveStatBarBg}>
                  <View style={[styles.moveStatBar, { width: `${Math.min((value as number) / 255 * 100, 100)}%`, backgroundColor: STAT_COLORS[stat] || '#aaa' }]} />
                </View>
                <Text style={styles.moveStatValue}>{value as number}</Text>
              </View>
            ))}
            <Text style={styles.moveBstText}>BST: {bst}</Text>
          </View>
        </PkCard>

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
            const isSetMove = setMoveNames.has(name);
            const power = md.basePower ?? md.power ?? 0;
            return (
              <TouchableOpacity
                key={name}
                style={[styles.moveRow, isSelected && styles.moveRowSelected]}
                onPress={() => toggleMove(name)}
                onLongPress={() => setDetailMove({ name, data: md })}
                activeOpacity={0.7}
              >
                <View style={[styles.moveCategoryDot, { backgroundColor: CATEGORY_COLORS[md.category] || '#666' }]} />
                <View style={[styles.moveTypeBadge, { backgroundColor: typeColors[md.type] || '#666' }]}>
                  <Text style={styles.moveTypeBadgeText}>{md.type}</Text>
                </View>
                <Text style={[styles.moveName, isSelected && styles.moveNameSelected]} numberOfLines={1}>
                  {name}{isSetMove ? ' *' : ''}
                </Text>
                <Text style={styles.movePower}>{power > 0 ? power : '-'}</Text>
                <Text style={styles.moveAcc}>{md.accuracy ? `${md.accuracy}%` : '-'}</Text>
                {isSelected && <Text style={styles.moveCheck}>{'>'}</Text>}
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Confirm moves button */}
        <View style={styles.confirmBar}>
          <PkButton
            title={currentMoves.length < 4
              ? `SELECT ${4 - currentMoves.length} MORE MOVE${4 - currentMoves.length > 1 ? 'S' : ''}`
              : currentMovePickIdx < 5 ? 'NEXT POKEMON' : 'BEGIN THE CHALLENGE'}
            variant="primary"
            size="md"
            onPress={handleConfirmMoves}
            disabled={currentMoves.length < 4}
            style={currentMovePickIdx === 5 && currentMoves.length === 4 ? shadows.glow(GOLD) as any : undefined}
            textStyle={currentMovePickIdx === 5 && currentMoves.length === 4 ? { color: GOLD } as any : undefined}
          />
        </View>

        {/* Team strip */}
        <View style={styles.moveTeamStrip}>
          {picks.map((poolIdx, i) => (
            <TouchableOpacity
              key={i}
              style={[styles.moveTeamSlot, i === currentMovePickIdx && styles.moveTeamSlotActive, moveSelections[i]?.length === 4 && styles.moveTeamSlotDone]}
              onPress={() => {
                if (i <= currentMovePickIdx || moveSelections[i]?.length === 4) {
                  setCurrentMovePickIdx(i);
                }
              }}
              activeOpacity={0.7}
            >
              <PokemonSprite speciesId={pool[poolIdx].species.id} facing="front" size={28} />
            </TouchableOpacity>
          ))}
        </View>

        {/* Move detail modal */}
        <Modal visible={!!detailMove} transparent animationType="fade" onRequestClose={() => setDetailMove(null)}>
          <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setDetailMove(null)}>
            <View style={styles.modalContent}>
              {detailMove && (
                <>
                  <View style={styles.modalHeader}>
                    <View style={[styles.modalTypeBadge, { backgroundColor: typeColors[detailMove.data.type] || '#666' }]}>
                      <Text style={styles.modalTypeText}>{detailMove.data.type}</Text>
                    </View>
                    <View style={[styles.modalCategoryBadge, { backgroundColor: CATEGORY_COLORS[detailMove.data.category] || '#666' }]}>
                      <Text style={styles.modalCategoryText}>{detailMove.data.category}</Text>
                    </View>
                  </View>
                  <Text style={styles.modalMoveName}>{detailMove.name}</Text>
                  <View style={styles.modalStatsRow}>
                    <View style={styles.modalStatBox}>
                      <Text style={styles.modalStatLabel}>Power</Text>
                      <Text style={styles.modalStatValue}>{detailMove.data.basePower || detailMove.data.power || '-'}</Text>
                    </View>
                    <View style={styles.modalStatBox}>
                      <Text style={styles.modalStatLabel}>Accuracy</Text>
                      <Text style={styles.modalStatValue}>{detailMove.data.accuracy ? `${detailMove.data.accuracy}%` : '-'}</Text>
                    </View>
                    <View style={styles.modalStatBox}>
                      <Text style={styles.modalStatLabel}>PP</Text>
                      <Text style={styles.modalStatValue}>{detailMove.data.pp || '-'}</Text>
                    </View>
                    <View style={styles.modalStatBox}>
                      <Text style={styles.modalStatLabel}>Priority</Text>
                      <Text style={styles.modalStatValue}>{detailMove.data.priority ?? 0}</Text>
                    </View>
                  </View>
                  {detailMove.data.desc && (
                    <Text style={styles.modalDesc}>{detailMove.data.desc}</Text>
                  )}
                  {detailMove.data.shortDesc && !detailMove.data.desc && (
                    <Text style={styles.modalDesc}>{detailMove.data.shortDesc}</Text>
                  )}
                  {detailMove.data.flags && (
                    <View style={styles.modalFlags}>
                      {detailMove.data.flags.contact && <Text style={styles.flagChip}>Contact</Text>}
                      {detailMove.data.flags.protect && <Text style={styles.flagChip}>Blocked by Protect</Text>}
                      {detailMove.data.flags.sound && <Text style={styles.flagChip}>Sound</Text>}
                      {detailMove.data.flags.bullet && <Text style={styles.flagChip}>Bullet</Text>}
                      {detailMove.data.flags.punch && <Text style={styles.flagChip}>Punch</Text>}
                      {detailMove.data.flags.bite && <Text style={styles.flagChip}>Bite</Text>}
                    </View>
                  )}
                  {detailMove.data.secondary && (
                    <Text style={styles.modalSecondary}>
                      {detailMove.data.secondary.chance
                        ? `${detailMove.data.secondary.chance}% chance: ${detailMove.data.secondary.status || detailMove.data.secondary.volatileStatus || (detailMove.data.secondary.boosts ? 'stat change' : 'effect')}`
                        : ''}
                    </Text>
                  )}
                </>
              )}
            </View>
          </TouchableOpacity>
        </Modal>
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
        <View style={styles.pickCountRow}>
          <Text style={styles.pickCount}>{picks.length}/6 Pokemon selected</Text>
        </View>
      </View>

      <ScrollView style={styles.poolScroll} stickyHeaderIndices={[0]}>
        {/* Sticky team preview */}
        <View style={styles.teamSticky}>
          <PkCard padding="compact" accentColor={GOLD} style={styles.teamStripCard}>
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
          </PkCard>
        </View>

        {/* Pool grid */}
        <View style={styles.poolGrid}>
          {sortedPool.map(({ entry, i }) => {
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
        <PkButton
          title={picks.length < 6 ? `SELECT ${6 - picks.length} MORE` : 'PICK MOVES'}
          variant="primary"
          size="md"
          onPress={handleConfirmTeam}
          disabled={picks.length < 6}
          style={picks.length === 6 ? shadows.glow(GOLD) as any : undefined}
          textStyle={picks.length === 6 ? { color: GOLD } as any : undefined}
        />
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
          <PkCard padding="spacious" style={styles.exitCard}>
            <Text style={styles.exitTitle}>Leave Elite Four?</Text>
            <Text style={styles.exitSub}>Your progress will be lost.</Text>
            <PkButton
              title="Leave"
              variant="primary"
              size="md"
              onPress={() => { setShowExitConfirm(false); onBack(); }}
              style={styles.exitLeaveBtn}
            />
            <PkButton
              title="Cancel"
              variant="ghost"
              size="sm"
              onPress={() => setShowExitConfirm(false)}
            />
          </PkCard>
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
  title: { fontSize: 24, fontWeight: '900', color: colors.accentGold, letterSpacing: 4 },
  subtitle: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  pickCountRow: { marginTop: spacing.xs },
  pickCount: { fontSize: 13, color: colors.accentGold, fontWeight: '800', letterSpacing: 1 },
  moveCounterPill: { backgroundColor: 'rgba(245,158,11,0.15)', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 8 },
  moveCounter: { fontSize: 13, color: colors.accentGold, fontWeight: '800' },
  teamSticky: { backgroundColor: colors.background, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  teamStripCard: { alignItems: 'center' },
  teamLabel: { fontSize: 10, fontWeight: '700', color: colors.accentGold, textTransform: 'uppercase', letterSpacing: 1, textAlign: 'center', marginBottom: 4 },
  teamMinis: { flexDirection: 'row', justifyContent: 'center', gap: 2 },
  miniSlot: { width: 32, height: 32, borderRadius: 4, backgroundColor: 'rgba(245,158,11,0.08)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(245,158,11,0.2)' },
  miniSlotEmpty: { width: 32, height: 32, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.03)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)', borderStyle: 'dashed' },
  poolScroll: { flex: 1 },
  poolGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: CARD_GAP, paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.lg },
  poolCard: { backgroundColor: colors.surface, borderRadius: 12, alignItems: 'center', paddingVertical: spacing.sm, paddingHorizontal: 4, borderWidth: 2, borderColor: colors.border, overflow: 'hidden' },
  poolCardMega: { borderColor: '#FF6B9D', backgroundColor: 'rgba(255,107,157,0.08)' },
  poolCardSelected: { borderColor: colors.accentGold, backgroundColor: 'rgba(245,158,11,0.08)' },
  poolCardPicked: { borderColor: colors.accentGold, backgroundColor: 'rgba(245,158,11,0.06)' },
  pickedBadge: { position: 'absolute', top: 3, left: 3, width: 18, height: 18, borderRadius: 9, backgroundColor: colors.accentGold, alignItems: 'center', justifyContent: 'center', zIndex: 2 },
  pickedBadgeText: { color: colors.background, fontSize: 10, fontWeight: '900' },
  tierDot: { position: 'absolute', top: 4, right: 4, zIndex: 2 },
  tierDotInner: { width: 8, height: 8, borderRadius: 4 },
  cardName: { fontSize: 10, fontWeight: '700', color: colors.text, marginTop: 2, textAlign: 'center' },
  cardNamePicked: { color: colors.accentGold },
  cardTypes: { flexDirection: 'row', gap: 2, marginTop: 3 },
  confirmBar: { paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderTopWidth: 1, borderTopColor: colors.border },
  // Move selection styles
  movePokemonCard: { marginHorizontal: spacing.md },
  movePokemonRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  movePokemonInfo: { flex: 1 },
  movePokemonName: { fontSize: 17, fontWeight: '900', color: colors.text, letterSpacing: 0.5 },
  moveTypesRow: { flexDirection: 'row', gap: 4, marginTop: 2 },
  movePickCount: { fontSize: 20, fontWeight: '900', color: colors.accentGold },
  moveStatsRow: { marginTop: spacing.sm, backgroundColor: colors.surfaceLight, borderRadius: 8, padding: spacing.xs },
  moveStatItem: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 1 },
  moveStatLabel: { fontSize: 9, fontWeight: '700', width: 26, textAlign: 'right' },
  moveStatBarBg: { flex: 1, height: 4, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 2, overflow: 'hidden' },
  moveStatBar: { height: 4, borderRadius: 2 },
  moveStatValue: { fontSize: 9, fontWeight: '600', color: colors.textSecondary, width: 24, textAlign: 'right' },
  moveBstText: { fontSize: 9, fontWeight: '700', color: colors.textDim, textAlign: 'right', marginTop: 2 },
  selectedMovesRow: { flexDirection: 'row', paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, gap: 4, flexWrap: 'wrap' },
  selectedMoveChip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  selectedMoveChipText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  emptyMoveChip: { width: 60, height: 26, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', borderStyle: 'dashed' },
  moveScroll: { flex: 1 },
  moveRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border, gap: 8 },
  moveRowSelected: { backgroundColor: 'rgba(245,158,11,0.06)' },
  moveCategoryDot: { width: 6, height: 6, borderRadius: 3 },
  moveTypeBadge: { paddingHorizontal: 6, paddingVertical: 1, borderRadius: 4 },
  moveTypeBadgeText: { color: '#fff', fontSize: 9, fontWeight: '700' },
  moveName: { flex: 1, fontSize: 13, fontWeight: '600', color: colors.text },
  moveNameSelected: { color: colors.accentGold },
  movePower: { fontSize: 12, fontWeight: '700', color: colors.textSecondary, width: 30, textAlign: 'right' },
  moveAcc: { fontSize: 11, color: colors.textDim, width: 35, textAlign: 'right' },
  moveCheck: { color: colors.accentGold, fontSize: 14, fontWeight: '800' },
  // Team strip for move selection
  moveTeamStrip: { flexDirection: 'row', justifyContent: 'center', gap: 4, paddingVertical: spacing.xs, backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.border },
  moveTeamSlot: { width: 34, height: 34, borderRadius: 6, backgroundColor: 'rgba(255,255,255,0.03)', alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.06)' },
  moveTeamSlotActive: { borderColor: colors.accentGold, backgroundColor: 'rgba(245,158,11,0.1)' },
  moveTeamSlotDone: { borderColor: 'rgba(34,197,94,0.5)', backgroundColor: 'rgba(34,197,94,0.08)' },
  // Move detail modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { backgroundColor: colors.surface, borderRadius: 18, padding: spacing.lg, width: '85%', borderWidth: 1, borderColor: colors.border, ...shadows.lg },
  modalHeader: { flexDirection: 'row', gap: 8, marginBottom: spacing.sm },
  modalTypeBadge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 6 },
  modalTypeText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  modalCategoryBadge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 6 },
  modalCategoryText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  modalMoveName: { fontSize: 22, fontWeight: '900', color: colors.text, marginBottom: spacing.md },
  modalStatsRow: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.md },
  modalStatBox: { alignItems: 'center' },
  modalStatLabel: { fontSize: 10, color: colors.textDim, fontWeight: '600' },
  modalStatValue: { fontSize: 18, fontWeight: '900', color: colors.text },
  modalDesc: { fontSize: 13, color: colors.textSecondary, lineHeight: 18, marginBottom: spacing.sm },
  modalFlags: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginBottom: spacing.sm },
  flagChip: { fontSize: 10, color: colors.textDim, backgroundColor: 'rgba(255,255,255,0.06)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, overflow: 'hidden' },
  modalSecondary: { fontSize: 11, color: colors.accentGold, fontStyle: 'italic' },
  // Exit overlay
  exitOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center', zIndex: 100 },
  exitCard: { width: '80%', alignItems: 'center' },
  exitTitle: { color: colors.text, fontSize: 20, fontWeight: '900', letterSpacing: 1 },
  exitSub: { color: colors.textSecondary, fontSize: 13, marginTop: spacing.sm, textAlign: 'center' },
  exitLeaveBtn: { marginTop: spacing.lg, width: '100%' },
});
