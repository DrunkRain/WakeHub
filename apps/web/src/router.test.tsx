import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { MantineProvider } from '@mantine/core';
import { BrowserRouter } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AppRoutes } from './router';
import { theme } from './theme/theme';

// Mock useSSE — router tests don't need SSE functionality
vi.mock('./hooks/use-sse', () => ({ useSSE: vi.fn() }));

// Reset location and mock fetch before each test
beforeEach(() => {
  window.history.pushState({}, '', '/');

  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : (input as Request).url;
    if (url.includes('/api/auth/check-setup')) {
      return new Response(JSON.stringify({ data: { setupComplete: true } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    if (url.includes('/api/auth/me')) {
      return new Response(JSON.stringify({ data: { userId: '1', username: 'testuser' } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    return new Response('{}', { status: 404 });
  });
});

function renderWithProviders(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MantineProvider theme={theme} defaultColorScheme="dark">
        <BrowserRouter>{ui}</BrowserRouter>
      </MantineProvider>
    </QueryClientProvider>
  );
}

describe('Router', () => {
  it('renders Dashboard page at root path', async () => {
    renderWithProviders(<AppRoutes />);

    // Wait for auth guard to resolve then show dashboard
    expect(await screen.findByText('Ajoutez votre premier service')).toBeInTheDocument();
  });

  it('navigates to Services page when clicking Services link', async () => {
    const user = userEvent.setup();
    renderWithProviders(<AppRoutes />);

    // Wait for auth guard to resolve
    await screen.findByText('Ajoutez votre premier service');

    const servicesLink = screen.getAllByLabelText('Services')[0]!;
    await user.click(servicesLink);

    expect(await screen.findByText('Aucun service configuré')).toBeInTheDocument();
  });

  it('navigates to Settings page when clicking Settings link', async () => {
    const user = userEvent.setup();
    renderWithProviders(<AppRoutes />);

    await screen.findByText('Ajoutez votre premier service');

    const settingsLink = screen.getAllByLabelText('Settings')[0]!;
    await user.click(settingsLink);

    expect(await screen.findByRole('heading', { name: 'Settings' })).toBeInTheDocument();
  });

  it('navigates to Logs page when clicking Logs link', async () => {
    const user = userEvent.setup();
    renderWithProviders(<AppRoutes />);

    await screen.findByText('Ajoutez votre premier service');

    const logsLink = screen.getAllByLabelText('Logs')[0]!;
    await user.click(logsLink);

    expect(await screen.findByText('Aucun événement enregistré')).toBeInTheDocument();
  });

  it('updates browser URL when navigating', async () => {
    const user = userEvent.setup();
    renderWithProviders(<AppRoutes />);

    await screen.findByText('Ajoutez votre premier service');

    const servicesLink = screen.getAllByLabelText('Services')[0]!;
    await user.click(servicesLink);

    expect(window.location.pathname).toBe('/services');
  });

  it('marks the active navigation link when route changes', async () => {
    const user = userEvent.setup();
    renderWithProviders(<AppRoutes />);

    await screen.findByText('Ajoutez votre premier service');

    // Navigate to Services
    const servicesLink = screen.getAllByLabelText('Services')[0]!;
    await user.click(servicesLink);

    // Wait for navigation to complete
    await screen.findByText('Aucun service configuré');

    // Services link should now be active (check first occurrence has aria-current)
    const servicesButtons = screen.getAllByLabelText('Services');
    expect(servicesButtons.some((el) => el.getAttribute('aria-current') === 'page')).toBe(true);

    // Dashboard link should not be active
    const dashboardButtons = screen.getAllByLabelText('Dashboard');
    expect(dashboardButtons.some((el) => el.getAttribute('aria-current') === 'page')).toBe(false);
  });
});
