import { useState, useMemo } from 'react';
import { useSearchParams } from 'react-router';
import {
  Container,
  Title,
  Text,
  Stack,
  Group,
  Badge,
  Button,
  Center,
  Table,
  Select,
  TextInput,
  Skeleton,
  Collapse,
} from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import {
  IconHistory,
  IconX,
  IconSearch,
  IconChevronDown,
  IconChevronRight,
  IconAlertTriangle,
} from '@tabler/icons-react';
import type { OperationLog, OperationLogLevel, NodeType } from '@wakehub/shared';
import { useLogsQuery } from '../../api/logs.api';
import { useNodes } from '../../api/nodes.api';
import { NodeTypeIcon } from '../../components/shared/node-type-icon';

const PAGE_SIZE = 50;

const levelColorMap: Record<OperationLogLevel, string> = {
  info: 'blue',
  warn: 'yellow',
  error: 'red',
};

const levelLabels: Record<OperationLogLevel, string> = {
  info: 'Info',
  warn: 'Warn',
  error: 'Error',
};

const eventTypeColorMap: Record<string, string> = {
  start: 'green',
  stop: 'gray',
  'auto-shutdown': 'orange',
  error: 'red',
  decision: 'blue',
  'connection-test': 'cyan',
  register: 'violet',
  login: 'violet',
  logout: 'violet',
  'password-reset': 'violet',
};

const levelFilterOptions = [
  { value: '', label: 'Tous les niveaux' },
  { value: 'info', label: 'Info' },
  { value: 'warn', label: 'Warn' },
  { value: 'error', label: 'Error' },
];

const eventTypeFilterOptions = [
  { value: '', label: "Tous les types" },
  { value: 'start', label: 'start' },
  { value: 'stop', label: 'stop' },
  { value: 'auto-shutdown', label: 'auto-shutdown' },
  { value: 'error', label: 'error' },
  { value: 'decision', label: 'decision' },
  { value: 'connection-test', label: 'connection-test' },
  { value: 'register', label: 'register' },
  { value: 'login', label: 'login' },
  { value: 'logout', label: 'logout' },
  { value: 'password-reset', label: 'password-reset' },
];

function formatTimestamp(iso: string): string {
  return new Date(iso).toLocaleString('fr-FR', {
    dateStyle: 'short',
    timeStyle: 'medium',
  });
}

export function LogsPage() {
  const [searchParams] = useSearchParams();
  const initialNodeId = searchParams.get('nodeId') ?? '';

  const [levelFilter, setLevelFilter] = useState<string | null>(null);
  const [eventTypeFilter, setEventTypeFilter] = useState<string | null>(null);
  const [nodeFilter, setNodeFilter] = useState<string | null>(initialNodeId || null);
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(0);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  const isDesktop = useMediaQuery('(min-width: 992px)');
  const isMobile = useMediaQuery('(max-width: 767px)');

  const filters = useMemo(() => ({
    limit: PAGE_SIZE,
    offset: page * PAGE_SIZE,
    ...(levelFilter ? { level: levelFilter } : {}),
    ...(eventTypeFilter ? { eventType: eventTypeFilter } : {}),
    ...(nodeFilter ? { nodeId: nodeFilter } : {}),
    ...(searchQuery ? { search: searchQuery } : {}),
    ...(dateFrom ? { dateFrom: new Date(dateFrom).toISOString() } : {}),
    ...(dateTo ? { dateTo: new Date(dateTo + 'T23:59:59').toISOString() } : {}),
  }), [levelFilter, eventTypeFilter, nodeFilter, searchQuery, dateFrom, dateTo, page]);

  const { data, isLoading, isError } = useLogsQuery(filters);
  const { data: nodesData } = useNodes();

  const logs = data?.data.logs ?? [];
  const total = data?.data.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // Build node filter options from all nodes (not just current page)
  const nodeOptions = useMemo(() => {
    const nodes = nodesData?.data.nodes ?? [];
    return [
      { value: '', label: 'Tous les noeuds' },
      ...nodes.map((n) => ({ value: n.id, label: n.name })),
    ];
  }, [nodesData]);

  // Build nodeId → nodeType map for icons
  const nodeTypeMap = useMemo(() => {
    const nodes = nodesData?.data.nodes ?? [];
    const map: Record<string, NodeType> = {};
    for (const n of nodes) map[n.id] = n.type as NodeType;
    return map;
  }, [nodesData]);

  const hasActiveFilters = !!levelFilter || !!eventTypeFilter || !!nodeFilter || !!searchQuery || !!dateFrom || !!dateTo;

  function resetFilters() {
    setLevelFilter(null);
    setEventTypeFilter(null);
    setNodeFilter(null);
    setSearchQuery('');
    setDateFrom('');
    setDateTo('');
    setPage(0);
  }

  function toggleRow(id: string) {
    setExpandedRow((prev) => (prev === id ? null : id));
  }

  return (
    <Container size="lg" py="xl">
      <Stack gap="md">
        <Group justify="space-between">
          <Title order={1}>Logs</Title>
          <Text size="sm" c="dimmed">
            {total} événement{total !== 1 ? 's' : ''}
          </Text>
        </Group>

        {/* Skeleton loaders */}
        {isLoading && (
          <Table>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Horodatage</Table.Th>
                <Table.Th>Niveau</Table.Th>
                <Table.Th>Message</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {Array.from({ length: 5 }).map((_, i) => (
                <Table.Tr key={i}>
                  <Table.Td><Skeleton height={16} width="70%" /></Table.Td>
                  <Table.Td><Skeleton height={22} width={60} radius="xl" /></Table.Td>
                  <Table.Td><Skeleton height={16} width="80%" /></Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        )}

        {/* Error state */}
        {!isLoading && isError && (
          <Center py="xl">
            <Stack align="center" gap="sm">
              <IconAlertTriangle size={48} color="var(--mantine-color-red-6)" />
              <Text c="red" ta="center" fw={500}>
                Erreur lors du chargement des logs
              </Text>
              <Text c="dimmed" ta="center" size="sm">
                Vérifiez la connexion au serveur et réessayez.
              </Text>
            </Stack>
          </Center>
        )}

        {/* Empty state */}
        {!isLoading && !isError && total === 0 && !hasActiveFilters && (
          <Center py="xl">
            <Stack align="center" gap="sm">
              <IconHistory size={48} color="gray" />
              <Text c="dimmed" ta="center" fw={500}>
                Aucun événement enregistré
              </Text>
              <Text c="dimmed" ta="center" size="sm">
                Les événements apparaîtront ici au fur et à mesure de l'utilisation.
              </Text>
            </Stack>
          </Center>
        )}

        {/* Filters + Table */}
        {!isLoading && !isError && (total > 0 || hasActiveFilters) && (
          <>
            {/* Filter bar */}
            <Group gap="sm" wrap="wrap">
              <TextInput
                placeholder="Rechercher..."
                leftSection={<IconSearch size={16} />}
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.currentTarget.value); setPage(0); }}
                aria-label="Rechercher dans les logs"
                w={200}
              />
              <Select
                placeholder="Tous les niveaux"
                data={levelFilterOptions}
                value={levelFilter}
                onChange={(val) => { setLevelFilter(val); setPage(0); }}
                clearable
                aria-label="Filtrer par niveau"
                w={160}
              />
              <Select
                placeholder="Tous les types"
                data={eventTypeFilterOptions}
                value={eventTypeFilter}
                onChange={(val) => { setEventTypeFilter(val); setPage(0); }}
                clearable
                aria-label="Filtrer par type d'événement"
                w={180}
              />
              <Select
                placeholder="Tous les noeuds"
                data={nodeOptions}
                value={nodeFilter}
                onChange={(val) => { setNodeFilter(val); setPage(0); }}
                clearable
                aria-label="Filtrer par noeud"
                w={180}
              />
              <TextInput
                type="date"
                value={dateFrom}
                onChange={(e) => { setDateFrom(e.currentTarget.value); setPage(0); }}
                aria-label="Date de début"
                placeholder="Du"
                w={150}
              />
              <TextInput
                type="date"
                value={dateTo}
                onChange={(e) => { setDateTo(e.currentTarget.value); setPage(0); }}
                aria-label="Date de fin"
                placeholder="Au"
                w={150}
              />
              {hasActiveFilters && (
                <Button
                  variant="subtle"
                  size="sm"
                  leftSection={<IconX size={14} />}
                  onClick={resetFilters}
                >
                  Réinitialiser
                </Button>
              )}
            </Group>

            {/* No results with filters */}
            {total === 0 && hasActiveFilters && (
              <Center py="xl">
                <Text c="dimmed">Aucun résultat pour ces filtres.</Text>
              </Center>
            )}

            {/* Mobile view */}
            {total > 0 && isMobile && (
              <Stack gap="xs">
                {logs.map((log) => (
                  <div key={log.id}>
                    <Group
                      p="sm"
                      gap="sm"
                      style={{
                        border: '1px solid var(--mantine-color-dark-4)',
                        borderRadius: 'var(--mantine-radius-sm)',
                        cursor: 'pointer',
                        ...(log.level === 'error' ? { backgroundColor: 'var(--mantine-color-red-light)' } : {}),
                      }}
                      onClick={() => toggleRow(log.id)}
                    >
                      <Text size="xs" ff="JetBrains Mono" c="dimmed" style={{ whiteSpace: 'nowrap' }}>
                        {formatTimestamp(log.timestamp)}
                      </Text>
                      <Badge size="sm" color={levelColorMap[log.level]}>
                        {levelLabels[log.level]}
                      </Badge>
                      <Text size="sm" style={{ flex: 1 }} lineClamp={1}>
                        {log.message}
                      </Text>
                      {expandedRow === log.id
                        ? <IconChevronDown size={16} />
                        : <IconChevronRight size={16} />
                      }
                    </Group>
                    <Collapse in={expandedRow === log.id}>
                      <Stack gap="xs" p="sm" style={{ borderLeft: '2px solid var(--mantine-color-dark-4)' }}>
                        {log.nodeName && (
                          <Text size="sm"><Text span fw={500}>Noeud :</Text> {log.nodeName}</Text>
                        )}
                        {log.eventType && (
                          <Group gap="xs">
                            <Text size="sm" fw={500}>Type :</Text>
                            <Badge size="sm" color={eventTypeColorMap[log.eventType] ?? 'gray'}>
                              {log.eventType}
                            </Badge>
                          </Group>
                        )}
                        {log.reason && (
                          <Text size="sm"><Text span fw={500}>Raison :</Text> {log.reason}</Text>
                        )}
                        {log.errorCode && (
                          <Text size="sm" c="red"><Text span fw={500}>Code erreur :</Text> {log.errorCode}</Text>
                        )}
                        {log.errorDetails && (
                          <Text size="xs" c="dimmed" style={{ whiteSpace: 'pre-wrap' }}>
                            {JSON.stringify(log.errorDetails, null, 2)}
                          </Text>
                        )}
                      </Stack>
                    </Collapse>
                  </div>
                ))}
              </Stack>
            )}

            {/* Desktop / Tablet table */}
            {total > 0 && !isMobile && (
              <Table highlightOnHover>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Horodatage</Table.Th>
                    <Table.Th>Noeud</Table.Th>
                    <Table.Th>Type</Table.Th>
                    <Table.Th>Niveau</Table.Th>
                    <Table.Th>Message</Table.Th>
                    {isDesktop && <Table.Th>Raison</Table.Th>}
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {logs.map((log) => (
                    <LogRow
                      key={log.id}
                      log={log}
                      isDesktop={!!isDesktop}
                      expanded={expandedRow === log.id}
                      onToggle={() => toggleRow(log.id)}
                      nodeTypeMap={nodeTypeMap}
                    />
                  ))}
                </Table.Tbody>
              </Table>
            )}

            {/* Pagination */}
            {total > 0 && (
              <Group justify="center" gap="md">
                <Button
                  variant="default"
                  size="sm"
                  disabled={page === 0}
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                >
                  Précédent
                </Button>
                <Text size="sm">
                  Page {page + 1} de {totalPages}
                </Text>
                <Button
                  variant="default"
                  size="sm"
                  disabled={page + 1 >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Suivant
                </Button>
              </Group>
            )}
          </>
        )}
      </Stack>
    </Container>
  );
}

interface LogRowProps {
  log: OperationLog;
  isDesktop: boolean;
  expanded: boolean;
  onToggle: () => void;
  nodeTypeMap: Record<string, NodeType>;
}

function LogRow({ log, isDesktop, expanded, onToggle, nodeTypeMap }: LogRowProps) {
  const isError = log.level === 'error';
  const hasErrorDetails = !!(log.errorCode || log.errorDetails);
  const rowStyle = isError ? { backgroundColor: 'var(--mantine-color-red-light)' } : undefined;

  return (
    <>
      <Table.Tr
        style={{ ...rowStyle, cursor: hasErrorDetails ? 'pointer' : undefined }}
        onClick={hasErrorDetails ? onToggle : undefined}
      >
        <Table.Td>
          <Text size="sm" ff="JetBrains Mono" style={{ whiteSpace: 'nowrap' }}>
            {formatTimestamp(log.timestamp)}
          </Text>
        </Table.Td>
        <Table.Td>
          {log.nodeName ? (
            <Group gap={6} wrap="nowrap">
              {log.nodeId && nodeTypeMap[log.nodeId] != null && (
                <NodeTypeIcon type={nodeTypeMap[log.nodeId]!} size={16} />
              )}
              <Text size="sm">{log.nodeName}</Text>
            </Group>
          ) : (
            <Text size="sm">—</Text>
          )}
        </Table.Td>
        <Table.Td>
          {log.eventType ? (
            <Badge size="sm" color={eventTypeColorMap[log.eventType] ?? 'gray'}>
              {log.eventType}
            </Badge>
          ) : (
            <Text size="sm" c="dimmed">—</Text>
          )}
        </Table.Td>
        <Table.Td>
          <Badge size="sm" color={levelColorMap[log.level]}>
            {levelLabels[log.level]}
          </Badge>
        </Table.Td>
        <Table.Td>
          <Text size="sm" lineClamp={1}>{log.message}</Text>
        </Table.Td>
        {isDesktop && (
          <Table.Td>
            <Text size="sm" c="dimmed">{log.reason ?? '—'}</Text>
          </Table.Td>
        )}
      </Table.Tr>
      {expanded && hasErrorDetails && (
        <Table.Tr style={rowStyle}>
          <Table.Td colSpan={isDesktop ? 6 : 5}>
            <Stack gap="xs" p="xs">
              {log.errorCode && (
                <Text size="sm" c="red"><Text span fw={500}>Code erreur :</Text> {log.errorCode}</Text>
              )}
              {log.errorDetails && (
                <Text size="xs" c="dimmed" style={{ whiteSpace: 'pre-wrap' }}>
                  {JSON.stringify(log.errorDetails, null, 2)}
                </Text>
              )}
            </Stack>
          </Table.Td>
        </Table.Tr>
      )}
    </>
  );
}
