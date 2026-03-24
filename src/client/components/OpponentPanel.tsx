import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, Pressable, useWindowDimensions } from 'react-native';
import { ScoutedTeamModal } from './ScoutedTeamModal';
import { PokemonSprite } from './PokemonSprite';
import { HpBar } from './HpBar';
import { StatusBadge } from './StatusBadge';
import { TeamIndicator } from './TeamIndicator';
import { FloatingIndicator } from './FloatingIndicator';
import type { IndicatorData } from '../hooks/use-event-queue';
import { colors, spacing, shadows } from '../theme';
import type { TurnResultPayload } from '../../server/types';

interface Props {
  opponentVisible: TurnResultPayload['opponentVisible'] | null;
  botName: string;
  attackTrigger?: number;
  damageTrigger?: number;
  faintTrigger?: number;
  switchOutTrigger?: number;
  damageReaction?: string | null;
  hpOverride?: { current: number; max: number } | null;
  indicator?: IndicatorData | null;
  onLongPressSprite?: () => void;
  speciesIdOverride?: string | null;
  nameOverride?: string | null;
}

export function OpponentPanel({ opponentVisible, botName, attackTrigger = 0, damageTrigger = 0, faintTrigger = 0, switchOutTrigger = 0, damageReaction, hpOverride, indicator, onLongPressSprite, speciesIdOverride, nameOverride }: Props) {
  const { width: screenWidth } = useWindowDimensions();
  const spriteSize = Math.round(screenWidth * 0.55);
  const [showScouted, setShowScouted] = useState(false);
  const active = opponentVisible?.activePokemon;
  const displaySpeciesId = speciesIdOverride ?? active?.species.id ?? 'unknown';
  const displayName = nameOverride ?? active?.species.name ?? '???';

  if (__DEV__ && (displayName === '???' || !active)) {
    console.log(`[OpponentPanel] SHOWING ??? — active: ${active ? active.species.name : 'null'}, spriteOverride: ${speciesIdOverride ?? 'none'}, nameOverride: ${nameOverride ?? 'none'}, opponentVisible: ${opponentVisible ? 'yes' : 'null'}`);
  }
  const teamSize = opponentVisible?.teamSize ?? 6;
  const faintedCount = opponentVisible?.faintedCount ?? 0;
  const displayHp = hpOverride?.current ?? active?.currentHp ?? 1;
  const displayMaxHp = hpOverride?.max ?? active?.maxHp ?? 1;
  const hpPct = useMemo(
    () => displayMaxHp > 0 ? Math.round((displayHp / displayMaxHp) * 100) : 100,
    [displayHp, displayMaxHp]
  );

  return (
    <View style={styles.container}>
      {/* Compact info strip - left */}
      <View style={styles.infoStrip}>
        <View style={styles.nameRow}>
          <Text style={styles.name} numberOfLines={1}>
            {displayName}
          </Text>
        </View>
        <View style={styles.hpRow}>
          <HpBar
            currentHp={displayHp}
            maxHp={displayMaxHp}
            width={100}
            height={7}
          />
          <Text style={styles.hpText}>{hpPct}%</Text>
          <StatusBadge status={(nameOverride && nameOverride !== active?.species.name) ? null : (active?.status ?? null)} />
        </View>
        <Text style={styles.trainer} numberOfLines={1}>{botName}</Text>
        {/* Pokeballs underneath info — long-press to see scouted team */}
        <Pressable style={styles.pokeballs} onLongPress={() => setShowScouted(true)} delayLongPress={300}>
          <TeamIndicator total={teamSize} fainted={faintedCount} />
        </Pressable>
      </View>

      {/* Sprite - right, big */}
      <Pressable style={[styles.spriteArea, { width: spriteSize, height: spriteSize }]} onLongPress={onLongPressSprite} delayLongPress={300}>
        {(active || speciesIdOverride) && (
          <PokemonSprite
            speciesId={displaySpeciesId}
            facing="front"
            size={spriteSize}
            animated
            attackTrigger={attackTrigger}
            damageTrigger={damageTrigger}
            faintTrigger={faintTrigger}
            switchOutTrigger={switchOutTrigger}
          />
        )}
        {/* Floating indicator (damage numbers, status, etc.) */}
        <FloatingIndicator data={indicator ?? null} />
        {/* Damage reaction bubble */}
        {damageReaction && (
          <View style={styles.reactionBubble}>
            <Text style={styles.reactionText}>{damageReaction}</Text>
          </View>
        )}
      </Pressable>

      {/* Scouted team modal */}
      <ScoutedTeamModal
        visible={showScouted}
        onClose={() => setShowScouted(false)}
        scoutedPokemon={opponentVisible?.scoutedPokemon ?? []}
        activePokemon={active ?? null}
        teamSize={teamSize}
        faintedCount={faintedCount}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingLeft: spacing.lg,
  },
  infoStrip: {
    flex: 1,
    paddingTop: spacing.sm,
    gap: 3,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  name: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '800',
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
  trainer: {
    color: colors.textDim,
    fontSize: 10,
    fontWeight: '600',
  },
  pokeballs: {
    marginTop: spacing.xs,
  },
  spriteArea: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  reactionBubble: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    backgroundColor: 'rgba(0,0,0,0.75)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  reactionText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
    fontStyle: 'italic',
  },
});
