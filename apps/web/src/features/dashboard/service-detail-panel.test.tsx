import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MantineProvider } from '@mantine/core';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { theme } from '../../theme/theme';
import { ServiceDetailPanel } from './service-detail-panel';
import type { Service, CascadeRecord, DependencyChainNode } from '@wakehub/shared';

// Mock API hooks
vi.mock('../../api/services.api', () => ({
  useServices: vi.fn(() => ({ data: null })),
}));

vi.mock('../../api/cascades.api', () => ({
  useActiveCascades: vi.fn(() => ({ data: null })),
  useCascadeHistory: vi.fn(() => ({ data: null })),
}));

vi.mock('../../api/dependencies.api', () => ({
  useDependencyChain: vi.fn(() => ({ data: null })),
}));

import { useServices } from '../../api/services.api';
import { useActiveCascades, useCascadeHistory } from '../../api/cascades.api';
import { useDependencyChain } from '../../api/dependencies.api';

const baseService: Service = {
  id: 'r1',
  name: 'Jellyfin',
  type: 'vm',
  ipAddress: null,
  macAddress: null,
  sshUser: null,
  apiUrl: null,
  serviceUrl: 'http://jellyfin:8096',
  status: 'running',
  platformRef: { node: 'pve1', vmid: 100 },
  inactivityTimeout: null,
  parentId: 'm1',
  pinnedToDashboard: true,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
};

function mockServices(services: Service[]) {
  vi.mocked(useServices).mockReturnValue({
    data: { data: services },
  } as ReturnType<typeof useServices>);
}

function mockActiveCascades(cascades: CascadeRecord[]) {
  vi.mocked(useActiveCascades).mockReturnValue({
    data: { data: cascades },
  } as ReturnType<typeof useActiveCascades>);
}

function mockCascadeHistory(cascades: CascadeRecord[]) {
  vi.mocked(useCascadeHistory).mockReturnValue({
    data: { data: cascades },
  } as ReturnType<typeof useCascadeHistory>);
}

function mockDependencyChain(upstream: DependencyChainNode[], downstream: DependencyChainNode[] = []) {
  vi.mocked(useDependencyChain).mockReturnValue({
    data: { data: { upstream, downstream } },
  } as ReturnType<typeof useDependencyChain>);
}

function renderPanel(props: Partial<React.ComponentProps<typeof ServiceDetailPanel>> = {}) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MantineProvider theme={theme} defaultColorScheme="dark">
        <ServiceDetailPanel
          serviceId={props.serviceId ?? 'r1'}
          onClose={props.onClose ?? vi.fn()}
          onStart={props.onStart ?? vi.fn()}
          onStop={props.onStop ?? vi.fn()}
        />
      </MantineProvider>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockServices([baseService]);
  mockActiveCascades([]);
  mockCascadeHistory([]);
  mockDependencyChain([]);
});

describe('ServiceDetailPanel — Header', () => {
  it('renders service name and status badge', () => {
    renderPanel();

    expect(screen.getByText('Jellyfin')).toBeInTheDocument();
    expect(screen.getByText('Actif')).toBeInTheDocument();
  });

  it('renders close button with aria-label', () => {
    renderPanel();

    expect(screen.getByRole('button', { name: 'Fermer' })).toBeInTheDocument();
  });

  it('calls onClose when close button is clicked', async () => {
    const onClose = vi.fn();
    renderPanel({ onClose });

    await userEvent.click(screen.getByRole('button', { name: 'Fermer' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('has correct aria-label on the drawer', () => {
    renderPanel();

    expect(screen.getByLabelText('Detail du service Jellyfin')).toBeInTheDocument();
  });
});

describe('ServiceDetailPanel — Dependencies Tab', () => {
  it('shows "Aucune dependance" when no upstream deps', () => {
    mockDependencyChain([]);
    renderPanel();

    expect(screen.getByText('Aucune dependance')).toBeInTheDocument();
  });

  it('renders upstream dependency chain with names and statuses', () => {
    mockDependencyChain([
      { nodeType: 'service', nodeId: 'm1', name: 'NAS Server', status: 'online' },
      { nodeType: 'service', nodeId: 'r2', name: 'Docker Host', status: 'running' },
    ]);
    renderPanel();

    expect(screen.getByText('NAS Server')).toBeInTheDocument();
    expect(screen.getByText('Docker Host')).toBeInTheDocument();
    // All nodes are now type 'service'
    const serviceLabels = screen.getAllByText('Service');
    expect(serviceLabels.length).toBe(2);
    expect(screen.getByText('online')).toBeInTheDocument();
    expect(screen.getByText('running')).toBeInTheDocument();
  });
});

describe('ServiceDetailPanel — Activity Tab', () => {
  it('shows "Aucune activite recente" when no history', async () => {
    mockCascadeHistory([]);
    renderPanel();

    await userEvent.click(screen.getByRole('tab', { name: 'Activite' }));
    expect(screen.getByText('Aucune activite recente')).toBeInTheDocument();
  });

  it('renders cascade history table with timestamps, types, and results', async () => {
    mockCascadeHistory([
      {
        id: 'c1',
        serviceId: 'r1',
        type: 'start',
        status: 'completed',
        currentStep: 3,
        totalSteps: 3,
        failedStep: null,
        errorCode: null,
        errorMessage: null,
        startedAt: '2026-02-11T14:30:00Z',
        completedAt: '2026-02-11T14:31:00Z',
      },
      {
        id: 'c2',
        serviceId: 'r1',
        type: 'start',
        status: 'failed',
        currentStep: 1,
        totalSteps: 3,
        failedStep: 1,
        errorCode: 'SSH_FAILED',
        errorMessage: 'Connexion SSH impossible',
        startedAt: '2026-02-11T10:15:00Z',
        completedAt: '2026-02-11T10:16:00Z',
      },
    ]);
    renderPanel();

    await userEvent.click(screen.getByRole('tab', { name: 'Activite' }));

    // Check table headers
    expect(screen.getByText('Horodatage')).toBeInTheDocument();
    expect(screen.getByText('Type')).toBeInTheDocument();
    expect(screen.getByText('Resultat')).toBeInTheDocument();

    // Check cascade types
    const rows = screen.getAllByRole('row');
    // 1 header row + 2 data rows
    expect(rows).toHaveLength(3);

    expect(screen.getByText('Reussi')).toBeInTheDocument();
    expect(screen.getByText(/Echoue/)).toBeInTheDocument();
  });
});

describe('ServiceDetailPanel — Actions Zone', () => {
  it('shows "Demarrer" button when service is stopped', () => {
    mockServices([{ ...baseService, status: 'stopped' }]);
    renderPanel();

    expect(screen.getByRole('button', { name: /Demarrer Jellyfin/ })).toBeInTheDocument();
  });

  it('calls onStart when "Demarrer" button is clicked', async () => {
    const onStart = vi.fn();
    mockServices([{ ...baseService, status: 'stopped' }]);
    renderPanel({ onStart });

    await userEvent.click(screen.getByRole('button', { name: /Demarrer Jellyfin/ }));
    expect(onStart).toHaveBeenCalledWith('r1');
  });

  it('shows "Ouvrir" link when service is running with serviceUrl', () => {
    renderPanel();

    const link = screen.getByRole('link', { name: /Ouvrir Jellyfin/ });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('href', 'http://jellyfin:8096');
  });

  it('shows enabled "Arreter" button when service is running', () => {
    renderPanel();

    const btn = screen.getByRole('button', { name: /Arreter Jellyfin/ });
    expect(btn).toBeInTheDocument();
    expect(btn).not.toBeDisabled();
  });

  it('shows "Reessayer" button when cascade failed', () => {
    mockServices([{ ...baseService, status: 'stopped' }]);
    mockActiveCascades([{
      id: 'c1',
      serviceId: 'r1',
      type: 'start',
      status: 'failed',
      currentStep: 1,
      totalSteps: 3,
      failedStep: 1,
      errorCode: 'SSH_FAILED',
      errorMessage: 'Connexion SSH impossible',
      startedAt: '2026-01-01T00:00:00Z',
      completedAt: '2026-01-01T00:01:00Z',
    }]);
    renderPanel();

    expect(screen.getByRole('button', { name: /Reessayer Jellyfin/ })).toBeInTheDocument();
  });

  it('shows loading button when cascade is starting', () => {
    mockServices([{ ...baseService, status: 'stopped' }]);
    mockActiveCascades([{
      id: 'c1',
      serviceId: 'r1',
      type: 'start',
      status: 'in_progress',
      currentStep: 1,
      totalSteps: 3,
      failedStep: null,
      errorCode: null,
      errorMessage: null,
      startedAt: '2026-01-01T00:00:00Z',
      completedAt: null,
    }]);
    renderPanel();

    expect(screen.getByText('En demarrage...')).toBeInTheDocument();
  });
});

describe('ServiceDetailPanel — Stop Confirmation Modal', () => {
  it('opens confirmation modal when "Arreter" button is clicked', async () => {
    renderPanel();

    await userEvent.click(screen.getByRole('button', { name: /Arreter Jellyfin/ }));

    expect(await screen.findByText(/Arrêter Jellyfin et ses dépendances/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Annuler' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Arrêter' })).toBeInTheDocument();
  });

  it('shows downstream dependencies in the confirmation modal', async () => {
    mockDependencyChain(
      [],
      [
        { nodeType: 'service', nodeId: 'r2', name: 'Plex', status: 'running' },
        { nodeType: 'service', nodeId: 'r3', name: 'Sonarr', status: 'online' },
      ],
    );
    renderPanel();

    await userEvent.click(screen.getByRole('button', { name: /Arreter Jellyfin/ }));

    expect(await screen.findByText('Les services suivants seront aussi arrêtés :')).toBeInTheDocument();
    expect(screen.getByText('Plex')).toBeInTheDocument();
    expect(screen.getByText('Sonarr')).toBeInTheDocument();
  });

  it('shows "Aucune dépendance" message when no downstream deps', async () => {
    mockDependencyChain([], []);
    renderPanel();

    await userEvent.click(screen.getByRole('button', { name: /Arreter Jellyfin/ }));

    expect(await screen.findByText('Aucune dépendance ne sera affectée.')).toBeInTheDocument();
  });

  it('calls onStop and closes modal when "Arrêter" is confirmed', async () => {
    const onStop = vi.fn();
    renderPanel({ onStop });

    await userEvent.click(screen.getByRole('button', { name: /Arreter Jellyfin/ }));
    await userEvent.click(await screen.findByRole('button', { name: 'Arrêter' }));

    expect(onStop).toHaveBeenCalledWith('r1');
  });

  it('closes modal without calling onStop when "Annuler" is clicked', async () => {
    const onStop = vi.fn();
    renderPanel({ onStop });

    await userEvent.click(screen.getByRole('button', { name: /Arreter Jellyfin/ }));
    await userEvent.click(await screen.findByRole('button', { name: 'Annuler' }));

    expect(onStop).not.toHaveBeenCalled();
  });

  it('shows loading button during active stop cascade', () => {
    mockActiveCascades([{
      id: 'c1',
      serviceId: 'r1',
      type: 'stop',
      status: 'in_progress',
      currentStep: 1,
      totalSteps: 2,
      failedStep: null,
      errorCode: null,
      errorMessage: null,
      startedAt: '2026-01-01T00:00:00Z',
      completedAt: null,
    }]);
    renderPanel();

    expect(screen.getByText('En arret...')).toBeInTheDocument();
  });
});

describe('ServiceDetailPanel — Not found', () => {
  it('shows "Service introuvable" when service does not exist', () => {
    mockServices([]);
    renderPanel({ serviceId: 'nonexistent' });

    expect(screen.getByText('Service introuvable.')).toBeInTheDocument();
  });
});

describe('ServiceDetailPanel — Tabs navigation', () => {
  it('defaults to "Dependances" tab', () => {
    mockDependencyChain([
      { nodeType: 'service', nodeId: 'm1', name: 'NAS Server', status: 'online' },
    ]);
    renderPanel();

    expect(screen.getByText('NAS Server')).toBeInTheDocument();
  });

  it('switches to "Activite" tab and back', async () => {
    mockDependencyChain([
      { nodeType: 'service', nodeId: 'm1', name: 'NAS Server', status: 'online' },
    ]);
    mockCascadeHistory([]);
    renderPanel();

    await userEvent.click(screen.getByRole('tab', { name: 'Activite' }));
    expect(screen.getByText('Aucune activite recente')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('tab', { name: 'Dependances' }));
    expect(screen.getByText('NAS Server')).toBeInTheDocument();
  });
});
