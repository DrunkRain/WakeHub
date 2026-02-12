import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { DependencyLink, DependencyNodeType, DependencyChainNode, GraphNode, GraphEdge } from '@wakehub/shared';
import { apiFetch } from './api-fetch';

interface ErrorResponse {
  error: {
    code: string;
    message: string;
  };
}

interface DependencyListResponse {
  data: DependencyLink[];
}

interface DependencyResponse {
  data: DependencyLink;
}

interface DependencyChainResponse {
  data: {
    upstream: DependencyChainNode[];
    downstream: DependencyChainNode[];
  };
}

interface CreateDependencyRequest {
  parentType: DependencyNodeType;
  parentId: string;
  childType: DependencyNodeType;
  childId: string;
  isShared?: boolean;
}

interface UpdateDependencyRequest {
  id: string;
  isShared: boolean;
}

export function useNodeDependencies(nodeType: DependencyNodeType, nodeId: string) {
  return useQuery<DependencyListResponse, ErrorResponse>({
    queryKey: ['dependencies', nodeType, nodeId],
    queryFn: async () => {
      const response = await apiFetch(
        `/api/dependencies?nodeType=${nodeType}&nodeId=${nodeId}`,
      );
      const json = await response.json();
      if (!response.ok) throw json as ErrorResponse;
      return json as DependencyListResponse;
    },
    enabled: !!nodeId,
  });
}

export function useCreateDependency() {
  const queryClient = useQueryClient();

  return useMutation<DependencyResponse, ErrorResponse, CreateDependencyRequest>({
    mutationFn: async (data) => {
      const response = await apiFetch('/api/dependencies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const json = await response.json();
      if (!response.ok) throw json as ErrorResponse;
      return json as DependencyResponse;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dependencies'] });
    },
  });
}

export function useDeleteDependency() {
  const queryClient = useQueryClient();

  return useMutation<{ data: { success: boolean } }, ErrorResponse, string>({
    mutationFn: async (id) => {
      const response = await apiFetch(`/api/dependencies/${id}`, {
        method: 'DELETE',
      });
      const json = await response.json();
      if (!response.ok) throw json as ErrorResponse;
      return json as { data: { success: boolean } };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dependencies'] });
    },
  });
}

export function useUpdateDependency() {
  const queryClient = useQueryClient();

  return useMutation<DependencyResponse, ErrorResponse, UpdateDependencyRequest>({
    mutationFn: async ({ id, isShared }) => {
      const response = await apiFetch(`/api/dependencies/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isShared }),
      });
      const json = await response.json();
      if (!response.ok) throw json as ErrorResponse;
      return json as DependencyResponse;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dependencies'] });
    },
  });
}

interface DependencyGraphResponse {
  data: {
    nodes: GraphNode[];
    edges: GraphEdge[];
  };
}

export function useDependencyGraph() {
  return useQuery<DependencyGraphResponse, ErrorResponse>({
    queryKey: ['dependencies', 'graph'],
    queryFn: async () => {
      const response = await apiFetch('/api/dependencies/graph');
      const json = await response.json();
      if (!response.ok) throw json as ErrorResponse;
      return json as DependencyGraphResponse;
    },
  });
}

export function useDependencyChain(nodeType: DependencyNodeType, nodeId: string) {
  return useQuery<DependencyChainResponse, ErrorResponse>({
    queryKey: ['dependencies', 'chain', nodeType, nodeId],
    queryFn: async () => {
      const response = await apiFetch(
        `/api/dependencies/chain?nodeType=${nodeType}&nodeId=${nodeId}`,
      );
      const json = await response.json();
      if (!response.ok) throw json as ErrorResponse;
      return json as DependencyChainResponse;
    },
    enabled: !!nodeId,
  });
}
