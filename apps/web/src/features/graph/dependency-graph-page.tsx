import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  MarkerType,
  ConnectionLineType,
  type Node,
  type Edge,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import './react-flow-overrides.css';
import dagre from '@dagrejs/dagre';
import { Stack, Title, Text, Button, Center, Skeleton } from '@mantine/core';
import { IconArrowRight } from '@tabler/icons-react';
import { useNavigate } from 'react-router';
import { useDependencyGraph } from '../../api/dependencies.api';
import { InfraNode, type InfraNodeData } from './infra-node';
import type { DependencyGraphResponse } from '@wakehub/shared';

const NODE_WIDTH = 180;
const NODE_HEIGHT = 60;

const nodeTypes = { infra: InfraNode };

function getLayoutedElements(nodes: Node[], edges: Edge[], direction = 'TB') {
  const g = new dagre.graphlib.Graph().setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: direction, nodesep: 60, ranksep: 100 });
  nodes.forEach((n) => g.setNode(n.id, { width: NODE_WIDTH, height: NODE_HEIGHT }));
  edges.forEach((e) => g.setEdge(e.source, e.target));
  dagre.layout(g);

  return {
    nodes: nodes.map((n) => {
      const pos = g.node(n.id);
      return { ...n, position: { x: pos.x - NODE_WIDTH / 2, y: pos.y - NODE_HEIGHT / 2 } };
    }),
    edges,
  };
}

function transformToReactFlow(graphData: DependencyGraphResponse) {
  const nodeSet = new Set<string>();
  graphData.links.forEach((l) => {
    nodeSet.add(l.fromNodeId);
    nodeSet.add(l.toNodeId);
  });

  // Count downstream dependents for shared detection
  const downstreamCount = new Map<string, number>();
  graphData.links.forEach((l) => {
    downstreamCount.set(l.toNodeId, (downstreamCount.get(l.toNodeId) ?? 0) + 1);
  });

  const nodes: Node<InfraNodeData>[] = graphData.nodes
    .filter((n) => nodeSet.has(n.id))
    .map((n) => ({
      id: n.id,
      type: 'infra' as const,
      position: { x: 0, y: 0 },
      data: {
        label: n.name,
        nodeType: n.type,
        status: n.status,
        isShared: (downstreamCount.get(n.id) ?? 0) > 1,
      } as InfraNodeData,
    }));

  // Build a status map for active-edge detection
  const statusMap = new Map(graphData.nodes.map((n) => [n.id, n.status]));
  const isActive = (id: string) => {
    const s = statusMap.get(id);
    return s === 'online' || s === 'starting';
  };

  const edges: Edge[] = graphData.links.map((l) => {
    const active = isActive(l.fromNodeId) && isActive(l.toNodeId);
    const isStructural = l.linkType === 'structural';
    const stroke = active
      ? 'var(--mantine-color-teal-5)'
      : 'var(--mantine-color-gray-6)';

    return {
      id: l.id,
      source: l.fromNodeId,
      target: l.toNodeId,
      type: 'smoothstep',
      animated: false,
      style: {
        stroke,
        strokeDasharray: isStructural ? undefined : '6 3',
      },
      markerEnd: { type: MarkerType.ArrowClosed, color: stroke },
    };
  });

  return getLayoutedElements(nodes, edges);
}

export function DependencyGraphPage() {
  const navigate = useNavigate();
  const { data, isLoading, isError, error } = useDependencyGraph();

  if (isLoading) {
    return (
      <Stack p="md">
        <Title order={2}>Graphe de dependances</Title>
        <Skeleton height={400} />
      </Stack>
    );
  }

  if (isError) {
    return (
      <Stack p="md">
        <Title order={2}>Graphe de dependances</Title>
        <Center style={{ height: 400 }}>
          <Text c="red" ta="center">
            Erreur lors du chargement du graphe : {error?.error?.message ?? 'Erreur inconnue'}
          </Text>
        </Center>
      </Stack>
    );
  }

  const graphData = data?.data;
  const hasLinks = graphData && graphData.links.length > 0;

  if (!hasLinks) {
    return (
      <Stack p="md">
        <Title order={2}>Graphe de dependances</Title>
        <Center style={{ height: 400 }}>
          <Stack align="center" gap="md">
            <Text c="dimmed" ta="center">
              Aucune dependance fonctionnelle definie.
              Definissez des dependances depuis la page detail d'un noeud.
            </Text>
            <Button
              leftSection={<IconArrowRight size={16} />}
              variant="light"
              onClick={() => navigate('/nodes')}
            >
              Voir les noeuds
            </Button>
          </Stack>
        </Center>
      </Stack>
    );
  }

  const { nodes, edges } = transformToReactFlow(graphData);

  return (
    <Stack p="md" style={{ height: 'calc(100vh - 60px)' }}>
      <Title order={2}>Graphe de dependances</Title>
      <div style={{ flex: 1 }}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          onNodeClick={(_event, node) => navigate(`/nodes/${node.id}`)}
          fitView
          fitViewOptions={{ padding: 0.2 }}
          colorMode="dark"
          connectionLineType={ConnectionLineType.SmoothStep}
          nodesConnectable={false}
          nodesDraggable={false}
        >
          <Background />
          <Controls />
          <MiniMap />
        </ReactFlow>
      </div>
    </Stack>
  );
}
