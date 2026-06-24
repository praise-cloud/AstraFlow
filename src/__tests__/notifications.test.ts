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
    it('returns a token string on success', async () => {
      (api.notifications.register as jest.Mock).mockResolvedValue({ message: 'ok' });
      const token = await registerForPushNotifications();
      expect(typeof token).toBe('string');
      expect(token!.length).toBeGreaterThan(0);
      expect(api.notifications.register).toHaveBeenCalled();
    });

    it('returns null when API register fails', async () => {
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
