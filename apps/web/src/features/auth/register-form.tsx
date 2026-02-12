import { TextInput, PasswordInput, Select, Button, Stack } from '@mantine/core';
import { useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import { useNavigate } from 'react-router';
import { useRegister } from '../../api/auth.api';

const SECURITY_QUESTIONS = [
  'Quel est le nom de votre premier animal de compagnie ?',
  'Dans quelle ville êtes-vous né(e) ?',
  'Quel est le nom de jeune fille de votre mère ?',
  'Quel était le modèle de votre première voiture ?',
  'Quel est le nom de votre école primaire ?',
];

export function RegisterForm() {
  const navigate = useNavigate();
  const registerMutation = useRegister();

  const form = useForm({
    initialValues: {
      username: '',
      password: '',
      passwordConfirm: '',
      securityQuestion: '',
      securityAnswer: '',
    },
    validate: {
      username: (value) => {
        if (!value || value.length < 3) {
          return 'Le nom d\'utilisateur doit faire au moins 3 caractères';
        }
        return null;
      },
      password: (value) => {
        if (!value || value.length < 8) {
          return 'Le mot de passe doit faire au moins 8 caractères';
        }
        return null;
      },
      passwordConfirm: (value, values) => {
        if (value !== values.password) {
          return 'Les mots de passe ne correspondent pas';
        }
        return null;
      },
      securityQuestion: (value) => {
        if (!value) {
          return 'Veuillez sélectionner une question de sécurité';
        }
        return null;
      },
      securityAnswer: (value) => {
        if (!value || value.length < 1) {
          return 'Veuillez fournir une réponse';
        }
        return null;
      },
    },
  });

  const handleSubmit = form.onSubmit(async (values) => {
    try {
      await registerMutation.mutateAsync(values);

      notifications.show({
        title: 'Compte créé',
        message: 'Votre compte a été créé avec succès !',
        color: 'green',
      });

      // Redirect to dashboard
      navigate('/');
    } catch (error) {
      const apiError = error as { error?: { code?: string; message?: string } };

      notifications.show({
        title: 'Erreur',
        message: apiError.error?.message || 'Une erreur est survenue lors de la création du compte',
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
          description="Au moins 8 caractères"
          {...form.getInputProps('password')}
        />

        <PasswordInput
          label="Confirmation du mot de passe"
          placeholder="Confirmez votre mot de passe"
          required
          {...form.getInputProps('passwordConfirm')}
        />

        <Select
          label="Question de sécurité"
          placeholder="Sélectionnez une question"
          required
          data={SECURITY_QUESTIONS}
          {...form.getInputProps('securityQuestion')}
        />

        <TextInput
          label="Réponse à la question de sécurité"
          placeholder="Entrez votre réponse"
          required
          {...form.getInputProps('securityAnswer')}
        />

        <Button
          type="submit"
          fullWidth
          loading={registerMutation.isPending}
          mt="md"
        >
          Créer mon compte
        </Button>
      </Stack>
    </form>
  );
}
