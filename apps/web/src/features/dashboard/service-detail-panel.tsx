import { useState } from 'react';
import {
  Drawer,
  Modal,
  Stack,
  Group,
  Title,
  Badge,
  Button,
  ActionIcon,
  Tabs,
  Table,
  Text,
} from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import {
  IconX,
  IconPlayerPlay,
  IconExternalLink,
  IconRefresh,
  IconPlayerStop,
} from '@tabler/icons-react';
import type { Service, CascadeRecord } from '@wakehub/shared';
import { useServices } from '../../api/services.api';
import { useActiveCascades, useCascadeHistory } from '../../api/cascades.api';
import { useDependencyChain } from '../../api/dependencies.api';
import { deriveVisualStatus, statusConfig } from './service-tile';
import type { VisualStatus } from './service-tile';
import classes from './service-detail-panel.module.css';

export interface ServiceDetailPanelProps {
  serviceId: string | null;
  onClose: () => void;
  onStart: (serviceId: string) => void;
  onStop: (serviceId: string) => void;
}

const nodeTypeLabel: Record<string, string> = {
  service: 'Service',
};

const cascadeTypeLabel: Record<string, string> = {
  start: 'Demarrage',
  stop: 'Arret',
};

const cascadeStatusConfig: Record<string, { label: string; color: string }> = {
  pending: { label: 'En attente', color: 'gray' },
  in_progress: { label: 'En cours', color: 'yellow' },
  completed: { label: 'Reussi', color: 'green' },
  failed: { label: 'Echoue', color: 'red' },
};

function formatTimestamp(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function ServiceDetailPanel({
  serviceId,
  onClose,
  onStart,
  onStop,
}: ServiceDetailPanelProps) {
  const [confirmStopOpen, setConfirmStopOpen] = useState(false);
  const isMobile = useMediaQuery('(max-width: 768px)');
  const { data: servicesData } = useServices();
  const { data: cascadesData } = useActiveCascades();
  const { data: chainData } = useDependencyChain('service', serviceId ?? '');
  const { data: historyData } = useCascadeHistory(serviceId);

  const services = servicesData?.data ?? [];
  const service = services.find((s) => s.id === serviceId) ?? null;

  const activeCascades = cascadesData?.data ?? [];
  const activeCascade = activeCascades.find(
    (c) => c.serviceId === serviceId,
  ) ?? null;

  const upstream = chainData?.data?.upstream ?? [];
  const downstream = chainData?.data?.downstream ?? [];
  const history = historyData?.data ?? [];

  const handleConfirmStop = () => {
    if (service) {
      onStop(service.id);
      setConfirmStopOpen(false);
    }
  };

  if (!service) {
    return (
      <Drawer
        opened={!!serviceId}
        onClose={onClose}
        position="right"
        size={isMobile ? '100%' : 380}
        withCloseButton={false}
        aria-label="Detail du service"
      >
        <Text c="dimmed" ta="center" py="xl">
          Service introuvable.
        </Text>
      </Drawer>
    );
  }

  const visualStatus = deriveVisualStatus(service, activeCascade);
  const config = statusConfig[visualStatus];

  return (
    <>
    <Drawer
      opened={!!serviceId}
      onClose={onClose}
      position="right"
      size={isMobile ? '100%' : 380}
      withCloseButton={false}
      aria-label={`Detail du service ${service.name}`}
    >
      <Stack h="100%" justify="space-between" className={classes.panelStack}>
        {/* Header */}
        <Group justify="space-between" align="flex-start">
          <div>
            <Title order={4}>{service.name}</Title>
            <Badge color={config.color} variant="light" size="sm" mt={4}>
              {config.label}
            </Badge>
          </div>
          <ActionIcon
            variant="subtle"
            onClick={onClose}
            aria-label="Fermer"
          >
            <IconX size={18} />
          </ActionIcon>
        </Group>

        {/* Tabs */}
        <Tabs defaultValue="dependencies" className={classes.tabs}>
          <Tabs.List>
            <Tabs.Tab value="dependencies">Dependances</Tabs.Tab>
            <Tabs.Tab value="activity">Activite</Tabs.Tab>
          </Tabs.List>

          <Tabs.Panel value="dependencies" pt="md">
            <DependenciesTab upstream={upstream} />
          </Tabs.Panel>

          <Tabs.Panel value="activity" pt="md">
            <ActivityTab history={history} />
          </Tabs.Panel>
        </Tabs>

        {/* Actions */}
        <ActionsZone
          service={service}
          visualStatus={visualStatus}
          onStart={onStart}
          onStopClick={() => setConfirmStopOpen(true)}
        />
      </Stack>
    </Drawer>

    {service && (
      <Modal
        opened={confirmStopOpen}
        onClose={() => setConfirmStopOpen(false)}
        title={`Arrêter ${service.name} et ses dépendances ?`}
        centered
      >
        {downstream.length > 0 ? (
          <Stack gap="xs">
            <Text size="sm">Les services suivants seront aussi arrêtés :</Text>
            {downstream.map((dep) => (
              <Group key={dep.nodeId} justify="space-between" p="xs">
                <Text size="sm">{dep.name}</Text>
                <Badge
                  color={dep.status === 'online' || dep.status === 'running' ? 'green' : 'gray'}
                  variant="light"
                  size="sm"
                >
                  {dep.status}
                </Badge>
              </Group>
            ))}
          </Stack>
        ) : (
          <Text size="sm" c="dimmed">Aucune dépendance ne sera affectée.</Text>
        )}

        <Group justify="flex-end" mt="lg">
          <Button variant="default" onClick={() => setConfirmStopOpen(false)}>
            Annuler
          </Button>
          <Button color="red" onClick={handleConfirmStop}>
            Arrêter
          </Button>
        </Group>
      </Modal>
    )}
    </>
  );
}

function DependenciesTab({
  upstream,
}: {
  upstream: Array<{ nodeType: string; nodeId: string; name: string; status: string }>;
}) {
  if (upstream.length === 0) {
    return (
      <Text c="dimmed" size="sm" ta="center" py="lg">
        Aucune dependance
      </Text>
    );
  }

  const statusColor: Record<string, string> = {
    online: 'green',
    running: 'green',
    offline: 'gray',
    stopped: 'gray',
    paused: 'yellow',
    unknown: 'gray',
    error: 'red',
  };

  return (
    <Stack gap="xs">
      {upstream.map((node) => (
        <Group key={node.nodeId} justify="space-between" p="xs" className={classes.depItem}>
          <div>
            <Text size="sm" fw={500}>
              {node.name}
            </Text>
            <Text size="xs" c="dimmed">
              {nodeTypeLabel[node.nodeType] ?? node.nodeType}
            </Text>
          </div>
          <Badge
            color={statusColor[node.status] ?? 'gray'}
            variant="light"
            size="sm"
          >
            {node.status}
          </Badge>
        </Group>
      ))}
    </Stack>
  );
}

function ActivityTab({ history }: { history: CascadeRecord[] }) {
  if (history.length === 0) {
    return (
      <Text c="dimmed" size="sm" ta="center" py="lg">
        Aucune activite recente
      </Text>
    );
  }

  return (
    <Table highlightOnHover>
      <Table.Thead>
        <Table.Tr>
          <Table.Th>Horodatage</Table.Th>
          <Table.Th>Type</Table.Th>
          <Table.Th>Resultat</Table.Th>
        </Table.Tr>
      </Table.Thead>
      <Table.Tbody>
        {history.map((cascade) => {
          const statusConf = cascadeStatusConfig[cascade.status] ?? {
            label: cascade.status,
            color: 'gray',
          };
          const errorSuffix =
            cascade.status === 'failed' && cascade.errorCode
              ? ` — ${cascade.errorCode}`
              : '';

          return (
            <Table.Tr key={cascade.id}>
              <Table.Td>
                <Text size="sm">{formatTimestamp(cascade.startedAt)}</Text>
              </Table.Td>
              <Table.Td>
                <Text size="sm">
                  {cascadeTypeLabel[cascade.type] ?? cascade.type}
                </Text>
              </Table.Td>
              <Table.Td>
                <Badge color={statusConf.color} variant="light" size="sm">
                  {statusConf.label}{errorSuffix}
                </Badge>
              </Table.Td>
            </Table.Tr>
          );
        })}
      </Table.Tbody>
    </Table>
  );
}

function ActionsZone({
  service,
  visualStatus,
  onStart,
  onStopClick,
}: {
  service: Service;
  visualStatus: VisualStatus;
  onStart: (serviceId: string) => void;
  onStopClick: () => void;
}) {
  const isLoading = visualStatus === 'starting' || visualStatus === 'stopping';

  return (
    <Group className={classes.actions} gap="sm">
      {visualStatus === 'stopped' && (
        <Button
          color="blue"
          leftSection={<IconPlayerPlay size={16} />}
          onClick={() => onStart(service.id)}
          aria-label={`Demarrer ${service.name}`}
        >
          Demarrer
        </Button>
      )}

      {visualStatus === 'running' && service.serviceUrl && (
        <Button
          color="blue"
          variant="light"
          leftSection={<IconExternalLink size={16} />}
          component="a"
          href={service.serviceUrl}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Ouvrir ${service.name}`}
        >
          Ouvrir
        </Button>
      )}

      {visualStatus === 'running' && (
        <Button
          color="orange"
          variant="light"
          leftSection={<IconPlayerStop size={16} />}
          onClick={onStopClick}
          aria-label={`Arreter ${service.name}`}
        >
          Arreter
        </Button>
      )}

      {visualStatus === 'error' && (
        <Button
          color="orange"
          leftSection={<IconRefresh size={16} />}
          onClick={() => onStart(service.id)}
          aria-label={`Reessayer ${service.name}`}
        >
          Reessayer
        </Button>
      )}

      {isLoading && (
        <Button
          color={visualStatus === 'starting' ? 'yellow' : 'orange'}
          variant="light"
          loading
          disabled
        >
          {visualStatus === 'starting' ? 'En demarrage...' : 'En arret...'}
        </Button>
      )}
    </Group>
  );
}
