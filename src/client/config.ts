/**
 * Client configuration — resolves server URL from Expo config or defaults.
 */

import Constants from 'expo-constants';

const DEFAULT_SERVER_URL = 'http://localhost:3000';

export function getServerUrl(): string {
  return (Constants.expoConfig?.extra?.serverUrl as string) || DEFAULT_SERVER_URL;
}
