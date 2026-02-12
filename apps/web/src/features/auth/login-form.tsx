import { TextInput, PasswordInput, Checkbox, Button, Stack, Anchor } from '@mantine/core';
import { useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import { useNavigate, Link } from 'react-router';
import { useLogin } from '../../api/auth.api';

export function LoginForm() {
  const navigate = useNavigate();
  const loginMutation = useLogin();

  const form = useForm({
    initialValues: {
      username: '',
      password: '',
      rememberMe: false,
    },
    validate: {
      username: (value) => {
        if (!value || value.length < 3) {
          return "Le nom d'utilisateur doit faire au moins 3 caractères";
        }
        return null;
      },
      password: (value) => {
        if (!value || value.length < 1) {
          return 'Mot de passe requis';
        }
        return null;
      },
    },
  });

  const handleSubmit = form.onSubmit(async (values) => {
    try {
      await loginMutation.mutateAsync(values);

      notifications.show({
        title: 'Connexion réussie',
        message: 'Bienvenue sur WakeHub',
        color: 'green',
      });

      navigate('/');
    } catch (error) {
      const apiError = error as { error?: { code?: string; message?: string } };

      notifications.show({
        title: 'Erreur',
        message: apiError.error?.message || 'Identifiants incorrects',
        color: 'red',
      });
    }
  });

  return (
    <form onSubmit={handleSubmit}>
      <Stack gap="md">
        <TextInput
          label="Nom d'utilisateur"
          placeholder="Entrez votre nom d'utilisateur"
          required
          {...form.getInputProps('username')}
        />

        <PasswordInput
          label="Mot de passe"
          placeholder="Entrez votre mot de passe"
          required
          {...form.getInputProps('password')}
        />

        <Checkbox
          label="Se souvenir de moi"
          {...form.getInputProps('rememberMe', { type: 'checkbox' })}
        />

        <Button
          type="submit"
          fullWidth
          loading={loginMutation.isPending}
          mt="md"
        >
          Se connecter
        </Button>

        <Anchor component={Link} to="/forgot-password" size="sm" ta="center" mt="sm">
          Mot de passe oublié ?
        </Anchor>
      </Stack>
    </form>
  );
}
