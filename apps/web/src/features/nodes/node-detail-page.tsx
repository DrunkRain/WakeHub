import { useState } from 'react';
import { useParams, Link } from 'react-router';
import {
  Container,
  Title,
  Text,
  Stack,
  Group,
  Badge,
  Button,
  Card,
  Anchor,
  Loader,
  Center,
} from '@mantine/core';
import {
  IconServer,
  IconArrowLeft,
  IconSettings,
  IconCheck,
  IconCloudComputing,
  IconBrandDocker,
} from '@tabler/icons-react';
import { useNode, useDiscoveredNodes } from '../../api/nodes.api';
import { ConfigureProxmoxModal } from './configure-proxmox-modal';
import { ConfigureDockerModal } from './configure-docker-modal';
import { ConfigureDiscoveredModal } from './configure-discovered-modal';

const statusColors: Record<string, string> = {
  online: 'green',
  offline: 'gray',
  starting: 'yellow',
  stopping: 'orange',
  error: 'red',
};

const typeLabels: Record<string, string> = {
  physical: 'Physique',
  vm: 'VM',
  lxc: 'LXC',
  container: 'Conteneur',
};

export function NodeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data, isLoading, error } = useNode(id ?? '');
  const { data: childrenData } = useDiscoveredNodes(id ?? '');
  const [proxmoxModalOpened, setProxmoxModalOpened] = useState(false);
  const [dockerModalOpened, setDockerModalOpened] = useState(false);
  const [configureNodeId, setConfigureNodeId] = useState<string | null>(null);

  if (isLoading) {
    return (
      <Container size="lg" py="xl">
        <Center py="xl">
          <Loader />
        </Center>
      </Container>
    );
  }

  if (error || !data) {
    return (
      <Container size="lg" py="xl">
        <Text c="red">Erreur lors du chargement du noeud.</Text>
        <Anchor component={Link} to="/nodes">Retour aux noeuds</Anchor>
      </Container>
    );
  }

  const node = data.data.node;
  const children = childrenData?.data.nodes ?? [];
  const discoveredUnconfigured = children.filter((n) => n.discovered && !n.configured);
  const configuredChildren = children.filter((n) => n.configured);
  const caps = node.capabilities as Record<string, unknown> | null;
  const hasProxmox = !!caps?.proxmox_api;
  const proxmoxCap = hasProxmox
    ? (caps as Record<string, { host?: string }>).proxmox_api
    : null;
  const hasDocker = !!caps?.docker_api;
  const dockerCap = hasDocker
    ? (caps as Record<string, { host?: string; port?: number }>).docker_api
    : null;
  const canConfigureDocker = node.type !== 'container' && !hasDocker;

  const selectedDiscoveredNode = configureNodeId
    ? children.find((n) => n.id === configureNodeId)
    : null;

  return (
    <Container size="lg" py="xl">
      <Stack gap="lg">
        {/* Back link */}
        <Anchor component={Link} to="/nodes" size="sm">
          <Group gap={4}>
            <IconArrowLeft size={16} />
            Retour aux noeuds
          </Group>
        </Anchor>

        {/* Header */}
        <Group justify="space-between">
          <Group gap="sm">
            <IconServer size={28} />
            <Title order={2}>{node.name}</Title>
            <Badge variant="light">{typeLabels[node.type] ?? node.type}</Badge>
            <Badge color={statusColors[node.status] ?? 'gray'}>{node.status}</Badge>
          </Group>
        </Group>

        {node.ipAddress && (
          <Text size="sm" c="dimmed">
            IP : {node.ipAddress}
          </Text>
        )}

        {/* Section Capacités */}
        <Card withBorder>
          <Stack gap="sm">
            <Title order={4}>Capacites</Title>

            {!hasProxmox && (
              <Button
                leftSection={<IconSettings size={16} />}
                variant="light"
                onClick={() => setProxmoxModalOpened(true)}
              >
                Configurer Proxmox
              </Button>
            )}

            {hasProxmox && proxmoxCap && (
              <Group gap="xs">
                <IconCheck size={16} color="var(--mantine-color-green-6)" />
                <Text size="sm">Proxmox connecte — {proxmoxCap.host}</Text>
              </Group>
            )}

            {canConfigureDocker && (
              <Button
                leftSection={<IconBrandDocker size={16} />}
                variant="light"
                onClick={() => setDockerModalOpened(true)}
              >
                Configurer Docker
              </Button>
            )}

            {hasDocker && dockerCap && (
              <Group gap="xs">
                <IconCheck size={16} color="var(--mantine-color-green-6)" />
                <Text size="sm">Docker connecte — {dockerCap.host}:{dockerCap.port}</Text>
              </Group>
            )}
          </Stack>
        </Card>

        {/* Section Services découverts (non configurés) */}
        {discoveredUnconfigured.length > 0 && (
          <Card withBorder>
            <Stack gap="sm">
              <Title order={4}>
                Services a configurer ({discoveredUnconfigured.length})
              </Title>
              {discoveredUnconfigured.map((child) => (
                <Group
                  key={child.id}
                  justify="space-between"
                  p="xs"
                  style={{
                    border: '1px solid var(--mantine-color-dark-4)',
                    borderRadius: 'var(--mantine-radius-sm)',
                  }}
                >
                  <Group gap="sm">
                    <IconCloudComputing size={18} />
                    <div>
                      <Text fw={500} size="sm">
                        {child.name}
                      </Text>
                      <Text size="xs" c="dimmed">
                        {typeLabels[child.type] ?? child.type} — {child.status}
                      </Text>
                    </div>
                  </Group>
                  <Button
                    size="xs"
                    variant="light"
                    onClick={() => setConfigureNodeId(child.id)}
                  >
                    Configurer
                  </Button>
                </Group>
              ))}
            </Stack>
          </Card>
        )}

        {/* Section Noeuds configurés */}
        {configuredChildren.length > 0 && (
          <Card withBorder>
            <Stack gap="sm">
              <Title order={4}>Noeuds configures ({configuredChildren.length})</Title>
              {configuredChildren.map((child) => (
                <Group
                  key={child.id}
                  p="xs"
                  style={{
                    border: '1px solid var(--mantine-color-dark-4)',
                    borderRadius: 'var(--mantine-radius-sm)',
                  }}
                >
                  <IconCloudComputing size={18} />
                  <div>
                    <Text fw={500} size="sm">
                      {child.name}
                    </Text>
                    <Text size="xs" c="dimmed">
                      {typeLabels[child.type] ?? child.type} — {child.status}
                    </Text>
                  </div>
                </Group>
              ))}
            </Stack>
          </Card>
        )}
      </Stack>

      {/* Modals */}
      <ConfigureProxmoxModal
        nodeId={id ?? ''}
        opened={proxmoxModalOpened}
        onClose={() => setProxmoxModalOpened(false)}
      />

      <ConfigureDockerModal
        nodeId={id ?? ''}
        opened={dockerModalOpened}
        onClose={() => setDockerModalOpened(false)}
      />

      {selectedDiscoveredNode && (
        <ConfigureDiscoveredModal
          node={selectedDiscoveredNode}
          opened={!!configureNodeId}
          onClose={() => setConfigureNodeId(null)}
        />
      )}
    </Container>
  );
}
