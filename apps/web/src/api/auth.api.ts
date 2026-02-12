import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from './api-fetch';
import { setAuthToken, clearAuthToken } from './auth-token';

const API_BASE = '/api/auth';

interface RegisterRequest {
  username: string;
  password: string;
  passwordConfirm: string;
  securityQuestion: string;
  securityAnswer: string;
}

interface LoginRequest {
  username: string;
  password: string;
  rememberMe?: boolean;
}

interface AuthUserResponse {
  data: {
    userId: string;
    username: string;
    token?: string;
  };
}

type RegisterResponse = AuthUserResponse;

interface CheckSetupResponse {
  data: {
    setupComplete: boolean;
  };
}

interface ErrorResponse {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

/**
 * Register a new user account
 */
export function useRegister() {
  const queryClient = useQueryClient();

  return useMutation<RegisterResponse, ErrorResponse, RegisterRequest>({
    mutationFn: async (data) => {
      const response = await apiFetch(`${API_BASE}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      const json = await response.json();

      if (!response.ok) {
        throw json as ErrorResponse;
      }

      return json as RegisterResponse;
    },
    onSuccess: (data) => {
      if (data.data.token) {
        setAuthToken(data.data.token);
      }
      queryClient.invalidateQueries({ queryKey: ['auth', 'check-setup'] });
    },
  });
}

/**
 * Check if initial setup is complete (user exists)
 */
export function useCheckSetup() {
  return useQuery<CheckSetupResponse, ErrorResponse>({
    queryKey: ['auth', 'check-setup'],
    queryFn: async () => {
      const response = await apiFetch(`${API_BASE}/check-setup`);

      const json = await response.json();

      if (!response.ok) {
        throw json as ErrorResponse;
      }

      return json as CheckSetupResponse;
    },
    retry: false,
    staleTime: Infinity,
  });
}

/**
 * Login with credentials
 */
export function useLogin() {
  const queryClient = useQueryClient();

  return useMutation<AuthUserResponse, ErrorResponse, LoginRequest>({
    mutationFn: async (data) => {
      const response = await apiFetch(`${API_BASE}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      const json = await response.json();

      if (!response.ok) {
        throw json as ErrorResponse;
      }

      return json as AuthUserResponse;
    },
    onSuccess: (data) => {
      if (data.data.token) {
        setAuthToken(data.data.token);
      }
      queryClient.setQueryData(['auth', 'me'], data);
    },
  });
}

/**
 * Logout current user
 */
export function useLogout() {
  const queryClient = useQueryClient();

  return useMutation<{ data: { success: boolean } }, ErrorResponse>({
    mutationFn: async () => {
      const response = await apiFetch(`${API_BASE}/logout`, {
        method: 'POST',
      });

      const json = await response.json();

      if (!response.ok) {
        throw json as ErrorResponse;
      }

      return json;
    },
    onSuccess: () => {
      clearAuthToken();
      queryClient.clear();
    },
  });
}

interface GetSecurityQuestionRequest {
  username: string;
}

interface GetSecurityQuestionResponse {
  data: {
    securityQuestion: string;
  };
}

interface ResetPasswordRequest {
  username: string;
  securityAnswer: string;
  newPassword: string;
  newPasswordConfirm: string;
}

/**
 * Get user's security question for password reset
 */
export function useGetSecurityQuestion() {
  return useMutation<GetSecurityQuestionResponse, ErrorResponse, GetSecurityQuestionRequest>({
    mutationFn: async (data) => {
      const response = await apiFetch(`${API_BASE}/get-security-question`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      const json = await response.json();

      if (!response.ok) {
        throw json as ErrorResponse;
      }

      return json as GetSecurityQuestionResponse;
    },
  });
}

/**
 * Reset password via security question verification
 */
export function useResetPassword() {
  return useMutation<{ data: { success: boolean } }, ErrorResponse, ResetPasswordRequest>({
    mutationFn: async (data) => {
      const response = await apiFetch(`${API_BASE}/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      const json = await response.json();

      if (!response.ok) {
        throw json as ErrorResponse;
      }

      return json as { data: { success: boolean } };
    },
  });
}

/**
 * Get current authenticated user from session
 */
export function useAuth() {
  return useQuery<AuthUserResponse, ErrorResponse>({
    queryKey: ['auth', 'me'],
    queryFn: async () => {
      const response = await apiFetch(`${API_BASE}/me`);

      const json = await response.json();

      if (!response.ok) {
        throw json as ErrorResponse;
      }

      return json as AuthUserResponse;
    },
    retry: false,
    staleTime: 5 * 60 * 1000,
  });
}
