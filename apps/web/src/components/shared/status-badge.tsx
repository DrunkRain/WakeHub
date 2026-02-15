import { Badge } from '@mantine/core';
import type { NodeStatus } from '@wakehub/shared';

const statusColors: Record<NodeStatus, string> = {
  online: 'green',
  offline: 'gray',
  starting: 'yellow',
  stopping: 'orange',
  error: 'red',
};

const statusLabels: Record<NodeStatus, string> = {
  online: 'Actif',
  offline: 'Eteint',
  starting: 'Demarrage',
  stopping: 'Arret',
  error: 'Erreur',
};

interface StatusBadgeProps {
  status: NodeStatus;
  size?: string;
}

export function StatusBadge({ status, size }: StatusBadgeProps) {
  return (
    <Badge color={statusColors[status]} size={size} variant="filled">
      {statusLabels[status]}
    </Badge>
  );
}
