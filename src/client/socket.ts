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
  reconnectionAttempts: Infinity,
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
    } else {
      // Status moves: moderate base score
      // Boost moves are better early (high HP)
      const hpPct = active.currentHp / active.maxHp;
      score = 35;

      // Healing moves are great at low HP
      if (m.name === 'Recover' || m.name === 'Roost' || m.name === 'Moonlight' ||
          m.name === 'Synthesis' || m.name === 'Soft-Boiled' || m.name === 'Rest' ||
          m.name === 'Slack Off' || m.name === 'Morning Sun' || m.name === 'Milk Drink') {
        score = hpPct < 0.5 ? 120 : hpPct < 0.75 ? 60 : 10;
      }

      // Setup moves are better at high HP
      const setupMoves = ['Swords Dance', 'Nasty Plot', 'Calm Mind', 'Dragon Dance', 'Bulk Up',
        'Curse', 'Iron Defense', 'Amnesia', 'Agility', 'Shell Smash', 'Quiver Dance',
        'Coil', 'Shift Gear', 'Work Up', 'Hone Claws', 'Tail Glow'];
      if (setupMoves.includes(m.name)) {
        score = hpPct > 0.6 ? 70 : 25;
      }

      // Hazards
      if (m.name === 'Stealth Rock' || m.name === 'Spikes' || m.name === 'Toxic Spikes') {
        score = 65;
      }

      // Status moves targeting opponent
      if (m.name === 'Toxic' || m.name === 'Will-O-Wisp' || m.name === 'Thunder Wave') {
        score = opponent?.status ? 5 : 60;
      }
    }

    // Random factor: none for hard, normal amount for normal
    if (!isHard) {
      score += Math.random() * 15;
    }

    return { ...m, score };
  });

  scoredMoves.sort((a, b) => b.score - a.score);

  // Consider switching if all moves are bad (immune/resisted)
  const bestScore = scoredMoves[0].score;
  const switchThreshold = isHard ? 0.8 : 0.6;
  if (bestScore < 20 && switches.length > 0 && Math.random() < switchThreshold) {
    return pickBestSwitch(state, switches, oppTypes);
  }

  // Hard mode: switch on type disadvantage more aggressively
  if (isHard && switches.length > 0 && oppTypes.length > 0) {
    const botTypes = active.species.types as PokemonType[];
    let disadvantage = false;
    for (const oppType of oppTypes) {
      const eff = getTypeEffectiveness(oppType, botTypes);
      if (eff > 1) { disadvantage = true; break; }
    }
    if (disadvantage && bestScore < 80 && Math.random() < 0.5) {
      return pickBestSwitch(state, switches, oppTypes);
    }
  }

  // Small random switch chance when at low HP
  const hpPct = active.currentHp / active.maxHp;
  const lowHpSwitchChance = isHard ? 0.3 : 0.15;
  if (switches.length > 0 && hpPct < 0.25 && Math.random() < lowHpSwitchChance) {
    return pickBestSwitch(state, switches, oppTypes);
  }

  return { type: 'move', index: scoredMoves[0].idx };
}

/** Pick the best switch based on type matchup and HP */
function pickBestSwitch(
  state: TurnResultPayload['yourState'],
  switches: { alive: boolean; idx: number }[],
  oppTypes: PokemonType[],
): { type: 'move' | 'switch'; index: number } {
  const ranked = switches
    .map(s => {
      const p = state.team[s.idx];
      const pTypes = p.species.types as PokemonType[];
      let score = p.currentHp / p.maxHp; // HP ratio as base

      // Bonus for having super effective STAB moves
      if (oppTypes.length > 0) {
        for (const move of p.moves) {
          if (move.category !== 'Status' && move.power && move.currentPp > 0) {
            const eff = getTypeEffectiveness(move.type as PokemonType, oppTypes);
            if (eff > 1) score += 0.5;
          }
        }
        // Bonus for resisting opponent's types
        for (const oppType of oppTypes) {
          const eff = getTypeEffectiveness(oppType, pTypes);
          if (eff < 1) score += 0.2;
          if (eff === 0) score += 0.5;
        }
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
  startCreateRoom?: (itemMode: 'competitive' | 'casual') => void;
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

  humanSocket.on('error', (payload) => {
    console.warn('[human socket error]', payload.message);
  });

  humanSocket.on('opponent_disconnected', () => {
    dispatch({ type: 'OPPONENT_DISCONNECTED' });
  });

  humanSocket.on('disconnect', (reason) => {
    console.warn(`[human socket] disconnected: ${reason}`);
    if (getIntentional()) return;
    if (getHasCreated() && reason === 'io server disconnect') {
      dispatch({ type: 'DISCONNECTED' });
    }
  });

  humanSocket.on('connect', () => {
    console.log(`[human socket] connected (id: ${(humanSocket as any).id})`);
    if (getHasCreated() && conn.roomCode) {
      console.log(`[human socket] auto-rejoining room ${conn.roomCode}`);
      humanSocket.emit('join_room', { code: conn.roomCode, playerName });
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
      humanSocket.emit('create_room', { playerName, itemMode, maxGen });
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
): BattleConnection {
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

  conn.startCreateRoom = (im: 'competitive' | 'casual') => {
    humanSocket.emit('create_room', { playerName, itemMode: im });
  };

  conn.startJoinRoom = (code: string, im: 'competitive' | 'casual') => {
    flags.setHasCreated();
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

export function requestRematch(connection: BattleConnection): void {
  connection.humanSocket.emit('rematch_request');
}
