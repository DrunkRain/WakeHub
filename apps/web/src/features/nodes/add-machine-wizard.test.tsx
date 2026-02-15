import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { MantineProvider } from '@mantine/core';
import { Notifications } from '@mantine/notifications';
import { BrowserRouter } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AddMachineWizard } from './add-machine-wizard';
import { theme } from '../../theme/theme';

function renderWithProviders(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MantineProvider theme={theme} defaultColorScheme="dark">
        <Notifications />
        <BrowserRouter>{ui}</BrowserRouter>
      </MantineProvider>
    </QueryClientProvider>
  );
}

beforeEach(() => {
  vi.restoreAllMocks();
});

describe('AddMachineWizard', () => {
  it('should render step 1 form when opened', () => {
    renderWithProviders(<AddMachineWizard opened={true} onClose={() => {}} />);

    expect(screen.getByText('Ajouter une machine')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Mon Serveur')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('192.168.1.10')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('AA:BB:CC:DD:EE:FF')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('root')).toBeInTheDocument();
  });

  it('should not render when closed', () => {
    renderWithProviders(<AddMachineWizard opened={false} onClose={() => {}} />);

    expect(screen.queryByText('Ajouter une machine')).not.toBeInTheDocument();
  });

  it('should validate required name field', async () => {
    const user = userEvent.setup();
    renderWithProviders(<AddMachineWizard opened={true} onClose={() => {}} />);

    // Click "Suivant" without filling name
    await user.click(screen.getByRole('button', { name: 'Suivant' }));

    expect(await screen.findByText('Le nom est requis')).toBeInTheDocument();
  });

  it('should validate IP format', async () => {
    const user = userEvent.setup();
    renderWithProviders(<AddMachineWizard opened={true} onClose={() => {}} />);

    await user.type(screen.getByPlaceholderText('Mon Serveur'), 'Test');
    await user.type(screen.getByPlaceholderText('192.168.1.10'), 'invalid-ip');
    await user.click(screen.getByRole('button', { name: 'Suivant' }));

    expect(await screen.findByText(/Format IP invalide/)).toBeInTheDocument();
  });

  it('should validate MAC format', async () => {
    const user = userEvent.setup();
    renderWithProviders(<AddMachineWizard opened={true} onClose={() => {}} />);

    await user.type(screen.getByPlaceholderText('Mon Serveur'), 'Test');
    await user.type(screen.getByPlaceholderText('AA:BB:CC:DD:EE:FF'), 'bad-mac');
    await user.click(screen.getByRole('button', { name: 'Suivant' }));

    expect(await screen.findByText(/Format MAC invalide/)).toBeInTheDocument();
  });

  it('should move to step 2 after creating node and testing connection', async () => {
    const user = userEvent.setup();

    // Mock: create node success, then test connection success
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: {
              node: {
                id: 'node-1',
                name: 'My Server',
                type: 'physical',
                status: 'offline',
                ipAddress: '192.168.1.10',
                macAddress: 'AA:BB:CC:DD:EE:FF',
                sshUser: 'root',
              },
            },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ data: { success: true, message: 'Connection successful' } }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      );

    renderWithProviders(<AddMachineWizard opened={true} onClose={() => {}} />);

    await user.type(screen.getByPlaceholderText('Mon Serveur'), 'My Server');
    await user.type(screen.getByPlaceholderText('192.168.1.10'), '192.168.1.10');
    await user.type(screen.getByPlaceholderText('root'), 'root');
    await user.type(screen.getByPlaceholderText('••••••••'), 'pass');
    await user.click(screen.getByRole('button', { name: 'Suivant' }));

    expect(await screen.findByText(/Connexion réussie/)).toBeInTheDocument();
  });

  it('should show failure message and force option when connection fails', async () => {
    const user = userEvent.setup();

    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: {
              node: { id: 'node-1', name: 'Failing', type: 'physical', status: 'offline', ipAddress: '10.0.0.1', sshUser: 'root' },
            },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ error: { code: 'SSH_CONNECTION_FAILED', message: 'Connection refused' } }),
          { status: 400, headers: { 'Content-Type': 'application/json' } },
        ),
      );

    renderWithProviders(<AddMachineWizard opened={true} onClose={() => {}} />);

    await user.type(screen.getByPlaceholderText('Mon Serveur'), 'Failing');
    await user.type(screen.getByPlaceholderText('192.168.1.10'), '10.0.0.1');
    await user.type(screen.getByPlaceholderText('root'), 'root');
    await user.type(screen.getByPlaceholderText('••••••••'), 'pass');
    await user.click(screen.getByRole('button', { name: 'Suivant' }));

    expect(await screen.findByText(/Connexion échouée/)).toBeInTheDocument();
    expect(screen.getAllByText(/Forcer l'ajout/i).length).toBeGreaterThanOrEqual(1);
  });

  it('should show step 3 confirmation when proceeding after test', async () => {
    const user = userEvent.setup();

    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: {
              node: { id: 'node-1', name: 'Confirmed', type: 'physical', status: 'offline', ipAddress: '10.0.0.1', sshUser: 'root' },
            },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ data: { success: true, message: 'OK' } }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      );

    renderWithProviders(<AddMachineWizard opened={true} onClose={() => {}} />);

    await user.type(screen.getByPlaceholderText('Mon Serveur'), 'Confirmed');
    await user.type(screen.getByPlaceholderText('192.168.1.10'), '10.0.0.1');
    await user.type(screen.getByPlaceholderText('root'), 'root');
    await user.type(screen.getByPlaceholderText('••••••••'), 'pass');
    await user.click(screen.getByRole('button', { name: 'Suivant' }));

    await screen.findByText(/Connexion réussie/);

    // Click "Suivant" to go to step 3
    await user.click(screen.getByRole('button', { name: 'Suivant' }));

    await waitFor(() => {
      expect(screen.getByText(/Résumé de la machine/)).toBeInTheDocument();
    });
    expect(screen.getByText('Confirmed')).toBeInTheDocument();
  });
});
