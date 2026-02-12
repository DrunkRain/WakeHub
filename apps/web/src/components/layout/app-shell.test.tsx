import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router';
import { MantineProvider } from '@mantine/core';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AppShell } from './app-shell';
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

describe('AppShell', () => {
  it('renders the WakeHub header', () => {
    renderWithProviders(
      <AppShell>
        <div>Test Content</div>
      </AppShell>
    );

    expect(screen.getByText('WakeHub')).toBeInTheDocument();
  });

  it('renders the skip link for accessibility', () => {
    renderWithProviders(
      <AppShell>
        <div>Test Content</div>
      </AppShell>
    );

    const skipLink = screen.getByText('Aller au contenu');
    expect(skipLink).toBeInTheDocument();
    expect(skipLink).toHaveAttribute('href', '#main-content');
  });

  it('renders navigation in the header on desktop', () => {
    renderWithProviders(
      <AppShell>
        <div>Test Content</div>
      </AppShell>
    );

    // Check that navigation links are present (may appear multiple times due to responsive nav)
    expect(screen.getAllByLabelText('Dashboard')[0]).toBeInTheDocument();
    expect(screen.getAllByLabelText('Services')[0]).toBeInTheDocument();
    expect(screen.getAllByLabelText('Settings')[0]).toBeInTheDocument();
    expect(screen.getAllByLabelText('Logs')[0]).toBeInTheDocument();
  });

  it('renders children in the main content area', () => {
    renderWithProviders(
      <AppShell>
        <div>Test Content</div>
      </AppShell>
    );

    expect(screen.getByText('Test Content')).toBeInTheDocument();
  });

  it('renders burger menu with proper aria-label', () => {
    renderWithProviders(
      <AppShell>
        <div>Test Content</div>
      </AppShell>
    );

    const burger = screen.getByLabelText('Ouvrir/Fermer la navigation');
    expect(burger).toBeInTheDocument();
  });
});
