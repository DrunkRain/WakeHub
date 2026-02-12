import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { BrowserRouter } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AppRoutes } from './router';
import { theme } from './theme/theme';

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
  it('renders Home page at root path', async () => {
    renderWithProviders(<AppRoutes />);

    // Wait for auth guard to resolve then show home page
    expect(await screen.findByText('Bienvenue sur WakeHub')).toBeInTheDocument();
  });

  it('marks the Accueil navigation link as active on home page', async () => {
    renderWithProviders(<AppRoutes />);

    // Wait for auth guard to resolve
    await screen.findByText('Bienvenue sur WakeHub');

    // Accueil link should be active
    const accueilButtons = screen.getAllByLabelText('Accueil');
    expect(accueilButtons.some((el) => el.getAttribute('aria-current') === 'page')).toBe(true);
  });
});
