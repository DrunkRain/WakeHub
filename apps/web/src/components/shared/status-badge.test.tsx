import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { StatusBadge } from './status-badge';
import { theme } from '../../theme/theme';
import type { NodeStatus } from '@wakehub/shared';

function renderWithMantine(ui: React.ReactElement) {
  return render(
    <MantineProvider theme={theme} defaultColorScheme="dark">
      {ui}
    </MantineProvider>,
  );
}

describe('StatusBadge', () => {
  const statusLabels: Record<NodeStatus, string> = {
    online: 'Actif',
    offline: 'Eteint',
    starting: 'Demarrage',
    stopping: 'Arret',
    error: 'Erreur',
  };

  it.each(Object.entries(statusLabels))(
    'should render label "%s" for status "%s"',
    (status, expectedLabel) => {
      renderWithMantine(<StatusBadge status={status as NodeStatus} />);
      expect(screen.getByText(expectedLabel)).toBeInTheDocument();
    },
  );

  it('should render as a Mantine Badge element', () => {
    renderWithMantine(<StatusBadge status="online" />);
    const badge = screen.getByText('Actif');
    expect(badge.closest('.mantine-Badge-root')).toBeInTheDocument();
  });

  it('should accept an optional size prop', () => {
    renderWithMantine(<StatusBadge status="offline" size="lg" />);
    expect(screen.getByText('Eteint')).toBeInTheDocument();
  });
});
