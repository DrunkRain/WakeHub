import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { CascadeProgress, type CascadeProgressProps } from './cascade-progress';

function renderProgress(props: Partial<CascadeProgressProps> = {}) {
  const defaultProps: CascadeProgressProps = {
    step: 2,
    totalSteps: 5,
    status: 'in_progress',
    ...props,
  };

  return render(
    <MantineProvider>
      <CascadeProgress {...defaultProps} />
    </MantineProvider>,
  );
}

describe('CascadeProgress', () => {
  it('should render a progress bar with correct percentage', () => {
    renderProgress({ step: 2, totalSteps: 5 });
    // Mantine Progress renders role="progressbar" on the inner section with aria-valuetext
    const progressbars = screen.getAllByRole('progressbar');
    const section = progressbars.find((el) => el.getAttribute('aria-valuetext'));
    expect(section).toHaveAttribute('aria-valuenow', '40');
  });

  it('should render current dependency name', () => {
    renderProgress({ currentNodeName: 'NAS-Storage', status: 'in_progress' });
    expect(screen.getByText('NAS-Storage')).toBeInTheDocument();
  });

  it('should render current dependency name with NodeTypeIcon when type is provided', () => {
    renderProgress({ currentNodeName: 'NAS-Storage', currentNodeType: 'physical', status: 'in_progress' });
    expect(screen.getByText('NAS-Storage')).toBeInTheDocument();
  });

  it('should render bar at 100% when completed', () => {
    renderProgress({ step: 5, totalSteps: 5, status: 'completed' });
    const progressbars = screen.getAllByRole('progressbar');
    const section = progressbars.find((el) => el.getAttribute('aria-valuetext'));
    expect(section).toHaveAttribute('aria-valuenow', '100');
    expect(section).toHaveAttribute('aria-valuetext', '100%');
  });

  it('should render error message when failed', () => {
    renderProgress({ step: 2, totalSteps: 5, status: 'failed', errorNodeName: 'VM-Media' });
    expect(screen.getByText('Échec : VM-Media')).toBeInTheDocument();
  });

  it('should have role="progressbar" with aria-valuenow, aria-valuemin, aria-valuemax', () => {
    renderProgress({ step: 3, totalSteps: 10 });
    const progressbars = screen.getAllByRole('progressbar');
    const section = progressbars.find((el) => el.getAttribute('aria-valuetext'));
    expect(section).toHaveAttribute('aria-valuenow', '30');
    expect(section).toHaveAttribute('aria-valuemin', '0');
    expect(section).toHaveAttribute('aria-valuemax', '100');
  });

  it('should have aria-live="polite" on the dependency zone', () => {
    renderProgress({ currentNodeName: 'NAS-Storage', status: 'in_progress' });
    const liveRegion = screen.getByText('NAS-Storage').closest('[aria-live]');
    expect(liveRegion).toHaveAttribute('aria-live', 'polite');
  });
});
