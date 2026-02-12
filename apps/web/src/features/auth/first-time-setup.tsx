import { Container, Paper, Title, Text, Stack, Loader, Center } from '@mantine/core';
import { Navigate } from 'react-router';
import { RegisterForm } from './register-form';
import { useCheckSetup } from '../../api/auth.api';

export function FirstTimeSetup() {
  const { data: setupData, isLoading } = useCheckSetup();

  if (isLoading) {
    return (
      <Center style={{ height: '100vh' }}>
        <Loader size="lg" />
      </Center>
    );
  }

  if (setupData?.data.setupComplete) {
    return <Navigate to="/login" replace />;
  }

  return (
    <Container size="sm" style={{ marginTop: '80px' }}>
      <Paper shadow="md" p="xl" radius="md">
        <Stack gap="lg">
          <div>
            <Title order={1} size="h2" mb="xs">
              Bienvenue sur WakeHub
            </Title>
            <Text c="dimmed" size="sm">
              Commençons par créer votre compte administrateur
            </Text>
          </div>

          <RegisterForm />

          <Text c="dimmed" size="xs" ta="center">
            Ce compte sera utilisé pour accéder à WakeHub et gérer votre infrastructure.
          </Text>
        </Stack>
      </Paper>
    </Container>
  );
}
