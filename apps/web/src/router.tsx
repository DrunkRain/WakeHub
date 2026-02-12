import { Routes, Route, Navigate } from 'react-router';
import { HomePage } from './features/home/home-page';
import { FirstTimeSetup } from './features/auth/first-time-setup';
import { LoginPage } from './features/auth/login-page';
import { PasswordResetPage } from './features/auth/password-reset-page';
import { AuthGuard } from './features/auth/auth-guard';
import { AppShell } from './components/layout/app-shell';

export function AppRoutes() {
  return (
    <Routes>
      {/* Public routes */}
      <Route path="/setup" element={<FirstTimeSetup />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/forgot-password" element={<PasswordResetPage />} />

      {/* Protected routes: Wrapped with AppShell and AuthGuard */}
      <Route
        path="/*"
        element={
          <AuthGuard>
            <AppShell>
              <Routes>
                <Route path="/" element={<HomePage />} />
                {/* Fallback: redirect 404 to Home */}
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </AppShell>
          </AuthGuard>
        }
      />
    </Routes>
  );
}
