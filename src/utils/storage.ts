import { Platform } from 'react-native';

function isWeb(): boolean {
  return Platform.OS === 'web';
}

export async function getItem(key: string): Promise<string | null> {
  if (isWeb()) {
    try { return window.localStorage.getItem(key); } catch { return null; }
  }
  try {
    const SecureStore = require('expo-secure-store');
    return await SecureStore.getItemAsync(key);
  } catch { return null; }
}

export async function setItem(key: string, value: string): Promise<void> {
  if (isWeb()) {
    try { window.localStorage.setItem(key, value); } catch {}
    return;
  }
  try {
    const SecureStore = require('expo-secure-store');
    await SecureStore.setItemAsync(key, value);
  } catch {}
}

export async function deleteItem(key: string): Promise<void> {
  if (isWeb()) {
    try { window.localStorage.removeItem(key); } catch {}
    return;
  }
  try {
    const SecureStore = require('expo-secure-store');
    await SecureStore.deleteItemAsync(key);
  } catch {}
}
