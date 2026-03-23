import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  useWindowDimensions,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { PokemonSprite } from './PokemonSprite';
import { MatchSettingsForm } from './MatchSettingsForm';
import { colors, spacing } from '../theme';
import { MONOTYPE_TYPES } from '../../engine/draft-pool';
import type { PoolSize, DraftType } from '../../engine/draft-pool';
import { StatsScreen } from './StatsScreen';
import { CampaignScreen } from './CampaignScreen';
import type { GymCareerSave } from './CampaignScreen';
import { getProfile, saveProfile } from '../utils/stats-storage';

const OLD_NAME_KEY = '@pbs_trainer_name';

export type Difficulty = 'easy' | 'normal' | 'hard';

interface Props {
  onStart: (playerName: string, itemMode: 'competitive' | 'casual', maxGen?: number | null, difficulty?: Difficulty, legendaryMode?: boolean, draftMode?: boolean, monotype?: string | null, draftType?: DraftType, poolSize?: number, megaMode?: boolean, moveSelection?: boolean) => void;
  onPlayOnline: (playerName: string, itemMode: 'competitive' | 'casual', maxGen?: number | null, legendaryMode?: boolean, draftMode?: boolean, monotype?: string | null, draftType?: DraftType, megaMode?: boolean, moveSelection?: boolean) => void;
  onStartGauntlet?: (playerName: string) => void;
  onStartGymCareer?: (playerName: string, existingSave?: GymCareerSave) => void;
}

function makeBgSprites(w: number, h: number) {
  return [
    { id: 'mewtwo', x: -10, y: -10, size: 130, opacity: 0.12 },
    { id: 'ceruledge', x: w / 2 - 55, y: 10, size: 110, opacity: 0.10 },
    { id: 'garchomp', x: w - 120, y: -5, size: 120, opacity: 0.11 },
    { id: 'kyogre', x: -20, y: h * 0.11, size: 120, opacity: 0.10 },
    { id: 'aggron', x: w / 2 - 55, y: h * 0.12, size: 110, opacity: 0.09 },
    { id: 'groudon', x: w - 110, y: h * 0.11, size: 120, opacity: 0.10 },
    { id: 'electivire', x: -10, y: h * 0.24, size: 110, opacity: 0.09 },
    { id: 'heracross', x: w / 2 - 50, y: h * 0.25, size: 100, opacity: 0.09 },
    { id: 'roserade', x: w - 100, y: h * 0.24, size: 100, opacity: 0.08 },
    { id: 'rhyperior', x: -15, y: h * 0.37, size: 120, opacity: 0.10 },
    { id: 'metagross', x: w / 2 - 55, y: h * 0.38, size: 110, opacity: 0.09 },
    { id: 'magmortar', x: w - 110, y: h * 0.37, size: 110, opacity: 0.10 },
    { id: 'cinderace', x: -10, y: h * 0.50, size: 110, opacity: 0.10 },
    { id: 'registeel', x: w / 2 - 50, y: h * 0.51, size: 100, opacity: 0.09 },
    { id: 'empoleon', x: w - 110, y: h * 0.50, size: 110, opacity: 0.09 },
    { id: 'dragonite', x: -15, y: h * 0.63, size: 120, opacity: 0.10 },
    { id: 'gliscor', x: w / 2 - 50, y: h * 0.64, size: 100, opacity: 0.09 },
    { id: 'tyrantrum', x: w - 120, y: h * 0.63, size: 120, opacity: 0.11 },
    { id: 'gengar', x: -10, y: h * 0.76, size: 120, opacity: 0.11 },
    { id: 'baxcalibur', x: w / 2 - 55, y: h * 0.77, size: 110, opacity: 0.09 },
    { id: 'glalie', x: w - 100, y: h * 0.76, size: 100, opacity: 0.08 },
  ];
}

function PokeballLogo({ size = 100 }: { size?: number }) {
  const half = size / 2;
  const bandH = size * 0.09;
  const outerR = size * 0.16;
  const midR = size * 0.13;
  const innerR = size * 0.10;
  return (
    <View style={[logoStyles.container, { width: size, height: size, borderRadius: half, borderWidth: Math.max(3, size * 0.04) }]}>
      <View style={logoStyles.topHalf} />
      <View style={logoStyles.bottomHalf} />
      <View style={[logoStyles.centerBand, { top: half - bandH / 2, height: bandH }]}>
        <View style={[logoStyles.buttonOuter, { width: outerR * 2, height: outerR * 2, borderRadius: outerR }]}>
          <View style={[logoStyles.buttonMid, { width: midR * 2, height: midR * 2, borderRadius: midR }]}>
            <View style={[logoStyles.buttonInner, { width: innerR * 2, height: innerR * 2, borderRadius: innerR }]} />
          </View>
        </View>
      </View>
    </View>
  );
}

type Screen = 'main' | 'cpu_setup' | 'online_setup' | 'stats' | 'campaign';

export function SetupScreen({ onStart, onPlayOnline, onStartGauntlet, onStartGymCareer }: Props) {
  const { width: screenW, height: screenH } = useWindowDimensions();
  const bgSprites = useMemo(() => makeBgSprites(screenW, screenH), [screenW, screenH]);
  const [screen, setScreen] = useState<Screen>('main');
  const [name, setName] = useState('');
  const [itemMode, setItemMode] = useState<'competitive' | 'casual'>('competitive');
  const [difficulty, setDifficulty] = useState<Difficulty>('normal');
  const [classicMode, setClassicMode] = useState(false);
  const [legendaryMode, setLegendaryMode] = useState(false);
  const [draftMode, setDraftMode] = useState(false);
  const [monotype, setMonotype] = useState<string | null>(null);
  const [draftTypeMode, setDraftTypeMode] = useState<DraftType>('snake');
  const [poolSize, setPoolSize] = useState<PoolSize>(21);
  const [megaMode, setMegaMode] = useState(false);
  const [moveSelection, setMoveSelection] = useState(false);

  useEffect(() => {
    let mounted = true;
    getProfile().then(async (profile) => {
      if (!mounted) return;
      if (profile.trainerName && profile.trainerName !== 'Player') {
        setName(profile.trainerName);
      } else {
        const oldName = await AsyncStorage.getItem(OLD_NAME_KEY);
        if (!mounted) return;
        if (oldName) {
          setName(oldName);
          await saveProfile({ trainerName: oldName });
          if (!mounted) return;
          await AsyncStorage.removeItem(OLD_NAME_KEY);
        }
      }
    });
    return () => { mounted = false; };
  }, []);

  const displayName = name.trim() || 'Player';

  // ---------- Stats Screen ----------
  if (screen === 'stats') {
    return <StatsScreen onBack={() => setScreen('main')} />;
  }

  // ---------- Campaign Screen ----------
  if (screen === 'campaign') {
    return (
      <CampaignScreen
        onBack={() => setScreen('main')}
        onStartGauntlet={() => onStartGauntlet?.(displayName)}
        onStartGymCareer={(save) => onStartGymCareer?.(displayName, save)}
      />
    );
  }

  // ---------- Main Menu ----------
  if (screen === 'main') {
    return (
      <View style={styles.container}>
        {bgSprites.map((s) => (
          <View
            key={s.id}
            style={[styles.bgSprite, { left: s.x, top: s.y, opacity: s.opacity }]}
            pointerEvents="none"
          >
            <PokemonSprite speciesId={s.id} facing="front" size={s.size} />
          </View>
        ))}

        <View style={styles.mainMenuInner}>
          <View style={styles.logoSection}>
            <PokeballLogo size={100} />
            <Text style={styles.subtitle}>Pokemon Battle Simulator</Text>
          </View>

          <View style={styles.menuButtons}>
            <TouchableOpacity
              style={styles.menuBtn}
              onPress={() => setScreen('cpu_setup')}
              activeOpacity={0.7}
            >
              <Text style={styles.menuBtnText}>PLAY NOW</Text>
              <Text style={styles.menuBtnSub}>vs CPU</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.menuBtn}
              onPress={() => setScreen('online_setup')}
              activeOpacity={0.7}
            >
              <Text style={styles.menuBtnText}>PLAY ONLINE</Text>
              <Text style={styles.menuBtnSub}>vs Player</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.menuBtn}
              onPress={() => setScreen('campaign')}
              activeOpacity={0.7}
            >
              <Text style={styles.menuBtnText}>CAMPAIGN</Text>
              <Text style={styles.menuBtnSub}>Gauntlet & Gym Career</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.menuBtn}
              onPress={() => setScreen('stats')}
              activeOpacity={0.7}
            >
              <Text style={styles.menuBtnText}>STATS</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  }

  // ---------- CPU Setup ----------
  if (screen === 'cpu_setup') {
    return (
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {bgSprites.map((s) => (
          <View
            key={s.id}
            style={[styles.bgSprite, { left: s.x, top: s.y, opacity: s.opacity * 0.5 }]}
            pointerEvents="none"
          >
            <PokemonSprite speciesId={s.id} facing="front" size={s.size} />
          </View>
        ))}

        <View style={styles.setupInner}>
          <TouchableOpacity onPress={() => setScreen('main')} style={styles.backBtn} activeOpacity={0.7}>
            <Text style={styles.backText}>{'< Back'}</Text>
          </TouchableOpacity>

          <Text style={styles.setupTitle}>VS CPU</Text>

          {/* Difficulty */}
          <View style={styles.sectionCompact}>
            <Text style={styles.label}>Difficulty</Text>
            <View style={styles.toggleRow}>
              {(['easy', 'normal', 'hard'] as Difficulty[]).map(d => (
                <TouchableOpacity
                  key={d}
                  style={[styles.toggleBtn, difficulty === d && styles.toggleBtnActive]}
                  onPress={() => setDifficulty(d)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.toggleText, difficulty === d && styles.toggleTextActive]}>
                    {d.charAt(0).toUpperCase() + d.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <MatchSettingsForm
            itemMode={itemMode} setItemMode={setItemMode}
            classicMode={classicMode} setClassicMode={setClassicMode}
            legendaryMode={legendaryMode} setLegendaryMode={setLegendaryMode}
            draftMode={draftMode} setDraftMode={setDraftMode}
            monotype={monotype} setMonotype={setMonotype}
            draftTypeMode={draftTypeMode} setDraftTypeMode={setDraftTypeMode}
            poolSize={poolSize} setPoolSize={setPoolSize}
            megaMode={megaMode} setMegaMode={setMegaMode}
            moveSelection={moveSelection} setMoveSelection={setMoveSelection}
            showPoolSize
            onDraftToggle={() => { setDraftMode(!draftMode); if (draftMode) { setMonotype(null); setDraftTypeMode('snake'); setPoolSize(21); } }}
          />

          <View style={{ flex: 1 }} />

          <TouchableOpacity
            style={styles.startBtn}
            onPress={() => {
              let mono = monotype;
              if (mono === 'random') {
                mono = MONOTYPE_TYPES[Math.floor(Math.random() * MONOTYPE_TYPES.length)];
              }
              onStart(displayName, itemMode, classicMode ? 4 : null, difficulty, legendaryMode, draftMode, mono || null, draftTypeMode, poolSize, megaMode, moveSelection);
            }}
            activeOpacity={0.7}
          >
            <Text style={styles.startBtnText}>START BATTLE</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    );
  }

  // ---------- Online Setup ----------
  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {bgSprites.map((s) => (
        <View
          key={s.id}
          style={[styles.bgSprite, { left: s.x, top: s.y, opacity: s.opacity * 0.5 }]}
          pointerEvents="none"
        >
          <PokemonSprite speciesId={s.id} facing="front" size={s.size} />
        </View>
      ))}

      <View style={styles.setupInner}>
        <TouchableOpacity onPress={() => setScreen('main')} style={styles.backBtn} activeOpacity={0.7}>
          <Text style={styles.backText}>{'< Back'}</Text>
        </TouchableOpacity>

        <Text style={styles.setupTitle}>PLAY ONLINE</Text>

        <MatchSettingsForm
          itemMode={itemMode} setItemMode={setItemMode}
          classicMode={classicMode} setClassicMode={setClassicMode}
          legendaryMode={legendaryMode} setLegendaryMode={setLegendaryMode}
          draftMode={draftMode} setDraftMode={setDraftMode}
          monotype={monotype} setMonotype={setMonotype}
          draftTypeMode={draftTypeMode} setDraftTypeMode={setDraftTypeMode}
          poolSize={poolSize} setPoolSize={setPoolSize}
          megaMode={megaMode} setMegaMode={setMegaMode}
          moveSelection={moveSelection} setMoveSelection={setMoveSelection}
          modifierLabel="Modifiers (Host Decides)"
          onDraftToggle={() => { setDraftMode(!draftMode); if (draftMode) setMonotype(null); }}
        />

        <View style={{ flex: 1 }} />

        <Text style={styles.onlineNote}>
          Host's settings apply to both players.
        </Text>

        <TouchableOpacity
          style={styles.startBtn}
          onPress={() => {
            let mono = monotype;
            if (mono === 'random') {
              mono = MONOTYPE_TYPES[Math.floor(Math.random() * MONOTYPE_TYPES.length)];
            }
            onPlayOnline(displayName, itemMode, classicMode ? 4 : null, legendaryMode, draftMode, mono || null, draftTypeMode, megaMode, moveSelection);
          }}
          activeOpacity={0.7}
        >
          <Text style={styles.startBtnText}>FIND MATCH</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const logoStyles = StyleSheet.create({
  container: {
    overflow: 'hidden',
    borderColor: '#1a1a1a',
    alignSelf: 'center',
    marginBottom: spacing.md,
  },
  topHalf: {
    flex: 1,
    backgroundColor: '#e94560',
  },
  bottomHalf: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  centerBand: {
    position: 'absolute',
    left: 0,
    right: 0,
    backgroundColor: '#1a1a1a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonOuter: {
    backgroundColor: '#1a1a1a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonMid: {
    backgroundColor: '#333',
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonInner: {
    backgroundColor: '#f5f5f5',
    borderWidth: 2,
    borderColor: '#ccc',
  },
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  bgSprite: {
    position: 'absolute',
    zIndex: 0,
  },
  mainMenuInner: {
    flex: 1,
    justifyContent: 'center',
    padding: spacing.xl,
    zIndex: 1,
  },
  menuButtons: {
    gap: spacing.md,
  },
  menuBtn: {
    backgroundColor: colors.surface,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  menuBtnText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 2,
  },
  menuBtnSub: {
    color: colors.textDim,
    fontSize: 11,
    marginTop: 2,
    fontWeight: '600',
  },
  setupInner: {
    flex: 1,
    padding: spacing.xl,
    paddingTop: spacing.xl * 1.5,
    zIndex: 1,
  },
  logoSection: {
    alignItems: 'center',
    marginBottom: spacing.xl * 2,
  },
  subtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.xs,
    letterSpacing: 1,
  },
  sectionCompact: {
    marginBottom: spacing.md,
  },
  label: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '600',
    marginBottom: spacing.sm,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  toggleRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  toggleBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  toggleBtnActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  toggleText: {
    color: colors.textSecondary,
    fontSize: 14,
    fontWeight: '600',
  },
  toggleTextActive: {
    color: '#fff',
  },
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  pill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pillActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  pillText: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '600',
  },
  pillTextActive: {
    color: '#fff',
  },
  modifierDesc: {
    color: colors.textDim,
    fontSize: 11,
    marginTop: spacing.sm,
  },
  typeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
  },
  typeChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    opacity: 0.7,
  },
  typeChipSelected: {
    opacity: 1,
    borderWidth: 2,
    borderColor: '#fff',
  },
  typeChipText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
  typeChipTextSelected: {
    fontWeight: '900',
  },
  backBtn: {
    marginBottom: spacing.lg,
  },
  backText: {
    color: colors.accent,
    fontSize: 16,
    fontWeight: '700',
  },
  setupTitle: {
    fontSize: 28,
    fontWeight: '900',
    color: colors.accent,
    letterSpacing: 3,
    marginBottom: spacing.xs,
  },
  startBtn: {
    backgroundColor: colors.accent,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: spacing.lg,
    shadowColor: colors.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  startBtnText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: 2,
  },
  onlineNote: {
    color: colors.textDim,
    fontSize: 12,
    textAlign: 'center',
    marginTop: spacing.sm,
    lineHeight: 18,
  },
});
