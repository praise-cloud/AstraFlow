import { getToken, clearToken } from './auth';
import { setCache, getCache, removeCache } from './cache';

export const API_BASE = 'http://localhost:8000/api';

export class ApiError extends Error {
  status: number;
  detail: string;

  constructor(status: number, detail: string) {
    super(detail);
    this.status = status;
    this.detail = detail;
  }
}

async function request<T = any>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const url = `${API_BASE}${path}`;
  const method = (options.method ?? 'GET').toUpperCase();
  const isRead = method === 'GET';

  if (isRead) {
    const cached = getCache<T>(path);
    if (cached) return cached;
  }

  let res: Response;
  try {
    res = await fetch(url, { ...options, headers });
  } catch {
    if (isRead) {
      const cached = getCache<T>(path, Infinity);
      if (cached) return cached;
    }
    throw new ApiError(0, 'Network error — unable to reach the server');
  }

  if (res.status === 401) {
    clearToken();
    throw new ApiError(401, 'Session expired. Please log in again.');
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({ detail: 'Request failed' }));
    throw new ApiError(res.status, body.detail || 'Request failed');
  }

  const data: T = await res.json();

  if (isRead) {
    setCache(path, data);
  } else {
    removeCache(path);
  }

  return data;
}

export const api = {
  auth: {
    register: (data: { email: string; password: string; full_name: string; business_type: string }) =>
      request<{ token: string; user: { id: string; email: string; full_name: string; business_type: string } }>(
        '/auth/register',
        { method: 'POST', body: JSON.stringify(data) }
      ),
    login: (data: { email: string; password: string }) =>
      request<{ token: string; user: { id: string; email: string; full_name: string; business_type: string } }>(
        '/auth/login',
        { method: 'POST', body: JSON.stringify(data) }
      ),
  },

  dashboard: {
    get: () =>
      request<{
        current_price: { petrol: number; diesel: number; currency: string; unit: string };
        trend: { petrol: string; petrol_change: number; diesel: string; diesel_change: number };
        risk_level: string;
        impact_score: string;
        recommendation: { title: string; content: string };
        market_update: string;
        business_type: string;
        user_name: string;
      }>('/dashboard'),
  },

  prices: {
    history: (days: number = 30) =>
      request<Array<{ date: string; label: string; petrol: number; diesel: number }>>(
        `/prices/history?days=${days}`
      ),
  },

  predict: {
    get: (liters: number) =>
      request<{
        liters: number;
        price_per_liter: number;
        total_cost: number;
        carbon_footprint_kg: number;
        price_index: string;
        price_alert: boolean;
        alert_message: string | null;
        future_increase_pct: number;
        future_loss: number;
        forecast: {
          avg_forecast_price: number;
          trend: string;
          model: string;
          recommendation: { action: string; title: string; message: string; urgency: string };
        };
      }>(`/predict?liters=${liters}`),

    forecast: (days: number = 30, fuel_type: string = 'petrol') =>
      request<{
        fuel_type: string;
        current_price: number;
        forecast_days: number;
        trend: string;
        change_pct: number;
        avg_forecast: number;
        min_forecast: number;
        max_forecast: number;
        confidence_interval: { lower: number; upper: number };
        points: Array<{ date: string; label: string; predicted: number; lower_bound: number; upper_bound: number }>;
        recommendation: { action: string; title: string; message: string; urgency: string };
        model: string;
      }>(`/forecast?days=${days}&fuel_type=${fuel_type}`),
  },

  surveys: {
    list: () =>
      request<Array<{
        id: number;
        business_type: string;
        monthly_fuel_spend: number | null;
        impact_level: string | null;
        concern_areas: string[] | null;
        comments: string | null;
        submitted_at: string;
      }>>('/surveys'),

    submit: (data: {
      monthly_fuel_spend?: number;
      impact_level?: string;
      concern_areas?: string[];
      comments?: string;
    }) =>
      request<{ id: number; message: string }>('/surveys', {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    insights: () =>
      request<{
        total_surveys: number;
        impact_distribution: Record<string, number>;
        user_recent: Array<{
          id: number;
          impact_level: string | null;
          monthly_fuel_spend: number | null;
          concern_areas: string[] | null;
          submitted_at: string;
        }>;
      }>('/surveys/insights'),
  },

  notifications: {
    register: (token: string) =>
      request<{ message: string }>('/notifications/register', {
        method: 'POST',
        body: JSON.stringify({ token, platform: 'expo' }),
      }),

    unregister: () =>
      request<{ message: string }>('/notifications/register', { method: 'DELETE' }),

    preferences: () =>
      request<{ push_enabled: boolean; alerts_enabled: boolean }>('/notifications/preferences'),
  },

  routes: {
    geocode: (q: string) =>
      request<Array<{
        display_name: string;
        lat: number;
        lng: number;
      }>>(`/routes/geocode?q=${encodeURIComponent(q)}`),

    plan: (data: {
      origin: string;
      destination: string;
      origin_lat?: number;
      origin_lng?: number;
      destination_lat?: number;
      destination_lng?: number;
      fuel_type?: string;
    }) =>
      request<{
        routes: Array<{
          rank: number;
          distance_km: number;
          duration_min: number;
          traffic_delay_min: number;
          congestion: string;
          polyline: string;
          gas_stations: Array<{
            id: number;
            name: string;
            lat: number;
            lng: number;
            brand: string;
            operator: string;
            distance_from_route_km: number;
          }>;
          fuel_cost_usd: number;
          ai_score: number;
          recommendation: string;
          legs: Array<{
            distance_km: number;
            duration_min: number;
            summary: string;
          }>;
        }>;
        fuel_price_used: Record<string, number>;
      }>('/routes/plan', { method: 'POST', body: JSON.stringify(data) }),

    gasStations: (lat: number, lng: number, radius: number = 5) =>
      request<Array<{
        id: number;
        name: string;
        lat: number;
        lng: number;
        brand: string;
        operator: string;
        distance_km: number;
      }>>(`/routes/gas-stations?lat=${lat}&lng=${lng}&radius=${radius}`),
  },

  news: {
    list: () =>
      request<Array<{
        id: number;
        title: string;
        summary: string;
        content: string;
        source: string;
        image_url: string | null;
        published_at: string;
      }>>('/news'),
  },
};
