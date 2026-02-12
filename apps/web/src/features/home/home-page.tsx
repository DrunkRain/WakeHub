import { Container, Title, Text, Stack } from '@mantine/core';

export function HomePage() {
  return (
    <Container size="sm" py="xl">
      <Stack gap="md">
        <Title order={1}>Bienvenue sur WakeHub</Title>
        <Text c="dimmed">
          Plateforme de gestion d'infrastructure. Les fonctionnalités de gestion
          des services seront bientôt disponibles.
        </Text>
      </Stack>
    </Container>
  );
}
