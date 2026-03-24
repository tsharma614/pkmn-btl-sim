import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Modal,
  useWindowDimensions,
} from 'react-native';
import { PokemonSprite } from './PokemonSprite';
import { PokemonDetailModal } from './PokemonDetailModal';
import { colors, spacing, typeColors } from '../theme';

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
  const beatenCount = beatenGyms.filter(Boolean).length;
  const allBeaten = beatenCount === 8;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>GYM MAP</Text>

        {/* Badge row — 8 slots */}
        <View style={styles.badgeRow}>
          {gymTypes.map((type, i) => {
            const beaten = beatenGyms[i];
            const color = typeColors[type] ?? colors.textDim;
            return (
              <View
                key={i}
                style={[
                  styles.badgeSlot,
                  beaten && { backgroundColor: color, borderColor: color },
                ]}
              >
                {beaten && <Text style={styles.badgeCheck}>✓</Text>}
              </View>
            );
          })}
        </View>
        <Text style={styles.progressText}>{beatenCount}/8 Beaten</Text>
      </View>

      {/* Gym Grid */}
      <ScrollView style={styles.scrollArea} contentContainerStyle={styles.gridContainer}>
        {gymTypes.map((type, index) => {
          const beaten = beatenGyms[index];
          const color = typeColors[type] ?? colors.textSecondary;
          const icon = TYPE_ICONS[type] ?? '⚪';

          return (
            <TouchableOpacity
              key={index}
              style={[styles.card, { width: cardW }]}
              activeOpacity={beaten ? 1 : 0.7}
              onPress={() => !beaten && onChallenge(index)}
              disabled={beaten}
            >
              {/* Gradient-like background: type color at top fading to dark */}
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
                    <Text style={styles.beatenText}>CLEARED ✓</Text>
                  </View>
                ) : (
                  <View style={[styles.challengeBtn, { backgroundColor: color }]}>
                    <Text style={styles.challengeText}>CHALLENGE</Text>
                  </View>
                )}
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Bottom Action Bar */}
      <View style={styles.bottomBar}>
        {allBeaten ? (
          <TouchableOpacity style={styles.e4Btn} onPress={onEliteFour} activeOpacity={0.7}>
            <Text style={styles.e4Text}>CHALLENGE ELITE FOUR</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.actionRow}>
            {team && team.length > 0 && (
              <TouchableOpacity style={styles.teamBtn} onPress={() => setShowTeam(true)} activeOpacity={0.7}>
                <Text style={styles.teamBtnText}>Team</Text>
              </TouchableOpacity>
            )}
            {onShop && (
              <TouchableOpacity style={styles.shopBtn} onPress={onShop} activeOpacity={0.7}>
                <Text style={styles.shopText}>Shop ({shopBalance ?? 0} pts)</Text>
              </TouchableOpacity>
            )}
            {onSaveQuit && (
              <TouchableOpacity style={styles.saveBtn} onPress={onSaveQuit} activeOpacity={0.7}>
                <Text style={styles.saveText}>Save & Quit</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={styles.forfeitBtn} onPress={onBack} activeOpacity={0.7}>
              <Text style={styles.forfeitText}>Forfeit</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Team details modal */}
      <Modal visible={showTeam} transparent animationType="fade" onRequestClose={() => setShowTeam(false)}>
        <TouchableOpacity style={styles.teamModalOverlay} activeOpacity={1} onPress={() => setShowTeam(false)}>
          <View style={styles.teamModalContent} onStartShouldSetResponder={() => true}>
            <Text style={styles.teamModalTitle}>YOUR TEAM</Text>
            <ScrollView>
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
            </ScrollView>
            <TouchableOpacity style={styles.teamModalClose} onPress={() => setShowTeam(false)} activeOpacity={0.7}>
              <Text style={styles.teamModalCloseText}>Close</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
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
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
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
    gap: 6,
    marginTop: spacing.md,
  },
  badgeSlot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeCheck: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '900',
  },
  progressText: {
    color: colors.textDim,
    fontSize: 12,
    marginTop: spacing.xs,
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
  },

  // Card
  card: {
    // width set via inline style from useWindowDimensions
    height: 160,
    borderRadius: 14,
    overflow: 'hidden',
  },
  cardBg: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.25,
  },
  cardBgOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.background,
    opacity: 0.6,
  },
  cardContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.sm,
  },
  gymIcon: {
    fontSize: 36,
    marginBottom: spacing.xs,
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
    fontSize: 10,
    color: colors.textDim,
    marginTop: 2,
    marginBottom: spacing.sm,
  },
  challengeBtn: {
    paddingHorizontal: spacing.lg,
    paddingVertical: 6,
    borderRadius: 8,
  },
  challengeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
  },
  beatenBadge: {
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: 'rgba(76,175,80,0.2)',
    borderWidth: 1,
    borderColor: 'rgba(76,175,80,0.4)',
  },
  beatenText: {
    color: '#4caf50',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
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
    gap: spacing.md,
  },
  teamBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: 'rgba(79,195,247,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(79,195,247,0.3)',
    alignItems: 'center',
  },
  teamBtnText: { color: '#4fc3f7', fontSize: 13, fontWeight: '700' },
  teamModalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center' },
  teamModalContent: { backgroundColor: colors.background, borderRadius: 16, padding: spacing.lg, width: '90%', maxHeight: '80%', borderWidth: 2, borderColor: colors.border },
  teamModalTitle: { fontSize: 16, fontWeight: '900', color: colors.accent, letterSpacing: 2, marginBottom: spacing.md, textAlign: 'center' },
  teamModalRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  teamModalInfo: { flex: 1 },
  teamModalName: { fontSize: 14, fontWeight: '800', color: colors.text },
  teamModalAbility: { fontSize: 10, color: colors.textDim, marginTop: 1 },
  teamModalMoves: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 3 },
  teamModalMove: { fontSize: 9, color: colors.textSecondary, backgroundColor: colors.surface, paddingHorizontal: 5, paddingVertical: 1, borderRadius: 3 },
  teamModalStats: { flexDirection: 'row', gap: 8, marginTop: 4 },
  teamModalStat: { fontSize: 9, color: colors.textDim, fontWeight: '600' },
  teamModalClose: { marginTop: spacing.md, backgroundColor: colors.surface, paddingVertical: 12, borderRadius: 10, alignItems: 'center', borderWidth: 1, borderColor: colors.border },
  teamModalCloseText: { color: colors.textSecondary, fontSize: 14, fontWeight: '700' },
  shopBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: 'rgba(76,175,80,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(76,175,80,0.3)',
    alignItems: 'center',
  },
  shopText: {
    color: '#4caf50',
    fontSize: 13,
    fontWeight: '700',
  },
  forfeitBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: 'rgba(244,67,54,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(244,67,54,0.3)',
    alignItems: 'center',
  },
  forfeitText: {
    color: '#f44336',
    fontSize: 14,
    fontWeight: '700',
  },
  saveBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  saveText: {
    color: colors.textSecondary,
    fontSize: 14,
    fontWeight: '700',
  },
  e4Btn: {
    backgroundColor: colors.accent,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: colors.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  e4Text: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 2,
  },
});
