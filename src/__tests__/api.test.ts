import { api, ApiError, API_BASE } from '../services/api';
import { getToken, clearToken, setToken } from '../services/auth';
import { clearCache } from '../services/cache';

jest.mock('../services/auth', () => ({
  getToken: jest.fn(),
  clearToken: jest.fn(),
  setToken: jest.fn(),
}));

const mockFetch = jest.fn();
global.fetch = mockFetch;

function mockResponse(status: number, body: unknown) {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  } as Response);
}

describe('api client', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    clearCache();
  });

  describe('request handling', () => {
    it('sends GET request without auth token', async () => {
      (getToken as jest.Mock).mockReturnValue(null);
      mockFetch.mockResolvedValue(mockResponse(200, { data: 'ok' }));

      const result = await api.dashboard.get();
      expect(result).toEqual({ data: 'ok' });
      expect(mockFetch).toHaveBeenCalledWith(
        `${API_BASE}/dashboard`,
        expect.objectContaining({
          headers: expect.objectContaining({ 'Content-Type': 'application/json' }),
        })
      );
    });

    it('attaches Bearer token when available', async () => {
      (getToken as jest.Mock).mockReturnValue('my-jwt-token');
      mockFetch.mockResolvedValue(mockResponse(200, { ok: true }));

      await api.prices.history(7);

      expect(mockFetch).toHaveBeenCalledWith(
        `${API_BASE}/prices/history?days=7`,
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer my-jwt-token',
          }),
        })
      );
    });

    it('throws ApiError on network failure', async () => {
      (getToken as jest.Mock).mockReturnValue(null);
      mockFetch.mockRejectedValue(new Error('Network error'));

      await expect(api.dashboard.get()).rejects.toThrow(ApiError);
      await expect(api.dashboard.get()).rejects.toThrow('Network error');
    });

    it('throws ApiError with server error detail', async () => {
      (getToken as jest.Mock).mockReturnValue(null);
      mockFetch.mockResolvedValue(mockResponse(400, { detail: 'Bad request' }));

      await expect(api.dashboard.get()).rejects.toThrow(ApiError);
      await expect(api.dashboard.get()).rejects.toThrow('Bad request');
    });

    it('clears token on 401 response', async () => {
      (getToken as jest.Mock).mockReturnValue('expired-token');
      mockFetch.mockResolvedValue(mockResponse(401, { detail: 'Session expired' }));

      await expect(api.dashboard.get()).rejects.toThrow(ApiError);
      expect(clearToken).toHaveBeenCalled();
    });

    it('fallback detail when json parsing fails on error', async () => {
      (getToken as jest.Mock).mockReturnValue(null);
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        json: () => Promise.reject(new Error('parse fail')),
      } as Response);

      await expect(api.dashboard.get()).rejects.toThrow('Request failed');
    });
  });

  describe('auth endpoints', () => {
    it('calls register with correct payload', async () => {
      (getToken as jest.Mock).mockReturnValue(null);
      const userData = { email: 'a@b.com', password: 'pwd', full_name: 'A', business_type: 'taxi' };
      mockFetch.mockResolvedValue(mockResponse(201, { token: 'jwt', user: { id: '1', ...userData } }));

      const result = await api.auth.register(userData);
      expect(result.token).toBe('jwt');
      expect(mockFetch).toHaveBeenCalledWith(
        `${API_BASE}/auth/register`,
        expect.objectContaining({ method: 'POST', body: JSON.stringify(userData) })
      );
    });

    it('calls login with correct payload', async () => {
      (getToken as jest.Mock).mockReturnValue(null);
      mockFetch.mockResolvedValue(mockResponse(200, { token: 'jwt', user: { id: '1', email: 'a@b.com', full_name: 'A', business_type: 'taxi' } }));

      const result = await api.auth.login({ email: 'a@b.com', password: 'pwd' });
      expect(result.token).toBe('jwt');
    });
  });

  describe('surveys endpoints', () => {
    it('submits survey data', async () => {
      (getToken as jest.Mock).mockReturnValue('token');
      mockFetch.mockResolvedValue(mockResponse(201, { id: 1, message: 'Survey submitted' }));

      const result = await api.surveys.submit({ impact_level: 'high', monthly_fuel_spend: 500 });
      expect(result.id).toBe(1);
    });
  });

});
