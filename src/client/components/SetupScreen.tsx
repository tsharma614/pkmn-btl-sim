import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Dimensions,
} from 'react-native';
import { PokemonSprite } from './PokemonSprite';
import { colors, spacing } from '../theme';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

interface Props {
  onStart: (playerName: string, itemMode: 'competitive' | 'casual') => void;
  onPlayOnline: (playerName: string, itemMode: 'competitive' | 'casual') => void;
}

/** Background sprite positions — 7 rows of 3, filling the whole screen */
const BG_SPRITES: { id: string; x: number; y: number; size: number; opacity: number }[] = [
  // Row 1 (top)
  { id: 'mewtwo', x: -10, y: 20, size: 130, opacity: 0.12 },
  { id: 'ceruledge', x: SCREEN_W / 2 - 55, y: 40, size: 110, opacity: 0.10 },
  { id: 'garchomp', x: SCREEN_W - 120, y: 25, size: 120, opacity: 0.11 },
  // Row 2
  { id: 'kyogre', x: -20, y: SCREEN_H * 0.15, size: 120, opacity: 0.10 },
  { id: 'aggron', x: SCREEN_W / 2 - 55, y: SCREEN_H * 0.16, size: 110, opacity: 0.09 },
  { id: 'groudon', x: SCREEN_W - 110, y: SCREEN_H * 0.15, size: 120, opacity: 0.10 },
  // Row 3
  { id: 'electivire', x: -10, y: SCREEN_H * 0.29, size: 110, opacity: 0.09 },
  { id: 'heracross', x: SCREEN_W / 2 - 50, y: SCREEN_H * 0.30, size: 100, opacity: 0.09 },
  { id: 'roserade', x: SCREEN_W - 100, y: SCREEN_H * 0.29, size: 100, opacity: 0.08 },
  // Row 4
  { id: 'rhyperior', x: -15, y: SCREEN_H * 0.43, size: 120, opacity: 0.10 },
  { id: 'metagross', x: SCREEN_W / 2 - 55, y: SCREEN_H * 0.44, size: 110, opacity: 0.09 },
  { id: 'magmortar', x: SCREEN_W - 110, y: SCREEN_H * 0.43, size: 110, opacity: 0.10 },
  // Row 5
  { id: 'cinderace', x: -10, y: SCREEN_H * 0.57, size: 110, opacity: 0.10 },
  { id: 'registeel', x: SCREEN_W / 2 - 50, y: SCREEN_H * 0.58, size: 100, opacity: 0.09 },
  { id: 'empoleon', x: SCREEN_W - 110, y: SCREEN_H * 0.57, size: 110, opacity: 0.09 },
  // Row 6
  { id: 'dragonite', x: -15, y: SCREEN_H * 0.71, size: 120, opacity: 0.10 },
  { id: 'gliscor', x: SCREEN_W / 2 - 50, y: SCREEN_H * 0.72, size: 100, opacity: 0.09 },
  { id: 'tyrantrum', x: SCREEN_W - 120, y: SCREEN_H * 0.71, size: 120, opacity: 0.11 },
  // Row 7 (bottom)
  { id: 'gengar', x: -10, y: SCREEN_H * 0.85, size: 120, opacity: 0.11 },
  { id: 'baxcalibur', x: SCREEN_W / 2 - 55, y: SCREEN_H * 0.86, size: 110, opacity: 0.09 },
  { id: 'glalie', x: SCREEN_W - 100, y: SCREEN_H * 0.85, size: 100, opacity: 0.08 },
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

export function SetupScreen({ onStart, onPlayOnline }: Props) {
  const [name, setName] = useState('');
  const [itemMode, setItemMode] = useState<'competitive' | 'casual'>('competitive');

  const displayName = name.trim() || 'Player';

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Background sprites */}
      {BG_SPRITES.map((s) => (
        <View
          key={s.id}
          style={[styles.bgSprite, { left: s.x, top: s.y, opacity: s.opacity }]}
          pointerEvents="none"
        >
          <PokemonSprite speciesId={s.id} facing="front" size={s.size} />
        </View>
      ))}

      <View style={styles.inner}>
        {/* Logo */}
        <View style={styles.logoSection}>
          <PokeballLogo />
          <Text style={styles.title}>PBS</Text>
          <Text style={styles.subtitle}>Pokemon Battle Simulator</Text>
        </View>

        {/* Name input */}
        <View style={styles.section}>
          <Text style={styles.label}>Trainer Name</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="Player"
            placeholderTextColor={colors.textDim}
            maxLength={16}
            autoCapitalize="words"
            autoCorrect={false}
          />
        </View>

        {/* Item mode toggle */}
        <View style={styles.section}>
          <Text style={styles.label}>Item Mode</Text>
          <View style={styles.toggleRow}>
            <TouchableOpacity
              style={[
                styles.toggleBtn,
                itemMode === 'competitive' && styles.toggleBtnActive,
              ]}
              onPress={() => setItemMode('competitive')}
              activeOpacity={0.7}
            >
              <Text style={[
                styles.toggleText,
                itemMode === 'competitive' && styles.toggleTextActive,
              ]}>
                Competitive
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.toggleBtn,
                itemMode === 'casual' && styles.toggleBtnActive,
              ]}
              onPress={() => setItemMode('casual')}
              activeOpacity={0.7}
            >
              <Text style={[
                styles.toggleText,
                itemMode === 'casual' && styles.toggleTextActive,
              ]}>
                Casual
              </Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.modeDesc}>
            {itemMode === 'competitive'
              ? 'Choice items lock you into one move. Full competitive rules.'
              : 'Choice Band/Specs become Life Orb, Choice Scarf becomes Leftovers. More forgiving.'}
          </Text>
        </View>

        {/* Buttons */}
        <TouchableOpacity
          style={styles.playNowBtn}
          onPress={() => onStart(displayName, itemMode)}
          activeOpacity={0.7}
        >
          <Text style={styles.playNowText}>PLAY NOW</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.playOnlineBtn}
          onPress={() => onPlayOnline(displayName, itemMode)}
          activeOpacity={0.7}
        >
          <Text style={styles.playOnlineText}>PLAY ONLINE</Text>
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
  inner: {
    flex: 1,
    justifyContent: 'center',
    padding: spacing.xl,
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
  section: {
    marginBottom: spacing.xl,
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
});
