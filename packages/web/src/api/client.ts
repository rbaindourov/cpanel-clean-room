import type { ApiResponse, ApiErrorPayload, AccountRecord, TelemetryData } from '../types/api.ts';

export class ApiError extends Error {
  code: string;
  status: number;
  requestId?: string;
  details?: any;

  constructor(payload: ApiErrorPayload) {
    super(payload.message);
    this.name = 'ApiError';
    this.code = payload.code || 'UNKNOWN_ERROR';
    this.status = payload.status !== undefined ? payload.status : 500;
    this.requestId = payload.requestId;
    this.details = payload.details;
  }
}

export interface RequestOptions extends RequestInit {
  impersonateUser?: string | null;
}

export class ApiClient {
  private baseUrl = '/api/v1';

  public getToken(): string | null {
    if (typeof localStorage === 'undefined') return null;
    return localStorage.getItem('panel_access_token') || localStorage.getItem('panel_token');
  }

  public setToken(token: string | null): void {
    if (typeof localStorage === 'undefined') return;
    if (token) {
      localStorage.setItem('panel_access_token', token);
      localStorage.setItem('panel_token', token);
    } else {
      localStorage.removeItem('panel_access_token');
      localStorage.removeItem('panel_token');
    }
  }

  public getRefreshToken(): string | null {
    if (typeof localStorage === 'undefined') return null;
    return localStorage.getItem('panel_refresh_token');
  }

  public setRefreshToken(token: string | null): void {
    if (typeof localStorage === 'undefined') return;
    if (token) {
      localStorage.setItem('panel_refresh_token', token);
    } else {
      localStorage.removeItem('panel_refresh_token');
    }
  }

  public getImpersonateUser(): string | null {
    if (typeof localStorage === 'undefined') return null;
    return localStorage.getItem('panel_impersonate_user');
  }

  public setImpersonateUser(user: string | null): void {
    if (typeof localStorage === 'undefined') return;
    if (user) {
      localStorage.setItem('panel_impersonate_user', user);
    } else {
      localStorage.removeItem('panel_impersonate_user');
    }
  }

  public getHeaders(extraHeaders: Record<string, string> = {}, impersonateUser?: string | null): Headers {
    const headers = new Headers(extraHeaders);
    if (!headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }
    const token = this.getToken();
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }
    const targetImpersonate = impersonateUser !== undefined ? impersonateUser : this.getImpersonateUser();
    if (targetImpersonate) {
      headers.set('X-Impersonate-User', targetImpersonate);
    }
    return headers;
  }

  public async fetch<T = any>(endpoint: string, options: RequestOptions = {}): Promise<T> {
    const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    const url = endpoint.startsWith('http') ? endpoint : `${this.baseUrl}${cleanEndpoint}`;
    const impersonate = options.impersonateUser !== undefined ? options.impersonateUser : this.getImpersonateUser();

    const headers = new Headers(options.headers || {});
    if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
      headers.set('Content-Type', 'application/json');
    }
    const token = this.getToken();
    if (token && !headers.has('Authorization')) {
      headers.set('Authorization', `Bearer ${token}`);
    }
    if (impersonate && !headers.has('X-Impersonate-User')) {
      headers.set('X-Impersonate-User', impersonate);
    }

    let response: Response;
    try {
      response = await fetch(url, { ...options, headers });
    } catch (err: any) {
      throw new ApiError({
        code: 'NETWORK_ERROR',
        message: err.message || 'Failed to connect to server',
        status: 0,
      });
    }

    // Handle 401: Attempt automatic refresh
    if (response.status === 401 && !cleanEndpoint.includes('/auth/login') && !cleanEndpoint.includes('/auth/refresh')) {
      const refreshed = await this.tryTokenRefresh();
      if (refreshed) {
        headers.set('Authorization', `Bearer ${this.getToken()}`);
        response = await fetch(url, { ...options, headers });
      } else {
        this.setToken(null);
        this.setRefreshToken(null);
        this.setImpersonateUser(null);
        if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
          window.location.href = '/login';
        }
        throw new ApiError({ code: 'UNAUTHORIZED', message: 'Session expired', status: 401 });
      }
    }

    const contentType = response.headers.get('content-type') || '';
    const isJson = contentType.includes('json');
    if (!isJson) {
      if (!response.ok) {
        throw new ApiError({
          code: 'HTTP_ERROR',
          message: `Server error (${response.status})`,
          status: response.status,
        });
      }
      return (await response.text()) as unknown as T;
    }

    const data: ApiResponse<T> = await response.json();
    if (!response.ok || data.success === false) {
      const fallbackCode = data.type || data.code || 'UNKNOWN_ERROR';
      const fallbackMessage = data.detail || data.title || data.message || 'Operation failed';
      const fallbackStatus = data.status !== undefined ? data.status : response.status;
      throw new ApiError(
        data.error || {
          code: fallbackCode,
          message: fallbackMessage,
          status: fallbackStatus,
          details: data,
        }
      );
    }

    return data as T;
  }

  public async tryTokenRefresh(): Promise<boolean> {
    const refreshToken = this.getRefreshToken();
    if (!refreshToken) return false;
    try {
      const res = await fetch(`${this.baseUrl}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });
      if (!res.ok) return false;
      const data = await res.json();
      if (data.success && data.accessToken) {
        this.setToken(data.accessToken);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }

  // Generic HTTP methods
  public async get<T = any>(endpoint: string, options: RequestOptions = {}): Promise<T> {
    return this.fetch<T>(endpoint, { ...options, method: 'GET' });
  }

  public async post<T = any>(endpoint: string, body?: any, options: RequestOptions = {}): Promise<T> {
    return this.fetch<T>(endpoint, {
      ...options,
      method: 'POST',
      body: body !== undefined ? (body instanceof FormData ? body : JSON.stringify(body)) : undefined,
    });
  }

  public async put<T = any>(endpoint: string, body?: any, options: RequestOptions = {}): Promise<T> {
    return this.fetch<T>(endpoint, {
      ...options,
      method: 'PUT',
      body: body !== undefined ? (body instanceof FormData ? body : JSON.stringify(body)) : undefined,
    });
  }

  public async patch<T = any>(endpoint: string, body?: any, options: RequestOptions = {}): Promise<T> {
    return this.fetch<T>(endpoint, {
      ...options,
      method: 'PATCH',
      body: body !== undefined ? (body instanceof FormData ? body : JSON.stringify(body)) : undefined,
    });
  }

  public async delete<T = any>(endpoint: string, body?: any, options: RequestOptions = {}): Promise<T> {
    return this.fetch<T>(endpoint, {
      ...options,
      method: 'DELETE',
      body: body !== undefined ? (body instanceof FormData ? body : JSON.stringify(body)) : undefined,
    });
  }

  // Dedicated Domain Resource Helpers
  public auth = {
    login: (body: any) => this.post('/auth/login', body),
    logout: () => this.post('/auth/logout'),
    me: () => this.get('/auth/me'),
  };

  public admin = {
    getAccounts: () => this.get<{ success: boolean; accounts: AccountRecord[] }>('/admin/accounts'),
    createAccount: (data: any) => this.post('/admin/accounts', data),
    suspendAccount: (user: string, reason?: string) => this.post(`/admin/accounts/${user}/suspend`, { reason }),
    resumeAccount: (user: string) => this.post(`/admin/accounts/${user}/resume`),
    deleteAccount: (user: string) => this.delete(`/admin/accounts/${user}`),
    getPackages: () => this.get<{ success: boolean; packages: any[] }>('/admin/packages'),
    getServices: () => this.get<{ success: boolean; services: any[] }>('/admin/services'),
    getTelemetry: () => this.get<{ success: boolean; data?: TelemetryData } & TelemetryData>('/admin/telemetry'),
  };

  public metrics = {
    getResources: () => this.get('/metrics/resources'),
    getBandwidth: () => this.get('/metrics/bandwidth'),
    getVisitors: (domain?: string) => this.get(`/metrics/visitors?domain=${domain || ''}`),
    getErrors: (domain?: string) => this.get(`/metrics/errors?domain=${domain || ''}`),
  };

  public preferences = {
    impersonate: (targetUsername: string) => this.post('/preferences/impersonate', { targetUsername }),
    exitImpersonate: () => this.post('/preferences/impersonate/exit'),
  };

  public databases = {
    getPmaSsoUrl: () => `${this.baseUrl}/databases/pma/sso`,
    getDatabases: () => this.get('/databases/mysql/databases'),
  };
}

export const api = new ApiClient();
