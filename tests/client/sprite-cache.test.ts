import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock expo-file-system before importing sprite-cache
const mockFileExists = vi.fn(() => false);
const mockFileSize = vi.fn(() => 0);
const mockFileUri = vi.fn(() => 'file:///cache/sprites/test.gif');
const mockDirExists = vi.fn(() => true);
const mockDirCreate = vi.fn();
const mockDirDelete = vi.fn();
const mockFileMove = vi.fn();
const mockDownloadFileAsync = vi.fn();

vi.mock('expo-file-system', () => {
  class MockFile {
    uri: string;
    constructor(dir: any, name: string) {
      this.uri = `file:///cache/sprites/${name}`;
    }
    get exists() { return mockFileExists(); }
    get size() { return mockFileSize(); }
    move(target: any) { mockFileMove(target); }
    static downloadFileAsync = (...args: any[]) => mockDownloadFileAsync(...args);
  }

  class MockDirectory {
    uri: string;
    constructor(...parts: any[]) {
      this.uri = 'file:///cache/sprites';
    }
    get exists() { return mockDirExists(); }
    create() { mockDirCreate(); }
    delete() { mockDirDelete(); }
  }

  return {
    Paths: { cache: 'file:///cache' },
    File: MockFile,
    Directory: MockDirectory,
  };
});

// Dynamic import after mock
let getCachedUri: typeof import('../../src/client/utils/sprite-cache').getCachedUri;
let cacheSprite: typeof import('../../src/client/utils/sprite-cache').cacheSprite;
let clearSpriteCache: typeof import('../../src/client/utils/sprite-cache').clearSpriteCache;
let precacheSprites: typeof import('../../src/client/utils/sprite-cache').precacheSprites;

beforeEach(async () => {
  vi.resetModules();
  mockFileExists.mockReturnValue(false);
  mockFileSize.mockReturnValue(0);
  mockDirExists.mockReturnValue(true);
  mockDirCreate.mockClear();
  mockDirDelete.mockClear();
  mockFileMove.mockClear();
  mockDownloadFileAsync.mockReset();

  const mod = await import('../../src/client/utils/sprite-cache');
  getCachedUri = mod.getCachedUri;
  cacheSprite = mod.cacheSprite;
  clearSpriteCache = mod.clearSpriteCache;
  precacheSprites = mod.precacheSprites;
});

describe('sprite-cache', () => {
  describe('getCachedUri', () => {
    it('returns null for uncached URL', () => {
      expect(getCachedUri('https://example.com/sprite.gif')).toBeNull();
    });

    it('returns cached URI after cacheSprite', async () => {
      const mockDownloaded = { uri: 'file:///cache/sprites/test.gif', move: vi.fn() };
      mockDownloadFileAsync.mockResolvedValue(mockDownloaded);

      const url = 'https://play.pokemonshowdown.com/sprites/ani/charizard.gif';
      await cacheSprite(url);
      expect(getCachedUri(url)).not.toBeNull();
    });
  });

  describe('cacheSprite', () => {
    it('downloads sprite and returns local URI', async () => {
      const mockDownloaded = { uri: 'file:///cache/sprites/ani_charizard.gif', move: vi.fn() };
      mockDownloadFileAsync.mockResolvedValue(mockDownloaded);

      const url = 'https://play.pokemonshowdown.com/sprites/ani/charizard.gif';
      const result = await cacheSprite(url);
      expect(result).toBeTruthy();
      expect(mockDownloadFileAsync).toHaveBeenCalled();
    });

    it('returns from memory cache on second call', async () => {
      const mockDownloaded = { uri: 'file:///cache/sprites/ani_charizard.gif', move: vi.fn() };
      mockDownloadFileAsync.mockResolvedValue(mockDownloaded);

      const url = 'https://play.pokemonshowdown.com/sprites/ani/charizard.gif';
      await cacheSprite(url);

      mockDownloadFileAsync.mockClear();
      const result = await cacheSprite(url);
      expect(result).toBeTruthy();
      expect(mockDownloadFileAsync).not.toHaveBeenCalled();
    });

    it('returns from disk cache if file exists', async () => {
      mockFileExists.mockReturnValue(true);
      mockFileSize.mockReturnValue(1000);

      const url = 'https://play.pokemonshowdown.com/sprites/ani/garchomp.gif';
      const result = await cacheSprite(url);
      expect(result).toBeTruthy();
      expect(mockDownloadFileAsync).not.toHaveBeenCalled();
    });

    it('deduplicates concurrent downloads of same URL', async () => {
      let resolveDownload: (val: any) => void;
      const downloadPromise = new Promise(r => { resolveDownload = r; });
      mockDownloadFileAsync.mockReturnValue(downloadPromise);

      const url = 'https://play.pokemonshowdown.com/sprites/ani/gengar.gif';

      // Start two concurrent downloads
      const p1 = cacheSprite(url);
      const p2 = cacheSprite(url);

      resolveDownload!({ uri: 'file:///cache/sprites/ani_gengar.gif', move: vi.fn() });
      await Promise.all([p1, p2]);

      // Only one download should have been initiated
      expect(mockDownloadFileAsync).toHaveBeenCalledTimes(1);
    });

    it('returns null on download error', async () => {
      mockDownloadFileAsync.mockRejectedValue(new Error('Network error'));

      const url = 'https://play.pokemonshowdown.com/sprites/ani/pikachu.gif';
      const result = await cacheSprite(url);
      expect(result).toBeNull();
    });

    it('creates cache directory if it does not exist', async () => {
      mockDirExists.mockReturnValue(false);
      mockFileExists.mockReturnValue(true);
      mockFileSize.mockReturnValue(1000);

      const url = 'https://play.pokemonshowdown.com/sprites/ani/test.gif';
      await cacheSprite(url);
      expect(mockDirCreate).toHaveBeenCalled();
    });
  });

  describe('clearSpriteCache', () => {
    it('clears memory cache', async () => {
      const mockDownloaded = { uri: 'file:///cache/sprites/test.gif', move: vi.fn() };
      mockDownloadFileAsync.mockResolvedValue(mockDownloaded);

      const url = 'https://play.pokemonshowdown.com/sprites/ani/dragonite.gif';
      await cacheSprite(url);
      expect(getCachedUri(url)).not.toBeNull();

      await clearSpriteCache();
      expect(getCachedUri(url)).toBeNull();
    });

    it('deletes cache directory', async () => {
      mockDirExists.mockReturnValue(true);
      await clearSpriteCache();
      expect(mockDirDelete).toHaveBeenCalled();
    });
  });

  describe('precacheSprites', () => {
    it('triggers download for all URLs', async () => {
      const mockDownloaded = { uri: 'file:///cache/sprites/test.gif', move: vi.fn() };
      mockDownloadFileAsync.mockResolvedValue(mockDownloaded);

      const urls = [
        'https://play.pokemonshowdown.com/sprites/ani/a.gif',
        'https://play.pokemonshowdown.com/sprites/ani/b.gif',
        'https://play.pokemonshowdown.com/sprites/ani/c.gif',
      ];
      precacheSprites(urls);

      // Wait for downloads to complete
      await new Promise(r => setTimeout(r, 10));
      expect(mockDownloadFileAsync).toHaveBeenCalledTimes(3);
    });
  });
});
