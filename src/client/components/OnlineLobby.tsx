import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Share,
  Platform,
} from 'react-native';
import { colors, spacing } from '../theme';

interface Props {
  /** Room code if we created a room (null = show create/join choice) */
  roomCode: string | null;
  /** Opponent name once they've joined */
  opponentName: string | null;
  playerName: string;
  itemMode: 'competitive' | 'casual';
  maxGen?: number | null;
  legendaryMode?: boolean;
  /** Room options from server (shown to joining player) */
  roomOptions?: { maxGen: number | null; legendaryMode: boolean } | null;
  onCreateRoom: (playerName: string, itemMode: 'competitive' | 'casual', maxGen?: number | null, legendaryMode?: boolean) => void;
  onJoinRoom: (playerName: string, itemMode: 'competitive' | 'casual', code: string) => void;
  onCancel: () => void;
}

export function OnlineLobby({ roomCode, opponentName, playerName, itemMode, maxGen, legendaryMode, roomOptions, onCreateRoom, onJoinRoom, onCancel }: Props) {
  const [mode, setMode] = useState<'choice' | 'create' | 'join'>(roomCode ? 'create' : 'choice');
  const [joinCode, setJoinCode] = useState('');
  const [joinError, setJoinError] = useState<string | null>(null);

  // If we have a room code, we're in create mode waiting for opponent
  if (roomCode && mode !== 'join') {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>
          {opponentName ? `${opponentName} joined!` : 'Waiting for opponent...'}
        </Text>

        <View style={styles.codeBox}>
          <Text style={styles.codeLabel}>ROOM CODE</Text>
          <Text style={styles.code}>{roomCode}</Text>
        </View>

        {/* Show room settings */}
        {(maxGen || legendaryMode) && (
          <View style={styles.settingsTags}>
            {maxGen && maxGen <= 4 && <Text style={styles.settingsTag}>Classic Mode</Text>}
            {legendaryMode && <Text style={styles.settingsTag}>Legendary Team</Text>}
          </View>
        )}

        {!opponentName && (
          <>
            <ActivityIndicator size="large" color={colors.accent} style={{ marginTop: spacing.xl }} />
            <Text style={styles.hint}>Share this code with your opponent</Text>

            <TouchableOpacity
              style={styles.shareBtn}
              onPress={() => {
                Share.share({
                  message: `Join my PBS battle! Room code: ${roomCode}`,
                });
              }}
              activeOpacity={0.7}
            >
              <Text style={styles.shareBtnText}>Share Code</Text>
            </TouchableOpacity>
          </>
        )}

        <TouchableOpacity style={styles.cancelBtn} onPress={onCancel} activeOpacity={0.7}>
          <Text style={styles.cancelText}>Cancel</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Join mode: enter a 6-char code
  if (mode === 'join') {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Join Room</Text>

        <View style={styles.inputSection}>
          <Text style={styles.inputLabel}>ROOM CODE</Text>
          <TextInput
            style={styles.codeInput}
            value={joinCode}
            onChangeText={(t) => {
              setJoinCode(t.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6));
              setJoinError(null);
            }}
            placeholder="XXXXXX"
            placeholderTextColor={colors.textDim}
            maxLength={6}
            autoCapitalize="characters"
            autoCorrect={false}
          />
        </View>

        {joinError && <Text style={styles.error}>{joinError}</Text>}

        <TouchableOpacity
          style={[styles.joinBtn, joinCode.length < 6 && styles.joinBtnDisabled]}
          onPress={() => {
            if (joinCode.length < 6) {
              setJoinError('Code must be 6 characters');
              return;
            }
            onJoinRoom(playerName, itemMode, joinCode);
          }}
          activeOpacity={0.7}
          disabled={joinCode.length < 6}
        >
          <Text style={styles.joinBtnText}>Join</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.cancelBtn} onPress={() => setMode('choice')} activeOpacity={0.7}>
          <Text style={styles.cancelText}>Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Choice mode: Create or Join
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Play Online</Text>
      <Text style={styles.subtitle}>Battle a friend using a room code</Text>

      <TouchableOpacity
        style={styles.createBtn}
        onPress={() => {
          setMode('create');
          onCreateRoom(playerName, itemMode, maxGen, legendaryMode);
        }}
        activeOpacity={0.7}
      >
        <Text style={styles.createBtnText}>CREATE ROOM</Text>
        <Text style={styles.createBtnSub}>Generate a code and wait for opponent</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.joinChoiceBtn}
        onPress={() => setMode('join')}
        activeOpacity={0.7}
      >
        <Text style={styles.joinChoiceBtnText}>JOIN ROOM</Text>
        <Text style={styles.joinChoiceBtnSub}>Enter a 6-character room code</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.cancelBtn} onPress={onCancel} activeOpacity={0.7}>
        <Text style={styles.cancelText}>Back to Menu</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  title: {
    color: colors.text,
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: 1,
  },
  subtitle: {
    color: colors.textSecondary,
    fontSize: 14,
    marginTop: spacing.sm,
    marginBottom: spacing.xl * 2,
  },
  codeBox: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    paddingHorizontal: 40,
    paddingVertical: spacing.xl,
    marginTop: spacing.xl,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.border,
  },
  codeLabel: {
    color: colors.textDim,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 2,
    marginBottom: spacing.sm,
  },
  code: {
    color: colors.accent,
    fontSize: 42,
    fontWeight: '900',
    letterSpacing: 8,
  },
  hint: {
    color: colors.textDim,
    fontSize: 12,
    marginTop: spacing.lg,
  },
  shareBtn: {
    backgroundColor: colors.surfaceLight,
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 10,
    marginTop: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  shareBtnText: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
  },
  cancelBtn: {
    marginTop: spacing.xl,
    paddingVertical: 10,
  },
  cancelText: {
    color: colors.textDim,
    fontSize: 14,
    fontWeight: '600',
  },
  createBtn: {
    backgroundColor: colors.accent,
    paddingVertical: 18,
    paddingHorizontal: 32,
    borderRadius: 14,
    width: '100%',
    alignItems: 'center',
    marginBottom: spacing.md,
    shadowColor: colors.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  createBtnText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 2,
  },
  createBtnSub: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 11,
    marginTop: 4,
  },
  joinChoiceBtn: {
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 14,
    width: '100%',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.accent,
  },
  joinChoiceBtnText: {
    color: colors.accent,
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 2,
  },
  joinChoiceBtnSub: {
    color: colors.textDim,
    fontSize: 11,
    marginTop: 4,
  },
  inputSection: {
    width: '100%',
    marginTop: spacing.xl * 2,
    alignItems: 'center',
  },
  inputLabel: {
    color: colors.textDim,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 2,
    marginBottom: spacing.sm,
  },
  codeInput: {
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: 14,
    paddingHorizontal: spacing.xl,
    paddingVertical: 16,
    color: colors.accent,
    fontSize: 32,
    fontWeight: '900',
    letterSpacing: 8,
    textAlign: 'center',
    width: '100%',
  },
  error: {
    color: colors.hpRed,
    fontSize: 12,
    fontWeight: '600',
    marginTop: spacing.sm,
  },
  joinBtn: {
    backgroundColor: colors.accent,
    paddingVertical: 14,
    paddingHorizontal: 48,
    borderRadius: 12,
    marginTop: spacing.xl,
  },
  joinBtnDisabled: {
    opacity: 0.5,
  },
  joinBtnText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '800',
  },
  settingsTags: {
    flexDirection: 'row',
    gap: 8,
    marginTop: spacing.md,
  },
  settingsTag: {
    backgroundColor: colors.surfaceLight,
    borderWidth: 1,
    borderColor: colors.accent,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 4,
    color: colors.accent,
    fontSize: 12,
    fontWeight: '700',
  },
});
