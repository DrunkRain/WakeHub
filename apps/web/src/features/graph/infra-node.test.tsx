import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { InfraNode } from './infra-node';
import type { NodeProps, Node } from '@xyflow/react';
import type { InfraNodeData } from './infra-node';

vi.mock('@xyflow/react', () => ({
  Handle: () => null,
  Position: { Top: 'top', Bottom: 'bottom', Left: 'left', Right: 'right' },
}));

function renderInfraNode(data: InfraNodeData) {
  const props = {
    id: 'test-node',
    data,
    type: 'infra',
  } as unknown as NodeProps<Node<InfraNodeData>>;

  return render(
    <MantineProvider>
      <InfraNode {...props} />
    </MantineProvider>,
  );
}

describe('InfraNode', () => {
  it('should render with label, type icon and status badge', () => {
    renderInfraNode({
      label: 'My Server',
      nodeType: 'physical',
      status: 'online',
      isShared: false,
    });

    expect(screen.getByText('My Server')).toBeInTheDocument();
    expect(screen.getByText('Actif')).toBeInTheDocument();
  });

  it('should show correct status badge for offline status', () => {
    renderInfraNode({
      label: 'Docker Host',
      nodeType: 'container',
      status: 'offline',
      isShared: false,
    });

    expect(screen.getByText('Docker Host')).toBeInTheDocument();
    expect(screen.getByText('Eteint')).toBeInTheDocument();
  });

  it('should show correct status badge for error status', () => {
    renderInfraNode({
      label: 'Broken VM',
      nodeType: 'vm',
      status: 'error',
      isShared: false,
    });

    expect(screen.getByText('Broken VM')).toBeInTheDocument();
    expect(screen.getByText('Erreur')).toBeInTheDocument();
  });

  it('should apply shared border style when isShared is true', () => {
    const { container } = renderInfraNode({
      label: 'Shared NAS',
      nodeType: 'physical',
      status: 'online',
      isShared: true,
    });

    const paper = container.querySelector('[class*="paper"]') || container.firstElementChild;
    expect(paper).toBeInTheDocument();
    expect(screen.getByText('Shared NAS')).toBeInTheDocument();
  });

  it('should render different node types', () => {
    renderInfraNode({
      label: 'LXC Container',
      nodeType: 'lxc',
      status: 'starting',
      isShared: false,
    });

    expect(screen.getByText('LXC Container')).toBeInTheDocument();
    expect(screen.getByText('Demarrage')).toBeInTheDocument();
  });
});
