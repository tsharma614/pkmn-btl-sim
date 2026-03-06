/**
 * Sprite caching utility using expo-file-system (v18+ new API).
 * Downloads sprites from Showdown CDN on first load, serves from local cache thereafter.
 * Enables offline play after sprites have been cached from at least one game.
 */

import { Paths, File, Directory } from 'expo-file-system';

const CACHE_DIR = new Directory(Paths.cache, 'sprites');

// Ensure cache directory exists
let dirReady = false;
function ensureDir() {
  if (dirReady) return;
  if (!CACHE_DIR.exists) {
    CACHE_DIR.create();
  }
  dirReady = true;
}

/** Convert a remote URL to a local cache filename */
function urlToFilename(url: string): string {
  const match = url.match(/sprites\/(.+)$/);
  if (match) {
    return match[1].replace(/\//g, '_');
  }
  return url.replace(/[^a-zA-Z0-9._-]/g, '_');
}

// In-memory map: remote URL → local file URI
const memoryCache = new Map<string, string>();
// In-flight downloads to avoid duplicates
const pendingDownloads = new Map<string, Promise<string | null>>();

/**
 * Get a cached local URI for a sprite URL, or null if not cached.
 * Synchronous — returns from memory cache only.
 */
export function getCachedUri(url: string): string | null {
  return memoryCache.get(url) ?? null;
}

/**
 * Ensure a sprite is cached locally. Returns the local URI.
 * Downloads in the background if not cached.
 */
export async function cacheSprite(url: string): Promise<string | null> {
  const cached = memoryCache.get(url);
  if (cached) return cached;

  const pending = pendingDownloads.get(url);
  if (pending) return pending;

  const promise = (async () => {
    try {
      ensureDir();
      const filename = urlToFilename(url);
      const file = new File(CACHE_DIR, filename);

      // Check disk cache
      if (file.exists && file.size > 0) {
        memoryCache.set(url, file.uri);
        return file.uri;
      }

      // Download using the static method
      const downloaded = await File.downloadFileAsync(url, CACHE_DIR);
      // Rename to our desired filename if different
      if (downloaded.uri !== file.uri) {
        // The download creates a file with the remote filename — move it
        try {
          downloaded.move(file);
        } catch {
          // If rename fails, use the downloaded file's URI directly
          memoryCache.set(url, downloaded.uri);
          return downloaded.uri;
        }
      }
      memoryCache.set(url, file.uri);
      return file.uri;
    } catch {
      return null;
    } finally {
      pendingDownloads.delete(url);
    }
  })();

  pendingDownloads.set(url, promise);
  return promise;
}

/**
 * Pre-cache a batch of sprite URLs in the background.
 */
export function precacheSprites(urls: string[]): void {
  for (const url of urls) {
    cacheSprite(url).catch(() => {});
  }
}

/** Clear the entire sprite cache */
export async function clearSpriteCache(): Promise<void> {
  memoryCache.clear();
  dirReady = false;
  try {
    if (CACHE_DIR.exists) CACHE_DIR.delete();
  } catch {}
}
