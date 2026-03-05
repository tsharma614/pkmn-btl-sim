import React from 'react';
import { View, Text, Modal, Pressable, StyleSheet, ScrollView } from 'react-native';
import { PokemonSprite } from './PokemonSprite';
import { TypeBadge } from './TypeBadge';
import { HpBar } from './HpBar';
import { StatusBadge } from './StatusBadge';
import { colors, spacing, typeColors } from '../theme';
import abilitiesData from '../../data/abilities.json';
import itemsData from '../../data/items.json';
import type { OwnPokemon } from '../../server/types';

type VisiblePokemon = {
  species: { id: string; name: string; types: string[]; baseStats: Record<string, number> };
  level: number;
  currentHp: number;
  maxHp: number;
  status: string | null;
  volatileStatuses: string[];
  boosts: Record<string, number>;
  isAlive: boolean;
  ability: string;
};

interface Props {
  /** Full own Pokemon info — if set, shows everything */
  ownPokemon?: OwnPokemon | null;
  /** Opponent Pokemon — shows limited info (type, ability name only) */
  opponentPokemon?: VisiblePokemon | null;
  visible: boolean;
  onClose: () => void;
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

export function PokemonInfoModal({ ownPokemon, opponentPokemon, visible, onClose }: Props) {
  const pokemon = ownPokemon || opponentPokemon;
  if (!pokemon) return null;

  const isOwn = !!ownPokemon;

  return (
    <Modal transparent animationType="fade" visible={visible} onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.card} onPress={e => e.stopPropagation()}>
          <ScrollView bounces={false} showsVerticalScrollIndicator={false}>
            {/* Header with sprite and name */}
            <View style={styles.header}>
              <PokemonSprite speciesId={pokemon.species.id} facing="front" size={80} />
              <View style={styles.headerInfo}>
                <Text style={styles.name}>{pokemon.species.name}</Text>
                <Text style={styles.level}>Lv. {pokemon.level}</Text>
                <View style={styles.typeRow}>
                  {pokemon.species.types.map(t => (
                    <TypeBadge key={t} type={t} />
                  ))}
                </View>
              </View>
            </View>

            {/* HP Bar (if alive) */}
            {pokemon.isAlive && (
              <View style={styles.hpSection}>
                <HpBar currentHp={pokemon.currentHp} maxHp={pokemon.maxHp} width={200} height={8} />
                <Text style={styles.hpText}>
                  {isOwn ? `${pokemon.currentHp} / ${pokemon.maxHp}` : `${Math.round((pokemon.currentHp / pokemon.maxHp) * 100)}%`}
                </Text>
                {pokemon.status && <StatusBadge status={pokemon.status} />}
              </View>
            )}
            {!pokemon.isAlive && (
              <Text style={styles.fainted}>FAINTED</Text>
            )}

            {/* Ability */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>ABILITY</Text>
              <Text style={styles.sectionValue}>{pokemon.ability}</Text>
              {isOwn && getAbilityDesc(pokemon.ability) && (
                <Text style={styles.desc}>{getAbilityDesc(pokemon.ability)}</Text>
              )}
            </View>

            {/* Item (own only) */}
            {isOwn && ownPokemon!.item && (
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>ITEM</Text>
                <Text style={styles.sectionValue}>{ownPokemon!.item}</Text>
                {getItemDesc(ownPokemon!.item) && (
                  <Text style={styles.desc}>{getItemDesc(ownPokemon!.item)}</Text>
                )}
              </View>
            )}

            {/* Stats (own only) */}
            {isOwn && ownPokemon!.stats && (
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>STATS</Text>
                <View style={styles.statsGrid}>
                  {Object.entries(ownPokemon!.stats).map(([stat, value]) => {
                    const boost = ownPokemon!.boosts[stat] || 0;
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

            {/* Boosts for opponent (if any non-zero) */}
            {!isOwn && Object.values(pokemon.boosts).some(v => v !== 0) && (
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>BOOSTS</Text>
                <View style={styles.boostRow}>
                  {Object.entries(pokemon.boosts).filter(([_, v]) => v !== 0).map(([stat, val]) => (
                    <View key={stat} style={styles.boostPill}>
                      <Text style={[styles.boostPillText, (val as number) > 0 ? styles.boostUp : styles.boostDown]}>
                        {STAT_LABELS[stat] || stat.toUpperCase()} {(val as number) > 0 ? `+${val}` : val}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* Base Stats */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>BASE STATS</Text>
              <View style={styles.statsGrid}>
                {Object.entries(pokemon.species.baseStats).map(([stat, value]) => (
                  <View key={stat} style={styles.statRow}>
                    <Text style={styles.statName}>{STAT_LABELS[stat] || stat.toUpperCase()}</Text>
                    <View style={styles.statBarTrack}>
                      <View style={[styles.statBarFill, {
                        width: `${Math.min((value as number) / 255 * 100, 100)}%`,
                        backgroundColor: (value as number) >= 100 ? colors.hpGreen : (value as number) >= 60 ? colors.hpYellow : colors.hpRed,
                      }]} />
                    </View>
                    <Text style={styles.statValue}>{value as number}</Text>
                  </View>
                ))}
              </View>
            </View>
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
    maxHeight: '80%',
    borderWidth: 2,
    borderColor: colors.border,
    overflow: 'hidden',
    padding: spacing.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  headerInfo: {
    flex: 1,
    marginLeft: spacing.md,
  },
  name: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '800',
  },
  level: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '600',
    marginTop: 2,
  },
  typeRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 6,
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
  boostRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 4,
  },
  boostPill: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  boostPillText: {
    fontSize: 11,
    fontWeight: '700',
  },
});
