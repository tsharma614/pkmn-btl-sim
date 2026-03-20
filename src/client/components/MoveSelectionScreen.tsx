/**
 * Move selection screen — after draft, player picks 4 moves per Pokemon.
 * Shows Pokemon stats, move details on long press, and the same
 * filtering as E4 draft (set moves always shown + 60bp+ damaging + status whitelist).
 */
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Modal,
} from 'react-native';
import { PokemonSprite } from './PokemonSprite';
import { TypeBadge } from './TypeBadge';
import { colors, spacing, typeColors } from '../theme';
import type { OwnPokemon } from '../../server/types';
import movesJsonData from '../../data/moves.json';
import pokedexData from '../../data/pokedex.json';
import abilitiesData from '../../data/abilities.json';
import megaPokedexData from '../../data/mega-pokemon.json';

const movesLookup = movesJsonData as Record<string, any>;

// Build species lookup by ID so we can get movePool without it being on OwnPokemon
const speciesById: Record<string, { movePool: string[] }> = {};
for (const entry of Object.values(pokedexData as Record<string, any>)) {
  speciesById[entry.id] = entry;
}
for (const entry of Object.values(megaPokedexData as Record<string, any>)) {
  speciesById[entry.id] = entry;
}

function getMoveData(moveName: string) {
  const id = moveName.toLowerCase().replace(/[^a-z0-9]/g, '');
  return movesLookup[id] || null;
}

const CATEGORY_COLORS: Record<string, string> = {
  Physical: '#C22E28',
  Special: '#6390F0',
  Status: '#A8A77A',
};

const STAT_LABELS: Record<string, string> = {
  hp: 'HP',
  atk: 'Atk',
  def: 'Def',
  spa: 'SpA',
  spd: 'SpD',
  spe: 'Spe',
};

const STAT_COLORS: Record<string, string> = {
  hp: '#FF5959',
  atk: '#F5AC78',
  def: '#FAE078',
  spa: '#9DB7F5',
  spd: '#A7DB8D',
  spe: '#FA92B2',
};

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

interface Props {
  team: OwnPokemon[];
  onComplete: (moveSelections: Record<number, string[]>) => void;
  onBack: () => void;
  playerName: string;
}

export function MoveSelectionScreen({ team, onComplete, onBack, playerName }: Props) {
  const [currentIdx, setCurrentIdx] = useState(0);
  const [moveSelections, setMoveSelections] = useState<Record<number, string[]>>({});
  const [detailMove, setDetailMove] = useState<{ name: string; data: any } | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<'All' | 'Physical' | 'Special' | 'Status'>('All');

  const pokemon = team[currentIdx];
  const currentMoves = moveSelections[currentIdx] ?? [];

  // Moves from the Pokemon's current set — always shown
  const setMoveNames = new Set(pokemon.moves.map(m => m.name));

  // Filter move pool — look up from pokedex since OwnPokemon doesn't include movePool
  const speciesData = speciesById[pokemon.species.id];
  const allMoves = (speciesData?.movePool || [])
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

  const filteredMoves = categoryFilter === 'All'
    ? allMoves
    : allMoves.filter(m => m.data.category === categoryFilter);

  const selectedSet = new Set(currentMoves);

  const toggleMove = (moveName: string) => {
    const current = moveSelections[currentIdx] ?? [];
    if (current.includes(moveName)) {
      setMoveSelections({ ...moveSelections, [currentIdx]: current.filter(m => m !== moveName) });
    } else if (current.length < 4) {
      setMoveSelections({ ...moveSelections, [currentIdx]: [...current, moveName] });
    }
  };

  const handleConfirm = () => {
    if (currentMoves.length !== 4) return;
    if (currentIdx < team.length - 1) {
      setCurrentIdx(currentIdx + 1);
      setCategoryFilter('All');
    } else {
      onComplete(moveSelections);
    }
  };

  const handleBack = () => {
    if (currentIdx > 0) {
      setCurrentIdx(currentIdx - 1);
      setCategoryFilter('All');
    } else {
      onBack();
    }
  };

  // Auto-select existing set moves if nothing selected yet for this Pokemon
  useEffect(() => {
    if (!moveSelections[currentIdx] && pokemon.moves.length > 0) {
      const defaultMoves = pokemon.moves.slice(0, 4).map(m => m.name);
      const available = new Set(allMoves.map(m => m.name));
      const validDefaults = defaultMoves.filter(m => available.has(m));
      if (validDefaults.length > 0) {
        setMoveSelections(prev => ({
          ...prev,
          [currentIdx]: validDefaults.slice(0, 4),
        }));
      }
    }
  }, [currentIdx]);

  const baseStats = pokemon.species.baseStats;
  const bst = Object.values(baseStats).reduce((a: number, b: number) => a + b, 0);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={handleBack} hitSlop={8}>
            <Text style={styles.backBtn}>{'<'} Back</Text>
          </TouchableOpacity>
          <Text style={styles.title}>PICK MOVES</Text>
          <Text style={styles.counter}>{currentIdx + 1}/{team.length}</Text>
        </View>
      </View>

      {/* Pokemon info + stats */}
      <View style={styles.pokemonSection}>
        <View style={styles.pokemonRow}>
          <PokemonSprite speciesId={pokemon.species.id} facing="front" size={56} />
          <View style={styles.pokemonInfo}>
            <Text style={styles.pokemonName}>{pokemon.species.name}</Text>
            <View style={styles.typesRow}>
              {pokemon.species.types.map(t => <TypeBadge key={t} type={t} small />)}
            </View>
            <Text style={styles.abilityText}>{pokemon.ability} · {pokemon.item || 'No item'}</Text>
            <Text style={styles.abilityDesc}>
              {(abilitiesData as Record<string, any>)[pokemon.ability.toLowerCase().replace(/[^a-z0-9]/g, '')]?.shortDesc ?? ''}
            </Text>
          </View>
          <Text style={styles.pickCount}>{currentMoves.length}/4</Text>
        </View>

        {/* Base stats bar */}
        <View style={styles.statsRow}>
          {Object.entries(baseStats).map(([stat, value]) => (
            <View key={stat} style={styles.statItem}>
              <Text style={[styles.statLabel, { color: STAT_COLORS[stat] || '#aaa' }]}>{STAT_LABELS[stat] || stat}</Text>
              <View style={styles.statBarBg}>
                <View style={[styles.statBar, { width: `${Math.min((value as number) / 255 * 100, 100)}%`, backgroundColor: STAT_COLORS[stat] || '#aaa' }]} />
              </View>
              <Text style={styles.statValue}>{value as number}</Text>
            </View>
          ))}
          <Text style={styles.bstText}>BST: {bst}</Text>
        </View>
      </View>

      {/* Selected moves chips */}
      <View style={styles.selectedRow}>
        {currentMoves.map(name => {
          const md = getMoveData(name);
          return (
            <TouchableOpacity
              key={name}
              style={[styles.selectedChip, { backgroundColor: typeColors[md?.type] || '#666' }]}
              onPress={() => toggleMove(name)}
            >
              <Text style={styles.selectedChipText}>{name}</Text>
            </TouchableOpacity>
          );
        })}
        {Array.from({ length: 4 - currentMoves.length }).map((_, i) => (
          <View key={`empty-${i}`} style={styles.emptyChip} />
        ))}
      </View>

      {/* Category filter */}
      <View style={styles.filterRow}>
        {(['All', 'Physical', 'Special', 'Status'] as const).map(cat => (
          <TouchableOpacity
            key={cat}
            style={[styles.filterBtn, categoryFilter === cat && styles.filterBtnActive]}
            onPress={() => setCategoryFilter(cat)}
            activeOpacity={0.7}
          >
            <Text style={[styles.filterBtnText, categoryFilter === cat && styles.filterBtnTextActive]}>
              {cat}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Move list */}
      <ScrollView style={styles.moveScroll}>
        {filteredMoves.map(({ name, data: md }) => {
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
              <View style={[styles.categoryDot, { backgroundColor: CATEGORY_COLORS[md.category] || '#666' }]} />
              <View style={[styles.typeBadge, { backgroundColor: typeColors[md.type] || '#666' }]}>
                <Text style={styles.typeBadgeText}>{md.type}</Text>
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

      {/* Confirm button */}
      <View style={styles.confirmBar}>
        <TouchableOpacity
          style={[styles.confirmBtn, currentMoves.length < 4 && styles.confirmBtnDisabled]}
          onPress={handleConfirm}
          disabled={currentMoves.length < 4}
          activeOpacity={0.7}
        >
          <Text style={styles.confirmText}>
            {currentMoves.length < 4
              ? `SELECT ${4 - currentMoves.length} MORE MOVE${4 - currentMoves.length > 1 ? 'S' : ''}`
              : currentIdx < team.length - 1 ? 'NEXT POKEMON' : 'CONFIRM TEAM'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Team strip at bottom of header */}
      <View style={styles.teamStrip}>
        {team.map((p, i) => (
          <TouchableOpacity
            key={i}
            style={[styles.teamSlot, i === currentIdx && styles.teamSlotActive, moveSelections[i]?.length === 4 && styles.teamSlotDone]}
            onPress={() => {
              // Allow jumping to any Pokemon that has 4 moves or is current/previous
              if (i <= currentIdx || (moveSelections[i]?.length === 4)) {
                setCurrentIdx(i);
              }
            }}
            activeOpacity={0.7}
          >
            <PokemonSprite speciesId={p.species.id} facing="front" size={28} />
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
                {(detailMove.data.description || detailMove.data.desc || detailMove.data.shortDesc) && (
                  <Text style={styles.modalDesc}>{detailMove.data.description || detailMove.data.desc || detailMove.data.shortDesc}</Text>
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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { paddingTop: spacing.md, paddingBottom: spacing.xs },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg },
  backBtn: { color: colors.textSecondary, fontSize: 14, fontWeight: '600' },
  title: { fontSize: 20, fontWeight: '900', color: colors.accent, letterSpacing: 2 },
  counter: { fontSize: 13, color: '#4fc3f7', fontWeight: '700' },
  pokemonSection: { paddingHorizontal: spacing.md, paddingBottom: spacing.xs },
  pokemonRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.surface, padding: spacing.sm, borderRadius: 10, borderWidth: 1, borderColor: colors.border },
  pokemonInfo: { flex: 1 },
  pokemonName: { fontSize: 16, fontWeight: '800', color: colors.text },
  typesRow: { flexDirection: 'row', gap: 4, marginTop: 2 },
  abilityText: { fontSize: 10, color: colors.textDim, marginTop: 2 },
  abilityDesc: { fontSize: 9, color: colors.textDim, fontStyle: 'italic', marginTop: 1 },
  pickCount: { fontSize: 18, fontWeight: '900', color: '#4fc3f7' },
  statsRow: { marginTop: spacing.xs, backgroundColor: colors.surface, borderRadius: 8, padding: spacing.xs, borderWidth: 1, borderColor: colors.border },
  statItem: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 1 },
  statLabel: { fontSize: 9, fontWeight: '700', width: 26, textAlign: 'right' },
  statBarBg: { flex: 1, height: 4, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 2, overflow: 'hidden' },
  statBar: { height: 4, borderRadius: 2 },
  statValue: { fontSize: 9, fontWeight: '600', color: colors.textSecondary, width: 24, textAlign: 'right' },
  bstText: { fontSize: 9, fontWeight: '700', color: colors.textDim, textAlign: 'right', marginTop: 2 },
  selectedRow: { flexDirection: 'row', paddingHorizontal: spacing.lg, paddingVertical: spacing.xs, gap: 4, flexWrap: 'wrap' },
  selectedChip: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  selectedChipText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  emptyChip: { width: 60, height: 24, borderRadius: 6, backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', borderStyle: 'dashed' },
  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xs,
    gap: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  filterBtn: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 12,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  filterBtnActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  filterBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textDim,
  },
  filterBtnTextActive: {
    color: '#fff',
  },
  moveScroll: { flex: 1 },
  moveRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border, gap: 8 },
  moveRowSelected: { backgroundColor: 'rgba(79,195,247,0.08)' },
  categoryDot: { width: 6, height: 6, borderRadius: 3 },
  typeBadge: { paddingHorizontal: 6, paddingVertical: 1, borderRadius: 3 },
  typeBadgeText: { color: '#fff', fontSize: 9, fontWeight: '700' },
  moveName: { flex: 1, fontSize: 13, fontWeight: '600', color: colors.text },
  moveNameSelected: { color: '#4fc3f7' },
  movePower: { fontSize: 12, fontWeight: '700', color: colors.textSecondary, width: 30, textAlign: 'right' },
  moveAcc: { fontSize: 11, color: colors.textDim, width: 35, textAlign: 'right' },
  moveCheck: { color: '#4fc3f7', fontSize: 14, fontWeight: '800' },
  confirmBar: { paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderTopWidth: 1, borderTopColor: colors.border },
  confirmBtn: { backgroundColor: colors.accent, paddingVertical: 14, borderRadius: 10, alignItems: 'center' },
  confirmBtnDisabled: { backgroundColor: colors.surface, opacity: 0.5 },
  confirmText: { color: '#fff', fontSize: 16, fontWeight: '800', letterSpacing: 1 },
  teamStrip: { flexDirection: 'row', justifyContent: 'center', gap: 4, paddingVertical: spacing.xs, backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.border },
  teamSlot: { width: 32, height: 32, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.03)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' },
  teamSlotActive: { borderColor: '#4fc3f7', backgroundColor: 'rgba(79,195,247,0.1)' },
  teamSlotDone: { borderColor: 'rgba(76,175,80,0.5)', backgroundColor: 'rgba(76,175,80,0.08)' },
  // Modal styles
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { backgroundColor: colors.background, borderRadius: 16, padding: spacing.lg, width: '85%', borderWidth: 2, borderColor: colors.border },
  modalHeader: { flexDirection: 'row', gap: 8, marginBottom: spacing.sm },
  modalTypeBadge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 4 },
  modalTypeText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  modalCategoryBadge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 4 },
  modalCategoryText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  modalMoveName: { fontSize: 22, fontWeight: '900', color: colors.text, marginBottom: spacing.md },
  modalStatsRow: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.md },
  modalStatBox: { alignItems: 'center' },
  modalStatLabel: { fontSize: 10, color: colors.textDim, fontWeight: '600' },
  modalStatValue: { fontSize: 16, fontWeight: '800', color: colors.text },
  modalDesc: { fontSize: 13, color: colors.textSecondary, lineHeight: 18, marginBottom: spacing.sm },
  modalFlags: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginBottom: spacing.sm },
  flagChip: { fontSize: 10, color: colors.textDim, backgroundColor: 'rgba(255,255,255,0.06)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, overflow: 'hidden' },
  modalSecondary: { fontSize: 11, color: colors.accent, fontStyle: 'italic' },
});
