import { useState, useCallback } from 'react';
import { Container, Title, Paper, Text, Button, Center, Loader, Stack, Modal, Group } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconLink, IconServer } from '@tabler/icons-react';
import { useNavigate } from 'react-router';
import { useDependencyGraph, useDeleteDependency } from '../../api/dependencies.api';
import { DependencyGraph } from './dependency-graph';

export function DependenciesPage() {
  const navigate = useNavigate();
  const { data, isLoading, isError } = useDependencyGraph();
  const deleteDep = useDeleteDependency();
  const [deleteEdgeId, setDeleteEdgeId] = useState<string | null>(null);

  const nodes = data?.data.nodes ?? [];
  const edges = data?.data.edges ?? [];
  const isEmpty = nodes.length === 0;

  const handleDeleteEdge = useCallback((edgeId: string) => {
    setDeleteEdgeId(edgeId);
  }, []);

  return (
    <Container size="xl" py="md">
      <Title order={2} mb="md">
        Dépendances
      </Title>

      {isLoading && (
        <Center py="xl">
          <Loader />
        </Center>
      )}

      {isError && (
        <Paper withBorder p="lg">
          <Text c="red">Erreur lors du chargement du graphe de dépendances.</Text>
        </Paper>
      )}

      {!isLoading && !isError && isEmpty && (
        <Paper withBorder p="xl">
          <Center>
            <Stack align="center" gap="md">
              <IconLink size={48} color="var(--mantine-color-gray-5)" />
              <Text c="dimmed" ta="center">
                Aucune dépendance définie. Ajoutez des dépendances depuis la page
                de détail d&apos;un service.
              </Text>
              <Button
                variant="light"
                leftSection={<IconServer size={16} />}
                onClick={() => navigate('/services')}
              >
                Voir les services
              </Button>
            </Stack>
          </Center>
        </Paper>
      )}

      {!isLoading && !isError && !isEmpty && (
        <Paper withBorder style={{ height: 'calc(100vh - 180px)' }}>
          <DependencyGraph graphNodes={nodes} graphEdges={edges} onDeleteEdge={handleDeleteEdge} />
        </Paper>
      )}

      {/* Delete edge confirmation modal */}
      <Modal
        opened={!!deleteEdgeId}
        onClose={() => setDeleteEdgeId(null)}
        title="Supprimer la dépendance"
        centered
      >
        <Stack gap="md">
          <Text>Voulez-vous vraiment supprimer ce lien de dépendance ?</Text>
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setDeleteEdgeId(null)}>
              Annuler
            </Button>
            <Button
              color="red"
              loading={deleteDep.isPending}
              onClick={() => {
                if (!deleteEdgeId) return;
                deleteDep.mutate(deleteEdgeId, {
                  onSuccess: () => {
                    notifications.show({
                      title: 'Dépendance supprimée',
                      message: 'Le lien a été supprimé',
                      color: 'green',
                    });
                    setDeleteEdgeId(null);
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
      </Modal>
    </Container>
  );
}
