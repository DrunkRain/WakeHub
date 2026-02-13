import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StatsBar } from './stats-bar';
import React from 'react';

const mockUseStats = vi.hoisted(() => vi.fn());
vi.mock('../../api/stats.api', () => ({
  useStats: mockUseStats,
}));

function renderWithProviders(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MantineProvider>{ui}</MantineProvider>
    </QueryClientProvider>,
  );
}

describe('StatsBar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render 4 stat tiles with data', () => {
    mockUseStats.mockReturnValue({
      data: {
        data: {
          nodesOnline: 3,
          nodesTotal: 5,
          cascadesToday: 7,
          avgCascadeDurationMs: 12500,
        },
      },
      isLoading: false,
    });

    renderWithProviders(<StatsBar />);

    expect(screen.getByText('Noeuds actifs')).toBeInTheDocument();
    expect(screen.getByText('3/5')).toBeInTheDocument();
    expect(screen.getByText('Cascades du jour')).toBeInTheDocument();
    expect(screen.getByText('7')).toBeInTheDocument();
    expect(screen.getByText('Temps moyen cascade')).toBeInTheDocument();
    expect(screen.getByText('13s')).toBeInTheDocument();
    expect(screen.getByText("Heures d'inactivité")).toBeInTheDocument();
  });

  it('should render skeletons when loading', () => {
    mockUseStats.mockReturnValue({
      data: undefined,
      isLoading: true,
    });

    const { container } = renderWithProviders(<StatsBar />);
    // Skeletons are rendered as div elements with specific Mantine classes
    const papers = container.querySelectorAll('[class*="mantine-Paper"]');
    expect(papers.length).toBe(4);
  });

  it('should render dash for null avgCascadeDurationMs', () => {
    mockUseStats.mockReturnValue({
      data: {
        data: {
          nodesOnline: 0,
          nodesTotal: 0,
          cascadesToday: 0,
          avgCascadeDurationMs: null,
        },
      },
      isLoading: false,
    });

    renderWithProviders(<StatsBar />);

    expect(screen.getByText('0/0')).toBeInTheDocument();
    expect(screen.getByText('0')).toBeInTheDocument();
    // "—" is the placeholder for null duration and inactivity hours
    const dashes = screen.getAllByText('—');
    expect(dashes.length).toBe(2); // avgDuration + inactivity
  });
});
