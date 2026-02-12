import { Container, Paper, Title, Text, Stack } from '@mantine/core';
import { LoginForm } from './login-form';

export function LoginPage() {
  return (
    <Container size="sm" style={{ marginTop: '80px' }}>
      <Paper shadow="md" p="xl" radius="md">
        <Stack gap="lg">
          <div>
            <Title order={1} size="h2" mb="xs">
              Connexion
            </Title>
            <Text c="dimmed" size="sm">
              Connectez-vous pour accéder à votre homelab
            </Text>
          </div>

          <LoginForm />
        </Stack>
      </Paper>
    </Container>
  );
}
