import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  useWindowDimensions,
} from 'react-native';
import { PokemonSprite } from './PokemonSprite';
import { PkCard } from './shared/PkCard';
import { PkButton } from './shared/PkButton';
import { PkModal } from './shared/PkModal';
import { colors, spacing, typeColors, shadows } from '../theme';

/** Type-themed emoji icons */
const TYPE_ICONS: Record<string, string> = {
  Fire: '🔥',
  Water: '💧',
  Grass: '🍃',
  Electric: '⚡',
  Ice: '❄️',
  Psychic: '🔮',
  Dark: '🌙',
  Poison: '☠️',
  Fighting: '👊',
  Ghost: '👻',
  Dragon: '🐉',
  Rock: '🪨',
  Ground: '⛰️',
  Steel: '🛡️',
  Bug: '🐛',
  Flying: '🪶',
  Fairy: '✨',
  Normal: '⚪',
};

interface Props {
  gymTypes: string[];
  beatenGyms: boolean[];
  onChallenge: (gymIndex: number) => void;
  onEliteFour: () => void;
  onBack: () => void;
  onSaveQuit?: () => void;
  onShop?: () => void;
  shopBalance?: number;
  team?: import('../../server/types').OwnPokemon[];
}

export function GymMapScreen({
  gymTypes,
  beatenGyms,
  onSaveQuit,
  onChallenge,
  onEliteFour,
  onBack,
  onShop,
  shopBalance,
  team,
}: Props) {
  const { width: screenW } = useWindowDimensions();
  const cardW = (screenW - spacing.lg * 2 - spacing.md) / 2;
  const [showTeam, setShowTeam] = useState(false);

  const beatenCount = useMemo(() => beatenGyms.filter(Boolean).length, [beatenGyms]);
  const allBeaten = beatenCount === 8;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>GYM MAP</Text>

        {/* Badge row — 8 circular metallic gym badges */}
        <View style={styles.badgeRow}>
          {gymTypes.map((type, i) => {
            const beaten = beatenGyms[i];
            const color = typeColors[type] ?? colors.textDim;
            return (
              <View
                key={i}
                style={[
                  styles.badgeSlot,
                  beaten && {
                    backgroundColor: color,
                    borderColor: color,
                    ...shadows.glow(color),
                  },
                ]}
              >
                {beaten ? (
                  <Text style={styles.badgeIcon}>{TYPE_ICONS[type] ?? '✓'}</Text>
                ) : (
                  <View style={styles.badgeInnerRing} />
                )}
              </View>
            );
          })}
        </View>
        <Text style={styles.progressText}>{beatenCount}/8 Badges Earned</Text>
      </View>

      {/* Gym Grid */}
      <ScrollView style={styles.scrollArea} contentContainerStyle={styles.gridContainer}>
        {gymTypes.map((type, index) => {
          const beaten = beatenGyms[index];
          const color = typeColors[type] ?? colors.textSecondary;
          const icon = TYPE_ICONS[type] ?? '⚪';

          return (
            <PkCard
              key={index}
              accentColor={beaten ? undefined : color}
              padding="none"
              style={[styles.card, { width: cardW }] as any}
            >
              <TouchableOpacity
                style={styles.cardTouchable}
                activeOpacity={beaten ? 1 : 0.7}
                onPress={() => !beaten && onChallenge(index)}
                disabled={beaten}
              >
                {/* Type color background wash */}
                <View style={[styles.cardBg, { backgroundColor: beaten ? colors.surface : color }]}>
                  <View style={styles.cardBgOverlay} />
                </View>

                {/* Content */}
                <View style={styles.cardContent}>
                  <Text style={styles.gymIcon}>{icon}</Text>
                  <Text style={[styles.typeName, beaten && styles.typeNameBeaten]}>
                    {type}
                  </Text>
                  <Text style={styles.gymLabel}>Gym {index + 1}</Text>

                  {beaten ? (
                    <View style={styles.beatenBadge}>
                      <Text style={styles.beatenText}>CLEARED</Text>
                    </View>
                  ) : (
                    <View style={[styles.challengeBtn, { backgroundColor: color }]}>
                      <Text style={styles.challengeText}>CHALLENGE</Text>
                    </View>
                  )}
                </View>
              </TouchableOpacity>
            </PkCard>
          );
        })}
      </ScrollView>

      {/* Bottom Action Bar */}
      <View style={styles.bottomBar}>
        {allBeaten ? (
          <PkButton
            title="CHALLENGE ELITE FOUR"
            variant="primary"
            size="lg"
            onPress={onEliteFour}
            style={styles.e4BtnWrapper}
          />
        ) : (
          <View style={styles.actionRow}>
            {team && team.length > 0 && (
              <PkButton
                title="Team"
                variant="secondary"
                size="sm"
                onPress={() => setShowTeam(true)}
                style={styles.actionBtn}
              />
            )}
            {onShop && (
              <TouchableOpacity style={styles.shopBtn} onPress={onShop} activeOpacity={0.7}>
                <Text style={styles.shopText}>Shop</Text>
                <View style={styles.shopBalancePill}>
                  <Text style={styles.shopBalanceText}>{shopBalance ?? 0} pts</Text>
                </View>
              </TouchableOpacity>
            )}
            {onSaveQuit && (
              <PkButton
                title="Save & Quit"
                variant="ghost"
                size="sm"
                onPress={onSaveQuit}
                style={styles.actionBtn}
              />
            )}
            <TouchableOpacity style={styles.forfeitBtn} onPress={onBack} activeOpacity={0.7}>
              <Text style={styles.forfeitText}>Forfeit</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Team details modal */}
      <PkModal visible={showTeam} title="YOUR TEAM" onClose={() => setShowTeam(false)}>
        {(team ?? []).map((p, i) => (
          <View key={i} style={styles.teamModalRow}>
            <PokemonSprite speciesId={p.species.id} facing="front" size={48} />
            <View style={styles.teamModalInfo}>
              <Text style={styles.teamModalName}>{p.species.name}</Text>
              <Text style={styles.teamModalAbility}>{p.ability} · {p.item || 'No item'}</Text>
              <View style={styles.teamModalMoves}>
                {p.moves.map((m, j) => (
                  <Text key={j} style={styles.teamModalMove}>{m.name}</Text>
                ))}
              </View>
              {p.battleStats && (
                <View style={styles.teamModalStats}>
                  <Text style={styles.teamModalStat}>{p.battleStats.kos} KOs</Text>
                  <Text style={styles.teamModalStat}>{p.battleStats.damageDealt} Dmg</Text>
                  <Text style={styles.teamModalStat}>{p.battleStats.timesFainted} Faints</Text>
                </View>
              )}
            </View>
          </View>
        ))}
      </PkModal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },

  // Header
  header: {
    alignItems: 'center',
    paddingTop: spacing.xl,
    paddingBottom: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: {
    fontSize: 28,
    fontWeight: '900',
    color: colors.text,
    letterSpacing: 4,
  },
  badgeRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: spacing.lg,
  },
  badgeSlot: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 2.5,
    borderColor: colors.borderLight,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeInnerRing: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  badgeIcon: {
    fontSize: 14,
  },
  progressText: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '600',
    marginTop: spacing.sm,
  },

  // Grid
  scrollArea: {
    flex: 1,
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: spacing.lg,
    gap: spacing.md,
    paddingBottom: spacing.xl,
  },

  // Card
  card: {
    height: 170,
  },
  cardTouchable: {
    flex: 1,
  },
  cardBg: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.2,
  },
  cardBgOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.background,
    opacity: 0.55,
  },
  cardContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.md,
  },
  gymIcon: {
    fontSize: 36,
    marginBottom: spacing.sm,
  },
  typeName: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: 1,
  },
  typeNameBeaten: {
    color: colors.textDim,
  },
  gymLabel: {
    fontSize: 11,
    color: colors.textDim,
    marginTop: 2,
    marginBottom: spacing.sm,
    fontWeight: '600',
  },
  challengeBtn: {
    paddingHorizontal: spacing.lg,
    paddingVertical: 7,
    borderRadius: 8,
  },
  challengeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  beatenBadge: {
    paddingHorizontal: spacing.md,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: 'rgba(34,197,94,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(34,197,94,0.3)',
  },
  beatenText: {
    color: colors.hpGreen,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.5,
  },

  // Bottom bar
  bottomBar: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  actionRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'center',
  },
  actionBtn: {
    flex: 1,
  },
  e4BtnWrapper: {
    width: '100%',
  },
  shopBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: 'rgba(34,197,94,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(34,197,94,0.25)',
    gap: spacing.xs,
  },
  shopText: {
    color: colors.hpGreen,
    fontSize: 13,
    fontWeight: '700',
  },
  shopBalancePill: {
    backgroundColor: 'rgba(34,197,94,0.2)',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 6,
  },
  shopBalanceText: {
    color: colors.hpGreen,
    fontSize: 10,
    fontWeight: '800',
  },
  forfeitBtn: {
    paddingVertical: 10,
    paddingHorizontal: spacing.md,
    borderRadius: 10,
    backgroundColor: 'rgba(227,53,13,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(227,53,13,0.25)',
    alignItems: 'center',
  },
  forfeitText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '700',
  },

  // Team modal rows
  teamModalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  teamModalInfo: {
    flex: 1,
  },
  teamModalName: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.text,
  },
  teamModalAbility: {
    fontSize: 11,
    color: colors.textDim,
    marginTop: 2,
  },
  teamModalMoves: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginTop: 4,
  },
  teamModalMove: {
    fontSize: 10,
    color: colors.textSecondary,
    backgroundColor: colors.surfaceLight,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  teamModalStats: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: 6,
  },
  teamModalStat: {
    fontSize: 10,
    color: colors.accentGold,
    fontWeight: '700',
  },
});
