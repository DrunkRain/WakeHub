import { useState, useMemo, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router';
import {
  ReactFlow,
  Background,
  Controls,
  type Node,
  type Edge,
  type NodeProps,
  Handle,
  Position,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import dagre from '@dagrejs/dagre';
import { Paper, Group, Text, Badge, Button } from '@mantine/core';
import {
  IconServer,
  IconBox,
  IconBrandDocker,
  IconDeviceDesktop,
  IconPackage,
  IconTrash,
} from '@tabler/icons-react';
import type { GraphNode, GraphEdge } from '@wakehub/shared';

const NODE_WIDTH = 220;
const NODE_HEIGHT = 50;

const STATUS_COLORS: Record<string, string> = {
  online: 'green',
  offline: 'gray',
  running: 'green',
  stopped: 'red',
  paused: 'yellow',
  unknown: 'gray',
  error: 'orange',
};

const SUBTYPE_ICONS: Record<string, typeof IconServer> = {
  physical: IconServer,
  proxmox: IconBox,
  docker: IconBrandDocker,
  vm: IconDeviceDesktop,
  container: IconPackage,
};

interface DependencyNodeData {
  name: string;
  nodeType: string;
  subType: string;
  status: string;
  isShared: boolean;
  originalId: string;
  [key: string]: unknown;
}

function DependencyNode({ data }: NodeProps<Node<DependencyNodeData>>) {
  const Icon = SUBTYPE_ICONS[data.subType] ?? IconServer;
  const color = STATUS_COLORS[data.status] ?? 'gray';

  return (
    <>
      <Handle type="target" position={Position.Top} style={{ opacity: 0 }} />
      <Paper
        withBorder
        p="xs"
        radius="sm"
        style={{
          borderWidth: data.isShared ? 2 : 1,
          borderColor: data.isShared ? 'var(--mantine-color-yellow-5)' : undefined,
          cursor: 'pointer',
          minWidth: NODE_WIDTH,
        }}
      >
        <Group gap="xs" wrap="nowrap">
          <Icon size={16} />
          <Text size="sm" fw={500} truncate style={{ flex: 1 }}>
            {data.name}
          </Text>
          <Badge size="xs" color={color} variant="light">
            {data.status}
          </Badge>
        </Group>
      </Paper>
      <Handle type="source" position={Position.Bottom} style={{ opacity: 0 }} />
    </>
  );
}

const nodeTypes = { dependency: DependencyNode };

function getLayoutedElements(
  nodes: Node<DependencyNodeData>[],
  edges: Edge[],
): { nodes: Node<DependencyNodeData>[]; edges: Edge[] } {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: 'TB', nodesep: 60, ranksep: 80 });

  nodes.forEach((node) => {
    g.setNode(node.id, { width: NODE_WIDTH, height: NODE_HEIGHT });
  });
  edges.forEach((edge) => {
    g.setEdge(edge.source, edge.target);
  });

  dagre.layout(g);

  const layoutedNodes = nodes.map((node) => {
    const pos = g.node(node.id);
    return {
      ...node,
      position: { x: pos.x - NODE_WIDTH / 2, y: pos.y - NODE_HEIGHT / 2 },
    };
  });

  return { nodes: layoutedNodes, edges };
}

interface DependencyGraphProps {
  graphNodes: GraphNode[];
  graphEdges: GraphEdge[];
  onDeleteEdge?: (edgeId: string) => void;
}

export function DependencyGraph({ graphNodes, graphEdges, onDeleteEdge }: DependencyGraphProps) {
  const navigate = useNavigate();
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; edgeId: string } | null>(null);

  const { nodes, edges } = useMemo(() => {
    const rfNodes: Node<DependencyNodeData>[] = graphNodes.map((n) => ({
      id: n.id,
      type: 'dependency',
      position: { x: 0, y: 0 },
      data: {
        name: n.name,
        nodeType: n.nodeType,
        subType: n.subType,
        status: n.status,
        isShared: n.isShared,
        originalId: n.id.split(':')[1] ?? n.id,
      },
    }));

    const rfEdges: Edge[] = graphEdges.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      type: 'smoothstep',
      animated: false,
      style: {
        stroke: e.isShared ? 'var(--mantine-color-yellow-5)' : undefined,
        strokeWidth: e.isShared ? 2 : 1,
      },
      markerEnd: { type: 'arrowclosed' as const },
    }));

    if (rfNodes.length === 0) return { nodes: [], edges: [] };
    return getLayoutedElements(rfNodes, rfEdges);
  }, [graphNodes, graphEdges]);

  const onNodeClick = useCallback(
    (_event: React.MouseEvent, node: Node<DependencyNodeData>) => {
      const [_type, ...rest] = node.id.split(':');
      const id = rest.join(':') || node.id;
      navigate(`/services/${id}`);
    },
    [navigate],
  );

  const onEdgeContextMenu = useCallback(
    (event: React.MouseEvent, edge: Edge) => {
      if (!onDeleteEdge) return;
      event.preventDefault();
      setContextMenu({ x: event.clientX, y: event.clientY, edgeId: edge.id });
    },
    [onDeleteEdge],
  );

  // Close context menu on click anywhere
  useEffect(() => {
    if (!contextMenu) return;
    const handleClick = () => setContextMenu(null);
    window.addEventListener('click', handleClick);
    return () => window.removeEventListener('click', handleClick);
  }, [contextMenu]);

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodeClick={onNodeClick}
        onEdgeContextMenu={onEdgeContextMenu}
        onPaneClick={() => setContextMenu(null)}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.3}
        maxZoom={2}
        proOptions={{ hideAttribution: true }}
      >
        <Background />
        <Controls />
      </ReactFlow>

      {contextMenu && (
        <Paper
          shadow="md"
          withBorder
          p="xs"
          style={{
            position: 'fixed',
            left: contextMenu.x,
            top: contextMenu.y,
            zIndex: 1000,
          }}
        >
          <Button
            variant="subtle"
            color="red"
            size="xs"
            leftSection={<IconTrash size={14} />}
            onClick={(e) => {
              e.stopPropagation();
              onDeleteEdge?.(contextMenu.edgeId);
              setContextMenu(null);
            }}
          >
            Supprimer ce lien
          </Button>
        </Paper>
      )}
    </div>
  );
}
