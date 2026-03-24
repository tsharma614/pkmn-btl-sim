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
import { colors, spacing, shadows } from '../theme';
import { PkButton } from './shared/PkButton';
import { PkCard } from './shared/PkCard';

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
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    if (!roomCode) return;
    Share.share({ message: roomCode });
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // If we have a room code, we're in create mode waiting for opponent
  if (roomCode && mode !== 'join') {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>
          {opponentName ? `${opponentName} joined!` : 'Waiting for opponent...'}
        </Text>

        <PkCard style={styles.codeCard} padding="spacious">
          <Text style={styles.codeLabel}>ROOM CODE</Text>
          <Text style={styles.code}>{roomCode}</Text>
          <TouchableOpacity style={styles.copyBtn} onPress={handleCopy} activeOpacity={0.7}>
            <Text style={styles.copyBtnText}>{copied ? 'COPIED!' : 'COPY CODE'}</Text>
          </TouchableOpacity>
        </PkCard>

        {/* Show room settings */}
        {(maxGen || legendaryMode) && (
          <View style={styles.settingsTags}>
            {maxGen && maxGen <= 4 && (
              <View style={[styles.settingsTag, styles.settingsTagActive]}>
                <Text style={styles.settingsTagText}>Classic Mode</Text>
              </View>
            )}
            {legendaryMode && (
              <View style={[styles.settingsTag, styles.settingsTagActive]}>
                <Text style={styles.settingsTagText}>Legendary Team</Text>
              </View>
            )}
          </View>
        )}

        {!opponentName && (
          <>
            <ActivityIndicator size="large" color={colors.accent} style={{ marginTop: spacing.xl }} />
            <Text style={styles.hint}>Share this code with your opponent</Text>

            <PkButton
              title="SHARE CODE"
              variant="secondary"
              size="md"
              onPress={() => {
                Share.share({
                  message: `Join my PBS battle! Room code: ${roomCode}`,
                });
              }}
              style={{ marginTop: spacing.lg }}
            />
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

        <PkButton
          title="JOIN"
          variant="primary"
          size="md"
          onPress={() => {
            if (joinCode.length < 6) {
              setJoinError('Code must be 6 characters');
              return;
            }
            onJoinRoom(playerName, itemMode, joinCode);
          }}
          disabled={joinCode.length < 6}
          style={{ marginTop: spacing.xl, width: '100%' }}
        />

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

      <PkButton
        title="CREATE ROOM"
        subtitle="Generate a code and wait for opponent"
        variant="primary"
        size="lg"
        onPress={() => {
          setMode('create');
          onCreateRoom(playerName, itemMode, maxGen, legendaryMode);
        }}
        style={{ width: '100%', marginBottom: spacing.md }}
      />

      <PkButton
        title="JOIN ROOM"
        subtitle="Enter a 6-character room code"
        variant="secondary"
        size="lg"
        onPress={() => setMode('join')}
        style={{ width: '100%' }}
      />

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
  codeCard: {
    marginTop: spacing.xl,
    alignItems: 'center',
    width: '100%',
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
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  copyBtn: {
    marginTop: spacing.md,
    backgroundColor: colors.surfaceLight,
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  copyBtnText: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
  },
  hint: {
    color: colors.textDim,
    fontSize: 12,
    marginTop: spacing.lg,
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
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  error: {
    color: colors.hpRed,
    fontSize: 12,
    fontWeight: '600',
    marginTop: spacing.sm,
  },
  settingsTags: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  settingsTag: {
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 6,
    backgroundColor: colors.surfaceLight,
    borderWidth: 1,
    borderColor: colors.border,
  },
  settingsTagActive: {
    borderColor: colors.accent,
    backgroundColor: 'rgba(227,53,13,0.1)',
  },
  settingsTagText: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: '700',
  },
});
