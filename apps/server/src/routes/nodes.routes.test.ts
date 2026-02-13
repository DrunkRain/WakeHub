import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
import fastifyCookie from '@fastify/cookie';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { unlinkSync } from 'node:fs';
import argon2 from 'argon2';
import * as schema from '../db/schema.js';
import nodesRoutes from './nodes.routes.js';

// Mock the connector factory to avoid real network calls
const { mockTestConnection, mockProxmoxGet, mockProxmoxDestroy, mockListResources, mockDockerPing, mockDockerGet, mockDockerListResources } = vi.hoisted(() => ({
  mockTestConnection: vi.fn(),
  mockProxmoxGet: vi.fn(),
  mockProxmoxDestroy: vi.fn(),
  mockListResources: vi.fn(),
  mockDockerPing: vi.fn(),
  mockDockerGet: vi.fn(),
  mockDockerListResources: vi.fn(),
}));

vi.mock('../connectors/connector-factory.js', () => ({
  getConnector: () => ({
    testConnection: mockTestConnection,
    start: vi.fn(),
    stop: vi.fn(),
    getStatus: vi.fn(),
  }),
}));

vi.mock('../connectors/proxmox-client.js', () => ({
  ProxmoxClient: class {
    get = mockProxmoxGet;
    post = vi.fn();
    destroy = mockProxmoxDestroy;
  },
}));

vi.mock('../connectors/proxmox.connector.js', () => ({
  ProxmoxConnector: class {
    listResources = mockListResources;
    testConnection = vi.fn();
    start = vi.fn();
    stop = vi.fn();
    getStatus = vi.fn();
  },
}));

vi.mock('../connectors/docker-client.js', () => ({
  DockerClient: class {
    ping = mockDockerPing;
    get = mockDockerGet;
    post = vi.fn();
  },
}));

vi.mock('../connectors/docker.connector.js', () => ({
  DockerConnector: class {
    listResources = mockDockerListResources;
    testConnection = vi.fn();
    start = vi.fn();
    stop = vi.fn();
    getStatus = vi.fn();
  },
}));

const TEST_DB_PATH = './test-nodes-db.sqlite';

describe('Nodes Routes', () => {
  let app: FastifyInstance;
  let db: ReturnType<typeof drizzle>;
  let sqlite: Database.Database;
  let sessionToken: string;

  beforeAll(async () => {
    sqlite = new Database(TEST_DB_PATH);
    sqlite.pragma('journal_mode = WAL');
    sqlite.pragma('foreign_keys = ON');
    db = drizzle(sqlite, { schema });
    migrate(db, { migrationsFolder: './drizzle' });

    app = Fastify();
    await app.register(fastifyCookie);
    app.decorate('db', db as any);

    // Simulate auth middleware — inject userId on all requests
    app.addHook('preHandler', async (request) => {
      request.userId = 'test-user-id';
    });

    await app.register(nodesRoutes);
    await app.ready();

    // Create a test user and session for auth
    const passwordHash = await argon2.hash('TestPass123');
    sqlite.prepare(
      `INSERT INTO users (id, username, password_hash, security_question, security_answer_hash, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).run('test-user-id', 'testuser', passwordHash, 'Question?', 'answer-hash', Date.now(), Date.now());

    sessionToken = crypto.randomUUID();
    const expiresAt = Date.now() + 3600000;
    sqlite.prepare(
      `INSERT INTO sessions (id, user_id, token, expires_at, created_at) VALUES (?, ?, ?, ?, ?)`,
    ).run(crypto.randomUUID(), 'test-user-id', sessionToken, expiresAt, Date.now());
  });

  afterAll(async () => {
    await app.close();
    sqlite.close();
    try {
      unlinkSync(TEST_DB_PATH);
      unlinkSync(`${TEST_DB_PATH}-shm`);
      unlinkSync(`${TEST_DB_PATH}-wal`);
    } catch {
      // Ignore cleanup errors
    }
  });

  beforeEach(() => {
    sqlite.prepare('DELETE FROM nodes').run();
    sqlite.prepare('DELETE FROM operation_logs').run();
    vi.clearAllMocks();
  });

  describe('POST /api/nodes', () => {
    it('should create a physical node', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/nodes',
        payload: {
          name: 'Mon Serveur',
          type: 'physical',
          ipAddress: '192.168.1.10',
          macAddress: 'AA:BB:CC:DD:EE:FF',
          sshUser: 'root',
          sshPassword: 'secret123',
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data.node.name).toBe('Mon Serveur');
      expect(body.data.node.type).toBe('physical');
      expect(body.data.node.ipAddress).toBe('192.168.1.10');
      expect(body.data.node.macAddress).toBe('AA:BB:CC:DD:EE:FF');
      expect(body.data.node.sshUser).toBe('root');
      expect(body.data.node.status).toBe('offline');
      expect(body.data.node.confirmBeforeShutdown).toBe(true);
      // Credentials should NOT be exposed
      expect(body.data.node.sshCredentialsEncrypted).toBeUndefined();
    });

    it('should encrypt SSH password in database', async () => {
      await app.inject({
        method: 'POST',
        url: '/api/nodes',
        payload: {
          name: 'Encrypted Node',
          type: 'physical',
          ipAddress: '192.168.1.20',
          sshUser: 'admin',
          sshPassword: 'mypassword',
        },
      });

      const row = sqlite.prepare('SELECT ssh_credentials_encrypted FROM nodes WHERE name = ?').get('Encrypted Node') as { ssh_credentials_encrypted: string };
      expect(row.ssh_credentials_encrypted).toBeDefined();
      expect(row.ssh_credentials_encrypted).not.toBe('mypassword');
      // Encrypted format: iv:authTag:encrypted
      expect(row.ssh_credentials_encrypted.split(':')).toHaveLength(3);
    });

    it('should log the operation', async () => {
      await app.inject({
        method: 'POST',
        url: '/api/nodes',
        payload: {
          name: 'Logged Node',
          type: 'physical',
        },
      });

      const log = sqlite.prepare('SELECT * FROM operation_logs WHERE source = ?').get('nodes') as { message: string; level: string };
      expect(log).toBeDefined();
      expect(log.level).toBe('info');
      expect(log.message).toContain('Logged Node');
    });

    it('should reject invalid body (missing name)', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/nodes',
        payload: { type: 'physical' },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should reject invalid type', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/nodes',
        payload: { name: 'Bad', type: 'invalid' },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should return structured error when DB insert fails (e.g. invalid parentId FK)', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/nodes',
        payload: {
          name: 'Bad Parent',
          type: 'physical',
          parentId: 'non-existent-parent-id',
        },
      });

      // Should return structured JSON error, not a raw 500
      expect(response.statusCode).toBeGreaterThanOrEqual(400);
      const body = JSON.parse(response.body);
      expect(body.error).toBeDefined();
      expect(body.error.code).toBeDefined();
      expect(body.error.message).toBeDefined();
    });

    it('should create node without SSH credentials', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/nodes',
        payload: {
          name: 'NAS',
          type: 'physical',
          ipAddress: '192.168.1.50',
          macAddress: '11:22:33:44:55:66',
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data.node.sshUser).toBeNull();
    });
  });

  describe('GET /api/nodes', () => {
    it('should return empty array when no nodes exist', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/nodes',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data.nodes).toEqual([]);
    });

    it('should return all configured nodes', async () => {
      // Create two nodes
      await app.inject({
        method: 'POST',
        url: '/api/nodes',
        payload: { name: 'Server A', type: 'physical', ipAddress: '10.0.0.1' },
      });
      await app.inject({
        method: 'POST',
        url: '/api/nodes',
        payload: { name: 'Server B', type: 'physical', ipAddress: '10.0.0.2' },
      });

      const response = await app.inject({
        method: 'GET',
        url: '/api/nodes',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data.nodes).toHaveLength(2);
      // Credentials should NOT be in list
      for (const node of body.data.nodes) {
        expect(node.sshCredentialsEncrypted).toBeUndefined();
      }
    });
  });

  describe('GET /api/nodes/:id', () => {
    it('should return a single node', async () => {
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/nodes',
        payload: { name: 'My Server', type: 'physical', ipAddress: '10.0.0.1' },
      });
      const nodeId = JSON.parse(createRes.body).data.node.id;

      const response = await app.inject({
        method: 'GET',
        url: `/api/nodes/${nodeId}`,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data.node.name).toBe('My Server');
      expect(body.data.node.sshCredentialsEncrypted).toBeUndefined();
    });

    it('should return 404 for non-existent node', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/nodes/non-existent',
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.error.code).toBe('NODE_NOT_FOUND');
    });
  });

  describe('POST /api/nodes/:id/test-connection', () => {
    it('should return success when connection test passes', async () => {
      mockTestConnection.mockResolvedValue(true);

      // Create a node first
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/nodes',
        payload: {
          name: 'Testable',
          type: 'physical',
          ipAddress: '192.168.1.100',
          sshUser: 'root',
          sshPassword: 'pass',
        },
      });
      const nodeId = JSON.parse(createRes.body).data.node.id;

      const response = await app.inject({
        method: 'POST',
        url: `/api/nodes/${nodeId}/test-connection`,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data.success).toBe(true);
      expect(body.data.message).toBe('Connection successful');
    });

    it('should return 404 for non-existent node', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/nodes/non-existent-id/test-connection',
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.error.code).toBe('NODE_NOT_FOUND');
    });

    it('should return error when connection test fails', async () => {
      const { PlatformError } = await import('../utils/platform-error.js');
      mockTestConnection.mockRejectedValue(
        new PlatformError('SSH_CONNECTION_FAILED', 'Connection refused', 'wol-ssh', { host: '192.168.1.100' }),
      );

      const createRes = await app.inject({
        method: 'POST',
        url: '/api/nodes',
        payload: {
          name: 'Failing',
          type: 'physical',
          ipAddress: '192.168.1.100',
          sshUser: 'root',
          sshPassword: 'pass',
        },
      });
      const nodeId = JSON.parse(createRes.body).data.node.id;

      const response = await app.inject({
        method: 'POST',
        url: `/api/nodes/${nodeId}/test-connection`,
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error.code).toBe('SSH_CONNECTION_FAILED');
      expect(body.error.details.platform).toBe('wol-ssh');
    });
  });

  describe('PUT /api/nodes/:id/capabilities/proxmox', () => {
    it('should configure Proxmox and run discovery', async () => {
      // Mock: Proxmox connection test succeeds
      mockProxmoxGet.mockResolvedValueOnce([{ node: 'pve1', status: 'online' }]);
      // Mock: discovery returns resources
      mockListResources.mockResolvedValueOnce([
        { vmid: 100, name: 'ubuntu-vm', node: 'pve1', type: 'qemu', status: 'running' },
        { vmid: 200, name: 'nginx-lxc', node: 'pve1', type: 'lxc', status: 'stopped' },
      ]);

      // Create a physical node
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/nodes',
        payload: { name: 'Proxmox Host', type: 'physical', ipAddress: '10.0.0.1' },
      });
      const nodeId = JSON.parse(createRes.body).data.node.id;

      const response = await app.inject({
        method: 'PUT',
        url: `/api/nodes/${nodeId}/capabilities/proxmox`,
        payload: {
          host: '10.0.0.1',
          port: 8006,
          authType: 'token',
          tokenId: 'root@pam!monitoring',
          tokenSecret: 'secret-uuid',
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);

      // Node should have proxmox capability (without encrypted fields)
      expect(body.data.node.capabilities.proxmox_api).toBeDefined();
      expect(body.data.node.capabilities.proxmox_api.host).toBe('10.0.0.1');
      expect(body.data.node.capabilities.proxmox_api.tokenId).toBe('root@pam!monitoring');
      // Encrypted fields should NOT be exposed
      expect(body.data.node.capabilities.proxmox_api.tokenSecretEncrypted).toBeUndefined();

      // Discovered nodes
      expect(body.data.discovered).toHaveLength(2);
      expect(body.data.discovered[0].name).toBe('ubuntu-vm');
      expect(body.data.discovered[0].type).toBe('vm');
      expect(body.data.discovered[1].name).toBe('nginx-lxc');
      expect(body.data.discovered[1].type).toBe('lxc');
    });

    it('should encrypt token secret in database', async () => {
      mockProxmoxGet.mockResolvedValueOnce([{ node: 'pve1' }]);
      mockListResources.mockResolvedValueOnce([]);

      const createRes = await app.inject({
        method: 'POST',
        url: '/api/nodes',
        payload: { name: 'Encrypt Test', type: 'physical' },
      });
      const nodeId = JSON.parse(createRes.body).data.node.id;

      await app.inject({
        method: 'PUT',
        url: `/api/nodes/${nodeId}/capabilities/proxmox`,
        payload: {
          host: '10.0.0.1',
          authType: 'token',
          tokenId: 'root@pam!test',
          tokenSecret: 'my-super-secret',
        },
      });

      const row = sqlite.prepare('SELECT capabilities FROM nodes WHERE id = ?').get(nodeId) as { capabilities: string };
      const caps = JSON.parse(row.capabilities);
      expect(caps.proxmox_api.tokenSecretEncrypted).toBeDefined();
      expect(caps.proxmox_api.tokenSecretEncrypted).not.toBe('my-super-secret');
      // Should be AES-256-GCM format
      expect(caps.proxmox_api.tokenSecretEncrypted.split(':')).toHaveLength(3);
    });

    it('should return 404 for non-existent node', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: '/api/nodes/non-existent/capabilities/proxmox',
        payload: { host: '10.0.0.1', authType: 'token', tokenId: 'id', tokenSecret: 'secret' },
      });

      expect(response.statusCode).toBe(404);
    });

    it('should reject non-physical node', async () => {
      // Insert a VM node directly
      sqlite.prepare(
        `INSERT INTO nodes (id, name, type, status, is_pinned, confirm_before_shutdown, discovered, configured, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run('vm-node', 'Test VM', 'vm', 'offline', 0, 0, 1, 0, Date.now(), Date.now());

      const response = await app.inject({
        method: 'PUT',
        url: '/api/nodes/vm-node/capabilities/proxmox',
        payload: { host: '10.0.0.1', authType: 'token', tokenId: 'id', tokenSecret: 'secret' },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error.code).toBe('INVALID_NODE_TYPE');
    });

    it('should return error when Proxmox connection fails', async () => {
      mockProxmoxGet.mockRejectedValueOnce(new Error('connect ECONNREFUSED'));

      const createRes = await app.inject({
        method: 'POST',
        url: '/api/nodes',
        payload: { name: 'Bad PVE', type: 'physical' },
      });
      const nodeId = JSON.parse(createRes.body).data.node.id;

      const response = await app.inject({
        method: 'PUT',
        url: `/api/nodes/${nodeId}/capabilities/proxmox`,
        payload: { host: 'unreachable.host', authType: 'token', tokenId: 'id', tokenSecret: 'secret' },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error.code).toBe('PROXMOX_CONNECTION_FAILED');
    });

    it('should log the operation', async () => {
      mockProxmoxGet.mockResolvedValueOnce([{ node: 'pve1' }]);
      mockListResources.mockResolvedValueOnce([]);

      const createRes = await app.inject({
        method: 'POST',
        url: '/api/nodes',
        payload: { name: 'LogMe', type: 'physical' },
      });
      const nodeId = JSON.parse(createRes.body).data.node.id;

      await app.inject({
        method: 'PUT',
        url: `/api/nodes/${nodeId}/capabilities/proxmox`,
        payload: { host: '10.0.0.1', authType: 'token', tokenId: 'id', tokenSecret: 'secret' },
      });

      const logs = sqlite.prepare('SELECT * FROM operation_logs WHERE message LIKE ?').all('%Proxmox configured%') as Array<{ message: string }>;
      expect(logs.length).toBeGreaterThan(0);
      expect(logs[0]!.message).toContain('LogMe');
    });

    it('should support password authentication', async () => {
      mockProxmoxGet.mockResolvedValueOnce([{ node: 'pve1' }]);
      mockListResources.mockResolvedValueOnce([]);

      const createRes = await app.inject({
        method: 'POST',
        url: '/api/nodes',
        payload: { name: 'PW Auth', type: 'physical' },
      });
      const nodeId = JSON.parse(createRes.body).data.node.id;

      const response = await app.inject({
        method: 'PUT',
        url: `/api/nodes/${nodeId}/capabilities/proxmox`,
        payload: {
          host: '10.0.0.1',
          authType: 'password',
          username: 'root@pam',
          password: 'mypassword',
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data.node.capabilities.proxmox_api.authType).toBe('password');
      expect(body.data.node.capabilities.proxmox_api.username).toBe('root@pam');
      // Encrypted field should NOT be exposed
      expect(body.data.node.capabilities.proxmox_api.passwordEncrypted).toBeUndefined();

      // Verify password is encrypted in DB
      const row = sqlite.prepare('SELECT capabilities FROM nodes WHERE id = ?').get(nodeId) as { capabilities: string };
      const caps = JSON.parse(row.capabilities);
      expect(caps.proxmox_api.passwordEncrypted).toBeDefined();
      expect(caps.proxmox_api.passwordEncrypted.split(':')).toHaveLength(3);
    });
  });

  describe('PATCH /api/nodes/:id', () => {
    it('should update node name', async () => {
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/nodes',
        payload: { name: 'Old Name', type: 'physical' },
      });
      const nodeId = JSON.parse(createRes.body).data.node.id;

      const response = await app.inject({
        method: 'PATCH',
        url: `/api/nodes/${nodeId}`,
        payload: { name: 'New Name' },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data.node.name).toBe('New Name');
    });

    it('should mark node as configured', async () => {
      // Insert a discovered VM directly
      sqlite.prepare(
        `INSERT INTO nodes (id, name, type, status, is_pinned, confirm_before_shutdown, discovered, configured, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run('disc-vm', 'Discovered VM', 'vm', 'offline', 0, 0, 1, 0, Date.now(), Date.now());

      const response = await app.inject({
        method: 'PATCH',
        url: '/api/nodes/disc-vm',
        payload: { configured: true, name: 'My VM' },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data.node.configured).toBe(true);
      expect(body.data.node.name).toBe('My VM');
    });

    it('should update serviceUrl', async () => {
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/nodes',
        payload: { name: 'SVC Node', type: 'physical' },
      });
      const nodeId = JSON.parse(createRes.body).data.node.id;

      const response = await app.inject({
        method: 'PATCH',
        url: `/api/nodes/${nodeId}`,
        payload: { serviceUrl: 'https://my-service.local:8080' },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data.node.serviceUrl).toBe('https://my-service.local:8080');
    });

    it('should return 404 for non-existent node', async () => {
      const response = await app.inject({
        method: 'PATCH',
        url: '/api/nodes/non-existent',
        payload: { name: 'Updated' },
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.error.code).toBe('NODE_NOT_FOUND');
    });

    it('should reject invalid name (too long)', async () => {
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/nodes',
        payload: { name: 'Node', type: 'physical' },
      });
      const nodeId = JSON.parse(createRes.body).data.node.id;

      const response = await app.inject({
        method: 'PATCH',
        url: `/api/nodes/${nodeId}`,
        payload: { name: 'A'.repeat(101) },
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe('PUT /api/nodes/:id/capabilities/docker', () => {
    it('should configure Docker and run discovery', async () => {
      mockDockerPing.mockResolvedValueOnce(true);
      mockDockerListResources.mockResolvedValueOnce([
        { containerId: 'abc123', name: 'my-nginx', image: 'nginx:latest', state: 'running', status: 'Up 2h', ports: [] },
        { containerId: 'def456', name: 'my-redis', image: 'redis:7', state: 'exited', status: 'Exited', ports: [] },
      ]);

      const createRes = await app.inject({
        method: 'POST',
        url: '/api/nodes',
        payload: { name: 'Docker Host', type: 'physical', ipAddress: '10.0.0.1' },
      });
      const nodeId = JSON.parse(createRes.body).data.node.id;

      const response = await app.inject({
        method: 'PUT',
        url: `/api/nodes/${nodeId}/capabilities/docker`,
        payload: { host: '10.0.0.1', port: 2375 },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);

      expect(body.data.node.capabilities.docker_api).toBeDefined();
      expect(body.data.node.capabilities.docker_api.host).toBe('10.0.0.1');
      expect(body.data.node.capabilities.docker_api.port).toBe(2375);

      expect(body.data.discovered).toHaveLength(2);
      expect(body.data.discovered[0].name).toBe('my-nginx');
      expect(body.data.discovered[0].type).toBe('container');
      expect(body.data.discovered[0].discovered).toBe(true);
      expect(body.data.discovered[0].configured).toBe(false);
      expect(body.data.discovered[0].platformRef.platform).toBe('docker');
      expect(body.data.discovered[0].platformRef.platformId).toBe('abc123');
      expect(body.data.discovered[1].name).toBe('my-redis');
    });

    it('should accept Docker on vm type nodes', async () => {
      mockDockerPing.mockResolvedValueOnce(true);
      mockDockerListResources.mockResolvedValueOnce([]);

      // Insert a VM node directly
      sqlite.prepare(
        `INSERT INTO nodes (id, name, type, status, is_pinned, confirm_before_shutdown, discovered, configured, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run('docker-vm', 'Docker VM', 'vm', 'online', 0, 0, 0, 1, Date.now(), Date.now());

      const response = await app.inject({
        method: 'PUT',
        url: '/api/nodes/docker-vm/capabilities/docker',
        payload: { host: '10.0.0.2', port: 2375 },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data.node.capabilities.docker_api.host).toBe('10.0.0.2');
    });

    it('should accept Docker on lxc type nodes', async () => {
      mockDockerPing.mockResolvedValueOnce(true);
      mockDockerListResources.mockResolvedValueOnce([]);

      sqlite.prepare(
        `INSERT INTO nodes (id, name, type, status, is_pinned, confirm_before_shutdown, discovered, configured, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run('docker-lxc', 'Docker LXC', 'lxc', 'online', 0, 0, 0, 1, Date.now(), Date.now());

      const response = await app.inject({
        method: 'PUT',
        url: '/api/nodes/docker-lxc/capabilities/docker',
        payload: { host: '10.0.0.3', port: 2375 },
      });

      expect(response.statusCode).toBe(200);
    });

    it('should reject Docker on container type nodes', async () => {
      sqlite.prepare(
        `INSERT INTO nodes (id, name, type, status, is_pinned, confirm_before_shutdown, discovered, configured, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run('docker-container', 'My Container', 'container', 'online', 0, 0, 1, 0, Date.now(), Date.now());

      const response = await app.inject({
        method: 'PUT',
        url: '/api/nodes/docker-container/capabilities/docker',
        payload: { host: '10.0.0.1', port: 2375 },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error.code).toBe('INVALID_NODE_TYPE');
    });

    it('should return 404 for non-existent node', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: '/api/nodes/non-existent/capabilities/docker',
        payload: { host: '10.0.0.1', port: 2375 },
      });

      expect(response.statusCode).toBe(404);
    });

    it('should return error when Docker connection fails', async () => {
      mockDockerPing.mockRejectedValueOnce(new Error('connect ECONNREFUSED'));

      const createRes = await app.inject({
        method: 'POST',
        url: '/api/nodes',
        payload: { name: 'Bad Docker', type: 'physical' },
      });
      const nodeId = JSON.parse(createRes.body).data.node.id;

      const response = await app.inject({
        method: 'PUT',
        url: `/api/nodes/${nodeId}/capabilities/docker`,
        payload: { host: 'unreachable.host', port: 2375 },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error.code).toBe('DOCKER_CONNECTION_FAILED');
    });

    it('should validate body (missing host)', async () => {
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/nodes',
        payload: { name: 'Validation Test', type: 'physical' },
      });
      const nodeId = JSON.parse(createRes.body).data.node.id;

      const response = await app.inject({
        method: 'PUT',
        url: `/api/nodes/${nodeId}/capabilities/docker`,
        payload: { port: 2375 },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should log the operation', async () => {
      mockDockerPing.mockResolvedValueOnce(true);
      mockDockerListResources.mockResolvedValueOnce([]);

      const createRes = await app.inject({
        method: 'POST',
        url: '/api/nodes',
        payload: { name: 'DockerLog', type: 'physical' },
      });
      const nodeId = JSON.parse(createRes.body).data.node.id;

      await app.inject({
        method: 'PUT',
        url: `/api/nodes/${nodeId}/capabilities/docker`,
        payload: { host: '10.0.0.1', port: 2375 },
      });

      const logs = sqlite.prepare('SELECT * FROM operation_logs WHERE message LIKE ?').all('%Docker configured%') as Array<{ message: string }>;
      expect(logs.length).toBeGreaterThan(0);
      expect(logs[0]!.message).toContain('DockerLog');
    });
  });
});
