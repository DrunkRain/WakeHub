import { Modal, TextInput, Select, Button, Stack, NumberInput, Switch, Text } from '@mantine/core';
import { useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import { useConfigureProxmox } from '../../api/nodes.api';

interface Props {
  nodeId: string;
  opened: boolean;
  onClose: () => void;
}

export function ConfigureProxmoxModal({ nodeId, opened, onClose }: Props) {
  const configureProxmox = useConfigureProxmox();

  const form = useForm({
    initialValues: {
      host: '',
      port: 8006,
      authType: 'token' as 'token' | 'password',
      tokenId: '',
      tokenSecret: '',
      username: '',
      password: '',
      verifySsl: false,
    },
    validate: {
      host: (v) => (v.trim().length === 0 ? 'URL requise' : null),
      tokenId: (v, values) =>
        values.authType === 'token' && v.trim().length === 0 ? 'Token ID requis' : null,
      tokenSecret: (v, values) =>
        values.authType === 'token' && v.trim().length === 0 ? 'Token Secret requis' : null,
      username: (v, values) =>
        values.authType === 'password' && v.trim().length === 0 ? 'Utilisateur requis' : null,
      password: (v, values) =>
        values.authType === 'password' && v.trim().length === 0 ? 'Mot de passe requis' : null,
    },
  });

  const handleSubmit = form.onSubmit(async (values) => {
    try {
      const result = await configureProxmox.mutateAsync({
        nodeId,
        data: {
          host: values.host,
          port: values.port,
          verifySsl: values.verifySsl,
          authType: values.authType,
          ...(values.authType === 'token'
            ? { tokenId: values.tokenId, tokenSecret: values.tokenSecret }
            : { username: values.username, password: values.password }),
        },
      });

      const discoveredCount = result.data.discovered.length;
      notifications.show({
        title: 'Proxmox configure',
        message: `Connexion reussie ! ${discoveredCount} service(s) decouvert(s).`,
        color: 'green',
      });

      form.reset();
      onClose();
    } catch (error) {
      const err = error as { error?: { message?: string } };
      notifications.show({
        title: 'Erreur de connexion',
        message: err.error?.message ?? 'Impossible de se connecter a Proxmox',
        color: 'red',
      });
    }
  });

  return (
    <Modal opened={opened} onClose={onClose} title="Configurer Proxmox" size="md">
      <form onSubmit={handleSubmit}>
        <Stack gap="sm">
          <TextInput
            label="Hote Proxmox"
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

          <Select
            label="Methode d'authentification"
            data={[
              { value: 'token', label: 'Token API' },
              { value: 'password', label: 'Utilisateur / Mot de passe' },
            ]}
            {...form.getInputProps('authType')}
          />

          {form.values.authType === 'token' && (
            <>
              <TextInput
                label="Token ID"
                placeholder="root@pam!monitoring"
                required
                {...form.getInputProps('tokenId')}
              />
              <TextInput
                label="Token Secret"
                placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                type="password"
                required
                {...form.getInputProps('tokenSecret')}
              />
            </>
          )}

          {form.values.authType === 'password' && (
            <>
              <TextInput
                label="Utilisateur"
                placeholder="root@pam"
                required
                {...form.getInputProps('username')}
              />
              <TextInput
                label="Mot de passe"
                type="password"
                required
                {...form.getInputProps('password')}
              />
            </>
          )}

          <Switch
            label="Verifier le certificat SSL"
            {...form.getInputProps('verifySsl', { type: 'checkbox' })}
          />

          <Button
            type="submit"
            loading={configureProxmox.isPending}
            fullWidth
            mt="sm"
          >
            Tester & Sauvegarder
          </Button>

          {configureProxmox.isError && (
            <Text c="red" size="sm" ta="center">
              {(configureProxmox.error as { error?: { message?: string } })?.error?.message ?? 'Erreur de connexion'}
            </Text>
          )}
        </Stack>
      </form>
    </Modal>
  );
}
