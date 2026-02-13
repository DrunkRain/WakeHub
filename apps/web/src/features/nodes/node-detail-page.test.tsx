import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { Notifications } from '@mantine/notifications';
import { MemoryRouter, Routes, Route } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NodeDetailPage } from './node-detail-page';
import { theme } from '../../theme/theme';

function renderWithProviders(initialEntries = ['/nodes/node-1']) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MantineProvider theme={theme} defaultColorScheme="dark">
        <Notifications />
        <MemoryRouter initialEntries={initialEntries}>
          <Routes>
            <Route path="/nodes/:id" element={<NodeDetailPage />} />
          </Routes>
        </MemoryRouter>
      </MantineProvider>
    </QueryClientProvider>,
  );
}

const mockNode = {
  id: 'node-1',
  name: 'Mon Proxmox',
  type: 'physical',
  status: 'online',
  ipAddress: '192.168.1.100',
  macAddress: 'AA:BB:CC:DD:EE:FF',
  sshUser: 'root',
  parentId: null,
  capabilities: null,
  platformRef: null,
  serviceUrl: null,
  isPinned: false,
  confirmBeforeShutdown: true,
  discovered: false,
  configured: true,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

const mockNodeWithProxmox = {
  ...mockNode,
  capabilities: {
    proxmox_api: {
      host: '192.168.1.100',
      port: 8006,
      authType: 'token',
      tokenId: 'root@pam!monitoring',
    },
  },
};

const mockNodeWithDocker = {
  ...mockNode,
  capabilities: {
    docker_api: {
      host: '192.168.1.100',
      port: 2375,
    },
  },
};

const mockDiscoveredChild = {
  id: 'vm-1',
  name: 'ubuntu-server',
  type: 'vm',
  status: 'offline',
  ipAddress: null,
  macAddress: null,
  sshUser: null,
  parentId: 'node-1',
  capabilities: null,
  platformRef: { platform: 'proxmox', platformId: 'pve1/100' },
  serviceUrl: null,
  isPinned: false,
  confirmBeforeShutdown: false,
  discovered: true,
  configured: false,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

const mockContainerNode = {
  ...mockNode,
  id: 'container-1',
  name: 'my-nginx',
  type: 'container',
  capabilities: null,
};

beforeEach(() => {
  vi.restoreAllMocks();
});

describe('NodeDetailPage', () => {
  it('should render node header with name, type, status and IP', async () => {
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ data: { node: mockNode } }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ data: { nodes: [] } }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );

    renderWithProviders();

    expect(await screen.findByText('Mon Proxmox')).toBeInTheDocument();
    expect(screen.getByText('Physique')).toBeInTheDocument();
    expect(screen.getByText('online')).toBeInTheDocument();
    expect(screen.getByText(/192\.168\.1\.100/)).toBeInTheDocument();
  });

  it('should show "Configurer Proxmox" button when no proxmox capability', async () => {
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ data: { node: mockNode } }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ data: { nodes: [] } }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );

    renderWithProviders();

    expect(await screen.findByText('Configurer Proxmox')).toBeInTheDocument();
  });

  it('should show "Proxmox connecte" when proxmox is configured', async () => {
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ data: { node: mockNodeWithProxmox } }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ data: { nodes: [] } }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );

    renderWithProviders();

    expect(await screen.findByText(/Proxmox connecte/)).toBeInTheDocument();
  });

  it('should display discovered services section', async () => {
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ data: { node: mockNodeWithProxmox } }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ data: { nodes: [mockDiscoveredChild] } }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );

    renderWithProviders();

    expect(await screen.findByText('ubuntu-server')).toBeInTheDocument();
    expect(screen.getByText(/Services a configurer/)).toBeInTheDocument();
    expect(screen.getByText('Configurer')).toBeInTheDocument();
  });

  it('should render "Retour aux noeuds" link', async () => {
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ data: { node: mockNode } }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ data: { nodes: [] } }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );

    renderWithProviders();

    expect(await screen.findByText('Retour aux noeuds')).toBeInTheDocument();
  });

  it('should show "Configurer Docker" button when no docker capability and not a container', async () => {
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ data: { node: mockNode } }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ data: { nodes: [] } }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );

    renderWithProviders();

    expect(await screen.findByText('Configurer Docker')).toBeInTheDocument();
  });

  it('should show "Docker connecte" when docker is configured', async () => {
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ data: { node: mockNodeWithDocker } }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ data: { nodes: [] } }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );

    renderWithProviders();

    expect(await screen.findByText(/Docker connecte/)).toBeInTheDocument();
    expect(screen.queryByText('Configurer Docker')).not.toBeInTheDocument();
  });

  it('should not show "Configurer Docker" for container type nodes', async () => {
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ data: { node: mockContainerNode } }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ data: { nodes: [] } }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );

    renderWithProviders();

    await screen.findByText('my-nginx');
    expect(screen.queryByText('Configurer Docker')).not.toBeInTheDocument();
  });
});
