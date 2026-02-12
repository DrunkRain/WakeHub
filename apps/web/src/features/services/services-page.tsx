import { useState } from 'react';
import { Container, Group, Title, Button, Skeleton, Stack, Text, Center } from '@mantine/core';
import { IconServer, IconPlus, IconFilterOff } from '@tabler/icons-react';
import { EmptyState } from '../../components/shared/empty-state';
import { ServiceWizard } from './service-wizard';
import { ServicesTable } from './services-table';
import { ServicesFilters } from './services-filters';
import { useServicesTable } from './use-services-table';
import { useServices } from '../../api/services.api';

function LoadingSkeleton() {
  return (
    <Stack gap="md">
      <Group gap="xs">
        <Skeleton height={28} width={80} radius="xl" />
        <Skeleton height={28} width={80} radius="xl" />
        <Skeleton height={28} width={80} radius="xl" />
        <Skeleton height={28} width={90} radius="xl" />
        <Skeleton height={28} width={80} radius="xl" />
      </Group>
      <Stack gap="xs">
        {Array.from({ length: 5 }, (_, i) => (
          <Skeleton key={i} height={44} radius="sm" />
        ))}
      </Stack>
    </Stack>
  );
}

export function ServicesPage() {
  const [wizardOpened, setWizardOpened] = useState(false);
  const { data, isLoading } = useServices();

  const services = data?.data ?? [];
  const {
    sortField,
    sortDirection,
    toggleSort,
    statusFilters,
    setStatusFilters,
    typeFilters,
    setTypeFilters,
    filteredServices,
    hasActiveFilters,
  } = useServicesTable(services);

  if (isLoading) {
    return (
      <Container size="xl" py="xl">
        <Group justify="space-between" mb="lg">
          <Title order={2}>Services</Title>
        </Group>
        <LoadingSkeleton />
      </Container>
    );
  }

  if (services.length === 0) {
    return (
      <Container size="xl" py="xl">
        <ServiceWizard opened={wizardOpened} onClose={() => setWizardOpened(false)} />
        <EmptyState
          icon={IconServer}
          title="Aucun service configuré"
          description="Ajoutez vos machines physiques, serveurs Proxmox ou hôtes Docker pour commencer."
          action={{
            label: 'Ajouter un service',
            onClick: () => setWizardOpened(true),
          }}
        />
      </Container>
    );
  }

  return (
    <Container size="xl" py="xl">
      <ServiceWizard opened={wizardOpened} onClose={() => setWizardOpened(false)} />

      <Group justify="space-between" mb="lg">
        <Title order={2}>Services</Title>
        <Button leftSection={<IconPlus size={16} />} onClick={() => setWizardOpened(true)}>
          Ajouter un service
        </Button>
      </Group>

      <Stack gap="md">
        <ServicesFilters
          statusFilters={statusFilters}
          onStatusChange={setStatusFilters}
          typeFilters={typeFilters}
          onTypeChange={setTypeFilters}
        />

        {filteredServices.length === 0 && hasActiveFilters ? (
          <Center py="xl">
            <Stack align="center" gap="sm">
              <IconFilterOff size={40} stroke={1.5} color="var(--mantine-color-dimmed)" />
              <Text c="dimmed" ta="center">
                Aucun service ne correspond aux filtres
              </Text>
            </Stack>
          </Center>
        ) : (
          <ServicesTable
            services={filteredServices}
            sortField={sortField}
            sortDirection={sortDirection}
            onSort={toggleSort}
          />
        )}
      </Stack>
    </Container>
  );
}
