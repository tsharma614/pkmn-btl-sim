import React, { useState } from 'react';
import { View, Text, StyleSheet, Dimensions, Pressable } from 'react-native';
import { ScoutedTeamModal } from './ScoutedTeamModal';
import { PokemonSprite } from './PokemonSprite';
import { HpBar } from './HpBar';
import { StatusBadge } from './StatusBadge';
import { TeamIndicator } from './TeamIndicator';
import { FloatingIndicator } from './FloatingIndicator';
import type { IndicatorData } from '../hooks/use-event-queue';
import { colors, spacing } from '../theme';
import type { TurnResultPayload } from '../../server/types';

const SCREEN_WIDTH = Dimensions.get('window').width;
const SPRITE_SIZE = Math.round(SCREEN_WIDTH * 0.55);

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
  const [showScouted, setShowScouted] = useState(false);
  const active = opponentVisible?.activePokemon;
  const displaySpeciesId = speciesIdOverride ?? active?.species.id ?? 'unknown';
  const displayName = nameOverride ?? active?.species.name ?? '???';

  // Debug: log when opponent display changes
  if (displayName === '???' || !active) {
    console.log(`[OpponentPanel] SHOWING ??? — active: ${active ? active.species.name : 'null'}, spriteOverride: ${speciesIdOverride ?? 'none'}, nameOverride: ${nameOverride ?? 'none'}, opponentVisible: ${opponentVisible ? 'yes' : 'null'}`);
  }
  const teamSize = opponentVisible?.teamSize ?? 6;
  const faintedCount = opponentVisible?.faintedCount ?? 0;
  const displayHp = hpOverride?.current ?? active?.currentHp ?? 1;
  const displayMaxHp = hpOverride?.max ?? active?.maxHp ?? 1;
  const hpPct = displayMaxHp > 0 ? Math.round((displayHp / displayMaxHp) * 100) : 100;

  return (
    <View style={styles.container}>
      {/* Compact info strip - left */}
      <View style={styles.infoStrip}>
        <Text style={styles.name} numberOfLines={1}>
          {displayName}
        </Text>
        <View style={styles.hpRow}>
          <HpBar
            currentHp={displayHp}
            maxHp={displayMaxHp}
            width={100}
            height={6}
          />
          <Text style={styles.hpText}>{hpPct}%</Text>
          <StatusBadge status={(nameOverride && nameOverride !== active?.species.name) ? null : (active?.status ?? null)} />
        </View>
        <View style={styles.metaRow}>
          <Text style={styles.trainer}>{botName}</Text>
        </View>
        {/* Pokeballs underneath info — long-press to see scouted team */}
        <Pressable style={styles.pokeballs} onLongPress={() => setShowScouted(true)} delayLongPress={300}>
          <TeamIndicator total={teamSize} fainted={faintedCount} />
        </Pressable>
      </View>

      {/* Sprite - right, big */}
      <Pressable style={styles.spriteArea} onLongPress={onLongPressSprite} delayLongPress={300}>
        {(active || speciesIdOverride) && (
          <PokemonSprite
            speciesId={displaySpeciesId}
            facing="front"
            size={SPRITE_SIZE}
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
  },
  name: {
    color: colors.accent,
    fontSize: 16,
    fontWeight: '800',
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
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 3,
  },
  trainer: {
    color: colors.textDim,
    fontSize: 10,
  },
  pokeballs: {
    marginTop: spacing.sm,
  },
  spriteArea: {
    width: SPRITE_SIZE,
    height: SPRITE_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reactionBubble: {
    position: 'absolute',
    bottom: 4,
    left: 4,
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    maxWidth: SPRITE_SIZE - 16,
  },
  reactionText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
    fontStyle: 'italic',
  },
});
