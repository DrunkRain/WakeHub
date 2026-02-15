import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Node } from '@wakehub/shared';

const { mockConnect, mockDispose, mockExecCommand, mockWake } = vi.hoisted(() => ({
  mockConnect: vi.fn(),
  mockDispose: vi.fn(),
  mockExecCommand: vi.fn(),
  mockWake: vi.fn(),
}));

vi.mock('node-ssh', () => ({
  NodeSSH: class {
    connect = mockConnect;
    dispose = mockDispose;
    execCommand = mockExecCommand;
  },
}));

vi.mock('wake_on_lan', () => ({
  default: { wake: mockWake },
}));

import { WolSshConnector } from './wol-ssh.connector.js';
import { PlatformError } from '../utils/platform-error.js';

function makeNode(overrides: Partial<Node> = {}): Node {
  return {
    id: 'node-1',
    name: 'Test Server',
    type: 'physical',
    status: 'offline',
    ipAddress: '192.168.1.10',
    macAddress: 'AA:BB:CC:DD:EE:FF',
    sshUser: 'root',
    sshCredentialsEncrypted: 'decrypted-password',
    parentId: null,
    capabilities: null,
    platformRef: null,
    serviceUrl: null,
    isPinned: false,
    confirmBeforeShutdown: true,
    discovered: false,
    configured: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe('WolSshConnector', () => {
  let connector: WolSshConnector;

  beforeEach(() => {
    vi.clearAllMocks();
    connector = new WolSshConnector();
  });

  describe('testConnection', () => {
    it('should return true when SSH connection succeeds', async () => {
      mockConnect.mockResolvedValue(undefined);
      const node = makeNode();

      const result = await connector.testConnection(node);

      expect(result).toBe(true);
      expect(mockConnect).toHaveBeenCalledWith({
        host: '192.168.1.10',
        username: 'root',
        password: 'decrypted-password',
        readyTimeout: 10_000,
      });
      expect(mockDispose).toHaveBeenCalled();
    });

    it('should throw PlatformError when SSH connection fails', async () => {
      mockConnect.mockRejectedValue(new Error('Connection refused'));
      const node = makeNode();

      await expect(connector.testConnection(node)).rejects.toThrow(PlatformError);
      await expect(connector.testConnection(node)).rejects.toMatchObject({
        code: 'SSH_CONNECTION_FAILED',
        platform: 'wol-ssh',
      });
    });

    it('should throw PlatformError when IP is missing', async () => {
      const node = makeNode({ ipAddress: null });

      await expect(connector.testConnection(node)).rejects.toThrow(PlatformError);
      await expect(connector.testConnection(node)).rejects.toMatchObject({
        code: 'SSH_CONNECTION_FAILED',
      });
    });

    it('should throw PlatformError when SSH user is missing', async () => {
      const node = makeNode({ sshUser: null });

      await expect(connector.testConnection(node)).rejects.toThrow(PlatformError);
    });
  });

  describe('start', () => {
    it('should send WoL magic packet', async () => {
      mockWake.mockImplementation((_mac: string, cb: (err?: Error) => void) => cb());
      const node = makeNode();

      await connector.start(node);

      expect(mockWake).toHaveBeenCalledWith('AA:BB:CC:DD:EE:FF', expect.any(Function));
    });

    it('should throw PlatformError when MAC address is missing', async () => {
      const node = makeNode({ macAddress: null });

      await expect(connector.start(node)).rejects.toThrow(PlatformError);
      await expect(connector.start(node)).rejects.toMatchObject({
        code: 'WOL_SEND_FAILED',
      });
    });

    it('should throw PlatformError when WoL fails', async () => {
      mockWake.mockImplementation((_mac: string, cb: (err?: Error) => void) =>
        cb(new Error('Network error')),
      );
      const node = makeNode();

      await expect(connector.start(node)).rejects.toThrow(PlatformError);
      await expect(connector.start(node)).rejects.toMatchObject({
        code: 'WOL_SEND_FAILED',
      });
    });
  });

  describe('stop', () => {
    it('should execute shutdown command via SSH', async () => {
      mockConnect.mockResolvedValue(undefined);
      mockExecCommand.mockResolvedValue({ stdout: '', stderr: '' });
      const node = makeNode();

      await connector.stop(node);

      expect(mockConnect).toHaveBeenCalled();
      expect(mockExecCommand).toHaveBeenCalledWith('sudo shutdown -h now');
      expect(mockDispose).toHaveBeenCalled();
    });

    it('should throw PlatformError when SSH fails during stop', async () => {
      mockConnect.mockRejectedValue(new Error('Auth failed'));
      const node = makeNode();

      await expect(connector.stop(node)).rejects.toThrow(PlatformError);
      await expect(connector.stop(node)).rejects.toMatchObject({
        code: 'SSH_COMMAND_FAILED',
      });
    });

    it('should throw PlatformError when IP or user is missing for stop', async () => {
      const node = makeNode({ sshUser: null });

      await expect(connector.stop(node)).rejects.toThrow(PlatformError);
    });
  });

  describe('getStatus', () => {
    it('should return error when IP is missing', async () => {
      const node = makeNode({ ipAddress: null });

      const status = await connector.getStatus(node);

      expect(status).toBe('error');
    });
  });
});
