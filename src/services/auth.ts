const TOKEN_KEY = 'astraflow_token';
const USER_KEY = 'astraflow_user';

function getStorage(): Storage | null {
  try {
    return require('react-native').Platform.OS === 'web'
      ? (typeof window !== 'undefined' ? window.localStorage : null)
      : null;
  } catch {
    return typeof window !== 'undefined' ? window.localStorage : null;
  }
}

export function getToken(): string | null {
  const storage = getStorage();
  return storage?.getItem(TOKEN_KEY) ?? null;
}

export function setToken(token: string): void {
  getStorage()?.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  getStorage()?.removeItem(TOKEN_KEY);
  getStorage()?.removeItem(USER_KEY);
}

export function getUser(): { id: string; email: string; full_name: string; business_type: string } | null {
  const storage = getStorage();
  const raw = storage?.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function setUser(user: object): void {
  getStorage()?.setItem(USER_KEY, JSON.stringify(user));
}

export function isAuthenticated(): boolean {
  return getToken() !== null;
}
