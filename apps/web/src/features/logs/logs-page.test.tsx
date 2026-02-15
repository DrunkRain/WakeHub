import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { MantineProvider } from '@mantine/core';
import { MemoryRouter } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { LogsPage } from './logs-page';
import { theme } from '../../theme/theme';
import type { OperationLog } from '@wakehub/shared';

const mockUseNodes = vi.hoisted(() => vi.fn());
vi.mock('../../api/nodes.api', () => ({
  useNodes: mockUseNodes,
}));

function renderWithProviders(ui: React.ReactElement, { route = '/logs' } = {}) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MantineProvider theme={theme} defaultColorScheme="dark">
        <MemoryRouter initialEntries={[route]}>{ui}</MemoryRouter>
      </MantineProvider>
    </QueryClientProvider>,
  );
}

function mockLog(overrides: Partial<OperationLog> = {}): OperationLog {
  return {
    id: 'log-1',
    timestamp: '2026-02-15T14:30:00.000Z',
    level: 'info',
    source: 'cascade-engine',
    message: 'Service démarré avec succès',
    reason: null,
    details: null,
    nodeId: 'node-1',
    nodeName: 'Mon Serveur',
    eventType: 'start',
    errorCode: null,
    errorDetails: null,
    cascadeId: null,
    ...overrides,
  };
}

function mockFetchResponse(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

function mockFetchLogs(logs: OperationLog[], total?: number) {
  vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
    mockFetchResponse({ data: { logs, total: total ?? logs.length } }),
  );
}

function mockFetchEmpty() {
  mockFetchLogs([], 0);
}

function setupDesktopViewport() {
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
}

function setupMobileViewport() {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: query === '(max-width: 767px)',
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

beforeEach(() => {
  vi.restoreAllMocks();
  setupDesktopViewport();
  mockUseNodes.mockReturnValue({
    data: { data: { nodes: [] } },
    isLoading: false,
  });
});

describe('LogsPage', () => {
  // AC #1 — Titre et tableau
  it('should render the page title "Logs"', async () => {
    mockFetchEmpty();
    renderWithProviders(<LogsPage />);
    expect(screen.getByText('Logs')).toBeInTheDocument();
  });

  // AC #1 — Tableau desktop avec colonnes
  it('should display a table with correct columns on desktop', async () => {
    mockFetchLogs([mockLog()]);
    renderWithProviders(<LogsPage />);

    expect(await screen.findByText('Service démarré avec succès')).toBeInTheDocument();

    const table = screen.getByRole('table');
    const tableScope = within(table);
    expect(tableScope.getByText('Horodatage')).toBeInTheDocument();
    expect(tableScope.getByText('Noeud')).toBeInTheDocument();
    expect(tableScope.getByText('Type')).toBeInTheDocument();
    expect(tableScope.getByText('Niveau')).toBeInTheDocument();
    expect(tableScope.getByText('Message')).toBeInTheDocument();
    expect(tableScope.getByText('Raison')).toBeInTheDocument();
  });

  // AC #1 — Badges type et niveau
  it('should display event type and level as colored badges', async () => {
    mockFetchLogs([mockLog({ eventType: 'start', level: 'info' })]);
    renderWithProviders(<LogsPage />);

    await screen.findByText('Service démarré avec succès');
    const table = screen.getByRole('table');
    const tableScope = within(table);
    expect(tableScope.getByText('start')).toBeInTheDocument();
    expect(tableScope.getByText('Info')).toBeInTheDocument();
  });

  // AC #1 — Noeud affiché
  it('should display node name in the table', async () => {
    mockFetchLogs([mockLog({ nodeName: 'NAS-Storage' })]);
    renderWithProviders(<LogsPage />);

    await screen.findByText('Service démarré avec succès');
    const table = screen.getByRole('table');
    expect(within(table).getByText('NAS-Storage')).toBeInTheDocument();
  });

  // AC #1 — Dash for null nodeName
  it('should display dash for logs without node name', async () => {
    mockFetchLogs([mockLog({ nodeName: null, nodeId: null })]);
    renderWithProviders(<LogsPage />);

    await screen.findByText('Service démarré avec succès');
    const table = screen.getByRole('table');
    expect(within(table).getAllByText('—').length).toBeGreaterThan(0);
  });

  // AC #4 — État vide
  it('should show empty state when no logs exist', async () => {
    mockFetchEmpty();
    renderWithProviders(<LogsPage />);

    expect(await screen.findByText('Aucun événement enregistré')).toBeInTheDocument();
  });

  // Skeleton loaders
  it('should display skeleton loaders while loading', () => {
    vi.spyOn(globalThis, 'fetch').mockReturnValueOnce(new Promise(() => {}));
    const { container } = renderWithProviders(<LogsPage />);

    const skeletons = container.querySelectorAll('.mantine-Skeleton-root');
    expect(skeletons.length).toBeGreaterThan(0);
    expect(screen.queryByText('Aucun événement enregistré')).not.toBeInTheDocument();
  });

  // AC #2 — Filtres présents
  it('should display filter controls', async () => {
    mockFetchLogs([mockLog()]);
    renderWithProviders(<LogsPage />);

    await screen.findByText('Service démarré avec succès');
    // Mantine Select may create multiple elements with same aria-label; use getAllBy and check at least 1
    expect(screen.getAllByLabelText('Rechercher dans les logs').length).toBeGreaterThan(0);
    expect(screen.getAllByLabelText('Filtrer par niveau').length).toBeGreaterThan(0);
    expect(screen.getAllByLabelText("Filtrer par type d'événement").length).toBeGreaterThan(0);
    expect(screen.getAllByLabelText('Filtrer par noeud').length).toBeGreaterThan(0);
  });

  // AC #2 — Filtre par niveau
  it('should filter by level when level filter is changed', async () => {
    const user = userEvent.setup();
    mockFetchLogs([mockLog()]);
    renderWithProviders(<LogsPage />);

    await screen.findByText('Service démarré avec succès');

    // Mock the filtered request
    mockFetchLogs([mockLog({ level: 'error', message: 'Erreur critique' })]);

    // Use placeholder text to target the visible input
    await user.click(screen.getByPlaceholderText('Tous les niveaux'));
    await user.click(await screen.findByRole('option', { name: 'Error' }));

    // Verify new fetch was called with level filter
    await waitFor(() => {
      const lastCall = vi.mocked(globalThis.fetch).mock.calls.at(-1);
      expect(lastCall?.[0]).toContain('level=error');
    });
  });

  // AC #2 — Filtre par type d'événement
  it('should filter by event type when event type filter is changed', async () => {
    const user = userEvent.setup();
    mockFetchLogs([mockLog()]);
    renderWithProviders(<LogsPage />);

    await screen.findByText('Service démarré avec succès');

    mockFetchLogs([mockLog({ eventType: 'stop', message: 'Service arrêté' })]);

    await user.click(screen.getByPlaceholderText('Tous les types'));
    await user.click(await screen.findByRole('option', { name: 'stop' }));

    await waitFor(() => {
      const lastCall = vi.mocked(globalThis.fetch).mock.calls.at(-1);
      expect(lastCall?.[0]).toContain('eventType=stop');
    });
  });

  // AC #2 — Recherche libre
  it('should send search query parameter when typing in search', async () => {
    const user = userEvent.setup();
    // Use a persistent mock that returns data for all calls
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(() =>
      Promise.resolve(
        new Response(JSON.stringify({ data: { logs: [mockLog()], total: 1 } }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      ),
    );
    renderWithProviders(<LogsPage />);

    await screen.findByText('Service démarré avec succès');

    await user.type(screen.getByPlaceholderText('Rechercher...'), 'NAS');

    await waitFor(() => {
      const calls = fetchSpy.mock.calls;
      const urls = calls.map((c) => String(c[0]));
      // Check for search parameter (may be URL-encoded)
      const hasSearchCall = urls.some((url) => url.includes('search='));
      expect(hasSearchCall).toBe(true);
    });
  });

  // AC #2 — Reset filtres
  it('should reset all filters when clicking Réinitialiser', async () => {
    const user = userEvent.setup();
    mockFetchLogs([mockLog()]);
    renderWithProviders(<LogsPage />);

    await screen.findByText('Service démarré avec succès');

    // Apply a filter
    mockFetchLogs([mockLog({ level: 'error', message: 'Erreur' })]);
    await user.click(screen.getByPlaceholderText('Tous les niveaux'));
    await user.click(await screen.findByRole('option', { name: 'Error' }));

    // Wait for the filtered fetch to be called
    await waitFor(() => {
      const calls = vi.mocked(globalThis.fetch).mock.calls;
      expect(calls.some((c) => String(c[0]).includes('level=error'))).toBe(true);
    });

    // Reset button should appear
    mockFetchLogs([mockLog()]);
    await user.click(screen.getByText('Réinitialiser'));

    await waitFor(() => {
      const lastCall = vi.mocked(globalThis.fetch).mock.calls.at(-1);
      expect(String(lastCall?.[0])).not.toContain('level=');
    });
  });

  // AC #3 — Mise en évidence erreurs (fond rouge)
  it('should highlight error rows with red background', async () => {
    mockFetchLogs([
      mockLog({ id: 'log-err', level: 'error', message: 'Échec de connexion', errorCode: 'CONN_FAIL' }),
    ]);
    renderWithProviders(<LogsPage />);

    await screen.findByText('Échec de connexion');
    const table = screen.getByRole('table');
    const rows = table.querySelectorAll('tr');
    const errorRow = Array.from(rows).find((row) => row.textContent?.includes('Échec de connexion'));
    expect(errorRow).toBeTruthy();
    expect(errorRow!.style.backgroundColor).toContain('var(--mantine-color-red-light)');
  });

  // AC #3 — Error code and details visible
  it('should show error code and details on expanded error row', async () => {
    const user = userEvent.setup();
    mockFetchLogs([
      mockLog({
        id: 'log-err',
        level: 'error',
        message: 'Échec de connexion',
        errorCode: 'CONN_TIMEOUT',
        errorDetails: { timeout: 5000 },
      }),
    ]);
    renderWithProviders(<LogsPage />);

    await screen.findByText('Échec de connexion');
    // Click to expand
    const table = screen.getByRole('table');
    const rows = table.querySelectorAll('tr');
    const errorRow = Array.from(rows).find((row) => row.textContent?.includes('Échec de connexion'));
    await user.click(errorRow!);

    expect(await screen.findByText(/CONN_TIMEOUT/)).toBeInTheDocument();
  });

  // Pagination
  it('should display pagination controls', async () => {
    mockFetchLogs([mockLog()], 100);
    renderWithProviders(<LogsPage />);

    await screen.findByText('Service démarré avec succès');
    expect(screen.getByText('Précédent')).toBeInTheDocument();
    expect(screen.getByText('Suivant')).toBeInTheDocument();
    expect(screen.getByText('Page 1 de 2')).toBeInTheDocument();
  });

  it('should disable Précédent on first page', async () => {
    mockFetchLogs([mockLog()], 100);
    renderWithProviders(<LogsPage />);

    await screen.findByText('Service démarré avec succès');
    expect(screen.getByText('Précédent').closest('button')).toBeDisabled();
  });

  it('should navigate to next page when Suivant is clicked', async () => {
    const user = userEvent.setup();
    mockFetchLogs([mockLog()], 100);
    renderWithProviders(<LogsPage />);

    await screen.findByText('Service démarré avec succès');

    mockFetchLogs([mockLog({ id: 'log-p2', message: 'Page 2 log' })], 100);
    await user.click(screen.getByText('Suivant'));

    await waitFor(() => {
      const lastCall = vi.mocked(globalThis.fetch).mock.calls.at(-1);
      expect(String(lastCall?.[0])).toContain('offset=50');
    });
  });

  // AC #5 — Mobile : colonnes masquées
  it('should render mobile view with simplified cards on small screens', async () => {
    setupMobileViewport();
    mockFetchLogs([mockLog()]);
    renderWithProviders(<LogsPage />);

    await screen.findByText('Service démarré avec succès');

    // No table should be rendered on mobile
    expect(screen.queryByRole('table')).not.toBeInTheDocument();

    // Badge level should be visible (may have multiple due to filter options hidden, so getAllBy)
    expect(screen.getAllByText('Info').length).toBeGreaterThan(0);
  });

  // Total count display
  it('should display total events count', async () => {
    mockFetchLogs([mockLog()], 42);
    renderWithProviders(<LogsPage />);

    expect(await screen.findByText('42 événements')).toBeInTheDocument();
  });

  it('should display singular for one event', async () => {
    mockFetchLogs([mockLog()], 1);
    renderWithProviders(<LogsPage />);

    expect(await screen.findByText('1 événement')).toBeInTheDocument();
  });

  // H3 — AC #6 — Pre-filter via URL nodeId param
  it('should pre-filter by nodeId from URL search params', async () => {
    mockFetchLogs([mockLog()]);
    renderWithProviders(<LogsPage />, { route: '/logs?nodeId=node-42' });

    await waitFor(() => {
      const lastCall = vi.mocked(globalThis.fetch).mock.calls.at(-1);
      expect(String(lastCall?.[0])).toContain('nodeId=node-42');
    });
  });

  // L1 — Filtered empty state
  it('should show "Aucun résultat pour ces filtres" when filters return no results', async () => {
    const user = userEvent.setup();
    mockFetchLogs([mockLog()]);
    renderWithProviders(<LogsPage />);

    await screen.findByText('Service démarré avec succès');

    // Apply a level filter that returns empty
    mockFetchLogs([], 0);
    await user.click(screen.getByPlaceholderText('Tous les niveaux'));
    await user.click(await screen.findByRole('option', { name: 'Error' }));

    expect(await screen.findByText('Aucun résultat pour ces filtres.')).toBeInTheDocument();
  });

  // AC #2 — Date filter inputs present
  it('should display date filter inputs', async () => {
    mockFetchLogs([mockLog()]);
    renderWithProviders(<LogsPage />);

    await screen.findByText('Service démarré avec succès');
    expect(screen.getAllByLabelText('Date de début').length).toBeGreaterThan(0);
    expect(screen.getAllByLabelText('Date de fin').length).toBeGreaterThan(0);
  });
});
