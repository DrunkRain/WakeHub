/**
 * In-memory auth token store.
 * Used as fallback when cookies don't work (e.g., behind code-server proxy).
 * Token is also persisted in sessionStorage to survive page reloads.
 */

const STORAGE_KEY = 'wakehub_session_token';

let token: string | null = null;

export function setAuthToken(newToken: string | null) {
  token = newToken;
  if (newToken) {
    sessionStorage.setItem(STORAGE_KEY, newToken);
  } else {
    sessionStorage.removeItem(STORAGE_KEY);
  }
}

export function getAuthToken(): string | null {
  if (token) return token;
  // Restore from sessionStorage after page reload
  const stored = sessionStorage.getItem(STORAGE_KEY);
  if (stored) {
    token = stored;
    return stored;
  }
  return null;
}

export function clearAuthToken() {
  token = null;
  sessionStorage.removeItem(STORAGE_KEY);
}
