import { useState, useMemo } from 'react';
import { Link } from 'react-router';
import {
  Container,
  Title,
  Text,
  Stack,
  Group,
  Button,
  Center,
  Anchor,
  Table,
  Select,
  Skeleton,
} from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import { IconServer, IconPlus, IconX } from '@tabler/icons-react';
import type { NodeStatus, NodeType } from '@wakehub/shared';
import { useNodes } from '../../api/nodes.api';
import { AddMachineWizard } from './add-machine-wizard';
import { StatusBadge } from '../../components/shared/status-badge';
import { NodeTypeIcon } from '../../components/shared/node-type-icon';

const typeLabels: Record<NodeType, string> = {
  physical: 'Machine',
  vm: 'VM',
  lxc: 'LXC',
  container: 'Conteneur',
};

function formatRelativeDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffH = Math.floor(diffMs / 3600000);
  const diffD = Math.floor(diffMs / 86400000);

  if (diffMin < 1) return "A l'instant";
  if (diffMin < 60) return `Il y a ${diffMin} min`;
  if (diffH < 24) return `Il y a ${diffH}h`;
  if (diffD < 7) return `Il y a ${diffD}j`;
  return date.toLocaleDateString('fr-FR');
}

const statusFilterOptions = [
  { value: '', label: 'Tous les statuts' },
  { value: 'online', label: 'Actif' },
  { value: 'offline', label: 'Eteint' },
  { value: 'error', label: 'Erreur' },
];

const typeFilterOptions = [
  { value: '', label: 'Tous les types' },
  { value: 'physical', label: 'Machine' },
  { value: 'vm', label: 'VM' },
  { value: 'lxc', label: 'LXC' },
  { value: 'container', label: 'Conteneur' },
];

export function NodesPage() {
  const [wizardOpened, setWizardOpened] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<string | null>(null);
  const { data, isLoading } = useNodes();

  const isDesktop = useMediaQuery('(min-width: 992px)');
  const isMobile = useMediaQuery('(max-width: 767px)');

  const nodes = data?.data.nodes ?? [];

  const filteredNodes = useMemo(() => {
    let result = nodes;
    if (statusFilter) result = result.filter((n) => n.status === statusFilter);
    if (typeFilter) result = result.filter((n) => n.type === typeFilter);
    return result;
  }, [nodes, statusFilter, typeFilter]);

  const hasActiveFilters = !!statusFilter || !!typeFilter;

  function resetFilters() {
    setStatusFilter(null);
    setTypeFilter(null);
  }

  return (
    <Container size="lg" py="xl">
      <Stack gap="md">
        <Group justify="space-between">
          <Title order={1}>Noeuds</Title>
          <Button
            leftSection={<IconPlus size={18} />}
            onClick={() => setWizardOpened(true)}
            aria-label="Ajouter une machine"
          >
            Ajouter
          </Button>
        </Group>

        {/* Skeleton loaders */}
        {isLoading && (
          <Table highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th></Table.Th>
                <Table.Th>Nom</Table.Th>
                <Table.Th>Type</Table.Th>
                <Table.Th>Statut</Table.Th>
                {isDesktop && <Table.Th>IP</Table.Th>}
                {isDesktop && <Table.Th>Mis a jour</Table.Th>}
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {Array.from({ length: 5 }).map((_, i) => (
                <Table.Tr key={i}>
                  <Table.Td><Skeleton height={20} width={20} radius="sm" /></Table.Td>
                  <Table.Td><Skeleton height={16} width="60%" /></Table.Td>
                  <Table.Td><Skeleton height={16} width="40%" /></Table.Td>
                  <Table.Td><Skeleton height={22} width={60} radius="xl" /></Table.Td>
                  {isDesktop && <Table.Td><Skeleton height={16} width="50%" /></Table.Td>}
                  {isDesktop && <Table.Td><Skeleton height={16} width="40%" /></Table.Td>}
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        )}

        {/* Empty state */}
        {!isLoading && nodes.length === 0 && (
          <Center py="xl">
            <Stack align="center" gap="sm">
              <IconServer size={48} color="gray" />
              <Text c="dimmed" ta="center">
                Aucun noeud configuré. Ajoutez votre première machine pour commencer.
              </Text>
              <Button
                variant="light"
                leftSection={<IconPlus size={16} />}
                onClick={() => setWizardOpened(true)}
              >
                Ajouter une machine
              </Button>
            </Stack>
          </Center>
        )}

        {/* Filters + Table */}
        {!isLoading && nodes.length > 0 && (
          <>
            {/* Filter bar */}
            <Group gap="sm">
              <Select
                placeholder="Tous les statuts"
                data={statusFilterOptions}
                value={statusFilter}
                onChange={setStatusFilter}
                clearable
                aria-label="Filtrer par statut"
                w={180}
              />
              <Select
                placeholder="Tous les types"
                data={typeFilterOptions}
                value={typeFilter}
                onChange={setTypeFilter}
                clearable
                aria-label="Filtrer par type"
                w={180}
              />
              {hasActiveFilters && (
                <Button
                  variant="subtle"
                  size="sm"
                  leftSection={<IconX size={14} />}
                  onClick={resetFilters}
                >
                  Reinitialiser
                </Button>
              )}
              <Text size="sm" c="dimmed">
                {filteredNodes.length} noeud{filteredNodes.length !== 1 ? 's' : ''}
              </Text>
            </Group>

            {/* Mobile list view */}
            {isMobile ? (
              <Stack gap="xs">
                {filteredNodes.map((node) => (
                  <Group key={node.id} p="sm" style={{ border: '1px solid var(--mantine-color-dark-4)', borderRadius: 'var(--mantine-radius-sm)' }}>
                    <NodeTypeIcon type={node.type as NodeType} />
                    <Anchor component={Link} to={`/nodes/${node.id}`} fw={500} style={{ flex: 1 }}>
                      {node.name}
                    </Anchor>
                    <StatusBadge status={node.status as NodeStatus} />
                  </Group>
                ))}
              </Stack>
            ) : (
              /* Desktop / Tablet table view */
              <Table highlightOnHover>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th></Table.Th>
                    <Table.Th>Nom</Table.Th>
                    <Table.Th>Type</Table.Th>
                    <Table.Th>Statut</Table.Th>
                    {isDesktop && <Table.Th>IP</Table.Th>}
                    {isDesktop && <Table.Th>Mis a jour</Table.Th>}
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {filteredNodes.map((node) => (
                    <Table.Tr key={node.id}>
                      <Table.Td><NodeTypeIcon type={node.type as NodeType} /></Table.Td>
                      <Table.Td>
                        <Anchor component={Link} to={`/nodes/${node.id}`} fw={500}>
                          {node.name}
                        </Anchor>
                      </Table.Td>
                      <Table.Td>{typeLabels[node.type as NodeType]}</Table.Td>
                      <Table.Td><StatusBadge status={node.status as NodeStatus} /></Table.Td>
                      {isDesktop && <Table.Td>{node.ipAddress ?? '—'}</Table.Td>}
                      {isDesktop && <Table.Td>{formatRelativeDate(node.updatedAt)}</Table.Td>}
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            )}
          </>
        )}
      </Stack>

      <AddMachineWizard
        opened={wizardOpened}
        onClose={() => setWizardOpened(false)}
      />
    </Container>
  );
}
