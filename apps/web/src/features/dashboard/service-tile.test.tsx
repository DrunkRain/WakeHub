import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { MantineProvider } from '@mantine/core';
import { ServiceTile, type ServiceTileProps } from './service-tile';
import { useCascadeStore } from '../../stores/cascade.store';

function renderTile(props: Partial<ServiceTileProps> = {}) {
  const defaultProps: ServiceTileProps = {
    node: {
      id: 'node-1',
      name: 'Mon Serveur',
      type: 'physical',
      status: 'offline',
      serviceUrl: null,
      isPinned: true,
    },
    dependencyCount: 3,
    onStartCascade: vi.fn(),
    onTogglePin: vi.fn(),
    ...props,
  };

  return {
    ...render(
      <MantineProvider>
        <ServiceTile {...defaultProps} />
      </MantineProvider>,
    ),
    props: defaultProps,
  };
}

describe('ServiceTile', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    useCascadeStore.setState({ cascades: {} });
  });

  it('should render node name and dependency count', () => {
    renderTile();
    expect(screen.getByText('Mon Serveur')).toBeInTheDocument();
    expect(screen.getByText('3 dépendances')).toBeInTheDocument();
  });

  it('should use singular "dépendance" for count of 1', () => {
    renderTile({ dependencyCount: 1 });
    expect(screen.getByText('1 dépendance')).toBeInTheDocument();
  });

  it('should render "Démarrer" button for offline nodes', () => {
    renderTile({ node: { id: 'n1', name: 'S1', type: 'physical', status: 'offline', serviceUrl: null, isPinned: true } });
    expect(screen.getByRole('button', { name: /Démarrer S1/i })).toBeInTheDocument();
  });

  it('should render "Ouvrir" button for online nodes with serviceUrl', () => {
    renderTile({ node: { id: 'n1', name: 'S1', type: 'physical', status: 'online', serviceUrl: 'https://example.com', isPinned: true } });
    expect(screen.getByRole('button', { name: /Ouvrir S1/i })).toBeInTheDocument();
  });

  it('should not render action button for online nodes without serviceUrl', () => {
    renderTile({ node: { id: 'n1', name: 'S1', type: 'physical', status: 'online', serviceUrl: null, isPinned: true } });
    expect(screen.queryByRole('button', { name: /Ouvrir/i })).not.toBeInTheDocument();
  });

  it('should render "Réessayer" button for error nodes', () => {
    renderTile({ node: { id: 'n1', name: 'S1', type: 'physical', status: 'error', serviceUrl: null, isPinned: true } });
    expect(screen.getByRole('button', { name: /Réessayer S1/i })).toBeInTheDocument();
  });

  it('should render disabled button for starting nodes', () => {
    renderTile({ node: { id: 'n1', name: 'S1', type: 'physical', status: 'starting', serviceUrl: null, isPinned: true } });
    const btn = screen.getByText('Démarrage…');
    expect(btn.closest('button')).toBeDisabled();
  });

  it('should call onStartCascade when "Démarrer" is clicked', async () => {
    const onStartCascade = vi.fn();
    renderTile({
      node: { id: 'node-42', name: 'S1', type: 'physical', status: 'offline', serviceUrl: null, isPinned: true },
      onStartCascade,
    });

    await userEvent.click(screen.getByRole('button', { name: /Démarrer S1/i }));
    expect(onStartCascade).toHaveBeenCalledWith('node-42');
  });

  it('should call onTogglePin when pin button is clicked', async () => {
    const onTogglePin = vi.fn();
    renderTile({
      node: { id: 'node-42', name: 'S1', type: 'physical', status: 'offline', serviceUrl: null, isPinned: true },
      onTogglePin,
    });

    await userEvent.click(screen.getByRole('button', { name: /Désépingler S1/i }));
    expect(onTogglePin).toHaveBeenCalledWith('node-42', false);
  });

  it('should have role="article" and aria-label', () => {
    renderTile({ node: { id: 'n1', name: 'MyNode', type: 'physical', status: 'online', serviceUrl: null, isPinned: false } });
    const article = screen.getByRole('article');
    expect(article).toHaveAttribute('aria-label', 'MyNode — online');
  });

  it('should open serviceUrl in new tab when "Ouvrir" is clicked', async () => {
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
    renderTile({ node: { id: 'n1', name: 'S1', type: 'physical', status: 'online', serviceUrl: 'https://service.local', isPinned: true } });

    await userEvent.click(screen.getByRole('button', { name: /Ouvrir S1/i }));
    expect(openSpy).toHaveBeenCalledWith('https://service.local', '_blank', 'noopener,noreferrer');
  });

  it('should render CascadeProgress when cascade is active for this node', () => {
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

    renderTile({ node: { id: 'node-1', name: 'Mon Serveur', type: 'physical', status: 'starting', serviceUrl: null, isPinned: true } });
    expect(screen.getByText('NAS-Storage')).toBeInTheDocument();
    expect(screen.getAllByRole('progressbar').length).toBeGreaterThan(0);
  });

  it('should not render CascadeProgress when no cascade is active', () => {
    renderTile();
    expect(screen.queryByText('NAS-Storage')).not.toBeInTheDocument();
  });

  it('should call onCardClick when card is clicked', async () => {
    const onCardClick = vi.fn();
    renderTile({
      node: { id: 'node-42', name: 'S1', type: 'physical', status: 'offline', serviceUrl: null, isPinned: true },
      onCardClick,
    });

    await userEvent.click(screen.getByRole('article'));
    expect(onCardClick).toHaveBeenCalledWith('node-42');
  });

  it('should NOT call onCardClick when action button is clicked', async () => {
    const onCardClick = vi.fn();
    const onStartCascade = vi.fn();
    renderTile({
      node: { id: 'node-42', name: 'S1', type: 'physical', status: 'offline', serviceUrl: null, isPinned: true },
      onCardClick,
      onStartCascade,
    });

    await userEvent.click(screen.getByRole('button', { name: /Démarrer S1/i }));
    expect(onStartCascade).toHaveBeenCalledWith('node-42');
    expect(onCardClick).not.toHaveBeenCalled();
  });

  it('should NOT call onCardClick when pin button is clicked', async () => {
    const onCardClick = vi.fn();
    const onTogglePin = vi.fn();
    renderTile({
      node: { id: 'node-42', name: 'S1', type: 'physical', status: 'offline', serviceUrl: null, isPinned: true },
      onCardClick,
      onTogglePin,
    });

    await userEvent.click(screen.getByRole('button', { name: /Désépingler S1/i }));
    expect(onTogglePin).toHaveBeenCalled();
    expect(onCardClick).not.toHaveBeenCalled();
  });
});
