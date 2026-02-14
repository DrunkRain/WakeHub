import { vi, describe, it, expect, beforeEach } from 'vitest';

const { mockRequest } = vi.hoisted(() => ({
  mockRequest: vi.fn(),
}));

vi.mock('undici', () => ({
  request: mockRequest,
  Agent: class { close() {} },
}));

import { DockerClient } from './docker-client.js';

describe('DockerClient', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('constructor', () => {
    it('should build HTTP base URL by default', () => {
      mockRequest.mockResolvedValueOnce({
        statusCode: 200,
        body: { text: async () => 'OK' },
      });

      const client = new DockerClient({ host: '10.0.0.1', port: 2375 });
      client.ping();

      expect(mockRequest).toHaveBeenCalledWith(
        expect.stringContaining('http://10.0.0.1:2375/v1.45/_ping'),
        expect.any(Object),
      );
    });

    it('should build HTTPS base URL when tlsEnabled is true', () => {
      mockRequest.mockResolvedValueOnce({
        statusCode: 200,
        body: { text: async () => 'OK' },
      });

      const client = new DockerClient({ host: '10.0.0.1', port: 2376, tlsEnabled: true });
      client.ping();

      expect(mockRequest).toHaveBeenCalledWith(
        expect.stringContaining('https://10.0.0.1:2376/v1.45/_ping'),
        expect.any(Object),
      );
    });
  });

  describe('ping', () => {
    it('should return true when Docker responds 200', async () => {
      mockRequest.mockResolvedValueOnce({
        statusCode: 200,
        body: { text: async () => 'OK' },
      });

      const client = new DockerClient({ host: '10.0.0.1', port: 2375 });
      const result = await client.ping();
      expect(result).toBe(true);
    });

    it('should return false when Docker responds non-200', async () => {
      mockRequest.mockResolvedValueOnce({
        statusCode: 500,
        body: { text: async () => 'Server Error' },
      });

      const client = new DockerClient({ host: '10.0.0.1', port: 2375 });
      const result = await client.ping();
      expect(result).toBe(false);
    });

    it('should throw on network error (ECONNREFUSED)', async () => {
      mockRequest.mockRejectedValueOnce(new Error('connect ECONNREFUSED'));

      const client = new DockerClient({ host: '10.0.0.1', port: 2375 });
      await expect(client.ping()).rejects.toThrow('connect ECONNREFUSED');
    });

    it('should throw on timeout', async () => {
      mockRequest.mockRejectedValueOnce(new Error('Headers Timeout Error'));

      const client = new DockerClient({ host: '10.0.0.1', port: 2375 });
      await expect(client.ping()).rejects.toThrow('Headers Timeout Error');
    });
  });

  describe('get', () => {
    it('should return JSON data directly (no envelope)', async () => {
      const containers = [
        { Id: 'abc123', Names: ['/nginx'], Image: 'nginx:latest', State: 'running', Status: 'Up 2h', Ports: [] },
      ];
      mockRequest.mockResolvedValueOnce({
        statusCode: 200,
        body: { json: async () => containers },
      });

      const client = new DockerClient({ host: '10.0.0.1', port: 2375 });
      const result = await client.get('/containers/json?all=true');
      expect(result).toEqual(containers);
    });

    it('should prefix path with API version', async () => {
      mockRequest.mockResolvedValueOnce({
        statusCode: 200,
        body: { json: async () => ({}) },
      });

      const client = new DockerClient({ host: '10.0.0.1', port: 2375 });
      await client.get('/containers/abc123/json');

      expect(mockRequest).toHaveBeenCalledWith(
        'http://10.0.0.1:2375/v1.45/containers/abc123/json',
        expect.any(Object),
      );
    });

    it('should throw on non-200 status code', async () => {
      mockRequest.mockResolvedValueOnce({
        statusCode: 404,
        body: { json: async () => ({ message: 'No such container' }) },
      });

      const client = new DockerClient({ host: '10.0.0.1', port: 2375 });
      await expect(client.get('/containers/unknown/json')).rejects.toThrow('Docker GET /containers/unknown/json failed (404)');
    });

    it('should throw on 500 status code', async () => {
      mockRequest.mockResolvedValueOnce({
        statusCode: 500,
        body: { json: async () => ({ message: 'server error' }) },
      });

      const client = new DockerClient({ host: '10.0.0.1', port: 2375 });
      await expect(client.get('/info')).rejects.toThrow('Docker GET /info failed (500)');
    });

    it('should throw on network error', async () => {
      mockRequest.mockRejectedValueOnce(new Error('connect ECONNREFUSED'));

      const client = new DockerClient({ host: '10.0.0.1', port: 2375 });
      await expect(client.get('/info')).rejects.toThrow('connect ECONNREFUSED');
    });
  });

  describe('post', () => {
    it('should succeed on 204 No Content', async () => {
      mockRequest.mockResolvedValueOnce({
        statusCode: 204,
        body: { text: async () => '' },
      });

      const client = new DockerClient({ host: '10.0.0.1', port: 2375 });
      await expect(client.post('/containers/abc123/start')).resolves.toBeUndefined();
    });

    it('should succeed on 304 (already started/stopped)', async () => {
      mockRequest.mockResolvedValueOnce({
        statusCode: 304,
        body: { text: async () => '' },
      });

      const client = new DockerClient({ host: '10.0.0.1', port: 2375 });
      await expect(client.post('/containers/abc123/stop')).resolves.toBeUndefined();
    });

    it('should throw on 404 (container not found)', async () => {
      mockRequest.mockResolvedValueOnce({
        statusCode: 404,
        body: { text: async () => 'no such container' },
      });

      const client = new DockerClient({ host: '10.0.0.1', port: 2375 });
      await expect(client.post('/containers/unknown/start')).rejects.toThrow('Docker POST /containers/unknown/start failed (404)');
    });

    it('should throw on 500 status code', async () => {
      mockRequest.mockResolvedValueOnce({
        statusCode: 500,
        body: { text: async () => 'server error' },
      });

      const client = new DockerClient({ host: '10.0.0.1', port: 2375 });
      await expect(client.post('/containers/abc123/start')).rejects.toThrow('Docker POST /containers/abc123/start failed (500)');
    });

    it('should throw on network error', async () => {
      mockRequest.mockRejectedValueOnce(new Error('connect ETIMEDOUT'));

      const client = new DockerClient({ host: '10.0.0.1', port: 2375 });
      await expect(client.post('/containers/abc123/start')).rejects.toThrow('connect ETIMEDOUT');
    });
  });
});
