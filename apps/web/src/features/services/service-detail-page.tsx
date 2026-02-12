import { useState } from 'react';
import { useParams, useNavigate } from 'react-router';
import {
  Container,
  Group,
  Title,
  Button,
  TextInput,
  PasswordInput,
  Paper,
  Text,
  Stack,
  Skeleton,
  Badge,
  ActionIcon,
  Modal,
  Divider,
  SegmentedControl,
  Select,
  Checkbox,
  Alert,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import { IconArrowLeft, IconDeviceFloppy, IconTrash, IconPlus, IconLink, IconShare, IconShareOff, IconAlertTriangle, IconPin, IconPinnedOff } from '@tabler/icons-react';
import type { DependencyLink, DependencyNodeType } from '@wakehub/shared';
import { useService, useServices, useUpdateService, useDeleteService } from '../../api/services.api';
import { useNodeDependencies, useCreateDependency, useDeleteDependency, useUpdateDependency } from '../../api/dependencies.api';
import {
  SERVICE_TYPE_ICON,
  SERVICE_TYPE_LABEL,
  STATUS_COLORS,
  STATUS_LABEL,
} from './use-services-table';

const CHILD_STATUS_COLORS: Record<string, string> = {
  running: 'green',
  stopped: 'red',
  paused: 'yellow',
  unknown: 'gray',
  error: 'orange',
};

const CHILD_STATUS_LABELS: Record<string, string> = {
  running: 'En cours',
  stopped: 'Arrêté',
  paused: 'En pause',
  unknown: 'Inconnu',
  error: 'Erreur',
};

function LoadingSkeleton() {
  return (
    <Container size="sm" py="xl">
      <Group gap="sm" mb="xl">
        <Skeleton height={28} width={28} circle />
        <Skeleton height={28} width={200} />
      </Group>
      <Stack gap="md">
        {Array.from({ length: 5 }, (_, i) => (
          <Skeleton key={i} height={56} radius="sm" />
        ))}
      </Stack>
    </Container>
  );
}

function NotFound() {
  const navigate = useNavigate();

  return (
    <Container size="sm" py="xl">
      <Stack align="center" gap="md" py="xl">
        <Text size="xl" fw={600}>Service non trouvé</Text>
        <Text c="dimmed">Ce service n'existe pas ou a été supprimé.</Text>
        <Button variant="light" leftSection={<IconArrowLeft size={16} />} onClick={() => navigate('/services')}>
          Retour aux services
        </Button>
      </Stack>
    </Container>
  );
}

export function ServiceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data, isLoading, error } = useService(id!);
  const updateService = useUpdateService();
  const deleteService = useDeleteService();
  const [deleteModalOpened, setDeleteModalOpened] = useState(false);
  const [depModalOpened, setDepModalOpened] = useState(false);
  const [depDirection, setDepDirection] = useState<'parent' | 'child'>('parent');
  const [depTargetId, setDepTargetId] = useState<string | null>(null);
  const [depIsShared, setDepIsShared] = useState(false);
  const [deleteDepLink, setDeleteDepLink] = useState<DependencyLink | null>(null);

  const service = data?.data;
  const isProxmox = service?.type === 'proxmox';
  const isDocker = service?.type === 'docker';
  const hasParent = !!service?.parentId;

  // Fetch all services for child services list and dependency targets
  const { data: allServicesData } = useServices();
  const allServices = allServicesData?.data ?? [];

  // Child services (for proxmox/docker parents)
  const childServices = allServices.filter((s) => s.parentId === id);

  // Dependencies
  const { data: depsData } = useNodeDependencies('service', id!);
  const dependencies = depsData?.data ?? [];
  const createDependency = useCreateDependency();
  const deleteDep = useDeleteDependency();
  const updateDep = useUpdateDependency();

  // Compute parents and children from dependency links
  const parentLinks = dependencies.filter(
    (d: DependencyLink) => d.childType === 'service' && d.childId === id,
  );
  const childLinks = dependencies.filter(
    (d: DependencyLink) => d.parentType === 'service' && d.parentId === id,
  );

  // Build target options for the select, excluding current service
  const targetOptions = allServices
    .filter((s) => s.id !== id)
    .map((s) => ({ value: s.id, label: `${s.name} (${SERVICE_TYPE_LABEL[s.type]})` }));

  // Resolve a name from nodeId
  const resolveName = (_nodeType: DependencyNodeType, nodeId: string) => {
    return allServices.find((s) => s.id === nodeId)?.name ?? nodeId;
  };

  const form = useForm({
    initialValues: {
      name: '',
      ipAddress: '',
      macAddress: '',
      sshUser: '',
      sshPassword: '',
      serviceUrl: '',
      apiUrl: '',
      proxmoxAuthMode: 'password' as 'password' | 'token',
      proxmoxUsername: '',
      proxmoxPassword: '',
      proxmoxTokenId: '',
      proxmoxTokenSecret: '',
    },
    validate: {
      name: (value) => (!value.trim() ? 'Le nom est requis' : null),
    },
  });

  // Sync form when service data arrives (only once)
  const [formInitialized, setFormInitialized] = useState(false);
  if (service && !formInitialized) {
    form.setValues({
      name: service.name,
      ipAddress: service.ipAddress ?? '',
      macAddress: service.macAddress ?? '',
      sshUser: service.sshUser ?? '',
      sshPassword: '',
      serviceUrl: service.serviceUrl ?? '',
      apiUrl: service.apiUrl ?? '',
      proxmoxAuthMode: 'password',
      proxmoxUsername: '',
      proxmoxPassword: '',
      proxmoxTokenId: '',
      proxmoxTokenSecret: '',
    });
    form.resetDirty({
      name: service.name,
      ipAddress: service.ipAddress ?? '',
      macAddress: service.macAddress ?? '',
      sshUser: service.sshUser ?? '',
      sshPassword: '',
      serviceUrl: service.serviceUrl ?? '',
      apiUrl: service.apiUrl ?? '',
      proxmoxAuthMode: 'password',
      proxmoxUsername: '',
      proxmoxPassword: '',
      proxmoxTokenId: '',
      proxmoxTokenSecret: '',
    });
    setFormInitialized(true);
  }

  if (isLoading) return <LoadingSkeleton />;
  if (error || !service) return <NotFound />;

  const TypeIcon = SERVICE_TYPE_ICON[service.type];

  const handleSave = () => {
    const validation = form.validate();
    if (validation.hasErrors) return;

    const values = form.values;
    const payload: Record<string, string> = {};

    // Common fields — all service types
    if (values.name !== service.name) payload.name = values.name;
    if (values.ipAddress !== (service.ipAddress ?? '')) payload.ipAddress = values.ipAddress;
    if (values.macAddress !== (service.macAddress ?? '')) payload.macAddress = values.macAddress;
    if (values.sshUser !== (service.sshUser ?? '')) payload.sshUser = values.sshUser;
    if (values.sshPassword) payload.sshPassword = values.sshPassword;
    if (values.serviceUrl !== (service.serviceUrl ?? '')) payload.serviceUrl = values.serviceUrl;

    // API fields — proxmox/docker only
    if (isDocker || isProxmox) {
      if (values.apiUrl !== (service.apiUrl ?? '')) payload.apiUrl = values.apiUrl;
    }

    if (isProxmox) {
      if (values.proxmoxAuthMode === 'password' && values.proxmoxPassword) {
        payload.apiCredentials = JSON.stringify({
          username: values.proxmoxUsername,
          password: values.proxmoxPassword,
        });
      } else if (values.proxmoxAuthMode === 'token' && values.proxmoxTokenSecret) {
        payload.apiCredentials = JSON.stringify({
          tokenId: values.proxmoxTokenId,
          tokenSecret: values.proxmoxTokenSecret,
        });
      }
    }

    if (Object.keys(payload).length === 0) {
      notifications.show({
        title: 'Aucune modification',
        message: 'Aucun champ n\'a été modifié',
        color: 'yellow',
      });
      return;
    }

    updateService.mutate(
      { id: service.id, ...payload },
      {
        onSuccess: () => {
          notifications.show({
            title: 'Service mis à jour',
            message: `${values.name} a été modifié avec succès`,
            color: 'green',
          });
          form.setFieldValue('sshPassword', '');
          form.setFieldValue('proxmoxPassword', '');
          form.setFieldValue('proxmoxTokenSecret', '');
          form.resetDirty();
        },
        onError: (err) => {
          notifications.show({
            title: 'Erreur',
            message: err.error?.message || 'Impossible de modifier le service',
            color: 'red',
          });
        },
      },
    );
  };

  const handleDelete = () => {
    deleteService.mutate(service.id, {
      onSuccess: () => {
        notifications.show({
          title: 'Service supprimé',
          message: `${service.name} a été supprimé`,
          color: 'green',
        });
        navigate('/services');
      },
      onError: (err) => {
        notifications.show({
          title: 'Erreur',
          message: err.error?.message || 'Impossible de supprimer le service',
          color: 'red',
        });
        setDeleteModalOpened(false);
      },
    });
  };

  // Resolve parent service name for child services
  const parentService = hasParent
    ? allServices.find((s) => s.id === service.parentId)
    : null;

  return (
    <Container size="sm" py="xl">
      {/* Header */}
      <Group mb="xl">
        <ActionIcon variant="subtle" size="lg" onClick={() => navigate('/services')}>
          <IconArrowLeft size={20} />
        </ActionIcon>
        <TypeIcon size={24} />
        <Title order={3}>{service.name}</Title>
        <Badge color={STATUS_COLORS[service.status]} variant="light">
          {STATUS_LABEL[service.status]}
        </Badge>
        <ActionIcon
          variant="subtle"
          color={service.pinnedToDashboard ? 'blue' : 'gray'}
          size="lg"
          onClick={() => updateService.mutate(
            { id: service.id, pinnedToDashboard: !service.pinnedToDashboard },
            {
              onSuccess: () => notifications.show({
                title: service.pinnedToDashboard ? 'Désépinglé' : 'Épinglé',
                message: service.pinnedToDashboard
                  ? `${service.name} retiré du dashboard`
                  : `${service.name} ajouté au dashboard`,
                color: 'green',
              }),
            },
          )}
          aria-label={service.pinnedToDashboard ? 'Désépingler du dashboard' : 'Épingler au dashboard'}
        >
          {service.pinnedToDashboard ? <IconPinnedOff size={20} /> : <IconPin size={20} />}
        </ActionIcon>
      </Group>

      {/* Info */}
      <Paper withBorder p="md" mb="lg">
        <Group gap="xl">
          <div>
            <Text size="xs" c="dimmed">Type</Text>
            <Text size="sm" fw={500}>{SERVICE_TYPE_LABEL[service.type]}</Text>
          </div>
          <div>
            <Text size="xs" c="dimmed">Statut</Text>
            <Text size="sm" fw={500}>{STATUS_LABEL[service.status]}</Text>
          </div>
          {parentService && (
            <div>
              <Text size="xs" c="dimmed">Service parent</Text>
              <Text size="sm" fw={500}>{parentService.name}</Text>
            </div>
          )}
          <div>
            <Text size="xs" c="dimmed">Dernière mise à jour</Text>
            <Text size="sm" fw={500}>{new Date(service.updatedAt).toLocaleString('fr-FR')}</Text>
          </div>
        </Group>
      </Paper>

      {/* Child services section — Proxmox: VMs, Docker: Containers */}
      {isProxmox && (
        <Paper withBorder p="md" mb="lg">
          <Title order={5} mb="md">VMs gérées</Title>
          {childServices.length === 0 ? (
            <Text size="sm" c="dimmed">Aucune VM associée à ce serveur.</Text>
          ) : (
            <Stack gap="xs">
              {childServices.map((child) => {
                const ref = child.platformRef as { node: string; vmid: number } | null;
                return (
                  <Paper key={child.id} withBorder p="sm" radius="sm">
                    <Group justify="space-between">
                      <div>
                        <Text size="sm" fw={500}>{child.name}</Text>
                        {ref && (
                          <Text size="xs" c="dimmed">
                            Node: {ref.node} — VMID: {ref.vmid}
                          </Text>
                        )}
                      </div>
                      <Badge
                        color={CHILD_STATUS_COLORS[child.status] ?? 'gray'}
                        variant="light"
                        size="sm"
                      >
                        {CHILD_STATUS_LABELS[child.status] ?? child.status}
                      </Badge>
                    </Group>
                  </Paper>
                );
              })}
            </Stack>
          )}
        </Paper>
      )}

      {isDocker && (
        <Paper withBorder p="md" mb="lg">
          <Title order={5} mb="md">Conteneurs gérés</Title>
          {childServices.length === 0 ? (
            <Text size="sm" c="dimmed">Aucun conteneur associé à cet hôte.</Text>
          ) : (
            <Stack gap="xs">
              {childServices.map((child) => {
                const ref = child.platformRef as { containerId: string; image: string } | null;
                return (
                  <Paper key={child.id} withBorder p="sm" radius="sm">
                    <Group justify="space-between">
                      <div>
                        <Text size="sm" fw={500}>{child.name}</Text>
                        {ref && (
                          <Text size="xs" c="dimmed">
                            Image: {ref.image}
                          </Text>
                        )}
                      </div>
                      <Badge
                        color={CHILD_STATUS_COLORS[child.status] ?? 'gray'}
                        variant="light"
                        size="sm"
                      >
                        {CHILD_STATUS_LABELS[child.status] ?? child.status}
                      </Badge>
                    </Group>
                  </Paper>
                );
              })}
            </Stack>
          )}
        </Paper>
      )}

      {/* Dependencies section */}
      <Paper withBorder p="md" mb="lg">
        <Group justify="space-between" mb="md">
          <Title order={5}>
            <Group gap="xs">
              <IconLink size={18} />
              Dépendances
            </Group>
          </Title>
          <Button
            size="xs"
            variant="light"
            leftSection={<IconPlus size={14} />}
            onClick={() => {
              setDepDirection('parent');
              setDepTargetId(null);
              setDepIsShared(false);
              setDepModalOpened(true);
            }}
          >
            Ajouter
          </Button>
        </Group>

        {parentLinks.length === 0 && childLinks.length === 0 ? (
          <Text size="sm" c="dimmed">Aucune dépendance configurée.</Text>
        ) : (
          <Stack gap="xs">
            {parentLinks.length > 0 && (
              <>
                <Text size="xs" fw={600} c="dimmed" tt="uppercase">Parents (dépend de)</Text>
                {parentLinks.map((link: DependencyLink) => (
                  <Paper key={link.id} withBorder p="sm" radius="sm">
                    <Group justify="space-between">
                      <div>
                        <Text size="sm" fw={500}>{resolveName(link.parentType, link.parentId)}</Text>
                        <Text size="xs" c="dimmed">Service</Text>
                      </div>
                      <Group gap="xs">
                        {link.isStructural && (
                          <Badge size="xs" variant="light" color="blue">structurel</Badge>
                        )}
                        <ActionIcon
                          variant="subtle"
                          color={link.isShared ? 'yellow' : 'gray'}
                          size="sm"
                          onClick={() => updateDep.mutate(
                            { id: link.id, isShared: !link.isShared },
                            {
                              onSuccess: () => notifications.show({ title: 'Mis à jour', message: 'Dépendance mise à jour', color: 'green' }),
                              onError: (err) => notifications.show({ title: 'Erreur', message: err.error?.message || 'Erreur', color: 'red' }),
                            },
                          )}
                          aria-label={link.isShared ? 'Retirer le partage' : 'Marquer comme partagée'}
                        >
                          {link.isShared ? <IconShare size={14} /> : <IconShareOff size={14} />}
                        </ActionIcon>
                        {!link.isStructural && (
                          <ActionIcon
                            color="red"
                            variant="subtle"
                            size="sm"
                            onClick={() => setDeleteDepLink(link)}
                          >
                            <IconTrash size={14} />
                          </ActionIcon>
                        )}
                      </Group>
                    </Group>
                  </Paper>
                ))}
              </>
            )}
            {childLinks.length > 0 && (
              <>
                <Text size="xs" fw={600} c="dimmed" tt="uppercase" mt={parentLinks.length > 0 ? 'xs' : undefined}>Enfants (dépendent de ce service)</Text>
                {childLinks.map((link: DependencyLink) => (
                  <Paper key={link.id} withBorder p="sm" radius="sm">
                    <Group justify="space-between">
                      <div>
                        <Text size="sm" fw={500}>{resolveName(link.childType, link.childId)}</Text>
                        <Text size="xs" c="dimmed">Service</Text>
                      </div>
                      <Group gap="xs">
                        {link.isStructural && (
                          <Badge size="xs" variant="light" color="blue">structurel</Badge>
                        )}
                        <ActionIcon
                          variant="subtle"
                          color={link.isShared ? 'yellow' : 'gray'}
                          size="sm"
                          onClick={() => updateDep.mutate(
                            { id: link.id, isShared: !link.isShared },
                            {
                              onSuccess: () => notifications.show({ title: 'Mis à jour', message: 'Dépendance mise à jour', color: 'green' }),
                              onError: (err) => notifications.show({ title: 'Erreur', message: err.error?.message || 'Erreur', color: 'red' }),
                            },
                          )}
                          aria-label={link.isShared ? 'Retirer le partage' : 'Marquer comme partagée'}
                        >
                          {link.isShared ? <IconShare size={14} /> : <IconShareOff size={14} />}
                        </ActionIcon>
                        {!link.isStructural && (
                          <ActionIcon
                            color="red"
                            variant="subtle"
                            size="sm"
                            onClick={() => setDeleteDepLink(link)}
                          >
                            <IconTrash size={14} />
                          </ActionIcon>
                        )}
                      </Group>
                    </Group>
                  </Paper>
                ))}
              </>
            )}
          </Stack>
        )}
      </Paper>

      {/* Add dependency modal */}
      <Modal
        opened={depModalOpened}
        onClose={() => setDepModalOpened(false)}
        title="Ajouter une dépendance"
        centered
      >
        <Stack gap="md">
          <Select
            label="Direction"
            data={[
              { value: 'parent', label: 'Ce service dépend de...' },
              { value: 'child', label: 'Dépend de ce service...' },
            ]}
            value={depDirection}
            onChange={(val) => {
              setDepDirection(val as 'parent' | 'child');
              setDepTargetId(null);
            }}
          />
          <Select
            label="Cible"
            placeholder="Sélectionner..."
            data={targetOptions}
            value={depTargetId}
            onChange={setDepTargetId}
            searchable
          />
          <Checkbox
            label="Dépendance partagée"
            checked={depIsShared}
            onChange={(e) => setDepIsShared(e.currentTarget.checked)}
          />
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setDepModalOpened(false)}>
              Annuler
            </Button>
            <Button
              disabled={!depTargetId}
              loading={createDependency.isPending}
              onClick={() => {
                if (!depTargetId) return;
                const payload = depDirection === 'parent'
                  ? {
                      parentType: 'service' as DependencyNodeType,
                      parentId: depTargetId,
                      childType: 'service' as DependencyNodeType,
                      childId: id!,
                      isShared: depIsShared,
                    }
                  : {
                      parentType: 'service' as DependencyNodeType,
                      parentId: id!,
                      childType: 'service' as DependencyNodeType,
                      childId: depTargetId,
                      isShared: depIsShared,
                    };
                createDependency.mutate(payload, {
                  onSuccess: () => {
                    notifications.show({
                      title: 'Dépendance ajoutée',
                      message: 'Le lien a été créé avec succès',
                      color: 'green',
                    });
                    setDepModalOpened(false);
                  },
                  onError: (err) => {
                    notifications.show({
                      title: 'Erreur',
                      message: err.error?.message || 'Impossible de créer le lien',
                      color: 'red',
                    });
                  },
                });
              }}
            >
              Ajouter
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* Delete dependency confirmation modal */}
      <Modal
        opened={!!deleteDepLink}
        onClose={() => setDeleteDepLink(null)}
        title="Supprimer la dépendance"
        centered
      >
        {deleteDepLink && (() => {
          const wouldIsolate = dependencies.filter(
            (l: DependencyLink) => l.childType === deleteDepLink.childType && l.childId === deleteDepLink.childId,
          ).length <= 1;
          return (
            <Stack gap="md">
              <Text>
                Supprimer le lien entre <strong>{resolveName(deleteDepLink.parentType, deleteDepLink.parentId)}</strong>
                {' '}et <strong>{resolveName(deleteDepLink.childType, deleteDepLink.childId)}</strong> ?
              </Text>
              {wouldIsolate && (
                <Alert color="orange" icon={<IconAlertTriangle size={16} />}>
                  Attention : {resolveName(deleteDepLink.childType, deleteDepLink.childId)} n&apos;aura plus de dépendance parente.
                </Alert>
              )}
              <Group justify="flex-end">
                <Button variant="default" onClick={() => setDeleteDepLink(null)}>
                  Annuler
                </Button>
                <Button
                  color="red"
                  loading={deleteDep.isPending}
                  onClick={() => {
                    deleteDep.mutate(deleteDepLink.id, {
                      onSuccess: () => {
                        notifications.show({
                          title: 'Dépendance supprimée',
                          message: 'Le lien a été supprimé',
                          color: 'green',
                        });
                        setDeleteDepLink(null);
                      },
                      onError: (err) => {
                        notifications.show({
                          title: 'Erreur',
                          message: err.error?.message || 'Impossible de supprimer le lien',
                          color: 'red',
                        });
                      },
                    });
                  }}
                >
                  Supprimer
                </Button>
              </Group>
            </Stack>
          );
        })()}
      </Modal>

      {/* Edit form — all service types */}
      <Paper withBorder p="md" mb="lg">
        <Title order={5} mb="md">Configuration</Title>
        <Stack gap="md">
          <TextInput
            label="Nom du service"
            placeholder="ex: Serveur NAS"
            required
            {...form.getInputProps('name')}
          />
          <TextInput
            label="Adresse IP"
            placeholder="ex: 192.168.1.100"
            {...form.getInputProps('ipAddress')}
          />
          <TextInput
            label="Adresse MAC"
            description="Pour Wake-on-LAN"
            placeholder="ex: AA:BB:CC:DD:EE:FF"
            {...form.getInputProps('macAddress')}
          />
          <TextInput
            label="Utilisateur SSH"
            placeholder="ex: admin"
            {...form.getInputProps('sshUser')}
          />
          <PasswordInput
            label="Mot de passe SSH"
            placeholder="Laisser vide pour ne pas modifier"
            {...form.getInputProps('sshPassword')}
          />
          <TextInput
            label="URL du service"
            placeholder="ex: https://192.168.1.100:8080"
            {...form.getInputProps('serviceUrl')}
          />

          {(isDocker || isProxmox) && (
            <TextInput
              label={isDocker ? "URL de l'API Docker" : "URL de l'API Proxmox"}
              placeholder={isDocker ? 'ex: http://192.168.1.10:2375' : 'ex: https://192.168.1.10:8006'}
              {...form.getInputProps('apiUrl')}
            />
          )}

          {isProxmox && (
            <>
              <div>
                <Text size="sm" fw={500} mb={4}>Mode d'authentification</Text>
                <SegmentedControl
                  fullWidth
                  data={[
                    { label: 'Mot de passe', value: 'password' },
                    { label: 'Token API', value: 'token' },
                  ]}
                  value={form.values.proxmoxAuthMode}
                  onChange={(val) => form.setFieldValue('proxmoxAuthMode', val as 'password' | 'token')}
                />
              </div>

              {form.values.proxmoxAuthMode === 'password' ? (
                <>
                  <TextInput
                    label="Utilisateur Proxmox"
                    placeholder="ex: root@pam"
                    {...form.getInputProps('proxmoxUsername')}
                  />
                  <PasswordInput
                    label="Mot de passe Proxmox"
                    placeholder="Laisser vide pour ne pas modifier"
                    {...form.getInputProps('proxmoxPassword')}
                  />
                </>
              ) : (
                <>
                  <TextInput
                    label="Token ID"
                    placeholder="ex: root@pam!mytoken"
                    {...form.getInputProps('proxmoxTokenId')}
                  />
                  <PasswordInput
                    label="Token Secret"
                    placeholder="Laisser vide pour ne pas modifier"
                    {...form.getInputProps('proxmoxTokenSecret')}
                  />
                </>
              )}
            </>
          )}

          <Group justify="flex-end" mt="sm">
            <Button
              leftSection={<IconDeviceFloppy size={16} />}
              onClick={handleSave}
              loading={updateService.isPending}
            >
              Enregistrer
            </Button>
          </Group>
        </Stack>
      </Paper>

      {/* Danger zone — all service types */}
      <Paper withBorder p="md" style={{ borderColor: 'var(--mantine-color-red-4)' }}>
        <Title order={5} c="red" mb="xs">Zone de danger</Title>
        <Divider mb="md" />
        <Group justify="space-between" align="center">
          <div>
            <Text size="sm" fw={500}>Supprimer ce service</Text>
            <Text size="xs" c="dimmed">
              {childServices.length > 0
                ? `Cette action supprimera également ${childServices.length} service(s) enfant(s)`
                : 'Cette action est irréversible'}
            </Text>
          </div>
          <Button
            color="red"
            variant="outline"
            leftSection={<IconTrash size={16} />}
            onClick={() => setDeleteModalOpened(true)}
          >
            Supprimer
          </Button>
        </Group>
      </Paper>

      {/* Delete confirmation modal */}
      <Modal
        opened={deleteModalOpened}
        onClose={() => setDeleteModalOpened(false)}
        title="Confirmer la suppression"
        centered
      >
        <Stack gap="md">
          <Text>
            Voulez-vous vraiment supprimer le service <strong>{service.name}</strong> ?
            {childServices.length > 0 && (
              <> Cela supprimera également {childServices.length} service(s) enfant(s).</>
            )}
            {' '}Cette action est irréversible.
          </Text>
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setDeleteModalOpened(false)}>
              Annuler
            </Button>
            <Button color="red" onClick={handleDelete} loading={deleteService.isPending}>
              Supprimer
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Container>
  );
}
