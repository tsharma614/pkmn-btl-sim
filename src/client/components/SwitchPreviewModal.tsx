import React, { useState } from 'react';
import { View, Text, Modal, Pressable, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { PokemonSprite } from './PokemonSprite';
import { TypeBadge } from './TypeBadge';
import { HpBar } from './HpBar';
import { StatusBadge } from './StatusBadge';
import { colors, spacing, typeColors } from '../theme';
import abilitiesData from '../../data/abilities.json';
import itemsData from '../../data/items.json';
import type { OwnPokemon } from '../../server/types';

interface Props {
  team: OwnPokemon[];
  initialIndex: number;
  activePokemonIndex: number;
  visible: boolean;
  onClose: () => void;
  onSelectSwitch: (pokemonIndex: number) => void;
}

function toId(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function getAbilityDesc(name: string): string | null {
  const id = toId(name);
  const entry = (abilitiesData as Record<string, { shortDesc?: string }>)[id];
  return entry?.shortDesc || null;
}

function getItemDesc(name: string): string | null {
  const id = toId(name);
  const entry = (itemsData as Record<string, { shortDesc?: string }>)[id];
  return entry?.shortDesc || null;
}

const STAT_LABELS: Record<string, string> = {
  hp: 'HP', atk: 'ATK', def: 'DEF', spa: 'SPA', spd: 'SPD', spe: 'SPE',
};

export function SwitchPreviewModal({ team, initialIndex, activePokemonIndex, visible, onClose, onSelectSwitch }: Props) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);

  // Reset when modal opens with a new index
  const prevVisible = React.useRef(visible);
  if (visible && !prevVisible.current) {
    if (currentIndex !== initialIndex) setCurrentIndex(initialIndex);
  }
  prevVisible.current = visible;

  const pokemon = team[currentIndex];
  if (!pokemon) return null;

  const isActive = currentIndex === activePokemonIndex;
  const isFainted = !pokemon.isAlive;
  const canSendOut = !isActive && !isFainted;

  const goLeft = () => {
    setCurrentIndex(prev => (prev - 1 + team.length) % team.length);
  };
  const goRight = () => {
    setCurrentIndex(prev => (prev + 1) % team.length);
  };

  return (
    <Modal transparent animationType="fade" visible={visible} onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.card} onPress={e => e.stopPropagation()}>
          <ScrollView bounces={false} showsVerticalScrollIndicator={false}>
            {/* Navigation arrows + header */}
            <View style={styles.navRow}>
              <TouchableOpacity onPress={goLeft} style={styles.arrowBtn}>
                <Text style={styles.arrowText}>{'<'}</Text>
              </TouchableOpacity>

              <View style={styles.headerCenter}>
                <PokemonSprite speciesId={pokemon.species.id} facing="front" size={80} animated={false} />
                <Text style={styles.name}>{pokemon.species.name}</Text>
                <View style={styles.typeRow}>
                  {pokemon.species.types.map(t => (
                    <TypeBadge key={t} type={t} />
                  ))}
                </View>
              </View>

              <TouchableOpacity onPress={goRight} style={styles.arrowBtn}>
                <Text style={styles.arrowText}>{'>'}</Text>
              </TouchableOpacity>
            </View>

            {/* Team indicator dots */}
            <View style={styles.dotRow}>
              {team.map((_, i) => (
                <View
                  key={i}
                  style={[
                    styles.dot,
                    i === currentIndex && styles.dotActive,
                    !team[i].isAlive && styles.dotFainted,
                  ]}
                />
              ))}
            </View>

            {/* HP */}
            {pokemon.isAlive ? (
              <View style={styles.hpSection}>
                <HpBar currentHp={pokemon.currentHp} maxHp={pokemon.maxHp} width={200} height={8} />
                <Text style={styles.hpText}>{pokemon.currentHp} / {pokemon.maxHp}</Text>
                {pokemon.status && <StatusBadge status={pokemon.status} />}
              </View>
            ) : (
              <Text style={styles.fainted}>FAINTED</Text>
            )}

            {/* Ability */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>ABILITY</Text>
              <Text style={styles.sectionValue}>{pokemon.ability}</Text>
              {getAbilityDesc(pokemon.ability) && (
                <Text style={styles.desc}>{getAbilityDesc(pokemon.ability)}</Text>
              )}
            </View>

            {/* Item */}
            {pokemon.item && (
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>ITEM</Text>
                <Text style={styles.sectionValue}>{pokemon.item}</Text>
                {getItemDesc(pokemon.item) && (
                  <Text style={styles.desc}>{getItemDesc(pokemon.item)}</Text>
                )}
              </View>
            )}

            {/* Stats */}
            {pokemon.stats && (
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>STATS</Text>
                <View style={styles.statsGrid}>
                  {Object.entries(pokemon.stats).map(([stat, value]) => {
                    const boost = pokemon.boosts[stat] || 0;
                    return (
                      <View key={stat} style={styles.statRow}>
                        <Text style={styles.statName}>{STAT_LABELS[stat] || stat.toUpperCase()}</Text>
                        <View style={styles.statBarTrack}>
                          <View style={[styles.statBarFill, { width: `${Math.min((value as number) / 400 * 100, 100)}%` }]} />
                        </View>
                        <Text style={styles.statValue}>{value as number}</Text>
                        {boost !== 0 && (
                          <Text style={[styles.boostText, boost > 0 ? styles.boostUp : styles.boostDown]}>
                            {boost > 0 ? `+${boost}` : boost}
                          </Text>
                        )}
                      </View>
                    );
                  })}
                </View>
              </View>
            )}

            {/* Moves */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>MOVES</Text>
              <View style={styles.movesGrid}>
                {pokemon.moves.map((move, i) => {
                  const bg = typeColors[move.type] || '#555';
                  return (
                    <View key={i} style={[styles.movePill, { backgroundColor: bg }]}>
                      <Text style={styles.movePillName} numberOfLines={1}>{move.name}</Text>
                      <Text style={styles.movePillPp}>{move.currentPp}/{move.maxPp}</Text>
                    </View>
                  );
                })}
              </View>
            </View>

            {/* Send Out button */}
            <TouchableOpacity
              style={[styles.sendOutBtn, !canSendOut && styles.sendOutBtnDisabled]}
              onPress={() => {
                if (canSendOut) {
                  onSelectSwitch(currentIndex);
                  onClose();
                }
              }}
              disabled={!canSendOut}
              activeOpacity={0.7}
            >
              <Text style={styles.sendOutText}>
                {isActive ? 'Already Active' : isFainted ? 'Fainted' : 'Send Out'}
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    width: '92%',
    maxHeight: '85%',
    borderWidth: 2,
    borderColor: colors.border,
    overflow: 'hidden',
    padding: spacing.lg,
  },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  arrowBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.08)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  arrowText: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '800',
  },
  headerCenter: {
    alignItems: 'center',
    flex: 1,
  },
  name: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '800',
    marginTop: 4,
  },
  typeRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 6,
  },
  dotRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    marginBottom: spacing.md,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  dotActive: {
    backgroundColor: colors.accent,
  },
  dotFainted: {
    backgroundColor: colors.hpRed,
    opacity: 0.5,
  },
  hpSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: spacing.md,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  hpText: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
  fainted: {
    color: colors.hpRed,
    fontSize: 14,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: spacing.md,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  section: {
    marginBottom: spacing.md,
  },
  sectionLabel: {
    color: colors.textDim,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: 4,
  },
  sectionValue: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
  },
  desc: {
    color: colors.textSecondary,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 3,
  },
  statsGrid: {
    gap: 4,
  },
  statRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statName: {
    color: colors.textDim,
    fontSize: 10,
    fontWeight: '700',
    width: 30,
  },
  statBarTrack: {
    flex: 1,
    height: 6,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  statBarFill: {
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.accent,
  },
  statValue: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '700',
    width: 30,
    textAlign: 'right',
  },
  boostText: {
    fontSize: 10,
    fontWeight: '800',
    width: 24,
    textAlign: 'right',
  },
  boostUp: {
    color: '#4fc3f7',
  },
  boostDown: {
    color: colors.hpRed,
  },
  movesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  movePill: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
    gap: 6,
  },
  movePillName: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  movePillPp: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 10,
    fontWeight: '600',
  },
  sendOutBtn: {
    backgroundColor: colors.accent,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: spacing.md,
  },
  sendOutBtnDisabled: {
    backgroundColor: colors.surface,
    opacity: 0.4,
  },
  sendOutText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
  },
});
