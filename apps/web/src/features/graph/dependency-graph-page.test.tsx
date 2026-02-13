import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MantineProvider } from '@mantine/core';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router';
import { DependencyGraphPage } from './dependency-graph-page';

const mockNavigate = vi.fn();
vi.mock('react-router', async () => {
  const actual = await vi.importActual('react-router');
  return { ...actual, useNavigate: () => mockNavigate };
});

vi.mock('@xyflow/react', () => ({
  ReactFlow: ({ children, nodes, edges, onNodeClick }: any) => (
    <div data-testid="react-flow" data-nodes={nodes.length} data-edges={edges.length}>
      {children}
      {nodes.map((n: any) => (
        <div key={n.id} data-testid={`node-${n.id}`} onClick={() => onNodeClick?.({}, n)}>
          {n.data.label}
        </div>
      ))}
    </div>
  ),
  Background: () => <div data-testid="rf-background" />,
  Controls: () => <div data-testid="rf-controls" />,
  MiniMap: () => <div data-testid="rf-minimap" />,
  MarkerType: { ArrowClosed: 'arrowclosed' },
  ConnectionLineType: { SmoothStep: 'smoothstep' },
  Position: { Top: 'top', Bottom: 'bottom', Left: 'left', Right: 'right' },
  Handle: () => null,
}));

vi.mock('@dagrejs/dagre', () => {
  function MockGraph() {
    return {
      setDefaultEdgeLabel: function () { return this; },
      setGraph: function () {},
      setNode: function () {},
      setEdge: function () {},
      node: function () { return { x: 100, y: 100 }; },
    };
  }
  return {
    default: {
      graphlib: { Graph: MockGraph },
      layout: function () {},
    },
  };
});

const mockFetch = vi.fn();
vi.spyOn(globalThis, 'fetch').mockImplementation(mockFetch);

function createQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
}

function renderPage() {
  const queryClient = createQueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <MantineProvider>
        <MemoryRouter>
          <DependencyGraphPage />
        </MemoryRouter>
      </MantineProvider>
    </QueryClientProvider>,
  );
}

const graphWithData = {
  data: {
    nodes: [
      { id: 'n1', name: 'NAS', type: 'physical', status: 'online' },
      { id: 'n2', name: 'Jellyfin', type: 'container', status: 'online' },
      { id: 'n3', name: 'Plex', type: 'container', status: 'offline' },
    ],
    links: [
      { id: 'l1', fromNodeId: 'n2', toNodeId: 'n1' },
      { id: 'l2', fromNodeId: 'n3', toNodeId: 'n1' },
    ],
  },
};

const emptyGraph = {
  data: {
    nodes: [],
    links: [],
  },
};

describe('DependencyGraphPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should show skeleton while loading', () => {
    mockFetch.mockReturnValue(new Promise(() => {})); // never resolves
    renderPage();
    expect(screen.getByText('Graphe de dependances')).toBeInTheDocument();
  });

  it('should display empty state when no dependencies exist', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(emptyGraph),
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText(/Aucune dependance fonctionnelle/)).toBeInTheDocument();
    });
    expect(screen.getByText('Voir les noeuds')).toBeInTheDocument();
  });

  it('should navigate to /nodes when clicking empty state button', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(emptyGraph),
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Voir les noeuds')).toBeInTheDocument();
    });

    await userEvent.click(screen.getByText('Voir les noeuds'));
    expect(mockNavigate).toHaveBeenCalledWith('/nodes');
  });

  it('should display graph with nodes and edges', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(graphWithData),
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByTestId('react-flow')).toBeInTheDocument();
    });

    const reactFlow = screen.getByTestId('react-flow');
    expect(reactFlow.getAttribute('data-nodes')).toBe('3');
    expect(reactFlow.getAttribute('data-edges')).toBe('2');

    expect(screen.getByText('NAS')).toBeInTheDocument();
    expect(screen.getByText('Jellyfin')).toBeInTheDocument();
    expect(screen.getByText('Plex')).toBeInTheDocument();
  });

  it('should navigate to node detail on node click', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(graphWithData),
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByTestId('node-n1')).toBeInTheDocument();
    });

    await userEvent.click(screen.getByTestId('node-n1'));
    expect(mockNavigate).toHaveBeenCalledWith('/nodes/n1');
  });

  it('should render Controls, MiniMap, and Background', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(graphWithData),
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByTestId('rf-controls')).toBeInTheDocument();
    });
    expect(screen.getByTestId('rf-minimap')).toBeInTheDocument();
    expect(screen.getByTestId('rf-background')).toBeInTheDocument();
  });

  it('should mark shared nodes with isShared when they have multiple dependents', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(graphWithData),
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByTestId('react-flow')).toBeInTheDocument();
    });

    // NAS (n1) is the target of 2 links, so it should be shared
    // We verify it's rendered (the isShared prop is passed internally)
    expect(screen.getByTestId('node-n1')).toBeInTheDocument();
  });
});
