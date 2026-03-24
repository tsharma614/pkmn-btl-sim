import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Pressable, useWindowDimensions } from 'react-native';
import { PokemonSprite } from './PokemonSprite';
import { HpBar } from './HpBar';
import { StatusBadge } from './StatusBadge';
import { TeamIndicator } from './TeamIndicator';
import { FloatingIndicator } from './FloatingIndicator';
import type { IndicatorData } from '../hooks/use-event-queue';
import { colors, spacing } from '../theme';
import type { OwnPokemon } from '../../server/types';

interface Props {
  active: OwnPokemon;
  team: OwnPokemon[];
  attackTrigger?: number;
  damageTrigger?: number;
  faintTrigger?: number;
  switchOutTrigger?: number;
  hpOverride?: { current: number; max: number } | null;
  indicator?: IndicatorData | null;
  onLongPressSprite?: () => void;
  speciesIdOverride?: string | null;
  nameOverride?: string | null;
}

export function PlayerPanel({ active, team, attackTrigger = 0, damageTrigger = 0, faintTrigger = 0, switchOutTrigger = 0, hpOverride, indicator, onLongPressSprite, speciesIdOverride, nameOverride }: Props) {
  const { width: screenWidth } = useWindowDimensions();
  const spriteSize = Math.round(screenWidth * 0.55);
  const faintedCount = useMemo(() => team.filter(p => !p.isAlive).length, [team]);
  const displayHp = hpOverride?.current ?? active.currentHp;
  const displayMaxHp = hpOverride?.max ?? active.maxHp;

  return (
    <View style={styles.container}>
      {/* Sprite - left, big */}
      <Pressable style={[styles.spriteArea, { width: spriteSize, height: spriteSize }]} onLongPress={onLongPressSprite} delayLongPress={300}>
        <PokemonSprite
          speciesId={speciesIdOverride ?? active.species.id}
          facing="back"
          size={spriteSize}
          animated
          attackTrigger={attackTrigger}
          damageTrigger={damageTrigger}
          faintTrigger={faintTrigger}
          switchOutTrigger={switchOutTrigger}
        />
        <FloatingIndicator data={indicator ?? null} />
      </Pressable>

      {/* Compact info strip - right */}
      <View style={styles.infoStrip}>
        {/* Pokeballs on top */}
        <View style={styles.pokeballs}>
          <TeamIndicator total={team.length} fainted={faintedCount} />
        </View>
        <Text style={styles.name} numberOfLines={1}>
          {nameOverride ?? active.species.name}
        </Text>
        <View style={styles.hpRow}>
          <HpBar
            currentHp={displayHp}
            maxHp={displayMaxHp}
            width={100}
            height={7}
          />
          <Text style={styles.hpText}>
            {displayHp}/{displayMaxHp}
          </Text>
          <StatusBadge status={(nameOverride && nameOverride !== active.species.name) ? null : active.status} />
        </View>
        {active.item && (
          <View style={styles.itemRow}>
            <Text style={styles.item} numberOfLines={1}>@ {active.item}</Text>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingRight: spacing.lg,
  },
  spriteArea: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoStrip: {
    flex: 1,
    paddingBottom: spacing.sm,
    alignItems: 'flex-end',
    gap: 3,
  },
  pokeballs: {
    marginBottom: spacing.xs,
  },
  name: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '800',
    textAlign: 'right',
    letterSpacing: 0.5,
  },
  hpRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  hpText: {
    color: colors.textSecondary,
    fontSize: 10,
    fontWeight: '700',
  },
  itemRow: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  item: {
    color: colors.textDim,
    fontSize: 10,
    fontWeight: '600',
    fontStyle: 'italic',
  },
});
