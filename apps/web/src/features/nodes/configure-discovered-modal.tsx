import { Modal, TextInput, Button, Stack, Text } from '@mantine/core';
import { useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import { useUpdateNode } from '../../api/nodes.api';

interface DiscoveredNode {
  id: string;
  name: string;
  type: string;
  status: string;
}

interface Props {
  node: DiscoveredNode;
  opened: boolean;
  onClose: () => void;
}

const typeLabels: Record<string, string> = {
  vm: 'VM',
  lxc: 'LXC',
};

export function ConfigureDiscoveredModal({ node, opened, onClose }: Props) {
  const updateNode = useUpdateNode();

  const form = useForm({
    initialValues: {
      name: node.name,
      serviceUrl: '',
    },
    validate: {
      name: (v) => (v.trim().length === 0 ? 'Nom requis' : null),
    },
  });

  const handleSubmit = form.onSubmit(async (values) => {
    try {
      await updateNode.mutateAsync({
        nodeId: node.id,
        data: {
          name: values.name,
          serviceUrl: values.serviceUrl || undefined,
          configured: true,
        },
      });

      notifications.show({
        title: 'Service configure',
        message: `${values.name} a ete configure avec succes.`,
        color: 'green',
      });

      onClose();
    } catch (error) {
      const err = error as { error?: { message?: string } };
      notifications.show({
        title: 'Erreur',
        message: err.error?.message ?? 'Impossible de configurer le service',
        color: 'red',
      });
    }
  });

  return (
    <Modal opened={opened} onClose={onClose} title="Configurer le service" size="sm">
      <form onSubmit={handleSubmit}>
        <Stack gap="sm">
          <Text size="sm" c="dimmed">
            Type : {typeLabels[node.type] ?? node.type} — Statut : {node.status}
          </Text>

          <TextInput
            label="Nom"
            required
            {...form.getInputProps('name')}
          />

          <TextInput
            label="URL du service (optionnel)"
            placeholder="https://service.local:8080"
            {...form.getInputProps('serviceUrl')}
          />

          <Button
            type="submit"
            loading={updateNode.isPending}
            fullWidth
            mt="sm"
          >
            Confirmer
          </Button>
        </Stack>
      </form>
    </Modal>
  );
}
