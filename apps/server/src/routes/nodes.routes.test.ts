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
const { mockTestConnection } = vi.hoisted(() => ({
  mockTestConnection: vi.fn(),
}));

vi.mock('../connectors/connector-factory.js', () => ({
  getConnector: () => ({
    testConnection: mockTestConnection,
    start: vi.fn(),
    stop: vi.fn(),
    getStatus: vi.fn(),
  }),
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
});
