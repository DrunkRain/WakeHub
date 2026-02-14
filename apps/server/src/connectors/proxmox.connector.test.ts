import { vi, describe, it, expect, beforeEach } from 'vitest';
import type { Node, DiscoveredResource } from '@wakehub/shared';

const { mockGet, mockPost, mockDestroy } = vi.hoisted(() => ({
  mockGet: vi.fn(),
  mockPost: vi.fn(),
  mockDestroy: vi.fn(),
}));

vi.mock('./proxmox-client.js', () => ({
  ProxmoxClient: class {
    get = mockGet;
    post = mockPost;
    destroy = mockDestroy;
  },
}));

import { ProxmoxConnector } from './proxmox.connector.js';
import { PlatformError } from '../utils/platform-error.js';

function makeParentNode(overrides: Partial<Node> = {}): Node {
  return {
    id: 'parent-1',
    name: 'Proxmox Server',
    type: 'physical',
    status: 'online',
    ipAddress: '192.168.1.100',
    macAddress: 'AA:BB:CC:DD:EE:FF',
    sshUser: 'root',
    sshCredentialsEncrypted: null,
    parentId: null,
    capabilities: {
      proxmox_api: {
        host: '192.168.1.100',
        port: 8006,
        authType: 'token',
        tokenId: 'root@pam!monitoring',
        tokenSecretEncrypted: 'encrypted-secret',
        verifySsl: false,
      },
    },
    platformRef: null,
    serviceUrl: null,
    isPinned: false,
    confirmBeforeShutdown: false,
    discovered: false,
    configured: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function makeVmNode(overrides: Partial<Node> = {}): Node {
  return {
    id: 'vm-1',
    name: 'ubuntu-server',
    type: 'vm',
    status: 'offline',
    ipAddress: null,
    macAddress: null,
    sshUser: null,
    sshCredentialsEncrypted: null,
    parentId: 'parent-1',
    capabilities: null,
    platformRef: { platform: 'proxmox', platformId: 'pve1/100', node: 'pve1', vmid: 100, type: 'qemu' },
    serviceUrl: null,
    isPinned: false,
    confirmBeforeShutdown: false,
    discovered: true,
    configured: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function makeLxcNode(overrides: Partial<Node> = {}): Node {
  return {
    ...makeVmNode(),
    id: 'lxc-1',
    name: 'nginx-proxy',
    type: 'lxc',
    platformRef: { platform: 'proxmox', platformId: 'pve1/200', node: 'pve1', vmid: 200, type: 'lxc' },
    ...overrides,
  };
}

describe('ProxmoxConnector', () => {
  let connector: ProxmoxConnector;
  const parentNode = makeParentNode();

  beforeEach(() => {
    vi.clearAllMocks();
    connector = new ProxmoxConnector(parentNode, (encrypted: string) => `decrypted(${encrypted})`);
  });

  describe('testConnection', () => {
    it('should return true when GET /nodes succeeds', async () => {
      mockGet.mockResolvedValueOnce([{ node: 'pve1', status: 'online' }]);
      const node = makeVmNode();

      const result = await connector.testConnection(node);

      expect(result).toBe(true);
      expect(mockGet).toHaveBeenCalledWith('/nodes');
      expect(mockDestroy).toHaveBeenCalled();
    });

    it('should throw PlatformError on connection failure', async () => {
      mockGet.mockRejectedValueOnce(new Error('connect ECONNREFUSED'));
      const node = makeVmNode();

      try {
        await connector.testConnection(node);
        expect.unreachable('should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(PlatformError);
        expect(error).toMatchObject({ code: 'PROXMOX_UNREACHABLE', platform: 'proxmox' });
      }
    });

    it('should throw PlatformError on auth failure (401)', async () => {
      mockGet.mockRejectedValueOnce(new Error('Proxmox GET /nodes failed (401)'));
      const node = makeVmNode();

      try {
        await connector.testConnection(node);
        expect.unreachable('should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(PlatformError);
        expect(error).toMatchObject({ code: 'PROXMOX_AUTH_FAILED', platform: 'proxmox' });
      }
    });
  });

  describe('start', () => {
    it('should POST start for a VM (qemu)', async () => {
      mockPost.mockResolvedValueOnce('UPID:pve1:00001234');
      const node = makeVmNode();

      await connector.start(node);

      expect(mockPost).toHaveBeenCalledWith('/nodes/pve1/qemu/100/status/start');
      expect(mockDestroy).toHaveBeenCalled();
    });

    it('should POST start for a LXC', async () => {
      mockPost.mockResolvedValueOnce('UPID:pve1:00005678');
      const node = makeLxcNode();

      await connector.start(node);

      expect(mockPost).toHaveBeenCalledWith('/nodes/pve1/lxc/200/status/start');
    });

    it('should throw PlatformError when start fails', async () => {
      mockPost.mockRejectedValueOnce(new Error('Proxmox POST failed (500)'));
      const node = makeVmNode();

      try {
        await connector.start(node);
        expect.unreachable('should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(PlatformError);
        expect(error).toMatchObject({ code: 'PROXMOX_START_FAILED', platform: 'proxmox' });
      }
    });

    it('should throw PlatformError when platformRef is missing', async () => {
      const node = makeVmNode({ platformRef: null });

      try {
        await connector.start(node);
        expect.unreachable('should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(PlatformError);
        expect(error).toMatchObject({ code: 'PROXMOX_VM_NOT_FOUND' });
      }
    });
  });

  describe('stop', () => {
    it('should POST stop for a VM (qemu)', async () => {
      mockPost.mockResolvedValueOnce('UPID:pve1:00001234');
      const node = makeVmNode();

      await connector.stop(node);

      expect(mockPost).toHaveBeenCalledWith('/nodes/pve1/qemu/100/status/shutdown');
    });

    it('should POST shutdown for a LXC', async () => {
      mockPost.mockResolvedValueOnce('UPID:pve1:00005678');
      const node = makeLxcNode();

      await connector.stop(node);

      expect(mockPost).toHaveBeenCalledWith('/nodes/pve1/lxc/200/status/shutdown');
    });

    it('should throw PlatformError when shutdown fails', async () => {
      mockPost.mockRejectedValueOnce(new Error('Proxmox POST failed (500)'));
      const node = makeVmNode();

      try {
        await connector.stop(node);
        expect.unreachable('should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(PlatformError);
        expect(error).toMatchObject({ code: 'PROXMOX_SHUTDOWN_FAILED', platform: 'proxmox' });
      }
    });
  });

  describe('getStatus', () => {
    it('should return online for running VM', async () => {
      mockGet.mockResolvedValueOnce({ status: 'running', vmid: 100 });
      const node = makeVmNode();

      const status = await connector.getStatus(node);

      expect(status).toBe('online');
      expect(mockGet).toHaveBeenCalledWith('/nodes/pve1/qemu/100/status/current');
    });

    it('should return offline for stopped VM', async () => {
      mockGet.mockResolvedValueOnce({ status: 'stopped', vmid: 100 });
      const node = makeVmNode();

      const status = await connector.getStatus(node);

      expect(status).toBe('offline');
    });

    it('should return offline for paused VM', async () => {
      mockGet.mockResolvedValueOnce({ status: 'paused', vmid: 100 });
      const node = makeVmNode();

      const status = await connector.getStatus(node);

      expect(status).toBe('offline');
    });

    it('should use lxc path for LXC node', async () => {
      mockGet.mockResolvedValueOnce({ status: 'running', vmid: 200 });
      const node = makeLxcNode();

      const status = await connector.getStatus(node);

      expect(status).toBe('online');
      expect(mockGet).toHaveBeenCalledWith('/nodes/pve1/lxc/200/status/current');
    });

    it('should return error when getStatus fails', async () => {
      mockGet.mockRejectedValueOnce(new Error('API Error'));
      const node = makeVmNode();

      const status = await connector.getStatus(node);

      expect(status).toBe('error');
    });
  });

  describe('getStats', () => {
    it('should return CPU and RAM usage from Proxmox status/current', async () => {
      mockGet.mockResolvedValueOnce({ cpu: 0.35, maxcpu: 4, mem: 2147483648, maxmem: 4294967296 });
      const node = makeVmNode();

      const stats = await connector.getStats(node);

      expect(stats).toEqual({ cpuUsage: 0.35, ramUsage: 0.5 });
      expect(mockGet).toHaveBeenCalledWith('/nodes/pve1/qemu/100/status/current');
      expect(mockDestroy).toHaveBeenCalled();
    });

    it('should use lxc path for LXC node', async () => {
      mockGet.mockResolvedValueOnce({ cpu: 0.1, maxcpu: 2, mem: 1073741824, maxmem: 2147483648 });
      const node = makeLxcNode();

      const stats = await connector.getStats(node);

      expect(stats).toEqual({ cpuUsage: 0.1, ramUsage: 0.5 });
      expect(mockGet).toHaveBeenCalledWith('/nodes/pve1/lxc/200/status/current');
    });

    it('should return null on API error', async () => {
      mockGet.mockRejectedValueOnce(new Error('API Error'));
      const node = makeVmNode();

      const stats = await connector.getStats(node);

      expect(stats).toBeNull();
      expect(mockDestroy).toHaveBeenCalled();
    });

    it('should handle zero maxmem gracefully', async () => {
      mockGet.mockResolvedValueOnce({ cpu: 0.5, maxcpu: 2, mem: 0, maxmem: 0 });
      const node = makeVmNode();

      const stats = await connector.getStats(node);

      expect(stats).toEqual({ cpuUsage: 0.5, ramUsage: 0 });
    });
  });

  describe('listResources', () => {
    it('should return discovered resources mapped from Proxmox format', async () => {
      mockGet.mockResolvedValueOnce([
        { id: 'qemu/100', type: 'qemu', vmid: 100, name: 'ubuntu-server', node: 'pve1', status: 'running', template: 0 },
        { id: 'lxc/200', type: 'lxc', vmid: 200, name: 'nginx-proxy', node: 'pve1', status: 'stopped', template: 0 },
      ]);

      const resources = await connector.listResources();

      expect(resources).toHaveLength(2);
      expect(resources[0]).toEqual({
        vmid: 100,
        name: 'ubuntu-server',
        node: 'pve1',
        type: 'qemu',
        status: 'running',
      });
      expect(resources[1]).toEqual({
        vmid: 200,
        name: 'nginx-proxy',
        node: 'pve1',
        type: 'lxc',
        status: 'stopped',
      });
      expect(mockGet).toHaveBeenCalledWith('/cluster/resources?type=vm');
    });

    it('should filter out templates', async () => {
      mockGet.mockResolvedValueOnce([
        { id: 'qemu/100', type: 'qemu', vmid: 100, name: 'ubuntu-server', node: 'pve1', status: 'running', template: 0 },
        { id: 'qemu/9000', type: 'qemu', vmid: 9000, name: 'ubuntu-template', node: 'pve1', status: 'stopped', template: 1 },
      ]);

      const resources = await connector.listResources();

      expect(resources).toHaveLength(1);
      expect(resources[0]!.vmid).toBe(100);
    });

    it('should throw PlatformError on discovery failure', async () => {
      mockGet.mockRejectedValueOnce(new Error('API Error'));

      try {
        await connector.listResources();
        expect.unreachable('should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(PlatformError);
        expect(error).toMatchObject({ code: 'PROXMOX_DISCOVERY_FAILED', platform: 'proxmox' });
      }
    });
  });
});
