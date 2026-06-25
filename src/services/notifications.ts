import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { api } from './api';

const isExpoGo = Constants.executionEnvironment === 'storeClient';

let initialized = false;

async function ensureInitialized(): Promise<boolean> {
  if (initialized) return true;
  if (isExpoGo) return false;
  try {
    const Notifications = await import('expo-notifications');
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
    });
    initialized = true;
    return true;
  } catch {
    return false;
  }
}

async function getExpoPushToken(): Promise<string | null> {
  if (isExpoGo) return null;

  let Device: typeof import('expo-device') | null = null;
  let Notifications: typeof import('expo-notifications') | null = null;
  try {
    Device = await import('expo-device');
    Notifications = await import('expo-notifications');
  } catch {
    return null;
  }
  if (!Device || !Notifications) return null;

  if (!Device.isDevice) {
    return null;
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    return null;
  }

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#003087',
    });
  }

  try {
    const tokenData = await Notifications.getExpoPushTokenAsync();
    return tokenData.data;
  } catch {
    return null;
  }
}

export async function registerForPushNotifications(): Promise<string | null> {
  const ready = await ensureInitialized();
  if (!ready) return null;

  try {
    const token = await getExpoPushToken();
    if (!token) return null;

    await api.notifications.register(token);
    return token;
  } catch {
    return null;
  }
}

export async function unregisterPushNotifications(): Promise<void> {
  if (isExpoGo) return;
  try {
    await api.notifications.unregister();
  } catch {}
}
