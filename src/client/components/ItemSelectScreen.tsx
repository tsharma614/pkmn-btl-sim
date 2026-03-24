/**
 * Item selection screen — after move selection, player picks a held item per Pokemon.
 * Grid layout with long-press detail modal (same UX as move details).
 */
import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Modal,
} from 'react-native';
import { Image } from 'react-native';
import { PokemonSprite } from './PokemonSprite';
import { colors, spacing, typeColors } from '../theme';
import type { OwnPokemon } from '../../server/types';
import abilitiesData from '../../data/abilities.json';
import ITEM_SPRITE_MAP from '../item-sprite-map';

const HELD_ITEMS = [
  'Leftovers',
  'Life Orb',
  'Choice Band',
  'Choice Specs',
  'Choice Scarf',
  'Focus Sash',
  'Assault Vest',
  'Rocky Helmet',
  'Eviolite',
  'Air Balloon',
  'Light Clay',
  'Expert Belt',
  'Weakness Policy',
  'Sitrus Berry',
  'Lum Berry',
  'Heavy-Duty Boots',
  'Toxic Orb',
  'Flame Orb',
  'Black Sludge',
  'Safety Goggles',
  'Scope Lens',
  'Razor Claw',
  'Shell Bell',
  'White Herb',
];

const ITEM_DESCRIPTIONS: Record<string, string> = {
  'Leftovers': 'Restores 1/16 max HP at the end of each turn.',
  'Life Orb': 'Boosts move power by 30% but costs 10% max HP per attack.',
  'Choice Band': 'Boosts Attack by 50% but locks into one move.',
  'Choice Specs': 'Boosts Special Attack by 50% but locks into one move.',
  'Choice Scarf': 'Boosts Speed by 50% but locks into one move.',
  'Focus Sash': 'Survives a hit that would KO from full HP with 1 HP remaining. Single use.',
  'Assault Vest': 'Boosts Special Defense by 50% but prevents the use of status moves.',
  'Rocky Helmet': 'Deals 1/6 max HP damage to attackers that make contact.',
  'Eviolite': 'Boosts Defense and Special Defense by 50% for Pokemon that can still evolve.',
  'Air Balloon': 'Grants immunity to Ground-type moves. Pops when hit by an attack.',
  'Light Clay': 'Extends the duration of Light Screen and Reflect from 5 to 8 turns.',
  'Expert Belt': 'Boosts super-effective moves by 20%. No drawback.',
  'Weakness Policy': 'Raises Attack and Special Attack by 2 stages when hit by a super-effective move. Single use.',
  'Sitrus Berry': 'Restores 25% max HP when HP drops below 50%. Single use.',
  'Lum Berry': 'Cures any status condition once. Single use.',
  'Heavy-Duty Boots': 'Prevents damage from entry hazards like Stealth Rock and Spikes.',
  'Toxic Orb': 'Badly poisons the holder at the end of the turn. Used with Poison Heal or Guts.',
  'Flame Orb': 'Burns the holder at the end of the turn. Used with Guts or Magic Guard.',
  'Black Sludge': 'Restores 1/16 max HP per turn for Poison types. Damages non-Poison types.',
  'Safety Goggles': 'Protects from weather damage and powder/spore moves.',
  'Scope Lens': 'Increases critical hit ratio by 1 stage.',
  'Razor Claw': 'Increases critical hit ratio by 1 stage.',
  'Shell Bell': 'Restores 1/8 of damage dealt to the opponent after each attack.',
  'White Herb': 'Restores lowered stats to 0 once. Consumed after use.',
};

interface Props {
  team: OwnPokemon[];
  onComplete: (itemSelections: Record<number, string>) => void;
  onBack: () => void;
  playerName: string;
}

export function ItemSelectScreen({ team, onComplete, onBack, playerName }: Props) {
  const [currentIdx, setCurrentIdx] = useState(0);
  const [itemSelections, setItemSelections] = useState<Record<number, string>>({});
  const [detailItem, setDetailItem] = useState<string | null>(null);

  const pokemon = team[currentIdx];
  const currentItem = itemSelections[currentIdx] ?? '';

  const selectItem = (itemName: string) => {
    if (currentItem === itemName) {
      // Deselect
      const next = { ...itemSelections };
      delete next[currentIdx];
      setItemSelections(next);
    } else {
      setItemSelections({ ...itemSelections, [currentIdx]: itemName });
    }
  };

  const allSelected = team.every((_, i) => !!itemSelections[i]);

  const handleConfirm = () => {
    if (!allSelected) return;
    onComplete(itemSelections);
  };

  const handlePrev = () => {
    if (currentIdx > 0) {
      setCurrentIdx(currentIdx - 1);
    } else {
      onBack();
    }
  };

  const handleNext = () => {
    if (currentIdx < team.length - 1) {
      setCurrentIdx(currentIdx + 1);
    }
  };

  // Count how many Pokemon have items assigned
  const assignedCount = Object.keys(itemSelections).length;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>ITEM SELECT</Text>
        <Text style={styles.counter}>{assignedCount}/{team.length} assigned</Text>
      </View>

      {/* Current Pokemon info */}
      <View style={styles.pokemonSection}>
        <View style={styles.pokemonRow}>
          <PokemonSprite speciesId={pokemon.species.id} facing="front" size={56} />
          <View style={styles.pokemonInfo}>
            <Text style={styles.pokemonName}>{pokemon.species.name}</Text>
            <Text style={styles.abilityText}>
              {pokemon.ability}
              {(() => {
                const aid = pokemon.ability.toLowerCase().replace(/[^a-z0-9]/g, '');
                const desc = (abilitiesData as Record<string, any>)[aid]?.shortDesc;
                return desc ? ` — ${desc}` : '';
              })()}
            </Text>
            <Text style={styles.itemLabel}>
              {currentItem ? currentItem : 'No item selected'}
            </Text>
          </View>
          <Text style={styles.idxLabel}>{currentIdx + 1}/{team.length}</Text>
        </View>
        <View style={styles.movesList}>
          {pokemon.moves.map((m, i) => (
            <View key={i} style={styles.moveChip}>
              <View style={[styles.moveTypeDot, { backgroundColor: typeColors[m.type] || '#666' }]} />
              <Text style={styles.moveChipText} numberOfLines={1}>{m.name}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* Navigation buttons */}
      <View style={styles.navRow}>
        <TouchableOpacity
          style={[styles.navBtn, currentIdx === 0 && styles.navBtnDisabled]}
          onPress={handlePrev}
          disabled={currentIdx === 0}
          activeOpacity={0.7}
        >
          <Text style={[styles.navBtnText, currentIdx === 0 && styles.navBtnTextDisabled]}>
            {'<'} Previous
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.navBtn, currentIdx === team.length - 1 && styles.navBtnDisabled]}
          onPress={handleNext}
          disabled={currentIdx === team.length - 1}
          activeOpacity={0.7}
        >
          <Text style={[styles.navBtnText, currentIdx === team.length - 1 && styles.navBtnTextDisabled]}>
            Next {'>'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Team strip */}
      <View style={styles.teamStrip}>
        {team.map((p, i) => (
          <TouchableOpacity
            key={i}
            style={[
              styles.teamSlot,
              i === currentIdx && styles.teamSlotActive,
              !!itemSelections[i] && styles.teamSlotDone,
            ]}
            onPress={() => setCurrentIdx(i)}
            activeOpacity={0.7}
          >
            <PokemonSprite speciesId={p.species.id} facing="front" size={28} />
          </TouchableOpacity>
        ))}
      </View>

      {/* Item grid */}
      <ScrollView style={styles.gridScroll} contentContainerStyle={styles.gridContainer}>
        {HELD_ITEMS.map(itemName => {
          const isSelected = currentItem === itemName;
          return (
            <TouchableOpacity
              key={itemName}
              style={[
                styles.itemBtn,
                isSelected && styles.itemBtnSelected,
              ]}
              onPress={() => selectItem(itemName)}
              onLongPress={() => setDetailItem(itemName)}
              activeOpacity={0.7}
            >
              {ITEM_SPRITE_MAP[itemName] && (
                <Image
                  source={ITEM_SPRITE_MAP[itemName]}
                  style={styles.itemSprite}
                  resizeMode="contain"
                />
              )}
              <Text
                style={[
                  styles.itemText,
                  isSelected && styles.itemTextSelected,
                ]}
                numberOfLines={2}
              >
                {itemName}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Confirm button */}
      <View style={styles.confirmBar}>
        <TouchableOpacity
          style={[styles.confirmBtn, !allSelected && styles.confirmBtnDisabled]}
          onPress={handleConfirm}
          disabled={!allSelected}
          activeOpacity={0.7}
        >
          <Text style={styles.confirmText}>
            {allSelected ? 'CONFIRM ITEMS' : `ASSIGN ${team.length - assignedCount} MORE ITEM${team.length - assignedCount > 1 ? 'S' : ''}`}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Item detail modal */}
      <Modal visible={!!detailItem} transparent animationType="fade" onRequestClose={() => setDetailItem(null)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setDetailItem(null)}>
          <View style={styles.modalContent}>
            {detailItem && (
              <>
                <View style={styles.modalHeader}>
                  {ITEM_SPRITE_MAP[detailItem] && (
                    <Image
                      source={ITEM_SPRITE_MAP[detailItem]}
                      style={styles.modalSprite}
                      resizeMode="contain"
                    />
                  )}
                  <Text style={styles.modalItemName}>{detailItem}</Text>
                </View>
                <Text style={styles.modalDesc}>
                  {ITEM_DESCRIPTIONS[detailItem] || 'No description available.'}
                </Text>
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
  header: {
    paddingTop: spacing.md,
    paddingBottom: spacing.xs,
    paddingHorizontal: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: { fontSize: 20, fontWeight: '900', color: colors.accent, letterSpacing: 2 },
  counter: { fontSize: 13, color: '#4fc3f7', fontWeight: '700' },

  pokemonSection: { paddingHorizontal: spacing.md, paddingBottom: spacing.xs },
  pokemonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    padding: spacing.sm,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pokemonInfo: { flex: 1 },
  pokemonName: { fontSize: 16, fontWeight: '800', color: colors.text },
  abilityText: { fontSize: 10, color: colors.textDim, marginTop: 2 },
  itemLabel: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  idxLabel: { fontSize: 18, fontWeight: '900', color: '#4fc3f7' },
  movesList: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: spacing.xs },
  moveChip: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: colors.surface, paddingHorizontal: 6, paddingVertical: 2,
    borderRadius: 4, borderWidth: 1, borderColor: colors.border,
  },
  moveTypeDot: { width: 6, height: 6, borderRadius: 3 },
  moveChipText: { fontSize: 10, color: colors.text, fontWeight: '600' },

  navRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xs,
  },
  navBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  navBtnDisabled: { opacity: 0.3 },
  navBtnText: { color: colors.textSecondary, fontSize: 14, fontWeight: '600' },
  navBtnTextDisabled: { color: colors.textDim },

  teamStrip: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: spacing.xs,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  teamSlot: {
    width: 32,
    height: 32,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.03)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  teamSlotActive: { borderColor: '#4fc3f7', backgroundColor: 'rgba(79,195,247,0.1)' },
  teamSlotDone: { borderColor: 'rgba(76,175,80,0.5)', backgroundColor: 'rgba(76,175,80,0.08)' },

  gridScroll: { flex: 1 },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: spacing.md,
    gap: spacing.sm,
  },
  itemBtn: {
    width: '30.5%',
    aspectRatio: 1.6,
    backgroundColor: colors.surface,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xs,
  },
  itemBtnSelected: {
    borderColor: colors.accent,
    backgroundColor: 'rgba(233,69,96,0.12)',
  },
  itemBtnTaken: {
    opacity: 0.35,
  },
  itemSprite: { width: 24, height: 24, marginBottom: 2 },
  itemText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
  },
  itemTextSelected: { color: colors.accent },
  itemTextTaken: { color: colors.textDim },

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
  confirmBtnDisabled: { backgroundColor: colors.surface, opacity: 0.5 },
  confirmText: { color: '#fff', fontSize: 16, fontWeight: '800', letterSpacing: 1 },

  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: colors.background,
    borderRadius: 16,
    padding: spacing.lg,
    width: '85%',
    borderWidth: 2,
    borderColor: colors.border,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  modalSprite: { width: 32, height: 32 },
  modalItemName: {
    fontSize: 22,
    fontWeight: '900',
    color: colors.text,
  },
  modalDesc: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
  },
});
