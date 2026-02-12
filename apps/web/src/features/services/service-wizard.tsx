import { useState } from 'react';
import {
  Stepper,
  Button,
  Group,
  TextInput,
  PasswordInput,
  Paper,
  Text,
  Stack,
  Modal,
  Alert,
  Loader,
  UnstyledButton,
  SegmentedControl,
  Checkbox,
  Badge,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import {
  IconServer,
  IconCloud,
  IconBrandDocker,
  IconCheck,
  IconX,
  IconAlertTriangle,
} from '@tabler/icons-react';
import {
  useCreateService,
  useTestConnection,
  useDiscoverProxmox,
  useDiscoverDocker,
  useSaveResources,
  type DiscoveredResource,
} from '../../api/services.api';

interface ServiceWizardProps {
  opened: boolean;
  onClose: () => void;
}

type ServiceType = 'physical' | 'proxmox' | 'docker';

const SERVICE_TYPES: { type: ServiceType; label: string; description: string; icon: typeof IconServer; disabled: boolean }[] = [
  {
    type: 'physical',
    label: 'Machine physique',
    description: 'WoL + SSH — Démarrage et arrêt via Wake-on-LAN et SSH',
    icon: IconServer,
    disabled: false,
  },
  {
    type: 'proxmox',
    label: 'Serveur Proxmox',
    description: 'API Proxmox — Gestion des VMs et conteneurs',
    icon: IconCloud,
    disabled: false,
  },
  {
    type: 'docker',
    label: 'Hôte Docker',
    description: 'API Docker — Gestion des conteneurs',
    icon: IconBrandDocker,
    disabled: false,
  },
];

const STATUS_COLORS: Record<string, string> = {
  running: 'green',
  stopped: 'red',
  paused: 'yellow',
  unknown: 'gray',
  error: 'orange',
};

const STATUS_LABELS: Record<string, string> = {
  running: 'En cours',
  stopped: 'Arrêtée',
  paused: 'En pause',
  unknown: 'Inconnu',
  error: 'Erreur',
};

export function ServiceWizard({ opened, onClose }: ServiceWizardProps) {
  const [active, setActive] = useState(0);
  const [selectedType, setSelectedType] = useState<ServiceType | null>(null);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [discoveredVMs, setDiscoveredVMs] = useState<DiscoveredResource[]>([]);
  const [selectedVMs, setSelectedVMs] = useState<number[]>([]);

  const createService = useCreateService();
  const testConnection = useTestConnection();
  const discoverProxmox = useDiscoverProxmox();
  const discoverDocker = useDiscoverDocker();
  const saveResources = useSaveResources();

  const form = useForm({
    initialValues: {
      // Common
      name: '',
      ipAddress: '',
      // Physical
      macAddress: '',
      sshUser: '',
      sshPassword: '',
      // Proxmox / Docker
      apiUrl: '',
      proxmoxAuthMode: 'password' as 'password' | 'token',
      proxmoxUsername: '',
      proxmoxPassword: '',
      proxmoxTokenId: '',
      proxmoxTokenSecret: '',
    },
    validate: (values) => {
      const errors: Record<string, string | null> = {};

      if (!values.name.trim()) errors.name = 'Le nom est requis';

      if (selectedType === 'physical') {
        if (!values.ipAddress.trim()) errors.ipAddress = "L'adresse IP est requise";
        if (!values.macAddress.trim()) errors.macAddress = "L'adresse MAC est requise pour le WoL";
        if (!values.sshUser.trim()) errors.sshUser = "L'utilisateur SSH est requis";
        if (!values.sshPassword.trim()) errors.sshPassword = 'Le mot de passe SSH est requis';
      }

      if (selectedType === 'proxmox') {
        if (!values.apiUrl.trim()) errors.apiUrl = "L'URL de l'API est requise";
        if (values.proxmoxAuthMode === 'password') {
          if (!values.proxmoxUsername.trim()) errors.proxmoxUsername = "L'utilisateur est requis";
          if (!values.proxmoxPassword.trim()) errors.proxmoxPassword = 'Le mot de passe est requis';
        } else {
          if (!values.proxmoxTokenId.trim()) errors.proxmoxTokenId = "L'ID du token est requis";
          if (!values.proxmoxTokenSecret.trim()) errors.proxmoxTokenSecret = 'Le secret du token est requis';
        }
      }

      if (selectedType === 'docker') {
        if (!values.apiUrl.trim()) errors.apiUrl = "L'URL de l'API Docker est requise";
      }

      return errors;
    },
  });

  const handleClose = () => {
    setActive(0);
    setSelectedType(null);
    setTestResult(null);
    setDiscoveredVMs([]);
    setSelectedVMs([]);
    form.reset();
    createService.reset();
    testConnection.reset();
    discoverProxmox.reset();
    discoverDocker.reset();
    saveResources.reset();
    onClose();
  };

  const handleSelectType = (type: ServiceType) => {
    setSelectedType(type);
    setActive(1);
  };

  // --- Physical flow ---

  const handleNextToTest = () => {
    const validation = form.validate();
    if (validation.hasErrors) return;

    setActive(2);
    setTestResult(null);

    if (selectedType === 'physical') {
      testConnection.mutate(
        {
          host: form.values.ipAddress,
          sshUser: form.values.sshUser,
          sshPassword: form.values.sshPassword,
        },
        {
          onSuccess: (data) => setTestResult(data.data),
          onError: (error) => setTestResult({
            success: false,
            message: error.error?.message || 'Erreur lors du test de connexion',
          }),
        },
      );
    } else if (selectedType === 'proxmox') {
      const payload = form.values.proxmoxAuthMode === 'token'
        ? {
            type: 'proxmox' as const,
            apiUrl: form.values.apiUrl,
            authMode: 'token' as const,
            tokenId: form.values.proxmoxTokenId,
            tokenSecret: form.values.proxmoxTokenSecret,
          }
        : {
            type: 'proxmox' as const,
            apiUrl: form.values.apiUrl,
            authMode: 'password' as const,
            username: form.values.proxmoxUsername,
            password: form.values.proxmoxPassword,
          };

      testConnection.mutate(payload, {
        onSuccess: (data) => setTestResult(data.data),
        onError: (error) => setTestResult({
          success: false,
          message: error.error?.message || 'Erreur lors du test de connexion',
        }),
      });
    } else if (selectedType === 'docker') {
      testConnection.mutate(
        {
          type: 'docker' as const,
          apiUrl: form.values.apiUrl,
        },
        {
          onSuccess: (data) => setTestResult(data.data),
          onError: (error) => setTestResult({
            success: false,
            message: error.error?.message || 'Erreur lors du test de connexion',
          }),
        },
      );
    }
  };

  const handleRetryTest = () => {
    setTestResult(null);
    if (selectedType === 'physical') {
      testConnection.mutate(
        {
          host: form.values.ipAddress,
          sshUser: form.values.sshUser,
          sshPassword: form.values.sshPassword,
        },
        {
          onSuccess: (data) => setTestResult(data.data),
          onError: (error) => setTestResult({
            success: false,
            message: error.error?.message || 'Erreur lors du test de connexion',
          }),
        },
      );
    } else {
      handleNextToTest();
    }
  };

  // --- Resource discovery (step 4) ---

  const handleDiscoverVMs = () => {
    setActive(3);
    setDiscoveredVMs([]);
    setSelectedVMs([]);

    if (selectedType === 'docker') {
      discoverDocker.mutate(
        { apiUrl: form.values.apiUrl },
        {
          onSuccess: (data) => {
            setDiscoveredVMs(data.data);
            setSelectedVMs(data.data.map((_, i) => i));
          },
          onError: (error) => {
            notifications.show({
              title: 'Erreur de découverte',
              message: error.error?.message || 'Impossible de découvrir les conteneurs',
              color: 'red',
            });
          },
        },
      );
      return;
    }

    const payload = form.values.proxmoxAuthMode === 'token'
      ? {
          apiUrl: form.values.apiUrl,
          authMode: 'token' as const,
          tokenId: form.values.proxmoxTokenId,
          tokenSecret: form.values.proxmoxTokenSecret,
        }
      : {
          apiUrl: form.values.apiUrl,
          authMode: 'password' as const,
          username: form.values.proxmoxUsername,
          password: form.values.proxmoxPassword,
        };

    discoverProxmox.mutate(payload, {
      onSuccess: (data) => {
        setDiscoveredVMs(data.data);
        // Select all by default
        setSelectedVMs(data.data.map((_, i) => i));
      },
      onError: (error) => {
        notifications.show({
          title: 'Erreur de découverte',
          message: error.error?.message || 'Impossible de découvrir les VMs',
          color: 'red',
        });
      },
    });
  };

  const toggleVM = (index: number) => {
    setSelectedVMs((prev) =>
      prev.includes(index) ? prev.filter((i) => i !== index) : [...prev, index],
    );
  };

  // --- Create handlers ---

  const handleCreatePhysical = (force = false) => {
    if (!force && testResult && !testResult.success) return;

    createService.mutate(
      {
        name: form.values.name,
        type: 'physical',
        ipAddress: form.values.ipAddress,
        macAddress: form.values.macAddress,
        sshUser: form.values.sshUser,
        sshPassword: form.values.sshPassword,
      },
      {
        onSuccess: () => {
          notifications.show({
            title: 'Service ajouté',
            message: `${form.values.name} a été ajouté avec succès`,
            color: 'green',
            autoClose: 5000,
          });
          handleClose();
        },
        onError: (error) => {
          notifications.show({
            title: 'Erreur',
            message: error.error?.message || "Impossible d'ajouter le service",
            color: 'red',
          });
        },
      },
    );
  };

  const handleCreateProxmox = () => {
    const selectedResources = selectedVMs.map((i) => discoveredVMs[i]!);

    // Build apiCredentials JSON
    const apiCredentials = form.values.proxmoxAuthMode === 'token'
      ? JSON.stringify({
          tokenId: form.values.proxmoxTokenId,
          tokenSecret: form.values.proxmoxTokenSecret,
        })
      : JSON.stringify({
          username: form.values.proxmoxUsername,
          password: form.values.proxmoxPassword,
        });

    // Extract IP from apiUrl for ipAddress field
    let ipAddress = form.values.apiUrl;
    try {
      const url = new URL(form.values.apiUrl);
      ipAddress = url.hostname;
    } catch {
      // Keep the full URL as fallback
    }

    createService.mutate(
      {
        name: form.values.name,
        type: 'proxmox',
        ipAddress,
        macAddress: form.values.macAddress || undefined,
        apiUrl: form.values.apiUrl,
        apiCredentials,
      },
      {
        onSuccess: (data) => {
          const parentId = data.data.id;

          if (selectedResources.length > 0) {
            saveResources.mutate(
              { parentId, resources: selectedResources },
              {
                onSuccess: () => {
                  notifications.show({
                    title: 'Serveur Proxmox ajouté',
                    message: `${form.values.name} ajouté avec ${selectedResources.length} VM(s)`,
                    color: 'green',
                    autoClose: 5000,
                  });
                  handleClose();
                },
                onError: (error) => {
                  notifications.show({
                    title: 'Erreur',
                    message: error.error?.message || 'Service créé mais erreur lors de la sauvegarde des VMs',
                    color: 'orange',
                  });
                  handleClose();
                },
              },
            );
          } else {
            notifications.show({
              title: 'Serveur Proxmox ajouté',
              message: `${form.values.name} ajouté sans VMs`,
              color: 'green',
              autoClose: 5000,
            });
            handleClose();
          }
        },
        onError: (error) => {
          notifications.show({
            title: 'Erreur',
            message: error.error?.message || "Impossible d'ajouter le serveur",
            color: 'red',
          });
        },
      },
    );
  };

  const handleCreateDocker = () => {
    const selectedResources = selectedVMs.map((i) => discoveredVMs[i]!);

    // Extract IP from apiUrl for ipAddress field
    let ipAddress = form.values.apiUrl;
    try {
      const url = new URL(form.values.apiUrl);
      ipAddress = url.hostname;
    } catch {
      // Keep the full URL as fallback
    }

    createService.mutate(
      {
        name: form.values.name,
        type: 'docker',
        ipAddress,
        apiUrl: form.values.apiUrl,
      },
      {
        onSuccess: (data) => {
          const parentId = data.data.id;

          if (selectedResources.length > 0) {
            saveResources.mutate(
              { parentId, resources: selectedResources },
              {
                onSuccess: () => {
                  notifications.show({
                    title: 'Hôte Docker ajouté',
                    message: `${form.values.name} ajouté avec ${selectedResources.length} conteneur(s)`,
                    color: 'green',
                    autoClose: 5000,
                  });
                  handleClose();
                },
                onError: (error) => {
                  notifications.show({
                    title: 'Erreur',
                    message: error.error?.message || 'Service créé mais erreur lors de la sauvegarde des conteneurs',
                    color: 'orange',
                  });
                  handleClose();
                },
              },
            );
          } else {
            notifications.show({
              title: 'Hôte Docker ajouté',
              message: `${form.values.name} ajouté sans conteneurs`,
              color: 'green',
              autoClose: 5000,
            });
            handleClose();
          }
        },
        onError: (error) => {
          notifications.show({
            title: 'Erreur',
            message: error.error?.message || "Impossible d'ajouter l'hôte Docker",
            color: 'red',
          });
        },
      },
    );
  };

  return (
    <Modal
      opened={opened}
      onClose={handleClose}
      title="Ajouter un service"
      size="lg"
      centered
    >
      <Stepper active={active} onStepClick={setActive} allowNextStepsSelect={false}>
        {/* Step 1: Service type selection */}
        <Stepper.Step label="Type" description="Choisir le type">
          <Stack gap="md" mt="md">
            {SERVICE_TYPES.map((mt) => (
              <UnstyledButton
                key={mt.type}
                onClick={() => !mt.disabled && handleSelectType(mt.type)}
                style={{ opacity: mt.disabled ? 0.5 : 1, cursor: mt.disabled ? 'not-allowed' : 'pointer' }}
              >
                <Paper withBorder p="md" radius="md">
                  <Group>
                    <mt.icon size={32} stroke={1.5} />
                    <div>
                      <Text fw={600}>{mt.label}</Text>
                      <Text size="sm" c="dimmed">
                        {mt.description}
                        {mt.disabled && ' (bientôt disponible)'}
                      </Text>
                    </div>
                  </Group>
                </Paper>
              </UnstyledButton>
            ))}
          </Stack>
        </Stepper.Step>

        {/* Step 2: Configuration form */}
        <Stepper.Step label="Configuration" description="Paramètres">
          <Stack gap="md" mt="md">
            <TextInput
              label="Nom du service"
              placeholder={selectedType === 'proxmox' ? 'ex: PVE Cluster' : selectedType === 'docker' ? 'ex: Docker NAS' : 'ex: Serveur NAS'}
              required
              {...form.getInputProps('name')}
            />

            {selectedType === 'physical' && (
              <>
                <TextInput
                  label="Adresse IP"
                  placeholder="ex: 192.168.1.100"
                  required
                  {...form.getInputProps('ipAddress')}
                />
                <TextInput
                  label="Adresse MAC"
                  placeholder="ex: AA:BB:CC:DD:EE:FF"
                  required
                  {...form.getInputProps('macAddress')}
                />
                <TextInput
                  label="Utilisateur SSH"
                  placeholder="ex: admin"
                  required
                  {...form.getInputProps('sshUser')}
                />
                <PasswordInput
                  label="Mot de passe SSH"
                  placeholder="Mot de passe"
                  required
                  {...form.getInputProps('sshPassword')}
                />
              </>
            )}

            {selectedType === 'proxmox' && (
              <>
                <TextInput
                  label="URL de l'API Proxmox"
                  placeholder="ex: https://192.168.1.10:8006"
                  required
                  {...form.getInputProps('apiUrl')}
                />
                <TextInput
                  label="Adresse MAC (optionnel, pour Wake-on-LAN)"
                  placeholder="ex: AA:BB:CC:DD:EE:FF"
                  {...form.getInputProps('macAddress')}
                />

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
                      required
                      {...form.getInputProps('proxmoxUsername')}
                    />
                    <PasswordInput
                      label="Mot de passe Proxmox"
                      placeholder="Mot de passe"
                      required
                      {...form.getInputProps('proxmoxPassword')}
                    />
                  </>
                ) : (
                  <>
                    <TextInput
                      label="Token ID"
                      placeholder="ex: root@pam!mytoken"
                      required
                      {...form.getInputProps('proxmoxTokenId')}
                    />
                    <PasswordInput
                      label="Token Secret"
                      placeholder="Secret UUID"
                      required
                      {...form.getInputProps('proxmoxTokenSecret')}
                    />
                  </>
                )}
              </>
            )}

            {selectedType === 'docker' && (
              <TextInput
                label="URL de l'API Docker"
                placeholder="ex: http://192.168.1.10:2375"
                required
                {...form.getInputProps('apiUrl')}
              />
            )}

            <Group justify="space-between" mt="md">
              <Button variant="default" onClick={() => setActive(0)}>
                Retour
              </Button>
              <Button onClick={handleNextToTest}>Suivant</Button>
            </Group>
          </Stack>
        </Stepper.Step>

        {/* Step 3: Connection test */}
        <Stepper.Step label="Connexion" description="Test">
          <Stack gap="md" mt="md" align="center">
            {testConnection.isPending && !testResult && (
              <Stack align="center" gap="sm" py="xl">
                <Loader size="lg" />
                <Text c="dimmed">
                  {selectedType === 'proxmox'
                    ? 'Test de connexion Proxmox en cours...'
                    : selectedType === 'docker'
                    ? 'Test de connexion Docker en cours...'
                    : 'Test de connexion SSH en cours...'}
                </Text>
              </Stack>
            )}

            {testResult && testResult.success && (
              <Alert icon={<IconCheck size={16} />} color="green" title="Connexion réussie">
                {testResult.message}
              </Alert>
            )}

            {testResult && !testResult.success && (
              <>
                <Alert icon={<IconX size={16} />} color="red" title="Connexion échouée">
                  {testResult.message}
                </Alert>
                {selectedType === 'physical' && (
                  <Alert
                    icon={<IconAlertTriangle size={16} />}
                    color="yellow"
                    title="Ajouter quand même ?"
                  >
                    Vous pouvez forcer l'ajout du service même si le test a échoué.
                    La connexion pourra être vérifiée ultérieurement.
                  </Alert>
                )}
              </>
            )}

            <Group justify="space-between" w="100%" mt="md">
              <Button variant="default" onClick={() => setActive(1)}>
                Retour
              </Button>
              <Group>
                {testResult && !testResult.success && (
                  <Button variant="outline" onClick={handleRetryTest}>
                    Réessayer
                  </Button>
                )}

                {/* Physical: force add on failure */}
                {selectedType === 'physical' && testResult && !testResult.success && (
                  <Button
                    color="yellow"
                    onClick={() => handleCreatePhysical(true)}
                    loading={createService.isPending}
                  >
                    Forcer l'ajout
                  </Button>
                )}

                {/* Physical: confirm on success */}
                {selectedType === 'physical' && testResult && testResult.success && (
                  <Button
                    onClick={() => handleCreatePhysical()}
                    loading={createService.isPending}
                  >
                    Confirmer l'ajout
                  </Button>
                )}

                {/* Proxmox/Docker: go to resource discovery on success */}
                {(selectedType === 'proxmox' || selectedType === 'docker') && testResult && testResult.success && (
                  <Button onClick={handleDiscoverVMs}>
                    Suivant
                  </Button>
                )}
              </Group>
            </Group>
          </Stack>
        </Stepper.Step>

        {/* Step 4: Resource selection (Proxmox VMs / Docker containers) */}
        {(selectedType === 'proxmox' || selectedType === 'docker') && (
          <Stepper.Step
            label={selectedType === 'docker' ? 'Conteneurs' : 'VMs'}
            description="Sélection"
          >
            <Stack gap="md" mt="md">
              {(discoverProxmox.isPending || discoverDocker.isPending) && (
                <Stack align="center" gap="sm" py="xl">
                  <Loader size="lg" />
                  <Text c="dimmed">
                    {selectedType === 'docker'
                      ? 'Découverte des conteneurs en cours...'
                      : 'Découverte des VMs en cours...'}
                  </Text>
                </Stack>
              )}

              {(discoverProxmox.isError || discoverDocker.isError) && (
                <Alert icon={<IconX size={16} />} color="red" title="Erreur de découverte">
                  {(selectedType === 'docker'
                    ? discoverDocker.error?.error?.message
                    : discoverProxmox.error?.error?.message) || 'Impossible de découvrir les ressources'}
                </Alert>
              )}

              {discoveredVMs.length > 0 && (
                <>
                  <Text size="sm" c="dimmed">
                    {selectedType === 'docker'
                      ? `${discoveredVMs.length} conteneur(s) trouvé(s). Sélectionnez ceux à gérer :`
                      : `${discoveredVMs.length} VM(s) trouvée(s). Sélectionnez celles à gérer :`}
                  </Text>
                  <Stack gap="xs">
                    {discoveredVMs.map((vm, index) => (
                      <Paper
                        key={selectedType === 'docker'
                          ? (vm.platformRef as Record<string, unknown>).containerId as string
                          : `${(vm.platformRef as Record<string, unknown>).node}-${(vm.platformRef as Record<string, unknown>).vmid}`}
                        withBorder p="sm" radius="sm"
                      >
                        <Group justify="space-between">
                          <Group>
                            <Checkbox
                              checked={selectedVMs.includes(index)}
                              onChange={() => toggleVM(index)}
                            />
                            <div>
                              <Text size="sm" fw={500}>{vm.name}</Text>
                              <Text size="xs" c="dimmed">
                                {selectedType === 'docker'
                                  ? `Image: ${(vm.platformRef as Record<string, unknown>).image}`
                                  : `Node: ${(vm.platformRef as Record<string, unknown>).node} — VMID: ${(vm.platformRef as Record<string, unknown>).vmid}`}
                              </Text>
                            </div>
                          </Group>
                          <Badge color={STATUS_COLORS[vm.status] ?? 'gray'} variant="light" size="sm">
                            {STATUS_LABELS[vm.status] ?? vm.status}
                          </Badge>
                        </Group>
                      </Paper>
                    ))}
                  </Stack>
                </>
              )}

              {!discoverProxmox.isPending && !discoverDocker.isPending && discoveredVMs.length === 0
                && !discoverProxmox.isError && !discoverDocker.isError && (
                <Alert color="yellow" title={selectedType === 'docker' ? 'Aucun conteneur trouvé' : 'Aucune VM trouvée'}>
                  {selectedType === 'docker'
                    ? "Aucun conteneur n'a été trouvé sur cet hôte Docker. Vous pouvez quand même ajouter l'hôte."
                    : "Aucune VM n'a été trouvée sur ce serveur Proxmox. Vous pouvez quand même ajouter le serveur."}
                </Alert>
              )}

              <Group justify="space-between" mt="md">
                <Button variant="default" onClick={() => setActive(2)}>
                  Retour
                </Button>
                <Button
                  onClick={selectedType === 'docker' ? handleCreateDocker : handleCreateProxmox}
                  loading={createService.isPending || saveResources.isPending}
                >
                  {selectedType === 'docker'
                    ? selectedVMs.length > 0
                      ? `Ajouter (${selectedVMs.length} conteneur${selectedVMs.length > 1 ? 's' : ''})`
                      : 'Ajouter sans conteneurs'
                    : selectedVMs.length > 0
                    ? `Ajouter (${selectedVMs.length} VM${selectedVMs.length > 1 ? 's' : ''})`
                    : 'Ajouter sans VMs'}
                </Button>
              </Group>
            </Stack>
          </Stepper.Step>
        )}
      </Stepper>
    </Modal>
  );
}
