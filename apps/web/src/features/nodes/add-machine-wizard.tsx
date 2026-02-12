import { useState } from 'react';
import {
  Modal,
  Stepper,
  Button,
  Group,
  TextInput,
  PasswordInput,
  Stack,
  Text,
  Alert,
  Loader,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import { IconCheck, IconX, IconAlertTriangle } from '@tabler/icons-react';
import { useCreateNode, useTestConnection } from '../../api/nodes.api';
import type { CreateNodeRequest } from '../../api/nodes.api';

interface AddMachineWizardProps {
  opened: boolean;
  onClose: () => void;
}

interface MachineFormValues {
  name: string;
  ipAddress: string;
  macAddress: string;
  sshUser: string;
  sshPassword: string;
}

const MAC_REGEX = /^([0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2}$/;
const IP_REGEX = /^(\d{1,3}\.){3}\d{1,3}$/;

export function AddMachineWizard({ opened, onClose }: AddMachineWizardProps) {
  const [active, setActive] = useState(0);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [createdNodeId, setCreatedNodeId] = useState<string | null>(null);

  const createNode = useCreateNode();
  const testConnection = useTestConnection();

  const form = useForm<MachineFormValues>({
    initialValues: {
      name: '',
      ipAddress: '',
      macAddress: '',
      sshUser: '',
      sshPassword: '',
    },
    validate: {
      name: (v) => (v.trim().length === 0 ? 'Le nom est requis' : null),
      ipAddress: (v) => {
        if (!v) return null;
        return IP_REGEX.test(v) ? null : 'Format IP invalide (ex: 192.168.1.10)';
      },
      macAddress: (v) => {
        if (!v) return null;
        return MAC_REGEX.test(v) ? null : 'Format MAC invalide (ex: AA:BB:CC:DD:EE:FF)';
      },
    },
  });

  function handleClose() {
    setActive(0);
    setTestResult(null);
    setCreatedNodeId(null);
    form.reset();
    createNode.reset();
    testConnection.reset();
    onClose();
  }

  async function handleStep1Next() {
    if (form.validate().hasErrors) return;

    // Create the node first so we can test its connection
    const values = form.values;
    const request: CreateNodeRequest = {
      name: values.name.trim(),
      type: 'physical',
      ipAddress: values.ipAddress || undefined,
      macAddress: values.macAddress || undefined,
      sshUser: values.sshUser || undefined,
      sshPassword: values.sshPassword || undefined,
    };

    try {
      const result = await createNode.mutateAsync(request);
      setCreatedNodeId(result.data.node.id);
      setActive(1);

      // Auto-launch connection test
      if (values.ipAddress && values.sshUser) {
        try {
          const testResult = await testConnection.mutateAsync(result.data.node.id);
          setTestResult({ success: testResult.data.success, message: testResult.data.message });
        } catch (err) {
          const errorResponse = err as { error?: { message?: string } };
          setTestResult({
            success: false,
            message: errorResponse?.error?.message ?? 'Erreur de connexion',
          });
        }
      } else {
        setTestResult({ success: false, message: 'Adresse IP ou utilisateur SSH manquant — test impossible' });
      }
    } catch {
      notifications.show({
        title: 'Erreur',
        message: 'Impossible de créer le noeud',
        color: 'red',
      });
    }
  }

  function handleStep2Next() {
    setActive(2);
  }

  async function handleRetryTest() {
    if (!createdNodeId) return;
    setTestResult(null);
    testConnection.reset();

    try {
      const result = await testConnection.mutateAsync(createdNodeId);
      setTestResult({ success: result.data.success, message: result.data.message });
    } catch (err) {
      const errorResponse = err as { error?: { message?: string } };
      setTestResult({
        success: false,
        message: errorResponse?.error?.message ?? 'Erreur de connexion',
      });
    }
  }

  function handleConfirm() {
    notifications.show({
      title: 'Machine ajoutée',
      message: `${form.values.name} a été ajoutée avec succès`,
      color: 'green',
    });
    handleClose();
  }

  return (
    <Modal opened={opened} onClose={handleClose} title="Ajouter une machine" size="lg">
      <Stepper active={active} allowNextStepsSelect={false}>
        <Stepper.Step label="Informations" description="Paramètres machine">
          <Stack gap="md" mt="md">
            <TextInput
              label="Nom"
              placeholder="Mon Serveur"
              required
              {...form.getInputProps('name')}
            />
            <TextInput
              label="Adresse IP"
              placeholder="192.168.1.10"
              {...form.getInputProps('ipAddress')}
            />
            <TextInput
              label="Adresse MAC"
              placeholder="AA:BB:CC:DD:EE:FF"
              {...form.getInputProps('macAddress')}
            />
            <TextInput
              label="Utilisateur SSH"
              placeholder="root"
              {...form.getInputProps('sshUser')}
            />
            <PasswordInput
              label="Mot de passe SSH"
              placeholder="••••••••"
              {...form.getInputProps('sshPassword')}
            />

            <Group justify="flex-end" mt="md">
              <Button variant="default" onClick={handleClose}>
                Annuler
              </Button>
              <Button onClick={handleStep1Next} loading={createNode.isPending}>
                Suivant
              </Button>
            </Group>
          </Stack>
        </Stepper.Step>

        <Stepper.Step label="Test connexion" description="Vérification SSH">
          <Stack gap="md" mt="md">
            {testConnection.isPending && !testResult && (
              <Group gap="sm">
                <Loader size="sm" />
                <Text>Test de connexion en cours...</Text>
              </Group>
            )}

            {testResult?.success && (
              <Alert icon={<IconCheck size={16} />} color="green" title="Connexion réussie">
                {testResult.message}
              </Alert>
            )}

            {testResult && !testResult.success && (
              <>
                <Alert icon={<IconX size={16} />} color="red" title="Connexion échouée">
                  {testResult.message}
                </Alert>
                <Alert icon={<IconAlertTriangle size={16} />} color="yellow" title="Forcer l'ajout">
                  Vous pouvez continuer sans connexion réussie. La machine sera ajoutée mais ne pourra pas être contrôlée tant que la connexion ne sera pas fonctionnelle.
                </Alert>
              </>
            )}

            <Group justify="flex-end" mt="md">
              {testResult && !testResult.success && (
                <Button variant="light" onClick={handleRetryTest} loading={testConnection.isPending}>
                  Réessayer
                </Button>
              )}
              <Button onClick={handleStep2Next}>
                {testResult?.success ? 'Suivant' : 'Forcer l\'ajout'}
              </Button>
            </Group>
          </Stack>
        </Stepper.Step>

        <Stepper.Step label="Confirmation" description="Résumé">
          <Stack gap="md" mt="md">
            <Text fw={500}>Résumé de la machine :</Text>
            <Stack gap="xs">
              <Text size="sm"><strong>Nom :</strong> {form.values.name}</Text>
              <Text size="sm"><strong>IP :</strong> {form.values.ipAddress || 'Non renseignée'}</Text>
              <Text size="sm"><strong>MAC :</strong> {form.values.macAddress || 'Non renseignée'}</Text>
              <Text size="sm"><strong>SSH :</strong> {form.values.sshUser || 'Non renseigné'}</Text>
              <Text size="sm">
                <strong>Test connexion :</strong>{' '}
                {testResult?.success ? '✓ Réussi' : '✗ Échoué ou non testé'}
              </Text>
            </Stack>

            <Group justify="flex-end" mt="md">
              <Button variant="default" onClick={handleClose}>
                Annuler
              </Button>
              <Button color="green" onClick={handleConfirm}>
                Confirmer
              </Button>
            </Group>
          </Stack>
        </Stepper.Step>
      </Stepper>
    </Modal>
  );
}
