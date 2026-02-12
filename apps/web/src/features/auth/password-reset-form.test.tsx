import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { MantineProvider } from '@mantine/core';
import { BrowserRouter } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PasswordResetForm } from './password-reset-form';
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
  window.history.pushState({}, '', '/forgot-password');
  vi.restoreAllMocks();
});

describe('PasswordResetForm', () => {
  it('should render step 1 with username field and continue button', () => {
    renderWithProviders(<PasswordResetForm />);

    expect(screen.getByPlaceholderText("Entrez votre nom d'utilisateur")).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Continuer' })).toBeInTheDocument();
    expect(screen.getByText('Retour à la connexion')).toBeInTheDocument();
  });

  it('should transition to step 2 after valid username submission', async () => {
    const user = userEvent.setup();

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(
        JSON.stringify({ data: { securityQuestion: 'Quel est le nom de votre animal ?' } }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    );

    renderWithProviders(<PasswordResetForm />);

    await user.type(screen.getByPlaceholderText("Entrez votre nom d'utilisateur"), 'testuser');
    await user.click(screen.getByRole('button', { name: 'Continuer' }));

    // Wait for step 2 to appear
    expect(await screen.findByText('Quel est le nom de votre animal ?')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Votre réponse')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Au moins 8 caractères')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Répétez le mot de passe')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Réinitialiser le mot de passe' })).toBeInTheDocument();
  });

  it('should show error for non-existent user in step 1', async () => {
    const user = userEvent.setup();

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(
        JSON.stringify({ error: { code: 'INVALID_REQUEST', message: 'Impossible de traiter la demande' } }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    );

    renderWithProviders(<PasswordResetForm />);

    await user.type(screen.getByPlaceholderText("Entrez votre nom d'utilisateur"), 'nonexistent');
    await user.click(screen.getByRole('button', { name: 'Continuer' }));

    // Should stay on step 1 (no step 2 elements)
    await waitFor(() => {
      expect(screen.queryByPlaceholderText('Votre réponse')).not.toBeInTheDocument();
    });
  });

  it('should validate username minimum length', async () => {
    const user = userEvent.setup();

    renderWithProviders(<PasswordResetForm />);

    await user.type(screen.getByPlaceholderText("Entrez votre nom d'utilisateur"), 'ab');
    await user.click(screen.getByRole('button', { name: 'Continuer' }));

    expect(await screen.findByText(/doit faire au moins 3 caractères/)).toBeInTheDocument();
  });

  it('should validate password minimum length in step 2', async () => {
    const user = userEvent.setup();

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(
        JSON.stringify({ data: { securityQuestion: 'Question ?' } }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    );

    renderWithProviders(<PasswordResetForm />);

    // Step 1
    await user.type(screen.getByPlaceholderText("Entrez votre nom d'utilisateur"), 'testuser');
    await user.click(screen.getByRole('button', { name: 'Continuer' }));

    // Wait for step 2
    await screen.findByText('Question ?');

    // Fill in with short password
    await user.type(screen.getByPlaceholderText('Votre réponse'), 'answer');
    await user.type(screen.getByPlaceholderText('Au moins 8 caractères'), 'short');
    await user.type(screen.getByPlaceholderText('Répétez le mot de passe'), 'short');
    await user.click(screen.getByRole('button', { name: 'Réinitialiser le mot de passe' }));

    expect(await screen.findByText(/doit faire au moins 8 caractères/)).toBeInTheDocument();
  });

  it('should validate password confirmation match', async () => {
    const user = userEvent.setup();

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(
        JSON.stringify({ data: { securityQuestion: 'Question ?' } }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    );

    renderWithProviders(<PasswordResetForm />);

    // Step 1
    await user.type(screen.getByPlaceholderText("Entrez votre nom d'utilisateur"), 'testuser');
    await user.click(screen.getByRole('button', { name: 'Continuer' }));

    // Wait for step 2
    await screen.findByText('Question ?');

    await user.type(screen.getByPlaceholderText('Votre réponse'), 'answer');
    await user.type(screen.getByPlaceholderText('Au moins 8 caractères'), 'SecurePass123');
    await user.type(screen.getByPlaceholderText('Répétez le mot de passe'), 'DifferentPass');
    await user.click(screen.getByRole('button', { name: 'Réinitialiser le mot de passe' }));

    expect(await screen.findByText(/ne correspondent pas/)).toBeInTheDocument();
  });

  it('should complete full reset flow and redirect to login', async () => {
    const user = userEvent.setup();

    // Mock step 1: get-security-question
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ data: { securityQuestion: 'Question ?' } }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      )
      // Mock step 2: reset-password
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ data: { success: true } }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      );

    renderWithProviders(<PasswordResetForm />);

    // Step 1
    await user.type(screen.getByPlaceholderText("Entrez votre nom d'utilisateur"), 'testuser');
    await user.click(screen.getByRole('button', { name: 'Continuer' }));

    // Wait for step 2
    await screen.findByText('Question ?');

    // Fill step 2 with valid data
    await user.type(screen.getByPlaceholderText('Votre réponse'), 'correct-answer');
    await user.type(screen.getByPlaceholderText('Au moins 8 caractères'), 'NewSecurePass123');
    await user.type(screen.getByPlaceholderText('Répétez le mot de passe'), 'NewSecurePass123');
    await user.click(screen.getByRole('button', { name: 'Réinitialiser le mot de passe' }));

    // Should redirect to /login after success
    await waitFor(() => {
      expect(window.location.pathname).toBe('/login');
    });
  });

  it('should stay on step 2 when security answer is wrong', async () => {
    const user = userEvent.setup();

    // Mock step 1: get-security-question
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ data: { securityQuestion: 'Question ?' } }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      )
      // Mock step 2: reset-password fails with wrong answer
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ error: { code: 'INVALID_SECURITY_ANSWER', message: 'Reponse incorrecte' } }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        )
      );

    renderWithProviders(<PasswordResetForm />);

    // Step 1
    await user.type(screen.getByPlaceholderText("Entrez votre nom d'utilisateur"), 'testuser');
    await user.click(screen.getByRole('button', { name: 'Continuer' }));

    // Wait for step 2
    await screen.findByText('Question ?');

    // Fill step 2 with wrong answer
    await user.type(screen.getByPlaceholderText('Votre réponse'), 'wrong-answer');
    await user.type(screen.getByPlaceholderText('Au moins 8 caractères'), 'NewSecurePass123');
    await user.type(screen.getByPlaceholderText('Répétez le mot de passe'), 'NewSecurePass123');
    await user.click(screen.getByRole('button', { name: 'Réinitialiser le mot de passe' }));

    // Should stay on step 2 (not redirect to /login)
    await waitFor(() => {
      expect(screen.getByPlaceholderText('Votre réponse')).toBeInTheDocument();
      expect(window.location.pathname).toBe('/forgot-password');
    });
  });

  it('should have a link back to login page', () => {
    renderWithProviders(<PasswordResetForm />);

    const link = screen.getByText('Retour à la connexion');
    expect(link).toBeInTheDocument();
    expect(link.closest('a')).toHaveAttribute('href', '/login');
  });
});
