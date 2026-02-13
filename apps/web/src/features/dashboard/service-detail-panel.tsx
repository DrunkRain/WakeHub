import { useState } from 'react';
import { useNavigate } from 'react-router';
import {
  Drawer,
  Group,
  Stack,
  Text,
  Button,
  ActionIcon,
  Tabs,
  Modal,
  Loader,
} from '@mantine/core';
import {
  IconX,
  IconPencil,
  IconExternalLink,
  IconClock,
} from '@tabler/icons-react';
import { StatusBadge } from '../../components/shared/status-badge';
import { NodeTypeIcon } from '../../components/shared/node-type-icon';
import { CascadeProgress } from './cascade-progress';
import { useCascadeForNode } from '../../stores/cascade.store';
import { useDependencies } from '../../api/dependencies.api';
import type { NodeType, NodeStatus } from '@wakehub/shared';

export interface ServiceDetailNode {
  id: string;
  name: string;
  type: string;
  status: string;
  serviceUrl: string | null;
  isPinned: boolean;
}

export interface ServiceDetailPanelProps {
  node: ServiceDetailNode | null;
  opened: boolean;
  onClose: () => void;
  onStartCascade: (nodeId: string) => void;
  onStopCascade: (nodeId: string) => void;
  nodeTypeMap?: Record<string, string>;
}

export function ServiceDetailPanel({
  node,
  opened,
  onClose,
  onStartCascade,
  onStopCascade,
  nodeTypeMap,
}: ServiceDetailPanelProps) {
  const navigate = useNavigate();
  const [stopModalOpened, setStopModalOpened] = useState(false);
  const cascadeState = useCascadeForNode(node?.id ?? '');
  const { data: depsData, isLoading: depsLoading } = useDependencies(node?.id ?? '');

  const upstream = depsData?.data.upstream ?? [];
  const downstream = depsData?.data.downstream ?? [];

  const currentNodeType =
    cascadeState?.currentNodeId && nodeTypeMap
      ? nodeTypeMap[cascadeState.currentNodeId]
      : undefined;

  const handleStop = () => {
    if (!node) return;
    setStopModalOpened(false);
    onStopCascade(node.id);
  };

  return (
    <>
      <Drawer
        opened={opened}
        onClose={onClose}
        position="right"
        size={380}
        title={null}
        withCloseButton={false}
        aria-label={node ? `Détail du service ${node.name}` : undefined}
      >
        {node && (
          <Stack gap="md" h="100%" style={{ display: 'flex', flexDirection: 'column' }}>
            {/* Header */}
            <Group justify="space-between">
              <Group gap="sm">
                <NodeTypeIcon type={node.type as NodeType} size={24} />
                <Text fw={600} size="lg">{node.name}</Text>
                <StatusBadge status={node.status as NodeStatus} size="sm" />
              </Group>
              <Group gap={4}>
                <ActionIcon
                  variant="subtle"
                  aria-label={`Éditer ${node.name}`}
                  onClick={() => { onClose(); navigate(`/nodes/${node.id}`); }}
                >
                  <IconPencil size={18} />
                </ActionIcon>
                <ActionIcon
                  variant="subtle"
                  aria-label="Fermer"
                  onClick={onClose}
                >
                  <IconX size={18} />
                </ActionIcon>
              </Group>
            </Group>

            {/* Tabs */}
            <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
              <Tabs defaultValue="dependencies">
                <Tabs.List>
                  <Tabs.Tab value="dependencies">Dépendances</Tabs.Tab>
                  <Tabs.Tab value="logs">Logs</Tabs.Tab>
                </Tabs.List>

                <Tabs.Panel value="dependencies" pt="md">
                  {depsLoading ? (
                    <Loader size="sm" />
                  ) : upstream.length === 0 ? (
                    <Text size="sm" c="dimmed">Aucune dépendance</Text>
                  ) : (
                    <Stack gap="xs">
                      {upstream.map((dep) => (
                        <Group key={dep.linkId} gap="sm" p="xs" style={{ border: '1px solid var(--mantine-color-dark-4)', borderRadius: 'var(--mantine-radius-sm)' }}>
                          <NodeTypeIcon type={dep.type as NodeType} size={18} />
                          <div style={{ flex: 1 }}>
                            <Text size="sm" fw={500}>{dep.name}</Text>
                            <Text size="xs" c="dimmed">{dep.type}</Text>
                          </div>
                          <StatusBadge status={dep.status as NodeStatus} size="xs" />
                        </Group>
                      ))}
                    </Stack>
                  )}
                </Tabs.Panel>

                <Tabs.Panel value="logs" pt="md">
                  <Stack align="center" gap="md" py="xl">
                    <IconClock size={36} stroke={1.5} color="var(--mantine-color-dark-3)" />
                    <Text size="sm" c="dimmed" ta="center">Logs disponibles bientôt</Text>
                  </Stack>
                </Tabs.Panel>
              </Tabs>
            </div>

            {/* CascadeProgress */}
            {cascadeState && (
              <CascadeProgress
                step={cascadeState.step}
                totalSteps={cascadeState.totalSteps}
                currentNodeName={cascadeState.currentNodeName}
                currentNodeType={currentNodeType}
                status={cascadeState.status}
                errorNodeName={cascadeState.errorNodeName}
              />
            )}

            {/* Action zone — sticky bottom */}
            <div style={{ borderTop: '1px solid var(--mantine-color-dark-4)', paddingTop: 'var(--mantine-spacing-md)' }}>
              <Group grow>
                {node.status === 'offline' && (
                  <Button
                    color="blue"
                    aria-label={`Démarrer ${node.name}`}
                    onClick={() => onStartCascade(node.id)}
                  >
                    Démarrer
                  </Button>
                )}
                {node.status === 'online' && node.serviceUrl && (
                  <Button
                    color="blue"
                    leftSection={<IconExternalLink size={16} />}
                    aria-label={`Ouvrir ${node.name}`}
                    onClick={() => window.open(node.serviceUrl!, '_blank', 'noopener,noreferrer')}
                  >
                    Ouvrir
                  </Button>
                )}
                {node.status === 'online' && (
                  <Button
                    color="red"
                    aria-label={`Arrêter ${node.name}`}
                    onClick={() => setStopModalOpened(true)}
                  >
                    Arrêter
                  </Button>
                )}
                {node.status === 'error' && (
                  <Button
                    color="orange"
                    aria-label={`Réessayer ${node.name}`}
                    onClick={() => onStartCascade(node.id)}
                  >
                    Réessayer
                  </Button>
                )}
                {node.status === 'starting' && (
                  <Button color="yellow" disabled loading>
                    Démarrage…
                  </Button>
                )}
                {node.status === 'stopping' && (
                  <Button color="orange" disabled loading>
                    Arrêt…
                  </Button>
                )}
              </Group>
            </div>
          </Stack>
        )}
      </Drawer>

      {/* Stop Confirmation Modal */}
      <Modal
        opened={stopModalOpened}
        onClose={() => setStopModalOpened(false)}
        title={`Arrêter ${node?.name} ?`}
      >
        <Stack gap="md">
          <Text size="sm">
            Cette action va arrêter {node?.name} et ses dépendances en cascade :
          </Text>
          {downstream.length > 0 && (
            <Stack gap="xs">
              {downstream.map((dep) => (
                <Group key={dep.linkId} gap="xs">
                  <NodeTypeIcon type={dep.type as NodeType} size={16} />
                  <Text size="sm">{dep.name}</Text>
                  <StatusBadge status={dep.status as NodeStatus} size="xs" />
                </Group>
              ))}
            </Stack>
          )}
          {downstream.length === 0 && (
            <Text size="sm" c="dimmed">Aucune dépendance descendante ne sera affectée.</Text>
          )}
          <Group justify="flex-end" mt="md">
            <Button variant="default" onClick={() => setStopModalOpened(false)}>
              Annuler
            </Button>
            <Button color="red" onClick={handleStop}>
              Confirmer l'arrêt
            </Button>
          </Group>
        </Stack>
      </Modal>
    </>
  );
}
