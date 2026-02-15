import { useQuery } from '@tanstack/react-query';
import { apiFetch } from './api-fetch';
import type { OperationLog } from '@wakehub/shared';

const API_BASE = '/api/logs';

export interface LogsFilter {
  limit?: number;
  offset?: number;
  nodeId?: string;
  eventType?: string;
  level?: string;
  cascadeId?: string;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
}

export interface LogsResponse {
  data: { logs: OperationLog[]; total: number };
}

export function useLogsQuery(filters: LogsFilter = {}, options: { enabled?: boolean } = {}) {
  return useQuery<LogsResponse>({
    queryKey: ['logs', filters],
    enabled: options.enabled,
    queryFn: async () => {
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          params.set(key, String(value));
        }
      });
      const url = params.toString() ? `${API_BASE}?${params}` : API_BASE;
      const response = await apiFetch(url);
      const json = await response.json();
      if (!response.ok) throw json;
      return json as LogsResponse;
    },
  });
}
