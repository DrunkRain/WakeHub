import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { MantineProvider } from '@mantine/core';
import { BrowserRouter } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NodesPage } from './nodes-page';
import { theme } from '../../theme/theme';

function renderWithProviders(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MantineProvider theme={theme} defaultColorScheme="dark">
        <BrowserRouter>{ui}</BrowserRouter>
      </MantineProvider>
    </QueryClientProvider>,
  );
}

const mockNode = (overrides: Record<string, unknown> = {}) => ({
  id: '1',
  name: 'Mon Serveur',
  type: 'physical',
  status: 'offline',
  ipAddress: '192.168.1.10',
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
  ...overrides,
});

function mockFetchNodes(nodes: Record<string, unknown>[]) {
  vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
    new Response(JSON.stringify({ data: { nodes } }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }),
  );
}

beforeEach(() => {
  vi.restoreAllMocks();
  window.history.pushState({}, '', '/');

  // Simulate desktop viewport for useMediaQuery
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: query === '(min-width: 992px)',
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
});

describe('NodesPage', () => {
  it('should render the page title', async () => {
    mockFetchNodes([]);
    renderWithProviders(<NodesPage />);
    expect(screen.getByText('Noeuds')).toBeInTheDocument();
  });

  it('should render the add button', async () => {
    mockFetchNodes([]);
    renderWithProviders(<NodesPage />);
    expect(screen.getByLabelText('Ajouter une machine')).toBeInTheDocument();
  });

  // AC #3: Empty state
  it('should show empty state when no nodes exist', async () => {
    mockFetchNodes([]);
    renderWithProviders(<NodesPage />);
    expect(await screen.findByText(/Aucun noeud configuré/)).toBeInTheDocument();
    expect(screen.getByText('Ajouter une machine')).toBeInTheDocument();
  });

  // AC #1: Table with correct columns and data
  it('should display a table with nodes and correct columns', async () => {
    mockFetchNodes([mockNode()]);
    renderWithProviders(<NodesPage />);

    // Wait for data
    expect(await screen.findByText('Mon Serveur')).toBeInTheDocument();

    // Table exists
    const table = screen.getByRole('table');
    expect(table).toBeInTheDocument();
    const tableScope = within(table);

    // Column headers
    expect(tableScope.getByText('Nom')).toBeInTheDocument();
    expect(tableScope.getByText('Type')).toBeInTheDocument();
    expect(tableScope.getByText('Statut')).toBeInTheDocument();

    // Data in table
    expect(tableScope.getByText('Machine')).toBeInTheDocument();
    expect(tableScope.getByText('Eteint')).toBeInTheDocument();
    expect(tableScope.getByText('192.168.1.10')).toBeInTheDocument();
  });

  // AC #1: Multiple node types display correctly
  it('should display different node types with correct labels', async () => {
    mockFetchNodes([
      mockNode({ id: '1', name: 'Serveur', type: 'physical', status: 'online' }),
      mockNode({ id: '2', name: 'Ma VM', type: 'vm', status: 'offline' }),
      mockNode({ id: '3', name: 'Mon LXC', type: 'lxc', status: 'error' }),
      mockNode({ id: '4', name: 'Mon Docker', type: 'container', status: 'starting' }),
    ]);
    renderWithProviders(<NodesPage />);

    expect(await screen.findByText('Serveur')).toBeInTheDocument();
    const table = screen.getByRole('table');
    const tableScope = within(table);

    expect(tableScope.getByText('Ma VM')).toBeInTheDocument();
    expect(tableScope.getByText('Mon LXC')).toBeInTheDocument();
    expect(tableScope.getByText('Mon Docker')).toBeInTheDocument();
    expect(tableScope.getByText('Machine')).toBeInTheDocument();
    expect(tableScope.getByText('VM')).toBeInTheDocument();
    expect(tableScope.getByText('LXC')).toBeInTheDocument();
    expect(tableScope.getByText('Conteneur')).toBeInTheDocument();
  });

  // AC #1: Status badges
  it('should display status badges with correct labels', async () => {
    mockFetchNodes([
      mockNode({ id: '1', name: 'N1', status: 'online' }),
      mockNode({ id: '2', name: 'N2', status: 'offline' }),
      mockNode({ id: '3', name: 'N3', status: 'error' }),
    ]);
    renderWithProviders(<NodesPage />);

    expect(await screen.findByText('N1')).toBeInTheDocument();
    const table = screen.getByRole('table');
    const tableScope = within(table);

    expect(tableScope.getByText('Actif')).toBeInTheDocument();
    expect(tableScope.getByText('Eteint')).toBeInTheDocument();
    expect(tableScope.getByText('Erreur')).toBeInTheDocument();
  });

  // AC #1: IP display with dash for null
  it('should display dash for nodes without IP address', async () => {
    mockFetchNodes([mockNode({ ipAddress: null })]);
    renderWithProviders(<NodesPage />);
    expect(await screen.findByText('Mon Serveur')).toBeInTheDocument();
    const table = screen.getByRole('table');
    expect(within(table).getByText('—')).toBeInTheDocument();
  });

  // AC #7: Node name links to detail page
  it('should render node name as a link to /nodes/:id', async () => {
    mockFetchNodes([mockNode({ id: 'abc-123' })]);
    renderWithProviders(<NodesPage />);

    const link = await screen.findByText('Mon Serveur');
    expect(link.closest('a')).toHaveAttribute('href', '/nodes/abc-123');
  });

  // AC #2: Filter selects are present
  it('should display filter selects for status and type', async () => {
    mockFetchNodes([mockNode()]);
    renderWithProviders(<NodesPage />);

    expect(await screen.findByText('Mon Serveur')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Tous les statuts')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Tous les types')).toBeInTheDocument();
  });

  // AC #2: Node count display
  it('should display the count of filtered nodes', async () => {
    mockFetchNodes([
      mockNode({ id: '1', name: 'N1' }),
      mockNode({ id: '2', name: 'N2' }),
    ]);
    renderWithProviders(<NodesPage />);

    expect(await screen.findByText('2 noeuds')).toBeInTheDocument();
  });

  it('should display singular for one node', async () => {
    mockFetchNodes([mockNode()]);
    renderWithProviders(<NodesPage />);

    expect(await screen.findByText('1 noeud')).toBeInTheDocument();
  });

  // AC #2: Status filtering
  it('should filter nodes by status', async () => {
    const user = userEvent.setup();
    mockFetchNodes([
      mockNode({ id: '1', name: 'Serveur On', status: 'online' }),
      mockNode({ id: '2', name: 'Serveur Off', status: 'offline' }),
    ]);
    renderWithProviders(<NodesPage />);

    expect(await screen.findByText('Serveur On')).toBeInTheDocument();
    expect(screen.getByText('Serveur Off')).toBeInTheDocument();

    // Click the status filter
    await user.click(screen.getByPlaceholderText('Tous les statuts'));
    await user.click(await screen.findByRole('option', { name: 'Actif' }));

    // Only online node visible
    expect(screen.getByText('Serveur On')).toBeInTheDocument();
    expect(screen.queryByText('Serveur Off')).not.toBeInTheDocument();
    expect(screen.getByText('1 noeud')).toBeInTheDocument();
  });

  // AC #2: Type filtering
  it('should filter nodes by type', async () => {
    const user = userEvent.setup();
    mockFetchNodes([
      mockNode({ id: '1', name: 'Mon Serveur', type: 'physical' }),
      mockNode({ id: '2', name: 'Ma VM', type: 'vm' }),
    ]);
    renderWithProviders(<NodesPage />);

    expect(await screen.findByText('Mon Serveur')).toBeInTheDocument();

    await user.click(screen.getByPlaceholderText('Tous les types'));
    await user.click(await screen.findByRole('option', { name: 'VM' }));

    expect(screen.queryByText('Mon Serveur')).not.toBeInTheDocument();
    expect(screen.getByText('Ma VM')).toBeInTheDocument();
  });

  // AC #2: Reset filters
  it('should reset filters when clicking Reinitialiser', async () => {
    const user = userEvent.setup();
    mockFetchNodes([
      mockNode({ id: '1', name: 'Serveur On', status: 'online' }),
      mockNode({ id: '2', name: 'Serveur Off', status: 'offline' }),
    ]);
    renderWithProviders(<NodesPage />);

    expect(await screen.findByText('Serveur On')).toBeInTheDocument();

    // Apply filter
    await user.click(screen.getByPlaceholderText('Tous les statuts'));
    await user.click(await screen.findByRole('option', { name: 'Actif' }));

    expect(screen.queryByText('Serveur Off')).not.toBeInTheDocument();

    // Reset
    await user.click(screen.getByText('Reinitialiser'));

    expect(screen.getByText('Serveur On')).toBeInTheDocument();
    expect(screen.getByText('Serveur Off')).toBeInTheDocument();
    expect(screen.getByText('2 noeuds')).toBeInTheDocument();
  });

  // AC #6: Skeleton loading
  it('should display skeleton loaders while loading', () => {
    // Mock a fetch that never resolves to keep loading state
    vi.spyOn(globalThis, 'fetch').mockReturnValueOnce(new Promise(() => {}));
    const { container } = renderWithProviders(<NodesPage />);

    // Should have skeleton elements
    const skeletons = container.querySelectorAll('.mantine-Skeleton-root');
    expect(skeletons.length).toBeGreaterThan(0);

    // Should NOT show empty state or table data
    expect(screen.queryByText(/Aucun noeud configuré/)).not.toBeInTheDocument();
  });

  // Wizard
  it('should open wizard when add button is clicked', async () => {
    const user = userEvent.setup();
    mockFetchNodes([]);
    renderWithProviders(<NodesPage />);

    await user.click(screen.getByLabelText('Ajouter une machine'));
    expect(await screen.findByPlaceholderText('Mon Serveur')).toBeInTheDocument();
  });
});
