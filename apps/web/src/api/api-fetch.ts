import { getAuthToken } from './auth-token';

/**
 * Wrapper around fetch that automatically includes auth credentials.
 * Sends both cookies (credentials: 'include') and Authorization header.
 */
export function apiFetch(url: string, init?: RequestInit): Promise<Response> {
  const headers = new Headers(init?.headers);
  const token = getAuthToken();
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  return fetch(url, {
    ...init,
    headers,
    credentials: 'include',
  });
}
