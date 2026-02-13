import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { NodeTypeIcon } from './node-type-icon';
import { theme } from '../../theme/theme';
import type { NodeType } from '@wakehub/shared';

function renderWithMantine(ui: React.ReactElement) {
  return render(
    <MantineProvider theme={theme} defaultColorScheme="dark">
      {ui}
    </MantineProvider>,
  );
}

describe('NodeTypeIcon', () => {
  const types: NodeType[] = ['physical', 'vm', 'lxc', 'container'];

  it.each(types)('should render an icon for type "%s"', (type) => {
    const { container } = renderWithMantine(<NodeTypeIcon type={type} />);
    const svg = container.querySelector('svg');
    expect(svg).toBeInTheDocument();
  });

  it('should accept an optional size prop', () => {
    const { container } = renderWithMantine(<NodeTypeIcon type="physical" size={32} />);
    const svg = container.querySelector('svg');
    expect(svg).toBeInTheDocument();
  });
});
