import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from './api-fetch';
import type { DependencyNodeInfo, DependencyGraphResponse } from '@wakehub/shared';

const API_BASE = '/api/dependencies';

interface ErrorResponse {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

interface DependenciesResponse {
  data: {
    upstream: DependencyNodeInfo[];
    downstream: DependencyNodeInfo[];
  };
}

interface CreateDependencyResponse {
  data: {
    dependency: {
      id: string;
      fromNodeId: string;
      toNodeId: string;
      createdAt: string;
    };
  };
}

export function useDependencies(nodeId: string) {
  return useQuery<DependenciesResponse, ErrorResponse>({
    queryKey: ['dependencies', nodeId],
    queryFn: async () => {
      const response = await apiFetch(`${API_BASE}?nodeId=${encodeURIComponent(nodeId)}`);
      const json = await response.json();
      if (!response.ok) {
        throw json as ErrorResponse;
      }
      return json as DependenciesResponse;
    },
    enabled: !!nodeId,
  });
}

export function useCreateDependency() {
  const queryClient = useQueryClient();

  return useMutation<CreateDependencyResponse, ErrorResponse, { fromNodeId: string; toNodeId: string }>({
    mutationFn: async (data) => {
      const response = await apiFetch(API_BASE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const json = await response.json();
      if (!response.ok) {
        throw json as ErrorResponse;
      }
      return json as CreateDependencyResponse;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dependencies'] });
    },
  });
}

interface DependencyGraphApiResponse {
  data: DependencyGraphResponse;
}

export function useDependencyGraph() {
  return useQuery<DependencyGraphApiResponse, ErrorResponse>({
    queryKey: ['dependencies', 'graph'],
    queryFn: async () => {
      const response = await apiFetch(`${API_BASE}/graph`);
      const json = await response.json();
      if (!response.ok) {
        throw json as ErrorResponse;
      }
      return json as DependencyGraphApiResponse;
    },
  });
}

export function useDeleteDependency() {
  const queryClient = useQueryClient();

  return useMutation<{ data: { success: boolean } }, ErrorResponse, string>({
    mutationFn: async (dependencyId) => {
      const response = await apiFetch(`${API_BASE}/${dependencyId}`, {
        method: 'DELETE',
      });
      const json = await response.json();
      if (!response.ok) {
        throw json as ErrorResponse;
      }
      return json as { data: { success: boolean } };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dependencies'] });
    },
  });
}
