/**
 * Shop screen — appears after gym/E4 wins in gym career mode.
 * Lets player spend points on move swaps, item swaps, or buying new Pokemon.
 * Long press on Pokemon/move/item shows detail modals.
 */
import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Modal,
} from 'react-native';
import { PokemonSprite } from './PokemonSprite';
import { PokemonDetailModal } from './PokemonDetailModal';
import { colors, spacing } from '../theme';
import type { OwnPokemon } from '../../server/types';
import type { PokemonSpecies } from '../../types';
import movesJsonData from '../../data/moves.json';
import pokedexData from '../../data/pokedex.json';
import megaPokedexData from '../../data/mega-pokemon.json';

// ---------- Constants & helpers ----------

const movesLookup = movesJsonData as Record<string, any>;

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

const HELD_ITEMS = [
  'Leftovers', 'Life Orb', 'Choice Band', 'Choice Specs', 'Choice Scarf',
  'Focus Sash', 'Assault Vest', 'Rocky Helmet', 'Eviolite', 'Air Balloon',
  'Light Clay', 'Expert Belt', 'Weakness Policy', 'Sitrus Berry', 'Lum Berry',
  'Heavy-Duty Boots', 'Toxic Orb', 'Flame Orb', 'Black Sludge', 'Safety Goggles',
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
};

const CATEGORY_COLORS: Record<string, string> = {
  Physical: '#C22E28',
  Special: '#6390F0',
  Status: '#A8A77A',
};

const typeColors: Record<string, string> = {
  Normal: '#A8A77A', Fire: '#EE8130', Water: '#6390F0', Electric: '#F7D02C',
  Grass: '#7AC74C', Ice: '#96D9D6', Fighting: '#C22E28', Poison: '#A33EA1',
  Ground: '#E2BF65', Flying: '#A98FF3', Psychic: '#F95587', Bug: '#A6B91A',
  Rock: '#B6A136', Ghost: '#735797', Dragon: '#6F35FC', Dark: '#705746',
  Steel: '#B7B7CE', Fairy: '#D685AD',
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

const SWAP_MOVE_COST = 1;
const SWAP_ITEM_COST = 1;

// ---------- Types ----------

type ActiveOption = 'none' | 'move' | 'item' | 'buy';

/** Sub-step tracking for multi-step flows */
type MoveStep = { phase: 'pickPokemon' } | { phase: 'pickSlot'; pokemonIdx: number } | { phase: 'pickMove'; pokemonIdx: number; moveSlotIdx: number };
type ItemStep = { phase: 'pickPokemon' } | { phase: 'pickItem'; pokemonIdx: number };
type BuyStep = { phase: 'pickBuy' } | { phase: 'pickSlot'; buyPoolIdx: number };

interface Props {
  balance: number;
  team: OwnPokemon[];
  /** Pool of Pokemon available to buy */
  buyPool: { species: PokemonSpecies; tier: number; cost: number }[];
  onSwapMove: (pokemonIdx: number, moveSlotIdx: number, newMoveName: string) => void;
  onSwapItem: (pokemonIdx: number, newItem: string) => void;
  onBuyPokemon: (buyPoolIdx: number, replaceTeamIdx: number) => void;
  onDone: () => void;
}

// ---------- Component ----------

export function ShopScreen({ balance, team, buyPool, onSwapMove, onSwapItem, onBuyPokemon, onDone }: Props) {
  const [active, setActive] = useState<ActiveOption>('none');

  // Sub-step state per option
  const [moveStep, setMoveStep] = useState<MoveStep>({ phase: 'pickPokemon' });
  const [itemStep, setItemStep] = useState<ItemStep>({ phase: 'pickPokemon' });
  const [buyStep, setBuyStep] = useState<BuyStep>({ phase: 'pickBuy' });

  // Detail modals
  const [detailSpecies, setDetailSpecies] = useState<PokemonSpecies | null>(null);
  const [detailMove, setDetailMove] = useState<{ name: string; data: any } | null>(null);
  const [detailItem, setDetailItem] = useState<string | null>(null);

  const canAffordMove = balance >= SWAP_MOVE_COST;
  const canAffordItem = balance >= SWAP_ITEM_COST;
  const cheapestBuy = buyPool.length > 0 ? Math.min(...buyPool.map(b => b.cost)) : Infinity;
  const canAffordBuy = balance >= cheapestBuy;

  // ---------- Navigation helpers ----------

  const resetToMenu = useCallback(() => {
    setActive('none');
    setMoveStep({ phase: 'pickPokemon' });
    setItemStep({ phase: 'pickPokemon' });
    setBuyStep({ phase: 'pickBuy' });
  }, []);

  const handleBack = useCallback(() => {
    if (active === 'move') {
      if (moveStep.phase === 'pickPokemon') { resetToMenu(); }
      else if (moveStep.phase === 'pickSlot') { setMoveStep({ phase: 'pickPokemon' }); }
      else { setMoveStep({ phase: 'pickSlot', pokemonIdx: moveStep.pokemonIdx }); }
    } else if (active === 'item') {
      if (itemStep.phase === 'pickPokemon') { resetToMenu(); }
      else { setItemStep({ phase: 'pickPokemon' }); }
    } else if (active === 'buy') {
      if (buyStep.phase === 'pickBuy') { resetToMenu(); }
      else { setBuyStep({ phase: 'pickBuy' }); }
    }
  }, [active, moveStep, itemStep, buyStep, resetToMenu]);

  // ---------- Move swap flow ----------

  const getLearnset = useCallback((pokemonIdx: number) => {
    const pokemon = team[pokemonIdx];
    const speciesData = speciesById[pokemon.species.id];
    const currentMoveNames = new Set(pokemon.moves.map(m => m.name));
    return (speciesData?.movePool || [])
      .map(name => ({ name, data: getMoveData(name) }))
      .filter(m => {
        if (!m.data) return false;
        if (currentMoveNames.has(m.name)) return false; // already known
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
  }, [team]);

  // ---------- Render helpers ----------

  const renderHeader = () => (
    <View style={styles.header}>
      <Text style={styles.title}>SHOP</Text>
      <View style={styles.balancePill}>
        <Text style={styles.balanceText}>{balance} pts</Text>
      </View>
    </View>
  );

  const renderBackButton = (label: string) => (
    <TouchableOpacity onPress={handleBack} style={styles.backRow} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
      <Text style={styles.backText}>{'<'} {label}</Text>
    </TouchableOpacity>
  );

  // ---------- Main menu ----------

  const renderMenu = () => (
    <View style={styles.menuContainer}>
      {/* Swap Move */}
      <TouchableOpacity
        style={[styles.optionCard, !canAffordMove && styles.optionCardDisabled]}
        onPress={() => { if (canAffordMove) { setActive('move'); setMoveStep({ phase: 'pickPokemon' }); } }}
        disabled={!canAffordMove}
        activeOpacity={0.7}
      >
        <Text style={styles.optionEmoji}>{'<>'}</Text>
        <View style={styles.optionInfo}>
          <Text style={[styles.optionName, !canAffordMove && styles.optionNameDisabled]}>Swap Move</Text>
          <Text style={[styles.optionDesc, !canAffordMove && styles.optionDescDisabled]}>Replace a move with one from the learnset</Text>
        </View>
        <View style={[styles.costBadge, !canAffordMove && styles.costBadgeDisabled]}>
          <Text style={[styles.costText, !canAffordMove && styles.costTextDisabled]}>1 pt</Text>
        </View>
      </TouchableOpacity>

      {/* Swap Item */}
      <TouchableOpacity
        style={[styles.optionCard, !canAffordItem && styles.optionCardDisabled]}
        onPress={() => { if (canAffordItem) { setActive('item'); setItemStep({ phase: 'pickPokemon' }); } }}
        disabled={!canAffordItem}
        activeOpacity={0.7}
      >
        <Text style={styles.optionEmoji}>{'[ ]'}</Text>
        <View style={styles.optionInfo}>
          <Text style={[styles.optionName, !canAffordItem && styles.optionNameDisabled]}>Swap Item</Text>
          <Text style={[styles.optionDesc, !canAffordItem && styles.optionDescDisabled]}>Change a Pokemon's held item</Text>
        </View>
        <View style={[styles.costBadge, !canAffordItem && styles.costBadgeDisabled]}>
          <Text style={[styles.costText, !canAffordItem && styles.costTextDisabled]}>1 pt</Text>
        </View>
      </TouchableOpacity>

      {/* Buy Pokemon */}
      <TouchableOpacity
        style={[styles.optionCard, (!canAffordBuy || buyPool.length === 0) && styles.optionCardDisabled]}
        onPress={() => { if (canAffordBuy && buyPool.length > 0) { setActive('buy'); setBuyStep({ phase: 'pickBuy' }); } }}
        disabled={!canAffordBuy || buyPool.length === 0}
        activeOpacity={0.7}
      >
        <Text style={styles.optionEmoji}>{'+'}</Text>
        <View style={styles.optionInfo}>
          <Text style={[styles.optionName, !canAffordBuy && styles.optionNameDisabled]}>Buy Pokemon</Text>
          <Text style={[styles.optionDesc, !canAffordBuy && styles.optionNameDisabled]}>Add a new Pokemon to your team</Text>
        </View>
        <View style={[styles.costBadge, !canAffordBuy && styles.costBadgeDisabled]}>
          <Text style={[styles.costText, !canAffordBuy && styles.costTextDisabled]}>2-4 pts</Text>
        </View>
      </TouchableOpacity>
    </View>
  );

  // ---------- Team grid (shared) ----------

  const renderTeamGrid = (
    onPick: (idx: number) => void,
    subtitle: string,
    disabledFilter?: (idx: number) => boolean,
  ) => (
    <View style={styles.subView}>
      {renderBackButton('Back')}
      <Text style={styles.subTitle}>{subtitle}</Text>
      <View style={styles.teamGrid}>
        {team.map((p, i) => {
          const disabled = disabledFilter ? disabledFilter(i) : false;
          return (
            <TouchableOpacity
              key={i}
              style={[styles.teamCard, disabled && styles.teamCardDisabled]}
              onPress={() => { if (!disabled) onPick(i); }}
              onLongPress={() => {
                // Build a partial PokemonSpecies for detail modal
                setDetailSpecies({
                  id: p.species.id,
                  name: p.species.name,
                  types: p.species.types as any,
                  baseStats: p.species.baseStats as any,
                  abilities: [p.ability],
                } as PokemonSpecies);
              }}
              disabled={disabled}
              activeOpacity={0.7}
            >
              <PokemonSprite speciesId={p.species.id} facing="front" size={48} />
              <Text style={[styles.teamCardName, disabled && styles.teamCardNameDisabled]} numberOfLines={1}>
                {p.species.name}
              </Text>
              {p.item && (
                <Text style={styles.teamCardItem} numberOfLines={1}>{p.item}</Text>
              )}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );

  // ---------- Move swap sub-views ----------

  const renderMoveSwap = () => {
    if (moveStep.phase === 'pickPokemon') {
      return renderTeamGrid(
        (idx) => setMoveStep({ phase: 'pickSlot', pokemonIdx: idx }),
        'Pick a Pokemon to swap a move',
      );
    }

    if (moveStep.phase === 'pickSlot') {
      const pokemon = team[moveStep.pokemonIdx];
      return (
        <View style={styles.subView}>
          {renderBackButton('Team')}
          <Text style={styles.subTitle}>Pick the move slot to replace</Text>
          <View style={styles.pokemonBanner}>
            <PokemonSprite speciesId={pokemon.species.id} facing="front" size={40} />
            <Text style={styles.pokemonBannerName}>{pokemon.species.name}</Text>
          </View>
          <View style={styles.moveSlotList}>
            {pokemon.moves.map((m, i) => {
              const md = getMoveData(m.name);
              return (
                <TouchableOpacity
                  key={i}
                  style={styles.moveSlotRow}
                  onPress={() => setMoveStep({ phase: 'pickMove', pokemonIdx: moveStep.pokemonIdx, moveSlotIdx: i })}
                  onLongPress={() => { if (md) setDetailMove({ name: m.name, data: md }); }}
                  activeOpacity={0.7}
                >
                  <View style={[styles.moveTypeDot, { backgroundColor: typeColors[m.type] || '#666' }]} />
                  <View style={[styles.moveCategoryDot, { backgroundColor: CATEGORY_COLORS[m.category] || '#666' }]} />
                  <Text style={styles.moveSlotName} numberOfLines={1}>{m.name}</Text>
                  <Text style={styles.moveSlotPower}>{m.power ? m.power : '-'}</Text>
                  <Text style={styles.moveSlotAcc}>{m.accuracy ? `${m.accuracy}%` : '-'}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      );
    }

    // pickMove phase
    const pokemon = team[moveStep.pokemonIdx];
    const learnset = getLearnset(moveStep.pokemonIdx);
    const replacingMove = pokemon.moves[moveStep.moveSlotIdx];

    return (
      <View style={styles.subView}>
        {renderBackButton('Slots')}
        <Text style={styles.subTitle}>
          Replace "{replacingMove.name}" with:
        </Text>
        <ScrollView style={styles.moveListScroll}>
          {learnset.map(({ name, data: md }) => {
            const power = md.basePower ?? md.power ?? 0;
            return (
              <TouchableOpacity
                key={name}
                style={styles.moveListRow}
                onPress={() => {
                  onSwapMove(moveStep.pokemonIdx, moveStep.moveSlotIdx, name);
                  resetToMenu();
                }}
                onLongPress={() => setDetailMove({ name, data: md })}
                activeOpacity={0.7}
              >
                <View style={[styles.moveTypeDot, { backgroundColor: typeColors[md.type] || '#666' }]} />
                <View style={[styles.moveCategoryDot, { backgroundColor: CATEGORY_COLORS[md.category] || '#666' }]} />
                <Text style={styles.moveListName} numberOfLines={1}>{name}</Text>
                <Text style={styles.moveListPower}>{power > 0 ? power : '-'}</Text>
                <Text style={styles.moveListAcc}>{md.accuracy ? `${md.accuracy}%` : '-'}</Text>
              </TouchableOpacity>
            );
          })}
          {learnset.length === 0 && (
            <Text style={styles.emptyText}>No other learnable moves available.</Text>
          )}
        </ScrollView>
      </View>
    );
  };

  // ---------- Item swap sub-views ----------

  const renderItemSwap = () => {
    if (itemStep.phase === 'pickPokemon') {
      return renderTeamGrid(
        (idx) => setItemStep({ phase: 'pickItem', pokemonIdx: idx }),
        'Pick a Pokemon to change its item',
      );
    }

    const pokemon = team[itemStep.pokemonIdx];
    return (
      <View style={styles.subView}>
        {renderBackButton('Team')}
        <Text style={styles.subTitle}>Pick a new item for {pokemon.species.name}</Text>
        <View style={styles.pokemonBanner}>
          <PokemonSprite speciesId={pokemon.species.id} facing="front" size={40} />
          <Text style={styles.pokemonBannerName}>{pokemon.species.name}</Text>
          <Text style={styles.pokemonBannerSub}>Current: {pokemon.item || 'None'}</Text>
        </View>
        <ScrollView style={styles.itemGridScroll} contentContainerStyle={styles.itemGridContainer}>
          {HELD_ITEMS.map(itemName => {
            const isCurrent = pokemon.item === itemName;
            return (
              <TouchableOpacity
                key={itemName}
                style={[styles.itemBtn, isCurrent && styles.itemBtnCurrent]}
                onPress={() => {
                  if (!isCurrent) {
                    onSwapItem(itemStep.pokemonIdx, itemName);
                    resetToMenu();
                  }
                }}
                onLongPress={() => setDetailItem(itemName)}
                activeOpacity={0.7}
              >
                <Text
                  style={[styles.itemText, isCurrent && styles.itemTextCurrent]}
                  numberOfLines={2}
                >
                  {itemName}
                </Text>
                {isCurrent && <Text style={styles.itemCurrentLabel}>Current</Text>}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>
    );
  };

  // ---------- Buy Pokemon sub-views ----------

  const renderBuyPokemon = () => {
    if (buyStep.phase === 'pickBuy') {
      return (
        <View style={styles.subView}>
          {renderBackButton('Back')}
          <Text style={styles.subTitle}>Browse available Pokemon</Text>
          <ScrollView style={styles.buyGridScroll} contentContainerStyle={styles.buyGridContainer}>
            {buyPool.map((entry, i) => {
              const affordable = balance >= entry.cost;
              return (
                <TouchableOpacity
                  key={i}
                  style={[styles.buyCard, !affordable && styles.buyCardDisabled]}
                  onPress={() => { if (affordable) setBuyStep({ phase: 'pickSlot', buyPoolIdx: i }); }}
                  onLongPress={() => setDetailSpecies(entry.species)}
                  disabled={!affordable}
                  activeOpacity={0.7}
                >
                  <PokemonSprite speciesId={entry.species.id} facing="front" size={48} />
                  <Text style={[styles.buyCardName, !affordable && styles.buyCardNameDisabled]} numberOfLines={1}>
                    {entry.species.name}
                  </Text>
                  <View style={[styles.buyCostBadge, !affordable && styles.buyCostBadgeDisabled]}>
                    <Text style={[styles.buyCostText, !affordable && styles.buyCostTextDisabled]}>
                      {entry.cost} pt{entry.cost !== 1 ? 's' : ''}
                    </Text>
                  </View>
                  <Text style={styles.buyTierLabel}>
                    {entry.tier === 0 ? 'Mega' : `T${entry.tier}`}
                  </Text>
                </TouchableOpacity>
              );
            })}
            {buyPool.length === 0 && (
              <Text style={styles.emptyText}>No Pokemon available to buy.</Text>
            )}
          </ScrollView>
        </View>
      );
    }

    // pickSlot phase — choose which team member to replace
    const chosen = buyPool[buyStep.buyPoolIdx];
    return renderTeamGrid(
      (teamIdx) => {
        onBuyPokemon(buyStep.buyPoolIdx, teamIdx);
        resetToMenu();
      },
      `Replace a team member with ${chosen.species.name} (${chosen.cost} pts)`,
    );
  };

  // ---------- Move detail modal ----------

  const renderMoveDetailModal = () => (
    <Modal visible={!!detailMove} transparent animationType="fade" onRequestClose={() => setDetailMove(null)}>
      <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setDetailMove(null)}>
        <View style={styles.modalContent} onStartShouldSetResponder={() => true}>
          {detailMove && (
            <>
              <View style={styles.modalHeader}>
                <View style={[styles.modalBadge, { backgroundColor: typeColors[detailMove.data.type] || '#666' }]}>
                  <Text style={styles.modalBadgeText}>{detailMove.data.type}</Text>
                </View>
                <View style={[styles.modalBadge, { backgroundColor: CATEGORY_COLORS[detailMove.data.category] || '#666' }]}>
                  <Text style={styles.modalBadgeText}>{detailMove.data.category}</Text>
                </View>
              </View>
              <Text style={styles.modalTitle}>{detailMove.name}</Text>
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
              {(detailMove.data.desc || detailMove.data.shortDesc) && (
                <Text style={styles.modalDesc}>
                  {detailMove.data.desc || detailMove.data.shortDesc}
                </Text>
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
              {detailMove.data.secondary?.chance && (
                <Text style={styles.modalSecondary}>
                  {detailMove.data.secondary.chance}% chance: {detailMove.data.secondary.status || detailMove.data.secondary.volatileStatus || (detailMove.data.secondary.boosts ? 'stat change' : 'effect')}
                </Text>
              )}
            </>
          )}
        </View>
      </TouchableOpacity>
    </Modal>
  );

  // ---------- Item detail modal ----------

  const renderItemDetailModal = () => (
    <Modal visible={!!detailItem} transparent animationType="fade" onRequestClose={() => setDetailItem(null)}>
      <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setDetailItem(null)}>
        <View style={styles.modalContent} onStartShouldSetResponder={() => true}>
          {detailItem && (
            <>
              <Text style={styles.modalTitle}>{detailItem}</Text>
              <Text style={styles.modalDesc}>
                {ITEM_DESCRIPTIONS[detailItem] || 'No description available.'}
              </Text>
            </>
          )}
        </View>
      </TouchableOpacity>
    </Modal>
  );

  // ---------- Main render ----------

  return (
    <View style={styles.container}>
      {renderHeader()}

      <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
        {active === 'none' && renderMenu()}
        {active === 'move' && renderMoveSwap()}
        {active === 'item' && renderItemSwap()}
        {active === 'buy' && renderBuyPokemon()}
      </ScrollView>

      {/* Done Shopping button — always visible */}
      <View style={styles.doneBar}>
        <TouchableOpacity style={styles.doneBtn} onPress={onDone} activeOpacity={0.7}>
          <Text style={styles.doneText}>DONE SHOPPING</Text>
        </TouchableOpacity>
      </View>

      {/* Modals */}
      <PokemonDetailModal
        visible={!!detailSpecies}
        species={detailSpecies}
        onClose={() => setDetailSpecies(null)}
      />
      {renderMoveDetailModal()}
      {renderItemDetailModal()}
    </View>
  );
}

// ---------- Styles ----------

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  title: {
    fontSize: 24,
    fontWeight: '900',
    color: colors.accent,
    letterSpacing: 3,
  },
  balancePill: {
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#4fc3f7',
  },
  balanceText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#4fc3f7',
  },

  // Body
  body: {
    flex: 1,
  },
  bodyContent: {
    flexGrow: 1,
  },

  // Menu
  menuContainer: {
    padding: spacing.lg,
    gap: spacing.md,
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: spacing.lg,
    borderWidth: 1.5,
    borderColor: colors.border,
    gap: spacing.md,
  },
  optionCardDisabled: {
    opacity: 0.4,
  },
  optionEmoji: {
    fontSize: 22,
    fontWeight: '900',
    color: colors.accent,
    width: 40,
    textAlign: 'center',
  },
  optionInfo: {
    flex: 1,
  },
  optionName: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.text,
  },
  optionNameDisabled: {
    color: colors.textDim,
  },
  optionDesc: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  optionDescDisabled: {
    color: colors.textDim,
  },
  costBadge: {
    backgroundColor: 'rgba(79,195,247,0.15)',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(79,195,247,0.3)',
  },
  costBadgeDisabled: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderColor: 'rgba(255,255,255,0.1)',
  },
  costText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#4fc3f7',
  },
  costTextDisabled: {
    color: colors.textDim,
  },

  // Sub-view shared
  subView: {
    flex: 1,
    paddingHorizontal: spacing.md,
  },
  backRow: {
    paddingVertical: spacing.sm,
  },
  backText: {
    color: colors.textSecondary,
    fontSize: 14,
    fontWeight: '600',
  },
  subTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.md,
  },

  // Pokemon banner (compact header showing selected pokemon)
  pokemonBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    padding: spacing.sm,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.md,
  },
  pokemonBannerName: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.text,
    flex: 1,
  },
  pokemonBannerSub: {
    fontSize: 11,
    color: colors.textSecondary,
  },

  // Team grid
  teamGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  teamCard: {
    width: '30%',
    backgroundColor: colors.surface,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xs,
  },
  teamCardDisabled: {
    opacity: 0.35,
  },
  teamCardName: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
  teamCardNameDisabled: {
    color: colors.textDim,
  },
  teamCardItem: {
    fontSize: 9,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 2,
  },

  // Move slot list (for picking which move to replace)
  moveSlotList: {
    gap: spacing.xs,
  },
  moveSlotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.sm,
  },
  moveTypeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  moveCategoryDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  moveSlotName: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },
  moveSlotPower: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textSecondary,
    width: 32,
    textAlign: 'right',
  },
  moveSlotAcc: {
    fontSize: 12,
    color: colors.textDim,
    width: 38,
    textAlign: 'right',
  },

  // Move list (for picking new move from learnset)
  moveListScroll: {
    flex: 1,
  },
  moveListRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    gap: spacing.sm,
  },
  moveListName: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
  },
  moveListPower: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary,
    width: 30,
    textAlign: 'right',
  },
  moveListAcc: {
    fontSize: 11,
    color: colors.textDim,
    width: 35,
    textAlign: 'right',
  },

  // Item grid
  itemGridScroll: {
    flex: 1,
  },
  itemGridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    paddingBottom: spacing.lg,
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
  itemBtnCurrent: {
    borderColor: '#4fc3f7',
    backgroundColor: 'rgba(79,195,247,0.1)',
  },
  itemText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
  },
  itemTextCurrent: {
    color: '#4fc3f7',
  },
  itemCurrentLabel: {
    fontSize: 8,
    fontWeight: '700',
    color: '#4fc3f7',
    marginTop: 2,
  },

  // Buy Pokemon grid
  buyGridScroll: {
    flex: 1,
  },
  buyGridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    paddingBottom: spacing.lg,
  },
  buyCard: {
    width: '30%',
    backgroundColor: colors.surface,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xs,
  },
  buyCardDisabled: {
    opacity: 0.35,
  },
  buyCardName: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
  buyCardNameDisabled: {
    color: colors.textDim,
  },
  buyCostBadge: {
    backgroundColor: 'rgba(79,195,247,0.15)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    marginTop: spacing.xs,
    borderWidth: 1,
    borderColor: 'rgba(79,195,247,0.3)',
  },
  buyCostBadgeDisabled: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderColor: 'rgba(255,255,255,0.1)',
  },
  buyCostText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#4fc3f7',
  },
  buyCostTextDisabled: {
    color: colors.textDim,
  },
  buyTierLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: colors.textDim,
    marginTop: 2,
  },

  // Empty text
  emptyText: {
    color: colors.textDim,
    fontSize: 14,
    textAlign: 'center',
    paddingVertical: spacing.xl,
    width: '100%',
  },

  // Done bar
  doneBar: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  doneBtn: {
    backgroundColor: colors.accent,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  doneText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 1,
  },

  // Modals (shared)
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
    maxHeight: '70%',
    borderWidth: 2,
    borderColor: colors.border,
  },
  modalHeader: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  modalBadge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 4,
  },
  modalBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: colors.text,
    marginBottom: spacing.md,
  },
  modalStatsRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  modalStatBox: {
    alignItems: 'center',
  },
  modalStatLabel: {
    fontSize: 10,
    color: colors.textDim,
    fontWeight: '600',
  },
  modalStatValue: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.text,
  },
  modalDesc: {
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 18,
    marginBottom: spacing.sm,
  },
  modalFlags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginBottom: spacing.sm,
  },
  flagChip: {
    fontSize: 10,
    color: colors.textDim,
    backgroundColor: 'rgba(255,255,255,0.06)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    overflow: 'hidden',
  },
  modalSecondary: {
    fontSize: 11,
    color: colors.accent,
    fontStyle: 'italic',
  },
});
