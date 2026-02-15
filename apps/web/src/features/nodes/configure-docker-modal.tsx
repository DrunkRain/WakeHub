import { Modal, TextInput, Button, Stack, NumberInput, Text } from '@mantine/core';
import { useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import { useConfigureDocker } from '../../api/nodes.api';

interface Props {
  nodeId: string;
  opened: boolean;
  onClose: () => void;
}

export function ConfigureDockerModal({ nodeId, opened, onClose }: Props) {
  const configureDocker = useConfigureDocker();

  const form = useForm({
    initialValues: {
      host: '',
      port: 2375,
    },
    validate: {
      host: (v) => (v.trim().length === 0 ? 'Hote requis' : null),
    },
  });

  const handleSubmit = form.onSubmit(async (values) => {
    try {
      const result = await configureDocker.mutateAsync({
        nodeId,
        data: {
          host: values.host,
          port: values.port,
        },
      });

      const discoveredCount = result.data.discovered.length;
      notifications.show({
        title: 'Docker configure',
        message: `Connexion reussie ! ${discoveredCount} conteneur(s) decouvert(s).`,
        color: 'green',
      });

      form.reset();
      onClose();
    } catch (error) {
      const err = error as { error?: { message?: string } };
      notifications.show({
        title: 'Erreur de connexion',
        message: err.error?.message ?? 'Impossible de se connecter a Docker',
        color: 'red',
      });
    }
  });

  return (
    <Modal opened={opened} onClose={onClose} title="Configurer Docker" size="md">
      <form onSubmit={handleSubmit}>
        <Stack gap="sm">
          <TextInput
            label="Hote Docker"
            placeholder="192.168.1.100"
            required
            {...form.getInputProps('host')}
          />

          <NumberInput
            label="Port"
            min={1}
            max={65535}
            {...form.getInputProps('port')}
          />

          <Button
            type="submit"
            loading={configureDocker.isPending}
            fullWidth
            mt="sm"
          >
            Tester & Sauvegarder
          </Button>

          {configureDocker.isError && (
            <Text c="red" size="sm" ta="center">
              {(configureDocker.error as { error?: { message?: string } })?.error?.message ?? 'Erreur de connexion'}
            </Text>
          )}
        </Stack>
      </form>
    </Modal>
  );
}
