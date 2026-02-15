import { useState } from 'react';
import { Container, SimpleGrid, Title } from '@mantine/core';
import { IconPin } from '@tabler/icons-react';
import { useNodes, useUpdateNode } from '../../api/nodes.api';
import { useStartCascade, useStopCascade } from '../../api/cascades.api';
import { useDependencyGraph } from '../../api/dependencies.api';
import { StatsBar } from '../dashboard/stats-bar';
import { ServiceTile } from '../dashboard/service-tile';
import { ServiceDetailPanel } from '../dashboard/service-detail-panel';
import { EmptyState } from '../../components/shared/empty-state';
import { SkeletonLoader } from '../../components/shared/skeleton-loader';
import { useNavigate } from 'react-router';

export function HomePage() {
  const { data: nodesData, isLoading: nodesLoading } = useNodes();
  const { data: graphData } = useDependencyGraph();
  const startCascade = useStartCascade();
  const stopCascade = useStopCascade();
  const updateNode = useUpdateNode();
  const navigate = useNavigate();
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  const nodes = nodesData?.data?.nodes ?? [];
  const pinnedNodes = nodes
    .filter((n) => n.isPinned)
    .sort((a, b) => a.name.localeCompare(b.name));

  // Build nodeId → type map for cascade progress icon resolution
  const nodeTypeMap: Record<string, string> = {};
  for (const n of nodes) {
    nodeTypeMap[n.id] = n.type;
  }

  // Count dependencies per node from graph data
  const depCountMap = new Map<string, number>();
  if (graphData?.data?.links) {
    for (const link of graphData.data.links) {
      depCountMap.set(link.fromNodeId, (depCountMap.get(link.fromNodeId) || 0) + 1);
    }
  }

  if (nodesLoading) {
    return (
      <Container py="xl">
        <Title order={1} mb="lg">Dashboard</Title>
        <StatsBar />
        <SkeletonLoader count={6} height={160} />
      </Container>
    );
  }

  return (
    <Container py="xl">
      <Title order={1} mb="lg">Dashboard</Title>
      <StatsBar />

      {pinnedNodes.length === 0 ? (
        <EmptyState
          icon={IconPin}
          title="Aucun noeud épinglé"
          description="Épinglez des noeuds depuis la page Noeuds pour les voir ici."
          action={{ label: 'Voir les noeuds', onClick: () => navigate('/nodes') }}
        />
      ) : (
        <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }}>
          {pinnedNodes.map((node) => (
            <ServiceTile
              key={node.id}
              node={node}
              dependencyCount={depCountMap.get(node.id) || 0}
              onStartCascade={(nodeId) => startCascade.mutate(nodeId)}
              onTogglePin={(nodeId, isPinned) => updateNode.mutate({ nodeId, data: { isPinned } })}
              onCardClick={setSelectedNodeId}
              nodeTypeMap={nodeTypeMap}
            />
          ))}
        </SimpleGrid>
      )}

      <ServiceDetailPanel
        node={nodes.find((n) => n.id === selectedNodeId) ?? null}
        opened={!!selectedNodeId}
        onClose={() => setSelectedNodeId(null)}
        onStartCascade={(nodeId) => startCascade.mutate(nodeId)}
        onStopCascade={(nodeId) => stopCascade.mutate(nodeId)}
        nodeTypeMap={nodeTypeMap}
      />
    </Container>
  );
}
