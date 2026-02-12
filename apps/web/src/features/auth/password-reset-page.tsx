import { Container, Paper, Title, Text, Stack } from '@mantine/core';
import { PasswordResetForm } from './password-reset-form';

export function PasswordResetPage() {
  return (
    <Container size="sm" style={{ marginTop: '80px' }}>
      <Paper shadow="md" p="xl" radius="md">
        <Stack gap="lg">
          <div>
            <Title order={1} size="h2" mb="xs">
              Réinitialiser le mot de passe
            </Title>
            <Text c="dimmed" size="sm">
              Répondez à votre question de sécurité pour réinitialiser votre mot de passe
            </Text>
          </div>

          <PasswordResetForm />
        </Stack>
      </Paper>
    </Container>
  );
}
