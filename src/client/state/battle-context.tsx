import React, { createContext, useContext, useReducer, useRef, useCallback, useEffect } from 'react';
import { AppState } from 'react-native';
import { battleReducer, initialState } from './battle-reducer';
import type { BattleState, BattleAction } from './battle-reducer';
import {
  createOnlineConnection,
  submitAction as submitOnlineAction,
  submitLead as submitOnlineLead,
  submitForceSwitch as submitOnlineForceSwitch,
  submitDraftReroll,
  requestRematch,
} from '../socket';
import type { BattleConnection } from '../socket';
import { createLocalBattle } from '../local-battle';
import type { LocalBattle } from '../local-battle';
import { getServerUrl } from '../config';
import { generateDraftPool, buildTeamFromDraftPicks } from '../../engine/draft-pool';
import type { DraftPoolEntry } from '../../engine/draft-pool';
import { generateEliteFourCpuTeam, generateChampionCpuTeam, pickSet } from '../../engine/team-generator';
import { createBattlePokemon } from '../../engine/pokemon-factory';
import pokedexData from '../../data/pokedex.json';
import megaPokedexData from '../../data/mega-pokemon.json';
import type { PokemonSpecies } from '../../types';
import { getEliteFourMember, CHAMPION } from '../../data/elite-four';
import { SeededRNG } from '../../utils/rng';
import { BattlePokemon } from '../../types';
import { serializeOwnPokemon } from '../../server/state-sanitizer';
// badge-tracker E4 progress no longer used — campaign mode handles this
import { pickTrainerName, pickTrainerSprite } from '../../data/trainer-names';
import { MONOTYPE_TYPES } from '../../engine/draft-pool';
import type { OwnPokemon } from '../../server/types';
import { saveCampaignRun } from '../utils/stats-storage';
import { saveGymCareer, clearGymCareerSave } from '../components/CampaignScreen';
import { generateGauntletTeam, generateGymTeam, generateE4Team } from '../../engine/team-generator';
import { getGauntletTagline, getGymTagline, getE4Tagline, getChampionTagline } from '../../data/taglines';

const SERVER_URL = getServerUrl();

// Build species lookup by ID for move selection (need full PokemonSpecies for pickSet/createBattlePokemon)
const fullSpeciesById: Record<string, PokemonSpecies> = {};
for (const entry of Object.values(pokedexData as Record<string, any>)) {
  fullSpeciesById[entry.id] = entry as PokemonSpecies;
}
for (const entry of Object.values(megaPokedexData as Record<string, any>)) {
  fullSpeciesById[entry.id] = entry as PokemonSpecies;
}

interface BattleContextValue {
  state: BattleState;
  dispatch: React.Dispatch<BattleAction>;
  startGame: (playerName: string, itemMode: 'competitive' | 'casual', maxGen?: number | null, difficulty?: 'easy' | 'normal' | 'hard', legendaryMode?: boolean, draftMode?: boolean, monotype?: string | null, draftType?: 'snake' | 'role', poolSize?: number, megaMode?: boolean, moveSelection?: boolean) => void;
  startOnline: (playerName: string, itemMode: 'competitive' | 'casual', maxGen?: number | null, legendaryMode?: boolean, draftMode?: boolean, monotype?: string | null, draftType?: 'snake' | 'role', megaMode?: boolean, moveSelection?: boolean) => void;
  createRoom: (playerName: string, itemMode: 'competitive' | 'casual', maxGen?: number | null, legendaryMode?: boolean, monotype?: string | null) => void;
  joinRoom: (playerName: string, itemMode: 'competitive' | 'casual', code: string) => void;
  selectLead: (index: number) => void;
  selectMove: (moveIndex: number) => void;
  selectSwitch: (pokemonIndex: number) => void;
  selectForceSwitch: (pokemonIndex: number) => void;
  submitDraftPick: (poolIndex: number) => void;
  rerollDraftPool: () => void;
  playAgain: () => void;
  requestRematchOnline: () => void;
  returnToMenu: () => void;
  moveSelectionComplete: (moveSelections: Record<number, string[]>) => void;
  startGauntlet: (playerName: string) => void;
  gauntletStarterPicked: (speciesId: string) => void;
  gauntletStealComplete: (stealIndex: number, dropIndex: number | null) => void;
  advanceCampaign: () => void;
  beginCampaignBattle: () => void;
  startGymCareer: (playerName: string, existingSave?: import('../components/CampaignScreen').GymCareerSave) => void;
  gymCareerDraftComplete: (picks: { speciesId: string; tier: number }[]) => void;
  itemSelectComplete: (itemSelections: Record<number, string>) => void;
  shopSwapMove: (pokemonIdx: number, moveSlotIdx: number, newMoveName: string) => void;
  shopSwapItem: (pokemonIdx: number, newItem: string) => void;
  shopBuyPokemon: (species: PokemonSpecies, cost: number, replaceIdx: number) => void;
  shopDone: () => void;
  saveAndQuit: () => void;
  showGymMap: () => void;
  challengeGym: (gymIndex: number) => void;
  showE4Locks: () => void;
}

const BattleContext = createContext<BattleContextValue | null>(null);

// Module-level refs survive hot reloads
let activeConnection: BattleConnection | null = null;
let activeLocalBattle: LocalBattle | null = null;

export function BattleProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(battleReducer, initialState);
  const connectionRef = useRef<BattleConnection | null>(activeConnection);
  const localBattleRef = useRef<LocalBattle | null>(activeLocalBattle);
  const mountedRef = useRef(false);
  const stateRef = useRef(state);
  stateRef.current = state;
  /** Guard against double-tap: set true on action submit, cleared when turn result arrives */
  const actionPendingRef = useRef(false);

  // (Old E4 refs removed — campaign mode handles this now)

  // Campaign state preserved across battles
  const campaignPlayerTeamRef = useRef<BattlePokemon[] | null>(null);
  const campaignPlayerNameRef = useRef<string>('Player');
  const campaignRngRef = useRef(new SeededRNG());
  const campaignUsedNamesRef = useRef<string[]>([]);
  /** For gauntlet: the last opponent's BattlePokemon team (so we can steal) */
  const gauntletOpponentBPRef = useRef<BattlePokemon[] | null>(null);
  /** Prevents double-saving campaign run (loss + abandon race condition) */
  const campaignRunSavedRef = useRef(false);

  const cleanupAll = useCallback(() => {
    if (activeConnection) {
      activeConnection.disconnect();
      activeConnection = null;
    }
    connectionRef.current = null;
    if (activeLocalBattle) {
      activeLocalBattle.disconnect();
      activeLocalBattle = null;
    }
    localBattleRef.current = null;
    actionPendingRef.current = false;
  }, []);

  // --- CPU mode: local battle (no server) ---

  const startGame = useCallback((playerName: string, itemMode: 'competitive' | 'casual', maxGen?: number | null, difficulty?: 'easy' | 'normal' | 'hard', legendaryMode?: boolean, draftMode?: boolean, monotype?: string | null, draftType?: 'snake' | 'role', poolSize?: number, megaMode?: boolean, moveSelection?: boolean) => {
    console.log(`[battle-context] startGame — draft: ${draftMode}, type: ${draftType}, legendary: ${legendaryMode}, maxGen: ${maxGen}, difficulty: ${difficulty}, monotype: ${monotype}, poolSize: ${poolSize}, mega: ${megaMode}, moveSelect: ${moveSelection}`);
    cleanupAll();
    dispatch({ type: 'RESET' });
    dispatch({ type: 'START_GAME', playerName, itemMode, difficulty, monotype, legendaryMode, moveSelection });

    // Skip 'connecting' phase — go directly to team preview
    dispatch({ type: 'CONNECTED' });

    const local = createLocalBattle({
      playerName,
      itemMode,
      maxGen: maxGen ?? null,
      difficulty: difficulty ?? 'normal',
      legendaryMode: legendaryMode ?? false,
      draftMode: draftMode ?? false,
      draftType: draftType ?? 'snake',
      monotype: monotype ?? null,
      poolSize: poolSize ?? 21,
      megaMode: megaMode ?? false,
      dispatch,
    });

    activeLocalBattle = local;
    localBattleRef.current = local;
    local.start();
  }, [cleanupAll]);

  // --- Online mode: socket connection ---

  const draftModeRef = useRef(false);
  const monotypeRef = useRef<string | null>(null);
  const draftTypeRef = useRef<'snake' | 'role'>('snake');
  const megaModeRef = useRef(false);

  const startOnlineCreate = useCallback((playerName: string, itemMode: 'competitive' | 'casual', maxGen?: number | null, legendaryMode?: boolean, dm?: boolean, mono?: string | null, dt?: 'snake' | 'role', mega?: boolean, moveSelect?: boolean) => {
    cleanupAll();
    draftModeRef.current = dm ?? false;
    monotypeRef.current = mono ?? null;
    draftTypeRef.current = dt ?? 'snake';
    megaModeRef.current = mega ?? false;
    dispatch({ type: 'RESET' });
    dispatch({ type: 'START_ONLINE', playerName, itemMode, maxGen, legendaryMode, moveSelection: moveSelect });
    const conn = createOnlineConnection(SERVER_URL, playerName, itemMode, dispatch, maxGen, legendaryMode);
    activeConnection = conn;
    connectionRef.current = conn;
    conn.start();
  }, [cleanupAll]);

  const createRoom = useCallback((playerName: string, itemMode: 'competitive' | 'casual', maxGen?: number | null, legendaryMode?: boolean, monotype?: string | null) => {
    const conn = connectionRef.current;
    if (conn) {
      conn.startCreateRoom?.(itemMode, maxGen, legendaryMode, draftModeRef.current, monotypeRef.current ?? monotype, draftTypeRef.current, megaModeRef.current);
    }
  }, []);

  const joinRoom = useCallback((playerName: string, itemMode: 'competitive' | 'casual', code: string) => {
    const conn = connectionRef.current;
    if (conn && conn.gameMode === 'online') {
      conn.startJoinRoom?.(code.toUpperCase(), itemMode);
    } else {
      cleanupAll();
      dispatch({ type: 'RESET' });
      dispatch({ type: 'START_ONLINE', playerName, itemMode });
      const newConn = createOnlineConnection(SERVER_URL, playerName, itemMode, dispatch);
      activeConnection = newConn;
      connectionRef.current = newConn;
      newConn.start();
      const waitConnect = newConn.humanSocket.connected
        ? Promise.resolve()
        : new Promise<void>(r => newConn.humanSocket.once('connect', r));
      waitConnect.then(() => {
        newConn.startJoinRoom?.(code.toUpperCase(), itemMode);
      });
    }
  }, [cleanupAll]);

  // AppState listener: reconnect online when app returns to foreground
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        const conn = connectionRef.current;
        const currentPhase = stateRef.current.phase;
        if (conn && conn.roomCode && currentPhase === 'disconnected') {
          console.log('[AppState] App returned to foreground, reconnecting...');
          conn.reconnect();
        }
      }
    });
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (mountedRef.current) return;
    mountedRef.current = true;
    if (activeConnection) connectionRef.current = activeConnection;
    if (activeLocalBattle) localBattleRef.current = activeLocalBattle;
  }, []);

  // Clear online action guard when turn results arrive from server
  useEffect(() => {
    if (actionPendingRef.current && connectionRef.current && (state.pendingEvents.length > 0 || state.phase !== 'battling')) {
      actionPendingRef.current = false;
    }
  }, [state.pendingEvents, state.phase]);

  // --- Actions: route to local battle or online socket ---

  const selectLead = useCallback((index: number) => {
    const local = localBattleRef.current;
    if (local) {
      local.selectLead(index);
      return;
    }
    const conn = connectionRef.current;
    if (conn) {
      submitOnlineLead(conn, index, stateRef.current.itemMode);
    }
  }, []);

  const selectMove = useCallback((moveIndex: number) => {
    if (actionPendingRef.current) return;
    if (stateRef.current.phase !== 'battling' || stateRef.current.pendingEvents.length > 0 || stateRef.current.queuedPendingEvents.length > 0) return;
    const local = localBattleRef.current;
    if (local) {
      actionPendingRef.current = true;
      dispatch({ type: 'ACTION_SUBMITTED' });
      // Use setTimeout to let the UI update to 'waiting' before processing
      setTimeout(() => {
        local.submitAction({ type: 'move', index: moveIndex });
        actionPendingRef.current = false;
      }, 50);
      return;
    }
    const conn = connectionRef.current;
    if (conn) {
      actionPendingRef.current = true;
      submitOnlineAction(conn, { type: 'move', index: moveIndex });
      dispatch({ type: 'ACTION_SUBMITTED' });
    }
  }, []);

  const selectSwitch = useCallback((pokemonIndex: number) => {
    if (actionPendingRef.current) return;
    if (stateRef.current.phase !== 'battling' || stateRef.current.pendingEvents.length > 0 || stateRef.current.queuedPendingEvents.length > 0) return;
    const local = localBattleRef.current;
    if (local) {
      actionPendingRef.current = true;
      dispatch({ type: 'ACTION_SUBMITTED' });
      setTimeout(() => {
        local.submitAction({ type: 'switch', index: pokemonIndex });
        actionPendingRef.current = false;
      }, 50);
      return;
    }
    const conn = connectionRef.current;
    if (conn) {
      actionPendingRef.current = true;
      submitOnlineAction(conn, { type: 'switch', index: pokemonIndex });
      dispatch({ type: 'ACTION_SUBMITTED' });
    }
  }, []);

  const selectForceSwitch = useCallback((pokemonIndex: number) => {
    if (actionPendingRef.current) return;
    const local = localBattleRef.current;
    if (local) {
      actionPendingRef.current = true;
      dispatch({ type: 'ACTION_SUBMITTED' });
      setTimeout(() => {
        local.submitForceSwitch(pokemonIndex);
        actionPendingRef.current = false;
      }, 50);
      return;
    }
    const conn = connectionRef.current;
    if (conn) {
      actionPendingRef.current = true;
      submitOnlineForceSwitch(conn, pokemonIndex);
      dispatch({ type: 'ACTION_SUBMITTED' });
    }
  }, []);

  const submitDraftPick = useCallback((poolIndex: number) => {
    const local = localBattleRef.current;
    if (local) {
      local.submitDraftPick(poolIndex);
      return;
    }
    // Online: TODO — emit draft_pick event
    const conn = connectionRef.current;
    if (conn) {
      conn.humanSocket.emit('draft_pick' as any, { poolIndex });
    }
  }, []);

  const rerollDraftPool = useCallback(() => {
    const local = localBattleRef.current;
    if (local) {
      local.rerollDraftPool();
      return;
    }
    const conn = connectionRef.current;
    if (conn) {
      submitDraftReroll(conn);
    }
  }, []);

  const playAgain = useCallback(() => {
    console.log('[battle-context] playAgain — cleaning up');
    cleanupAll();
    dispatch({ type: 'RESET' });
  }, [cleanupAll]);

  const requestRematchOnline = useCallback(() => {
    const conn = connectionRef.current;
    if (conn) {
      requestRematch(conn);
    }
  }, []);

  const returnToMenu = useCallback(() => {
    console.log('[battle-context] returnToMenu — cleaning up');
    const currentState = stateRef.current;

    // Campaign forfeit = abandoned run — but only if battle_end hasn't already saved
    // (BattleEndOverlay saves loss on mount, so if phase is battle_end, it's already saved)
    const alreadySaved = currentState.phase === 'battle_end' || campaignRunSavedRef.current;
    if (currentState.campaignMode && currentState.campaignStage > 0 && !alreadySaved) {
      saveCampaignRun({
        mode: currentState.campaignMode,
        progress: currentState.campaignMode === 'gauntlet'
          ? `Battle ${currentState.campaignStage + 1}`
          : `Stage ${currentState.campaignStage + 1}/13`,
        team: campaignPlayerTeamRef.current?.map(p => p.species.name) ?? [],
        result: 'abandoned',
        date: new Date().toISOString(),
      });
    }
    if (currentState.campaignMode === 'gym_career') {
      clearGymCareerSave();
    }

    campaignRunSavedRef.current = false;
    cleanupAll();
    campaignPlayerTeamRef.current = null;
    dispatch({ type: 'RESET' });
  }, [cleanupAll]);

  // --- Move Selection Complete ---

  const moveSelectionComplete = useCallback((moveSelections: Record<number, string[]>) => {
    const currentState = stateRef.current;
    const team = currentState.yourTeam;
    const rng = new SeededRNG();

    // Rebuild team with custom moves using the engine
    // Must look up full PokemonSpecies from pokedex — OwnPokemon.species is stripped
    const rebuiltTeam: BattlePokemon[] = team.map((poke, i) => {
      const fullSpecies = fullSpeciesById[poke.species.id];
      if (!fullSpecies) {
        // Fallback: shouldn't happen, but use partial species
        const baseSet = pickSet(poke.species as any, rng, currentState.itemMode);
        return createBattlePokemon(poke.species as any, baseSet, 100, null);
      }
      const customMoves = moveSelections[i];
      if (!customMoves || customMoves.length !== 4) {
        const baseSet = pickSet(fullSpecies, rng, currentState.itemMode);
        return createBattlePokemon(fullSpecies, baseSet, 100, null);
      }
      const baseSet = pickSet(fullSpecies, rng, currentState.itemMode);
      baseSet.moves = customMoves;
      return createBattlePokemon(fullSpecies, baseSet, 100, null);
    });

    // In gauntlet mode, go to item select for starter
    if (currentState.campaignMode === 'gauntlet') {
      campaignPlayerTeamRef.current = rebuiltTeam;
      dispatch({
        type: 'SHOW_ITEM_SELECT',
        yourTeam: rebuiltTeam.map(serializeOwnPokemon),
      });
      return;
    }

    // In gym career mode, go to item selection next
    if (currentState.campaignMode === 'gym_career') {
      campaignPlayerTeamRef.current = rebuiltTeam;
      dispatch({
        type: 'SHOW_ITEM_SELECT',
        yourTeam: rebuiltTeam.map(serializeOwnPokemon),
      });
      return;
    }

    // Update local battle's team if CPU mode
    const local = localBattleRef.current;
    if (local) {
      local.updateHumanTeam(rebuiltTeam);
    }

    // For online mode, send move selections to server
    const conn = connectionRef.current;
    if (conn) {
      conn.humanSocket.emit('moves_selected' as any, { moveSelections });
    }

    // Dispatch with serialized team
    dispatch({
      type: 'MOVE_SELECTION_COMPLETE',
      yourTeam: rebuiltTeam.map(serializeOwnPokemon),
    });
  }, []);

  // --- Gauntlet ---

  const startGauntlet = useCallback((playerName: string) => {
    cleanupAll();
    campaignPlayerNameRef.current = playerName;
    campaignPlayerTeamRef.current = null;
    campaignRngRef.current = new SeededRNG();
    campaignUsedNamesRef.current = [];
    dispatch({ type: 'GAUNTLET_START', playerName });
  }, [cleanupAll]);

  /** Ref to hold the starter species for gauntlet move selection */
  const gauntletStarterSpeciesRef = useRef<string | null>(null);

  const gauntletStarterPicked = useCallback((speciesId: string) => {
    const species = fullSpeciesById[speciesId];
    if (!species) return;
    const rng = campaignRngRef.current;
    const baseSet = pickSet(species, rng, 'competitive');
    const starter = createBattlePokemon(species, baseSet, 100, null);
    campaignPlayerTeamRef.current = [starter];
    gauntletStarterSpeciesRef.current = speciesId;

    // Show move selection phase on the starter
    dispatch({
      type: 'DRAFT_COMPLETE',
      yourTeam: [serializeOwnPokemon(starter)],
    });
  }, []);

  const gauntletStealComplete = useCallback((stealIndex: number, dropIndex: number | null) => {
    const team = campaignPlayerTeamRef.current;
    const oppTeam = gauntletOpponentBPRef.current;
    if (!team || !oppTeam) return;

    // Stolen Pokemon keep their moves as-is
    const stolen = oppTeam[stealIndex];
    let newTeam = [...team, stolen];
    if (dropIndex !== null) {
      newTeam = newTeam.filter((_, i) => i !== dropIndex);
    }
    campaignPlayerTeamRef.current = newTeam;

    // Advance to next battle intro — numbered opponents
    const currentState = stateRef.current;
    const nextBattle = currentState.campaignStage + 1;
    const rng = campaignRngRef.current;
    const sprite = pickTrainerSprite(rng);
    const tagline = getGauntletTagline(nextBattle);
    dispatch({
      type: 'CAMPAIGN_INTRO',
      stage: nextBattle,
      totalStages: 999,
      opponentName: `Opponent #${nextBattle + 1}`,
      opponentTitle: tagline,
      trainerSprite: sprite,
      campaignMode: 'gauntlet',
    });
  }, []);

  /** Called after winning a campaign battle to advance. */
  const advanceCampaign = useCallback(() => {
    const currentState = stateRef.current;

    if (currentState.campaignMode === 'gauntlet') {
      // Use the actual opponent team from the battle (stored in beginCampaignBattle)
      const oppTeam = gauntletOpponentBPRef.current;
      if (!oppTeam) return;

      const serialized = oppTeam.map(serializeOwnPokemon);
      dispatch({
        type: 'GAUNTLET_STEAL',
        opponentTeam: serialized,
        trainerName: currentState.campaignOpponentName,
        trainerSprite: currentState.campaignOpponentSprite,
      });
      return;
    }

    if (currentState.campaignMode === 'gym_career') {
      const stage = currentState.campaignStage;

      if (stage < 8) {
        // Gym beaten — mark it, save, show shop (+1 pt)
        const newBeatenGyms = currentState.beatenGyms.length === 8
          ? [...currentState.beatenGyms]
          : new Array(8).fill(false);
        newBeatenGyms[stage] = true;
        const beatenCount = newBeatenGyms.filter(Boolean).length;

        dispatch({ type: 'GYM_BEATEN', gymIndex: stage });

        saveGymCareer({
          currentStage: beatenCount,
          gymTypes: currentState.gymTypes,
          team: campaignPlayerTeamRef.current?.map(serializeOwnPokemon) ?? [],
          date: new Date().toISOString(),
          shopBalance: (currentState.shopBalance ?? 0) + 1,
          beatenGyms: newBeatenGyms,
          beatenE4: currentState.beatenE4.length === 4
            ? [...currentState.beatenE4]
            : new Array(4).fill(false),
        });

        dispatch({ type: 'SHOW_SHOP', payout: 1 });
      } else if (stage < 12) {
        // E4 member beaten — mark it, save, show shop (+2 pts)
        const memberIdx = stage - 8;
        const newBeatenE4 = currentState.beatenE4.length === 4
          ? [...currentState.beatenE4]
          : new Array(4).fill(false);
        newBeatenE4[memberIdx] = true;
        const e4BeatenCount = newBeatenE4.filter(Boolean).length;

        dispatch({ type: 'E4_MEMBER_BEATEN', memberIndex: memberIdx });

        saveGymCareer({
          currentStage: 8 + e4BeatenCount,
          gymTypes: currentState.gymTypes,
          team: campaignPlayerTeamRef.current?.map(serializeOwnPokemon) ?? [],
          date: new Date().toISOString(),
          shopBalance: (currentState.shopBalance ?? 0) + 2,
          beatenGyms: currentState.beatenGyms.length === 8
            ? [...currentState.beatenGyms]
            : new Array(8).fill(false),
          beatenE4: newBeatenE4,
        });

        dispatch({ type: 'SHOW_SHOP', payout: 2 });
      } else {
        // Champion defeated!
        saveCampaignRun({
          mode: 'gym_career',
          progress: 'Champion',
          stageNum: 13,
          team: campaignPlayerTeamRef.current?.map(p => p.species.name) ?? [],
          result: 'win',
          date: new Date().toISOString(),
        });
        clearGymCareerSave();
        cleanupAll();
        campaignPlayerTeamRef.current = null;
        dispatch({ type: 'RESET' });
      }
      return;
    }
  }, [cleanupAll]);

  /** Start the current campaign battle. */
  const beginCampaignBattle = useCallback(() => {
    cleanupAll();
    campaignRunSavedRef.current = false; // Reset for new battle
    const currentState = stateRef.current;
    const playerName = campaignPlayerNameRef.current;
    const playerTeam = campaignPlayerTeamRef.current;
    if (!playerTeam) return;

    // Heal player team
    const healedTeam = playerTeam.map(p => ({
      ...p,
      currentHp: p.stats.hp,
      isAlive: true,
      status: null,
      volatileStatuses: new Set<string>(),
      boosts: { atk: 0, def: 0, spa: 0, spd: 0, spe: 0, accuracy: 0, evasion: 0 },
      lastMoveUsed: null,
      choiceLocked: null,
      substituteHp: 0,
      hasMovedThisTurn: false,
      tookDamageThisTurn: false,
      protectedLastTurn: false,
      timesHit: 0,
      lastDamageTaken: null,
      toxicCounter: 0,
      sleepTurns: 0,
      confusionTurns: 0,
      encoreTurns: 0,
      encoreMove: null,
      flashFireActive: false,
      moves: p.moves.map(m => ({ ...m, currentPp: m.maxPp, disabled: false })),
    }));
    campaignPlayerTeamRef.current = healedTeam;

    let opponentTeam: BattlePokemon[];
    const stage = currentState.campaignStage;

    if (currentState.campaignMode === 'gauntlet') {
      // Use proper scaling: T3 → T2/T1 → T1/megas → all megas
      opponentTeam = generateGauntletTeam(campaignRngRef.current, stage, 'competitive');
      gauntletOpponentBPRef.current = opponentTeam;
    } else {
      // Gym career — specific team compositions
      if (stage < 8) {
        // Gym: 1 Mega + 1 T1 + 2 T2 + 2 T3, type-matched
        const type = currentState.gymTypes[stage];
        opponentTeam = generateGymTeam(campaignRngRef.current, type, 'competitive');
      } else if (stage < 12) {
        // E4: 1 Mega + 3 T1 + 2 T2, not type-restricted
        opponentTeam = generateE4Team(campaignRngRef.current, 'competitive');
      } else {
        // Champion: 6 Megas
        opponentTeam = generateChampionCpuTeam(campaignRngRef.current, 'competitive');
      }
    }

    const local = createLocalBattle({
      playerName,
      itemMode: 'competitive',
      maxGen: null,
      difficulty: 'hard',
      legendaryMode: false,
      draftMode: false,
      draftType: 'snake',
      monotype: null,
      poolSize: 21,
      megaMode: false,
      dispatch,
      // Campaign: pass both pre-built teams directly
      campaignPlayerTeam: healedTeam,
      campaignOpponentTeam: opponentTeam,
      campaignOpponentName: currentState.campaignOpponentName,
    });

    activeLocalBattle = local;
    localBattleRef.current = local;
    local.start();
  }, [cleanupAll]);

  // --- Gym Career ---

  const startGymCareer = useCallback((playerName: string, existingSave?: import('../components/CampaignScreen').GymCareerSave) => {
    cleanupAll();
    campaignPlayerNameRef.current = playerName;
    campaignRngRef.current = new SeededRNG();
    campaignUsedNamesRef.current = [];

    // Resume from save: rebuild team and restore progress
    if (existingSave) {
      const rebuiltTeam = existingSave.team.map((saved: any) => {
        const fullSpecies = fullSpeciesById[saved.species.id];
        if (!fullSpecies) return null;
        const moveNames = saved.moves.map((m: any) => m.name);
        const baseSet = pickSet(fullSpecies, campaignRngRef.current, 'competitive');
        baseSet.moves = moveNames;
        baseSet.item = saved.item;
        baseSet.ability = saved.ability;
        const mon = createBattlePokemon(fullSpecies, baseSet, 100, null);
        mon.item = saved.item;
        mon.ability = saved.ability;
        return mon;
      }).filter(Boolean) as BattlePokemon[];

      campaignPlayerTeamRef.current = rebuiltTeam;

      const beatenGyms = existingSave.beatenGyms ?? new Array(8).fill(false);
      const beatenE4 = existingSave.beatenE4 ?? new Array(4).fill(false);

      dispatch({
        type: 'GYM_CAREER_RESUME',
        playerName,
        gymTypes: existingSave.gymTypes,
        beatenGyms,
        beatenE4,
        shopBalance: existingSave.shopBalance ?? 0,
        yourTeam: existingSave.team,
      });
      return;
    }

    campaignPlayerTeamRef.current = null;

    // Randomize 8 gym types from 18
    const rng = campaignRngRef.current;
    const shuffled = [...MONOTYPE_TYPES].sort(() => rng.next() - 0.5);
    const gymTypes = shuffled.slice(0, 8);

    // Budget draft screen handles pool generation — just dispatch start
    dispatch({ type: 'GYM_CAREER_START', playerName, gymTypes });
  }, [cleanupAll]);

  /** Called from BudgetDraftScreen with picked species IDs. Goes to move selection. */
  const gymCareerDraftComplete = useCallback((picks: { speciesId: string; tier: number }[]) => {
    const rng = campaignRngRef.current;
    const playerTeam = picks.map(pick => {
      const species = fullSpeciesById[pick.speciesId];
      if (!species) throw new Error(`Species not found: ${pick.speciesId}`);
      const baseSet = pickSet(species, rng, 'competitive');
      return createBattlePokemon(species, baseSet, 100, null);
    });
    campaignPlayerTeamRef.current = playerTeam;

    // Calculate shop balance from unspent draft budget (14 - spent)
    const BUDGET_COSTS: Record<number, number> = { 0: 4, 1: 3, 2: 2, 3: 0, 4: 0 };
    const spent = picks.reduce((sum, p) => sum + (BUDGET_COSTS[p.tier] ?? 0), 0);
    dispatch({ type: 'SET_SHOP_BALANCE', balance: 14 - spent });

    // Go to move selection phase
    dispatch({
      type: 'DRAFT_COMPLETE',
      yourTeam: playerTeam.map(serializeOwnPokemon),
    });
  }, []);

  /** Show the gym map screen. */
  /** Called after item selection in gym career. Saves and shows gym map. */
  const itemSelectComplete = useCallback((itemSelections: Record<number, string>) => {
    const team = campaignPlayerTeamRef.current;
    if (team) {
      for (const [idx, item] of Object.entries(itemSelections)) {
        const i = parseInt(idx, 10);
        if (team[i]) team[i].item = item;
      }
    }
    const currentState = stateRef.current;

    // Gauntlet: after item select on starter, show first battle intro
    if (currentState.campaignMode === 'gauntlet') {
      const campaignRng = campaignRngRef.current;
      const sprite = pickTrainerSprite(campaignRng);
      const tagline = getGauntletTagline(0);
      dispatch({
        type: 'CAMPAIGN_INTRO',
        stage: 0,
        totalStages: 999,
        opponentName: 'Opponent #1',
        opponentTitle: tagline,
        trainerSprite: sprite,
        campaignMode: 'gauntlet',
      });
      return;
    }

    // Gym career: save and show gym map
    saveGymCareer({
      currentStage: 0,
      gymTypes: currentState.gymTypes,
      team: team?.map(serializeOwnPokemon) ?? [],
      date: new Date().toISOString(),
      shopBalance: currentState.shopBalance ?? 0,
      beatenGyms: [...currentState.beatenGyms],
      beatenE4: [...currentState.beatenE4],
    });
    dispatch({ type: 'SHOW_GYM_MAP' });
  }, []);

  /** Shop: swap a move on a team member */
  const shopSwapMove = useCallback((pokemonIdx: number, moveSlotIdx: number, newMoveName: string) => {
    const team = campaignPlayerTeamRef.current;
    if (!team || !team[pokemonIdx]) return;
    const pokemon = team[pokemonIdx];
    const fullSpecies = fullSpeciesById[pokemon.species.id];
    if (!fullSpecies) return;
    // Find the move data from the species movePool
    const movesData = require('../../data/moves.json') as Record<string, any>;
    const moveKey = newMoveName.toLowerCase().replace(/[^a-z0-9]/g, '');
    const moveData = movesData[moveKey];
    if (moveData && pokemon.moves[moveSlotIdx]) {
      pokemon.moves[moveSlotIdx] = {
        data: moveData,
        currentPp: moveData.pp,
        maxPp: moveData.pp,
        disabled: false,
      };
    }
    dispatch({ type: 'SET_SHOP_BALANCE', balance: stateRef.current.shopBalance - 1 });
  }, []);

  /** Shop: swap an item on a team member */
  const shopSwapItem = useCallback((pokemonIdx: number, newItem: string) => {
    const team = campaignPlayerTeamRef.current;
    if (!team || !team[pokemonIdx]) return;
    team[pokemonIdx].item = newItem;
    dispatch({ type: 'SET_SHOP_BALANCE', balance: stateRef.current.shopBalance - 1 });
  }, []);

  /** Shop: buy a Pokemon and replace a team slot */
  const shopBuyPokemon = useCallback((species: PokemonSpecies, cost: number, replaceIdx: number) => {
    const team = campaignPlayerTeamRef.current;
    if (!team) return;
    const rng = campaignRngRef.current;
    const set = pickSet(species, rng, 'competitive');
    const newMon = createBattlePokemon(species, set, 100, null);
    team[replaceIdx] = newMon;
    dispatch({ type: 'SET_SHOP_BALANCE', balance: stateRef.current.shopBalance - cost });
  }, []);

  /** Shop: done shopping, go back to gym map or E4 locks */
  const shopDone = useCallback(() => {
    const currentState = stateRef.current;
    // Save updated team
    saveGymCareer({
      currentStage: currentState.beatenGyms.filter(Boolean).length + currentState.beatenE4.filter(Boolean).length,
      gymTypes: currentState.gymTypes,
      team: campaignPlayerTeamRef.current?.map(serializeOwnPokemon) ?? [],
      date: new Date().toISOString(),
      shopBalance: currentState.shopBalance,
      beatenGyms: [...currentState.beatenGyms],
      beatenE4: [...currentState.beatenE4],
    });
    dispatch({ type: 'SHOP_DONE' });
  }, []);

  /** Save & Quit: save progress and return to menu without recording a loss */
  const saveAndQuit = useCallback(() => {
    const currentState = stateRef.current;
    if (currentState.campaignMode === 'gym_career') {
      saveGymCareer({
        currentStage: currentState.beatenGyms.filter(Boolean).length + currentState.beatenE4.filter(Boolean).length,
        gymTypes: currentState.gymTypes,
        team: campaignPlayerTeamRef.current?.map(serializeOwnPokemon) ?? [],
        date: new Date().toISOString(),
        shopBalance: currentState.shopBalance,
        beatenGyms: [...currentState.beatenGyms],
        beatenE4: [...currentState.beatenE4],
      });
    }
    cleanupAll();
    campaignPlayerTeamRef.current = null;
    dispatch({ type: 'RESET' });
  }, [cleanupAll]);

  const showGymMap = useCallback(() => {
    dispatch({ type: 'SHOW_GYM_MAP' });
  }, []);

  /** Challenge a specific gym. */
  const challengeGym = useCallback((gymIndex: number) => {
    const currentState = stateRef.current;
    const type = currentState.gymTypes[gymIndex];
    const rng = campaignRngRef.current;
    const opponentName = pickTrainerName(rng, campaignUsedNamesRef.current);
    campaignUsedNamesRef.current.push(opponentName);
    const sprite = pickTrainerSprite(rng);
    const tagline = getGymTagline(type, rng);

    dispatch({
      type: 'CAMPAIGN_INTRO',
      stage: gymIndex,
      totalStages: 13,
      opponentName,
      opponentTitle: tagline,
      trainerSprite: sprite,
      campaignMode: 'gym_career',
    });
  }, []);

  /** Show E4 lock screen. */
  const showE4Locks = useCallback(() => {
    dispatch({ type: 'SHOW_E4_LOCKS' });
  }, []);

  return (
    <BattleContext.Provider
      value={{
        state,
        dispatch,
        startGame,
        startOnline: startOnlineCreate,
        createRoom,
        joinRoom,
        selectLead,
        selectMove,
        selectSwitch,
        selectForceSwitch,
        submitDraftPick,
        rerollDraftPool,
        playAgain,
        requestRematchOnline,
        returnToMenu,
        moveSelectionComplete,
        startGauntlet,
        gauntletStarterPicked,
        gauntletStealComplete,
        advanceCampaign,
        beginCampaignBattle,
        startGymCareer,
        gymCareerDraftComplete,
        itemSelectComplete,
        shopSwapMove,
        shopSwapItem,
        shopBuyPokemon,
        shopDone,
        saveAndQuit,
        showGymMap,
        challengeGym,
        showE4Locks,
      }}
    >
      {children}
    </BattleContext.Provider>
  );
}

export function useBattle(): BattleContextValue {
  const ctx = useContext(BattleContext);
  if (!ctx) throw new Error('useBattle must be used within BattleProvider');
  return ctx;
}
