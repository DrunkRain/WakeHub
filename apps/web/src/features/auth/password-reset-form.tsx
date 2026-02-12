import { useState } from 'react';
import { TextInput, PasswordInput, Button, Stack, Text, Anchor } from '@mantine/core';
import { useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import { useNavigate, Link } from 'react-router';
import { useGetSecurityQuestion, useResetPassword } from '../../api/auth.api';

export function PasswordResetForm() {
  const navigate = useNavigate();
  const getSecurityQuestionMutation = useGetSecurityQuestion();
  const resetPasswordMutation = useResetPassword();
  const [step, setStep] = useState<1 | 2>(1);
  const [securityQuestion, setSecurityQuestion] = useState('');
  const [username, setUsername] = useState('');

  const usernameForm = useForm({
    initialValues: {
      username: '',
    },
    validate: {
      username: (value) => {
        if (!value || value.length < 3) {
          return "Le nom d'utilisateur doit faire au moins 3 caractères";
        }
        return null;
      },
    },
  });

  const resetForm = useForm({
    initialValues: {
      securityAnswer: '',
      newPassword: '',
      newPasswordConfirm: '',
    },
    validate: {
      securityAnswer: (value) => {
        if (!value || value.length < 1) {
          return 'Veuillez fournir une réponse';
        }
        return null;
      },
      newPassword: (value) => {
        if (!value || value.length < 8) {
          return 'Le mot de passe doit faire au moins 8 caractères';
        }
        return null;
      },
      newPasswordConfirm: (value, values) => {
        if (value !== values.newPassword) {
          return 'Les mots de passe ne correspondent pas';
        }
        return null;
      },
    },
  });

  const handleUsernameSubmit = usernameForm.onSubmit(async (values) => {
    try {
      const result = await getSecurityQuestionMutation.mutateAsync({
        username: values.username,
      });

      setUsername(values.username);
      setSecurityQuestion(result.data.securityQuestion);
      setStep(2);
    } catch (error) {
      const apiError = error as { error?: { message?: string } };
      notifications.show({
        title: 'Erreur',
        message: apiError.error?.message || 'Impossible de traiter la demande',
        color: 'red',
      });
    }
  });

  const handleResetSubmit = resetForm.onSubmit(async (values) => {
    try {
      await resetPasswordMutation.mutateAsync({
        username,
        securityAnswer: values.securityAnswer,
        newPassword: values.newPassword,
        newPasswordConfirm: values.newPasswordConfirm,
      });

      notifications.show({
        title: 'Succès',
        message: 'Mot de passe réinitialisé avec succès',
        color: 'green',
      });

      navigate('/login');
    } catch (error) {
      const apiError = error as { error?: { message?: string } };
      notifications.show({
        title: 'Erreur',
        message: apiError.error?.message || 'Impossible de réinitialiser le mot de passe',
        color: 'red',
      });
    }
  });

  return (
    <Stack gap="md">
      {step === 1 && (
        <form onSubmit={handleUsernameSubmit}>
          <Stack gap="md">
            <TextInput
              label="Nom d'utilisateur"
              placeholder="Entrez votre nom d'utilisateur"
              required
              {...usernameForm.getInputProps('username')}
            />

            <Button
              type="submit"
              fullWidth
              loading={getSecurityQuestionMutation.isPending}
            >
              Continuer
            </Button>
          </Stack>
        </form>
      )}

      {step === 2 && (
        <form onSubmit={handleResetSubmit}>
          <Stack gap="md">
            <Text size="sm" fw={500}>
              Question de sécurité :
            </Text>
            <Text size="sm" c="dimmed" mb="xs">
              {securityQuestion}
            </Text>

            <TextInput
              label="Réponse"
              placeholder="Votre réponse"
              required
              {...resetForm.getInputProps('securityAnswer')}
            />

            <PasswordInput
              label="Nouveau mot de passe"
              placeholder="Au moins 8 caractères"
              required
              {...resetForm.getInputProps('newPassword')}
            />

            <PasswordInput
              label="Confirmer le mot de passe"
              placeholder="Répétez le mot de passe"
              required
              {...resetForm.getInputProps('newPasswordConfirm')}
            />

            <Button
              type="submit"
              fullWidth
              loading={resetPasswordMutation.isPending}
            >
              Réinitialiser le mot de passe
            </Button>
          </Stack>
        </form>
      )}

      <Anchor component={Link} to="/login" size="sm" ta="center">
        Retour à la connexion
      </Anchor>
    </Stack>
  );
}
