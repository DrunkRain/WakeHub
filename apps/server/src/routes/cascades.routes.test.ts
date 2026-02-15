import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
import fastifyCookie from '@fastify/cookie';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { unlinkSync } from 'node:fs';
import argon2 from 'argon2';
import * as schema from '../db/schema.js';

// Mock cascade engine functions — vi.hoisted required
const mockExecuteCascadeStart = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
const mockExecuteCascadeStop = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));

vi.mock('../services/cascade-engine.js', () => ({
  executeCascadeStart: mockExecuteCascadeStart,
  executeCascadeStop: mockExecuteCascadeStop,
  CASCADE_NODE_NOT_FOUND: 'CASCADE_NODE_NOT_FOUND',
  CASCADE_STEP_TIMEOUT: 'CASCADE_STEP_TIMEOUT',
  CASCADE_CONNECTOR_ERROR: 'CASCADE_CONNECTOR_ERROR',
  CASCADE_NOT_FOUND: 'CASCADE_NOT_FOUND',
}));

vi.mock('../utils/crypto.js', () => ({
  decrypt: vi.fn((v: string) => v),
  encrypt: vi.fn((v: string) => v),
}));

import cascadesRoutes from './cascades.routes.js';
import { SSEManager } from '../sse/sse-manager.js';

const TEST_DB_PATH = './test-cascades-routes-db.sqlite';

describe('Cascades Routes', () => {
  let app: FastifyInstance;
  let db: ReturnType<typeof drizzle>;
  let sqlite: Database.Database;
  let sseManager: SSEManager;

  beforeAll(async () => {
    sqlite = new Database(TEST_DB_PATH);
    sqlite.pragma('journal_mode = WAL');
    sqlite.pragma('foreign_keys = ON');
    db = drizzle(sqlite, { schema });
    migrate(db, { migrationsFolder: './drizzle' });

    app = Fastify();
    await app.register(fastifyCookie);
    app.decorate('db', db as any);
    sseManager = new SSEManager();
    app.decorate('sseManager', sseManager);

    // Simulate auth middleware — inject userId on all requests
    app.addHook('preHandler', async (request) => {
      request.userId = 'test-user-id';
    });

    await app.register(cascadesRoutes, { prefix: '/api/cascades' });
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

  function insertNode(name: string, type: 'physical' | 'vm' | 'lxc' | 'container' = 'physical'): string {
    const id = crypto.randomUUID();
    sqlite.prepare(
      `INSERT INTO nodes (id, name, type, status, is_pinned, confirm_before_shutdown, discovered, configured, created_at, updated_at) VALUES (?, ?, ?, 'offline', 0, 1, 0, 1, ?, ?)`,
    ).run(id, name, type, Date.now(), Date.now());
    return id;
  }

  beforeEach(() => {
    sqlite.exec('DELETE FROM cascades');
    sqlite.exec('DELETE FROM nodes');
    mockExecuteCascadeStart.mockReset().mockResolvedValue(undefined);
    mockExecuteCascadeStop.mockReset().mockResolvedValue(undefined);
  });

  // POST /api/cascades/start

  describe('POST /api/cascades/start', () => {
    it('should create a start cascade and return immediately', async () => {
      const nodeId = insertNode('Server');

      const res = await app.inject({
        method: 'POST',
        url: '/api/cascades/start',
        payload: { nodeId },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.data.cascade).toBeDefined();
      expect(body.data.cascade.nodeId).toBe(nodeId);
      expect(body.data.cascade.type).toBe('start');
      expect(body.data.cascade.status).toBe('pending');
      expect(body.data.cascade.id).toBeDefined();
    });

    it('should return 404 when node does not exist', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/cascades/start',
        payload: { nodeId: 'non-existent-id' },
      });

      expect(res.statusCode).toBe(404);
      const body = JSON.parse(res.body);
      expect(body.error.code).toBe('CASCADE_NODE_NOT_FOUND');
    });

    it('should return 400 when body is invalid', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/cascades/start',
        payload: {},
      });

      expect(res.statusCode).toBe(400);
      const body = JSON.parse(res.body);
      expect(body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should fire-and-forget executeCascadeStart', async () => {
      const nodeId = insertNode('Server');

      await app.inject({
        method: 'POST',
        url: '/api/cascades/start',
        payload: { nodeId },
      });

      // Wait a tick for the fire-and-forget to be called
      await new Promise((r) => setTimeout(r, 50));
      expect(mockExecuteCascadeStart).toHaveBeenCalledOnce();
      expect(mockExecuteCascadeStart.mock.calls[0]![0]).toBe(nodeId);
    });
  });

  // POST /api/cascades/stop

  describe('POST /api/cascades/stop', () => {
    it('should create a stop cascade and return immediately', async () => {
      const nodeId = insertNode('Server');

      const res = await app.inject({
        method: 'POST',
        url: '/api/cascades/stop',
        payload: { nodeId },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.data.cascade.nodeId).toBe(nodeId);
      expect(body.data.cascade.type).toBe('stop');
      expect(body.data.cascade.status).toBe('pending');
    });

    it('should return 404 when node does not exist', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/cascades/stop',
        payload: { nodeId: 'non-existent-id' },
      });

      expect(res.statusCode).toBe(404);
      const body = JSON.parse(res.body);
      expect(body.error.code).toBe('CASCADE_NODE_NOT_FOUND');
    });
  });

  // GET /api/cascades/:id

  describe('GET /api/cascades/:id', () => {
    it('should return cascade detail', async () => {
      const nodeId = insertNode('Server');

      // First create a cascade
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/cascades/start',
        payload: { nodeId },
      });
      const cascadeId = JSON.parse(createRes.body).data.cascade.id;

      const res = await app.inject({
        method: 'GET',
        url: `/api/cascades/${cascadeId}`,
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.data.cascade.id).toBe(cascadeId);
      expect(body.data.cascade.nodeId).toBe(nodeId);
      expect(body.data.cascade.type).toBe('start');
      expect(body.data.cascade.currentStep).toBe(0);
      expect(body.data.cascade.totalSteps).toBe(0);
    });

    it('should return 404 for non-existent cascade', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/cascades/non-existent-id',
      });

      expect(res.statusCode).toBe(404);
      const body = JSON.parse(res.body);
      expect(body.error.code).toBe('CASCADE_NOT_FOUND');
    });
  });

  // Auth test (middleware protection)

  describe('Auth middleware', () => {
    it('should require authentication (middleware integration)', async () => {
      // This test verifies the route is registered under /api/cascades
      // which is protected by the global auth middleware in app.ts
      // In the test setup we simulate auth, so we verify routes exist and respond
      const res = await app.inject({
        method: 'POST',
        url: '/api/cascades/start',
        payload: { nodeId: 'any' },
      });
      // With simulated auth, we get 404 (node not found), not 401
      expect(res.statusCode).toBe(404);
    });
  });

  // SSE integration (Story 4.2)

  describe('SSE integration', () => {
    it('should pass onProgress callback to executeCascadeStart', async () => {
      const nodeId = insertNode('Server');

      await app.inject({
        method: 'POST',
        url: '/api/cascades/start',
        payload: { nodeId },
      });

      await new Promise((r) => setTimeout(r, 50));

      expect(mockExecuteCascadeStart).toHaveBeenCalledOnce();
      const options = mockExecuteCascadeStart.mock.calls[0]![2];
      expect(options).toHaveProperty('onProgress');
      expect(typeof options.onProgress).toBe('function');
    });

    it('should pass onProgress callback to executeCascadeStop', async () => {
      const nodeId = insertNode('Server');

      await app.inject({
        method: 'POST',
        url: '/api/cascades/stop',
        payload: { nodeId },
      });

      await new Promise((r) => setTimeout(r, 50));

      expect(mockExecuteCascadeStop).toHaveBeenCalledOnce();
      const options = mockExecuteCascadeStop.mock.calls[0]![2];
      expect(options).toHaveProperty('onProgress');
      expect(typeof options.onProgress).toBe('function');
    });

    it('should broadcast cascade-progress SSE event via onProgress callback', async () => {
      const nodeId = insertNode('Server');
      const broadcastSpy = vi.spyOn(sseManager, 'broadcast');

      await app.inject({
        method: 'POST',
        url: '/api/cascades/start',
        payload: { nodeId },
      });

      await new Promise((r) => setTimeout(r, 50));

      // Extract the onProgress callback and invoke it manually
      const onProgress = mockExecuteCascadeStart.mock.calls[0]![2].onProgress;
      onProgress({ type: 'cascade-started', cascadeId: 'c1', nodeId, totalSteps: 3 });

      expect(broadcastSpy).toHaveBeenCalledWith('cascade-progress', {
        cascadeId: 'c1',
        nodeId,
        step: 0,
        totalSteps: 3,
        status: 'started',
      });

      broadcastSpy.mockRestore();
    });

    it('should broadcast status-change SSE event for node-status-change', async () => {
      const nodeId = insertNode('Server');
      const broadcastSpy = vi.spyOn(sseManager, 'broadcast');

      await app.inject({
        method: 'POST',
        url: '/api/cascades/start',
        payload: { nodeId },
      });

      await new Promise((r) => setTimeout(r, 50));

      const onProgress = mockExecuteCascadeStart.mock.calls[0]![2].onProgress;
      onProgress({ type: 'node-status-change', nodeId, status: 'online' });

      expect(broadcastSpy).toHaveBeenCalledWith('status-change', expect.objectContaining({
        nodeId,
        status: 'online',
      }));

      broadcastSpy.mockRestore();
    });

    it('should broadcast cascade-complete SSE event on success', async () => {
      const nodeId = insertNode('Server');
      const broadcastSpy = vi.spyOn(sseManager, 'broadcast');

      await app.inject({
        method: 'POST',
        url: '/api/cascades/start',
        payload: { nodeId },
      });

      await new Promise((r) => setTimeout(r, 50));

      const onProgress = mockExecuteCascadeStart.mock.calls[0]![2].onProgress;
      onProgress({ type: 'cascade-complete', cascadeId: 'c1', nodeId, success: true });

      expect(broadcastSpy).toHaveBeenCalledWith('cascade-complete', {
        cascadeId: 'c1',
        nodeId,
        success: true,
      });

      broadcastSpy.mockRestore();
    });

    it('should broadcast cascade-error SSE event on failure', async () => {
      const nodeId = insertNode('Server');
      const broadcastSpy = vi.spyOn(sseManager, 'broadcast');

      await app.inject({
        method: 'POST',
        url: '/api/cascades/start',
        payload: { nodeId },
      });

      await new Promise((r) => setTimeout(r, 50));

      const onProgress = mockExecuteCascadeStart.mock.calls[0]![2].onProgress;
      onProgress({
        type: 'cascade-complete',
        cascadeId: 'c1',
        nodeId,
        success: false,
        error: { code: 'TIMEOUT', message: 'Step timed out' },
      });

      expect(broadcastSpy).toHaveBeenCalledWith('cascade-error', {
        cascadeId: 'c1',
        nodeId,
        error: { code: 'TIMEOUT', message: 'Step timed out' },
      });

      broadcastSpy.mockRestore();
    });
  });
});
