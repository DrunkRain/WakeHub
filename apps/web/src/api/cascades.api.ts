import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CascadeRecord } from '@wakehub/shared';
import { apiFetch } from './api-fetch';

interface CascadeResponse {
  data: CascadeRecord;
}

interface ErrorResponse {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export function useStartCascade() {
  const queryClient = useQueryClient();

  return useMutation<CascadeResponse, ErrorResponse, string>({
    mutationFn: async (serviceId) => {
      const response = await apiFetch('/api/cascades/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ serviceId }),
      });

      const json = await response.json();

      if (!response.ok) {
        throw json as ErrorResponse;
      }

      return json as CascadeResponse;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cascade'] });
      queryClient.invalidateQueries({ queryKey: ['services'] });
      queryClient.invalidateQueries({ queryKey: ['stats'] });
    },
  });
}

export function useStopCascade() {
  const queryClient = useQueryClient();

  return useMutation<CascadeResponse, ErrorResponse, string>({
    mutationFn: async (serviceId) => {
      const response = await apiFetch('/api/cascades/stop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ serviceId }),
      });

      const json = await response.json();

      if (!response.ok) {
        throw json as ErrorResponse;
      }

      return json as CascadeResponse;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cascade'] });
      queryClient.invalidateQueries({ queryKey: ['services'] });
      queryClient.invalidateQueries({ queryKey: ['stats'] });
    },
  });
}

export function useCascade(id: string | null) {
  return useQuery<CascadeResponse, ErrorResponse>({
    queryKey: ['cascade', id],
    queryFn: async () => {
      const response = await apiFetch(`/api/cascades/${id}`);

      const json = await response.json();

      if (!response.ok) {
        throw json as ErrorResponse;
      }

      return json as CascadeResponse;
    },
    enabled: !!id,
    refetchInterval: 2000,
  });
}

interface CascadesListResponse {
  data: CascadeRecord[];
}

export function useActiveCascades() {
  return useQuery<CascadesListResponse, ErrorResponse>({
    queryKey: ['cascade', 'active'],
    queryFn: async () => {
      const response = await apiFetch('/api/cascades/active');

      const json = await response.json();

      if (!response.ok) {
        throw json as ErrorResponse;
      }

      return json as CascadesListResponse;
    },
    refetchInterval: 3000,
  });
}

export function useCascadeHistory(serviceId: string | null) {
  return useQuery<CascadesListResponse, ErrorResponse>({
    queryKey: ['cascade', 'history', serviceId],
    queryFn: async () => {
      const response = await apiFetch(
        `/api/cascades/history?serviceId=${encodeURIComponent(serviceId!)}`,
      );
      const json = await response.json();
      if (!response.ok) throw json as ErrorResponse;
      return json as CascadesListResponse;
    },
    enabled: !!serviceId,
  });
}

// --- Cascade progress data (stored in cache by SSE, not fetched) ---

export interface CascadeProgressData {
  cascadeId: string;
  serviceId: string;
  step: number;
  totalSteps: number;
  currentDependency: { id: string; name: string; status: string } | null;
  status: 'in_progress' | 'completed' | 'failed';
}

export function useCascadeProgress(serviceId: string) {
  return useQuery<CascadeProgressData | null>({
    queryKey: ['cascade', 'progress', serviceId],
    queryFn: () => null,
    enabled: false,
    staleTime: Infinity,
  });
}

interface StatsResponse {
  data: {
    activeServices: number;
    cascadesToday: number;
    avgCascadeTime: number;
    inactivityHours: number;
  };
}

export function useStats() {
  return useQuery<StatsResponse, ErrorResponse>({
    queryKey: ['stats'],
    queryFn: async () => {
      const response = await apiFetch('/api/stats');

      const json = await response.json();

      if (!response.ok) {
        throw json as ErrorResponse;
      }

      return json as StatsResponse;
    },
  });
}
