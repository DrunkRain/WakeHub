import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Service } from '@wakehub/shared';
import { apiFetch } from './api-fetch';

const API_BASE = '/api/services';

// --- Types ---

interface CreateServiceRequest {
  name: string;
  type: 'physical' | 'proxmox' | 'docker';
  ipAddress: string;
  macAddress?: string;
  sshUser?: string;
  sshPassword?: string;
  apiUrl?: string;
  apiCredentials?: string;
  serviceUrl?: string;
}

interface UpdateServiceRequest {
  name?: string;
  ipAddress?: string;
  macAddress?: string;
  sshUser?: string;
  sshPassword?: string;
  apiUrl?: string;
  apiCredentials?: string;
  serviceUrl?: string;
  pinnedToDashboard?: boolean;
  inactivityTimeout?: number | null;
}

interface TestConnectionRequest {
  type?: 'physical' | 'proxmox' | 'docker';
  host?: string;
  sshUser?: string;
  sshPassword?: string;
  apiUrl?: string;
  authMode?: 'password' | 'token';
  username?: string;
  password?: string;
  tokenId?: string;
  tokenSecret?: string;
}

interface TestConnectionResponse {
  data: {
    success: boolean;
    message: string;
  };
}

interface DiscoverRequest {
  apiUrl: string;
  authMode: 'password' | 'token';
  username?: string;
  password?: string;
  tokenId?: string;
  tokenSecret?: string;
}

interface DockerDiscoverRequest {
  apiUrl: string;
}

interface DiscoveredResource {
  name: string;
  type: 'vm' | 'container';
  platformRef: Record<string, unknown>;
  status: string;
}

interface SaveResourcesRequest {
  parentId: string;
  resources: DiscoveredResource[];
}

interface ServiceResponse {
  data: Service;
}

interface ServicesListResponse {
  data: Service[];
}

interface DiscoverResponse {
  data: DiscoveredResource[];
}

interface ErrorResponse {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

// --- CRUD Hooks ---

export function useCreateService() {
  const queryClient = useQueryClient();

  return useMutation<ServiceResponse, ErrorResponse, CreateServiceRequest>({
    mutationFn: async (data) => {
      const response = await apiFetch(API_BASE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const json = await response.json();
      if (!response.ok) throw json as ErrorResponse;
      return json as ServiceResponse;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['services'] });
    },
  });
}

export function useServices() {
  return useQuery<ServicesListResponse, ErrorResponse>({
    queryKey: ['services'],
    queryFn: async () => {
      const response = await apiFetch(API_BASE);
      const json = await response.json();
      if (!response.ok) throw json as ErrorResponse;
      return json as ServicesListResponse;
    },
  });
}

export function useService(id: string) {
  return useQuery<ServiceResponse, ErrorResponse>({
    queryKey: ['services', id],
    queryFn: async () => {
      const response = await apiFetch(`${API_BASE}/${id}`);
      const json = await response.json();
      if (!response.ok) throw json as ErrorResponse;
      return json as ServiceResponse;
    },
  });
}

export function useUpdateService() {
  const queryClient = useQueryClient();

  return useMutation<ServiceResponse, ErrorResponse, { id: string } & UpdateServiceRequest>({
    mutationFn: async ({ id, ...data }) => {
      const response = await apiFetch(`${API_BASE}/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const json = await response.json();
      if (!response.ok) throw json as ErrorResponse;
      return json as ServiceResponse;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['services'] });
      queryClient.invalidateQueries({ queryKey: ['services', variables.id] });
    },
  });
}

export function useDeleteService() {
  const queryClient = useQueryClient();

  return useMutation<{ data: { success: boolean } }, ErrorResponse, string>({
    mutationFn: async (id) => {
      const response = await apiFetch(`${API_BASE}/${id}`, { method: 'DELETE' });
      const json = await response.json();
      if (!response.ok) throw json as ErrorResponse;
      return json as { data: { success: boolean } };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['services'] });
    },
  });
}

// --- Test Connection ---

export function useTestConnection() {
  return useMutation<TestConnectionResponse, ErrorResponse, TestConnectionRequest>({
    mutationFn: async (data) => {
      const response = await apiFetch(`${API_BASE}/test-connection`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const json = await response.json();
      if (!response.ok) throw json as ErrorResponse;
      return json as TestConnectionResponse;
    },
  });
}

// --- Discovery ---

export function useDiscoverProxmox() {
  return useMutation<DiscoverResponse, ErrorResponse, DiscoverRequest>({
    mutationFn: async (data) => {
      const response = await apiFetch('/api/proxmox/discover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const json = await response.json();
      if (!response.ok) throw json as ErrorResponse;
      return json as DiscoverResponse;
    },
  });
}

export function useDiscoverDocker() {
  return useMutation<DiscoverResponse, ErrorResponse, DockerDiscoverRequest>({
    mutationFn: async (data) => {
      const response = await apiFetch('/api/docker/discover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const json = await response.json();
      if (!response.ok) throw json as ErrorResponse;
      return json as DiscoverResponse;
    },
  });
}

export function useDiscoverServiceResources() {
  return useMutation<DiscoverResponse, ErrorResponse, string>({
    mutationFn: async (serviceId) => {
      const response = await apiFetch(`${API_BASE}/${serviceId}/discover`, {
        method: 'POST',
      });
      const json = await response.json();
      if (!response.ok) throw json as ErrorResponse;
      return json as DiscoverResponse;
    },
  });
}

export function useSaveResources() {
  const queryClient = useQueryClient();

  return useMutation<ServicesListResponse, ErrorResponse, SaveResourcesRequest>({
    mutationFn: async ({ parentId, resources }) => {
      const response = await apiFetch(`${API_BASE}/${parentId}/resources`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resources }),
      });
      const json = await response.json();
      if (!response.ok) throw json as ErrorResponse;
      return json as ServicesListResponse;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['services'] });
      queryClient.invalidateQueries({ queryKey: ['dependencies'] });
    },
  });
}

// Re-export types for consumers
export type { CreateServiceRequest, UpdateServiceRequest, TestConnectionRequest, DiscoveredResource, SaveResourcesRequest, ErrorResponse };
