import React from 'react';
import { View, Text, StyleSheet, Dimensions, Pressable } from 'react-native';
import { PokemonSprite } from './PokemonSprite';
import { HpBar } from './HpBar';
import { StatusBadge } from './StatusBadge';
import { TeamIndicator } from './TeamIndicator';
import { FloatingIndicator } from './FloatingIndicator';
import type { IndicatorData } from '../hooks/use-event-queue';
import { colors, spacing } from '../theme';
import type { OwnPokemon } from '../../server/types';

const SCREEN_WIDTH = Dimensions.get('window').width;
const SPRITE_SIZE = Math.round(SCREEN_WIDTH * 0.55);

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
  const faintedCount = team.filter(p => !p.isAlive).length;
  const displayHp = hpOverride?.current ?? active.currentHp;
  const displayMaxHp = hpOverride?.max ?? active.maxHp;

  return (
    <View style={styles.container}>
      {/* Sprite - left, big */}
      <Pressable style={styles.spriteArea} onLongPress={onLongPressSprite} delayLongPress={300}>
        <PokemonSprite
          speciesId={speciesIdOverride ?? active.species.id}
          facing="back"
          size={SPRITE_SIZE}
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
            height={6}
          />
          <Text style={styles.hpText}>
            {displayHp}/{displayMaxHp}
          </Text>
          <StatusBadge status={active.status} />
        </View>
        {active.item && (
          <Text style={styles.item} numberOfLines={1}>@ {active.item}</Text>
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
    width: SPRITE_SIZE,
    height: SPRITE_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoStrip: {
    flex: 1,
    paddingBottom: spacing.sm,
    alignItems: 'flex-end',
  },
  pokeballs: {
    marginBottom: spacing.sm,
  },
  name: {
    color: colors.accent,
    fontSize: 16,
    fontWeight: '800',
    textAlign: 'right',
    letterSpacing: 0.5,
  },
  hpRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 3,
  },
  hpText: {
    color: colors.textSecondary,
    fontSize: 10,
    marginLeft: 5,
  },
  item: {
    color: colors.textDim,
    fontSize: 10,
    fontStyle: 'italic',
    marginTop: 3,
  },
});
