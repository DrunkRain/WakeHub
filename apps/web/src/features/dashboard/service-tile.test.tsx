import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MantineProvider } from '@mantine/core';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { theme } from '../../theme/theme';
import { ServiceTile } from './service-tile';
import type { Service, CascadeRecord } from '@wakehub/shared';

function renderWithProviders(ui: React.ReactElement, queryClient?: QueryClient) {
  const qc = queryClient ?? new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MantineProvider theme={theme} defaultColorScheme="dark">
        {ui}
      </MantineProvider>
    </QueryClientProvider>,
  );
}

const baseChildService: Service = {
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

const baseParentService: Service = {
  id: 'm1',
  name: 'NAS Server',
  type: 'physical',
  ipAddress: '192.168.1.10',
  macAddress: 'AA:BB:CC:DD:EE:FF',
  sshUser: 'admin',
  apiUrl: null,
  serviceUrl: 'http://nas:5000',
  status: 'online',
  platformRef: null,
  inactivityTimeout: null,
  parentId: null,
  pinnedToDashboard: true,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
};

describe('ServiceTile — Child service (VM)', () => {
  it('renders service name and type', () => {
    renderWithProviders(
      <ServiceTile service={baseChildService} onStart={vi.fn()} />,
    );

    expect(screen.getByText('Jellyfin')).toBeInTheDocument();
    expect(screen.getByText('VM')).toBeInTheDocument();
  });

  it('shows "Actif" badge when running', () => {
    renderWithProviders(
      <ServiceTile service={baseChildService} onStart={vi.fn()} />,
    );

    expect(screen.getByText('Actif')).toBeInTheDocument();
  });

  it('shows "Ouvrir" button when running with serviceUrl', () => {
    renderWithProviders(
      <ServiceTile service={baseChildService} onStart={vi.fn()} />,
    );

    const openBtn = screen.getByRole('link', { name: /Ouvrir Jellyfin/ });
    expect(openBtn).toBeInTheDocument();
    expect(openBtn).toHaveAttribute('href', 'http://jellyfin:8096');
    expect(openBtn).toHaveAttribute('target', '_blank');
  });

  it('shows "Démarrer" button when stopped', () => {
    const stopped = { ...baseChildService, status: 'stopped' as const };
    renderWithProviders(
      <ServiceTile service={stopped} onStart={vi.fn()} />,
    );

    expect(screen.getByText('Éteint')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Démarrer Jellyfin/ })).toBeInTheDocument();
  });

  it('calls onStart when "Démarrer" is clicked', async () => {
    const onStart = vi.fn();
    const stopped = { ...baseChildService, status: 'stopped' as const };
    renderWithProviders(
      <ServiceTile service={stopped} onStart={onStart} />,
    );

    const btn = screen.getByRole('button', { name: /Démarrer Jellyfin/ });
    await userEvent.click(btn);

    expect(onStart).toHaveBeenCalledWith('r1');
  });

  it('shows "En démarrage" badge when cascade is active (start)', () => {
    const activeCascade: CascadeRecord = {
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
    };

    renderWithProviders(
      <ServiceTile
        service={{ ...baseChildService, status: 'stopped' }}
        activeCascade={activeCascade}
        onStart={vi.fn()}
      />,
    );

    expect(screen.getByText('En démarrage')).toBeInTheDocument();
  });

  it('shows "Réessayer" button when cascade failed', () => {
    const failedCascade: CascadeRecord = {
      id: 'c1',
      serviceId: 'r1',
      type: 'start',
      status: 'failed',
      currentStep: 2,
      totalSteps: 3,
      failedStep: 2,
      errorCode: 'SSH_FAILED',
      errorMessage: 'Connexion SSH impossible',
      startedAt: '2026-01-01T00:00:00Z',
      completedAt: '2026-01-01T00:01:00Z',
    };

    renderWithProviders(
      <ServiceTile
        service={{ ...baseChildService, status: 'stopped' }}
        activeCascade={failedCascade}
        onStart={vi.fn()}
      />,
    );

    expect(screen.getByText('Erreur')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Réessayer Jellyfin/ })).toBeInTheDocument();
    expect(screen.getByText(/Connexion SSH impossible/)).toBeInTheDocument();
  });

  it('has correct accessibility attributes', () => {
    renderWithProviders(
      <ServiceTile service={baseChildService} onStart={vi.fn()} />,
    );

    const card = screen.getByRole('article');
    expect(card).toHaveAttribute('aria-label', 'Service Jellyfin — Actif');
  });

  it('shows container type for container services', () => {
    const container = { ...baseChildService, type: 'container' as const };
    renderWithProviders(
      <ServiceTile service={container} onStart={vi.fn()} />,
    );

    expect(screen.getByText('Conteneur')).toBeInTheDocument();
  });

  it('calls onUnpin when unpin button is clicked', async () => {
    const onUnpin = vi.fn();
    renderWithProviders(
      <ServiceTile service={baseChildService} onStart={vi.fn()} onUnpin={onUnpin} />,
    );

    const btn = screen.getByRole('button', { name: /Désépingler Jellyfin/ });
    await userEvent.click(btn);

    expect(onUnpin).toHaveBeenCalledWith('r1');
  });
});

describe('ServiceTile — Parent service (Physical)', () => {
  it('renders service name and type', () => {
    renderWithProviders(
      <ServiceTile service={baseParentService} />,
    );

    expect(screen.getByText('NAS Server')).toBeInTheDocument();
    expect(screen.getByText('Physique')).toBeInTheDocument();
  });

  it('shows "Actif" badge for online service', () => {
    renderWithProviders(
      <ServiceTile service={baseParentService} />,
    );

    expect(screen.getByText('Actif')).toBeInTheDocument();
  });

  it('shows "Ouvrir" for online service with serviceUrl', () => {
    renderWithProviders(
      <ServiceTile service={baseParentService} />,
    );

    const openBtn = screen.getByRole('link', { name: /Ouvrir NAS Server/ });
    expect(openBtn).toBeInTheDocument();
    expect(openBtn).toHaveAttribute('href', 'http://nas:5000');
  });

  it('shows "Éteint" for offline service', () => {
    renderWithProviders(
      <ServiceTile service={{ ...baseParentService, status: 'offline' }} />,
    );

    expect(screen.getByText('Éteint')).toBeInTheDocument();
  });

  it('calls onUnpin when unpin button is clicked', async () => {
    const onUnpin = vi.fn();
    renderWithProviders(
      <ServiceTile service={baseParentService} onUnpin={onUnpin} />,
    );

    const btn = screen.getByRole('button', { name: /Désépingler NAS Server/ });
    await userEvent.click(btn);

    expect(onUnpin).toHaveBeenCalledWith('m1');
  });

  it('does not show unpin button when onUnpin is not provided', () => {
    renderWithProviders(
      <ServiceTile service={baseParentService} />,
    );

    expect(screen.queryByRole('button', { name: /Désépingler/ })).not.toBeInTheDocument();
  });
});

describe('ServiceTile — onTileClick & stopPropagation', () => {
  it('calls onTileClick when card is clicked', async () => {
    const onTileClick = vi.fn();
    renderWithProviders(
      <ServiceTile
        service={baseChildService}
        onStart={vi.fn()}
        onTileClick={onTileClick}
      />,
    );

    await userEvent.click(screen.getByRole('article'));
    expect(onTileClick).toHaveBeenCalledWith('r1');
  });

  it('does not call onTileClick when action button is clicked (stopPropagation)', async () => {
    const onTileClick = vi.fn();
    const onStart = vi.fn();
    const stopped = { ...baseChildService, status: 'stopped' as const };
    renderWithProviders(
      <ServiceTile
        service={stopped}
        onStart={onStart}
        onTileClick={onTileClick}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: /Démarrer Jellyfin/ }));
    expect(onStart).toHaveBeenCalledWith('r1');
    expect(onTileClick).not.toHaveBeenCalled();
  });

  it('does not call onTileClick when unpin button is clicked', async () => {
    const onTileClick = vi.fn();
    const onUnpin = vi.fn();
    renderWithProviders(
      <ServiceTile
        service={baseChildService}
        onStart={vi.fn()}
        onTileClick={onTileClick}
        onUnpin={onUnpin}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: /Désépingler Jellyfin/ }));
    expect(onUnpin).toHaveBeenCalledWith('r1');
    expect(onTileClick).not.toHaveBeenCalled();
  });

  it('does not render clickable style when onTileClick is not provided', () => {
    renderWithProviders(
      <ServiceTile service={baseChildService} onStart={vi.fn()} />,
    );

    const card = screen.getByRole('article');
    expect(card).not.toHaveStyle({ cursor: 'pointer' });
  });
});

describe('ServiceTile — CascadeProgress Integration', () => {
  it('renders progress bar with dependency name when cascade in progress', () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    queryClient.setQueryData(['cascade', 'progress', 'r1'], {
      cascadeId: 'c1',
      serviceId: 'r1',
      step: 2,
      totalSteps: 4,
      currentDependency: { id: 'd1', name: 'NAS Server', status: 'starting' },
      status: 'in_progress',
    });

    const activeCascade: CascadeRecord = {
      id: 'c1', serviceId: 'r1', type: 'start', status: 'in_progress',
      currentStep: 2, totalSteps: 4, failedStep: null,
      errorCode: null, errorMessage: null,
      startedAt: '2026-01-01T00:00:00Z', completedAt: null,
    };

    renderWithProviders(
      <ServiceTile
        service={{ ...baseChildService, status: 'stopped' }}
        activeCascade={activeCascade}
        onStart={vi.fn()}
      />,
      queryClient,
    );

    const bar = screen.getByRole('progressbar');
    expect(bar).toBeInTheDocument();
    expect(bar).toHaveAttribute('aria-valuenow', '50');
    expect(screen.getByText('NAS Server')).toBeInTheDocument();
  });

  it('renders green 100% progress bar on cascade completion', () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    queryClient.setQueryData(['cascade', 'progress', 'r1'], {
      cascadeId: 'c1',
      serviceId: 'r1',
      step: 3,
      totalSteps: 3,
      currentDependency: null,
      status: 'completed',
    });

    renderWithProviders(
      <ServiceTile
        service={{ ...baseChildService, status: 'running' }}
        onStart={vi.fn()}
      />,
      queryClient,
    );

    const bar = screen.getByRole('progressbar');
    expect(bar).toBeInTheDocument();
    expect(bar).toHaveAttribute('aria-valuenow', '100');
    expect(screen.getByText('Terminé')).toBeInTheDocument();
  });

  it('renders red progress bar on cascade failure', () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    queryClient.setQueryData(['cascade', 'progress', 'r1'], {
      cascadeId: 'c1',
      serviceId: 'r1',
      step: 2,
      totalSteps: 4,
      currentDependency: { id: 'd1', name: 'Docker Host', status: 'error' },
      status: 'failed',
    });

    const failedCascade: CascadeRecord = {
      id: 'c1', serviceId: 'r1', type: 'start', status: 'failed',
      currentStep: 2, totalSteps: 4, failedStep: 2,
      errorCode: 'SSH_FAILED', errorMessage: 'Connexion SSH impossible',
      startedAt: '2026-01-01T00:00:00Z', completedAt: '2026-01-01T00:01:00Z',
    };

    renderWithProviders(
      <ServiceTile
        service={{ ...baseChildService, status: 'stopped' }}
        activeCascade={failedCascade}
        onStart={vi.fn()}
      />,
      queryClient,
    );

    const bar = screen.getByRole('progressbar');
    expect(bar).toBeInTheDocument();
    expect(bar).toHaveAttribute('aria-valuenow', '50');
    expect(screen.getByText('Docker Host')).toBeInTheDocument();
  });
});
