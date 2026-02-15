import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { MantineProvider } from '@mantine/core';
import { MemoryRouter } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ServiceDetailPanel, type ServiceDetailPanelProps, type ServiceDetailNode } from './service-detail-panel';
import { useCascadeStore } from '../../stores/cascade.store';
import React from 'react';

const mockUseDependencies = vi.hoisted(() => vi.fn());
vi.mock('../../api/dependencies.api', () => ({
  useDependencies: mockUseDependencies,
}));

const mockNavigate = vi.hoisted(() => vi.fn());
vi.mock('react-router', async () => {
  const actual = await vi.importActual('react-router');
  return { ...actual, useNavigate: () => mockNavigate };
});

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(
      QueryClientProvider,
      { client: queryClient },
      React.createElement(
        MantineProvider,
        null,
        React.createElement(MemoryRouter, null, children),
      ),
    );
}

const defaultNode: ServiceDetailNode = {
  id: 'node-1',
  name: 'Mon Serveur',
  type: 'physical',
  status: 'offline',
  serviceUrl: null,
  isPinned: true,
};

function renderPanel(props: Partial<ServiceDetailPanelProps> = {}) {
  const defaultProps: ServiceDetailPanelProps = {
    node: defaultNode,
    opened: true,
    onClose: vi.fn(),
    onStartCascade: vi.fn(),
    onStopCascade: vi.fn(),
    ...props,
  };

  const Wrapper = createWrapper();
  return {
    ...render(
      <Wrapper>
        <ServiceDetailPanel {...defaultProps} />
      </Wrapper>,
    ),
    props: defaultProps,
  };
}

describe('ServiceDetailPanel', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    useCascadeStore.setState({ cascades: {} });
    mockUseDependencies.mockReturnValue({
      data: { data: { upstream: [], downstream: [] } },
      isLoading: false,
    });
  });

  it('should render drawer with node name when opened', () => {
    renderPanel();
    expect(screen.getByText('Mon Serveur')).toBeInTheDocument();
  });

  it('should not render node content when opened is false', () => {
    renderPanel({ opened: false });
    expect(screen.queryByText('Mon Serveur')).not.toBeInTheDocument();
  });

  it('should render header with icon, name, and status badge', () => {
    renderPanel({ node: { ...defaultNode, status: 'online' } });
    expect(screen.getByText('Mon Serveur')).toBeInTheDocument();
    expect(screen.getByText('Actif')).toBeInTheDocument();
  });

  it('should have dependencies tab active by default', () => {
    renderPanel();
    const tab = screen.getByRole('tab', { name: /Dépendances/i });
    expect(tab).toHaveAttribute('aria-selected', 'true');
  });

  it('should render upstream dependencies in the dependencies tab', () => {
    mockUseDependencies.mockReturnValue({
      data: {
        data: {
          upstream: [
            { linkId: 'l1', nodeId: 'n2', name: 'NAS-Storage', type: 'physical', status: 'online' },
            { linkId: 'l2', nodeId: 'n3', name: 'Proxmox-01', type: 'vm', status: 'offline' },
          ],
          downstream: [],
        },
      },
      isLoading: false,
    });

    renderPanel();
    expect(screen.getByText('NAS-Storage')).toBeInTheDocument();
    expect(screen.getByText('Proxmox-01')).toBeInTheDocument();
  });

  it('should render logs content in the logs tab', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ data: { logs: [], total: 0 } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    renderPanel();
    await userEvent.click(screen.getByRole('tab', { name: /Logs/i }));
    expect(await screen.findByText('Aucun log pour ce noeud')).toBeInTheDocument();
  });

  it('should render "Démarrer" button for offline node', () => {
    renderPanel({ node: { ...defaultNode, status: 'offline' } });
    expect(screen.getByRole('button', { name: /Démarrer Mon Serveur/i })).toBeInTheDocument();
  });

  it('should render "Arrêter" button for online node', () => {
    renderPanel({ node: { ...defaultNode, status: 'online' } });
    expect(screen.getByRole('button', { name: /Arrêter Mon Serveur/i })).toBeInTheDocument();
  });

  it('should render "Ouvrir" + "Arrêter" for online node with serviceUrl', () => {
    renderPanel({ node: { ...defaultNode, status: 'online', serviceUrl: 'https://service.local' } });
    expect(screen.getByRole('button', { name: /Ouvrir Mon Serveur/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Arrêter Mon Serveur/i })).toBeInTheDocument();
  });

  it('should open stop confirmation modal when "Arrêter" is clicked', async () => {
    renderPanel({ node: { ...defaultNode, status: 'online' } });
    await userEvent.click(screen.getByRole('button', { name: /Arrêter Mon Serveur/i }));
    expect(await screen.findByRole('button', { name: /Confirmer l'arrêt/i })).toBeInTheDocument();
    expect(screen.getByText(/Cette action va arrêter/)).toBeInTheDocument();
  });

  it('should call onStopCascade when stop is confirmed', async () => {
    const onStopCascade = vi.fn();
    renderPanel({ node: { ...defaultNode, status: 'online' }, onStopCascade });
    await userEvent.click(screen.getByRole('button', { name: /Arrêter Mon Serveur/i }));
    const confirmBtn = await screen.findByRole('button', { name: /Confirmer l'arrêt/i });
    await userEvent.click(confirmBtn);
    expect(onStopCascade).toHaveBeenCalledWith('node-1');
  });

  it('should call onStartCascade when "Démarrer" is clicked', async () => {
    const onStartCascade = vi.fn();
    renderPanel({ node: { ...defaultNode, status: 'offline' }, onStartCascade });
    await userEvent.click(screen.getByRole('button', { name: /Démarrer Mon Serveur/i }));
    expect(onStartCascade).toHaveBeenCalledWith('node-1');
  });

  it('should have aria-label on the drawer', () => {
    renderPanel();
    const drawer = document.querySelector('.mantine-Drawer-root');
    expect(drawer).toHaveAttribute('aria-label', 'Détail du service Mon Serveur');
  });

  it('should render CascadeProgress when cascade is active', () => {
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

    renderPanel({ node: { ...defaultNode, status: 'starting' } });
    expect(screen.getByText('NAS-Storage')).toBeInTheDocument();
  });

  it('should render actual logs and "Voir tous les logs" link in logs tab', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({
        data: {
          logs: [
            {
              id: 'log-1',
              timestamp: '2026-02-15T14:30:00.000Z',
              level: 'info',
              source: 'cascade-engine',
              message: 'Service démarré OK',
              reason: null,
              details: null,
              nodeId: 'node-1',
              nodeName: 'Mon Serveur',
              eventType: 'start',
              errorCode: null,
              errorDetails: null,
              cascadeId: null,
            },
          ],
          total: 1,
        },
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    renderPanel();
    await userEvent.click(screen.getByRole('tab', { name: /Logs/i }));

    expect(await screen.findByText('Service démarré OK')).toBeInTheDocument();
    const link = screen.getByText('Voir tous les logs');
    expect(link).toBeInTheDocument();
    expect(link.closest('a')).toHaveAttribute('href', '/logs?nodeId=node-1');
  });

  it('should show downstream deps in stop modal', async () => {
    mockUseDependencies.mockReturnValue({
      data: {
        data: {
          upstream: [],
          downstream: [
            { linkId: 'l1', nodeId: 'n2', name: 'VM-Media', type: 'vm', status: 'online' },
          ],
        },
      },
      isLoading: false,
    });

    renderPanel({ node: { ...defaultNode, status: 'online' } });
    await userEvent.click(screen.getByRole('button', { name: /Arrêter Mon Serveur/i }));
    expect(await screen.findByText('VM-Media')).toBeInTheDocument();
  });
});
