import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EventEmitter } from 'node:events';
import { PlatformError } from '../utils/platform-error.js';

const mockWake = vi.fn();
let lastSshClient: EventEmitter & {
  connect: ReturnType<typeof vi.fn>;
  end: ReturnType<typeof vi.fn>;
  destroy: ReturnType<typeof vi.fn>;
  exec: ReturnType<typeof vi.fn>;
};

vi.mock('ssh2', () => {
  const { EventEmitter: EE } = require('node:events');
  return {
    Client: class extends EE {
      connect = vi.fn();
      end = vi.fn();
      destroy = vi.fn();
      exec = vi.fn();
      constructor() {
        super();
        // Store reference to latest instance for test assertions
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (globalThis as any).__lastSshClient = this;
      }
    },
  };
});

vi.mock('wake_on_lan', () => ({
  default: { wake: mockWake },
}));

const { WolSshConnector } = await import('./wol-ssh.connector.js');

function getLastClient() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (globalThis as any).__lastSshClient as typeof lastSshClient;
}

const TEST_CONFIG = {
  host: '192.168.1.100',
  macAddress: 'AA:BB:CC:DD:EE:FF',
  sshUser: 'admin',
  sshPassword: 'secret',
};

describe('WolSshConnector', () => {
  let connector: InstanceType<typeof WolSshConnector>;

  beforeEach(() => {
    vi.clearAllMocks();
    connector = new WolSshConnector(TEST_CONFIG);
  });

  describe('testConnection()', () => {
    it('returns success when SSH connects', async () => {
      const promise = connector.testConnection();
      const client = getLastClient();
      client.connect.mockImplementation(() => {});
      client.emit('ready');
      const result = await promise;
      expect(result.success).toBe(true);
      expect(result.message).toContain('réussie');
    });

    it('returns failure when SSH errors', async () => {
      const promise = connector.testConnection();
      const client = getLastClient();
      client.emit('error', new Error('Connection refused'));
      const result = await promise;
      expect(result.success).toBe(false);
      expect(result.message).toContain('Connection refused');
    });
  });

  describe('start()', () => {
    it('calls wol.wake with correct MAC address', async () => {
      mockWake.mockImplementation(
        (_mac: string, _opts: unknown, cb: (err: Error | undefined) => void) => {
          cb(undefined);
        },
      );

      await connector.start();
      expect(mockWake).toHaveBeenCalledWith(
        'AA:BB:CC:DD:EE:FF',
        { address: '255.255.255.255' },
        expect.any(Function),
      );
    });

    it('throws PlatformError when wol.wake fails', async () => {
      mockWake.mockImplementation(
        (_mac: string, _opts: unknown, cb: (err: Error | undefined) => void) => {
          cb(new Error('Network unreachable'));
        },
      );

      await expect(connector.start()).rejects.toThrow(PlatformError);
    });

    it('PlatformError has correct code and platform', async () => {
      mockWake.mockImplementation(
        (_mac: string, _opts: unknown, cb: (err: Error | undefined) => void) => {
          cb(new Error('Network unreachable'));
        },
      );

      try {
        await connector.start();
        expect.fail('Should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(PlatformError);
        expect((err as PlatformError).code).toBe('WOL_SEND_FAILED');
        expect((err as PlatformError).platform).toBe('wol-ssh');
      }
    });
  });

  describe('stop()', () => {
    it('executes SSH shutdown command', async () => {
      const promise = connector.stop();
      const client = getLastClient();
      client.exec.mockImplementation((_cmd: string, cb: (err: Error | null) => void) => {
        cb(null);
        setTimeout(() => client.emit('close'), 10);
      });
      client.emit('ready');

      await promise;
      expect(client.exec).toHaveBeenCalledWith('sudo shutdown -h now', expect.any(Function));
    });

    it('throws PlatformError when SSH connection fails', async () => {
      const promise = connector.stop();
      const client = getLastClient();
      client.emit('error', new Error('Connection refused'));

      try {
        await promise;
        expect.fail('Should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(PlatformError);
        expect((err as PlatformError).code).toBe('SSH_CONNECTION_FAILED');
        expect((err as PlatformError).platform).toBe('wol-ssh');
      }
    });
  });

  describe('getStatus()', () => {
    it('returns online when SSH connects', async () => {
      const promise = connector.getStatus();
      const client = getLastClient();
      client.emit('ready');
      const status = await promise;
      expect(status).toBe('online');
    });

    it('returns offline when SSH errors', async () => {
      const promise = connector.getStatus();
      const client = getLastClient();
      client.emit('error', new Error('timeout'));
      const status = await promise;
      expect(status).toBe('offline');
    });
  });
});
