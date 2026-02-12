import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PlatformError } from '../utils/platform-error.js';

// Mock fetch globally before importing the connector
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

// Dynamic import after mocking
const { ProxmoxConnector } = await import('./proxmox.connector.js');

function jsonResponse(data: unknown, status = 200) {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? 'OK' : 'Error',
    json: () => Promise.resolve({ data }),
    text: () => Promise.resolve(JSON.stringify({ data })),
  } as unknown as Response);
}

function errorResponse(status: number, body = '') {
  return Promise.resolve({
    ok: false,
    status,
    statusText: 'Error',
    json: () => Promise.resolve({}),
    text: () => Promise.resolve(body),
  } as unknown as Response);
}

describe('ProxmoxConnector', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  describe('testConnection — token auth', () => {
    it('succeeds when GET /nodes returns OK', async () => {
      const connector = new ProxmoxConnector({
        apiUrl: 'https://pve:8006',
        tokenId: 'root@pam!token',
        tokenSecret: 'secret-uuid',
      });

      mockFetch.mockReturnValueOnce(jsonResponse([{ node: 'pve1' }]));

      const result = await connector.testConnection();
      expect(result.success).toBe(true);
      expect(result.message).toContain('API token');

      // Verify Authorization header
      const call = mockFetch.mock.calls[0]!;
      expect(call[0]).toBe('https://pve:8006/api2/json/nodes');
      expect(call[1].headers['Authorization']).toContain('PVEAPIToken=');
    });

    it('returns failure on 401', async () => {
      const connector = new ProxmoxConnector({
        apiUrl: 'https://pve:8006',
        tokenId: 'root@pam!token',
        tokenSecret: 'bad-secret',
      });

      mockFetch.mockReturnValueOnce(errorResponse(401, 'authentication failure'));

      const result = await connector.testConnection();
      expect(result.success).toBe(false);
      expect(result.message).toContain('401');
    });

    it('returns failure on network error', async () => {
      const connector = new ProxmoxConnector({
        apiUrl: 'https://unreachable:8006',
        tokenId: 'root@pam!token',
        tokenSecret: 'secret',
      });

      mockFetch.mockRejectedValueOnce(new Error('ECONNREFUSED'));

      const result = await connector.testConnection();
      expect(result.success).toBe(false);
      expect(result.message).toContain('ECONNREFUSED');
    });
  });

  describe('testConnection — ticket auth', () => {
    it('succeeds when POST /access/ticket returns ticket', async () => {
      const connector = new ProxmoxConnector({
        apiUrl: 'https://pve:8006',
        username: 'root@pam',
        password: 'pass123',
      });

      mockFetch.mockReturnValueOnce(
        jsonResponse({ ticket: 'PVE:root@pam:xxxx', CSRFPreventionToken: 'csrf-token' }),
      );

      const result = await connector.testConnection();
      expect(result.success).toBe(true);
      expect(result.message).toContain('ticket');

      // Verify it POSTed to /access/ticket
      const call = mockFetch.mock.calls[0]!;
      expect(call[0]).toBe('https://pve:8006/api2/json/access/ticket');
      expect(call[1].method).toBe('POST');
    });

    it('returns failure on bad credentials', async () => {
      const connector = new ProxmoxConnector({
        apiUrl: 'https://pve:8006',
        username: 'root@pam',
        password: 'wrong',
      });

      mockFetch.mockReturnValueOnce(errorResponse(401, 'authentication failure'));

      const result = await connector.testConnection();
      expect(result.success).toBe(false);
    });
  });

  describe('listResources', () => {
    function setupTicketAuth() {
      mockFetch.mockReturnValueOnce(
        jsonResponse({ ticket: 'PVE:ticket', CSRFPreventionToken: 'csrf' }),
      );
    }

    it('discovers VMs and LXC containers from a single node', async () => {
      const connector = new ProxmoxConnector({
        apiUrl: 'https://pve:8006',
        username: 'root@pam',
        password: 'pass',
      });

      setupTicketAuth();
      // GET /nodes
      mockFetch.mockReturnValueOnce(jsonResponse([{ node: 'pve1' }]));
      // GET /nodes/pve1/qemu
      mockFetch.mockReturnValueOnce(
        jsonResponse([
          { vmid: 100, name: 'web-server', status: 'running' },
          { vmid: 101, name: 'db-server', status: 'stopped' },
        ]),
      );
      // GET /nodes/pve1/lxc
      mockFetch.mockReturnValueOnce(
        jsonResponse([
          { vmid: 200, name: 'dns-ct', status: 'running' },
        ]),
      );

      const resources = await connector.listResources();
      expect(resources).toHaveLength(3);
      expect(resources[0]).toEqual({
        name: 'web-server',
        type: 'vm',
        platformRef: { node: 'pve1', vmid: 100, type: 'qemu' },
        status: 'running',
      });
      expect(resources[1]!.status).toBe('stopped');
      expect(resources[2]).toEqual({
        name: 'dns-ct',
        type: 'container',
        platformRef: { node: 'pve1', vmid: 200, type: 'lxc' },
        status: 'running',
      });
    });

    it('discovers VMs and containers from multiple nodes', async () => {
      const connector = new ProxmoxConnector({
        apiUrl: 'https://pve:8006',
        username: 'root@pam',
        password: 'pass',
      });

      setupTicketAuth();
      mockFetch.mockReturnValueOnce(jsonResponse([{ node: 'pve1' }, { node: 'pve2' }]));
      // pve1 qemu
      mockFetch.mockReturnValueOnce(
        jsonResponse([{ vmid: 100, name: 'vm-a', status: 'running' }]),
      );
      // pve1 lxc
      mockFetch.mockReturnValueOnce(
        jsonResponse([]),
      );
      // pve2 qemu
      mockFetch.mockReturnValueOnce(
        jsonResponse([{ vmid: 200, name: 'vm-b', status: 'paused' }]),
      );
      // pve2 lxc
      mockFetch.mockReturnValueOnce(
        jsonResponse([{ vmid: 300, name: 'ct-c', status: 'stopped' }]),
      );

      const resources = await connector.listResources();
      expect(resources).toHaveLength(3);
      expect(resources[0]!.platformRef.node).toBe('pve1');
      expect(resources[1]!.platformRef.node).toBe('pve2');
      expect(resources[2]!.type).toBe('container');
      expect(resources[2]!.status).toBe('stopped');
    });

    it('handles VMs without name', async () => {
      const connector = new ProxmoxConnector({
        apiUrl: 'https://pve:8006',
        tokenId: 'root@pam!t',
        tokenSecret: 's',
      });

      // Token auth — no ticket call needed
      mockFetch.mockReturnValueOnce(jsonResponse([{ node: 'pve1' }]));
      mockFetch.mockReturnValueOnce(
        jsonResponse([{ vmid: 100, status: 'stopped' }]),
      );
      mockFetch.mockReturnValueOnce(jsonResponse([]));

      const resources = await connector.listResources();
      expect(resources[0]!.name).toBe('VM 100');
    });

    it('handles LXC containers without name', async () => {
      const connector = new ProxmoxConnector({
        apiUrl: 'https://pve:8006',
        tokenId: 'root@pam!t',
        tokenSecret: 's',
      });

      mockFetch.mockReturnValueOnce(jsonResponse([{ node: 'pve1' }]));
      mockFetch.mockReturnValueOnce(jsonResponse([]));
      mockFetch.mockReturnValueOnce(
        jsonResponse([{ vmid: 300, status: 'running' }]),
      );

      const resources = await connector.listResources();
      expect(resources).toHaveLength(1);
      expect(resources[0]!.name).toBe('CT 300');
      expect(resources[0]!.type).toBe('container');
    });
  });

  describe('start', () => {
    it('POSTs to qemu endpoint for VMs (default)', async () => {
      const connector = new ProxmoxConnector({
        apiUrl: 'https://pve:8006',
        tokenId: 'root@pam!t',
        tokenSecret: 's',
        resourceRef: { node: 'pve1', vmid: 100 },
      });

      mockFetch.mockReturnValueOnce(jsonResponse('UPID:pve1:start'));

      await connector.start();

      const call = mockFetch.mock.calls[0]!;
      expect(call[0]).toBe('https://pve:8006/api2/json/nodes/pve1/qemu/100/status/start');
      expect(call[1].method).toBe('POST');
    });

    it('POSTs to lxc endpoint for LXC containers', async () => {
      const connector = new ProxmoxConnector({
        apiUrl: 'https://pve:8006',
        tokenId: 'root@pam!t',
        tokenSecret: 's',
        resourceRef: { node: 'pve1', vmid: 200, type: 'lxc' },
      });

      mockFetch.mockReturnValueOnce(jsonResponse('UPID:pve1:start'));

      await connector.start();

      const call = mockFetch.mock.calls[0]!;
      expect(call[0]).toBe('https://pve:8006/api2/json/nodes/pve1/lxc/200/status/start');
    });

    it('throws PlatformError if no resourceRef', async () => {
      const connector = new ProxmoxConnector({
        apiUrl: 'https://pve:8006',
        tokenId: 'root@pam!t',
        tokenSecret: 's',
      });

      await expect(connector.start()).rejects.toThrow(PlatformError);
    });
  });

  describe('stop', () => {
    it('POSTs to qemu endpoint for VMs (default)', async () => {
      const connector = new ProxmoxConnector({
        apiUrl: 'https://pve:8006',
        tokenId: 'root@pam!t',
        tokenSecret: 's',
        resourceRef: { node: 'pve1', vmid: 100 },
      });

      mockFetch.mockReturnValueOnce(jsonResponse('UPID:pve1:stop'));

      await connector.stop();

      const call = mockFetch.mock.calls[0]!;
      expect(call[0]).toBe('https://pve:8006/api2/json/nodes/pve1/qemu/100/status/stop');
      expect(call[1].method).toBe('POST');
    });

    it('POSTs to lxc endpoint for LXC containers', async () => {
      const connector = new ProxmoxConnector({
        apiUrl: 'https://pve:8006',
        tokenId: 'root@pam!t',
        tokenSecret: 's',
        resourceRef: { node: 'pve1', vmid: 200, type: 'lxc' },
      });

      mockFetch.mockReturnValueOnce(jsonResponse('UPID:pve1:stop'));

      await connector.stop();

      const call = mockFetch.mock.calls[0]!;
      expect(call[0]).toBe('https://pve:8006/api2/json/nodes/pve1/lxc/200/status/stop');
    });

    it('throws PlatformError if no resourceRef', async () => {
      const connector = new ProxmoxConnector({
        apiUrl: 'https://pve:8006',
        tokenId: 'root@pam!t',
        tokenSecret: 's',
      });

      await expect(connector.stop()).rejects.toThrow(PlatformError);
    });
  });

  describe('getStatus', () => {
    it('returns online when VM is running', async () => {
      const connector = new ProxmoxConnector({
        apiUrl: 'https://pve:8006',
        tokenId: 'root@pam!t',
        tokenSecret: 's',
        resourceRef: { node: 'pve1', vmid: 100 },
      });

      mockFetch.mockReturnValueOnce(jsonResponse({ status: 'running' }));

      const status = await connector.getStatus();
      expect(status).toBe('online');
    });

    it('uses lxc endpoint for LXC containers', async () => {
      const connector = new ProxmoxConnector({
        apiUrl: 'https://pve:8006',
        tokenId: 'root@pam!t',
        tokenSecret: 's',
        resourceRef: { node: 'pve1', vmid: 200, type: 'lxc' },
      });

      mockFetch.mockReturnValueOnce(jsonResponse({ status: 'running' }));

      const status = await connector.getStatus();
      expect(status).toBe('online');

      const call = mockFetch.mock.calls[0]!;
      expect(call[0]).toBe('https://pve:8006/api2/json/nodes/pve1/lxc/200/status/current');
    });

    it('returns offline when VM is stopped', async () => {
      const connector = new ProxmoxConnector({
        apiUrl: 'https://pve:8006',
        tokenId: 'root@pam!t',
        tokenSecret: 's',
        resourceRef: { node: 'pve1', vmid: 100 },
      });

      mockFetch.mockReturnValueOnce(jsonResponse({ status: 'stopped' }));

      const status = await connector.getStatus();
      expect(status).toBe('offline');
    });

    it('returns error when fetch fails', async () => {
      const connector = new ProxmoxConnector({
        apiUrl: 'https://pve:8006',
        tokenId: 'root@pam!t',
        tokenSecret: 's',
        resourceRef: { node: 'pve1', vmid: 100 },
      });

      mockFetch.mockRejectedValueOnce(new Error('ECONNREFUSED'));

      const status = await connector.getStatus();
      expect(status).toBe('error');
    });

    it('returns unknown when no resourceRef', async () => {
      const connector = new ProxmoxConnector({
        apiUrl: 'https://pve:8006',
        tokenId: 'root@pam!t',
        tokenSecret: 's',
      });

      const status = await connector.getStatus();
      expect(status).toBe('unknown');
    });
  });

  describe('error wrapping', () => {
    it('all errors are PlatformError with platform:proxmox', async () => {
      const connector = new ProxmoxConnector({
        apiUrl: 'https://pve:8006',
        tokenId: 'root@pam!t',
        tokenSecret: 's',
        resourceRef: { node: 'pve1', vmid: 100 },
      });

      mockFetch.mockReturnValueOnce(errorResponse(500, 'internal error'));

      try {
        await connector.start();
        expect.fail('should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(PlatformError);
        expect((err as PlatformError).platform).toBe('proxmox');
      }
    });
  });
});
