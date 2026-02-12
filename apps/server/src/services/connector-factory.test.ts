import { describe, it, expect, beforeEach, vi } from 'vitest';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { services } from '../db/schema.js';
import { createConnectorForNode } from './connector-factory.js';

// Mock connectors — use class syntax so `new X()` works
vi.mock('../connectors/wol-ssh.connector.js', () => ({
  WolSshConnector: class {
    _type = 'wol-ssh';
    _config: unknown;
    constructor(config: unknown) { this._config = config; }
    start = vi.fn();
    stop = vi.fn();
    getStatus = vi.fn();
    testConnection = vi.fn();
  },
}));

vi.mock('../connectors/proxmox.connector.js', () => ({
  ProxmoxConnector: class {
    _type = 'proxmox';
    _config: unknown;
    constructor(config: unknown) { this._config = config; }
    start = vi.fn();
    stop = vi.fn();
    getStatus = vi.fn();
    testConnection = vi.fn();
  },
}));

vi.mock('../connectors/docker.connector.js', () => ({
  DockerConnector: class {
    _type = 'docker';
    _config: unknown;
    constructor(config: unknown) { this._config = config; }
    start = vi.fn();
    stop = vi.fn();
    getStatus = vi.fn();
    testConnection = vi.fn();
  },
}));

// Mock crypto
vi.mock('../utils/crypto.js', () => ({
  decrypt: vi.fn((val: string) => val === 'encrypted-ssh' ? 'sshpass123' : '{"username":"root@pam","password":"proxpass"}'),
}));

describe('connector-factory', () => {
  let db: ReturnType<typeof drizzle>;

  beforeEach(() => {
    const sqlite = new Database(':memory:');
    db = drizzle(sqlite);
    migrate(db, { migrationsFolder: './drizzle' });

    db.delete(services).run();
  });

  describe('physical services', () => {
    it('should return WolSshConnector for physical service', () => {
      db.insert(services).values({
        id: 'm1',
        name: 'NAS',
        type: 'physical',
        ipAddress: '192.168.1.10',
        macAddress: 'AA:BB:CC:DD:EE:FF',
        sshUser: 'admin',
        sshCredentialsEncrypted: 'encrypted-ssh',
        status: 'online',
        createdAt: new Date(),
        updatedAt: new Date(),
      }).run();

      const connector = createConnectorForNode(db, 'service', 'm1');
      expect(connector).not.toBeNull();
      expect((connector as any)._type).toBe('wol-ssh');
    });

    it('should throw for physical service without MAC address', () => {
      db.insert(services).values({
        id: 'm4',
        name: 'NoMAC',
        type: 'physical',
        ipAddress: '192.168.1.40',
        status: 'online',
        createdAt: new Date(),
        updatedAt: new Date(),
      }).run();

      expect(() => createConnectorForNode(db, 'service', 'm4')).toThrow('MAC');
    });
  });

  describe('host services (proxmox/docker)', () => {
    it('should return status-only connector for proxmox service with apiUrl but no WoL', () => {
      db.insert(services).values({
        id: 'm2',
        name: 'PVE',
        type: 'proxmox',
        ipAddress: '192.168.1.20',
        apiUrl: 'https://192.168.1.20:8006',
        status: 'online',
        createdAt: new Date(),
        updatedAt: new Date(),
      }).run();

      const connector = createConnectorForNode(db, 'service', 'm2');
      expect(connector).not.toBeNull();
      // Should have getStatus but start/stop throw
      expect(connector!.getStatus).toBeDefined();
      expect(connector!.start()).rejects.toThrow('pas de WoL');
      expect(connector!.stop()).rejects.toThrow('pas de SSH');
    });

    it('should return status-only connector for docker service with apiUrl but no WoL', () => {
      db.insert(services).values({
        id: 'm3',
        name: 'Docker Host',
        type: 'docker',
        ipAddress: '192.168.1.30',
        apiUrl: 'http://192.168.1.30:2375',
        status: 'online',
        createdAt: new Date(),
        updatedAt: new Date(),
      }).run();

      const connector = createConnectorForNode(db, 'service', 'm3');
      expect(connector).not.toBeNull();
      expect(connector!.getStatus).toBeDefined();
      expect(connector!.start()).rejects.toThrow('pas de WoL');
      expect(connector!.stop()).rejects.toThrow('pas de SSH');
    });

    it('should return null for proxmox service without WoL AND without apiUrl', () => {
      db.insert(services).values({
        id: 'm2-noapi',
        name: 'PVE bare',
        type: 'proxmox',
        ipAddress: '192.168.1.20',
        status: 'online',
        createdAt: new Date(),
        updatedAt: new Date(),
      }).run();

      const connector = createConnectorForNode(db, 'service', 'm2-noapi');
      expect(connector).toBeNull();
    });

    it('should return WolSshConnector for proxmox service with MAC + IP + SSH', () => {
      db.insert(services).values({
        id: 'm2b',
        name: 'PVE WoL',
        type: 'proxmox',
        ipAddress: '192.168.1.20',
        macAddress: 'AA:BB:CC:DD:EE:01',
        sshUser: 'root',
        sshCredentialsEncrypted: 'encrypted-ssh',
        apiUrl: 'https://192.168.1.20:8006',
        status: 'online',
        createdAt: new Date(),
        updatedAt: new Date(),
      }).run();

      const connector = createConnectorForNode(db, 'service', 'm2b');
      expect(connector).not.toBeNull();
      expect((connector as any)._type).toBe('wol-ssh');
    });

    it('should return WolSshConnector for docker service with MAC + IP + SSH', () => {
      db.insert(services).values({
        id: 'm3b',
        name: 'Docker WoL',
        type: 'docker',
        ipAddress: '192.168.1.30',
        macAddress: 'AA:BB:CC:DD:EE:02',
        sshUser: 'admin',
        sshCredentialsEncrypted: 'encrypted-ssh',
        apiUrl: 'http://192.168.1.30:2375',
        status: 'online',
        createdAt: new Date(),
        updatedAt: new Date(),
      }).run();

      const connector = createConnectorForNode(db, 'service', 'm3b');
      expect(connector).not.toBeNull();
      expect((connector as any)._type).toBe('wol-ssh');
    });
  });

  describe('child services (vm/container)', () => {
    it('should return ProxmoxConnector for VM service', () => {
      db.insert(services).values({
        id: 'pm1',
        name: 'PVE Server',
        type: 'proxmox',
        ipAddress: '192.168.1.20',
        apiUrl: 'https://192.168.1.20:8006',
        apiCredentialsEncrypted: 'encrypted-creds',
        status: 'online',
        createdAt: new Date(),
        updatedAt: new Date(),
      }).run();

      db.insert(services).values({
        id: 'r1',
        name: 'VM-Media',
        type: 'vm',
        platformRef: { node: 'pve', vmid: 100 },
        status: 'stopped',
        parentId: 'pm1',
        createdAt: new Date(),
        updatedAt: new Date(),
      }).run();

      const connector = createConnectorForNode(db, 'service', 'r1');
      expect(connector).not.toBeNull();
      expect((connector as any)._type).toBe('proxmox');
    });

    it('should return DockerConnector for container service', () => {
      db.insert(services).values({
        id: 'dm1',
        name: 'Docker Host',
        type: 'docker',
        ipAddress: '192.168.1.30',
        apiUrl: 'http://192.168.1.30:2375',
        status: 'online',
        createdAt: new Date(),
        updatedAt: new Date(),
      }).run();

      db.insert(services).values({
        id: 'r2',
        name: 'jellyfin',
        type: 'container',
        platformRef: { containerId: 'abc123' },
        status: 'stopped',
        parentId: 'dm1',
        createdAt: new Date(),
        updatedAt: new Date(),
      }).run();

      const connector = createConnectorForNode(db, 'service', 'r2');
      expect(connector).not.toBeNull();
      expect((connector as any)._type).toBe('docker');
    });
  });

  it('should throw for missing service', () => {
    expect(() => createConnectorForNode(db, 'service', 'nonexistent')).toThrow('non trouvé');
  });
});
