import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router';
import {
  Container,
  Title,
  Text,
  Stack,
  Group,
  Button,
  Card,
  Anchor,
  Loader,
  Center,
  TextInput,
  PasswordInput,
  Modal,
  Alert,
  ActionIcon,
  Select,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  IconArrowLeft,
  IconSettings,
  IconCheck,
  IconCloudComputing,
  IconBrandDocker,
  IconTrash,
  IconPlugConnected,
  IconDeviceFloppy,
  IconAlertTriangle,
  IconPlus,
} from '@tabler/icons-react';
import {
  useNode,
  useNodes,
  useDiscoveredNodes,
  useUpdateNode,
  useTestConnection,
  useDeleteNode,
} from '../../api/nodes.api';
import { useStartCascade, useStopCascade } from '../../api/cascades.api';
import { useDependencies, useCreateDependency, useDeleteDependency } from '../../api/dependencies.api';
import { useCascadeForNode } from '../../stores/cascade.store';
import { StatusBadge } from '../../components/shared/status-badge';
import { NodeTypeIcon } from '../../components/shared/node-type-icon';
import { CascadeProgress } from '../dashboard/cascade-progress';
import { ConfigureProxmoxModal } from './configure-proxmox-modal';
import { ConfigureDockerModal } from './configure-docker-modal';
import { ConfigureDiscoveredModal } from './configure-discovered-modal';
import { InactivityRulesSection } from './inactivity-rules-section';
import type { NodeType, NodeStatus } from '@wakehub/shared';

const typeLabels: Record<string, string> = {
  physical: 'Physique',
  vm: 'VM',
  lxc: 'LXC',
  container: 'Conteneur',
};

export function NodeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data, isLoading, error } = useNode(id ?? '');
  const { data: childrenData } = useDiscoveredNodes(id ?? '');
  const updateNode = useUpdateNode();
  const testConnection = useTestConnection();
  const deleteNode = useDeleteNode();
  const { data: allNodesData } = useNodes();
  const { data: depsData } = useDependencies(id ?? '');
  const startCascade = useStartCascade();
  const stopCascade = useStopCascade();
  const cascadeState = useCascadeForNode(id ?? '');
  const createDependency = useCreateDependency();
  const deleteDependency = useDeleteDependency();
  const [stopCascadeModalOpened, setStopCascadeModalOpened] = useState(false);
  const [proxmoxModalOpened, setProxmoxModalOpened] = useState(false);
  const [dockerModalOpened, setDockerModalOpened] = useState(false);
  const [configureNodeId, setConfigureNodeId] = useState<string | null>(null);
  const [deleteModalOpened, setDeleteModalOpened] = useState(false);
  const [addDepFormOpen, setAddDepFormOpen] = useState(false);
  const [depTargetNodeId, setDepTargetNodeId] = useState<string | null>(null);
  const [depDirection, setDepDirection] = useState<string | null>('upstream');
  const [deleteDepModalOpened, setDeleteDepModalOpened] = useState(false);
  const [deletingDepId, setDeletingDepId] = useState<string | null>(null);

  // Form state
  const [formName, setFormName] = useState('');
  const [formIpAddress, setFormIpAddress] = useState('');
  const [formMacAddress, setFormMacAddress] = useState('');
  const [formServiceUrl, setFormServiceUrl] = useState('');
  const [formSshUser, setFormSshUser] = useState('');
  const [formSshPassword, setFormSshPassword] = useState('');
  const [passwordTouched, setPasswordTouched] = useState(false);

  const node = data?.data.node;

  // Initialize form values when node data loads
  useEffect(() => {
    if (node) {
      setFormName(node.name);
      setFormIpAddress(node.ipAddress ?? '');
      setFormMacAddress(node.macAddress ?? '');
      setFormServiceUrl(node.serviceUrl ?? '');
      setFormSshUser(node.sshUser ?? '');
      setFormSshPassword('');
      setPasswordTouched(false);
    }
  }, [node]);

  if (isLoading) {
    return (
      <Container size="lg" py="xl">
        <Center py="xl">
          <Loader />
        </Center>
      </Container>
    );
  }

  if (error || !node) {
    return (
      <Container size="lg" py="xl">
        <Text c="red">Erreur lors du chargement du noeud.</Text>
        <Anchor component={Link} to="/nodes">Retour aux noeuds</Anchor>
      </Container>
    );
  }

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

  const handleSave = () => {
    const payload: Record<string, string | undefined> = {};
    if (formName !== node.name) payload.name = formName;
    if (formIpAddress !== (node.ipAddress ?? '')) payload.ipAddress = formIpAddress;
    if (formMacAddress !== (node.macAddress ?? '')) payload.macAddress = formMacAddress;
    if (formServiceUrl !== (node.serviceUrl ?? '')) payload.serviceUrl = formServiceUrl;
    if (formSshUser !== (node.sshUser ?? '')) payload.sshUser = formSshUser;
    if (passwordTouched) payload.sshPassword = formSshPassword;

    if (Object.keys(payload).length === 0) return;

    updateNode.mutate(
      { nodeId: id!, data: payload },
      {
        onSuccess: () => {
          notifications.show({
            title: 'Succes',
            message: 'Noeud mis a jour',
            color: 'green',
          });
          setPasswordTouched(false);
        },
        onError: (err) => {
          notifications.show({
            title: 'Erreur',
            message: err.error?.message ?? 'Impossible de mettre a jour le noeud',
            color: 'red',
          });
        },
      },
    );
  };

  const handleTestConnection = () => {
    testConnection.mutate(id!, {
      onSuccess: () => {
        notifications.show({
          title: 'Succes',
          message: 'Connexion reussie',
          color: 'green',
        });
      },
      onError: (err) => {
        notifications.show({
          title: 'Erreur',
          message: err.error?.message ?? 'Echec de la connexion',
          color: 'red',
        });
      },
    });
  };

  const handleDelete = () => {
    deleteNode.mutate(id!, {
      onSuccess: () => {
        notifications.show({
          title: 'Succes',
          message: 'Noeud supprime',
          color: 'green',
        });
        navigate('/nodes');
      },
      onError: (err) => {
        notifications.show({
          title: 'Erreur',
          message: err.error?.message ?? 'Impossible de supprimer le noeud',
          color: 'red',
        });
      },
    });
  };

  const upstream = depsData?.data.upstream ?? [];
  const downstream = depsData?.data.downstream ?? [];
  const allNodes = allNodesData?.data.nodes ?? [];

  // Build Select options: exclude current node, already-linked nodes, and structural relatives
  const linkedNodeIds = new Set([
    ...upstream.map((d) => d.nodeId),
    ...downstream.map((d) => d.nodeId),
    id!,
    ...(node.parentId ? [node.parentId] : []),
    ...children.map((c) => c.id),
  ]);
  const nodeSelectOptions = allNodes
    .filter((n) => !linkedNodeIds.has(n.id))
    .map((n) => ({ value: n.id, label: `${n.name} (${typeLabels[n.type] ?? n.type})` }));

  const handleAddDependency = () => {
    if (!depTargetNodeId || !depDirection) return;

    const fromNodeId = depDirection === 'upstream' ? id! : depTargetNodeId;
    const toNodeId = depDirection === 'upstream' ? depTargetNodeId : id!;

    createDependency.mutate(
      { fromNodeId, toNodeId },
      {
        onSuccess: () => {
          notifications.show({
            title: 'Dependance ajoutee',
            message: 'Le lien a ete cree avec succes',
            color: 'green',
          });
          setAddDepFormOpen(false);
          setDepTargetNodeId(null);
          setDepDirection('upstream');
        },
        onError: (err) => {
          const code = err.error?.code;
          let message = err.error?.message ?? 'Impossible de creer la dependance';
          if (code === 'DEPENDENCY_CYCLE_DETECTED') message = 'Ce lien creerait un cycle de dependances';
          if (code === 'DEPENDENCY_DUPLICATE') message = 'Ce lien de dependance existe deja';
          if (code === 'DEPENDENCY_SELF_LINK') message = 'Un noeud ne peut pas dependre de lui-meme';
          notifications.show({ title: 'Erreur', message, color: 'red' });
        },
      },
    );
  };

  const handleDeleteDependency = () => {
    if (!deletingDepId) return;
    deleteDependency.mutate(deletingDepId, {
      onSuccess: () => {
        notifications.show({
          title: 'Dependance supprimee',
          message: 'Le lien a ete supprime',
          color: 'green',
        });
        setDeleteDepModalOpened(false);
        setDeletingDepId(null);
      },
      onError: (err) => {
        notifications.show({
          title: 'Erreur',
          message: err.error?.message ?? 'Impossible de supprimer la dependance',
          color: 'red',
        });
      },
    });
  };

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
            <NodeTypeIcon type={node.type as NodeType} size={28} />
            <Title order={2}>{node.name}</Title>
            <StatusBadge status={node.status as NodeStatus} />
          </Group>
        </Group>

        {node.ipAddress && (
          <Text size="sm" c="dimmed">
            IP : {node.ipAddress}
          </Text>
        )}

        {/* Section Parametres */}
        <Card withBorder>
          <Stack gap="sm">
            <Title order={4}>Parametres</Title>
            <TextInput
              label="Nom"
              value={formName}
              onChange={(e) => setFormName(e.currentTarget.value)}
            />
            <TextInput
              label="Adresse IP"
              value={formIpAddress}
              onChange={(e) => setFormIpAddress(e.currentTarget.value)}
            />
            <TextInput
              label="Adresse MAC"
              value={formMacAddress}
              onChange={(e) => setFormMacAddress(e.currentTarget.value)}
            />
            <TextInput
              label="URL d'acces"
              value={formServiceUrl}
              onChange={(e) => setFormServiceUrl(e.currentTarget.value)}
              placeholder="https://mon-service.local:8080"
            />
            <TextInput
              label="Utilisateur SSH"
              value={formSshUser}
              onChange={(e) => setFormSshUser(e.currentTarget.value)}
            />
            <PasswordInput
              label="Mot de passe SSH"
              value={formSshPassword}
              onChange={(e) => {
                setFormSshPassword(e.currentTarget.value);
                setPasswordTouched(true);
              }}
              placeholder={node.sshUser ? '********' : ''}
            />
            <Group>
              <Button
                leftSection={<IconDeviceFloppy size={16} />}
                onClick={handleSave}
                loading={updateNode.isPending}
              >
                Enregistrer
              </Button>
            </Group>
          </Stack>
        </Card>

        {/* Section Capacites */}
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

        {/* Section Services decouverts (non configures) */}
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

        {/* Section Noeuds configures */}
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

        {/* Section Hierarchie structurelle */}
        {node.parentId && (() => {
          const parent = allNodes.find((n) => n.id === node.parentId);
          return parent ? (
            <Card withBorder>
              <Stack gap="sm">
                <Title order={4}>Hierarchie structurelle</Title>
                <Text size="sm" fw={500}>Parent :</Text>
                <Group p="xs" style={{ border: '1px solid var(--mantine-color-dark-4)', borderRadius: 'var(--mantine-radius-sm)' }}>
                  <NodeTypeIcon type={parent.type as NodeType} size={18} />
                  <Text size="sm">{parent.name}</Text>
                  <StatusBadge status={parent.status as NodeStatus} size="xs" />
                </Group>
                {children.length > 0 && (
                  <>
                    <Text size="sm" fw={500}>Enfants ({children.length}) :</Text>
                    {children.map((child) => (
                      <Group key={child.id} p="xs" style={{ border: '1px solid var(--mantine-color-dark-4)', borderRadius: 'var(--mantine-radius-sm)' }}>
                        <NodeTypeIcon type={child.type as NodeType} size={18} />
                        <Text size="sm">{child.name}</Text>
                        <StatusBadge status={child.status as NodeStatus} size="xs" />
                      </Group>
                    ))}
                  </>
                )}
              </Stack>
            </Card>
          ) : null;
        })()}

        {/* Section Dependances fonctionnelles */}
        <Card withBorder>
          <Stack gap="sm">
            <Group justify="space-between">
              <Title order={4}>Dependances fonctionnelles</Title>
              <Button
                leftSection={<IconPlus size={16} />}
                variant="light"
                size="xs"
                onClick={() => setAddDepFormOpen(!addDepFormOpen)}
              >
                Ajouter une dependance
              </Button>
            </Group>

            {addDepFormOpen && (
              <Card withBorder p="sm">
                <Stack gap="xs">
                  <Select
                    label="Noeud cible"
                    placeholder="Choisir un noeud"
                    searchable
                    data={nodeSelectOptions}
                    value={depTargetNodeId}
                    onChange={setDepTargetNodeId}
                  />
                  <Select
                    label="Direction"
                    data={[
                      { value: 'upstream', label: `${node.name} a besoin de...` },
                      { value: 'downstream', label: `... a besoin de ${node.name}` },
                    ]}
                    value={depDirection}
                    onChange={setDepDirection}
                  />
                  <Group>
                    <Button
                      size="xs"
                      onClick={handleAddDependency}
                      loading={createDependency.isPending}
                      disabled={!depTargetNodeId}
                    >
                      Ajouter
                    </Button>
                    <Button
                      size="xs"
                      variant="default"
                      onClick={() => {
                        setAddDepFormOpen(false);
                        setDepTargetNodeId(null);
                      }}
                    >
                      Annuler
                    </Button>
                  </Group>
                </Stack>
              </Card>
            )}

            <Text size="sm" fw={500} mt="xs">{node.name} a besoin de :</Text>
            {upstream.length === 0 ? (
              <Text size="sm" c="dimmed">Aucune dependance</Text>
            ) : (
              upstream.map((dep) => (
                <Group key={dep.linkId} justify="space-between" p="xs" style={{ border: '1px solid var(--mantine-color-dark-4)', borderRadius: 'var(--mantine-radius-sm)' }}>
                  <Group gap="sm">
                    <NodeTypeIcon type={dep.type as NodeType} size={18} />
                    <Text size="sm">{dep.name}</Text>
                  </Group>
                  <ActionIcon
                    variant="subtle"
                    color="red"
                    onClick={() => { setDeletingDepId(dep.linkId); setDeleteDepModalOpened(true); }}
                    aria-label={`Supprimer dependance ${dep.name}`}
                  >
                    <IconTrash size={16} />
                  </ActionIcon>
                </Group>
              ))
            )}

            <Text size="sm" fw={500} mt="xs">... ont besoin de {node.name} :</Text>
            {downstream.length === 0 ? (
              <Text size="sm" c="dimmed">Aucun dependant</Text>
            ) : (
              downstream.map((dep) => (
                <Group key={dep.linkId} justify="space-between" p="xs" style={{ border: '1px solid var(--mantine-color-dark-4)', borderRadius: 'var(--mantine-radius-sm)' }}>
                  <Group gap="sm">
                    <NodeTypeIcon type={dep.type as NodeType} size={18} />
                    <Text size="sm">{dep.name}</Text>
                  </Group>
                  <ActionIcon
                    variant="subtle"
                    color="red"
                    onClick={() => { setDeletingDepId(dep.linkId); setDeleteDepModalOpened(true); }}
                    aria-label={`Supprimer dependance ${dep.name}`}
                  >
                    <IconTrash size={16} />
                  </ActionIcon>
                </Group>
              ))
            )}
          </Stack>
        </Card>

        {/* Section Règles d'inactivité */}
        <InactivityRulesSection nodeId={id!} nodeType={node.type as NodeType} />

        {/* Section Contrôle d'alimentation */}
        <Card withBorder>
          <Stack gap="sm">
            <Title order={4}>Contrôle d'alimentation</Title>

            {cascadeState && (
              <CascadeProgress
                step={cascadeState.step}
                totalSteps={cascadeState.totalSteps}
                currentNodeName={cascadeState.currentNodeName}
                status={cascadeState.status}
                errorNodeName={cascadeState.errorNodeName}
              />
            )}

            <Group>
              {node.status === 'offline' && (
                <Button
                  color="blue"
                  aria-label={`Démarrer ${node.name}`}
                  onClick={() => startCascade.mutate(id!)}
                  loading={startCascade.isPending}
                >
                  Démarrer
                </Button>
              )}
              {node.status === 'online' && node.serviceUrl && (
                <Button
                  color="blue"
                  variant="light"
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
                  onClick={() => setStopCascadeModalOpened(true)}
                >
                  Arrêter
                </Button>
              )}
              {node.status === 'error' && (
                <Button
                  color="orange"
                  aria-label={`Réessayer ${node.name}`}
                  onClick={() => startCascade.mutate(id!)}
                  loading={startCascade.isPending}
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
          </Stack>
        </Card>

        {/* Actions */}
        <Card withBorder>
          <Stack gap="sm">
            <Title order={4}>Actions</Title>
            <Group>
              <Button
                leftSection={<IconPlugConnected size={16} />}
                variant="light"
                onClick={handleTestConnection}
                loading={testConnection.isPending}
              >
                Tester la connexion
              </Button>
              <Button
                leftSection={<IconTrash size={16} />}
                variant="outline"
                color="red"
                onClick={() => setDeleteModalOpened(true)}
              >
                Supprimer
              </Button>
            </Group>
          </Stack>
        </Card>
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

      {/* Delete Dependency Confirmation Modal */}
      <Modal
        opened={deleteDepModalOpened}
        onClose={() => { setDeleteDepModalOpened(false); setDeletingDepId(null); }}
        title="Supprimer la dependance"
      >
        <Stack gap="md">
          <Text size="sm">Voulez-vous vraiment supprimer ce lien de dependance ?</Text>
          <Group justify="flex-end">
            <Button variant="default" onClick={() => { setDeleteDepModalOpened(false); setDeletingDepId(null); }}>
              Annuler
            </Button>
            <Button
              color="red"
              onClick={handleDeleteDependency}
              loading={deleteDependency.isPending}
            >
              Supprimer
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* Stop Cascade Confirmation Modal */}
      <Modal
        opened={stopCascadeModalOpened}
        onClose={() => setStopCascadeModalOpened(false)}
        title={`Arrêter ${node.name} ?`}
      >
        <Stack gap="md">
          <Text size="sm">
            Cette action va arrêter {node.name} et ses dépendances en cascade :
          </Text>
          {downstream.length > 0 ? (
            <Stack gap="xs">
              {downstream.map((dep) => (
                <Group key={dep.linkId} gap="xs">
                  <NodeTypeIcon type={dep.type as NodeType} size={16} />
                  <Text size="sm">{dep.name}</Text>
                  <StatusBadge status={dep.status as NodeStatus} size="xs" />
                </Group>
              ))}
            </Stack>
          ) : (
            <Text size="sm" c="dimmed">Aucune dépendance descendante ne sera affectée.</Text>
          )}
          <Group justify="flex-end" mt="md">
            <Button variant="default" onClick={() => setStopCascadeModalOpened(false)}>
              Annuler
            </Button>
            <Button
              color="red"
              onClick={() => { setStopCascadeModalOpened(false); stopCascade.mutate(id!); }}
              loading={stopCascade.isPending}
            >
              Confirmer l'arrêt
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* Delete Node Confirmation Modal */}
      <Modal
        opened={deleteModalOpened}
        onClose={() => setDeleteModalOpened(false)}
        title={`Supprimer definitivement ${node.name} ?`}
      >
        <Stack gap="md">
          <Text size="sm">
            Cette action est irreversible. Le noeud sera definitivement supprime.
          </Text>
          {children.length > 0 && (
            <Alert color="orange" icon={<IconAlertTriangle size={16} />}>
              Attention : {children.length} noeud{children.length > 1 ? 's' : ''} enfant{children.length > 1 ? 's' : ''} seront egalement supprime{children.length > 1 ? 's' : ''}.
            </Alert>
          )}
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setDeleteModalOpened(false)}>
              Annuler
            </Button>
            <Button
              color="red"
              onClick={handleDelete}
              loading={deleteNode.isPending}
            >
              Supprimer
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Container>
  );
}
