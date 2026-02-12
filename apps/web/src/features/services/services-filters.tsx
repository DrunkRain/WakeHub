import { Group, Chip, Text } from '@mantine/core';
import type { ServiceStatus, ServiceType } from '@wakehub/shared';
import { STATUS_COLORS, STATUS_LABEL, SERVICE_TYPE_LABEL } from './use-services-table';

interface ServicesFiltersProps {
  statusFilters: ServiceStatus[];
  onStatusChange: (values: ServiceStatus[]) => void;
  typeFilters: ServiceType[];
  onTypeChange: (values: ServiceType[]) => void;
}

const STATUS_OPTIONS: ServiceStatus[] = ['online', 'offline', 'running', 'stopped', 'error'];
const TYPE_OPTIONS: ServiceType[] = ['physical', 'proxmox', 'docker', 'vm', 'container'];

export function ServicesFilters({
  statusFilters,
  onStatusChange,
  typeFilters,
  onTypeChange,
}: ServicesFiltersProps) {
  return (
    <Group gap="lg" wrap="wrap">
      <Group gap="xs" wrap="wrap" align="center">
        <Text size="sm" fw={500} c="dimmed">
          Statut :
        </Text>
        <Chip.Group multiple value={statusFilters} onChange={onStatusChange as (v: string[]) => void}>
          <Group gap={6} wrap="wrap">
            {STATUS_OPTIONS.map((status) => (
              <Chip key={status} value={status} color={STATUS_COLORS[status]} variant="light" size="xs">
                {STATUS_LABEL[status]}
              </Chip>
            ))}
          </Group>
        </Chip.Group>
      </Group>

      <Group gap="xs" wrap="wrap" align="center">
        <Text size="sm" fw={500} c="dimmed">
          Plateforme :
        </Text>
        <Chip.Group multiple value={typeFilters} onChange={onTypeChange as (v: string[]) => void}>
          <Group gap={6} wrap="wrap">
            {TYPE_OPTIONS.map((type) => (
              <Chip key={type} value={type} variant="light" size="xs">
                {SERVICE_TYPE_LABEL[type]}
              </Chip>
            ))}
          </Group>
        </Chip.Group>
      </Group>
    </Group>
  );
}
