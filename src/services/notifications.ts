import { api } from './api';

export async function registerForPushNotifications(): Promise<string | null> {
  try {
    await api.notifications.register('expo-dev-mode');
    return 'expo-dev-mode';
  } catch {
    return null;
  }
}

export async function unregisterPushNotifications(): Promise<void> {
  try {
    await api.notifications.unregister();
  } catch {}
}
