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

// GET /api/nodes/:id — Single node
export function useNode(id: string) {
  return useQuery<CreateNodeResponse, ErrorResponse>({
    queryKey: ['nodes', id],
    queryFn: async () => {
      const response = await apiFetch(`${API_BASE}/${id}`);
      const json = await response.json();
      if (!response.ok) {
        throw json as ErrorResponse;
      }
      return json as CreateNodeResponse;
    },
    enabled: !!id,
  });
}

// PUT /api/nodes/:id/capabilities/proxmox
export interface ConfigureProxmoxPayload {
  host: string;
  port?: number;
  verifySsl?: boolean;
  authType: 'token' | 'password';
  tokenId?: string;
  tokenSecret?: string;
  username?: string;
  password?: string;
}

interface ConfigureProxmoxResponse {
  data: {
    node: NodeResponse;
    discovered: NodeResponse[];
  };
}

export function useConfigureProxmox() {
  const queryClient = useQueryClient();

  return useMutation<ConfigureProxmoxResponse, ErrorResponse, { nodeId: string; data: ConfigureProxmoxPayload }>({
    mutationFn: async ({ nodeId, data }) => {
      const response = await apiFetch(`${API_BASE}/${nodeId}/capabilities/proxmox`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const json = await response.json();
      if (!response.ok) {
        throw json as ErrorResponse;
      }
      return json as ConfigureProxmoxResponse;
    },
    onSuccess: (_data, { nodeId }) => {
      queryClient.invalidateQueries({ queryKey: ['nodes'] });
      queryClient.invalidateQueries({ queryKey: ['nodes', nodeId] });
    },
  });
}

// PUT /api/nodes/:id/capabilities/docker
export interface ConfigureDockerPayload {
  host: string;
  port: number;
  tlsEnabled?: boolean;
}

interface ConfigureDockerResponse {
  data: {
    node: NodeResponse;
    discovered: NodeResponse[];
  };
}

export function useConfigureDocker() {
  const queryClient = useQueryClient();

  return useMutation<ConfigureDockerResponse, ErrorResponse, { nodeId: string; data: ConfigureDockerPayload }>({
    mutationFn: async ({ nodeId, data }) => {
      const response = await apiFetch(`${API_BASE}/${nodeId}/capabilities/docker`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const json = await response.json();
      if (!response.ok) {
        throw json as ErrorResponse;
      }
      return json as ConfigureDockerResponse;
    },
    onSuccess: (_data, { nodeId }) => {
      queryClient.invalidateQueries({ queryKey: ['nodes'] });
      queryClient.invalidateQueries({ queryKey: ['nodes', nodeId] });
      queryClient.invalidateQueries({ queryKey: ['nodes', 'discovered', nodeId] });
    },
  });
}

// PATCH /api/nodes/:id
export interface UpdateNodePayload {
  name?: string;
  serviceUrl?: string;
  configured?: boolean;
  ipAddress?: string;
  macAddress?: string;
  sshUser?: string;
  sshPassword?: string;
  isPinned?: boolean;
}

export function useUpdateNode() {
  const queryClient = useQueryClient();

  return useMutation<CreateNodeResponse, ErrorResponse, { nodeId: string; data: UpdateNodePayload }>({
    mutationFn: async ({ nodeId, data }) => {
      const response = await apiFetch(`${API_BASE}/${nodeId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const json = await response.json();
      if (!response.ok) {
        throw json as ErrorResponse;
      }
      return json as CreateNodeResponse;
    },
    onSuccess: (_data, { nodeId }) => {
      queryClient.invalidateQueries({ queryKey: ['nodes'] });
      queryClient.invalidateQueries({ queryKey: ['nodes', nodeId] });
    },
  });
}

// DELETE /api/nodes/:id
export function useDeleteNode() {
  const queryClient = useQueryClient();

  return useMutation<{ data: { success: boolean } }, ErrorResponse, string>({
    mutationFn: async (nodeId) => {
      const response = await apiFetch(`${API_BASE}/${nodeId}`, {
        method: 'DELETE',
      });
      const json = await response.json();
      if (!response.ok) {
        throw json as ErrorResponse;
      }
      return json as { data: { success: boolean } };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['nodes'] });
    },
  });
}

// GET /api/nodes?parentId=xxx — children of a node (including discovered+unconfigured)
export function useDiscoveredNodes(parentId: string) {
  return useQuery<NodesListResponse, ErrorResponse>({
    queryKey: ['nodes', 'discovered', parentId],
    queryFn: async () => {
      const response = await apiFetch(`${API_BASE}?parentId=${encodeURIComponent(parentId)}`);
      const json = await response.json();
      if (!response.ok) {
        throw json as ErrorResponse;
      }
      return json as NodesListResponse;
    },
    enabled: !!parentId,
  });
}
