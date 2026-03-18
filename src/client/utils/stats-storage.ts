import AsyncStorage from '@react-native-async-storage/async-storage';

// ── Keys ────────────────────────────────────────────────────────────────
const POKEMON_STATS_KEY = '@pbs_pokemon_stats';
const CAMPAIGN_RUNS_KEY = '@pbs_campaign_runs';
const OVERALL_STATS_KEY = '@pbs_overall_stats';
const PROFILE_KEY = '@pbs_profile';

// ── Per-Pokemon Stats ───────────────────────────────────────────────────

export interface PokemonStats {
  /** Species ID (lowercased, e.g. "charizard") */
  speciesId: string;
  /** Display name */
  name: string;
  /** Total KOs across all battles */
  kos: number;
  /** Total damage dealt across all battles */
  damageDealt: number;
}

export async function getPokemonStats(): Promise<Record<string, PokemonStats>> {
  try {
    const raw = await AsyncStorage.getItem(POKEMON_STATS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export async function recordPokemonKO(speciesId: string, name: string): Promise<void> {
  const stats = await getPokemonStats();
  if (!stats[speciesId]) stats[speciesId] = { speciesId, name, kos: 0, damageDealt: 0 };
  stats[speciesId].kos += 1;
  await AsyncStorage.setItem(POKEMON_STATS_KEY, JSON.stringify(stats));
}

export async function recordPokemonDamage(speciesId: string, name: string, damage: number): Promise<void> {
  const stats = await getPokemonStats();
  if (!stats[speciesId]) stats[speciesId] = { speciesId, name, kos: 0, damageDealt: 0 };
  stats[speciesId].damageDealt += damage;
  await AsyncStorage.setItem(POKEMON_STATS_KEY, JSON.stringify(stats));
}

/** Batch update Pokemon stats from a completed battle. */
export async function recordBattlePokemonStats(
  entries: { speciesId: string; name: string; kos: number; damageDealt: number }[],
): Promise<void> {
  const stats = await getPokemonStats();
  for (const e of entries) {
    if (!stats[e.speciesId]) stats[e.speciesId] = { speciesId: e.speciesId, name: e.name, kos: 0, damageDealt: 0 };
    stats[e.speciesId].kos += e.kos;
    stats[e.speciesId].damageDealt += e.damageDealt;
  }
  await AsyncStorage.setItem(POKEMON_STATS_KEY, JSON.stringify(stats));
}

/** Get top N Pokemon sorted by KOs descending. */
export async function getTopPokemonByKOs(n: number = 10): Promise<PokemonStats[]> {
  const stats = await getPokemonStats();
  return Object.values(stats)
    .sort((a, b) => b.kos - a.kos || b.damageDealt - a.damageDealt)
    .slice(0, n);
}

// ── Campaign Run Stats ──────────────────────────────────────────────────

export interface CampaignRun {
  /** 'gauntlet' | 'gym_career' */
  mode: 'gauntlet' | 'gym_career';
  /** How far the player got (e.g. "Battle 5" or "Gym 3") */
  progress: string;
  /** Numeric stage reached (for stats parsing) */
  stageNum?: number;
  /** Team species names used */
  team: string[];
  /** 'win' | 'loss' | 'abandoned' */
  result: 'win' | 'loss' | 'abandoned';
  /** ISO date */
  date: string;
}

const MAX_CAMPAIGN_RUNS = 50;

export async function getCampaignRuns(): Promise<CampaignRun[]> {
  try {
    const raw = await AsyncStorage.getItem(CAMPAIGN_RUNS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export async function saveCampaignRun(run: CampaignRun): Promise<void> {
  const runs = await getCampaignRuns();
  runs.unshift(run);
  if (runs.length > MAX_CAMPAIGN_RUNS) runs.length = MAX_CAMPAIGN_RUNS;
  await AsyncStorage.setItem(CAMPAIGN_RUNS_KEY, JSON.stringify(runs));
}

// ── Overall Stats ───────────────────────────────────────────────────────

export interface OverallStats {
  totalBattles: number;
  totalWins: number;
  totalLosses: number;
  currentWinStreak: number;
  longestWinStreak: number;
  /** Total time played in seconds */
  timePlayed: number;
}

function emptyOverallStats(): OverallStats {
  return {
    totalBattles: 0,
    totalWins: 0,
    totalLosses: 0,
    currentWinStreak: 0,
    longestWinStreak: 0,
    timePlayed: 0,
  };
}

export async function getOverallStats(): Promise<OverallStats> {
  try {
    const raw = await AsyncStorage.getItem(OVERALL_STATS_KEY);
    if (!raw) return emptyOverallStats();
    return { ...emptyOverallStats(), ...JSON.parse(raw) };
  } catch {
    return emptyOverallStats();
  }
}

export async function recordBattleResult(won: boolean, durationSeconds: number = 0): Promise<void> {
  const stats = await getOverallStats();
  stats.totalBattles += 1;
  if (won) {
    stats.totalWins += 1;
    stats.currentWinStreak += 1;
    if (stats.currentWinStreak > stats.longestWinStreak) {
      stats.longestWinStreak = stats.currentWinStreak;
    }
  } else {
    stats.totalLosses += 1;
    stats.currentWinStreak = 0;
  }
  stats.timePlayed += durationSeconds;
  await AsyncStorage.setItem(OVERALL_STATS_KEY, JSON.stringify(stats));
}

// ── Profile ─────────────────────────────────────────────────────────────

export interface PlayerProfile {
  trainerName: string;
  /** Trainer sprite filename from Showdown (e.g. "red", "cynthia") */
  trainerSprite: string;
}

const DEFAULT_PROFILE: PlayerProfile = {
  trainerName: 'Player',
  trainerSprite: 'red',
};

export async function getProfile(): Promise<PlayerProfile> {
  try {
    const raw = await AsyncStorage.getItem(PROFILE_KEY);
    if (!raw) return { ...DEFAULT_PROFILE };
    return { ...DEFAULT_PROFILE, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_PROFILE };
  }
}

export async function saveProfile(profile: Partial<PlayerProfile>): Promise<void> {
  const current = await getProfile();
  const updated = { ...current, ...profile };
  await AsyncStorage.setItem(PROFILE_KEY, JSON.stringify(updated));
}
