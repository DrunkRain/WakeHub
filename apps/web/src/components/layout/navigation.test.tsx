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
  it('renders the Accueil navigation link', () => {
    renderWithProviders(<Navigation />);

    expect(screen.getByLabelText('Accueil')).toBeInTheDocument();
  });

  it('renders correct href for Accueil link', () => {
    renderWithProviders(<Navigation />);

    const accueilLink = screen.getByLabelText('Accueil').closest('a');
    expect(accueilLink).toHaveAttribute('href', '/');
  });

  it('marks the active link with aria-current="page"', () => {
    renderWithProviders(<Navigation />, '/');

    const accueilButton = screen.getByLabelText('Accueil');
    expect(accueilButton).toHaveAttribute('aria-current', 'page');
  });

  it('renders icon for the navigation item', () => {
    const { container } = renderWithProviders(<Navigation />);

    // Check that SVG icon is rendered (Tabler icons are SVGs)
    const svgs = container.querySelectorAll('svg');
    expect(svgs.length).toBeGreaterThanOrEqual(1);
  });
});
