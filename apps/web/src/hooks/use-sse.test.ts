import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement, type ReactNode } from 'react';

// Mock getAuthToken
vi.mock('../api/auth-token', () => ({
  getAuthToken: vi.fn(() => 'test-token-123'),
}));

// Mock @mantine/notifications
vi.mock('@mantine/notifications', () => ({
  notifications: {
    show: vi.fn(),
  },
}));

import { getAuthToken } from '../api/auth-token';
import { notifications } from '@mantine/notifications';

// Mock EventSource
const mockClose = vi.fn();
const mockAddEventListener = vi.fn();
let lastEventSource: { url: string; options: EventSourceInit; listeners: Map<string, Function> } | null = null;

class MockEventSource {
  url: string;
  listeners = new Map<string, Function>();

  constructor(url: string, options?: EventSourceInit) {
    this.url = url;
    lastEventSource = { url, options: options ?? {}, listeners: this.listeners };
    mockAddEventListener.mockImplementation((event: string, handler: Function) => {
      this.listeners.set(event, handler);
    });
  }

  addEventListener = mockAddEventListener;
  close = mockClose;
  set onerror(_: any) {}
}

Object.defineProperty(globalThis, 'EventSource', {
  writable: true,
  value: MockEventSource,
});

import { useSSE } from './use-sse';

describe('useSSE', () => {
  let queryClient: QueryClient;

  function wrapper({ children }: { children: ReactNode }) {
    return createElement(QueryClientProvider, { client: queryClient }, children);
  }

  beforeEach(() => {
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    lastEventSource = null;
    mockClose.mockClear();
    mockAddEventListener.mockClear();
    vi.mocked(getAuthToken).mockReturnValue('test-token-123');
    vi.mocked(notifications.show).mockClear();
    vi.useFakeTimers();
  });

  afterEach(() => {
    queryClient.clear();
    vi.useRealTimers();
  });

  it('creates EventSource with token in URL when token exists', () => {
    renderHook(() => useSSE(), { wrapper });

    expect(lastEventSource).not.toBeNull();
    expect(lastEventSource!.url).toBe('/api/events?token=test-token-123');
    expect(lastEventSource!.options.withCredentials).toBe(true);
  });

  it('creates EventSource without token when getAuthToken returns null', () => {
    vi.mocked(getAuthToken).mockReturnValue(null);

    renderHook(() => useSSE(), { wrapper });

    expect(lastEventSource).not.toBeNull();
    expect(lastEventSource!.url).toBe('/api/events');
    expect(lastEventSource!.options.withCredentials).toBe(true);
  });

  it('registers listeners for all SSE event types', () => {
    renderHook(() => useSSE(), { wrapper });

    const registeredEvents = mockAddEventListener.mock.calls.map((c: unknown[]) => c[0]);
    expect(registeredEvents).toContain('status-change');
    expect(registeredEvents).toContain('cascade-progress');
    expect(registeredEvents).toContain('cascade-complete');
    expect(registeredEvents).toContain('cascade-error');
  });

  it('closes EventSource on unmount', () => {
    const { unmount } = renderHook(() => useSSE(), { wrapper });

    unmount();
    expect(mockClose).toHaveBeenCalledTimes(1);
  });

  it('invalidates services and stats queries on status-change', () => {
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
    renderHook(() => useSSE(), { wrapper });

    const handler = lastEventSource!.listeners.get('status-change');
    expect(handler).toBeDefined();
    handler!({ data: '{}' });

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['services'] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['stats'] });
  });

  it('stores cascade progress data in query cache on cascade-progress', () => {
    const setDataSpy = vi.spyOn(queryClient, 'setQueryData');
    renderHook(() => useSSE(), { wrapper });

    const handler = lastEventSource!.listeners.get('cascade-progress');
    handler!({
      data: JSON.stringify({
        cascadeId: 'c1',
        serviceId: 'r1',
        step: 2,
        totalSteps: 4,
        currentDependency: { id: 'd1', name: 'NAS Server', status: 'starting' },
      }),
    });

    expect(setDataSpy).toHaveBeenCalledWith(
      ['cascade', 'progress', 'r1'],
      expect.objectContaining({
        cascadeId: 'c1',
        serviceId: 'r1',
        step: 2,
        totalSteps: 4,
        currentDependency: { id: 'd1', name: 'NAS Server', status: 'starting' },
        status: 'in_progress',
      }),
    );
  });

  it('invalidates cascade queries on cascade-progress', () => {
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
    renderHook(() => useSSE(), { wrapper });

    const handler = lastEventSource!.listeners.get('cascade-progress');
    handler!({ data: JSON.stringify({ cascadeId: 'c1', serviceId: 'r1', step: 1, totalSteps: 3, currentDependency: null }) });

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['cascade'] });
  });

  it('stores completed state and shows success toast on cascade-complete', () => {
    const setDataSpy = vi.spyOn(queryClient, 'setQueryData');
    renderHook(() => useSSE(), { wrapper });

    const handler = lastEventSource!.listeners.get('cascade-complete');
    handler!({
      data: JSON.stringify({ cascadeId: 'c1', serviceId: 'r1', success: true }),
    });

    expect(setDataSpy).toHaveBeenCalledWith(
      ['cascade', 'progress', 'r1'],
      expect.objectContaining({
        cascadeId: 'c1',
        serviceId: 'r1',
        status: 'completed',
      }),
    );

    expect(notifications.show).toHaveBeenCalledWith(
      expect.objectContaining({
        color: 'green',
        autoClose: 5000,
      }),
    );
  });

  it('cleans up completed progress data after 1.5s', () => {
    const removeSpy = vi.spyOn(queryClient, 'removeQueries');
    renderHook(() => useSSE(), { wrapper });

    const handler = lastEventSource!.listeners.get('cascade-complete');
    handler!({
      data: JSON.stringify({ cascadeId: 'c1', serviceId: 'r1', success: true }),
    });

    expect(removeSpy).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1500);

    expect(removeSpy).toHaveBeenCalledWith({
      queryKey: ['cascade', 'progress', 'r1'],
    });
  });

  it('invalidates cascade + services queries on cascade-complete', () => {
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
    renderHook(() => useSSE(), { wrapper });

    const handler = lastEventSource!.listeners.get('cascade-complete');
    handler!({
      data: JSON.stringify({ cascadeId: 'c1', serviceId: 'r1', success: true }),
    });

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['cascade'] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['services'] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['stats'] });
  });

  it('stores failed state and shows error toast on cascade-error', () => {
    const setDataSpy = vi.spyOn(queryClient, 'setQueryData');
    renderHook(() => useSSE(), { wrapper });

    const handler = lastEventSource!.listeners.get('cascade-error');
    handler!({
      data: JSON.stringify({
        cascadeId: 'c1',
        serviceId: 'r1',
        failedStep: 2,
        error: { code: 'SSH_FAILED', message: 'Connexion SSH impossible' },
      }),
    });

    expect(setDataSpy).toHaveBeenCalledWith(
      ['cascade', 'progress', 'r1'],
      expect.objectContaining({
        cascadeId: 'c1',
        serviceId: 'r1',
        step: 2,
        status: 'failed',
      }),
    );

    expect(notifications.show).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Échec du démarrage',
        message: 'Connexion SSH impossible',
        color: 'red',
        autoClose: 5000,
      }),
    );
  });

  it('uses service name from cache in success toast', () => {
    // Pre-populate the services cache
    queryClient.setQueryData(['services'], {
      data: [{ id: 'r1', name: 'Jellyfin' }],
    });

    renderHook(() => useSSE(), { wrapper });

    const handler = lastEventSource!.listeners.get('cascade-complete');
    handler!({
      data: JSON.stringify({ cascadeId: 'c1', serviceId: 'r1', success: true }),
    });

    expect(notifications.show).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Jellyfin démarré avec succès',
      }),
    );
  });

  it('handles malformed JSON in cascade-progress gracefully', () => {
    renderHook(() => useSSE(), { wrapper });

    const handler = lastEventSource!.listeners.get('cascade-progress');
    expect(() => handler!({ data: 'not json' })).not.toThrow();
  });

  it('handles malformed JSON in cascade-complete gracefully', () => {
    renderHook(() => useSSE(), { wrapper });

    const handler = lastEventSource!.listeners.get('cascade-complete');
    expect(() => handler!({ data: 'not json' })).not.toThrow();
  });

  it('clears pending completion timers on unmount', () => {
    const removeSpy = vi.spyOn(queryClient, 'removeQueries');
    const { unmount } = renderHook(() => useSSE(), { wrapper });

    const handler = lastEventSource!.listeners.get('cascade-complete');
    handler!({
      data: JSON.stringify({ cascadeId: 'c1', serviceId: 'r1', success: true }),
    });

    // Unmount before the 1.5s timer fires — cleanup should clear the timer
    unmount();
    removeSpy.mockClear();

    vi.advanceTimersByTime(2000);

    // removeQueries should NOT be called — the timer was cleared on unmount
    expect(removeSpy).not.toHaveBeenCalled();
  });
});
