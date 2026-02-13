import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useSSE } from './use-sse';
import { useCascadeStore } from '../stores/cascade.store';

vi.mock('@mantine/notifications', () => ({
  notifications: {
    show: vi.fn(),
  },
}));

// --- Mock EventSource ---

class MockEventSource {
  static instances: MockEventSource[] = [];

  url: string;
  withCredentials: boolean;
  listeners = new Map<string, Function[]>();
  closed = false;

  constructor(url: string, options?: { withCredentials?: boolean }) {
    this.url = url;
    this.withCredentials = options?.withCredentials ?? false;
    MockEventSource.instances.push(this);
  }

  addEventListener(event: string, handler: Function) {
    const handlers = this.listeners.get(event) || [];
    handlers.push(handler);
    this.listeners.set(event, handlers);
  }

  close() {
    this.closed = true;
  }

  // Helper for tests
  emit(event: string, data: unknown) {
    for (const handler of this.listeners.get(event) || []) {
      handler({ data: JSON.stringify(data) });
    }
  }
}

vi.stubGlobal('EventSource', MockEventSource);

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });

  return {
    queryClient,
    wrapper: ({ children }: { children: React.ReactNode }) =>
      React.createElement(QueryClientProvider, { client: queryClient }, children),
  };
}

describe('useSSE', () => {
  beforeEach(() => {
    MockEventSource.instances = [];
    useCascadeStore.setState({ cascades: {} });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should open an EventSource connection on mount', () => {
    const { wrapper } = createWrapper();
    renderHook(() => useSSE(), { wrapper });

    expect(MockEventSource.instances).toHaveLength(1);
    expect(MockEventSource.instances[0]!.url).toBe('/api/events');
    expect(MockEventSource.instances[0]!.withCredentials).toBe(true);
  });

  it('should close the EventSource connection on unmount', () => {
    const { wrapper } = createWrapper();
    const { unmount } = renderHook(() => useSSE(), { wrapper });

    const es = MockEventSource.instances[0]!;
    expect(es.closed).toBe(false);

    unmount();
    expect(es.closed).toBe(true);
  });

  it('should register listeners for all SSE event types', () => {
    const { wrapper } = createWrapper();
    renderHook(() => useSSE(), { wrapper });

    const es = MockEventSource.instances[0]!;
    expect(es.listeners.has('status-change')).toBe(true);
    expect(es.listeners.has('cascade-progress')).toBe(true);
    expect(es.listeners.has('cascade-complete')).toBe(true);
    expect(es.listeners.has('cascade-error')).toBe(true);
  });

  it('should invalidate nodes query on status-change event', () => {
    const { wrapper, queryClient } = createWrapper();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    renderHook(() => useSSE(), { wrapper });

    const es = MockEventSource.instances[0]!;
    es.emit('status-change', { nodeId: 'n1', status: 'online' });

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['nodes'] });
  });

  it('should invalidate cascades and nodes queries on cascade-complete event', () => {
    const { wrapper, queryClient } = createWrapper();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    renderHook(() => useSSE(), { wrapper });

    const es = MockEventSource.instances[0]!;
    es.emit('cascade-complete', { cascadeId: 'c1', nodeId: 'n1', success: true });

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['cascades'] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['nodes'] });
  });

  it('should invalidate cascades query on cascade-progress event', () => {
    const { wrapper, queryClient } = createWrapper();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    renderHook(() => useSSE(), { wrapper });

    const es = MockEventSource.instances[0]!;
    es.emit('cascade-progress', { cascadeId: 'c1', step: 1, totalSteps: 3, nodeId: 'n1' });

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['cascades'] });
  });

  it('should update cascade store on cascade-progress event', () => {
    const { wrapper } = createWrapper();
    renderHook(() => useSSE(), { wrapper });

    const es = MockEventSource.instances[0]!;
    es.emit('cascade-progress', {
      cascadeId: 'c-1',
      nodeId: 'node-1',
      step: 2,
      totalSteps: 5,
      currentNodeId: 'dep-1',
      currentNodeName: 'NAS-Storage',
    });

    const state = useCascadeStore.getState().cascades['node-1'];
    expect(state).toEqual(
      expect.objectContaining({
        cascadeId: 'c-1',
        step: 2,
        totalSteps: 5,
        currentNodeName: 'NAS-Storage',
        status: 'in_progress',
      }),
    );
  });

  it('should complete cascade and show success toast on cascade-complete event', async () => {
    const { notifications } = await import('@mantine/notifications');

    useCascadeStore.getState().updateProgress('node-1', {
      cascadeId: 'c-1',
      step: 3,
      totalSteps: 5,
    });

    const { wrapper } = createWrapper();
    renderHook(() => useSSE(), { wrapper });

    const es = MockEventSource.instances[0]!;
    es.emit('cascade-complete', { cascadeId: 'c-1', nodeId: 'node-1', success: true });

    expect(useCascadeStore.getState().cascades['node-1']?.status).toBe('completed');
    expect(notifications.show).toHaveBeenCalledWith(
      expect.objectContaining({ color: 'green' }),
    );
  });

  it('should fail cascade and show error toast on cascade-error event', async () => {
    const { notifications } = await import('@mantine/notifications');

    useCascadeStore.getState().updateProgress('node-1', {
      cascadeId: 'c-1',
      step: 2,
      totalSteps: 5,
      currentNodeName: 'VM-Broken',
    });

    const { wrapper } = createWrapper();
    renderHook(() => useSSE(), { wrapper });

    const es = MockEventSource.instances[0]!;
    es.emit('cascade-error', {
      cascadeId: 'c-1',
      nodeId: 'node-1',
      error: { code: 'CONN_FAIL', message: 'Connection refused' },
    });

    const state = useCascadeStore.getState().cascades['node-1'];
    expect(state?.status).toBe('failed');
    expect(state?.errorNodeName).toBe('VM-Broken');
    expect(notifications.show).toHaveBeenCalledWith(
      expect.objectContaining({ color: 'red' }),
    );
  });
});
