import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from './api-fetch';

const API_BASE = '/api/nodes';

interface ErrorResponse {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

interface NodeResponse {
  id: string;
  name: string;
  type: string;
  status: string;
  ipAddress: string | null;
  macAddress: string | null;
  sshUser: string | null;
  parentId: string | null;
  capabilities: unknown;
  platformRef: unknown;
  serviceUrl: string | null;
  isPinned: boolean;
  confirmBeforeShutdown: boolean;
  discovered: boolean;
  configured: boolean;
  createdAt: string;
  updatedAt: string;
}

interface NodesListResponse {
  data: {
    nodes: NodeResponse[];
  };
}

interface CreateNodeResponse {
  data: {
    node: NodeResponse;
  };
}

interface TestConnectionResponse {
  data: {
    success: boolean;
    message: string;
  };
}

export interface CreateNodeRequest {
  name: string;
  type: 'physical' | 'vm' | 'lxc' | 'container';
  ipAddress?: string;
  macAddress?: string;
  sshUser?: string;
  sshPassword?: string;
  parentId?: string;
  serviceUrl?: string;
}

export function useNodes() {
  return useQuery<NodesListResponse, ErrorResponse>({
    queryKey: ['nodes'],
    queryFn: async () => {
      const response = await apiFetch(API_BASE);
      const json = await response.json();
      if (!response.ok) {
        throw json as ErrorResponse;
      }
      return json as NodesListResponse;
    },
  });
}

export function useCreateNode() {
  const queryClient = useQueryClient();

  return useMutation<CreateNodeResponse, ErrorResponse, CreateNodeRequest>({
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
      return json as CreateNodeResponse;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['nodes'] });
    },
  });
}

export function useTestConnection() {
  return useMutation<TestConnectionResponse, ErrorResponse, string>({
    mutationFn: async (nodeId) => {
      const response = await apiFetch(`${API_BASE}/${nodeId}/test-connection`, {
        method: 'POST',
      });
      const json = await response.json();
      if (!response.ok) {
        throw json as ErrorResponse;
      }
      return json as TestConnectionResponse;
    },
  });
}
