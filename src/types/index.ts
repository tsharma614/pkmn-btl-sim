// Core type definitions for the PokéBattle engine

export type PokemonType =
  | 'Normal' | 'Fire' | 'Water' | 'Electric' | 'Grass' | 'Ice'
  | 'Fighting' | 'Poison' | 'Ground' | 'Flying' | 'Psychic' | 'Bug'
  | 'Rock' | 'Ghost' | 'Dragon' | 'Dark' | 'Steel' | 'Fairy';

export type StatusCondition = 'burn' | 'paralysis' | 'sleep' | 'poison' | 'toxic' | 'freeze';
export type VolatileStatus = 'confusion' | 'flinch' | 'leech-seed' | 'trapped' | 'substitute' | 'encore' | 'taunt' | 'torment' | 'disable' | 'protect';

export type Weather = 'sun' | 'rain' | 'sandstorm' | 'hail' | 'none';
export type Terrain = 'grassy' | 'electric' | 'psychic' | 'misty' | 'none';

export type StatName = 'hp' | 'atk' | 'def' | 'spa' | 'spd' | 'spe';
export type BoostableStat = 'atk' | 'def' | 'spa' | 'spd' | 'spe' | 'accuracy' | 'evasion';

export type MoveCategory = 'Physical' | 'Special' | 'Status';
export type Tier = 1 | 2 | 3 | 4;
export type Nature =
  | 'Hardy' | 'Lonely' | 'Brave' | 'Adamant' | 'Naughty'
  | 'Bold' | 'Docile' | 'Relaxed' | 'Impish' | 'Lax'
  | 'Timid' | 'Hasty' | 'Serious' | 'Jolly' | 'Naive'
  | 'Modest' | 'Mild' | 'Quiet' | 'Bashful' | 'Rash'
  | 'Calm' | 'Gentle' | 'Sassy' | 'Careful' | 'Quirky';

export interface BaseStats {
  hp: number;
  atk: number;
  def: number;
  spa: number;
  spd: number;
  spe: number;
}

export interface MoveData {
  name: string;
  type: PokemonType;
  category: MoveCategory;
  power: number | null;       // null for status moves
  accuracy: number | null;    // null = always hits
  pp: number;
  priority: number;
  flags: MoveFlags;
  effects?: MoveEffect[];
  target: MoveTarget;
  description?: string;
  selfdestruct?: boolean;     // true for Explosion, Self-Destruct — user faints after use
  selfSwitch?: boolean | 'copyvolatile';  // true for U-Turn/Volt Switch, "copyvolatile" for Baton Pass
  forceSwitch?: boolean;      // true for Roar/Whirlwind — forces opponent to switch
  volatileStatus?: string | null;  // e.g. "encore", "taunt" — applied to target
  willCrit?: boolean;
  critRatio?: number;
  status?: string | null;     // direct status to apply (from Showdown data)
  boosts?: Partial<Record<BoostableStat, number>> | null;     // boosts applied to target
  selfBoosts?: Partial<Record<BoostableStat, number>> | null; // boosts applied to self
}

export interface MoveFlags {
  contact?: boolean;
  sound?: boolean;
  bullet?: boolean;
  punch?: boolean;
  bite?: boolean;
  pulse?: boolean;
  recoil?: number;          // fraction of damage dealt (e.g., 0.33)
  drain?: number;           // fraction of damage drained (e.g., 0.5)
  multiHit?: [number, number]; // [min, max] hits
  charge?: boolean;         // two-turn move
  recharge?: boolean;       // must recharge next turn (Hyper Beam, Giga Impact)
  protect?: boolean;        // blocked by Protect
  mirror?: boolean;         // reflected by Mirror Move
  defrost?: boolean;        // thaws user if frozen
}

export type MoveTarget = 'normal' | 'self' | 'allAdjacentFoes' | 'allAdjacent' | 'allyTeam' | 'foeSide' | 'allySide' | 'all';

export interface MoveEffect {
  type: 'status' | 'boost' | 'weather' | 'hazard' | 'heal' | 'flinch' | 'recoil' | 'drain' | 'custom';
  chance?: number;        // % chance (100 = guaranteed)
  status?: StatusCondition;
  stat?: BoostableStat;
  stages?: number;
  target?: 'self' | 'target';
  weather?: Weather;
  hazard?: string;
  amount?: number;
  handler?: string;       // name of custom handler
}

export interface PokemonSpecies {
  id: string;             // lowercase hyphenated (e.g., 'garchomp')
  name: string;           // display name
  dexNum: number;
  types: [PokemonType] | [PokemonType, PokemonType];
  baseStats: BaseStats;
  abilities: string[];    // possible abilities
  bestAbility: string;    // competitive best ability
  tier: Tier;
  generation: number;
  weightkg: number;       // weight in kg (for Heavy Slam, Low Kick, etc.)
  movePool: string[];     // all learnable moves
  sets: PokemonSet[];     // competitive sets
}

export interface PokemonSet {
  moves: string[];
  ability: string;
  item: string;
  nature: Nature;
  evs: Partial<BaseStats>;
}

export interface BattlePokemon {
  species: PokemonSpecies;
  nickname?: string;
  level: number;
  set: PokemonSet;
  stats: BaseStats;       // calculated stats with EVs/IVs/Nature
  currentHp: number;
  maxHp: number;
  status: StatusCondition | null;
  volatileStatuses: Set<VolatileStatus>;
  boosts: Record<BoostableStat, number>;
  moves: BattleMove[];
  item: string | null;     // null if consumed/knocked off
  ability: string;
  isAlive: boolean;
  toxicCounter: number;    // increments each turn for toxic
  sleepTurns: number;
  confusionTurns: number;
  substituteHp: number;
  lastMoveUsed: string | null;
  choiceLocked: string | null;  // move name if choice-locked
  hasMovedThisTurn: boolean;
  tookDamageThisTurn: boolean;
  protectedLastTurn: boolean;
  timesHit: number;        // for Rage Fist tracking
  lastDamageTaken: { amount: number; physical: boolean } | null; // for Counter/Mirror Coat
  encoreTurns: number;     // turns remaining under Encore
  encoreMove: string | null; // move name locked by Encore
  truantNextTurn: boolean;  // Truant: skip next turn
  mustRecharge: boolean;    // Recharge: must skip next turn (Hyper Beam etc.)
  turnsOnField: number;     // Turns since entering battle (for Fake Out, etc.)
  itemConsumed: boolean;    // True if held item was consumed (Focus Sash, Weakness Policy, etc.)
  flashFireActive: boolean; // True if Flash Fire has been activated (1.5x Fire moves)
  battleStats: { kos: number; damageDealt: number; timesFainted: number };
}

export interface BattleMove {
  data: MoveData;
  currentPp: number;
  maxPp: number;
  disabled: boolean;
}

export interface Player {
  id: string;
  name: string;
  team: BattlePokemon[];
  activePokemonIndex: number;
  itemMode: 'competitive' | 'casual';
  hasMegaEvolved: boolean;
}

export type ActionType = 'move' | 'switch' | 'forfeit';

export interface MoveAction {
  type: 'move';
  playerId: string;
  moveIndex: number;
}

export interface SwitchAction {
  type: 'switch';
  playerId: string;
  pokemonIndex: number;
}

export interface ForfeitAction {
  type: 'forfeit';
  playerId: string;
}

export type BattleAction = MoveAction | SwitchAction | ForfeitAction;

export interface BattleState {
  id: string;
  turn: number;
  players: [Player, Player];
  weather: Weather;
  weatherTurnsRemaining: number;
  terrain: Terrain;
  terrainTurnsRemaining: number;
  trickRoom: number; // turns remaining (0 = inactive)
  fieldEffects: {
    player1Side: SideEffects;
    player2Side: SideEffects;
  };
  status: 'waiting' | 'team_preview' | 'active' | 'finished';
  winner: string | null;
  rngSeed: number;
  log: BattleEvent[];
}

export interface SideEffects {
  stealthRock: boolean;
  spikesLayers: number;       // 0-3
  toxicSpikesLayers: number;  // 0-2
  reflect: number;            // turns remaining
  lightScreen: number;        // turns remaining
  tailwind: number;           // turns remaining
  stickyWeb: boolean;
  auroraVeil: number;         // turns remaining
}

export interface BattleEvent {
  type: string;
  turn: number;
  timestamp: string;
  data: Record<string, unknown>;
}

export interface DamageCalcResult {
  damage: number;
  basePower: number;
  attackStat: number;
  defenseStat: number;
  stab: boolean;
  typeEffectiveness: number;
  weatherModifier: number;
  abilityModifier: number;
  itemModifier: number;
  criticalHit: boolean;
  randomFactor: number;
  finalDamage: number;
}
