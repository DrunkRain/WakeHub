import { Handle, Position, type NodeProps, type Node } from '@xyflow/react';
import { Paper, Group, Text } from '@mantine/core';
import { NodeTypeIcon } from '../../components/shared/node-type-icon';
import { StatusBadge } from '../../components/shared/status-badge';
import type { NodeType, NodeStatus } from '@wakehub/shared';

export type InfraNodeData = {
  label: string;
  nodeType: NodeType;
  status: NodeStatus;
  isShared: boolean;
};

export function InfraNode({ data }: NodeProps<Node<InfraNodeData>>) {
  return (
    <>
      <Handle type="target" position={Position.Top} />
      <Paper
        p="xs"
        radius="sm"
        withBorder
        style={{
          background: 'var(--mantine-color-dark-6)',
          borderColor: data.isShared
            ? 'var(--mantine-color-blue-5)'
            : 'var(--mantine-color-dark-4)',
          borderWidth: data.isShared ? 2 : 1,
          minWidth: 160,
        }}
      >
        <Group gap="xs">
          <NodeTypeIcon type={data.nodeType} size={16} />
          <Text size="sm" fw={500} c="gray.1">
            {data.label}
          </Text>
        </Group>
        <StatusBadge status={data.status} size="xs" />
      </Paper>
      <Handle type="source" position={Position.Bottom} />
    </>
  );
}
