import AsyncStorage from '@react-native-async-storage/async-storage';

const BADGES_KEY = '@pbs_badges';

export interface GymBadgeInfo {
  earnedDate: string;
  gymLeaderName: string;
  badgeName: string;
}

export interface BadgeData {
  /** Map of type name → date earned (ISO string) — legacy format */
  monotypeBadges: Record<string, string>;
  /** Map of type name → array of gym badge wins */
  gymBadges: Record<string, GymBadgeInfo[]>;
}

function emptyBadgeData(): BadgeData {
  return { monotypeBadges: {}, gymBadges: {} };
}

/** Migrate old formats to current array-based format. */
function migrate(data: any): BadgeData {
  if (!data.gymBadges) {
    data.gymBadges = {};
  }
  // Migrate single-object gymBadges to arrays
  for (const [type, val] of Object.entries(data.gymBadges)) {
    if (val && !Array.isArray(val)) {
      data.gymBadges[type] = [val as GymBadgeInfo];
    }
  }
  // Migrate monotypeBadges that don't have a gymBadges entry
  for (const [type, date] of Object.entries(data.monotypeBadges)) {
    if (!data.gymBadges[type] || data.gymBadges[type].length === 0) {
      data.gymBadges[type] = [{
        earnedDate: date as string,
        gymLeaderName: '',
        badgeName: '',
      }];
    }
  }
  return data as BadgeData;
}

export async function getBadges(): Promise<BadgeData> {
  try {
    const raw = await AsyncStorage.getItem(BADGES_KEY);
    if (!raw) return emptyBadgeData();
    const data = JSON.parse(raw);
    return migrate(data);
  } catch {
    return emptyBadgeData();
  }
}

export async function earnBadge(
  type: string,
  gymLeaderName?: string,
  badgeName?: string,
): Promise<boolean> {
  try {
    const data = await getBadges();
    const now = new Date().toISOString();
    data.monotypeBadges[type] = now; // backward compat
    if (!data.gymBadges[type]) data.gymBadges[type] = [];
    data.gymBadges[type].push({
      earnedDate: now,
      gymLeaderName: gymLeaderName ?? '',
      badgeName: badgeName ?? '',
    });
    await AsyncStorage.setItem(BADGES_KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

export async function resetBadges(): Promise<void> {
  await AsyncStorage.setItem(BADGES_KEY, JSON.stringify(emptyBadgeData()));
}

// --- Elite Four tracking ---

const E4_KEY = '@pbs_elite_four';

export interface EliteFourProgress {
  /** Which stages have been cleared (0-3 = E4, 4 = Champion) */
  clearedStages: number[];
  /** Whether the full run (all 5) has been completed */
  championDefeated: boolean;
  /** Date the champion was first defeated */
  completedDate?: string;
}

export async function getEliteFourProgress(): Promise<EliteFourProgress> {
  try {
    const raw = await AsyncStorage.getItem(E4_KEY);
    if (!raw) return { clearedStages: [], championDefeated: false };
    return JSON.parse(raw);
  } catch {
    return { clearedStages: [], championDefeated: false };
  }
}

export async function saveEliteFourProgress(progress: EliteFourProgress): Promise<void> {
  await AsyncStorage.setItem(E4_KEY, JSON.stringify(progress));
}

export async function resetEliteFourProgress(): Promise<void> {
  await AsyncStorage.removeItem(E4_KEY);
}
