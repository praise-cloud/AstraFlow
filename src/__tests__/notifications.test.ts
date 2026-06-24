import { registerForPushNotifications, unregisterPushNotifications } from '../services/notifications';
import { api } from '../services/api';

jest.mock('../services/api', () => ({
  api: {
    notifications: {
      register: jest.fn(),
      unregister: jest.fn(),
    },
  },
}));

describe('notifications service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
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
