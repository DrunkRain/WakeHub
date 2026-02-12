import { useState, useMemo } from 'react';
import {
  Container,
  SimpleGrid,
  Stack,
  Title,
  Group,
  ActionIcon,
  Modal,
  Text,
  Paper,
  Badge,
  Button,
} from '@mantine/core';
import { IconPlus, IconPin } from '@tabler/icons-react';
import { EmptyState } from '../../components/shared/empty-state';
import { ServiceWizard } from '../services/service-wizard';
import { useServices, useUpdateService } from '../../api/services.api';
import { useActiveCascades, useStartCascade, useStopCascade } from '../../api/cascades.api';
import { useDependencyGraph } from '../../api/dependencies.api';
import { StatsBar } from './stats-bar';
import { ServiceTile } from './service-tile';
import { ServiceDetailPanel } from './service-detail-panel';

const STATUS_COLORS: Record<string, string> = {
  online: 'green',
  offline: 'gray',
  running: 'green',
  stopped: 'gray',
  paused: 'yellow',
  unknown: 'gray',
  error: 'red',
};

export function DashboardPage() {
  const [wizardOpened, setWizardOpened] = useState(false);
  const [pinModalOpened, setPinModalOpened] = useState(false);
  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(null);
  const { data: servicesData } = useServices();
  const { data: cascadesData } = useActiveCascades();
  const { data: graphData } = useDependencyGraph();
  const startCascade = useStartCascade();
  const stopCascade = useStopCascade();
  const updateService = useUpdateService();

  const allServices = servicesData?.data ?? [];
  const activeCascades = cascadesData?.data ?? [];

  // Pinned items
  const pinnedServices = useMemo(
    () => allServices.filter((s) => s.pinnedToDashboard),
    [allServices],
  );

  // Unpinned items for the modal
  const unpinnedServices = useMemo(
    () => allServices.filter((s) => !s.pinnedToDashboard),
    [allServices],
  );

  // Map of serviceId -> active cascade
  const cascadeByService = useMemo(() => {
    const map = new Map<string, (typeof activeCascades)[number]>();
    for (const c of activeCascades) {
      map.set(c.serviceId, c);
    }
    return map;
  }, [activeCascades]);

  // Compute dependency summary per service from graph data
  const dependencySummaries = useMemo(() => {
    const map = new Map<string, string>();
    if (!graphData?.data) return map;
    const { nodes, edges } = graphData.data;
    const nodeById = new Map(nodes.map((n) => [n.id, n]));
    for (const service of pinnedServices) {
      const upstreamNames = edges
        .filter((e) => e.target === `service:${service.id}`)
        .map((e) => nodeById.get(e.source)?.name)
        .filter(Boolean) as string[];
      if (upstreamNames.length > 0) {
        map.set(service.id, `Dépend de : ${upstreamNames.join(', ')}`);
      }
    }
    return map;
  }, [graphData, pinnedServices]);

  const hasPinned = pinnedServices.length > 0;

  const handleUnpin = (id: string) => {
    updateService.mutate({ id, pinnedToDashboard: false });
  };

  const handlePin = (id: string) => {
    updateService.mutate({ id, pinnedToDashboard: true });
  };

  // No services at all -> empty state
  if (allServices.length === 0) {
    return (
      <Container size="xl" py="xl">
        <ServiceWizard opened={wizardOpened} onClose={() => setWizardOpened(false)} />
        <EmptyState
          icon={IconPlus}
          title="Ajoutez votre premier service"
          description="Commencez par ajouter une machine physique, un serveur Proxmox ou un hôte Docker pour voir vos services ici."
          action={{
            label: 'Ajouter un service',
            onClick: () => setWizardOpened(true),
          }}
        />
      </Container>
    );
  }

  // Services exist but nothing pinned -> guide user
  if (!hasPinned) {
    return (
      <Container size="xl" py="xl">
        <ServiceWizard opened={wizardOpened} onClose={() => setWizardOpened(false)} />
        <StatsBar />
        <EmptyState
          icon={IconPin}
          title="Aucun élément épinglé"
          description="Épinglez des services pour les afficher sur le dashboard."
          action={{
            label: 'Épingler un élément',
            onClick: () => setPinModalOpened(true),
          }}
        />
        <PinModal
          opened={pinModalOpened}
          onClose={() => setPinModalOpened(false)}
          unpinnedServices={unpinnedServices}
          onPin={handlePin}
        />
      </Container>
    );
  }

  return (
    <Container size="xl" py="xl">
      <ServiceWizard opened={wizardOpened} onClose={() => setWizardOpened(false)} />
      <Stack gap="xl">
        <Group justify="space-between">
          <Title order={2}>Dashboard</Title>
          <ActionIcon
            variant="light"
            size="lg"
            onClick={() => setPinModalOpened(true)}
            aria-label="Épingler un élément"
          >
            <IconPlus size={18} />
          </ActionIcon>
        </Group>

        <StatsBar />

        <SimpleGrid cols={{ base: 1, sm: 2, md: selectedServiceId ? 2 : 3 }} spacing="lg">
          {pinnedServices.map((service) => (
            <ServiceTile
              key={service.id}
              service={service}
              activeCascade={cascadeByService.get(service.id)}
              dependencySummary={dependencySummaries.get(service.id)}
              onStart={(id) => startCascade.mutate(id)}
              isStarting={startCascade.isPending && startCascade.variables === service.id}
              onUnpin={handleUnpin}
              onTileClick={setSelectedServiceId}
            />
          ))}
        </SimpleGrid>
      </Stack>

      <ServiceDetailPanel
        serviceId={selectedServiceId}
        onClose={() => setSelectedServiceId(null)}
        onStart={(id) => startCascade.mutate(id)}
        onStop={(id) => stopCascade.mutate(id)}
      />

      <PinModal
        opened={pinModalOpened}
        onClose={() => setPinModalOpened(false)}
        unpinnedServices={unpinnedServices}
        onPin={handlePin}
      />
    </Container>
  );
}

// --- Pin Modal ---

interface PinModalProps {
  opened: boolean;
  onClose: () => void;
  unpinnedServices: Array<{ id: string; name: string; type: string; status: string }>;
  onPin: (id: string) => void;
}

const TYPE_LABEL: Record<string, string> = {
  physical: 'Physique',
  proxmox: 'Proxmox',
  docker: 'Docker',
  vm: 'VM',
  container: 'Conteneur',
};

function PinModal({
  opened,
  onClose,
  unpinnedServices,
  onPin,
}: PinModalProps) {
  const hasItems = unpinnedServices.length > 0;

  return (
    <Modal opened={opened} onClose={onClose} title="Épingler au dashboard" centered size="md">
      {!hasItems ? (
        <Text c="dimmed" ta="center" py="lg">
          Tous les éléments sont déjà épinglés.
        </Text>
      ) : (
        <Stack gap="md">
          {unpinnedServices.map((s) => (
            <Paper key={s.id} withBorder p="sm" radius="sm">
              <Group justify="space-between">
                <div>
                  <Text size="sm" fw={500}>{s.name}</Text>
                  <Text size="xs" c="dimmed">{TYPE_LABEL[s.type] ?? s.type}</Text>
                </div>
                <Group gap="xs">
                  <Badge color={STATUS_COLORS[s.status] ?? 'gray'} variant="light" size="sm">
                    {s.status}
                  </Badge>
                  <Button
                    size="xs"
                    variant="light"
                    leftSection={<IconPin size={14} />}
                    onClick={() => onPin(s.id)}
                  >
                    Épingler
                  </Button>
                </Group>
              </Group>
            </Paper>
          ))}
        </Stack>
      )}
    </Modal>
  );
}
