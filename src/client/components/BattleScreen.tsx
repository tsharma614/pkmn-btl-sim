import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  Animated,
  InteractionManager,
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
import { GauntletStarterScreen } from './GauntletStarterScreen';
import { GauntletStealScreen } from './GauntletStealScreen';
import { CampaignIntroScreen } from './CampaignIntroScreen';
import { BudgetDraftScreen } from './BudgetDraftScreen';
import { ItemSelectScreen } from './ItemSelectScreen';
import { ShopScreen } from './ShopScreen';
import { GymMapScreen } from './GymMapScreen';
import { E4LockScreen } from './E4LockScreen';
import { PkButton } from './shared/PkButton';
import { generateBudgetDraftOptions, MEGA_POOL, TIERS as draftTiers } from '../../engine/draft-pool';
import { SeededRNG } from '../../utils/rng';
import { colors, spacing, shadows } from '../theme';
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
  const { state, dispatch, startGame, startOnline, createRoom, joinRoom, selectLead, selectForceSwitch, submitDraftPick, rerollDraftPool, playAgain, requestRematchOnline, returnToMenu, moveSelectionComplete, startGauntlet, gauntletStarterPicked, gauntletStealComplete, advanceCampaign, beginCampaignBattle, startGymCareer, gymCareerDraftComplete, itemSelectComplete, shopSwapMove, shopSwapItem, shopBuyPokemon, shopDone, saveAndQuit, showGymMap, challengeGym, showE4Locks, returnToMapAfterLoss } = useBattle();

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

  // --- Budget Draft (Gym Career) ---
  // Defer expensive draft generation off the render critical path.
  // generateBudgetDraftOptions does 645 Pokemon × 6 roles × 4 tiers — running it
  // synchronously during render causes a watchdog SIGABRT on 8GB iOS devices.
  const [budgetOptions, setBudgetOptions] = useState<ReturnType<typeof generateBudgetDraftOptions> | null>(null);
  const budgetPhaseRef = useRef(false);

  useEffect(() => {
    if (state.phase === 'budget_draft' && !budgetPhaseRef.current) {
      budgetPhaseRef.current = true;
      // Defer heavy computation until after animations/transitions complete
      const handle = InteractionManager.runAfterInteractions(() => {
        const options = generateBudgetDraftOptions(new SeededRNG());
        setBudgetOptions(options);
      });
      return () => handle.cancel();
    } else if (state.phase !== 'budget_draft') {
      budgetPhaseRef.current = false;
      setBudgetOptions(null);
    }
  }, [state.phase]);

  if (state.phase === 'budget_draft') {
    if (!budgetOptions) {
      return (
        <SafeAreaView style={[styles.full, { justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }]}>
          <ActivityIndicator size="large" color={colors.accent} />
          <Text style={{ color: colors.textSecondary, marginTop: spacing.md, fontSize: 14, fontWeight: '600' }}>
            Generating draft pool...
          </Text>
        </SafeAreaView>
      );
    }
    return (
      <SafeAreaView style={styles.full}>
        <BudgetDraftScreen
          roleOptions={budgetOptions}
          onComplete={gymCareerDraftComplete}
          onBack={returnToMenu}
          playerName={state.playerName}
        />
      </SafeAreaView>
    );
  }

  // --- Item Select (Gym Career) ---
  if (state.phase === 'item_select') {
    return (
      <SafeAreaView style={styles.full}>
        <ItemSelectScreen
          team={state.yourTeam}
          onComplete={itemSelectComplete}
          onBack={returnToMenu}
          playerName={state.playerName}
        />
      </SafeAreaView>
    );
  }

  // --- Shop (after gym/E4 win) ---
  // Only compute shop buy pool when actually in shop phase — was previously running on
  // EVERY render (including budget_draft), adding unnecessary computation during gym career startup.
  const shopBuyPool = useMemo(() => {
    if (state.phase !== 'shop') return [];
    const seed = state.campaignStage * 1000 + state.beatenGyms.filter(Boolean).length;
    const rng = new SeededRNG(seed);
    const pool: { species: any; tier: number; cost: number }[] = [];
    const megas = [...(MEGA_POOL as any[])];
    rng.shuffle(megas);
    pool.push(...megas.slice(0, 5).map((s: any) => ({ species: s, tier: 0, cost: 4 })));
    const t1 = [...(draftTiers as any)[1]];
    rng.shuffle(t1);
    pool.push(...t1.slice(0, 5).map((s: any) => ({ species: s, tier: 1, cost: 3 })));
    const t2 = [...(draftTiers as any)[2]];
    rng.shuffle(t2);
    pool.push(...t2.slice(0, 5).map((s: any) => ({ species: s, tier: 2, cost: 2 })));
    return pool;
  }, [state.phase, state.campaignStage, state.beatenGyms]);

  if (state.phase === 'shop') {

    return (
      <SafeAreaView style={styles.full}>
        <ShopScreen
          balance={state.shopBalance}
          team={state.yourTeam}
          buyPool={shopBuyPool}
          onSwapMove={shopSwapMove}
          onSwapItem={shopSwapItem}
          onBuyPokemon={(poolIdx, replaceIdx, customMoves, customItem) => {
            const item = shopBuyPool[poolIdx];
            if (item) shopBuyPokemon(item.species, item.cost, replaceIdx, customMoves, customItem);
          }}
          onDone={shopDone}
        />
      </SafeAreaView>
    );
  }

  // --- Gym Map ---
  if (state.phase === 'gym_map') {
    return (
      <SafeAreaView style={styles.full}>
        <GymMapScreen
          gymTypes={state.gymTypes}
          beatenGyms={state.beatenGyms}
          onChallenge={challengeGym}
          onEliteFour={showE4Locks}
          onBack={returnToMenu}
          onSaveQuit={saveAndQuit}
          onShop={() => dispatch({ type: 'SHOW_SHOP', payout: 0 })}
          shopBalance={state.shopBalance}
          team={state.yourTeam}
        />
      </SafeAreaView>
    );
  }

  // --- E4 Locks ---
  if (state.phase === 'e4_locks') {
    return (
      <SafeAreaView style={styles.full}>
        <E4LockScreen
          members={[
            { name: 'Leonardo', title: 'Elite Four', sprite: 'acetrainer-gen4', tagline: '' },
            { name: 'Donatello', title: 'Elite Four', sprite: 'scientist', tagline: '' },
            { name: 'Raphael', title: 'Elite Four', sprite: 'blackbelt-gen4', tagline: '' },
            { name: 'Michelangelo', title: 'Elite Four', sprite: 'pokefan', tagline: '' },
          ]}
          champion={{ name: 'Professor Oak', title: 'Champion', sprite: 'gentleman', tagline: '' }}
          beatenMembers={state.beatenE4}
          championBeaten={false}
          onChallenge={(idx) => {
            const rng = { next: () => Math.random() };
            const member = getEliteFourMember(idx);
            dispatch({
              type: 'CAMPAIGN_INTRO',
              stage: 8 + idx,
              totalStages: 13,
              opponentName: `Elite Four ${member?.name ?? 'Unknown'}`,
              opponentTitle: member?.title ?? '',
              trainerSprite: ['acetrainer-gen4', 'scientist', 'blackbelt-gen4', 'pokefan'][idx],
              campaignMode: 'gym_career',
            });
          }}
          onChallengeChampion={() => {
            dispatch({
              type: 'CAMPAIGN_INTRO',
              stage: 12,
              totalStages: 13,
              opponentName: 'Champion Professor Oak',
              opponentTitle: 'The Pokemon Professor',
              trainerSprite: 'gentleman',
              campaignMode: 'gym_career',
            });
          }}
          onBack={returnToMenu}
          onSaveQuit={saveAndQuit}
          onShop={() => dispatch({ type: 'SHOW_SHOP', payout: 0 })}
          shopBalance={state.shopBalance}
          team={state.yourTeam}
        />
      </SafeAreaView>
    );
  }

  // --- Gauntlet Starter Pick ---
  if (state.phase === 'gauntlet_starter') {
    return (
      <SafeAreaView style={styles.full}>
        <GauntletStarterScreen
          onPick={gauntletStarterPicked}
          onBack={returnToMenu}
        />
      </SafeAreaView>
    );
  }

  // --- Gauntlet Steal Screen ---
  if (state.phase === 'gauntlet_steal') {
    return (
      <SafeAreaView style={styles.full}>
        <GauntletStealScreen
          opponentTeam={state.gauntletOpponentTeam}
          playerTeam={state.yourTeam.length > 0 ? state.yourTeam : []}
          battleNumber={state.campaignStage}
          mustDrop={state.yourTeam.length >= 6}
          onComplete={gauntletStealComplete}
          trainerName={state.campaignOpponentName}
          trainerSprite={state.campaignOpponentSprite}
        />
      </SafeAreaView>
    );
  }

  // --- Campaign Intro (gym career / gauntlet between battles) ---
  if (state.phase === 'campaign_intro') {
    return (
      <SafeAreaView style={styles.full}>
        <CampaignIntroScreen
          stageLabel={
            state.campaignMode === 'gauntlet'
              ? `Gauntlet Battle ${state.campaignStage + 1}`
              : state.campaignStage < 8
                ? `Gym ${state.campaignStage + 1} of 8`
                : state.campaignStage < 12
                  ? `Elite Four ${state.campaignStage - 7} of 4`
                  : 'Champion'
          }
          opponentName={state.campaignOpponentName}
          opponentTitle={state.campaignOpponentTitle}
          trainerSprite={state.campaignOpponentSprite}
          progress={state.campaignStage / state.campaignTotalStages}
          totalStages={Math.min(state.campaignTotalStages, 13)}
          currentStage={state.campaignStage}
          onBack={returnToMenu}
          onBeginBattle={beginCampaignBattle}
        />
      </SafeAreaView>
    );
  }

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


  // --- Setup ---
  if (state.phase === 'setup') {
    return (
      <SafeAreaView style={styles.full}>
        <SetupScreen onStart={startGame} onPlayOnline={startOnline} onStartGauntlet={startGauntlet} onStartGymCareer={startGymCareer} />
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
        <PkButton
          title="NEW BATTLE"
          onPress={playAgain}
          style={{ marginTop: spacing.xl }}
        />
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

        {/* Turn indicator bar */}
        <View style={styles.turnBar}>
          <TouchableOpacity onPress={() => setShowExitConfirm(true)} hitSlop={8} style={styles.turnBarBtn}>
            <Text style={styles.exitX}>{'\u2715'}</Text>
          </TouchableOpacity>

          <View style={styles.turnCenter}>
            <Animated.Text style={[styles.turnText, { transform: [{ scale: turnScale }] }]}>
              TURN {state.turn}
            </Animated.Text>
            {state.weather !== 'none' && (
              <Text style={styles.weatherText}>
                {WEATHER_ICONS[state.weather] || ''} {state.weather}
              </Text>
            )}
            {state.phase === 'waiting_for_turn' && (
              <View style={styles.waitingRow}>
                <ActivityIndicator size="small" color={colors.accentGold} />
                {state.gameMode === 'online' && (
                  <Text style={styles.waitingText}>Waiting...</Text>
                )}
              </View>
            )}
          </View>

          <TouchableOpacity onPress={() => setShowBattleLog(true)} hitSlop={8} style={styles.turnBarBtn}>
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
          campaignMode={state.campaignMode}
          campaignStage={state.campaignStage}
          onAdvanceCampaign={state.campaignMode !== null ? advanceCampaign : undefined}
          onReturnToMap={state.campaignMode === 'gym_career' ? returnToMapAfterLoss : undefined}
          shopBalance={state.campaignMode === 'gym_career' ? state.shopBalance : undefined}
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
            <PkButton
              title="EXIT TO MENU"
              variant="primary"
              size="md"
              onPress={() => { setShowExitConfirm(false); returnToMenu(); }}
              style={{ marginTop: spacing.lg, width: '100%' }}
            />
            <PkButton
              title="CANCEL"
              variant="ghost"
              size="sm"
              onPress={() => setShowExitConfirm(false)}
              style={{ marginTop: spacing.sm }}
            />
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
    fontWeight: '600',
  },
  disconnectTitle: {
    color: colors.primary,
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: 1,
  },
  disconnectSub: {
    color: colors.textSecondary,
    fontSize: 14,
    textAlign: 'center',
    marginTop: spacing.md,
    lineHeight: 20,
  },
  battlefield: {
    flex: 1,
  },
  turnBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
  },
  turnBarBtn: {
    padding: spacing.xs,
  },
  turnCenter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  turnText: {
    color: colors.accentGold,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  weatherText: {
    color: colors.textDim,
    fontSize: 11,
    fontStyle: 'italic',
  },
  waitingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
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
    backgroundColor: 'rgba(227, 53, 13, 0.9)',
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
  },
  logBtn: {
    color: colors.textSecondary,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 6,
    overflow: 'hidden',
  },
  exitOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
  },
  exitModal: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    padding: spacing.xl,
    width: '80%',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.lg,
  },
  exitTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  exitSub: {
    color: colors.textSecondary,
    fontSize: 13,
    marginTop: spacing.sm,
    textAlign: 'center',
    lineHeight: 18,
  },
});

const hazardStyles = StyleSheet.create({
  container: {
    alignSelf: 'center',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  text: {
    color: colors.textDim,
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
});
