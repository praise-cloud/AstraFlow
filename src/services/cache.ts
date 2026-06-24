const CACHE_PREFIX = 'af_cache_';
const DEFAULT_TTL_MS = 5 * 60 * 1000;

interface CacheEntry<T = unknown> {
  data: T;
  timestamp: number;
  ttl: number;
}

function getStorage(): Storage | null {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null;
  } catch {
    return null;
  }
}

export function getCacheKey(path: string): string {
  return `${CACHE_PREFIX}${path}`;
}

export function setCache<T>(path: string, data: T, ttl: number = DEFAULT_TTL_MS): void {
  const storage = getStorage();
  if (!storage) return;
  const entry: CacheEntry<T> = { data, timestamp: Date.now(), ttl };
  try {
    storage.setItem(getCacheKey(path), JSON.stringify(entry));
  } catch {
    // storage full or unavailable
  }
}

export function getCache<T>(path: string, maxAge?: number): T | null {
  const storage = getStorage();
  if (!storage) return null;
  const raw = storage.getItem(getCacheKey(path));
  if (!raw) return null;
  try {
    const entry: CacheEntry<T> = JSON.parse(raw);
    const age = Date.now() - entry.timestamp;
    const limit = maxAge ?? entry.ttl ?? DEFAULT_TTL_MS;
    if (age > limit) {
      storage.removeItem(getCacheKey(path));
      return null;
    }
    return entry.data;
  } catch {
    storage.removeItem(getCacheKey(path));
    return null;
  }
}

export function clearCache(): void {
  const storage = getStorage();
  if (!storage) return;
  const keys: string[] = [];
  for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i);
    if (key?.startsWith(CACHE_PREFIX)) {
      keys.push(key);
    }
  }
  keys.forEach(k => storage.removeItem(k));
}

export function removeCache(path: string): void {
  getStorage()?.removeItem(getCacheKey(path));
}
