import { getToken, setToken, clearToken, getUser, setUser, isAuthenticated } from '../services/auth';

beforeEach(() => {
  if (typeof window !== 'undefined' && window.localStorage) {
    window.localStorage.clear();
  }
});

describe('auth service', () => {
  describe('getToken / setToken / clearToken', () => {
    it('returns null when no token is stored', () => {
      expect(getToken()).toBeNull();
    });

    it('stores and retrieves a token', () => {
      setToken('test-token-123');
      expect(getToken()).toBe('test-token-123');
    });

    it('clears stored token', () => {
      setToken('test-token-123');
      clearToken();
      expect(getToken()).toBeNull();
    });

    it('returns null after clearing token and user', () => {
      setToken('test-token');
      setUser({ id: '1', email: 'a@b.com', full_name: 'Test', business_type: 'taxi' });
      clearToken();
      expect(getToken()).toBeNull();
      expect(getUser()).toBeNull();
    });
  });

  describe('getUser / setUser', () => {
    const testUser = {
      id: 'user-1',
      email: 'test@example.com',
      full_name: 'John Doe',
      business_type: 'taxi',
    };

    it('returns null when no user is stored', () => {
      expect(getUser()).toBeNull();
    });

    it('stores and retrieves a user object', () => {
      setUser(testUser);
      expect(getUser()).toEqual(testUser);
    });

    it('returns null for invalid JSON in storage', () => {
      const storage = (typeof window !== 'undefined' && window.localStorage) ? window.localStorage : null;
      storage?.setItem('astraflow_user', 'not-valid-json');
      expect(getUser()).toBeNull();
    });
  });

  describe('isAuthenticated', () => {
    it('returns false when no token', () => {
      expect(isAuthenticated()).toBe(false);
    });

    it('returns true when token exists', () => {
      setToken('any-token');
      expect(isAuthenticated()).toBe(true);
    });
  });
});
