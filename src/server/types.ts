/**
 * Server-specific types for the Socket.io battle server.
 */

import { BattlePokemon, Player, BattleEvent, Weather, SideEffects } from '../types';

// --- Room types ---

export type RoomStatus = 'waiting' | 'team_preview' | 'battling' | 'finished';

export interface RoomPlayer {
  socketId: string;
  name: string;
  playerIndex: 0 | 1; // maps to p1/p2
  leadSelected: boolean;
  actionSubmitted: boolean;
  itemMode: 'competitive' | 'casual';
}

// --- Client → Server events ---

export interface CreateRoomPayload {
  playerName: string;
  itemMode?: 'competitive' | 'casual';
  maxGen?: number | null;
  legendaryMode?: boolean;
}

export interface JoinRoomPayload {
  code: string;
  playerName: string;
  itemMode?: 'competitive' | 'casual';
}

export interface SelectLeadPayload {
  pokemonIndex: number;
  itemMode: 'competitive' | 'casual';
}

export interface SubmitActionPayload {
  type: 'move' | 'switch';
  index: number;
}

export interface SubmitForceSwitchPayload {
  pokemonIndex: number;
}

export interface RematchRequestPayload {}

// --- Server → Client events ---

export interface RoomCreatedPayload {
  code: string;
}

export interface OpponentJoinedPayload {
  name: string;
}

/** Sanitized Pokemon visible to the opponent (scouted info only). */
export interface VisiblePokemon {
  species: {
    id: string;
    name: string;
    types: string[];
    baseStats: Record<string, number>;
  };
  level: number;
  currentHp: number;
  maxHp: number;
  status: string | null;
  volatileStatuses: string[]; // Set converted to array
  boosts: Record<string, number>;
  isAlive: boolean;
  ability: string;
}

/** Pokemon sent to the owning player (full info). */
export interface OwnPokemon {
  species: {
    id: string;
    name: string;
    types: string[];
    baseStats: Record<string, number>;
  };
  level: number;
  stats: Record<string, number>;
  currentHp: number;
  maxHp: number;
  status: string | null;
  volatileStatuses: string[]; // Set converted to array
  boosts: Record<string, number>;
  moves: {
    name: string;
    type: string;
    category: string;
    power: number | null;
    accuracy: number | null;
    priority: number;
    currentPp: number;
    maxPp: number;
    disabled: boolean;
    description: string | null;
  }[];
  item: string | null;
  ability: string;
  isAlive: boolean;
  choiceLocked: string | null;
}

export interface TeamPreviewPayload {
  yourTeam: OwnPokemon[];
  yourPlayerIndex: 0 | 1;
}

export interface BattleStartPayload {
  yourTeam: OwnPokemon[];
  yourPlayerIndex: 0 | 1;
  activePokemonIndex?: number;
  opponentLead?: VisiblePokemon;
  opponentName?: string;
  /** Room options (sent so joiner knows what settings the host chose) */
  roomOptions?: {
    maxGen: number | null;
    legendaryMode: boolean;
  };
}

export interface TurnResultPayload {
  events: BattleEvent[];
  yourState: {
    team: OwnPokemon[];
    activePokemonIndex: number;
    sideEffects: SideEffects;
  };
  opponentVisible: {
    activePokemon: VisiblePokemon | null;
    scoutedPokemon: VisiblePokemon[];
    teamSize: number;
    faintedCount: number;
    sideEffects: SideEffects;
  };
  turn: number;
  weather: Weather;
}

export interface NeedsSwitchPayload {
  availableSwitches: { index: number; pokemon: OwnPokemon }[];
  reason?: 'faint' | 'self_switch';
}

export interface BattleEndPayload {
  winner: string; // player name
  reason: string;
  finalState: {
    yourTeam: OwnPokemon[];
    opponentTeam: OwnPokemon[]; // fully revealed on battle end
    turn: number;
    weather: Weather;
  };
}

export interface ErrorPayload {
  message: string;
}

// --- Socket event maps for type-safe handlers ---

export interface ClientToServerEvents {
  create_room: (payload: CreateRoomPayload) => void;
  join_room: (payload: JoinRoomPayload) => void;
  select_lead: (payload: SelectLeadPayload) => void;
  submit_action: (payload: SubmitActionPayload) => void;
  submit_force_switch: (payload: SubmitForceSwitchPayload) => void;
  forfeit: () => void;
  rematch_request: () => void;
}

export interface ServerToClientEvents {
  room_created: (payload: RoomCreatedPayload) => void;
  opponent_joined: (payload: OpponentJoinedPayload) => void;
  team_preview: (payload: TeamPreviewPayload) => void;
  battle_start: (payload: BattleStartPayload) => void;
  turn_result: (payload: TurnResultPayload) => void;
  needs_switch: (payload: NeedsSwitchPayload) => void;
  battle_end: (payload: BattleEndPayload) => void;
  opponent_disconnected: () => void;
  error: (payload: ErrorPayload) => void;
}
