const TOKEN_KEY = 'astraflow_token';
const USER_KEY = 'astraflow_user';

function isWeb(): boolean {
  try {
    return require('react-native').Platform.OS === 'web';
  } catch {
    return typeof window !== 'undefined';
  }
}

async function secureStoreGet(key: string): Promise<string | null> {
  try {
    const SecureStore = require('expo-secure-store');
    return await SecureStore.getItemAsync(key);
  } catch {
    return null;
  }
}

async function secureStoreSet(key: string, value: string): Promise<void> {
  try {
    const SecureStore = require('expo-secure-store');
    await SecureStore.setItemAsync(key, value);
  } catch {}
}

async function secureStoreDelete(key: string): Promise<void> {
  try {
    const SecureStore = require('expo-secure-store');
    await SecureStore.deleteItemAsync(key);
  } catch {}
}

function lsGet(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function lsSet(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {}
}

function lsRemove(key: string): void {
  try {
    window.localStorage.removeItem(key);
  } catch {}
}

function lsGetObject<T>(key: string): T | null {
  const raw = lsGet(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function lsSetObject(key: string, value: object): void {
  lsSet(key, JSON.stringify(value));
}

async function getTokenNative(): Promise<string | null> {
  return secureStoreGet(TOKEN_KEY);
}

async function setTokenNative(token: string): Promise<void> {
  await secureStoreSet(TOKEN_KEY, token);
}

async function clearTokenNative(): Promise<void> {
  await Promise.all([
    secureStoreDelete(TOKEN_KEY),
    secureStoreDelete(USER_KEY),
  ]);
}

async function getUserNative(): Promise<{ id: string; email: string; full_name: string; business_type: string } | null> {
  return secureStoreGet(USER_KEY).then(raw => {
    if (!raw) return null;
    try { return JSON.parse(raw); } catch { return null; }
  });
}

async function setUserNative(user: object): Promise<void> {
  await secureStoreSet(USER_KEY, JSON.stringify(user));
}

async function isAuthenticatedNative(): Promise<boolean> {
  return getTokenNative().then(t => t !== null);
}

export function getToken(): string | null {
  return isWeb() ? lsGet(TOKEN_KEY) : null;
}

export async function setToken(token: string): Promise<void> {
  if (isWeb()) {
    lsSet(TOKEN_KEY, token);
  } else {
    await setTokenNative(token);
  }
}

export async function clearToken(): Promise<void> {
  if (isWeb()) {
    lsRemove(TOKEN_KEY);
    lsRemove(USER_KEY);
  } else {
    await clearTokenNative();
  }
}

export function getUser(): { id: string; email: string; full_name: string; business_type: string } | null {
  return isWeb() ? lsGetObject(USER_KEY) : null;
}

export async function setUser(user: object): Promise<void> {
  if (isWeb()) {
    lsSetObject(USER_KEY, user);
  } else {
    await setUserNative(user);
  }
}

export function isAuthenticated(): boolean | Promise<boolean> {
  return isWeb() ? lsGet(TOKEN_KEY) !== null : isAuthenticatedNative();
}

export async function getTokenAsync(): Promise<string | null> {
  return isWeb() ? Promise.resolve(lsGet(TOKEN_KEY)) : getTokenNative();
}

export async function getUserAsync(): Promise<{ id: string; email: string; full_name: string; business_type: string } | null> {
  return isWeb() ? Promise.resolve(lsGetObject(USER_KEY)) : getUserNative();
}
