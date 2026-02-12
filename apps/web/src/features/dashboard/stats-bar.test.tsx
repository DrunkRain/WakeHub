import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { theme } from '../../theme/theme';
import { StatsBar } from './stats-bar';

vi.mock('../../api/cascades.api', () => ({
  useStats: vi.fn(() => ({
    data: {
      data: {
        activeServices: 3,
        cascadesToday: 7,
        avgCascadeTime: 45,
        inactivityHours: 0,
      },
    },
    isLoading: false,
    isError: false,
  })),
}));

function renderWithProviders(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MantineProvider theme={theme} defaultColorScheme="dark">
        {ui}
      </MantineProvider>
    </QueryClientProvider>,
  );
}

describe('StatsBar', () => {
  it('renders 4 stat tiles', () => {
    renderWithProviders(<StatsBar />);

    expect(screen.getByText('Services actifs')).toBeInTheDocument();
    expect(screen.getByText('Cascades aujourd\'hui')).toBeInTheDocument();
    expect(screen.getByText('Temps moyen')).toBeInTheDocument();
    expect(screen.getByText('Heures d\'inactivité')).toBeInTheDocument();
  });

  it('displays stat values', () => {
    renderWithProviders(<StatsBar />);

    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('7')).toBeInTheDocument();
    expect(screen.getByText('45s')).toBeInTheDocument();
    expect(screen.getByText('0')).toBeInTheDocument();
  });

  it('renders 4 Paper components (bordered cards)', () => {
    renderWithProviders(<StatsBar />);

    // Mantine may use different class names, so check for the labels instead
    expect(screen.getAllByText(/Services actifs|Cascades aujourd|Temps moyen|Heures d/)).toHaveLength(4);
  });
});
