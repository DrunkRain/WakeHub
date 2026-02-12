import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DockerConnector } from './docker.connector.js';
import { PlatformError } from '../utils/platform-error.js';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

describe('DockerConnector', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('testConnection', () => {
    it('returns success when ping and version succeed', async () => {
      const connector = new DockerConnector({ apiUrl: 'http://192.168.1.10:2375' });

      // Mock /_ping
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () => 'OK',
      });
      // Mock /version
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ Version: '27.5.1', ApiVersion: '1.47' }),
      });

      const result = await connector.testConnection();
      expect(result.success).toBe(true);
      expect(result.message).toContain('v27.5.1');
      expect(result.message).toContain('API v1.47');
    });

    it('returns failure when host is unreachable', async () => {
      const connector = new DockerConnector({ apiUrl: 'http://192.168.1.99:2375' });

      mockFetch.mockRejectedValueOnce(new Error('connect ECONNREFUSED'));

      const result = await connector.testConnection();
      expect(result.success).toBe(false);
      expect(result.message).toContain('ECONNREFUSED');
    });

    it('returns failure when ping returns non-200', async () => {
      const connector = new DockerConnector({ apiUrl: 'http://192.168.1.10:2375' });

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 503,
      });

      const result = await connector.testConnection();
      expect(result.success).toBe(false);
      expect(result.message).toContain('503');
    });
  });

  describe('listResources', () => {
    it('returns containers with mapped status and cleaned names', async () => {
      const connector = new DockerConnector({ apiUrl: 'http://192.168.1.10:2375' });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => [
          {
            Id: 'abc123def456',
            Names: ['/jellyfin'],
            Image: 'jellyfin/jellyfin:latest',
            State: 'running',
            Status: 'Up 5 minutes',
          },
          {
            Id: 'xyz789ghi012',
            Names: ['/nextcloud'],
            Image: 'nextcloud:latest',
            State: 'exited',
            Status: 'Exited (0) 3 hours ago',
          },
          {
            Id: 'pqr345stu678',
            Names: ['/postgres'],
            Image: 'postgres:16',
            State: 'paused',
            Status: 'Paused',
          },
        ],
      });

      const result = await connector.listResources();
      expect(result).toHaveLength(3);

      expect(result[0]).toEqual({
        name: 'jellyfin',
        type: 'container',
        platformRef: { containerId: 'abc123def456', image: 'jellyfin/jellyfin:latest' },
        status: 'running',
      });

      expect(result[1]).toEqual({
        name: 'nextcloud',
        type: 'container',
        platformRef: { containerId: 'xyz789ghi012', image: 'nextcloud:latest' },
        status: 'stopped',
      });

      expect(result[2]).toEqual({
        name: 'postgres',
        type: 'container',
        platformRef: { containerId: 'pqr345stu678', image: 'postgres:16' },
        status: 'paused',
      });
    });

    it('maps all Docker states correctly', async () => {
      const connector = new DockerConnector({ apiUrl: 'http://192.168.1.10:2375' });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => [
          { Id: 'a', Names: ['/a'], Image: 'img', State: 'running', Status: '' },
          { Id: 'b', Names: ['/b'], Image: 'img', State: 'exited', Status: '' },
          { Id: 'c', Names: ['/c'], Image: 'img', State: 'created', Status: '' },
          { Id: 'd', Names: ['/d'], Image: 'img', State: 'paused', Status: '' },
          { Id: 'e', Names: ['/e'], Image: 'img', State: 'restarting', Status: '' },
          { Id: 'f', Names: ['/f'], Image: 'img', State: 'removing', Status: '' },
          { Id: 'g', Names: ['/g'], Image: 'img', State: 'dead', Status: '' },
          { Id: 'h', Names: ['/h'], Image: 'img', State: 'something-else', Status: '' },
        ],
      });

      const result = await connector.listResources();
      expect(result.map((r) => r.status)).toEqual([
        'running',   // running
        'stopped',   // exited
        'stopped',   // created
        'paused',    // paused
        'running',   // restarting
        'stopped',   // removing
        'error',     // dead
        'unknown',   // unknown state
      ]);
    });

    it('uses truncated ID when container has no name', async () => {
      const connector = new DockerConnector({ apiUrl: 'http://192.168.1.10:2375' });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => [
          { Id: 'abcdef123456789', Names: [], Image: 'img', State: 'running', Status: '' },
        ],
      });

      const result = await connector.listResources();
      expect(result[0].name).toBe('abcdef123456');
    });

    it('throws PlatformError on network failure', async () => {
      const connector = new DockerConnector({ apiUrl: 'http://192.168.1.99:2375' });

      mockFetch.mockRejectedValueOnce(new Error('connect ECONNREFUSED'));

      try {
        await connector.listResources();
        expect.fail('should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(PlatformError);
        expect((err as PlatformError).platform).toBe('docker');
      }
    });
  });

  describe('start', () => {
    it('calls POST /containers/{id}/start', async () => {
      const connector = new DockerConnector({
        apiUrl: 'http://192.168.1.10:2375',
        resourceRef: { containerId: 'abc123' },
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 204,
      });

      await connector.start();

      expect(mockFetch).toHaveBeenCalledWith(
        'http://192.168.1.10:2375/containers/abc123/start',
        { method: 'POST' },
      );
    });

    it('does not throw on 304 (already started)', async () => {
      const connector = new DockerConnector({
        apiUrl: 'http://192.168.1.10:2375',
        resourceRef: { containerId: 'abc123' },
      });

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 304,
      });

      await expect(connector.start()).resolves.toBeUndefined();
    });

    it('throws PlatformError on 404 (container not found)', async () => {
      const connector = new DockerConnector({
        apiUrl: 'http://192.168.1.10:2375',
        resourceRef: { containerId: 'nonexistent' },
      });

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: async () => ({ message: 'No such container: nonexistent' }),
      });

      await expect(connector.start()).rejects.toThrow(PlatformError);
    });

    it('throws PlatformError when no resourceRef', async () => {
      const connector = new DockerConnector({
        apiUrl: 'http://192.168.1.10:2375',
      });

      try {
        await connector.start();
        expect.fail('should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(PlatformError);
        expect((err as PlatformError).code).toBe('DOCKER_NO_REF');
      }
    });
  });

  describe('stop', () => {
    it('calls POST /containers/{id}/stop', async () => {
      const connector = new DockerConnector({
        apiUrl: 'http://192.168.1.10:2375',
        resourceRef: { containerId: 'abc123' },
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 204,
      });

      await connector.stop();

      expect(mockFetch).toHaveBeenCalledWith(
        'http://192.168.1.10:2375/containers/abc123/stop',
        { method: 'POST' },
      );
    });

    it('does not throw on 304 (already stopped)', async () => {
      const connector = new DockerConnector({
        apiUrl: 'http://192.168.1.10:2375',
        resourceRef: { containerId: 'abc123' },
      });

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 304,
      });

      await expect(connector.stop()).resolves.toBeUndefined();
    });

    it('throws PlatformError when no resourceRef', async () => {
      const connector = new DockerConnector({
        apiUrl: 'http://192.168.1.10:2375',
      });

      await expect(connector.stop()).rejects.toThrow(PlatformError);
    });
  });

  describe('getStatus', () => {
    it('returns online for running container', async () => {
      const connector = new DockerConnector({
        apiUrl: 'http://192.168.1.10:2375',
        resourceRef: { containerId: 'abc123' },
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ State: { Status: 'running' } }),
      });

      expect(await connector.getStatus()).toBe('online');
    });

    it('returns offline for exited container', async () => {
      const connector = new DockerConnector({
        apiUrl: 'http://192.168.1.10:2375',
        resourceRef: { containerId: 'abc123' },
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ State: { Status: 'exited' } }),
      });

      expect(await connector.getStatus()).toBe('offline');
    });

    it('returns error when fetch fails', async () => {
      const connector = new DockerConnector({
        apiUrl: 'http://192.168.1.99:2375',
        resourceRef: { containerId: 'abc123' },
      });

      mockFetch.mockRejectedValueOnce(new Error('network error'));

      expect(await connector.getStatus()).toBe('error');
    });

    it('returns unknown when no resourceRef', async () => {
      const connector = new DockerConnector({
        apiUrl: 'http://192.168.1.10:2375',
      });

      expect(await connector.getStatus()).toBe('unknown');
    });
  });
});
