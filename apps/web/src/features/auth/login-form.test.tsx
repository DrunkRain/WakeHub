import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { MantineProvider } from '@mantine/core';
import { BrowserRouter } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { LoginForm } from './login-form';
import { theme } from '../../theme/theme';

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

beforeEach(() => {
  window.history.pushState({}, '', '/login');
  vi.restoreAllMocks();
});

describe('LoginForm', () => {
  it('should render username, password fields and submit button', () => {
    renderWithProviders(<LoginForm />);

    expect(screen.getByPlaceholderText("Entrez votre nom d'utilisateur")).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Entrez votre mot de passe')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Se connecter' })).toBeInTheDocument();
    expect(screen.getByText('Se souvenir de moi')).toBeInTheDocument();
  });

  it('should validate username minimum length', async () => {
    const user = userEvent.setup();

    renderWithProviders(<LoginForm />);

    await user.type(screen.getByPlaceholderText("Entrez votre nom d'utilisateur"), 'ab');
    await user.type(screen.getByPlaceholderText('Entrez votre mot de passe'), 'somepass');
    await user.click(screen.getByRole('button', { name: 'Se connecter' }));

    expect(await screen.findByText(/doit faire au moins 3 caractères/)).toBeInTheDocument();
  });

  it('should redirect to / after successful login', async () => {
    const user = userEvent.setup();

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(
        JSON.stringify({ data: { userId: '1', username: 'testuser' } }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    );

    renderWithProviders(<LoginForm />);

    await user.type(screen.getByPlaceholderText("Entrez votre nom d'utilisateur"), 'testuser');
    await user.type(screen.getByPlaceholderText('Entrez votre mot de passe'), 'SecurePass123');
    await user.click(screen.getByRole('button', { name: 'Se connecter' }));

    await waitFor(() => {
      expect(window.location.pathname).toBe('/');
    });
  });

  it('should have a link to forgot password page', () => {
    renderWithProviders(<LoginForm />);

    const link = screen.getByText('Mot de passe oublié ?');
    expect(link).toBeInTheDocument();
    expect(link.closest('a')).toHaveAttribute('href', '/forgot-password');
  });

  it('should stay on login page with invalid credentials', async () => {
    const user = userEvent.setup();

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(
        JSON.stringify({ error: { code: 'INVALID_CREDENTIALS', message: 'Identifiants incorrects' } }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      )
    );

    renderWithProviders(<LoginForm />);

    await user.type(screen.getByPlaceholderText("Entrez votre nom d'utilisateur"), 'testuser');
    await user.type(screen.getByPlaceholderText('Entrez votre mot de passe'), 'WrongPassword');
    await user.click(screen.getByRole('button', { name: 'Se connecter' }));

    await waitFor(() => {
      expect(window.location.pathname).toBe('/login');
    });
  });
});
