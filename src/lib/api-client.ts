const API_BASE = '/api';

interface FetchOptions extends RequestInit {
  params?: Record<string, string>;
}

class ApiClient {
  private getToken(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('auth_token');
  }

  private getHeaders(): HeadersInit {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };
    const token = this.getToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
  }

  async get(path: string, options?: FetchOptions): Promise<Response> {
    const url = `${API_BASE}${path}`;
    const res = await fetch(url, {
      method: 'GET',
      headers: this.getHeaders(),
      ...options,
    });
    return res;
  }

  async post(path: string, body?: unknown, options?: FetchOptions): Promise<Response> {
    const url = `${API_BASE}${path}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: this.getHeaders(),
      body: body ? JSON.stringify(body) : undefined,
      ...options,
    });
    return res;
  }

  async put(path: string, body?: unknown, options?: FetchOptions): Promise<Response> {
    const url = `${API_BASE}${path}`;
    const res = await fetch(url, {
      method: 'PUT',
      headers: this.getHeaders(),
      body: body ? JSON.stringify(body) : undefined,
      ...options,
    });
    return res;
  }

  async delete(path: string, options?: FetchOptions): Promise<Response> {
    const url = `${API_BASE}${path}`;
    const res = await fetch(url, {
      method: 'DELETE',
      headers: this.getHeaders(),
      ...options,
    });
    return res;
  }
}

export const api = new ApiClient();
