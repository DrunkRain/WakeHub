import { Table, Badge, Text, Paper, Group, Stack, UnstyledButton, ActionIcon } from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import { useNavigate } from 'react-router';
import {
  IconArrowsSort,
  IconSortAscending,
  IconSortDescending,
  IconPin,
  IconPinnedOff,
} from '@tabler/icons-react';
import type { Service } from '@wakehub/shared';
import { useUpdateService } from '../../api/services.api';
import {
  SERVICE_TYPE_ICON,
  SERVICE_TYPE_LABEL,
  STATUS_COLORS,
  STATUS_LABEL,
  formatRelativeTime,
  type SortField,
  type SortDirection,
} from './use-services-table';

interface ServicesTableProps {
  services: Service[];
  sortField: SortField;
  sortDirection: SortDirection;
  onSort: (field: SortField) => void;
}

function SortIcon({ field, sortField, sortDirection }: { field: SortField; sortField: SortField; sortDirection: SortDirection }) {
  if (field !== sortField) return <IconArrowsSort size={14} />;
  return sortDirection === 'asc' ? <IconSortAscending size={14} /> : <IconSortDescending size={14} />;
}

function SortableHeader({
  field,
  label,
  sortField,
  sortDirection,
  onSort,
}: {
  field: SortField;
  label: string;
  sortField: SortField;
  sortDirection: SortDirection;
  onSort: (field: SortField) => void;
}) {
  return (
    <Table.Th>
      <UnstyledButton onClick={() => onSort(field)}>
        <Group gap={4} wrap="nowrap">
          <Text fw={600} size="sm">{label}</Text>
          <SortIcon field={field} sortField={sortField} sortDirection={sortDirection} />
        </Group>
      </UnstyledButton>
    </Table.Th>
  );
}

function StatusBadge({ status }: { status: Service['status'] }) {
  return (
    <Badge color={STATUS_COLORS[status]} variant="light">
      {STATUS_LABEL[status]}
    </Badge>
  );
}

function ServiceIcon({ type }: { type: Service['type'] }) {
  const Icon = SERVICE_TYPE_ICON[type];
  return <Icon size={18} />;
}

// --- Mobile card view ---

function ServiceCard({ service, onClick }: { service: Service; onClick: () => void }) {
  return (
    <Paper p="sm" withBorder style={{ cursor: 'pointer' }} onClick={onClick}>
      <Group justify="space-between" wrap="nowrap">
        <Group gap="sm" wrap="nowrap">
          <ServiceIcon type={service.type} />
          <Text fw={500} size="sm" truncate>
            {service.name}
          </Text>
        </Group>
        <StatusBadge status={service.status} />
      </Group>
    </Paper>
  );
}

// --- Main component ---

export function ServicesTable({ services, sortField, sortDirection, onSort }: ServicesTableProps) {
  const navigate = useNavigate();
  const updateService = useUpdateService();
  const isTablet = useMediaQuery('(max-width: 991px)');
  const isMobile = useMediaQuery('(max-width: 767px)');

  if (isMobile) {
    return (
      <Stack gap="xs">
        {services.map((service) => (
          <ServiceCard key={service.id} service={service} onClick={() => navigate(`/services/${service.id}`)} />
        ))}
      </Stack>
    );
  }

  return (
    <Table striped highlightOnHover>
      <Table.Thead>
        <Table.Tr>
          <Table.Th style={{ width: 40 }} />
          <Table.Th style={{ width: 40 }} />
          <SortableHeader field="name" label="Nom" sortField={sortField} sortDirection={sortDirection} onSort={onSort} />
          <SortableHeader field="status" label="Statut" sortField={sortField} sortDirection={sortDirection} onSort={onSort} />
          <SortableHeader field="type" label="Plateforme" sortField={sortField} sortDirection={sortDirection} onSort={onSort} />
          {!isTablet && (
            <>
              <SortableHeader field="ipAddress" label="IP" sortField={sortField} sortDirection={sortDirection} onSort={onSort} />
              <SortableHeader field="updatedAt" label="Dernière activité" sortField={sortField} sortDirection={sortDirection} onSort={onSort} />
            </>
          )}
        </Table.Tr>
      </Table.Thead>
      <Table.Tbody>
        {services.map((service) => (
          <Table.Tr key={service.id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/services/${service.id}`)}>
            <Table.Td>
              <ServiceIcon type={service.type} />
            </Table.Td>
            <Table.Td>
              <ActionIcon
                variant="subtle"
                color={service.pinnedToDashboard ? 'blue' : 'gray'}
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  updateService.mutate({ id: service.id, pinnedToDashboard: !service.pinnedToDashboard });
                }}
                aria-label={service.pinnedToDashboard ? 'Désépingler du dashboard' : 'Épingler au dashboard'}
              >
                {service.pinnedToDashboard ? <IconPinnedOff size={14} /> : <IconPin size={14} />}
              </ActionIcon>
            </Table.Td>
            <Table.Td>
              <Text fw={500} size="sm">{service.name}</Text>
            </Table.Td>
            <Table.Td>
              <StatusBadge status={service.status} />
            </Table.Td>
            <Table.Td>
              <Text size="sm">{SERVICE_TYPE_LABEL[service.type]}</Text>
            </Table.Td>
            {!isTablet && (
              <>
                <Table.Td>
                  <Text size="sm" ff="monospace">{service.ipAddress ?? '-'}</Text>
                </Table.Td>
                <Table.Td>
                  <Text size="sm" c="dimmed">{formatRelativeTime(service.updatedAt)}</Text>
                </Table.Td>
              </>
            )}
          </Table.Tr>
        ))}
      </Table.Tbody>
    </Table>
  );
}
