import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors, spacing } from '../theme';

const GYM_SAVE_KEY = '@pbs_gym_career_save';

export interface GymCareerSave {
  /** Which gym the player is currently on (0-based, 0-7 gyms, 8-11 E4, 12 champion) */
  currentStage: number;
  /** Randomized gym types for this run */
  gymTypes: string[];
  /** Serialized player team (carries through) */
  team: any[];
  /** Date save was created */
  date: string;
}

interface Props {
  onBack: () => void;
  onStartGauntlet: () => void;
  onStartGymCareer: (existingSave?: GymCareerSave) => void;
}

export function CampaignScreen({ onBack, onStartGauntlet, onStartGymCareer }: Props) {
  const [save, setSave] = useState<GymCareerSave | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(GYM_SAVE_KEY).then(raw => {
      if (raw) setSave(JSON.parse(raw));
      setLoaded(true);
    });
  }, []);

  const handleRestart = () => {
    AsyncStorage.removeItem(GYM_SAVE_KEY);
    setSave(null);
    onStartGymCareer();
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn} activeOpacity={0.7}>
          <Text style={styles.backText}>{'< Back'}</Text>
        </TouchableOpacity>
        <Text style={styles.title}>CAMPAIGN</Text>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {/* Gauntlet Card */}
        <TouchableOpacity style={styles.modeCard} onPress={onStartGauntlet} activeOpacity={0.7}>
          <Text style={styles.modeTitle}>GAUNTLET</Text>
          <Text style={styles.modeDesc}>
            Pick a starter, battle your way up, and steal Pokemon from defeated opponents.
            Build your team as you go — how far can you get?
          </Text>
          <View style={styles.modeBadge}>
            <Text style={styles.modeBadgeText}>ENDLESS</Text>
          </View>
        </TouchableOpacity>

        {/* Gym Career Card */}
        <View style={styles.modeCard}>
          <Text style={styles.modeTitle}>GYM CAREER</Text>
          <Text style={styles.modeDesc}>
            Draft a team, pick moves, and take on 8 Gyms, the Elite Four, and the Champion.
            Your team carries through the whole run.
          </Text>
          <View style={styles.modeBadge}>
            <Text style={styles.modeBadgeText}>13 BATTLES</Text>
          </View>

          {loaded && save ? (
            <View style={styles.saveSection}>
              <Text style={styles.saveText}>
                Save found — Stage {save.currentStage + 1}/13
              </Text>
              <View style={styles.saveButtons}>
                <TouchableOpacity
                  style={styles.continueBtn}
                  onPress={() => onStartGymCareer(save)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.continueBtnText}>CONTINUE</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.restartBtn}
                  onPress={handleRestart}
                  activeOpacity={0.7}
                >
                  <Text style={styles.restartBtnText}>RESTART</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <TouchableOpacity
              style={[styles.startModeBtn, { marginTop: spacing.md }]}
              onPress={() => onStartGymCareer()}
              activeOpacity={0.7}
            >
              <Text style={styles.startModeBtnText}>START</Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

// -- Save helpers (exported for use in battle context) --

export async function getGymCareerSave(): Promise<GymCareerSave | null> {
  try {
    const raw = await AsyncStorage.getItem(GYM_SAVE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export async function saveGymCareer(data: GymCareerSave): Promise<void> {
  await AsyncStorage.setItem(GYM_SAVE_KEY, JSON.stringify(data));
}

export async function clearGymCareerSave(): Promise<void> {
  await AsyncStorage.removeItem(GYM_SAVE_KEY);
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    paddingTop: spacing.lg,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  backBtn: {
    marginBottom: spacing.sm,
  },
  backText: {
    color: colors.textSecondary,
    fontSize: 14,
    fontWeight: '600',
  },
  title: {
    fontSize: 24,
    fontWeight: '900',
    color: colors.accent,
    letterSpacing: 3,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.lg,
    paddingBottom: 40,
  },
  modeCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  modeTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: colors.text,
    letterSpacing: 2,
    marginBottom: spacing.sm,
  },
  modeDesc: {
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  modeBadge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.accent,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    marginTop: spacing.md,
  },
  modeBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
  },
  saveSection: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  saveText: {
    color: colors.textSecondary,
    fontSize: 12,
    marginBottom: spacing.sm,
  },
  saveButtons: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  continueBtn: {
    flex: 1,
    backgroundColor: colors.accent,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  continueBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 1,
  },
  restartBtn: {
    flex: 1,
    backgroundColor: 'transparent',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  restartBtnText: {
    color: colors.textDim,
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 1,
  },
  startModeBtn: {
    backgroundColor: colors.accent,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  startModeBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 2,
  },
});
