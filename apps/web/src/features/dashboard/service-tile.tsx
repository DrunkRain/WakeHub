import { Card, Group, Stack, Text, Button, ActionIcon, Tooltip } from '@mantine/core';
import { IconPin, IconPinnedOff, IconExternalLink } from '@tabler/icons-react';
import { StatusBadge } from '../../components/shared/status-badge';
import { NodeTypeIcon } from '../../components/shared/node-type-icon';
import { CascadeProgress } from './cascade-progress';
import { useCascadeForNode } from '../../stores/cascade.store';
import type { NodeType, NodeStatus } from '@wakehub/shared';

export interface ServiceTileProps {
  node: {
    id: string;
    name: string;
    type: string;
    status: string;
    serviceUrl: string | null;
    isPinned: boolean;
  };
  dependencyCount: number;
  onStartCascade: (nodeId: string) => void;
  onTogglePin: (nodeId: string, isPinned: boolean) => void;
  onCardClick?: (nodeId: string) => void;
  nodeTypeMap?: Record<string, string>;
}

function getActionButton(
  status: string,
  serviceUrl: string | null,
  onStart: () => void,
): { label: string; color: string; onClick: () => void; disabled: boolean; loading: boolean } | null {
  switch (status) {
    case 'offline':
      return { label: 'Démarrer', color: 'blue.4', onClick: onStart, disabled: false, loading: false };
    case 'online':
      if (!serviceUrl) return null;
      return {
        label: 'Ouvrir',
        color: 'blue.4',
        onClick: () => window.open(serviceUrl, '_blank', 'noopener,noreferrer'),
        disabled: false,
        loading: false,
      };
    case 'error':
      return { label: 'Réessayer', color: 'orange.4', onClick: onStart, disabled: false, loading: false };
    case 'starting':
      return { label: 'Démarrage…', color: 'yellow.4', onClick: () => {}, disabled: true, loading: true };
    case 'stopping':
      return { label: 'Arrêt…', color: 'orange.4', onClick: () => {}, disabled: true, loading: true };
    default:
      return null;
  }
}

export function ServiceTile({ node, dependencyCount, onStartCascade, onTogglePin, onCardClick, nodeTypeMap }: ServiceTileProps) {
  const cascadeState = useCascadeForNode(node.id);
  const actionButton = getActionButton(node.status, node.serviceUrl, () => onStartCascade(node.id));

  const currentNodeType = cascadeState?.currentNodeId && nodeTypeMap
    ? nodeTypeMap[cascadeState.currentNodeId]
    : undefined;

  return (
    <Card
      withBorder
      padding="md"
      role="article"
      aria-label={`${node.name} — ${node.status}`}
      onClick={() => onCardClick?.(node.id)}
      style={{ cursor: onCardClick ? 'pointer' : undefined }}
    >
      <Stack gap="sm">
        <Group justify="space-between">
          <Group gap="sm">
            <NodeTypeIcon type={node.type as NodeType} size={24} />
            <Text fw={600} size="md">{node.name}</Text>
          </Group>
          <Tooltip label={node.isPinned ? 'Désépingler' : 'Épingler'}>
            <ActionIcon
              variant="subtle"
              color={node.isPinned ? 'blue' : 'gray'}
              aria-label={node.isPinned ? `Désépingler ${node.name}` : `Épingler ${node.name}`}
              onClick={(e) => { e.stopPropagation(); onTogglePin(node.id, !node.isPinned); }}
            >
              {node.isPinned ? <IconPin size={18} /> : <IconPinnedOff size={18} />}
            </ActionIcon>
          </Tooltip>
        </Group>

        <Group gap="xs">
          <StatusBadge status={node.status as NodeStatus} size="sm" />
          <Text size="sm" c="dimmed">· {node.type}</Text>
        </Group>

        <Text size="sm" c="dimmed">
          {dependencyCount} {dependencyCount <= 1 ? 'dépendance' : 'dépendances'}
        </Text>

        {actionButton && (
          <Button
            color={actionButton.color}
            onClick={(e) => { e.stopPropagation(); actionButton.onClick(); }}
            disabled={actionButton.disabled}
            loading={actionButton.loading}
            fullWidth
            aria-label={`${actionButton.label} ${node.name}`}
            leftSection={actionButton.label === 'Ouvrir' ? <IconExternalLink size={16} /> : undefined}
          >
            {actionButton.label}
          </Button>
        )}
      </Stack>

      {cascadeState && (
        <Card.Section inheritPadding py="xs">
          <CascadeProgress
            step={cascadeState.step}
            totalSteps={cascadeState.totalSteps}
            currentNodeName={cascadeState.currentNodeName}
            currentNodeType={currentNodeType}
            status={cascadeState.status}
            errorNodeName={cascadeState.errorNodeName}
          />
        </Card.Section>
      )}
    </Card>
  );
}
