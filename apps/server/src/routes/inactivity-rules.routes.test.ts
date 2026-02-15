import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
import fastifyCookie from '@fastify/cookie';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { unlinkSync } from 'node:fs';
import argon2 from 'argon2';
import * as schema from '../db/schema.js';
import inactivityRulesRoutes from './inactivity-rules.routes.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const TEST_DB_PATH = join(__dirname, '../../test-inactivity-rules-routes-db.sqlite');

describe('Inactivity Rules Routes', () => {
  let app: FastifyInstance;
  let db: ReturnType<typeof drizzle>;
  let sqlite: Database.Database;

  beforeAll(async () => {
    sqlite = new Database(TEST_DB_PATH);
    sqlite.pragma('journal_mode = WAL');
    sqlite.pragma('foreign_keys = ON');
    db = drizzle(sqlite, { schema });
    migrate(db, { migrationsFolder: join(__dirname, '../../drizzle') });

    app = Fastify();
    await app.register(fastifyCookie);
    app.decorate('db', db as any);
    app.decorate('sseManager', { broadcast: vi.fn() });

    app.addHook('preHandler', async (request) => {
      request.userId = 'test-user-id';
    });

    await app.register(inactivityRulesRoutes, { prefix: '/api/inactivity-rules' });
    await app.ready();

    // Create a test user
    const passwordHash = await argon2.hash('TestPass123');
    sqlite.prepare(
      `INSERT INTO users (id, username, password_hash, security_question, security_answer_hash, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).run('test-user-id', 'testuser', passwordHash, 'Question?', 'answer-hash', Date.now(), Date.now());
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

  function insertNode(name: string): string {
    const id = crypto.randomUUID();
    sqlite.prepare(
      `INSERT INTO nodes (id, name, type, status, configured, created_at, updated_at, is_pinned, confirm_before_shutdown, discovered) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(id, name, 'physical', 'online', 1, Date.now(), Date.now(), 0, 1, 0);
    return id;
  }

  function insertRule(nodeId: string, opts: { timeoutMinutes?: number; isEnabled?: boolean } = {}): string {
    const id = crypto.randomUUID();
    sqlite.prepare(
      `INSERT INTO inactivity_rules (id, node_id, timeout_minutes, monitoring_criteria, is_enabled, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      id, nodeId,
      opts.timeoutMinutes ?? 30,
      JSON.stringify({ lastAccess: true, networkConnections: false, cpuRamActivity: false }),
      (opts.isEnabled ?? true) ? 1 : 0,
      Date.now(), Date.now(),
    );
    return id;
  }

  beforeEach(() => {
    sqlite.exec('DELETE FROM inactivity_rules');
    sqlite.exec("DELETE FROM nodes WHERE id != 'test-user-id'");
  });

  // ============================================================
  // POST /api/inactivity-rules
  // ============================================================

  describe('POST /api/inactivity-rules', () => {
    it('should create a rule for a valid node', async () => {
      const nodeId = insertNode('Server1');

      const response = await app.inject({
        method: 'POST',
        url: '/api/inactivity-rules',
        payload: {
          nodeId,
          timeoutMinutes: 15,
        },
      });

      expect(response.statusCode).toBe(201);
      const body = response.json();
      expect(body.data.rule.nodeId).toBe(nodeId);
      expect(body.data.rule.timeoutMinutes).toBe(15);
      expect(body.data.rule.isEnabled).toBe(true);
    });

    it('should create a rule with default values', async () => {
      const nodeId = insertNode('Server2');

      const response = await app.inject({
        method: 'POST',
        url: '/api/inactivity-rules',
        payload: { nodeId },
      });

      expect(response.statusCode).toBe(201);
      const body = response.json();
      expect(body.data.rule.timeoutMinutes).toBe(30);
      expect(body.data.rule.isEnabled).toBe(true);
    });

    it('should return 404 for non-existent node', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/inactivity-rules',
        payload: { nodeId: 'non-existent-id' },
      });

      expect(response.statusCode).toBe(404);
      const body = response.json();
      expect(body.error.code).toBe('NODE_NOT_FOUND');
    });

    it('should return 400 for missing nodeId', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/inactivity-rules',
        payload: {},
      });

      expect(response.statusCode).toBe(400);
    });
  });

  // ============================================================
  // GET /api/inactivity-rules?nodeId=X
  // ============================================================

  describe('GET /api/inactivity-rules', () => {
    it('should return rules for a given nodeId', async () => {
      const nodeId = insertNode('Server1');
      insertRule(nodeId, { timeoutMinutes: 20 });

      const response = await app.inject({
        method: 'GET',
        url: `/api/inactivity-rules?nodeId=${nodeId}`,
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.data.rules).toHaveLength(1);
      expect(body.data.rules[0].nodeId).toBe(nodeId);
      expect(body.data.rules[0].timeoutMinutes).toBe(20);
    });

    it('should return empty array for node with no rules', async () => {
      const nodeId = insertNode('Server2');

      const response = await app.inject({
        method: 'GET',
        url: `/api/inactivity-rules?nodeId=${nodeId}`,
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.data.rules).toHaveLength(0);
    });

    it('should return 400 if nodeId is missing', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/inactivity-rules',
      });

      expect(response.statusCode).toBe(400);
    });
  });

  // ============================================================
  // PUT /api/inactivity-rules/:id
  // ============================================================

  describe('PUT /api/inactivity-rules/:id', () => {
    it('should update timeoutMinutes', async () => {
      const nodeId = insertNode('Server1');
      const ruleId = insertRule(nodeId, { timeoutMinutes: 30 });

      const response = await app.inject({
        method: 'PUT',
        url: `/api/inactivity-rules/${ruleId}`,
        payload: { timeoutMinutes: 60 },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.data.rule.timeoutMinutes).toBe(60);
    });

    it('should update isEnabled', async () => {
      const nodeId = insertNode('Server1');
      const ruleId = insertRule(nodeId);

      const response = await app.inject({
        method: 'PUT',
        url: `/api/inactivity-rules/${ruleId}`,
        payload: { isEnabled: false },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.data.rule.isEnabled).toBe(false);
    });

    it('should update monitoringCriteria', async () => {
      const nodeId = insertNode('Server1');
      const ruleId = insertRule(nodeId);

      const response = await app.inject({
        method: 'PUT',
        url: `/api/inactivity-rules/${ruleId}`,
        payload: {
          monitoringCriteria: {
            lastAccess: false,
            networkConnections: true,
            cpuRamActivity: false,
          },
        },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.data.rule.monitoringCriteria).toEqual({
        lastAccess: false,
        networkConnections: true,
        cpuRamActivity: false,
      });
    });

    it('should return 404 for non-existent rule', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: '/api/inactivity-rules/non-existent-id',
        payload: { timeoutMinutes: 10 },
      });

      expect(response.statusCode).toBe(404);
      const body = response.json();
      expect(body.error.code).toBe('INACTIVITY_RULE_NOT_FOUND');
    });

    it('should accept networkTraffic and networkTrafficThreshold in monitoringCriteria', async () => {
      const nodeId = insertNode('Server1');
      const ruleId = insertRule(nodeId);

      const response = await app.inject({
        method: 'PUT',
        url: `/api/inactivity-rules/${ruleId}`,
        payload: {
          monitoringCriteria: {
            lastAccess: false,
            networkConnections: false,
            cpuRamActivity: false,
            networkTraffic: true,
            networkTrafficThreshold: 2048,
          },
        },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.data.rule.monitoringCriteria).toEqual(expect.objectContaining({
        networkTraffic: true,
        networkTrafficThreshold: 2048,
      }));
    });

    it('should reject invalid timeoutMinutes', async () => {
      const nodeId = insertNode('Server1');
      const ruleId = insertRule(nodeId);

      const response = await app.inject({
        method: 'PUT',
        url: `/api/inactivity-rules/${ruleId}`,
        payload: { timeoutMinutes: 0 },
      });

      expect(response.statusCode).toBe(400);
    });
  });
});
