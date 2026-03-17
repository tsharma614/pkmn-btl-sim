import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useBattle } from '../state/battle-context';
import { useEventQueue } from '../hooks/use-event-queue';
import { OpponentPanel } from './OpponentPanel';
import { PlayerPanel } from './PlayerPanel';
import { ActionPanel } from './ActionPanel';
import { EventLog } from './EventLog';
import { ForceSwitch } from './ForceSwitch';
import { BattleEndOverlay } from './BattleEndOverlay';
import { TeamPreview } from './TeamPreview';
import { SetupScreen } from './SetupScreen';
import { OnlineLobby } from './OnlineLobby';
import { PokemonInfoModal } from './PokemonInfoModal';
import { BattleLog } from './BattleLog';
import { DraftScreen } from './DraftScreen';
import { RoleDraftScreen } from './RoleDraftScreen';
import { EliteFourDraftScreen } from './EliteFourDraftScreen';
import { EliteFourIntroScreen } from './EliteFourIntroScreen';
import { MoveSelectionScreen } from './MoveSelectionScreen';
import { colors, spacing } from '../theme';
import { getGymLeader } from '../../data/gym-leaders';
import { getEliteFourMember } from '../../data/elite-four';
import type { SideEffects } from '../../types';

const WEATHER_TINTS: Record<string, string> = {
  sun: 'rgba(255,180,50,0.08)',
  rain: 'rgba(50,100,255,0.08)',
  sandstorm: 'rgba(180,150,80,0.10)',
  hail: 'rgba(180,220,255,0.08)',
};

const WEATHER_ICONS: Record<string, string> = {
  sun: '\u2600\uFE0F',
  rain: '\uD83C\uDF27\uFE0F',
  sandstorm: '\uD83C\uDF2A\uFE0F',
  hail: '\u2744\uFE0F',
};

function HazardIndicator({ side, label }: { side: SideEffects | undefined; label: string }) {
  if (!side) return null;
  const parts: string[] = [];
  if (side.stealthRock) parts.push('SR');
  if (side.spikesLayers > 0) parts.push(`Spk${side.spikesLayers > 1 ? 'x' + side.spikesLayers : ''}`);
  if (side.toxicSpikesLayers > 0) parts.push(`TSp${side.toxicSpikesLayers > 1 ? 'x' + side.toxicSpikesLayers : ''}`);
  if (side.reflect > 0) parts.push('Ref');
  if (side.lightScreen > 0) parts.push('LS');
  if (side.tailwind > 0) parts.push('TW');
  if (parts.length === 0) return null;
  return (
    <View style={hazardStyles.container}>
      <Text style={hazardStyles.text}>{label}: {parts.join(' ')}</Text>
    </View>
  );
}

export function BattleScreen() {
  const { state, dispatch, startGame, startOnline, createRoom, joinRoom, selectLead, selectForceSwitch, submitDraftPick, rerollDraftPool, playAgain, requestRematchOnline, returnToMenu, startEliteFour, e4DraftComplete, advanceEliteFour, beginE4Battle, moveSelectionComplete } = useBattle();

  const onEventsProcessed = useCallback(() => {
    dispatch({ type: 'EVENTS_PROCESSED' });
  }, [dispatch]);

  const active = state.yourState?.team[state.yourState.activePokemonIndex ?? 0];
  const oppActive = state.opponentVisible?.activePokemon;

  const {
    messages, isProcessing, animations, damageReaction,
    playerHpOverride, opponentHpOverride,
    playerIndicator, opponentIndicator, screenFlash,
    opponentSpriteOverride, opponentNameOverride,
    playerSpriteOverride, playerNameOverride,
  } = useEventQueue(
    state.pendingEvents,
    onEventsProcessed,
    active?.species.name ?? null,
    oppActive?.species.name ?? null,
    active ? { current: active.currentHp, max: active.maxHp } : null,
    oppActive ? { current: oppActive.currentHp, max: oppActive.maxHp } : null,
    state.yourPlayerIndex,
  );

  // Pokemon info modal state (must be before early returns)
  const [infoModal, setInfoModal] = useState<'player' | 'opponent' | null>(null);
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [showBattleLog, setShowBattleLog] = useState(false);

  // Weather tint animation
  const weatherTintOpacity = useRef(new Animated.Value(0)).current;
  const lastWeather = useRef(state.weather);

  useEffect(() => {
    if (state.weather !== lastWeather.current) {
      lastWeather.current = state.weather;
      if (state.weather === 'none') {
        Animated.timing(weatherTintOpacity, { toValue: 0, duration: 600, useNativeDriver: true }).start();
      } else {
        Animated.timing(weatherTintOpacity, { toValue: 1, duration: 600, useNativeDriver: true }).start();
      }
    }
  }, [state.weather]);

  // Turn counter animation
  const turnScale = useRef(new Animated.Value(1)).current;
  const lastTurn = useRef(state.turn);

  useEffect(() => {
    if (state.turn !== lastTurn.current && state.turn > 0) {
      lastTurn.current = state.turn;
      turnScale.setValue(1.3);
      Animated.spring(turnScale, { toValue: 1, friction: 8, tension: 120, useNativeDriver: true }).start();
    }
  }, [state.turn]);

  // Screen flash animation
  const flashOpacity = useRef(new Animated.Value(0)).current;
  const flashColor = useRef('#fff');
  const lastFlashKey = useRef(0);

  useEffect(() => {
    if (screenFlash && screenFlash.key !== lastFlashKey.current) {
      lastFlashKey.current = screenFlash.key;
      flashColor.current = screenFlash.color;
      flashOpacity.setValue(0.35);
      Animated.timing(flashOpacity, {
        toValue: 0,
        duration: 400,
        useNativeDriver: true,
      }).start();
    }
  }, [screenFlash?.key]);

  // --- Move Selection (after draft) ---
  if (state.phase === 'move_selection') {
    return (
      <SafeAreaView style={styles.full}>
        <MoveSelectionScreen
          team={state.yourTeam}
          onComplete={moveSelectionComplete}
          onBack={returnToMenu}
          playerName={state.playerName}
        />
      </SafeAreaView>
    );
  }

  // --- Elite Four Draft ---
  if (state.phase === 'elite_four_draft') {
    return (
      <SafeAreaView style={styles.full}>
        <EliteFourDraftScreen
          pool={state.draftPool}
          onComplete={e4DraftComplete}
          onBack={returnToMenu}
          playerName={state.playerName}
        />
      </SafeAreaView>
    );
  }

  // --- Elite Four Intro (between battles) ---
  if (state.phase === 'elite_four_intro') {
    const member = state.eliteFourStage !== null ? getEliteFourMember(state.eliteFourStage) : null;
    return (
      <SafeAreaView style={styles.full}>
        <EliteFourIntroScreen
          stage={state.eliteFourStage ?? 0}
          memberName={member?.name ?? 'Unknown'}
          memberTitle={member?.title ?? ''}
          onBack={returnToMenu}
          onBeginBattle={beginE4Battle}
        />
      </SafeAreaView>
    );
  }

  // --- Setup ---
  if (state.phase === 'setup') {
    return (
      <SafeAreaView style={styles.full}>
        <SetupScreen onStart={startGame} onPlayOnline={startOnline} onStartEliteFour={startEliteFour} />
      </SafeAreaView>
    );
  }

  // --- Connecting ---
  if (state.phase === 'connecting') {
    return (
      <SafeAreaView style={styles.centered}>
        <ActivityIndicator size="large" color={colors.accent} />
        <Text style={styles.loadingText}>Connecting...</Text>
      </SafeAreaView>
    );
  }

  // --- Online Lobby ---
  if (state.phase === 'online_lobby') {
    return (
      <SafeAreaView style={styles.full}>
        <OnlineLobby
          roomCode={state.roomCode}
          opponentName={state.opponentName}
          playerName={state.playerName}
          itemMode={state.itemMode}
          maxGen={state.maxGen}
          legendaryMode={state.legendaryMode}
          roomOptions={state.roomOptions}
          onCreateRoom={createRoom}
          onJoinRoom={joinRoom}
          onCancel={returnToMenu}
        />
      </SafeAreaView>
    );
  }

  // --- Disconnected ---
  if (state.phase === 'disconnected') {
    return (
      <SafeAreaView style={styles.centered}>
        <Text style={styles.disconnectTitle}>Connection Lost</Text>
        <Text style={styles.disconnectSub}>
          Return to the app to reconnect automatically, or start a new battle.
        </Text>
        <TouchableOpacity
          style={styles.newBattleBtn}
          onPress={playAgain}
          activeOpacity={0.7}
        >
          <Text style={styles.newBattleBtnText}>New Battle</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  // --- Drafting ---
  if (state.phase === 'drafting') {
    const yourPicks = state.draftPicks[state.yourPlayerIndex].map(i => state.draftPool[i]);
    const oppPicks = state.draftPicks[1 - state.yourPlayerIndex as 0 | 1].map(i => state.draftPool[i]);
    const gymTitle = state.gameMode === 'cpu' && state.difficulty === 'hard' && state.legendaryMode && state.draftType !== 'role' && state.monotype
      ? (() => { const gl = getGymLeader(state.monotype); return gl ? `GYM LEADER ${gl.name.toUpperCase()}` : null; })()
      : null;
    const oppName = state.opponentName ?? state.botName ?? 'Opponent';

    if (state.draftType === 'role') {
      return (
        <SafeAreaView style={styles.full}>
          <RoleDraftScreen
            pool={state.draftPool}
            yourPicks={yourPicks}
            opponentPicks={oppPicks}
            currentPlayer={state.draftCurrentPlayer}
            yourPlayerIndex={state.yourPlayerIndex}
            pickNumber={state.draftCurrentPick}
            roleRound={state.roleRound}
            roleOrder={state.roleOrder}
            onPick={submitDraftPick}
            onReroll={rerollDraftPool}
            draftRerolled={state.draftRerolled}
            opponentName={oppName}
            playerName={state.playerName}
            onBack={returnToMenu}
            gymLeaderTitle={gymTitle}
          />
        </SafeAreaView>
      );
    }

    return (
      <SafeAreaView style={styles.full}>
        <DraftScreen
          pool={state.draftPool}
          yourPicks={yourPicks}
          opponentPicks={oppPicks}
          currentPlayer={state.draftCurrentPlayer}
          yourPlayerIndex={state.yourPlayerIndex}
          pickNumber={state.draftCurrentPick}
          onPick={submitDraftPick}
          onReroll={rerollDraftPool}
          draftRerolled={state.draftRerolled}
          opponentName={oppName}
          playerName={state.playerName}
          onBack={returnToMenu}
          gymLeaderTitle={gymTitle}
        />
      </SafeAreaView>
    );
  }

  // --- Team Preview ---
  if (state.phase === 'team_preview') {
    return (
      <SafeAreaView style={styles.full}>
        <TeamPreview team={state.yourTeam} onSelectLead={selectLead} onExitToMenu={returnToMenu} />
      </SafeAreaView>
    );
  }

  // --- Battle phases ---
  const isBattlePhase =
    state.phase === 'battling' ||
    state.phase === 'waiting_for_turn' ||
    state.phase === 'needs_switch' ||
    state.phase === 'battle_end';

  if (!isBattlePhase || !state.yourState) {
    return (
      <SafeAreaView style={styles.centered}>
        <ActivityIndicator size="large" color={colors.accent} />
        <Text style={styles.loadingText}>
          {state.botName ? `${state.botName} wants to battle!` : 'Setting up battle...'}
        </Text>
      </SafeAreaView>
    );
  }

  const actionsDisabled =
    state.phase === 'waiting_for_turn' || isProcessing || state.queuedPendingEvents.length > 0;

  return (
    <SafeAreaView style={styles.full}>
      <View style={styles.battlefield}>
        {/* Subtle grid pattern */}
        <View style={styles.gridOverlay} pointerEvents="none">
          {Array.from({ length: 12 }).map((_, i) => (
            <View key={`h${i}`} style={[styles.gridLineH, { top: `${(i + 1) * 8}%` as any }]} />
          ))}
          {Array.from({ length: 8 }).map((_, i) => (
            <View key={`v${i}`} style={[styles.gridLineV, { left: `${(i + 1) * 12.5}%` as any }]} />
          ))}
        </View>

        {/* Weather tint overlay */}
        {state.weather !== 'none' && (
          <Animated.View
            pointerEvents="none"
            style={[
              styles.weatherTint,
              {
                backgroundColor: WEATHER_TINTS[state.weather] || 'transparent',
                opacity: weatherTintOpacity,
              },
            ]}
          />
        )}

        {/* Reconnecting banner (online only) */}
        {state.isReconnecting && (
          <View style={styles.reconnectBanner}>
            <ActivityIndicator size="small" color="#fff" />
            <Text style={styles.reconnectText}>Reconnecting...</Text>
          </View>
        )}

        {/* Turn indicator */}
        <View style={styles.turnBar}>
          <TouchableOpacity onPress={() => setShowExitConfirm(true)} hitSlop={8}>
            <Text style={styles.exitX}>✕</Text>
          </TouchableOpacity>
          <Animated.Text style={[styles.turnText, { transform: [{ scale: turnScale }] }]}>
            Turn {state.turn}
          </Animated.Text>
          {state.weather !== 'none' && (
            <Text style={styles.weatherText}>
              {WEATHER_ICONS[state.weather] || ''} {state.weather}
            </Text>
          )}
          {state.phase === 'waiting_for_turn' && (
            <>
              <ActivityIndicator size="small" color={colors.accent} />
              {state.gameMode === 'online' && (
                <Text style={styles.waitingText}>Waiting...</Text>
              )}
            </>
          )}
          <TouchableOpacity onPress={() => setShowBattleLog(true)} hitSlop={8}>
            <Text style={styles.logBtn}>LOG</Text>
          </TouchableOpacity>
        </View>

        {/* Opponent hazards */}
        <HazardIndicator side={state.opponentVisible?.sideEffects} label="Opp" />

        {/* Opponent - top */}
        <OpponentPanel
          opponentVisible={state.opponentVisible}
          botName={state.opponentName ?? state.botName ?? 'Opponent'}
          attackTrigger={animations.opponentAttack}
          damageTrigger={animations.opponentDamage}
          faintTrigger={animations.opponentFaint}
          switchOutTrigger={animations.opponentSwitchOut}
          damageReaction={damageReaction}
          hpOverride={opponentHpOverride}
          indicator={opponentIndicator}
          onLongPressSprite={() => setInfoModal('opponent')}
          speciesIdOverride={opponentSpriteOverride}
          nameOverride={opponentNameOverride}
        />

        {/* Opponent platform shadow */}
        <View style={styles.opponentPlatform} />

        {/* Spacer / battlefield area */}
        <View style={styles.fieldSpacer} />

        {/* Player hazards */}
        <HazardIndicator side={state.yourState?.sideEffects} label="You" />

        {/* Player - bottom */}
        <PlayerPanel
          active={active!}
          team={state.yourState.team}
          attackTrigger={animations.playerAttack}
          damageTrigger={animations.playerDamage}
          faintTrigger={animations.playerFaint}
          switchOutTrigger={animations.playerSwitchOut}
          hpOverride={playerHpOverride}
          indicator={playerIndicator}
          onLongPressSprite={() => setInfoModal('player')}
          speciesIdOverride={playerSpriteOverride}
          nameOverride={playerNameOverride}
        />

        {/* Player platform shadow */}
        <View style={styles.playerPlatform} />

        {/* Screen flash overlay for SE / crits */}
        <Animated.View
          pointerEvents="none"
          style={[
            styles.screenFlash,
            { backgroundColor: flashColor.current, opacity: flashOpacity },
          ]}
        />
      </View>

      {/* Event log */}
      <EventLog messages={messages} />

      {/* Action panel */}
      <ActionPanel disabled={actionsDisabled} />

      {/* Force switch overlay */}
      {state.phase === 'needs_switch' && (
        <ForceSwitch
          availableSwitches={state.availableSwitches}
          onSelect={selectForceSwitch}
          reason={state.switchReason}
          team={state.yourState.team}
          activePokemonIndex={state.yourState.activePokemonIndex}
        />
      )}

      {/* Battle end overlay */}
      {state.phase === 'battle_end' && state.battleEndData && (
        <BattleEndOverlay
          data={state.battleEndData}
          playerName={state.playerName}
          opponentName={state.opponentName ?? state.botName ?? 'Opponent'}
          stats={state.battleStats}
          battleLog={state.battleLog}
          gameMode={state.gameMode}
          onPlayAgain={state.gameMode === 'online' ? requestRematchOnline : playAgain}
          onExitToMenu={returnToMenu}
          badgeType={state.gameMode === 'cpu' && state.difficulty === 'hard' && state.legendaryMode && state.draftMode && state.draftType !== 'role' && state.monotype ? state.monotype : null}
          gymLeaderName={state.gameMode === 'cpu' && state.difficulty === 'hard' && state.legendaryMode && state.draftMode && state.draftType !== 'role' && state.monotype ? getGymLeader(state.monotype)?.name ?? null : null}
          badgeName={state.gameMode === 'cpu' && state.difficulty === 'hard' && state.legendaryMode && state.draftMode && state.draftType !== 'role' && state.monotype ? getGymLeader(state.monotype)?.badgeName ?? null : null}
          eliteFourStage={state.eliteFourStage}
          onAdvanceEliteFour={state.eliteFourStage !== null ? advanceEliteFour : undefined}
        />
      )}

      {/* Pokemon info modal */}
      <PokemonInfoModal
        visible={infoModal !== null}
        ownPokemon={infoModal === 'player' ? active : null}
        opponentPokemon={infoModal === 'opponent' ? oppActive : null}
        onClose={() => setInfoModal(null)}
      />

      {/* Battle log overlay */}
      <BattleLog
        visible={showBattleLog}
        lines={state.battleLog}
        onClose={() => setShowBattleLog(false)}
      />

      {/* Exit confirmation overlay */}
      {showExitConfirm && (
        <View style={styles.exitOverlay}>
          <View style={styles.exitModal}>
            <Text style={styles.exitTitle}>Exit Battle?</Text>
            <Text style={styles.exitSub}>This will forfeit the current battle.</Text>
            <TouchableOpacity
              style={styles.exitConfirmBtn}
              onPress={() => { setShowExitConfirm(false); returnToMenu(); }}
              activeOpacity={0.7}
            >
              <Text style={styles.exitConfirmText}>Exit to Menu</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.exitCancelBtn}
              onPress={() => setShowExitConfirm(false)}
              activeOpacity={0.7}
            >
              <Text style={styles.exitCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  full: {
    flex: 1,
    backgroundColor: colors.background,
  },
  centered: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  loadingText: {
    color: colors.text,
    fontSize: 16,
    marginTop: spacing.lg,
  },
  hint: {
    color: colors.textDim,
    fontSize: 12,
    marginTop: spacing.sm,
  },
  disconnectTitle: {
    color: colors.accent,
    fontSize: 24,
    fontWeight: '800',
  },
  disconnectSub: {
    color: colors.textSecondary,
    fontSize: 14,
    textAlign: 'center',
    marginTop: spacing.md,
    lineHeight: 20,
  },
  newBattleBtn: {
    backgroundColor: colors.accent,
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 10,
    marginTop: spacing.xl,
  },
  newBattleBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  battlefield: {
    flex: 1,
  },
  turnBar: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.xs,
  },
  turnText: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
  weatherText: {
    color: colors.textDim,
    fontSize: 11,
    fontStyle: 'italic',
  },
  waitingText: {
    color: colors.textDim,
    fontSize: 10,
    fontStyle: 'italic',
  },
  gridOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 0,
  },
  gridLineH: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  gridLineV: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  weatherTint: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1,
  },
  reconnectBanner: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(230, 80, 80, 0.9)',
    paddingVertical: 6,
    zIndex: 100,
    gap: 8,
  },
  reconnectText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
  opponentPlatform: {
    width: 120,
    height: 16,
    borderRadius: 999,
    backgroundColor: 'rgba(0,0,0,0.2)',
    alignSelf: 'flex-end',
    marginRight: 60,
    transform: [{ scaleY: 0.3 }],
    marginTop: -8,
  },
  playerPlatform: {
    width: 120,
    height: 16,
    borderRadius: 999,
    backgroundColor: 'rgba(0,0,0,0.25)',
    alignSelf: 'flex-start',
    marginLeft: 60,
    transform: [{ scaleY: 0.3 }],
    marginBottom: -4,
  },
  fieldSpacer: {
    flex: 1,
  },
  screenFlash: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 20,
  },
  exitX: {
    color: colors.textDim,
    fontSize: 16,
    fontWeight: '700',
    paddingHorizontal: 4,
  },
  logBtn: {
    color: colors.textDim,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 4,
  },
  exitOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
  },
  exitModal: {
    backgroundColor: colors.background,
    borderRadius: 16,
    padding: spacing.xl,
    width: '80%',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.border,
  },
  exitTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '800',
  },
  exitSub: {
    color: colors.textSecondary,
    fontSize: 13,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
  exitConfirmBtn: {
    backgroundColor: colors.accent,
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 10,
    marginTop: spacing.lg,
  },
  exitConfirmText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  exitCancelBtn: {
    marginTop: spacing.md,
  },
  exitCancelText: {
    color: colors.textDim,
    fontSize: 14,
    fontWeight: '600',
  },
});

const hazardStyles = StyleSheet.create({
  container: {
    alignSelf: 'center',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  text: {
    color: colors.textDim,
    fontSize: 9,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
});
