import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Dimensions,
} from 'react-native';
import { colors, spacing, typeColors } from '../theme';

const { width: SCREEN_W } = Dimensions.get('window');
const CARD_W = (SCREEN_W - spacing.lg * 2 - spacing.md) / 2;

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
}: Props) {
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
              style={[styles.card]}
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
    width: CARD_W,
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
