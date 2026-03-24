import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { PkModal } from './shared/PkModal';
import { PkCard } from './shared/PkCard';
import { PokemonSprite } from './PokemonSprite';
import { TypeBadge } from './TypeBadge';
import { HpBar } from './HpBar';
import { StatusBadge } from './StatusBadge';
import { colors, spacing } from '../theme';
import type { VisiblePokemon } from '../../server/types';

interface Props {
  visible: boolean;
  onClose: () => void;
  scoutedPokemon: VisiblePokemon[];
  activePokemon: VisiblePokemon | null;
  teamSize: number;
  faintedCount: number;
}

export function ScoutedTeamModal({ visible, onClose, scoutedPokemon, activePokemon, teamSize, faintedCount }: Props) {
  // Combine active + scouted (active is already excluded from scoutedPokemon array)
  const allScouted: (VisiblePokemon | null)[] = [];
  if (activePokemon) allScouted.push(activePokemon);
  for (const p of scoutedPokemon) {
    allScouted.push(p);
  }
  // Fill unscouted slots
  const unscoutedCount = teamSize - allScouted.length;
  for (let i = 0; i < unscoutedCount; i++) {
    allScouted.push(null);
  }

  return (
    <PkModal visible={visible} title="Opponent's Team" onClose={onClose}>
      <Text style={styles.subtitle}>
        {allScouted.filter(p => p !== null).length} / {teamSize} scouted
        {faintedCount > 0 ? ` | ${faintedCount} fainted` : ''}
      </Text>

      {allScouted.map((pokemon, i) => (
        <PkCard key={i} padding="compact" style={styles.pokemonCard}>
          {pokemon ? (
            <View style={styles.row}>
              <View style={styles.spriteWrap}>
                <PokemonSprite speciesId={pokemon.species.id} facing="front" size={56} />
              </View>
              <View style={styles.info}>
                <Text style={[styles.name, !pokemon.isAlive && styles.faintedName]}>
                  {pokemon.species.name}
                </Text>
                <View style={styles.typeRow}>
                  {pokemon.species.types.map(t => (
                    <TypeBadge key={t} type={t} small />
                  ))}
                </View>
                {pokemon.isAlive ? (
                  <View style={styles.hpRow}>
                    <HpBar
                      currentHp={pokemon.currentHp}
                      maxHp={pokemon.maxHp}
                      width={80}
                      height={5}
                    />
                    <Text style={styles.hpText}>
                      {Math.round((pokemon.currentHp / pokemon.maxHp) * 100)}%
                    </Text>
                    <StatusBadge status={pokemon.status} />
                  </View>
                ) : (
                  <Text style={styles.fntText}>FNT</Text>
                )}
              </View>
              {i === 0 && activePokemon && (
                <View style={styles.activeBadge}>
                  <Text style={styles.activeBadgeText}>ACTIVE</Text>
                </View>
              )}
            </View>
          ) : (
            <View style={styles.row}>
              <View style={styles.unknownSprite}>
                <Text style={styles.unknownText}>?</Text>
              </View>
              <View style={styles.info}>
                <Text style={styles.unknownName}>Unknown</Text>
              </View>
            </View>
          )}
        </PkCard>
      ))}
    </PkModal>
  );
}

const styles = StyleSheet.create({
  subtitle: {
    color: colors.textDim,
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: spacing.md,
    letterSpacing: 0.5,
  },
  pokemonCard: {
    marginBottom: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  spriteWrap: {
    width: 56,
    height: 56,
  },
  info: {
    flex: 1,
    marginLeft: spacing.md,
  },
  name: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
  },
  faintedName: {
    color: colors.textDim,
  },
  typeRow: {
    flexDirection: 'row',
    gap: 4,
    marginTop: 3,
  },
  hpRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  hpText: {
    color: colors.textSecondary,
    fontSize: 10,
    fontWeight: '600',
  },
  fntText: {
    color: colors.hpRed,
    fontSize: 10,
    fontWeight: '800',
    marginTop: 4,
  },
  activeBadge: {
    backgroundColor: colors.primary,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  activeBadgeText: {
    color: '#fff',
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  unknownSprite: {
    width: 56,
    height: 56,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 28,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  unknownText: {
    color: colors.textDim,
    fontSize: 24,
    fontWeight: '700',
  },
  unknownName: {
    color: colors.textDim,
    fontSize: 15,
    fontWeight: '600',
    fontStyle: 'italic',
  },
});
