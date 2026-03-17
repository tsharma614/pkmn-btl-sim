import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Dimensions,
  ScrollView,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getWinLoss } from '../utils/battle-history';
import { PokemonSprite } from './PokemonSprite';
import { colors, spacing, typeColors } from '../theme';
import { MONOTYPE_TYPES, POOL_SIZES } from '../../engine/draft-pool';
import type { PoolSize, DraftType } from '../../engine/draft-pool';
import { StatsScreen } from './StatsScreen';

const NAME_KEY = '@pbs_trainer_name';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

export type Difficulty = 'easy' | 'normal' | 'hard';

interface Props {
  onStart: (playerName: string, itemMode: 'competitive' | 'casual', maxGen?: number | null, difficulty?: Difficulty, legendaryMode?: boolean, draftMode?: boolean, monotype?: string | null, draftType?: DraftType, poolSize?: number, megaMode?: boolean, moveSelection?: boolean) => void;
  onPlayOnline: (playerName: string, itemMode: 'competitive' | 'casual', maxGen?: number | null, legendaryMode?: boolean, draftMode?: boolean, monotype?: string | null, draftType?: DraftType, megaMode?: boolean, moveSelection?: boolean) => void;
  onStartEliteFour?: (playerName: string) => void;
}

/** Background sprite positions — 7 rows of 3, filling the whole screen */
const BG_SPRITES: { id: string; x: number; y: number; size: number; opacity: number }[] = [
  // Row 1 (top)
  { id: 'mewtwo', x: -10, y: -10, size: 130, opacity: 0.12 },
  { id: 'ceruledge', x: SCREEN_W / 2 - 55, y: 10, size: 110, opacity: 0.10 },
  { id: 'garchomp', x: SCREEN_W - 120, y: -5, size: 120, opacity: 0.11 },
  // Row 2
  { id: 'kyogre', x: -20, y: SCREEN_H * 0.11, size: 120, opacity: 0.10 },
  { id: 'aggron', x: SCREEN_W / 2 - 55, y: SCREEN_H * 0.12, size: 110, opacity: 0.09 },
  { id: 'groudon', x: SCREEN_W - 110, y: SCREEN_H * 0.11, size: 120, opacity: 0.10 },
  // Row 3
  { id: 'electivire', x: -10, y: SCREEN_H * 0.24, size: 110, opacity: 0.09 },
  { id: 'heracross', x: SCREEN_W / 2 - 50, y: SCREEN_H * 0.25, size: 100, opacity: 0.09 },
  { id: 'roserade', x: SCREEN_W - 100, y: SCREEN_H * 0.24, size: 100, opacity: 0.08 },
  // Row 4
  { id: 'rhyperior', x: -15, y: SCREEN_H * 0.37, size: 120, opacity: 0.10 },
  { id: 'metagross', x: SCREEN_W / 2 - 55, y: SCREEN_H * 0.38, size: 110, opacity: 0.09 },
  { id: 'magmortar', x: SCREEN_W - 110, y: SCREEN_H * 0.37, size: 110, opacity: 0.10 },
  // Row 5
  { id: 'cinderace', x: -10, y: SCREEN_H * 0.50, size: 110, opacity: 0.10 },
  { id: 'registeel', x: SCREEN_W / 2 - 50, y: SCREEN_H * 0.51, size: 100, opacity: 0.09 },
  { id: 'empoleon', x: SCREEN_W - 110, y: SCREEN_H * 0.50, size: 110, opacity: 0.09 },
  // Row 6
  { id: 'dragonite', x: -15, y: SCREEN_H * 0.63, size: 120, opacity: 0.10 },
  { id: 'gliscor', x: SCREEN_W / 2 - 50, y: SCREEN_H * 0.64, size: 100, opacity: 0.09 },
  { id: 'tyrantrum', x: SCREEN_W - 120, y: SCREEN_H * 0.63, size: 120, opacity: 0.11 },
  // Row 7 (bottom)
  { id: 'gengar', x: -10, y: SCREEN_H * 0.76, size: 120, opacity: 0.11 },
  { id: 'baxcalibur', x: SCREEN_W / 2 - 55, y: SCREEN_H * 0.77, size: 110, opacity: 0.09 },
  { id: 'glalie', x: SCREEN_W - 100, y: SCREEN_H * 0.76, size: 100, opacity: 0.08 },
];

function PokeballLogo() {
  return (
    <View style={logoStyles.container}>
      {/* Top half — red */}
      <View style={logoStyles.topHalf} />
      {/* Bottom half — white */}
      <View style={logoStyles.bottomHalf} />
      {/* Center band — black */}
      <View style={logoStyles.centerBand}>
        {/* Center button */}
        <View style={logoStyles.buttonOuter}>
          <View style={logoStyles.buttonInner} />
        </View>
      </View>
    </View>
  );
}

type Screen = 'main' | 'cpu_setup' | 'online_setup' | 'stats';

export function SetupScreen({ onStart, onPlayOnline, onStartEliteFour }: Props) {
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
  const [record, setRecord] = useState<{ wins: number; losses: number } | null>(null);

  useEffect(() => {
    getWinLoss().then(setRecord);
    AsyncStorage.getItem(NAME_KEY).then(saved => {
      if (saved) setName(saved);
    });
  }, []);

  const handleNameChange = (text: string) => {
    setName(text);
    AsyncStorage.setItem(NAME_KEY, text);
  };

  const displayName = name.trim() || 'Player';

  // ---------- Stats Screen ----------
  if (screen === 'stats') {
    return <StatsScreen onBack={() => setScreen('main')} onStartEliteFour={onStartEliteFour ? () => onStartEliteFour(displayName) : undefined} />;
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
            <PokeballLogo />
            <Text style={styles.title}>PBS</Text>
            <Text style={styles.subtitle}>Pokemon Battle Simulator</Text>
            {record && (record.wins > 0 || record.losses > 0) && (
              <Text style={styles.recordText}>Record: {record.wins}W - {record.losses}L</Text>
            )}
          </View>

          {/* Name input */}
          <View style={styles.section}>
            <Text style={styles.label}>Trainer Name</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={handleNameChange}
              placeholder="Player"
              placeholderTextColor={colors.textDim}
              maxLength={16}
              autoCapitalize="words"
              autoCorrect={false}
            />
          </View>

          <TouchableOpacity
            style={styles.playNowBtn}
            onPress={() => setScreen('cpu_setup')}
            activeOpacity={0.7}
          >
            <Text style={styles.playNowText}>PLAY NOW</Text>
            <Text style={styles.btnSubtext}>vs CPU</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.playOnlineBtn}
            onPress={() => setScreen('online_setup')}
            activeOpacity={0.7}
          >
            <Text style={styles.playOnlineText}>PLAY ONLINE</Text>
            <Text style={styles.btnSubtext}>vs Player</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.statsBtn}
            onPress={() => setScreen('stats')}
            activeOpacity={0.7}
          >
            <Text style={styles.statsText}>STATS & BADGES</Text>
          </TouchableOpacity>
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

const LOGO_SIZE = 60;

const logoStyles = StyleSheet.create({
  container: {
    width: LOGO_SIZE,
    height: LOGO_SIZE,
    borderRadius: LOGO_SIZE / 2,
    overflow: 'hidden',
    borderWidth: 3,
    borderColor: '#222',
    alignSelf: 'center',
    marginBottom: spacing.sm,
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
    top: LOGO_SIZE / 2 - 5,
    left: 0,
    right: 0,
    height: 10,
    backgroundColor: '#222',
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonOuter: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#222',
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#f5f5f5',
    borderWidth: 2,
    borderColor: '#444',
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
  setupInner: {
    flex: 1,
    padding: spacing.xl,
    paddingTop: spacing.xl * 1.5,
    zIndex: 1,
  },
  logoSection: {
    alignItems: 'center',
    marginBottom: spacing.xl * 1.5,
  },
  title: {
    fontSize: 48,
    fontWeight: '900',
    color: colors.accent,
    textAlign: 'center',
    letterSpacing: 6,
  },
  subtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.xs,
    letterSpacing: 1,
  },
  recordText: {
    fontSize: 14,
    color: colors.accent,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  section: {
    marginBottom: spacing.xl,
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
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: spacing.lg,
    paddingVertical: 14,
    color: colors.text,
    fontSize: 16,
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
  modeDesc: {
    color: colors.textDim,
    fontSize: 11,
    marginTop: spacing.sm,
    lineHeight: 16,
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
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
    paddingVertical: spacing.xs,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.sm,
  },
  checkboxChecked: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  checkmark: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '900',
    marginTop: -1,
  },
  checkboxTextWrap: {
    flex: 1,
  },
  checkboxLabel: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  checkboxDesc: {
    color: colors.textDim,
    fontSize: 11,
    marginTop: 1,
  },
  monotypeSection: {
    marginLeft: spacing.md,
    marginTop: spacing.xs,
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
  playNowBtn: {
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
  playNowText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: 2,
  },
  playOnlineBtn: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: spacing.md,
    borderWidth: 2,
    borderColor: colors.accent,
    backgroundColor: 'transparent',
  },
  playOnlineText: {
    color: colors.accent,
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 2,
  },
  statsBtn: {
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: spacing.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  statsText: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 1,
  },
  btnSubtext: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 11,
    marginTop: 2,
    fontWeight: '600',
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
  setupSubtitle: {
    fontSize: 13,
    color: colors.textSecondary,
    marginBottom: spacing.xl,
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
