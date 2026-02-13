import { useQuery } from '@tanstack/react-query';
import { apiFetch } from './api-fetch';

interface ErrorResponse {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

interface DashboardStatsResponse {
  data: {
    nodesOnline: number;
    nodesTotal: number;
    cascadesToday: number;
    avgCascadeDurationMs: number | null;
  };
}

export function useStats() {
  return useQuery<DashboardStatsResponse, ErrorResponse>({
    queryKey: ['stats', 'dashboard'],
    queryFn: async () => {
      const response = await apiFetch('/api/stats/dashboard');
      const json = await response.json();
      if (!response.ok) {
        throw json as ErrorResponse;
      }
      return json as DashboardStatsResponse;
    },
  });
}
