import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { act } from '@testing-library/react';
import { useCascadeStore, useCascadeForNode } from './cascade.store';

describe('useCascadeStore', () => {
  beforeEach(() => {
    useCascadeStore.setState({ cascades: {} });
  });

  it('should update progress for a node', () => {
    act(() => {
      useCascadeStore.getState().updateProgress('node-1', {
        cascadeId: 'cascade-1',
        step: 2,
        totalSteps: 5,
        currentNodeName: 'VM-Media',
        currentNodeId: 'dep-1',
      });
    });

    const state = useCascadeStore.getState().cascades['node-1'];
    expect(state).toEqual(
      expect.objectContaining({
        cascadeId: 'cascade-1',
        step: 2,
        totalSteps: 5,
        currentNodeName: 'VM-Media',
        status: 'in_progress',
      }),
    );
  });

  it('should complete a cascade — status completed and step = totalSteps', () => {
    act(() => {
      useCascadeStore.getState().updateProgress('node-1', {
        cascadeId: 'cascade-1',
        step: 3,
        totalSteps: 5,
      });
    });

    act(() => {
      useCascadeStore.getState().completeCascade('node-1');
    });

    const state = useCascadeStore.getState().cascades['node-1'];
    expect(state).toEqual(
      expect.objectContaining({ status: 'completed', step: 5, totalSteps: 5 }),
    );
  });

  it('should fail a cascade with errorNodeName', () => {
    act(() => {
      useCascadeStore.getState().updateProgress('node-1', {
        cascadeId: 'cascade-1',
        step: 2,
        totalSteps: 5,
      });
    });

    act(() => {
      useCascadeStore.getState().failCascade('node-1', 'NAS-Storage');
    });

    const state = useCascadeStore.getState().cascades['node-1'];
    expect(state).toEqual(
      expect.objectContaining({ status: 'failed', errorNodeName: 'NAS-Storage' }),
    );
  });

  it('should clear a cascade entry from the store', () => {
    act(() => {
      useCascadeStore.getState().updateProgress('node-1', {
        cascadeId: 'cascade-1',
        step: 1,
        totalSteps: 3,
      });
    });

    act(() => {
      useCascadeStore.getState().clearCascade('node-1');
    });

    expect(useCascadeStore.getState().cascades['node-1']).toBeUndefined();
  });

  it('should isolate cascades by nodeId', () => {
    act(() => {
      useCascadeStore.getState().updateProgress('node-1', {
        cascadeId: 'cascade-1',
        step: 2,
        totalSteps: 5,
      });
      useCascadeStore.getState().updateProgress('node-2', {
        cascadeId: 'cascade-2',
        step: 1,
        totalSteps: 3,
      });
    });

    act(() => {
      useCascadeStore.getState().completeCascade('node-1');
    });

    expect(useCascadeStore.getState().cascades['node-1']?.status).toBe('completed');
    expect(useCascadeStore.getState().cascades['node-2']?.status).toBe('in_progress');
  });

  it('should return undefined from useCascadeForNode when no cascade exists', () => {
    const { result } = renderHook(() => useCascadeForNode('unknown-node'));
    expect(result.current).toBeUndefined();
  });
});
