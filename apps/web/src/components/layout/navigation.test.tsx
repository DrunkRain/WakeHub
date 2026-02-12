import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { MantineProvider } from '@mantine/core';
import { Navigation } from './navigation';
import { theme } from '../../theme/theme';

function renderWithProviders(ui: React.ReactElement, initialRoute = '/') {
  return render(
    <MantineProvider theme={theme} defaultColorScheme="dark">
      <MemoryRouter initialEntries={[initialRoute]}>{ui}</MemoryRouter>
    </MantineProvider>
  );
}

describe('Navigation', () => {
  it('renders all navigation links', () => {
    renderWithProviders(<Navigation />);

    expect(screen.getByLabelText('Dashboard')).toBeInTheDocument();
    expect(screen.getByLabelText('Services')).toBeInTheDocument();
    expect(screen.getByLabelText('Settings')).toBeInTheDocument();
    expect(screen.getByLabelText('Logs')).toBeInTheDocument();
  });

  it('renders correct href for each link', () => {
    renderWithProviders(<Navigation />);

    const dashboardLink = screen.getByLabelText('Dashboard').closest('a');
    const servicesLink = screen.getByLabelText('Services').closest('a');
    const settingsLink = screen.getByLabelText('Settings').closest('a');
    const logsLink = screen.getByLabelText('Logs').closest('a');

    expect(dashboardLink).toHaveAttribute('href', '/');
    expect(servicesLink).toHaveAttribute('href', '/services');
    expect(settingsLink).toHaveAttribute('href', '/settings');
    expect(logsLink).toHaveAttribute('href', '/logs');
  });

  it('marks the active link with aria-current="page"', () => {
    renderWithProviders(<Navigation />, '/services');

    const servicesButton = screen.getByLabelText('Services');
    expect(servicesButton).toHaveAttribute('aria-current', 'page');
  });

  it('does not mark inactive links with aria-current', () => {
    renderWithProviders(<Navigation />, '/services');

    const dashboardButton = screen.getByLabelText('Dashboard');
    const settingsButton = screen.getByLabelText('Settings');
    const logsButton = screen.getByLabelText('Logs');

    expect(dashboardButton).not.toHaveAttribute('aria-current');
    expect(settingsButton).not.toHaveAttribute('aria-current');
    expect(logsButton).not.toHaveAttribute('aria-current');
  });

  it('renders icons for each navigation item', () => {
    const { container } = renderWithProviders(<Navigation />);

    // Check that SVG icons are rendered (Tabler icons are SVGs)
    const svgs = container.querySelectorAll('svg');
    expect(svgs.length).toBeGreaterThanOrEqual(4);
  });
});
