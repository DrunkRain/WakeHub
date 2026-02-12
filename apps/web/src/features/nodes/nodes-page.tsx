import { useState } from 'react';
import { Container, Title, Text, Stack, Group, Button, Center } from '@mantine/core';
import { IconServer, IconPlus } from '@tabler/icons-react';
import { useNodes } from '../../api/nodes.api';
import { AddMachineWizard } from './add-machine-wizard';

export function NodesPage() {
  const [wizardOpened, setWizardOpened] = useState(false);
  const { data, isLoading } = useNodes();

  const nodes = data?.data.nodes ?? [];

  return (
    <Container size="lg" py="xl">
      <Stack gap="md">
        <Group justify="space-between">
          <Title order={1}>Noeuds</Title>
          <Button
            leftSection={<IconPlus size={18} />}
            onClick={() => setWizardOpened(true)}
            aria-label="Ajouter une machine"
          >
            Ajouter
          </Button>
        </Group>

        {isLoading && <Text c="dimmed">Chargement...</Text>}

        {!isLoading && nodes.length === 0 && (
          <Center py="xl">
            <Stack align="center" gap="sm">
              <IconServer size={48} color="gray" />
              <Text c="dimmed" ta="center">
                Aucun noeud configuré. Ajoutez votre première machine pour commencer.
              </Text>
              <Button
                variant="light"
                leftSection={<IconPlus size={16} />}
                onClick={() => setWizardOpened(true)}
              >
                Ajouter une machine
              </Button>
            </Stack>
          </Center>
        )}

        {!isLoading && nodes.length > 0 && (
          <Stack gap="xs">
            {nodes.map((node) => (
              <Group key={node.id} p="sm" style={{ border: '1px solid var(--mantine-color-dark-4)', borderRadius: 'var(--mantine-radius-sm)' }}>
                <IconServer size={20} />
                <div>
                  <Text fw={500}>{node.name}</Text>
                  <Text size="sm" c="dimmed">{node.ipAddress ?? 'Pas d\'adresse IP'} — {node.status}</Text>
                </div>
              </Group>
            ))}
          </Stack>
        )}
      </Stack>

      <AddMachineWizard
        opened={wizardOpened}
        onClose={() => setWizardOpened(false)}
      />
    </Container>
  );
}
