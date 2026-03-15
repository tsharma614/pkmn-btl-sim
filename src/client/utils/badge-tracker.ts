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
  /** Map of type name → gym badge info — new format */
  gymBadges: Record<string, GymBadgeInfo>;
}

const EMPTY: BadgeData = { monotypeBadges: {}, gymBadges: {} };

/** Migrate old monotypeBadges to gymBadges format if needed. */
function migrate(data: BadgeData): BadgeData {
  if (!data.gymBadges) {
    data.gymBadges = {};
  }
  // Migrate any monotypeBadges that don't have a gymBadges entry
  for (const [type, date] of Object.entries(data.monotypeBadges)) {
    if (!data.gymBadges[type]) {
      data.gymBadges[type] = {
        earnedDate: date,
        gymLeaderName: '',
        badgeName: '',
      };
    }
  }
  return data;
}

export async function getBadges(): Promise<BadgeData> {
  try {
    const raw = await AsyncStorage.getItem(BADGES_KEY);
    if (!raw) return EMPTY;
    const data = JSON.parse(raw) as BadgeData;
    return migrate(data);
  } catch {
    return EMPTY;
  }
}

export async function earnBadge(
  type: string,
  gymLeaderName?: string,
  badgeName?: string,
): Promise<boolean> {
  try {
    const data = await getBadges();
    if (data.gymBadges[type]) return false; // already earned
    const now = new Date().toISOString();
    data.monotypeBadges[type] = now; // backward compat
    data.gymBadges[type] = {
      earnedDate: now,
      gymLeaderName: gymLeaderName ?? '',
      badgeName: badgeName ?? '',
    };
    await AsyncStorage.setItem(BADGES_KEY, JSON.stringify(data));
    return true; // newly earned
  } catch {
    return false;
  }
}

export async function resetBadges(): Promise<void> {
  await AsyncStorage.setItem(BADGES_KEY, JSON.stringify(EMPTY));
}
