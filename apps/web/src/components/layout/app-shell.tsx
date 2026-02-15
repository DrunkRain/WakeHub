import React from 'react';
import { AppShell as MantineAppShell, Burger, Group, Title, ActionIcon, Tooltip } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { useLocation, useNavigate } from 'react-router';
import { IconLogout } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { Navigation } from './navigation';
import { useLogout } from '../../api/auth.api';
import { useSSE } from '../../hooks/use-sse';

interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  useSSE();
  const [opened, { toggle, close }] = useDisclosure();
  const location = useLocation();
  const navigate = useNavigate();
  const logoutMutation = useLogout();

  React.useEffect(() => {
    close();
  }, [location, close]);

  const handleLogout = async () => {
    try {
      await logoutMutation.mutateAsync();
      navigate('/login');
    } catch {
      notifications.show({
        title: 'Erreur',
        message: 'Erreur lors de la déconnexion',
        color: 'red',
      });
    }
  };

  return (
    <>
      <a href="#main-content" className="skip-link">
        Aller au contenu
      </a>

      <MantineAppShell
        header={{ height: 60 }}
        navbar={{
          width: 300,
          breakpoint: 'sm',
          collapsed: { mobile: !opened, desktop: true },
        }}
        padding="md"
      >
        <MantineAppShell.Header>
          <Group h="100%" px="md" justify="space-between">
            <Group>
              <Burger opened={opened} onClick={toggle} hiddenFrom="sm" size="sm" aria-label="Ouvrir/Fermer la navigation" />
              <Title order={3} c="blue.4">
                WakeHub
              </Title>
            </Group>

            <Group visibleFrom="sm">
              <Navigation />
              <Tooltip label="Déconnexion">
                <ActionIcon
                  variant="subtle"
                  color="gray"
                  onClick={handleLogout}
                  loading={logoutMutation.isPending}
                  aria-label="Déconnexion"
                >
                  <IconLogout size={20} />
                </ActionIcon>
              </Tooltip>
            </Group>
          </Group>
        </MantineAppShell.Header>

        <MantineAppShell.Navbar p="md">
          <Navigation />
          <Tooltip label="Déconnexion">
            <ActionIcon
              variant="subtle"
              color="gray"
              onClick={handleLogout}
              loading={logoutMutation.isPending}
              aria-label="Déconnexion"
              mt="auto"
            >
              <IconLogout size={20} />
            </ActionIcon>
          </Tooltip>
        </MantineAppShell.Navbar>

        <MantineAppShell.Main id="main-content">{children}</MantineAppShell.Main>
      </MantineAppShell>
    </>
  );
}
