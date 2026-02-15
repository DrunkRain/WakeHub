import { vi, describe, it, expect, beforeEach } from 'vitest';

const { mockRequest } = vi.hoisted(() => ({
  mockRequest: vi.fn(),
}));

vi.mock('undici', () => ({
  Agent: class {
    close = vi.fn();
  },
  request: mockRequest,
}));

import { ProxmoxClient } from './proxmox-client.js';

function mockResponse(statusCode: number, data: unknown) {
  return {
    statusCode,
    body: { json: async () => ({ data }) },
  };
}

function mockRawResponse(statusCode: number, body: unknown) {
  return {
    statusCode,
    body: { json: async () => body },
  };
}

describe('ProxmoxClient', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Token API authentication', () => {
    it('should authenticate with API token header', async () => {
      mockRequest.mockResolvedValueOnce(mockResponse(200, [{ node: 'pve1', status: 'online' }]));

      const client = new ProxmoxClient({
        host: '10.0.0.1',
        authType: 'token',
        tokenId: 'root@pam!monitoring',
        tokenSecret: 'aaa-bbb-ccc',
      });
      const result = await client.get<unknown[]>('/nodes');

      expect(result).toEqual([{ node: 'pve1', status: 'online' }]);
      expect(mockRequest).toHaveBeenCalledWith(
        'https://10.0.0.1:8006/api2/json/nodes',
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            Authorization: 'PVEAPIToken=root@pam!monitoring=aaa-bbb-ccc',
          }),
        }),
      );
    });

    it('should use custom port', async () => {
      mockRequest.mockResolvedValueOnce(mockResponse(200, []));

      const client = new ProxmoxClient({
        host: '10.0.0.1',
        port: 9443,
        authType: 'token',
        tokenId: 'root@pam!test',
        tokenSecret: 'secret',
      });
      await client.get('/nodes');

      expect(mockRequest).toHaveBeenCalledWith(
        'https://10.0.0.1:9443/api2/json/nodes',
        expect.anything(),
      );
    });
  });

  describe('Ticket authentication (username/password)', () => {
    it('should authenticate with ticket via POST /access/ticket', async () => {
      // First call: POST /access/ticket
      mockRequest.mockResolvedValueOnce(
        mockResponse(200, {
          ticket: 'PVE:root@pam:12345::hash',
          CSRFPreventionToken: 'csrf-token-value',
          username: 'root@pam',
        }),
      );
      // Second call: actual GET request with cookie
      mockRequest.mockResolvedValueOnce(mockResponse(200, [{ node: 'pve1' }]));

      const client = new ProxmoxClient({
        host: '10.0.0.1',
        authType: 'password',
        username: 'root@pam',
        password: 'secret123',
      });
      const result = await client.get<unknown[]>('/nodes');

      expect(result).toEqual([{ node: 'pve1' }]);

      // Verify ticket request
      expect(mockRequest).toHaveBeenNthCalledWith(
        1,
        'https://10.0.0.1:8006/api2/json/access/ticket',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/x-www-form-urlencoded',
          }),
        }),
      );

      // Verify actual request uses cookie
      expect(mockRequest).toHaveBeenNthCalledWith(
        2,
        'https://10.0.0.1:8006/api2/json/nodes',
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            Cookie: 'PVEAuthCookie=PVE:root@pam:12345::hash',
          }),
        }),
      );
    });
  });

  describe('GET requests', () => {
    it('should return data from Proxmox response envelope', async () => {
      mockRequest.mockResolvedValueOnce(mockResponse(200, { vmid: 100, name: 'test-vm' }));

      const client = new ProxmoxClient({
        host: '10.0.0.1',
        authType: 'token',
        tokenId: 'id',
        tokenSecret: 'secret',
      });
      const result = await client.get('/nodes/pve1/qemu/100/status/current');

      expect(result).toEqual({ vmid: 100, name: 'test-vm' });
    });

    it('should throw on non-200 status code', async () => {
      mockRequest.mockResolvedValueOnce(mockResponse(401, null));

      const client = new ProxmoxClient({
        host: '10.0.0.1',
        authType: 'token',
        tokenId: 'id',
        tokenSecret: 'wrong',
      });

      await expect(client.get('/nodes')).rejects.toThrow();
    });

    it('should throw on 500 status code', async () => {
      mockRequest.mockResolvedValueOnce(mockResponse(500, null));

      const client = new ProxmoxClient({
        host: '10.0.0.1',
        authType: 'token',
        tokenId: 'id',
        tokenSecret: 'secret',
      });

      await expect(client.get('/nodes')).rejects.toThrow();
    });
  });

  describe('POST requests', () => {
    it('should send POST with url-encoded params', async () => {
      mockRequest.mockResolvedValueOnce(mockResponse(200, 'UPID:pve1:00001234'));

      const client = new ProxmoxClient({
        host: '10.0.0.1',
        authType: 'token',
        tokenId: 'id',
        tokenSecret: 'secret',
      });
      const result = await client.post<string>('/nodes/pve1/qemu/100/status/start');

      expect(result).toBe('UPID:pve1:00001234');
      expect(mockRequest).toHaveBeenCalledWith(
        'https://10.0.0.1:8006/api2/json/nodes/pve1/qemu/100/status/start',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/x-www-form-urlencoded',
          }),
        }),
      );
    });

    it('should send POST with ticket auth including CSRF token', async () => {
      // Ticket auth
      mockRequest.mockResolvedValueOnce(
        mockResponse(200, {
          ticket: 'PVE:root@pam:12345::hash',
          CSRFPreventionToken: 'csrf-token',
          username: 'root@pam',
        }),
      );
      // POST request
      mockRequest.mockResolvedValueOnce(mockResponse(200, 'UPID:pve1:00005678'));

      const client = new ProxmoxClient({
        host: '10.0.0.1',
        authType: 'password',
        username: 'root@pam',
        password: 'secret',
      });
      const result = await client.post<string>('/nodes/pve1/qemu/100/status/start');

      expect(result).toBe('UPID:pve1:00005678');

      // Verify POST includes CSRFPreventionToken
      expect(mockRequest).toHaveBeenNthCalledWith(
        2,
        expect.stringContaining('/nodes/pve1/qemu/100/status/start'),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Cookie: 'PVEAuthCookie=PVE:root@pam:12345::hash',
            CSRFPreventionToken: 'csrf-token',
            'Content-Type': 'application/x-www-form-urlencoded',
          }),
        }),
      );
    });

    it('should throw on non-200 POST response', async () => {
      mockRequest.mockResolvedValueOnce(mockResponse(500, null));

      const client = new ProxmoxClient({
        host: '10.0.0.1',
        authType: 'token',
        tokenId: 'id',
        tokenSecret: 'secret',
      });

      await expect(client.post('/nodes/pve1/qemu/100/status/start')).rejects.toThrow();
    });
  });

  describe('Error handling', () => {
    it('should throw on network error', async () => {
      mockRequest.mockRejectedValueOnce(new Error('connect ECONNREFUSED'));

      const client = new ProxmoxClient({
        host: '10.0.0.1',
        authType: 'token',
        tokenId: 'id',
        tokenSecret: 'secret',
      });

      await expect(client.get('/nodes')).rejects.toThrow('connect ECONNREFUSED');
    });

    it('should throw on ticket auth failure', async () => {
      mockRequest.mockResolvedValueOnce(mockResponse(401, null));

      const client = new ProxmoxClient({
        host: '10.0.0.1',
        authType: 'password',
        username: 'root@pam',
        password: 'wrong',
      });

      await expect(client.get('/nodes')).rejects.toThrow();
    });
  });

  describe('destroy', () => {
    it('should close the agent', () => {
      const client = new ProxmoxClient({
        host: '10.0.0.1',
        authType: 'token',
        tokenId: 'id',
        tokenSecret: 'secret',
      });
      client.destroy();
      // No error thrown = success (agent.close() is mocked)
    });
  });
});
