import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { MantineProvider } from '@mantine/core';
import { Notifications } from '@mantine/notifications';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { InactivityRulesSection } from './inactivity-rules-section';
import { theme } from '../../theme/theme';
import type { NodeType } from '@wakehub/shared';

function renderWithProviders(nodeId = 'node-1', nodeType: NodeType = 'physical') {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MantineProvider theme={theme} defaultColorScheme="dark">
        <Notifications />
        <InactivityRulesSection nodeId={nodeId} nodeType={nodeType} />
      </MantineProvider>
    </QueryClientProvider>,
  );
}

const mockRule = {
  id: 'rule-1',
  nodeId: 'node-1',
  timeoutMinutes: 30,
  monitoringCriteria: {
    lastAccess: true,
    networkConnections: false,
    cpuRamActivity: false,
  },
  isEnabled: true,
  createdAt: '2026-02-14T00:00:00.000Z',
  updatedAt: '2026-02-14T00:00:00.000Z',
};

function mockFetchForRules(rules: unknown[] = []) {
  const mutationResponses: Response[] = [];

  const spy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const url = typeof input === 'string' ? input : (input as Request).url ?? String(input);
    const method = (init?.method ?? 'GET').toUpperCase();

    if (method !== 'GET') {
      if (mutationResponses.length > 0) {
        return mutationResponses.shift()!;
      }
      return new Response(JSON.stringify({}), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }

    if (url.includes('/api/inactivity-rules')) {
      return new Response(JSON.stringify({ data: { rules } }), {
        status: 200, headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response('{}', { status: 404 });
  });

  (spy as any).queueMutation = (body: unknown, status = 200) => {
    mutationResponses.push(
      new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }),
    );
  };

  return spy as ReturnType<typeof vi.spyOn> & {
    queueMutation: (body: unknown, status?: number) => void;
  };
}

beforeEach(() => {
  vi.restoreAllMocks();
});

describe('InactivityRulesSection', () => {
  // Empty state
  it('should display empty state when no rules exist', async () => {
    mockFetchForRules([]);
    renderWithProviders();

    await waitFor(() => {
      expect(screen.getByText('Aucune règle configurée.')).toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: /configurer la surveillance/i })).toBeInTheDocument();
  });

  // Existing rule display
  it('should display existing rule with toggle, timeout, and criteria', async () => {
    mockFetchForRules([mockRule]);
    renderWithProviders();

    await waitFor(() => {
      expect(screen.getByLabelText('Surveillance active')).toBeInTheDocument();
    });

    // Toggle should be checked (rule is enabled)
    const toggle = screen.getByRole('switch', { name: /surveillance active/i });
    expect(toggle).toBeChecked();

    // Timeout input
    expect(screen.getByLabelText(/délai d'inactivité/i)).toHaveValue('30');

    // Criteria checkboxes
    expect(screen.getByLabelText(/dernier accès/i)).toBeChecked();
    expect(screen.getByLabelText(/connexions réseau/i)).not.toBeChecked();
    expect(screen.getByLabelText(/activité cpu\/ram/i)).not.toBeChecked();

    // Save button
    expect(screen.getByRole('button', { name: /enregistrer/i })).toBeInTheDocument();
  });

  // Toggle enable/disable
  it('should toggle enable/disable', async () => {
    mockFetchForRules([mockRule]);
    renderWithProviders();
    const user = userEvent.setup();

    await waitFor(() => {
      expect(screen.getByLabelText('Surveillance active')).toBeInTheDocument();
    });

    const toggle = screen.getByRole('switch', { name: /surveillance active/i });
    expect(toggle).toBeChecked();

    await user.click(toggle);

    await waitFor(() => {
      expect(toggle).not.toBeChecked();
    });
  });

  // Timeout modification
  it('should allow modifying timeout value', async () => {
    mockFetchForRules([mockRule]);
    renderWithProviders();
    const user = userEvent.setup();

    await waitFor(() => {
      expect(screen.getByLabelText(/délai d'inactivité/i)).toBeInTheDocument();
    });

    const input = screen.getByLabelText(/délai d'inactivité/i);
    await user.clear(input);
    await user.type(input, '15');
    expect(input).toHaveValue('15');
  });

  // Save rule (PUT)
  it('should save rule when clicking Enregistrer with correct data', async () => {
    const fetchSpy = mockFetchForRules([mockRule]);
    fetchSpy.queueMutation({ data: { rule: { ...mockRule, timeoutMinutes: 15 } } });
    renderWithProviders();
    const user = userEvent.setup();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /enregistrer/i })).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /enregistrer/i }));

    await waitFor(() => {
      const calls = fetchSpy.mock.calls;
      const putCall = calls.find(([, init]: [unknown, unknown]) => (init as RequestInit)?.method === 'PUT');
      expect(putCall).toBeDefined();

      // H2 fix: verify PUT body contains the correct form data
      const body = JSON.parse((putCall![1] as RequestInit).body as string);
      expect(body).toEqual({
        isEnabled: true,
        timeoutMinutes: 30,
        monitoringCriteria: expect.objectContaining({
          lastAccess: true,
          networkConnections: false,
          cpuRamActivity: false,
        }),
      });
    });
  });

  // Create rule (POST)
  it('should create rule when clicking Configurer la surveillance', async () => {
    const fetchSpy = mockFetchForRules([]);
    fetchSpy.queueMutation({ data: { rule: mockRule } }, 201);
    renderWithProviders();
    const user = userEvent.setup();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /configurer la surveillance/i })).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /configurer la surveillance/i }));

    await waitFor(() => {
      const calls = fetchSpy.mock.calls;
      const postCall = calls.find(([, init]: [unknown, unknown]) => (init as RequestInit)?.method === 'POST');
      expect(postCall).toBeDefined();
    });
  });

  // Loading state
  it('should show loading state with loader and no content', () => {
    // Mock fetch that never resolves
    vi.spyOn(globalThis, 'fetch').mockImplementation(() => new Promise(() => {}));
    renderWithProviders();

    // Title should be visible
    expect(screen.getByText("Règles d'inactivité")).toBeInTheDocument();
    // Content should NOT be visible during loading
    expect(screen.queryByText('Aucune règle configurée.')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /configurer la surveillance/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /enregistrer/i })).not.toBeInTheDocument();
  });

  // Error handling on save
  it('should show error notification on save failure', async () => {
    const fetchSpy = mockFetchForRules([mockRule]);
    fetchSpy.queueMutation(
      { error: { code: 'VALIDATION_ERROR', message: 'Timeout invalide' } },
      400,
    );
    renderWithProviders();
    const user = userEvent.setup();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /enregistrer/i })).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /enregistrer/i }));

    // H1 fix: verify the error notification is actually displayed
    await waitFor(() => {
      expect(screen.getByText('Timeout invalide')).toBeInTheDocument();
    });
  });

  // Error state on API failure
  it('should show error message when API fails to load rules', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () =>
      new Response(
        JSON.stringify({ error: { code: 'INTERNAL_ERROR', message: 'Erreur serveur' } }),
        { status: 500, headers: { 'Content-Type': 'application/json' } },
      ),
    );
    renderWithProviders();

    await waitFor(() => {
      expect(screen.getByText('Erreur serveur')).toBeInTheDocument();
    });
    // Should NOT show empty state
    expect(screen.queryByText('Aucune règle configurée.')).not.toBeInTheDocument();
  });

  // All criteria checkboxes should be enabled for physical nodes
  it('should have all criteria checkboxes enabled for physical node', async () => {
    mockFetchForRules([mockRule]);
    renderWithProviders('node-1', 'physical');

    await waitFor(() => {
      expect(screen.getByLabelText(/connexions réseau/i)).toBeInTheDocument();
    });

    expect(screen.getByLabelText(/connexions réseau/i)).not.toBeDisabled();
    expect(screen.getByLabelText(/activité cpu\/ram/i)).not.toBeDisabled();
    expect(screen.getByLabelText(/dernier accès/i)).not.toBeDisabled();
  });
});

// ============================================================
// Type-specific criteria labels and disabled states
// ============================================================

describe('InactivityRulesSection — type-specific criteria', () => {
  it('physical: should show SSH labels and all checkboxes enabled', async () => {
    mockFetchForRules([mockRule]);
    renderWithProviders('node-1', 'physical');

    await waitFor(() => {
      expect(screen.getByLabelText(/dernier accès \(tcp\)/i)).toBeInTheDocument();
    });

    expect(screen.getByLabelText(/connexions réseau \(ssh\)/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/activité cpu\/ram \(ssh\)/i)).toBeInTheDocument();

    // All enabled
    expect(screen.getByLabelText(/dernier accès \(tcp\)/i)).not.toBeDisabled();
    expect(screen.getByLabelText(/connexions réseau \(ssh\)/i)).not.toBeDisabled();
    expect(screen.getByLabelText(/activité cpu\/ram \(ssh\)/i)).not.toBeDisabled();
  });

  it('vm: should show Proxmox API label for CPU/RAM and disable networkConnections', async () => {
    mockFetchForRules([mockRule]);
    renderWithProviders('node-1', 'vm');

    await waitFor(() => {
      expect(screen.getByLabelText(/activité cpu\/ram \(proxmox api\)/i)).toBeInTheDocument();
    });

    // lastAccess and cpuRamActivity should be enabled
    expect(screen.getByLabelText(/dernier accès \(tcp\)/i)).not.toBeDisabled();
    expect(screen.getByLabelText(/activité cpu\/ram \(proxmox api\)/i)).not.toBeDisabled();

    // networkConnections should be disabled
    expect(screen.getByLabelText(/connexions réseau \(ssh\)/i)).toBeDisabled();
  });

  it('lxc: should show Proxmox API label for CPU/RAM and disable networkConnections', async () => {
    mockFetchForRules([mockRule]);
    renderWithProviders('node-1', 'lxc');

    await waitFor(() => {
      expect(screen.getByLabelText(/activité cpu\/ram \(proxmox api\)/i)).toBeInTheDocument();
    });

    // networkConnections should be disabled
    expect(screen.getByLabelText(/connexions réseau \(ssh\)/i)).toBeDisabled();
  });

  it('container: should show Docker API labels and disable networkConnections', async () => {
    mockFetchForRules([mockRule]);
    renderWithProviders('node-1', 'container');

    await waitFor(() => {
      expect(screen.getByLabelText(/activité cpu\/ram \(docker api\)/i)).toBeInTheDocument();
    });

    // lastAccess and cpuRamActivity should be enabled
    expect(screen.getByLabelText(/dernier accès \(cpu\/ram docker\)/i)).not.toBeDisabled();
    expect(screen.getByLabelText(/activité cpu\/ram \(docker api\)/i)).not.toBeDisabled();

    // networkConnections should be disabled
    expect(screen.getByLabelText(/connexions réseau \(ssh\)/i)).toBeDisabled();
  });

  it('container: disabled checkboxes should be unchecked regardless of criteria state', async () => {
    const ruleWithAllChecked = {
      ...mockRule,
      monitoringCriteria: {
        lastAccess: true,
        networkConnections: true,
        cpuRamActivity: true,
      },
    };
    mockFetchForRules([ruleWithAllChecked]);
    renderWithProviders('node-1', 'container');

    await waitFor(() => {
      expect(screen.getByLabelText(/activité cpu\/ram \(docker api\)/i)).toBeInTheDocument();
    });

    // Disabled checkboxes should be unchecked even though criteria says true
    expect(screen.getByLabelText(/connexions réseau \(ssh\)/i)).not.toBeChecked();

    // Enabled checkboxes should reflect criteria
    expect(screen.getByLabelText(/dernier accès \(cpu\/ram docker\)/i)).toBeChecked();
    expect(screen.getByLabelText(/activité cpu\/ram \(docker api\)/i)).toBeChecked();
  });
});

// ============================================================
// Story 5.5: Configurable CPU/RAM thresholds
// ============================================================

describe('InactivityRulesSection — configurable thresholds', () => {
  it('should NOT show threshold inputs when cpuRamActivity is disabled', async () => {
    mockFetchForRules([mockRule]); // cpuRamActivity: false
    renderWithProviders();

    await waitFor(() => {
      expect(screen.getByLabelText(/activité cpu\/ram/i)).toBeInTheDocument();
    });

    // Threshold inputs should NOT be visible
    expect(screen.queryByLabelText(/seuil cpu/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/seuil ram/i)).not.toBeInTheDocument();
  });

  it('should show threshold inputs when cpuRamActivity is enabled', async () => {
    const ruleWithCpu = {
      ...mockRule,
      monitoringCriteria: { lastAccess: false, networkConnections: false, cpuRamActivity: true },
    };
    mockFetchForRules([ruleWithCpu]);
    renderWithProviders();

    await waitFor(() => {
      expect(screen.getByLabelText(/seuil cpu/i)).toBeInTheDocument();
    });

    expect(screen.getByLabelText(/seuil ram/i)).toBeInTheDocument();

    // Default values should be 50%
    expect(screen.getByLabelText(/seuil cpu/i)).toHaveValue('50');
    expect(screen.getByLabelText(/seuil ram/i)).toHaveValue('50');
  });

  it('should display custom threshold values from rule', async () => {
    const ruleWithThresholds = {
      ...mockRule,
      monitoringCriteria: {
        lastAccess: false,
        networkConnections: false,
        cpuRamActivity: true,
        cpuThreshold: 0.3,
        ramThreshold: 0.7,
      },
    };
    mockFetchForRules([ruleWithThresholds]);
    renderWithProviders();

    await waitFor(() => {
      expect(screen.getByLabelText(/seuil cpu/i)).toHaveValue('30');
    });
    expect(screen.getByLabelText(/seuil ram/i)).toHaveValue('70');
  });

  it('should show threshold inputs after enabling cpuRamActivity checkbox', async () => {
    mockFetchForRules([mockRule]); // cpuRamActivity: false
    renderWithProviders();
    const user = userEvent.setup();

    await waitFor(() => {
      expect(screen.getByLabelText(/activité cpu\/ram/i)).toBeInTheDocument();
    });

    // No thresholds initially
    expect(screen.queryByLabelText(/seuil cpu/i)).not.toBeInTheDocument();

    // Enable cpuRamActivity
    await user.click(screen.getByLabelText(/activité cpu\/ram/i));

    // Thresholds should now be visible
    await waitFor(() => {
      expect(screen.getByLabelText(/seuil cpu/i)).toBeInTheDocument();
    });
    expect(screen.getByLabelText(/seuil ram/i)).toBeInTheDocument();
  });

  it('should include thresholds in PUT body when saving', async () => {
    const ruleWithThresholds = {
      ...mockRule,
      monitoringCriteria: {
        lastAccess: false,
        networkConnections: false,
        cpuRamActivity: true,
        cpuThreshold: 0.3,
        ramThreshold: 0.7,
      },
    };
    const fetchSpy = mockFetchForRules([ruleWithThresholds]);
    fetchSpy.queueMutation({ data: { rule: ruleWithThresholds } });
    renderWithProviders();
    const user = userEvent.setup();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /enregistrer/i })).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /enregistrer/i }));

    await waitFor(() => {
      const calls = fetchSpy.mock.calls;
      const putCall = calls.find(([, init]: [unknown, unknown]) => (init as RequestInit)?.method === 'PUT');
      expect(putCall).toBeDefined();
      const body = JSON.parse((putCall![1] as RequestInit).body as string);
      expect(body.monitoringCriteria).toEqual(expect.objectContaining({
        cpuRamActivity: true,
        cpuThreshold: 0.3,
        ramThreshold: 0.7,
      }));
    });
  });
});
