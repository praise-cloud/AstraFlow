import { setCache, getCache, clearCache, removeCache } from '../services/cache';

beforeEach(() => {
  if (typeof window !== 'undefined' && window.localStorage) {
    window.localStorage.clear();
  }
});

describe('cache service', () => {
  it('stores and retrieves data', () => {
    setCache('/test', { foo: 'bar' });
    expect(getCache('/test')).toEqual({ foo: 'bar' });
  });

  it('returns null for missing key', () => {
    expect(getCache('/nonexistent')).toBeNull();
  });

  it('returns null for expired cache', () => {
    setCache('/test', 'value', -1000);
    expect(getCache('/test')).toBeNull();
  });

  it('respects custom maxAge', () => {
    setCache('/test', 'value', 60000);
    expect(getCache('/test', -1)).toBeNull();
  });

  it('clears all cache entries', () => {
    setCache('/a', 1);
    setCache('/b', 2);
    clearCache();
    expect(getCache('/a')).toBeNull();
    expect(getCache('/b')).toBeNull();
  });

  it('removes a single cache entry', () => {
    setCache('/a', 1);
    setCache('/b', 2);
    removeCache('/a');
    expect(getCache('/a')).toBeNull();
    expect(getCache('/b')).toEqual(2);
  });

  it('does not affect non-cache localStorage keys', () => {
    window.localStorage.setItem('other_key', 'value');
    setCache('/test', 'data');
    clearCache();
    expect(window.localStorage.getItem('other_key')).toBe('value');
    expect(getCache('/test')).toBeNull();
  });
});
