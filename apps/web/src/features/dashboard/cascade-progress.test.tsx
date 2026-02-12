import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { theme } from '../../theme/theme';
import { CascadeProgress } from './cascade-progress';

function renderWithProviders(ui: React.ReactElement) {
  return render(
    <MantineProvider theme={theme} defaultColorScheme="dark">
      {ui}
    </MantineProvider>,
  );
}

describe('CascadeProgress', () => {
  it('renders progress bar with correct percentage', () => {
    renderWithProviders(
      <CascadeProgress currentStep={1} totalSteps={3} status="in_progress" />,
    );

    const bar = screen.getByRole('progressbar');
    expect(bar).toHaveAttribute('aria-valuenow', '33');
    expect(bar).toHaveAttribute('aria-valuemin', '0');
    expect(bar).toHaveAttribute('aria-valuemax', '100');
  });

  it('shows aria-label with step info and dependency name', () => {
    renderWithProviders(
      <CascadeProgress
        currentStep={2}
        totalSteps={4}
        currentDependencyName="NAS Server"
        status="in_progress"
      />,
    );

    const bar = screen.getByRole('progressbar');
    expect(bar).toHaveAttribute(
      'aria-label',
      'Démarrage en cours — étape 2 sur 4 : NAS Server',
    );
  });

  it('shows aria-label without dependency name when not provided', () => {
    renderWithProviders(
      <CascadeProgress currentStep={1} totalSteps={3} status="in_progress" />,
    );

    const bar = screen.getByRole('progressbar');
    expect(bar).toHaveAttribute(
      'aria-label',
      'Démarrage en cours — étape 1 sur 3',
    );
  });

  it('shows current dependency name when in progress', () => {
    renderWithProviders(
      <CascadeProgress
        currentStep={1}
        totalSteps={3}
        currentDependencyName="Proxmox Node"
        status="in_progress"
      />,
    );

    expect(screen.getByText('Proxmox Node')).toBeInTheDocument();
  });

  it('has aria-live polite on dependency zone', () => {
    const { container } = renderWithProviders(
      <CascadeProgress
        currentStep={1}
        totalSteps={3}
        currentDependencyName="Proxmox Node"
        status="in_progress"
      />,
    );

    const liveRegion = container.querySelector('[aria-live="polite"]');
    expect(liveRegion).toBeInTheDocument();
  });

  it('shows 100% when completed', () => {
    renderWithProviders(
      <CascadeProgress currentStep={2} totalSteps={3} status="completed" />,
    );

    const bar = screen.getByRole('progressbar');
    expect(bar).toHaveAttribute('aria-valuenow', '100');
  });

  it('shows "Terminé" when completed', () => {
    renderWithProviders(
      <CascadeProgress currentStep={3} totalSteps={3} status="completed" />,
    );

    expect(screen.getByText('Terminé')).toBeInTheDocument();
  });

  it('stops at current step when failed', () => {
    renderWithProviders(
      <CascadeProgress
        currentStep={2}
        totalSteps={3}
        currentDependencyName="Docker Host"
        status="failed"
      />,
    );

    const bar = screen.getByRole('progressbar');
    expect(bar).toHaveAttribute('aria-valuenow', '67');
    expect(screen.getByText('Docker Host')).toBeInTheDocument();
  });

  it('handles zero totalSteps without error', () => {
    renderWithProviders(
      <CascadeProgress currentStep={0} totalSteps={0} status="in_progress" />,
    );

    const bar = screen.getByRole('progressbar');
    expect(bar).toHaveAttribute('aria-valuenow', '0');
  });
});
