import { registerForPushNotifications, unregisterPushNotifications } from '../services/notifications';
import { api } from '../services/api';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';

jest.mock('../services/api', () => ({
  api: {
    notifications: {
      register: jest.fn(),
      unregister: jest.fn(),
    },
  },
}));

jest.mock('expo-device', () => ({
  isDevice: true,
}));

jest.mock('expo-notifications', () => ({
  getPermissionsAsync: jest.fn(),
  requestPermissionsAsync: jest.fn(),
  setNotificationChannelAsync: jest.fn(),
  setNotificationHandler: jest.fn(),
  getExpoPushTokenAsync: jest.fn(),
  AndroidImportance: { MAX: 5 },
}));

describe('notifications service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'granted' });
    (Notifications.getExpoPushTokenAsync as jest.Mock).mockResolvedValue({ data: 'expo-dev-mode' });
  });

  describe('registerForPushNotifications', () => {
    it('returns expo-dev-mode token on success', async () => {
      (api.notifications.register as jest.Mock).mockResolvedValue({ message: 'ok' });
      const token = await registerForPushNotifications();
      expect(token).toBe('expo-dev-mode');
      expect(api.notifications.register).toHaveBeenCalledWith('expo-dev-mode');
    });

    it('returns null on failure', async () => {
      (api.notifications.register as jest.Mock).mockRejectedValue(new Error('fail'));
      const token = await registerForPushNotifications();
      expect(token).toBeNull();
    });
  });

  describe('unregisterPushNotifications', () => {
    it('calls unregister API', async () => {
      (api.notifications.unregister as jest.Mock).mockResolvedValue({ message: 'ok' });
      await unregisterPushNotifications();
      expect(api.notifications.unregister).toHaveBeenCalled();
    });

    it('does not throw on failure', async () => {
      (api.notifications.unregister as jest.Mock).mockRejectedValue(new Error('fail'));
      await expect(unregisterPushNotifications()).resolves.toBeUndefined();
    });
  });
});
