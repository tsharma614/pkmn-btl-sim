import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { colors, spacing, typeColors } from '../theme';

interface Props {
  gymTypes: string[];
  beatenGyms: boolean[];
  onChallenge: (gymIndex: number) => void;
  onEliteFour: () => void;
  onBack: () => void;
  onSaveQuit?: () => void;
}

export function GymMapScreen({
  gymTypes,
  beatenGyms,
  onSaveQuit,
  onChallenge,
  onEliteFour,
  onBack,
}: Props) {
  const beatenCount = beatenGyms.filter(Boolean).length;
  const allBeaten = beatenCount === 8;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <TouchableOpacity onPress={onBack} style={styles.backButton}>
            <Text style={styles.backText}>{'< Forfeit Run'}</Text>
          </TouchableOpacity>
          {onSaveQuit && (
            <TouchableOpacity onPress={onSaveQuit} style={styles.backButton}>
              <Text style={[styles.backText, { color: colors.textSecondary }]}>Save & Quit</Text>
            </TouchableOpacity>
          )}
        </View>
        <Text style={styles.title}>GYM MAP</Text>
        <Text style={styles.progress}>{beatenCount}/8 Beaten</Text>
      </View>

      {/* Gym Grid */}
      <ScrollView
        style={styles.scrollArea}
        contentContainerStyle={styles.gridContainer}
      >
        {gymTypes.map((type, index) => {
          const beaten = beatenGyms[index];
          const color = typeColors[type] ?? colors.textSecondary;

          return (
            <TouchableOpacity
              key={index}
              style={[styles.card, beaten && styles.cardBeaten]}
              activeOpacity={beaten ? 1 : 0.7}
              onPress={() => {
                if (!beaten) onChallenge(index);
              }}
              disabled={beaten}
            >
              {/* Type-colored top bar */}
              <View
                style={[
                  styles.typeBar,
                  { backgroundColor: beaten ? colors.textDim : color },
                ]}
              />

              {/* Gym building icon */}
              <View style={styles.buildingContainer}>
                {/* Peaked roof */}
                <View
                  style={[
                    styles.roof,
                    {
                      borderBottomColor: beaten ? '#5a5a5a' : '#6B3410',
                    },
                  ]}
                />
                {/* Building body */}
                <View
                  style={[
                    styles.building,
                    {
                      backgroundColor: beaten ? '#5a5a5a' : '#8B4513',
                    },
                  ]}
                >
                  {/* Door */}
                  <View
                    style={[
                      styles.door,
                      {
                        backgroundColor: beaten ? '#3a3a3a' : '#5a2d0c',
                      },
                    ]}
                  />
                </View>
              </View>

              {/* Type name */}
              <Text
                style={[
                  styles.typeName,
                  beaten && styles.typeNameBeaten,
                  !beaten && { color },
                ]}
              >
                {type}
              </Text>

              {/* Challenge button or checkmark */}
              {beaten ? (
                <View style={styles.checkmarkContainer}>
                  <Text style={styles.checkmark}>✓</Text>
                </View>
              ) : (
                <View style={[styles.challengeButton, { backgroundColor: color }]}>
                  <Text style={styles.challengeText}>CHALLENGE</Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Elite Four button */}
      {allBeaten && (
        <TouchableOpacity style={styles.eliteFourButton} onPress={onEliteFour}>
          <Text style={styles.eliteFourText}>CHALLENGE ELITE FOUR</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },

  /* ── Header ── */
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  backButton: {
    paddingVertical: spacing.xs,
    paddingRight: spacing.sm,
  },
  backText: {
    color: colors.accent,
    fontSize: 14,
    fontWeight: '600',
  },
  title: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 2,
  },
  progress: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '600',
  },

  /* ── Grid ── */
  scrollArea: {
    flex: 1,
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: spacing.md,
    justifyContent: 'space-between',
  },

  /* ── Card ── */
  card: {
    width: '47%',
    backgroundColor: colors.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.md,
    alignItems: 'center',
    overflow: 'hidden',
    paddingBottom: spacing.md,
  },
  cardBeaten: {
    opacity: 0.45,
  },
  typeBar: {
    width: '100%',
    height: 6,
    borderTopLeftRadius: 10,
    borderTopRightRadius: 10,
  },

  /* ── Building icon ── */
  buildingContainer: {
    alignItems: 'center',
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  roof: {
    width: 0,
    height: 0,
    borderLeftWidth: 28,
    borderRightWidth: 28,
    borderBottomWidth: 18,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
  },
  building: {
    width: 44,
    height: 32,
    borderRadius: 2,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  door: {
    width: 14,
    height: 18,
    borderTopLeftRadius: 7,
    borderTopRightRadius: 7,
    marginBottom: 0,
  },

  /* ── Labels ── */
  typeName: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: spacing.sm,
    letterSpacing: 1,
  },
  typeNameBeaten: {
    color: colors.textDim,
  },

  /* ── Challenge / Checkmark ── */
  challengeButton: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xs + 2,
    borderRadius: 6,
  },
  challengeText: {
    color: colors.text,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
  },
  checkmarkContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#3a7d44',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkmark: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '700',
  },

  /* ── Elite Four button ── */
  eliteFourButton: {
    backgroundColor: colors.accent,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.xl,
    paddingVertical: spacing.md + 2,
    borderRadius: 8,
    alignItems: 'center',
  },
  eliteFourText: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 2,
  },
});
