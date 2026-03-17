import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Dimensions,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { PokemonSprite } from './PokemonSprite';
import { colors, spacing, typeColors } from '../theme';
import { MONOTYPE_TYPES, POOL_SIZES } from '../../engine/draft-pool';
import type { PoolSize, DraftType } from '../../engine/draft-pool';
import { StatsScreen } from './StatsScreen';
import { CampaignScreen } from './CampaignScreen';
import type { GymCareerSave } from './CampaignScreen';

const NAME_KEY = '@pbs_trainer_name';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

export type Difficulty = 'easy' | 'normal' | 'hard';

interface Props {
  onStart: (playerName: string, itemMode: 'competitive' | 'casual', maxGen?: number | null, difficulty?: Difficulty, legendaryMode?: boolean, draftMode?: boolean, monotype?: string | null, draftType?: DraftType, poolSize?: number, megaMode?: boolean, moveSelection?: boolean) => void;
  onPlayOnline: (playerName: string, itemMode: 'competitive' | 'casual', maxGen?: number | null, legendaryMode?: boolean, draftMode?: boolean, monotype?: string | null, draftType?: DraftType, megaMode?: boolean, moveSelection?: boolean) => void;
  onStartEliteFour?: (playerName: string) => void;
  onStartGauntlet?: (playerName: string) => void;
  onStartGymCareer?: (playerName: string) => void;
}

/** Background sprite positions — fewer, cleaner layout */
const BG_SPRITES: { id: string; x: number; y: number; size: number; opacity: number }[] = [
  // Row 1
  { id: 'mewtwo', x: -10, y: -10, size: 130, opacity: 0.08 },
  { id: 'garchomp', x: SCREEN_W - 120, y: 5, size: 120, opacity: 0.07 },
  // Row 2
  { id: 'kyogre', x: -20, y: SCREEN_H * 0.15, size: 120, opacity: 0.07 },
  { id: 'groudon', x: SCREEN_W - 110, y: SCREEN_H * 0.16, size: 120, opacity: 0.07 },
  // Row 3
  { id: 'dragonite', x: -15, y: SCREEN_H * 0.35, size: 120, opacity: 0.07 },
  { id: 'metagross', x: SCREEN_W - 110, y: SCREEN_H * 0.36, size: 110, opacity: 0.06 },
  // Row 4
  { id: 'gengar', x: -10, y: SCREEN_H * 0.55, size: 120, opacity: 0.07 },
  { id: 'tyrantrum', x: SCREEN_W - 120, y: SCREEN_H * 0.56, size: 120, opacity: 0.07 },
  // Row 5
  { id: 'cinderace', x: -10, y: SCREEN_H * 0.75, size: 110, opacity: 0.07 },
  { id: 'empoleon', x: SCREEN_W - 110, y: SCREEN_H * 0.76, size: 110, opacity: 0.06 },
];

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

export function SetupScreen({ onStart, onPlayOnline, onStartEliteFour, onStartGauntlet, onStartGymCareer }: Props) {
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
    AsyncStorage.getItem(NAME_KEY).then(saved => {
      if (saved) setName(saved);
    });
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
        onStartGymCareer={() => onStartGymCareer?.(displayName)}
      />
    );
  }

  // ---------- Main Menu ----------
  if (screen === 'main') {
    return (
      <View style={styles.container}>
        {BG_SPRITES.map((s) => (
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
        {BG_SPRITES.map((s) => (
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

          {/* Items */}
          <View style={styles.sectionCompact}>
            <Text style={styles.label}>Items</Text>
            <View style={styles.toggleRow}>
              <TouchableOpacity
                style={[styles.toggleBtn, itemMode === 'competitive' && styles.toggleBtnActive]}
                onPress={() => setItemMode('competitive')}
                activeOpacity={0.7}
              >
                <Text style={[styles.toggleText, itemMode === 'competitive' && styles.toggleTextActive]}>Competitive</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.toggleBtn, itemMode === 'casual' && styles.toggleBtnActive]}
                onPress={() => setItemMode('casual')}
                activeOpacity={0.7}
              >
                <Text style={[styles.toggleText, itemMode === 'casual' && styles.toggleTextActive]}>Casual</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Modifiers — compact pill toggles */}
          <View style={styles.sectionCompact}>
            <Text style={styles.label}>Modifiers</Text>
            <View style={styles.pillRow}>
              <TouchableOpacity
                style={[styles.pill, classicMode && styles.pillActive]}
                onPress={() => setClassicMode(!classicMode)}
                activeOpacity={0.7}
              >
                <Text style={[styles.pillText, classicMode && styles.pillTextActive]}>Classic</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.pill, legendaryMode && styles.pillActive]}
                onPress={() => setLegendaryMode(!legendaryMode)}
                activeOpacity={0.7}
              >
                <Text style={[styles.pillText, legendaryMode && styles.pillTextActive]}>Legendary</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.pill, draftMode && styles.pillActive]}
                onPress={() => { setDraftMode(!draftMode); if (draftMode) { setMonotype(null); setDraftTypeMode('snake'); setPoolSize(21); } }}
                activeOpacity={0.7}
              >
                <Text style={[styles.pillText, draftMode && styles.pillTextActive]}>Draft</Text>
              </TouchableOpacity>
              {draftMode && (
                <TouchableOpacity
                  style={[styles.pill, !!monotype && styles.pillActive]}
                  onPress={() => { setMonotype(monotype ? null : 'random'); if (!monotype) setDraftTypeMode('snake'); }}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.pillText, !!monotype && styles.pillTextActive]}>Monotype</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={[styles.pill, megaMode && styles.pillActive]}
                onPress={() => setMegaMode(!megaMode)}
                activeOpacity={0.7}
              >
                <Text style={[styles.pillText, megaMode && styles.pillTextActive]}>Mega</Text>
              </TouchableOpacity>
              {draftMode && (
                <TouchableOpacity
                  style={[styles.pill, moveSelection && styles.pillActive]}
                  onPress={() => setMoveSelection(!moveSelection)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.pillText, moveSelection && styles.pillTextActive]}>Pick Moves</Text>
                </TouchableOpacity>
              )}
            </View>
            {/* Active modifier descriptions — one-liners */}
            {(classicMode || legendaryMode || draftMode || megaMode) && (
              <Text style={styles.modifierDesc}>
                {[
                  classicMode && 'Gen 1–4 only',
                  legendaryMode && 'T1 & T2 Pokemon',
                  draftMode && (draftTypeMode === 'role' ? 'Role draft from shared pool' : 'Snake draft from shared pool'),
                  draftMode && poolSize !== 21 && `${poolSize} Pokemon pool`,
                  monotype && (monotype === 'random' ? 'Random type' : monotype + ' type'),
                  megaMode && (draftMode ? 'Mega evolutions in draft pool' : '~25% chance of a mega on each team'),
                  moveSelection && 'Choose your moves after draft',
                  null,
                ].filter(Boolean).join(' · ')}
              </Text>
            )}
          </View>

          {/* Draft type + pool size (only when draft mode is on) */}
          {draftMode && (
            <View style={styles.sectionCompact}>
              <Text style={styles.label}>Draft Options</Text>
              <View style={styles.toggleRow}>
                <TouchableOpacity
                  style={[styles.toggleBtn, draftTypeMode === 'snake' && styles.toggleBtnActive]}
                  onPress={() => setDraftTypeMode('snake')}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.toggleText, draftTypeMode === 'snake' && styles.toggleTextActive]}>Snake</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.toggleBtn, draftTypeMode === 'role' && styles.toggleBtnActive, !!monotype && { opacity: 0.4 }]}
                  onPress={() => !monotype && setDraftTypeMode('role')}
                  activeOpacity={0.7}
                  disabled={!!monotype}
                >
                  <Text style={[styles.toggleText, draftTypeMode === 'role' && styles.toggleTextActive]}>Role</Text>
                </TouchableOpacity>
              </View>
              {draftTypeMode === 'snake' && (
                <>
                  <View style={[styles.toggleRow, { marginTop: spacing.sm }]}>
                    {POOL_SIZES.map(size => (
                      <TouchableOpacity
                        key={size}
                        style={[styles.toggleBtn, poolSize === size && styles.toggleBtnActive]}
                        onPress={() => setPoolSize(size)}
                        activeOpacity={0.7}
                      >
                        <Text style={[styles.toggleText, poolSize === size && styles.toggleTextActive]}>{size}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  <Text style={styles.modifierDesc}>Pool size: {poolSize} Pokemon</Text>
                </>
              )}
              {draftTypeMode === 'role' && (
                <Text style={styles.modifierDesc}>Pick one from each role: Sweepers, Walls, Support, Mega</Text>
              )}
            </View>
          )}

          {/* Monotype type picker */}
          {draftMode && monotype && (
            <View style={styles.sectionCompact}>
              <View style={styles.typeGrid}>
                <TouchableOpacity
                  style={[styles.typeChip, { backgroundColor: colors.surfaceLight }, monotype === 'random' && styles.typeChipSelected]}
                  onPress={() => setMonotype('random')}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.typeChipText, monotype === 'random' && styles.typeChipTextSelected]}>Random</Text>
                </TouchableOpacity>
                {MONOTYPE_TYPES.map(t => (
                    <TouchableOpacity
                      key={t}
                      style={[
                        styles.typeChip,
                        { backgroundColor: typeColors[t] || '#666' },
                        monotype === t && styles.typeChipSelected,
                      ]}
                      onPress={() => setMonotype(t)}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.typeChipText, monotype === t && styles.typeChipTextSelected]}>
                        {t}
                      </Text>
                    </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

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
      {BG_SPRITES.map((s) => (
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

        {/* Items */}
        <View style={styles.sectionCompact}>
          <Text style={styles.label}>Items</Text>
          <View style={styles.toggleRow}>
            <TouchableOpacity
              style={[styles.toggleBtn, itemMode === 'competitive' && styles.toggleBtnActive]}
              onPress={() => setItemMode('competitive')}
              activeOpacity={0.7}
            >
              <Text style={[styles.toggleText, itemMode === 'competitive' && styles.toggleTextActive]}>Competitive</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.toggleBtn, itemMode === 'casual' && styles.toggleBtnActive]}
              onPress={() => setItemMode('casual')}
              activeOpacity={0.7}
            >
              <Text style={[styles.toggleText, itemMode === 'casual' && styles.toggleTextActive]}>Casual</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Modifiers */}
        <View style={styles.sectionCompact}>
          <Text style={styles.label}>Modifiers (Host Decides)</Text>
          <View style={styles.pillRow}>
            <TouchableOpacity
              style={[styles.pill, classicMode && styles.pillActive]}
              onPress={() => setClassicMode(!classicMode)}
              activeOpacity={0.7}
            >
              <Text style={[styles.pillText, classicMode && styles.pillTextActive]}>Classic</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.pill, legendaryMode && styles.pillActive]}
              onPress={() => setLegendaryMode(!legendaryMode)}
              activeOpacity={0.7}
            >
              <Text style={[styles.pillText, legendaryMode && styles.pillTextActive]}>Legendary</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.pill, draftMode && styles.pillActive]}
              onPress={() => { setDraftMode(!draftMode); if (draftMode) setMonotype(null); }}
              activeOpacity={0.7}
            >
              <Text style={[styles.pillText, draftMode && styles.pillTextActive]}>Draft</Text>
            </TouchableOpacity>
            {draftMode && (
              <TouchableOpacity
                style={[styles.pill, !!monotype && styles.pillActive]}
                onPress={() => { setMonotype(monotype ? null : 'random'); if (!monotype) setDraftTypeMode('snake'); }}
                activeOpacity={0.7}
              >
                <Text style={[styles.pillText, !!monotype && styles.pillTextActive]}>Monotype</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={[styles.pill, megaMode && styles.pillActive]}
              onPress={() => setMegaMode(!megaMode)}
              activeOpacity={0.7}
            >
              <Text style={[styles.pillText, megaMode && styles.pillTextActive]}>Mega</Text>
            </TouchableOpacity>
            {draftMode && (
              <TouchableOpacity
                style={[styles.pill, moveSelection && styles.pillActive]}
                onPress={() => setMoveSelection(!moveSelection)}
                activeOpacity={0.7}
              >
                <Text style={[styles.pillText, moveSelection && styles.pillTextActive]}>Pick Moves</Text>
              </TouchableOpacity>
            )}
          </View>
          {(classicMode || legendaryMode || draftMode || megaMode) && (
            <Text style={styles.modifierDesc}>
              {[
                classicMode && 'Gen 1–4 only',
                legendaryMode && 'T1 & T2 Pokemon',
                draftMode && (draftTypeMode === 'role' ? 'Role draft from shared pool' : 'Snake draft from shared pool'),
                monotype && (monotype === 'random' ? 'Random type' : monotype + ' type'),
                megaMode && (draftMode ? 'Mega evolutions in draft pool' : '~25% chance of a mega on each team'),
                moveSelection && 'Choose your moves after draft',
              ].filter(Boolean).join(' · ')}
            </Text>
          )}
        </View>

        {/* Draft type toggle for online */}
        {draftMode && (
          <View style={styles.sectionCompact}>
            <Text style={styles.label}>Draft Options</Text>
            <View style={styles.toggleRow}>
              <TouchableOpacity
                style={[styles.toggleBtn, draftTypeMode === 'snake' && styles.toggleBtnActive]}
                onPress={() => setDraftTypeMode('snake')}
                activeOpacity={0.7}
              >
                <Text style={[styles.toggleText, draftTypeMode === 'snake' && styles.toggleTextActive]}>Snake</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.toggleBtn, draftTypeMode === 'role' && styles.toggleBtnActive, !!monotype && { opacity: 0.4 }]}
                onPress={() => !monotype && setDraftTypeMode('role')}
                activeOpacity={0.7}
                disabled={!!monotype}
              >
                <Text style={[styles.toggleText, draftTypeMode === 'role' && styles.toggleTextActive]}>Role</Text>
              </TouchableOpacity>
            </View>
            {draftTypeMode === 'role' && (
              <Text style={styles.modifierDesc}>Pick one from each role: Sweepers, Walls, Support, Mega</Text>
            )}
          </View>
        )}

        {/* Monotype type picker for online */}
        {draftMode && monotype && (
          <View style={styles.sectionCompact}>
            <View style={styles.typeGrid}>
              <TouchableOpacity
                style={[styles.typeChip, { backgroundColor: colors.surfaceLight }, monotype === 'random' && styles.typeChipSelected]}
                onPress={() => setMonotype('random')}
                activeOpacity={0.7}
              >
                <Text style={[styles.typeChipText, monotype === 'random' && styles.typeChipTextSelected]}>Random</Text>
              </TouchableOpacity>
              {MONOTYPE_TYPES.map(t => (
                <TouchableOpacity
                  key={t}
                  style={[
                    styles.typeChip,
                    { backgroundColor: typeColors[t] || '#666' },
                    monotype === t && styles.typeChipSelected,
                  ]}
                  onPress={() => setMonotype(t)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.typeChipText, monotype === t && styles.typeChipTextSelected]}>{t}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

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
