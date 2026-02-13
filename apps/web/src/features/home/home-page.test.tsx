import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { MantineProvider } from '@mantine/core';
import { MemoryRouter } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { HomePage } from './home-page';
import React from 'react';

const mockUseNodes = vi.hoisted(() => vi.fn());
const mockUseUpdateNode = vi.hoisted(() => vi.fn());
vi.mock('../../api/nodes.api', () => ({
  useNodes: mockUseNodes,
  useUpdateNode: mockUseUpdateNode,
}));

const mockUseStartCascade = vi.hoisted(() => vi.fn());
const mockUseStopCascade = vi.hoisted(() => vi.fn());
vi.mock('../../api/cascades.api', () => ({
  useStartCascade: mockUseStartCascade,
  useStopCascade: mockUseStopCascade,
}));

const mockUseDependencyGraph = vi.hoisted(() => vi.fn());
const mockUseDependencies = vi.hoisted(() => vi.fn());
vi.mock('../../api/dependencies.api', () => ({
  useDependencyGraph: mockUseDependencyGraph,
  useDependencies: mockUseDependencies,
}));

const mockUseStats = vi.hoisted(() => vi.fn());
vi.mock('../../api/stats.api', () => ({
  useStats: mockUseStats,
}));

function renderWithProviders(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MantineProvider>
        <MemoryRouter>{ui}</MemoryRouter>
      </MantineProvider>
    </QueryClientProvider>,
  );
}

const mockNode = (overrides: Record<string, unknown> = {}) => ({
  id: 'node-1',
  name: 'Mon Serveur',
  type: 'physical',
  status: 'offline',
  ipAddress: '192.168.1.10',
  macAddress: null,
  sshUser: null,
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
  ...overrides,
});

describe('HomePage (Dashboard)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseUpdateNode.mockReturnValue({ mutate: vi.fn() });
    mockUseStartCascade.mockReturnValue({ mutate: vi.fn(), isPending: false });
    mockUseStopCascade.mockReturnValue({ mutate: vi.fn(), isPending: false });
    mockUseDependencyGraph.mockReturnValue({ data: { data: { nodes: [], links: [] } } });
    mockUseDependencies.mockReturnValue({ data: { data: { upstream: [], downstream: [] } }, isLoading: false });
    mockUseStats.mockReturnValue({
      data: { data: { nodesOnline: 0, nodesTotal: 0, cascadesToday: 0, avgCascadeDurationMs: null } },
      isLoading: false,
    });
  });

  it('should render ServiceTiles for pinned nodes', () => {
    mockUseNodes.mockReturnValue({
      data: {
        data: {
          nodes: [
            mockNode({ id: 'n1', name: 'Alpha', isPinned: true }),
            mockNode({ id: 'n2', name: 'Beta', isPinned: true, status: 'online' }),
            mockNode({ id: 'n3', name: 'Gamma', isPinned: false }),
          ],
        },
      },
      isLoading: false,
    });

    renderWithProviders(<HomePage />);

    expect(screen.getByText('Alpha')).toBeInTheDocument();
    expect(screen.getByText('Beta')).toBeInTheDocument();
    expect(screen.queryByText('Gamma')).not.toBeInTheDocument();
  });

  it('should render EmptyState when no nodes are pinned', () => {
    mockUseNodes.mockReturnValue({
      data: {
        data: {
          nodes: [
            mockNode({ id: 'n1', name: 'Alpha', isPinned: false }),
          ],
        },
      },
      isLoading: false,
    });

    renderWithProviders(<HomePage />);

    expect(screen.getByText('Aucun noeud épinglé')).toBeInTheDocument();
    expect(screen.getByText(/Épinglez des noeuds/)).toBeInTheDocument();
  });

  it('should render SkeletonLoader when loading', () => {
    mockUseNodes.mockReturnValue({
      data: undefined,
      isLoading: true,
    });

    const { container } = renderWithProviders(<HomePage />);

    // Skeleton elements should be present
    const skeletons = container.querySelectorAll('[class*="mantine-Skeleton"]');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('should render the Dashboard title', () => {
    mockUseNodes.mockReturnValue({
      data: { data: { nodes: [] } },
      isLoading: false,
    });

    renderWithProviders(<HomePage />);

    expect(screen.getByText('Dashboard')).toBeInTheDocument();
  });

  it('should open ServiceDetailPanel when a ServiceTile is clicked', async () => {
    mockUseNodes.mockReturnValue({
      data: {
        data: {
          nodes: [
            mockNode({ id: 'n1', name: 'Alpha', isPinned: true }),
          ],
        },
      },
      isLoading: false,
    });

    renderWithProviders(<HomePage />);

    // Click on the ServiceTile card
    await userEvent.click(screen.getByRole('article'));

    // The Drawer should open with the correct aria-label
    const drawer = document.querySelector('.mantine-Drawer-root');
    expect(drawer).toBeTruthy();
    expect(drawer).toHaveAttribute('aria-label', 'Détail du service Alpha');
  });
});
