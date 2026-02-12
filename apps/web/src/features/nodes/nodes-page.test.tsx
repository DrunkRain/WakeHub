import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
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
    </QueryClientProvider>
  );
}

beforeEach(() => {
  vi.restoreAllMocks();
});

describe('NodesPage', () => {
  it('should render the page title', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ data: { nodes: [] } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    renderWithProviders(<NodesPage />);

    expect(screen.getByText('Noeuds')).toBeInTheDocument();
  });

  it('should render the add button', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ data: { nodes: [] } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    renderWithProviders(<NodesPage />);

    expect(screen.getByLabelText('Ajouter une machine')).toBeInTheDocument();
  });

  it('should show empty state when no nodes exist', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ data: { nodes: [] } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    renderWithProviders(<NodesPage />);

    expect(
      await screen.findByText(/Aucun noeud configuré/),
    ).toBeInTheDocument();
  });

  it('should display nodes when they exist', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          data: {
            nodes: [
              {
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
              },
            ],
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    renderWithProviders(<NodesPage />);

    expect(await screen.findByText('Mon Serveur')).toBeInTheDocument();
  });

  it('should open wizard when add button is clicked', async () => {
    const user = userEvent.setup();

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ data: { nodes: [] } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    renderWithProviders(<NodesPage />);

    await user.click(screen.getByLabelText('Ajouter une machine'));

    expect(await screen.findByPlaceholderText('Mon Serveur')).toBeInTheDocument();
  });
});
