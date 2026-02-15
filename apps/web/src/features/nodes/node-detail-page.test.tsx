import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { MantineProvider } from '@mantine/core';
import { Notifications } from '@mantine/notifications';
import { MemoryRouter, Routes, Route } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NodeDetailPage } from './node-detail-page';
import { useCascadeStore } from '../../stores/cascade.store';
import { theme } from '../../theme/theme';

const mockNavigate = vi.fn();
vi.mock('react-router', async () => {
  const actual = await vi.importActual('react-router');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

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
            <Route path="/nodes" element={<div>Nodes List</div>} />
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
  serviceUrl: 'https://pve.local:8006',
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

const mockConfiguredChild = {
  ...mockDiscoveredChild,
  id: 'vm-2',
  name: 'configured-vm',
  discovered: true,
  configured: true,
};

const mockContainerNode = {
  ...mockNode,
  id: 'container-1',
  name: 'my-nginx',
  type: 'container',
  capabilities: null,
};

interface MockDeps {
  upstream: Array<{ linkId: string; nodeId: string; name: string; type: string; status: string }>;
  downstream: Array<{ linkId: string; nodeId: string; name: string; type: string; status: string }>;
}

/**
 * URL-based fetch mock. Routes GET requests by URL pattern.
 * Non-GET requests consume from a mutation response queue.
 */
function mockFetch(
  node: Record<string, unknown>,
  children: Record<string, unknown>[] = [],
  deps: MockDeps = { upstream: [], downstream: [] },
  allNodes?: Record<string, unknown>[],
) {
  const mutationResponses: Response[] = [];

  const spy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const url = typeof input === 'string' ? input : (input as Request).url ?? String(input);
    const method = (init?.method ?? 'GET').toUpperCase();

    // Non-GET requests consume queued mutation responses
    if (method !== 'GET') {
      if (mutationResponses.length > 0) {
        return mutationResponses.shift()!;
      }
      return new Response(JSON.stringify({}), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }

    // Dependencies query
    if (url.includes('/api/dependencies')) {
      return new Response(JSON.stringify({ data: deps }), {
        status: 200, headers: { 'Content-Type': 'application/json' },
      });
    }

    // Children query (has parentId param)
    if (url.includes('parentId=')) {
      return new Response(JSON.stringify({ data: { nodes: children } }), {
        status: 200, headers: { 'Content-Type': 'application/json' },
      });
    }

    // Single node query (/api/nodes/<id> with no additional path)
    if (/\/api\/nodes\/[^/?]+$/.test(url)) {
      return new Response(JSON.stringify({ data: { node } }), {
        status: 200, headers: { 'Content-Type': 'application/json' },
      });
    }

    // All nodes query (GET /api/nodes)
    if (url.includes('/api/nodes')) {
      return new Response(JSON.stringify({ data: { nodes: allNodes ?? [node] } }), {
        status: 200, headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response('{}', { status: 404 });
  });

  // Helper to queue a mutation response
  (spy as any).queueMutation = (body: unknown, status = 200) => {
    mutationResponses.push(
      new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }),
    );
  };

  return spy as ReturnType<typeof vi.spyOn> & {
    queueMutation: (body: unknown, status?: number) => void;
  };
}

beforeEach(() => {
  vi.restoreAllMocks();
  mockNavigate.mockReset();
  useCascadeStore.setState({ cascades: {} });
});

describe('NodeDetailPage', () => {
  // AC #1: Header
  it('should render node header with name, status badge and IP', async () => {
    mockFetch(mockNode);
    renderWithProviders();

    expect(await screen.findByText('Mon Proxmox')).toBeInTheDocument();
    expect(screen.getByText('Actif')).toBeInTheDocument(); // StatusBadge for 'online'
    expect(screen.getByText(/192\.168\.1\.100/)).toBeInTheDocument();
  });

  // AC #1: Back link
  it('should render "Retour aux noeuds" link', async () => {
    mockFetch(mockNode);
    renderWithProviders();

    expect(await screen.findByText('Retour aux noeuds')).toBeInTheDocument();
  });

  // AC #2: Parameters form pre-filled
  it('should display editable parameters form pre-filled with node values', async () => {
    mockFetch(mockNode);
    renderWithProviders();

    await screen.findByText('Mon Proxmox');

    expect(screen.getByLabelText('Nom')).toHaveValue('Mon Proxmox');
    expect(screen.getByLabelText('Adresse IP')).toHaveValue('192.168.1.100');
    expect(screen.getByLabelText('Adresse MAC')).toHaveValue('AA:BB:CC:DD:EE:FF');
    expect(screen.getByLabelText("URL d'acces")).toHaveValue('https://pve.local:8006');
    expect(screen.getByLabelText('Utilisateur SSH')).toHaveValue('root');
  });

  // AC #2: Password field shows placeholder
  it('should show password placeholder when sshUser exists', async () => {
    mockFetch(mockNode);
    renderWithProviders();

    await screen.findByText('Mon Proxmox');

    const passwordInput = screen.getByLabelText('Mot de passe SSH');
    expect(passwordInput).toHaveAttribute('placeholder', '********');
    expect(passwordInput).toHaveValue('');
  });

  // AC #3: Save button
  it('should display Enregistrer button', async () => {
    mockFetch(mockNode);
    renderWithProviders();

    await screen.findByText('Mon Proxmox');
    expect(screen.getByText('Enregistrer')).toBeInTheDocument();
  });

  // AC #3: Click save → PATCH call
  it('should call PATCH when saving modified name', async () => {
    const user = userEvent.setup();
    const fetchSpy = mockFetch(mockNode);
    renderWithProviders();

    await screen.findByText('Mon Proxmox');

    const nameInput = screen.getByLabelText('Nom');
    await user.clear(nameInput);
    await user.type(nameInput, 'Nouveau Nom');

    // Queue the PATCH mutation response
    fetchSpy.queueMutation({ data: { node: { ...mockNode, name: 'Nouveau Nom' } } });

    await user.click(screen.getByText('Enregistrer'));

    // Check that fetch was called with PATCH
    const calls = fetchSpy.mock.calls;
    const patchCall = calls.find((c: unknown[]) => {
      const method = (c[1] as RequestInit)?.method;
      return method === 'PATCH';
    });
    expect(patchCall).toBeDefined();
  });

  // AC #4: Test connection button
  it('should display Tester la connexion button', async () => {
    mockFetch(mockNode);
    renderWithProviders();

    await screen.findByText('Mon Proxmox');
    expect(screen.getByText('Tester la connexion')).toBeInTheDocument();
  });

  // AC #4: Click test connection
  it('should call test-connection when clicking the button', async () => {
    const user = userEvent.setup();
    const fetchSpy = mockFetch(mockNode);
    renderWithProviders();

    await screen.findByText('Mon Proxmox');

    // Queue test-connection mutation response
    fetchSpy.queueMutation({ data: { success: true, message: 'Connection successful' } });

    await user.click(screen.getByText('Tester la connexion'));

    const testCall = fetchSpy.mock.calls.find((c: unknown[]) => {
      const url = typeof c[0] === 'string' ? c[0] : (c[0] as Request).url;
      return url.includes('test-connection');
    });
    expect(testCall).toBeDefined();
  });

  // AC #5: Delete button
  it('should display Supprimer button', async () => {
    mockFetch(mockNode);
    renderWithProviders();

    await screen.findByText('Mon Proxmox');
    expect(screen.getByText('Supprimer')).toBeInTheDocument();
  });

  // AC #5: Click delete → modal
  it('should open delete confirmation modal when clicking Supprimer', async () => {
    const user = userEvent.setup();
    mockFetch(mockNode);
    renderWithProviders();

    await screen.findByText('Mon Proxmox');

    const deleteBtn = screen.getByRole('button', { name: /Supprimer/ });
    await user.click(deleteBtn);

    expect(await screen.findByText(/Supprimer definitivement/)).toBeInTheDocument();
    expect(screen.getByText('Annuler')).toBeInTheDocument();
  });

  // AC #6: Delete modal with children warning
  it('should show children warning in delete modal when children exist', async () => {
    const user = userEvent.setup();
    mockFetch(mockNode, [mockDiscoveredChild, mockConfiguredChild]);
    renderWithProviders();

    await screen.findByText('Mon Proxmox');

    const deleteBtn = screen.getByRole('button', { name: /Supprimer/ });
    await user.click(deleteBtn);

    expect(await screen.findByText(/Supprimer definitivement/)).toBeInTheDocument();
    expect(screen.getByText(/Attention/)).toBeInTheDocument();
  });

  // AC #5: No children warning when no children
  it('should not show children warning when no children exist', async () => {
    const user = userEvent.setup();
    mockFetch(mockNode);
    renderWithProviders();

    await screen.findByText('Mon Proxmox');

    const deleteBtn = screen.getByRole('button', { name: /Supprimer/ });
    await user.click(deleteBtn);

    expect(await screen.findByText(/Supprimer definitivement/)).toBeInTheDocument();
    expect(screen.queryByText(/Attention/)).not.toBeInTheDocument();
  });

  // AC #7: Confirm delete → call DELETE + redirect
  it('should call DELETE and redirect when confirming deletion', async () => {
    const user = userEvent.setup();
    const fetchSpy = mockFetch(mockNode);
    renderWithProviders();

    await screen.findByText('Mon Proxmox');

    const deleteBtn = screen.getByRole('button', { name: /Supprimer/ });
    await user.click(deleteBtn);

    expect(await screen.findByText(/Supprimer definitivement/)).toBeInTheDocument();

    // Queue DELETE mutation response
    fetchSpy.queueMutation({ data: { success: true } });

    const modalButtons = screen.getAllByRole('button', { name: /Supprimer/ });
    await user.click(modalButtons[modalButtons.length - 1]!);

    await vi.waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/nodes');
    });
  });

  // Loading state
  it('should show loader while loading', () => {
    vi.spyOn(globalThis, 'fetch').mockReturnValueOnce(new Promise(() => {}));
    const { container } = renderWithProviders();

    expect(container.querySelector('.mantine-Loader-root')).toBeInTheDocument();
  });

  // Existing capability tests
  it('should show "Configurer Proxmox" button when no proxmox capability', async () => {
    mockFetch(mockNode);
    renderWithProviders();

    expect(await screen.findByText('Configurer Proxmox')).toBeInTheDocument();
  });

  it('should show "Proxmox connecte" when proxmox is configured', async () => {
    mockFetch(mockNodeWithProxmox);
    renderWithProviders();

    expect(await screen.findByText(/Proxmox connecte/)).toBeInTheDocument();
  });

  it('should display discovered services section', async () => {
    mockFetch(mockNodeWithProxmox, [mockDiscoveredChild]);
    renderWithProviders();

    expect(await screen.findByText('ubuntu-server')).toBeInTheDocument();
    expect(screen.getByText(/Services a configurer/)).toBeInTheDocument();
  });

  it('should show "Docker connecte" when docker is configured', async () => {
    mockFetch(mockNodeWithDocker);
    renderWithProviders();

    expect(await screen.findByText(/Docker connecte/)).toBeInTheDocument();
    expect(screen.queryByText('Configurer Docker')).not.toBeInTheDocument();
  });

  it('should not show "Configurer Docker" for container type nodes', async () => {
    mockFetch(mockContainerNode);
    renderWithProviders();

    await screen.findByText('my-nginx');
    expect(screen.queryByText('Configurer Docker')).not.toBeInTheDocument();
  });

  it('should show "Configurer Docker" button when no docker capability and not a container', async () => {
    mockFetch(mockNode);
    renderWithProviders();

    expect(await screen.findByText('Configurer Docker')).toBeInTheDocument();
  });

  // === Story 3.1: Dependency section tests ===

  it('should display the "Dependances fonctionnelles" section', async () => {
    mockFetch(mockNode);
    renderWithProviders();

    expect(await screen.findByText('Dependances fonctionnelles')).toBeInTheDocument();
    expect(screen.getByText('Ajouter une dependance')).toBeInTheDocument();
  });

  it('should show "Aucune dependance" when no upstream dependencies exist', async () => {
    mockFetch(mockNode);
    renderWithProviders();

    expect(await screen.findByText('Mon Proxmox a besoin de :')).toBeInTheDocument();
    expect(screen.getByText('Aucune dependance')).toBeInTheDocument();
    expect(screen.getByText('... ont besoin de Mon Proxmox :')).toBeInTheDocument();
    expect(screen.getByText('Aucun dependant')).toBeInTheDocument();
  });

  it('should display upstream and downstream dependencies with node info', async () => {
    const deps: MockDeps = {
      upstream: [
        { linkId: 'link-1', nodeId: 'nas-1', name: 'NAS', type: 'physical', status: 'online' },
      ],
      downstream: [
        { linkId: 'link-2', nodeId: 'plex-1', name: 'Plex', type: 'container', status: 'online' },
      ],
    };
    mockFetch(mockNode, [], deps);
    renderWithProviders();

    expect(await screen.findByText('NAS')).toBeInTheDocument();
    expect(screen.getByText('Plex')).toBeInTheDocument();
  });

  it('should open add dependency form when clicking "Ajouter une dependance"', async () => {
    const user = userEvent.setup();
    mockFetch(mockNode);
    renderWithProviders();

    await screen.findByText('Dependances fonctionnelles');
    await user.click(screen.getByText('Ajouter une dependance'));

    expect(screen.getByText('Noeud cible')).toBeInTheDocument();
    expect(screen.getByText('Direction')).toBeInTheDocument();
    expect(screen.getByText('Ajouter')).toBeInTheDocument();
  });

  it('should open delete dependency modal when clicking trash icon', async () => {
    const user = userEvent.setup();
    const deps: MockDeps = {
      upstream: [
        { linkId: 'link-1', nodeId: 'nas-1', name: 'NAS', type: 'physical', status: 'online' },
      ],
      downstream: [],
    };
    mockFetch(mockNode, [], deps);
    renderWithProviders();

    await screen.findByText('NAS');

    const trashBtn = screen.getByLabelText('Supprimer dependance NAS');
    await user.click(trashBtn);

    expect(await screen.findByText('Supprimer la dependance')).toBeInTheDocument();
    expect(screen.getByText('Voulez-vous vraiment supprimer ce lien de dependance ?')).toBeInTheDocument();
  });

  // === Story 4.5: Power control section tests ===

  it('should display "Contrôle d\'alimentation" section', async () => {
    mockFetch(mockNode);
    renderWithProviders();

    expect(await screen.findByText("Contrôle d'alimentation")).toBeInTheDocument();
  });

  it('should show "Arrêter" button for online node', async () => {
    mockFetch(mockNode); // mockNode has status: 'online'
    renderWithProviders();

    await screen.findByText('Mon Proxmox');
    expect(screen.getByRole('button', { name: /Arrêter Mon Proxmox/i })).toBeInTheDocument();
  });

  it('should show "Démarrer" button for offline node', async () => {
    mockFetch({ ...mockNode, status: 'offline' });
    renderWithProviders();

    await screen.findByText('Mon Proxmox');
    expect(screen.getByRole('button', { name: /Démarrer Mon Proxmox/i })).toBeInTheDocument();
  });

  it('should open stop cascade confirmation modal from power control section', async () => {
    const user = userEvent.setup();
    mockFetch(mockNode); // status: 'online'
    renderWithProviders();

    await screen.findByText('Mon Proxmox');
    await user.click(screen.getByRole('button', { name: /Arrêter Mon Proxmox/i }));

    expect(await screen.findByText(/Arrêter Mon Proxmox \?/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Confirmer l'arrêt/i })).toBeInTheDocument();
  });

  it('should display CascadeProgress when cascade is active for this node', async () => {
    useCascadeStore.setState({
      cascades: {
        'node-1': {
          cascadeId: 'c-1',
          step: 2,
          totalSteps: 5,
          currentNodeName: 'NAS-Storage',
          status: 'in_progress',
        },
      },
    });

    mockFetch({ ...mockNode, status: 'starting' });
    renderWithProviders();

    expect(await screen.findByText('NAS-Storage')).toBeInTheDocument();
  });

  it('should delete dependency after confirmation', async () => {
    const user = userEvent.setup();
    const deps: MockDeps = {
      upstream: [
        { linkId: 'link-1', nodeId: 'nas-1', name: 'NAS', type: 'physical', status: 'online' },
      ],
      downstream: [],
    };
    const fetchSpy = mockFetch(mockNode, [], deps);
    renderWithProviders();

    await screen.findByText('NAS');

    const trashBtn = screen.getByLabelText('Supprimer dependance NAS');
    await user.click(trashBtn);

    expect(await screen.findByText('Supprimer la dependance')).toBeInTheDocument();

    fetchSpy.queueMutation({ data: { success: true } });

    // Click the confirm Supprimer button in the modal
    const modalSupprimer = screen.getAllByRole('button', { name: /Supprimer/ });
    const confirmBtn = modalSupprimer.find((btn) => btn.closest('.mantine-Modal-content'));
    await user.click(confirmBtn ?? modalSupprimer[modalSupprimer.length - 1]!);

    // Verify DELETE was called
    await vi.waitFor(() => {
      const deleteCall = fetchSpy.mock.calls.find((c: unknown[]) => {
        const method = (c[1] as RequestInit)?.method;
        return method === 'DELETE';
      });
      expect(deleteCall).toBeDefined();
    });
  });
});
