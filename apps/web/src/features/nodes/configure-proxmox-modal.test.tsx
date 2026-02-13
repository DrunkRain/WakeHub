import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { MantineProvider } from '@mantine/core';
import { Notifications } from '@mantine/notifications';
import { MemoryRouter } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ConfigureProxmoxModal } from './configure-proxmox-modal';
import { theme } from '../../theme/theme';

function renderWithProviders(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MantineProvider theme={theme} defaultColorScheme="dark">
        <Notifications />
        <MemoryRouter>{ui}</MemoryRouter>
      </MantineProvider>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.restoreAllMocks();
});

describe('ConfigureProxmoxModal', () => {
  it('should render the modal with form fields when opened', async () => {
    renderWithProviders(
      <ConfigureProxmoxModal nodeId="node-1" opened={true} onClose={vi.fn()} />,
    );

    expect(await screen.findByText('Configurer Proxmox')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('192.168.1.100')).toBeInTheDocument();
    expect(screen.getByText("Methode d'authentification")).toBeInTheDocument();
    expect(screen.getByText('Tester & Sauvegarder')).toBeInTheDocument();
  });

  it('should show token fields by default', async () => {
    renderWithProviders(
      <ConfigureProxmoxModal nodeId="node-1" opened={true} onClose={vi.fn()} />,
    );

    expect(await screen.findByPlaceholderText('root@pam!monitoring')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx')).toBeInTheDocument();
  });

  it('should not submit when host is empty (validation prevents fetch)', async () => {
    const user = userEvent.setup();
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    renderWithProviders(
      <ConfigureProxmoxModal nodeId="node-1" opened={true} onClose={vi.fn()} />,
    );

    const submitButton = await screen.findByText('Tester & Sauvegarder');
    await user.click(submitButton);

    // Form validation should prevent any fetch call
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('should submit successfully and show notification', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          data: {
            node: { id: 'node-1', name: 'PVE', capabilities: { proxmox_api: { host: '10.0.0.1' } } },
            discovered: [{ id: 'vm-1', name: 'test-vm', type: 'vm' }],
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    renderWithProviders(
      <ConfigureProxmoxModal nodeId="node-1" opened={true} onClose={onClose} />,
    );

    await screen.findByPlaceholderText('192.168.1.100');

    await user.type(screen.getByPlaceholderText('192.168.1.100'), '10.0.0.1');
    await user.type(screen.getByPlaceholderText('root@pam!monitoring'), 'root@pam!test');
    await user.type(
      screen.getByPlaceholderText('xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx'),
      'secret-value',
    );

    await user.click(screen.getByText('Tester & Sauvegarder'));

    // Wait for the mutation to complete and onClose to be called
    await vi.waitFor(() => {
      expect(onClose).toHaveBeenCalled();
    });
  });

  it('should show error notification on failure', async () => {
    const user = userEvent.setup();

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          error: { code: 'PROXMOX_CONNECTION_FAILED', message: 'Connection refused' },
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    renderWithProviders(
      <ConfigureProxmoxModal nodeId="node-1" opened={true} onClose={vi.fn()} />,
    );

    await screen.findByPlaceholderText('192.168.1.100');

    await user.type(screen.getByPlaceholderText('192.168.1.100'), '10.0.0.1');
    await user.type(screen.getByPlaceholderText('root@pam!monitoring'), 'root@pam!test');
    await user.type(
      screen.getByPlaceholderText('xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx'),
      'bad-secret',
    );

    await user.click(screen.getByText('Tester & Sauvegarder'));

    // Error notification should appear
    expect(await screen.findByText('Erreur de connexion')).toBeInTheDocument();
  });

  it('should not render when closed', () => {
    renderWithProviders(
      <ConfigureProxmoxModal nodeId="node-1" opened={false} onClose={vi.fn()} />,
    );

    expect(screen.queryByText('Configurer Proxmox')).not.toBeInTheDocument();
  });
});
