import { getTokenAsync, getUserAsync, setToken, setUser, clearToken } from '../services/auth';

beforeEach(() => {
  if (typeof window !== 'undefined' && window.localStorage) {
    window.localStorage.clear();
  }
});

describe('auth service (secure storage)', () => {
  describe('setToken / getTokenAsync', () => {
    it('stores and retrieves a token', async () => {
      await setToken('test-token-456');
      const token = await getTokenAsync();
      expect(token).toBe('test-token-456');
    });

    it('returns null when no token', async () => {
      const token = await getTokenAsync();
      expect(token).toBeNull();
    });
  });

  describe('setUser / getUserAsync', () => {
    it('stores and retrieves user', async () => {
      const user = { id: '1', email: 'a@b.com', full_name: 'Test', business_type: 'taxi' };
      await setUser(user);
      const result = await getUserAsync();
      expect(result).toEqual(user);
    });
  });

  describe('clearToken', () => {
    it('clears both token and user', async () => {
      await setToken('tok');
      await setUser({ id: '1', email: 'a@b.com', full_name: 'Test', business_type: 'taxi' });
      await clearToken();
      expect(await getTokenAsync()).toBeNull();
      expect(await getUserAsync()).toBeNull();
    });
  });
});
