import { Group, Progress, Text, Transition } from '@mantine/core';
import { NodeTypeIcon } from '../../components/shared/node-type-icon';
import type { NodeType } from '@wakehub/shared';

export interface CascadeProgressProps {
  step: number;
  totalSteps: number;
  currentNodeName?: string;
  currentNodeType?: string;
  status: 'in_progress' | 'completed' | 'failed';
  errorNodeName?: string;
}

function getBarColor(status: CascadeProgressProps['status']): string {
  switch (status) {
    case 'completed':
      return 'green.5';
    case 'failed':
      return 'red.5';
    default:
      return 'blue.4';
  }
}

export function CascadeProgress({
  step,
  totalSteps,
  currentNodeName,
  currentNodeType,
  status,
  errorNodeName,
}: CascadeProgressProps) {
  const percent = totalSteps > 0 ? (step / totalSteps) * 100 : 0;

  return (
    <>
      <div aria-live="polite">
        <Transition mounted={!!currentNodeName && status === 'in_progress'} transition="fade" duration={200}>
          {(styles) => (
            <Group gap="xs" style={styles} mt="xs">
              {currentNodeType && (
                <NodeTypeIcon type={currentNodeType as NodeType} size={16} />
              )}
              <Text size="sm" c="dimmed">{currentNodeName}</Text>
            </Group>
          )}
        </Transition>

        {status === 'failed' && errorNodeName && (
          <Text size="sm" c="red.5" mt={4}>
            Échec : {errorNodeName}
          </Text>
        )}
      </div>

      <Progress
        value={percent}
        size={3}
        radius={0}
        color={getBarColor(status)}
        mt="xs"
      />
    </>
  );
}
