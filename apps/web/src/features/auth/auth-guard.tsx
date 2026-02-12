import type { ReactNode } from 'react';
import { Navigate } from 'react-router';
import { Loader, Center } from '@mantine/core';
import { useCheckSetup, useAuth } from '../../api/auth.api';

interface AuthGuardProps {
  children: ReactNode;
}

/**
 * AuthGuard - Protects routes and handles first-time setup redirect
 *
 * - If setup is not complete (no user exists), redirect to /setup
 * - If setup is complete but no session, redirect to /login
 * - Otherwise, render children
 */
export function AuthGuard({ children }: AuthGuardProps) {
  const { data: setupData, isLoading: setupLoading } = useCheckSetup();
  const { data: authData, isLoading: authLoading, error: authError } = useAuth();

  if (setupLoading || authLoading) {
    return (
      <Center style={{ height: '100vh' }}>
        <Loader size="lg" />
      </Center>
    );
  }

  // Setup not complete - redirect to setup page
  if (setupData && !setupData.data.setupComplete) {
    return <Navigate to="/setup" replace />;
  }

  // Not authenticated - redirect to login
  if (authError || !authData) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}
