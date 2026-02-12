import { Stack, Text, Button, Center } from '@mantine/core';
import type { TablerIcon } from '@tabler/icons-react';

interface EmptyStateProps {
  icon: TablerIcon;
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <Center h="60vh">
      <Stack align="center" gap="md" maw={400}>
        <Icon size={48} stroke={1.5} color="var(--mantine-color-dark-3)" />
        <Text size="lg" fw={600} ta="center">
          {title}
        </Text>
        <Text c="dimmed" ta="center">
          {description}
        </Text>
        {action && (
          <Button onClick={action.onClick} mt="sm">
            {action.label}
          </Button>
        )}
      </Stack>
    </Center>
  );
}
