/**
 * Socket.io client connections for CPU and online multiplayer modes.
 *
 * CPU mode: two sockets (human + bot AI)
 * Online mode: single socket (human only, opponent is remote)
 *
 * Key reliability features:
 * - WebSocket-only transport (no polling upgrade, which fails in React Native)
 * - Auto-reconnection with room rejoin
 * - AppState-based reconnect for iOS backgrounding
 */

import { io } from 'socket.io-client';
import type { Socket } from 'socket.io-client';
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  TeamPreviewPayload,
  BattleStartPayload,
  TurnResultPayload,
  NeedsSwitchPayload,
  BattleEndPayload,
  DraftStartPayload,
  DraftPickBroadcast,
  DraftCompletePayload,
  OwnPokemon,
  VisiblePokemon,
} from '../server/types';
import { getTypeEffectiveness } from '../data/type-chart';
import type { PokemonType } from '../types';

type ClientSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

const BOT_NAMES = [
  'Jonathan', 'Nikhil', 'Trusha', 'Som', 'Meha', 'Ishan',
  'Vikram', 'Amit', 'Tejal', 'Akshay', 'Tanmay', 'Ambi',
];

/** Socket.io client options — WebSocket only, auto-reconnect */
const SOCKET_OPTS = {
  transports: ['websocket'] as string[],  // skip polling — polling upgrade breaks in RN
  reconnection: true,
  reconnectionAttempts: 10,
  reconnectionDelay: 2000,
  reconnectionDelayMax: 10000,
  timeout: 20000,
  autoConnect: false,
};

export type BotDifficulty = 'easy' | 'normal' | 'hard';

// --- Bot state (module-level, not React state) ---
let botState: TurnResultPayload['yourState'] | null = null;
let botOpponent: VisiblePokemon | null = null;
let botPendingForceSwitch = false;
let botDifficulty: BotDifficulty = 'normal';

function pickEasyAction(
  state: TurnResultPayload['yourState'],
): { type: 'move' | 'switch'; index: number } {
  const active = state.team[state.activePokemonIndex];
  const usableMoves = active.moves
    .map((m, i) => ({ ...m, idx: i }))
    .filter(m => m.currentPp > 0 && !m.disabled &&
      !(active.choiceLocked && m.name !== active.choiceLocked));
  if (usableMoves.length === 0) {
    const switches = state.team
      .map((p, i) => ({ alive: p.isAlive, idx: i }))
      .filter(s => s.idx !== state.activePokemonIndex && s.alive);
    if (switches.length > 0) {
      return { type: 'switch', index: switches[Math.floor(Math.random() * switches.length)].idx };
    }
    return { type: 'move', index: 0 };
  }
  const pick = usableMoves[Math.floor(Math.random() * usableMoves.length)];
  return { type: 'move', index: pick.idx };
}

function pickSmartAction(
  state: TurnResultPayload['yourState'],
  opponent: VisiblePokemon | null,
): { type: 'move' | 'switch'; index: number } {
  // Easy difficulty: random move, never switch
  if (botDifficulty === 'easy') {
    return pickEasyAction(state);
  }

  const isHard = botDifficulty === 'hard';
  const active = state.team[state.activePokemonIndex];
  const oppTypes = (opponent?.species.types ?? []) as PokemonType[];

  const switches = state.team
    .map((p, i) => ({ alive: p.isAlive, idx: i }))
    .filter(s => s.idx !== state.activePokemonIndex && s.alive);

  // Choice-locked: use the locked move or switch if out of PP
  if (active.choiceLocked) {
    const lockedIdx = active.moves.findIndex(m => m.name === active.choiceLocked);
    if (lockedIdx >= 0 && active.moves[lockedIdx].currentPp > 0) {
      // If choice-locked into an immune move, switch out
      if (oppTypes.length > 0) {
        const eff = getTypeEffectiveness(active.moves[lockedIdx].type as PokemonType, oppTypes);
        if (eff === 0 && switches.length > 0) {
          return pickBestSwitch(state, switches, oppTypes);
        }
      }
      return { type: 'move', index: lockedIdx };
    }
    if (switches.length > 0) {
      return pickBestSwitch(state, switches, oppTypes);
    }
  }

  const usableMoves = active.moves
    .map((m, i) => ({ ...m, idx: i }))
    .filter(m => m.currentPp > 0 && !m.disabled);

  if (usableMoves.length === 0) {
    if (switches.length > 0) {
      return pickBestSwitch(state, switches, oppTypes);
    }
    return { type: 'move', index: 0 };
  }

  const botTypes = active.species.types as PokemonType[];

  const hpPct = active.currentHp / active.maxHp;
  const oppHpPct = opponent ? opponent.currentHp / opponent.maxHp : 1;

  // Estimate opponent's offensive threat to us
  let oppThreat = 1; // how much SE the opponent likely has on us
  if (isHard && oppTypes.length > 0) {
    for (const oppType of oppTypes) {
      const eff = getTypeEffectiveness(oppType, botTypes);
      oppThreat *= eff;
    }
  }

  const scoredMoves = usableMoves.map(m => {
    let score = 0;
    const moveType = m.type as PokemonType;

    if (m.category !== 'Status' && m.power) {
      // Base power
      score = m.power;

      // Type effectiveness multiplier
      if (oppTypes.length > 0) {
        const eff = getTypeEffectiveness(moveType, oppTypes);
        if (eff === 0) {
          score = -100; // Never use immune moves
        } else {
          score *= eff; // 2x, 4x, 0.5x, 0.25x
        }
      }

      // STAB bonus (Same Type Attack Bonus)
      if (botTypes.includes(moveType)) {
        score *= 1.5;
      }

      // Use the right attacking stat
      if (m.category === 'Physical') {
        score *= (1 + active.boosts.atk * 0.15);
      } else {
        score *= (1 + active.boosts.spa * 0.15);
      }

      // Small accuracy penalty for inaccurate moves
      if (m.accuracy && m.accuracy < 100) {
        score *= (m.accuracy / 100);
      }

      // Hard mode: priority move bonus when opponent is low HP (finish them off)
      if (isHard && m.priority > 0 && oppHpPct < 0.25 && score > 0) {
        score *= 1.8; // Strongly prefer priority to KO
      }
      // Hard mode: KO-securing bonus
      if (isHard && oppHpPct < 0.3 && score > 0) {
        score *= 1.3;
      }
      // Hard mode: prefer high-power moves over chip when opponent is healthy
      if (isHard && oppHpPct > 0.7 && score > 0) {
        score *= 1 + (m.power / 500); // slight bonus for raw power
      }
    } else {
      // Status moves: moderate base score
      score = 35;

      // Healing moves: much smarter thresholds for hard mode
      const healMoves = ['Recover', 'Roost', 'Moonlight', 'Synthesis', 'Soft-Boiled',
        'Rest', 'Slack Off', 'Morning Sun', 'Milk Drink', 'Shore Up', 'Strength Sap'];
      if (healMoves.includes(m.name)) {
        if (isHard) {
          // Don't heal if opponent is very low — go for the kill instead
          if (oppHpPct < 0.2) {
            score = 10;
          } else {
            score = hpPct < 0.35 ? 150 : hpPct < 0.6 ? 100 : hpPct < 0.8 ? 40 : 5;
          }
        } else {
          score = hpPct < 0.5 ? 120 : hpPct < 0.75 ? 60 : 10;
        }
      }

      // Setup moves: consider current boost level
      const setupMoves: Record<string, { stat: string; stages: number }> = {
        'Swords Dance': { stat: 'atk', stages: 2 }, 'Nasty Plot': { stat: 'spa', stages: 2 },
        'Dragon Dance': { stat: 'atk', stages: 1 }, 'Calm Mind': { stat: 'spa', stages: 1 },
        'Bulk Up': { stat: 'atk', stages: 1 }, 'Quiver Dance': { stat: 'spa', stages: 1 },
        'Shell Smash': { stat: 'atk', stages: 2 }, 'Coil': { stat: 'atk', stages: 1 },
        'Shift Gear': { stat: 'spe', stages: 2 }, 'Tail Glow': { stat: 'spa', stages: 3 },
        'Iron Defense': { stat: 'def', stages: 2 }, 'Amnesia': { stat: 'spd', stages: 2 },
        'Agility': { stat: 'spe', stages: 2 }, 'Work Up': { stat: 'atk', stages: 1 },
        'Hone Claws': { stat: 'atk', stages: 1 }, 'Curse': { stat: 'atk', stages: 1 },
      };
      const setupInfo = setupMoves[m.name];
      if (setupInfo) {
        const currentBoost = active.boosts[setupInfo.stat as keyof typeof active.boosts] || 0;
        if (isHard) {
          // Don't set up if opponent threatens us hard — attack or switch instead
          if (oppThreat >= 2 && hpPct < 0.8) {
            score = 5;
          } else if (currentBoost >= 4) {
            score = 5;
          } else if (hpPct > 0.7 && oppHpPct > 0.5) {
            score = 110 - currentBoost * 15;
          } else if (hpPct > 0.5 && oppThreat <= 1) {
            score = 60 - currentBoost * 10;
          } else {
            score = 15;
          }
        } else {
          score = hpPct > 0.6 ? 70 : 25;
        }
      }

      // Hazards: higher priority for hard mode early game
      if (m.name === 'Stealth Rock' || m.name === 'Spikes' || m.name === 'Toxic Spikes') {
        score = isHard ? 85 : 65;
      }

      // Status moves: don't waste on already-statused opponents
      if (m.name === 'Toxic' || m.name === 'Will-O-Wisp' || m.name === 'Thunder Wave' ||
          m.name === 'Sleep Powder' || m.name === 'Spore' || m.name === 'Hypnosis' ||
          m.name === 'Stun Spore' || m.name === 'Nuzzle') {
        if (opponent?.status) {
          score = 5;
        } else if (isHard) {
          const isSleep = ['Sleep Powder', 'Spore', 'Hypnosis'].includes(m.name);
          // Don't status if we can KO; prioritize sleep on healthy threats
          if (oppHpPct < 0.2) {
            score = 15; // just attack
          } else {
            score = isSleep ? 90 : 70;
          }
        } else {
          score = 60;
        }
      }
    }

    // Random factor: none for hard, normal amount for normal
    if (!isHard) {
      score += Math.random() * 15;
    }

    return { ...m, score };
  });

  scoredMoves.sort((a, b) => b.score - a.score);

  // Only switch on all-NVE/immune if a teammate actually has a better matchup
  const bestScore = scoredMoves[0].score;
  if (switches.length > 0 && oppTypes.length > 0 && bestScore <= 0) {
    const hasBetterSwitch = switches.some(s => {
      const p = state.team[s.idx];
      return p.moves.some(m =>
        m.category !== 'Status' && m.power && m.currentPp > 0 &&
        getTypeEffectiveness(m.type as PokemonType, oppTypes) >= 1
      );
    });
    if (hasBetterSwitch) {
      return pickBestSwitch(state, switches, oppTypes, isHard);
    }
  }

  // Hard mode: switch on type disadvantage more aggressively
  if (isHard && switches.length > 0 && oppTypes.length > 0) {
    // Switch if opponent has SE coverage AND we don't have a great move (score < 100)
    if (oppThreat > 1 && bestScore < 100 && Math.random() < 0.65) {
      return pickBestSwitch(state, switches, oppTypes, true);
    }
    // Always switch if opponent has 4x advantage and we're not about to KO
    if (oppThreat >= 4 && bestScore < 150) {
      return pickBestSwitch(state, switches, oppTypes, true);
    }
  }

  // Switch at low HP — harder bot is more willing to sac-switch to save momentum
  const lowHpSwitchChance = isHard ? 0.4 : 0.15;
  if (switches.length > 0 && hpPct < 0.25 && bestScore < 80 && Math.random() < lowHpSwitchChance) {
    return pickBestSwitch(state, switches, oppTypes, isHard);
  }

  return { type: 'move', index: scoredMoves[0].idx };
}

/** Pick the best switch based on type matchup and HP */
function pickBestSwitch(
  state: TurnResultPayload['yourState'],
  switches: { alive: boolean; idx: number }[],
  oppTypes: PokemonType[],
  isHard: boolean = false,
): { type: 'move' | 'switch'; index: number } {
  const ranked = switches
    .map(s => {
      const p = state.team[s.idx];
      const pTypes = p.species.types as PokemonType[];
      let score = p.currentHp / p.maxHp; // HP ratio as base

      if (oppTypes.length > 0) {
        // Bonus for having super effective moves against opponent
        for (const move of p.moves) {
          if (move.category !== 'Status' && move.power && move.currentPp > 0) {
            const eff = getTypeEffectiveness(move.type as PokemonType, oppTypes);
            if (eff > 1) score += isHard ? 0.7 : 0.5;
            // Hard: STAB SE moves are even better
            if (isHard && eff > 1 && pTypes.includes(move.type as PokemonType)) {
              score += 0.3;
            }
          }
        }
        // Bonus for resisting opponent's types (defensive pivot)
        for (const oppType of oppTypes) {
          const eff = getTypeEffectiveness(oppType, pTypes);
          if (eff < 1) score += isHard ? 0.35 : 0.2;
          if (eff === 0) score += isHard ? 0.8 : 0.5;
        }
        // Hard: penalty for being weak to opponent's types
        if (isHard) {
          for (const oppType of oppTypes) {
            const eff = getTypeEffectiveness(oppType, pTypes);
            if (eff > 1) score -= 0.3;
            if (eff >= 4) score -= 0.5;
          }
        }
      }

      // Hard: slight bonus for higher base speed (can outspeed and attack)
      if (isHard) {
        score += (p.species.baseStats?.spe ?? 0) / 500;
      }

      return { ...s, score };
    })
    .sort((a, b) => b.score - a.score);

  return { type: 'switch', index: ranked[0].idx };
}

// --- Connection interface ---

export interface BattleConnection {
  humanSocket: ClientSocket;
  botSocket: ClientSocket | null;
  botName: string;
  playerName: string;
  roomCode: string | null;
  gameMode: 'cpu' | 'online';
  /** Call after creation to wait for sockets and start room flow */
  start: () => void;
  /** Online mode: create a new room */
  startCreateRoom?: (itemMode: 'competitive' | 'casual', maxGen?: number | null, legendaryMode?: boolean, draftMode?: boolean, monotype?: string | null, draftType?: 'snake' | 'role', megaMode?: boolean) => void;
  /** Online mode: join existing room by code */
  startJoinRoom?: (code: string, itemMode: 'competitive' | 'casual') => void;
  /** Attempt to reconnect after app returns from background */
  reconnect: () => void;
  disconnect: () => void;
}

/** Wire human socket events that are shared between CPU and online modes */
function wireHumanEvents(
  humanSocket: ClientSocket,
  conn: BattleConnection,
  dispatch: (action: any) => void,
  playerName: string,
) {
  let hasCreatedRoom = false;
  let intentionalDisconnect = false;

  // Expose intentional disconnect flag via closure
  const setIntentional = (val: boolean) => { intentionalDisconnect = val; };
  const getIntentional = () => intentionalDisconnect;
  const setHasCreated = () => { hasCreatedRoom = true; };
  const getHasCreated = () => hasCreatedRoom;

  humanSocket.on('opponent_joined', ({ name }) => {
    dispatch({ type: 'OPPONENT_JOINED', name });
  });

  humanSocket.on('team_preview', (payload: TeamPreviewPayload) => {
    dispatch({ type: 'TEAM_PREVIEW', payload });
  });

  humanSocket.on('battle_start', (payload: BattleStartPayload) => {
    dispatch({ type: 'BATTLE_START', payload });
  });

  humanSocket.on('turn_result', (payload: TurnResultPayload) => {
    dispatch({ type: 'TURN_RESULT', payload });
  });

  humanSocket.on('needs_switch', (payload: NeedsSwitchPayload) => {
    dispatch({ type: 'NEEDS_SWITCH', payload });
  });

  humanSocket.on('battle_end', (payload: BattleEndPayload) => {
    dispatch({ type: 'BATTLE_END', payload });
  });

  humanSocket.on('draft_start', (payload: DraftStartPayload) => {
    dispatch({ type: 'DRAFT_START', pool: payload.pool, yourPlayerIndex: payload.yourPlayerIndex, draftType: payload.draftType, roleOrder: payload.roleOrder });
  });

  humanSocket.on('draft_pick', (payload: DraftPickBroadcast) => {
    dispatch({ type: 'DRAFT_PICK', playerIndex: payload.playerIndex, poolIndex: payload.poolIndex });
  });

  humanSocket.on('draft_complete', (payload: DraftCompletePayload) => {
    dispatch({ type: 'DRAFT_COMPLETE', yourTeam: payload.yourTeam });
  });

  humanSocket.on('error', (payload) => {
    console.warn('[human socket error]', payload.message);
    // Show error to user instead of silently logging
    dispatch({ type: 'DISCONNECTED' });
  });

  humanSocket.on('room_error', (payload: { message: string }) => {
    console.warn('[room error]', payload.message);
    dispatch({ type: 'DISCONNECTED' });
  });

  humanSocket.on('opponent_disconnected', () => {
    dispatch({ type: 'OPPONENT_DISCONNECTED' });
  });

  humanSocket.on('disconnect', (reason) => {
    console.warn(`[human socket] disconnected: ${reason}`);
    if (getIntentional()) return;
    if (getHasCreated()) {
      // Show reconnecting banner for all disconnect reasons (not just server disconnect)
      dispatch({ type: 'RECONNECTING' });
      // If server explicitly kicked us, go to full disconnect screen
      if (reason === 'io server disconnect') {
        dispatch({ type: 'DISCONNECTED' });
      }
    }
  });

  humanSocket.on('connect', () => {
    console.log(`[human socket] connected (id: ${(humanSocket as any).id})`);
    if (getHasCreated() && conn.roomCode) {
      console.log(`[human socket] auto-rejoining room ${conn.roomCode}`);
      humanSocket.emit('join_room', { code: conn.roomCode, playerName });
      dispatch({ type: 'RECONNECTED' });
    }
  });

  (humanSocket as any).on('reconnect_attempt', (attempt: number) => {
    console.log(`[human socket] reconnect attempt ${attempt}`);
    if (getHasCreated()) {
      dispatch({ type: 'RECONNECTING' });
    }
  });

  (humanSocket as any).on('reconnect_failed', () => {
    console.warn('[human socket] all reconnection attempts failed');
    if (getHasCreated()) {
      dispatch({ type: 'DISCONNECTED' });
    }
  });

  return { setIntentional, getIntentional, setHasCreated, getHasCreated };
}

export function createBattleConnection(
  serverUrl: string,
  playerName: string,
  itemMode: 'competitive' | 'casual',
  dispatch: (action: any) => void,
  maxGen: number | null = null,
  difficulty: BotDifficulty = 'normal',
  legendaryMode: boolean = false,
): BattleConnection {
  botDifficulty = difficulty;
  const humanSocket = io(serverUrl, SOCKET_OPTS) as unknown as ClientSocket;
  const botSocket = io(serverUrl, SOCKET_OPTS) as unknown as ClientSocket;

  const botCandidates = BOT_NAMES.filter(
    n => n.toLowerCase() !== playerName.toLowerCase(),
  );
  const botName =
    botCandidates[Math.floor(Math.random() * botCandidates.length)];

  const conn: BattleConnection = {
    humanSocket,
    botSocket,
    botName,
    playerName,
    roomCode: null,
    gameMode: 'cpu',
    start: () => {},
    reconnect: () => {},
    disconnect: () => {},
  };

  const flags = wireHumanEvents(humanSocket, conn, dispatch, playerName);

  // CPU-specific: room_created triggers bot join
  humanSocket.on('room_created', ({ code }) => {
    conn.roomCode = code;
    flags.setHasCreated();
    dispatch({ type: 'ROOM_CREATED', code, botName });
    botSocket.emit('join_room', { code, playerName: botName });
  });

  // --- Bot socket: auto-handle everything ---

  botSocket.on('team_preview', (_payload: TeamPreviewPayload) => {
    botSocket.emit('select_lead', { pokemonIndex: 0, itemMode: 'competitive' });
  });

  botSocket.on('battle_start', (payload: BattleStartPayload) => {
    const emptySide = {
      stealthRock: false,
      spikesLayers: 0,
      toxicSpikesLayers: 0,
      reflect: 0,
      lightScreen: 0,
      tailwind: 0,
      stickyWeb: false,
      auroraVeil: 0,
    };
    botState = {
      team: payload.yourTeam,
      activePokemonIndex: 0,
      sideEffects: emptySide,
    };
    dispatch({
      type: 'BOT_LEAD_REVEALED',
      lead: payload.yourTeam[0],
      teamSize: payload.yourTeam.length,
    });
  });

  botSocket.on('turn_result', (payload: TurnResultPayload) => {
    botState = payload.yourState;
    botOpponent = payload.opponentVisible?.activePokemon ?? null;
    // If the force switch was resolved, clear the flag
    if (botPendingForceSwitch && payload.events.some(e => e.type === 'switch' || e.type === 'send_out')) {
      botPendingForceSwitch = false;
    }
  });

  botSocket.on('needs_switch', (payload: NeedsSwitchPayload) => {
    console.log(`[bot] needs_switch: reason=${payload.reason}, available=${payload.availableSwitches.length}`);
    botPendingForceSwitch = true;
    const available = payload.availableSwitches;
    if (available.length === 0) {
      console.warn('[bot] needs_switch but no available switches!');
      botPendingForceSwitch = false;
      return;
    }
    const oppTypes = (botOpponent?.species.types ?? []) as PokemonType[];
    const ranked = [...available].sort((a, b) => {
      // Hard mode: consider type matchup for force switches
      if (botDifficulty === 'hard' && oppTypes.length > 0) {
        let scoreA = a.pokemon.currentHp / a.pokemon.maxHp;
        let scoreB = b.pokemon.currentHp / b.pokemon.maxHp;
        const aTypes = a.pokemon.species.types as PokemonType[];
        const bTypes = b.pokemon.species.types as PokemonType[];
        for (const move of a.pokemon.moves) {
          if (move.category !== 'Status' && move.power && move.currentPp > 0) {
            if (getTypeEffectiveness(move.type as PokemonType, oppTypes) > 1) scoreA += 0.5;
          }
        }
        for (const move of b.pokemon.moves) {
          if (move.category !== 'Status' && move.power && move.currentPp > 0) {
            if (getTypeEffectiveness(move.type as PokemonType, oppTypes) > 1) scoreB += 0.5;
          }
        }
        for (const oppType of oppTypes) {
          if (getTypeEffectiveness(oppType, aTypes) < 1) scoreA += 0.2;
          if (getTypeEffectiveness(oppType, bTypes) < 1) scoreB += 0.2;
        }
        return scoreB - scoreA;
      }
      return (b.pokemon.currentHp / b.pokemon.maxHp) - (a.pokemon.currentHp / a.pokemon.maxHp);
    });
    console.log(`[bot] submitting force switch to index ${ranked[0].index} (${ranked[0].pokemon.species.name})`);
    botSocket.emit('submit_force_switch', { pokemonIndex: ranked[0].index });
  });

  botSocket.on('error', (payload) => {
    console.warn('[bot socket error]', payload.message);
  });

  botSocket.on('connect', () => {
    console.log(`[bot socket] connected (id: ${(botSocket as any).id})`);
    if (flags.getHasCreated() && conn.roomCode) {
      console.log(`[bot socket] auto-rejoining room ${conn.roomCode}`);
      botSocket.emit('join_room', { code: conn.roomCode, playerName: botName });
    }
  });

  conn.start = () => {
    flags.setIntentional(false);
    humanSocket.connect();
    botSocket.connect();

    const humanReady = humanSocket.connected
      ? Promise.resolve()
      : new Promise<void>(r => humanSocket.once('connect', r));
    const botReady = botSocket.connected
      ? Promise.resolve()
      : new Promise<void>(r => botSocket.once('connect', r));

    Promise.all([humanReady, botReady]).then(() => {
      dispatch({ type: 'CONNECTED' });
      humanSocket.emit('create_room', { playerName, itemMode, maxGen, legendaryMode });
    });
  };

  conn.reconnect = () => {
    const roomCode = conn.roomCode;
    if (!roomCode) {
      console.warn('[reconnect] No room code to rejoin');
      return;
    }

    console.log(`[reconnect] Attempting to rejoin room ${roomCode}...`);
    flags.setIntentional(false);

    if (!humanSocket.connected) humanSocket.connect();
    if (!botSocket.connected) botSocket.connect();
  };

  conn.disconnect = () => {
    flags.setIntentional(true);
    humanSocket.disconnect();
    botSocket.disconnect();
    botState = null;
    botOpponent = null;
    botPendingForceSwitch = false;
  };

  return conn;
}

/** Create a connection for online multiplayer (no bot socket). */
export function createOnlineConnection(
  serverUrl: string,
  playerName: string,
  itemMode: 'competitive' | 'casual',
  dispatch: (action: any) => void,
  maxGen?: number | null,
  legendaryMode?: boolean,
): BattleConnection {
  const onlineMaxGen = maxGen ?? null;
  const onlineLegendaryMode = legendaryMode ?? false;
  const humanSocket = io(serverUrl, SOCKET_OPTS) as unknown as ClientSocket;

  const conn: BattleConnection = {
    humanSocket,
    botSocket: null,
    botName: '',
    playerName,
    roomCode: null,
    gameMode: 'online',
    start: () => {},
    reconnect: () => {},
    disconnect: () => {},
  };

  const flags = wireHumanEvents(humanSocket, conn, dispatch, playerName);

  // Online-specific: room_created just stores the code
  humanSocket.on('room_created', ({ code }) => {
    conn.roomCode = code;
    flags.setHasCreated();
    dispatch({ type: 'ONLINE_ROOM_CREATED', code });
  });

  conn.start = () => {
    flags.setIntentional(false);
    humanSocket.connect();

    const humanReady = humanSocket.connected
      ? Promise.resolve()
      : new Promise<void>(r => humanSocket.once('connect', r));

    humanReady.then(() => {
      dispatch({ type: 'CONNECTED' });
    });
  };

  conn.startCreateRoom = (im: 'competitive' | 'casual', mg?: number | null, lm?: boolean, dm?: boolean, mono?: string | null, dt?: 'snake' | 'role', mega?: boolean) => {
    humanSocket.emit('create_room', {
      playerName,
      itemMode: im,
      maxGen: mg ?? onlineMaxGen,
      legendaryMode: lm ?? onlineLegendaryMode,
      draftMode: dm ?? false,
      monotype: mono ?? null,
      draftType: dt ?? 'snake',
      megaMode: mega ?? false,
    } as any);
  };

  conn.startJoinRoom = (code: string, im: 'competitive' | 'casual') => {
    // Don't set hasCreated here — only set it when room_created/joined event comes back
    conn.roomCode = code;
    humanSocket.emit('join_room', { code, playerName, itemMode: im });
  };

  conn.reconnect = () => {
    const roomCode = conn.roomCode;
    if (!roomCode) {
      console.warn('[reconnect] No room code to rejoin');
      return;
    }
    console.log(`[reconnect] Attempting to rejoin room ${roomCode}...`);
    flags.setIntentional(false);
    if (!humanSocket.connected) humanSocket.connect();
  };

  conn.disconnect = () => {
    flags.setIntentional(true);
    humanSocket.disconnect();
  };

  return conn;
}

export function submitAction(
  connection: BattleConnection,
  action: { type: 'move' | 'switch'; index: number },
): void {
  connection.humanSocket.emit('submit_action', action);
  // In CPU mode, also submit bot's action (but not if bot has a pending force switch)
  if (connection.botSocket && botState && !botPendingForceSwitch) {
    const botAction = pickSmartAction(botState, botOpponent);
    connection.botSocket.emit('submit_action', botAction);
  }
}

export function submitLead(
  connection: BattleConnection,
  leadIndex: number,
  itemMode: 'competitive' | 'casual' = 'competitive',
): void {
  connection.humanSocket.emit('select_lead', {
    pokemonIndex: leadIndex,
    itemMode,
  });
  // Bot already auto-selects lead 0 in team_preview handler (CPU mode only)
}

export function submitForceSwitch(
  connection: BattleConnection,
  pokemonIndex: number,
): void {
  connection.humanSocket.emit('submit_force_switch', { pokemonIndex });
}

export function submitDraftReroll(connection: BattleConnection): void {
  connection.humanSocket.emit('draft_reroll');
}

export function requestRematch(connection: BattleConnection): void {
  connection.humanSocket.emit('rematch_request');
}
