import { Routes, Route, Navigate } from 'react-router';
import { DashboardPage } from './features/dashboard/dashboard-page';
import { ServicesPage } from './features/services/services-page';
import { ServiceDetailPage } from './features/services/service-detail-page';
import { DependenciesPage } from './features/dependencies/dependencies-page';
import { SettingsPage } from './features/settings/settings-page';
import { LogsPage } from './features/logs/logs-page';
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
                <Route path="/" element={<DashboardPage />} />
                <Route path="/services" element={<ServicesPage />} />
                <Route path="/services/:id" element={<ServiceDetailPage />} />
                <Route path="/dependencies" element={<DependenciesPage />} />
                <Route path="/settings" element={<SettingsPage />} />
                <Route path="/logs" element={<LogsPage />} />
                {/* Fallback: redirect 404 to Dashboard */}
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </AppShell>
          </AuthGuard>
        }
      />
    </Routes>
  );
}
