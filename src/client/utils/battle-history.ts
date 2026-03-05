import AsyncStorage from '@react-native-async-storage/async-storage';

const HISTORY_KEY = '@pbs_battle_history';
const MAX_RECORDS = 100;

export interface BattleRecord {
  date: string;
  opponent: string;
  result: 'win' | 'loss';
  pokemonLeft: number;
}

export async function saveBattleResult(record: BattleRecord): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(HISTORY_KEY);
    const history: BattleRecord[] = raw ? JSON.parse(raw) : [];
    history.unshift(record);
    if (history.length > MAX_RECORDS) history.length = MAX_RECORDS;
    await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  } catch (e) {
    console.warn('[battle-history] Failed to save:', e);
  }
}

export async function getWinLoss(): Promise<{ wins: number; losses: number }> {
  try {
    const raw = await AsyncStorage.getItem(HISTORY_KEY);
    const history: BattleRecord[] = raw ? JSON.parse(raw) : [];
    let wins = 0;
    let losses = 0;
    for (const r of history) {
      if (r.result === 'win') wins++;
      else losses++;
    }
    return { wins, losses };
  } catch (e) {
    console.warn('[battle-history] Failed to read:', e);
    return { wins: 0, losses: 0 };
  }
}
