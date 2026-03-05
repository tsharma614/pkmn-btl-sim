import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock expo-constants before importing config
vi.mock('expo-constants', () => ({
  default: {
    expoConfig: null,
  },
}));

import Constants from 'expo-constants';
import { getServerUrl } from '../../src/client/config';

describe('getServerUrl', () => {
  beforeEach(() => {
    // Reset to null config before each test
    (Constants as any).expoConfig = null;
  });

  it('returns localhost default when expoConfig is null', () => {
    (Constants as any).expoConfig = null;
    expect(getServerUrl()).toBe('http://localhost:3000');
  });

  it('returns localhost default when extra is undefined', () => {
    (Constants as any).expoConfig = {};
    expect(getServerUrl()).toBe('http://localhost:3000');
  });

  it('returns localhost default when serverUrl is empty string', () => {
    (Constants as any).expoConfig = { extra: { serverUrl: '' } };
    expect(getServerUrl()).toBe('http://localhost:3000');
  });

  it('returns configured server URL from expoConfig', () => {
    (Constants as any).expoConfig = { extra: { serverUrl: 'https://pbs-server.fly.dev' } };
    expect(getServerUrl()).toBe('https://pbs-server.fly.dev');
  });

  it('returns custom URL when configured', () => {
    (Constants as any).expoConfig = { extra: { serverUrl: 'http://192.168.1.100:3000' } };
    expect(getServerUrl()).toBe('http://192.168.1.100:3000');
  });

  it('returns localhost when serverUrl is undefined in extra', () => {
    (Constants as any).expoConfig = { extra: {} };
    expect(getServerUrl()).toBe('http://localhost:3000');
  });
});
