import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useStartCascade, useStopCascade } from './cascades.api';
import React from 'react';

const mockApiFetch = vi.hoisted(() => vi.fn());
vi.mock('./api-fetch', () => ({
  apiFetch: mockApiFetch,
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);
}

describe('cascades.api', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('useStartCascade', () => {
    it('should call POST /api/cascades/start with nodeId', async () => {
      const cascadeResponse = {
        data: {
          cascade: { id: 'cascade-1', nodeId: 'node-1', type: 'start', status: 'pending' },
        },
      };
      mockApiFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(cascadeResponse),
      });

      const { result } = renderHook(() => useStartCascade(), { wrapper: createWrapper() });

      result.current.mutate('node-1');

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(mockApiFetch).toHaveBeenCalledWith('/api/cascades/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nodeId: 'node-1' }),
      });
    });

    it('should throw on error response', async () => {
      const errorResponse = {
        error: { code: 'CASCADE_FAILED', message: 'Node not found' },
      };
      mockApiFetch.mockResolvedValue({
        ok: false,
        json: () => Promise.resolve(errorResponse),
      });

      const { result } = renderHook(() => useStartCascade(), { wrapper: createWrapper() });

      result.current.mutate('invalid-node');

      await waitFor(() => expect(result.current.isError).toBe(true));
    });
  });

  describe('useStopCascade', () => {
    it('should call POST /api/cascades/stop with nodeId', async () => {
      const cascadeResponse = {
        data: {
          cascade: { id: 'cascade-2', nodeId: 'node-1', type: 'stop', status: 'pending' },
        },
      };
      mockApiFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(cascadeResponse),
      });

      const { result } = renderHook(() => useStopCascade(), { wrapper: createWrapper() });

      result.current.mutate('node-1');

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(mockApiFetch).toHaveBeenCalledWith('/api/cascades/stop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nodeId: 'node-1' }),
      });
    });

    it('should throw on error response', async () => {
      const errorResponse = {
        error: { code: 'CASCADE_FAILED', message: 'Node not found' },
      };
      mockApiFetch.mockResolvedValue({
        ok: false,
        json: () => Promise.resolve(errorResponse),
      });

      const { result } = renderHook(() => useStopCascade(), { wrapper: createWrapper() });

      result.current.mutate('invalid-node');

      await waitFor(() => expect(result.current.isError).toBe(true));
    });
  });
});
