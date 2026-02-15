import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
import fastifyCookie from '@fastify/cookie';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { unlinkSync } from 'node:fs';
import * as schema from '../db/schema.js';
import logsRoutes from './logs.routes.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const TEST_DB_PATH = join(__dirname, '../../test-logs-routes-db.sqlite');

describe('Logs Routes', () => {
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

    await app.register(logsRoutes, { prefix: '/api/logs' });
    await app.ready();
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
    sqlite.prepare('DELETE FROM operation_logs').run();
  });

  function insertLog(overrides: Partial<{
    id: string;
    timestamp: number;
    level: string;
    source: string;
    message: string;
    reason: string | null;
    details: string | null;
    nodeId: string | null;
    nodeName: string | null;
    eventType: string | null;
    errorCode: string | null;
    errorDetails: string | null;
    cascadeId: string | null;
  }> = {}): string {
    const id = overrides.id ?? crypto.randomUUID();
    sqlite.prepare(
      `INSERT INTO operation_logs (id, timestamp, level, source, message, reason, details, node_id, node_name, event_type, error_code, error_details, cascade_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      id,
      overrides.timestamp ?? Math.floor(Date.now() / 1000),
      overrides.level ?? 'info',
      overrides.source ?? 'test',
      overrides.message ?? 'Test log message',
      overrides.reason ?? null,
      overrides.details ?? null,
      overrides.nodeId ?? null,
      overrides.nodeName ?? null,
      overrides.eventType ?? null,
      overrides.errorCode ?? null,
      overrides.errorDetails ?? null,
      overrides.cascadeId ?? null,
    );
    return id;
  }

  // --- Schema tests (AC #1) ---

  describe('Schema — new columns accept null', () => {
    it('should accept log with all new columns null', async () => {
      insertLog({ message: 'minimal log' });

      const res = await app.inject({ method: 'GET', url: '/api/logs' });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.data.logs).toHaveLength(1);
      expect(body.data.logs[0].nodeId).toBeNull();
      expect(body.data.logs[0].nodeName).toBeNull();
      expect(body.data.logs[0].eventType).toBeNull();
      expect(body.data.logs[0].errorCode).toBeNull();
      expect(body.data.logs[0].errorDetails).toBeNull();
      expect(body.data.logs[0].cascadeId).toBeNull();
    });

    it('should accept log with all new columns populated', async () => {
      insertLog({
        message: 'full log',
        nodeId: 'node-1',
        nodeName: 'Server A',
        eventType: 'start',
        errorCode: 'TIMEOUT',
        errorDetails: JSON.stringify({ detail: 'timeout after 30s' }),
        cascadeId: 'cascade-1',
      });

      const res = await app.inject({ method: 'GET', url: '/api/logs' });
      expect(res.statusCode).toBe(200);
      const log = res.json().data.logs[0];
      expect(log.nodeId).toBe('node-1');
      expect(log.nodeName).toBe('Server A');
      expect(log.eventType).toBe('start');
      expect(log.errorCode).toBe('TIMEOUT');
      expect(log.errorDetails).toEqual({ detail: 'timeout after 30s' });
      expect(log.cascadeId).toBe('cascade-1');
    });
  });

  // --- GET /api/logs tests (AC #6) ---

  describe('GET /api/logs — pagination', () => {
    it('should return empty list when no logs', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/logs' });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.data.logs).toEqual([]);
      expect(body.data.total).toBe(0);
    });

    it('should return logs with default pagination (limit 50, offset 0)', async () => {
      for (let i = 0; i < 5; i++) {
        insertLog({ message: `Log ${i}` });
      }

      const res = await app.inject({ method: 'GET', url: '/api/logs' });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.data.logs).toHaveLength(5);
      expect(body.data.total).toBe(5);
    });

    it('should respect limit parameter', async () => {
      for (let i = 0; i < 10; i++) {
        insertLog({ message: `Log ${i}` });
      }

      const res = await app.inject({ method: 'GET', url: '/api/logs?limit=3' });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.data.logs).toHaveLength(3);
      expect(body.data.total).toBe(10);
    });

    it('should respect offset parameter', async () => {
      for (let i = 0; i < 5; i++) {
        insertLog({ message: `Log ${i}`, timestamp: Math.floor(Date.now() / 1000) - (4 - i) });
      }

      const res = await app.inject({ method: 'GET', url: '/api/logs?offset=3' });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.data.logs).toHaveLength(2);
      expect(body.data.total).toBe(5);
    });

    it('should order by timestamp descending (most recent first)', async () => {
      const now = Math.floor(Date.now() / 1000);
      insertLog({ message: 'Oldest', timestamp: now - 3 });
      insertLog({ message: 'Middle', timestamp: now - 2 });
      insertLog({ message: 'Newest', timestamp: now - 1 });

      const res = await app.inject({ method: 'GET', url: '/api/logs' });
      const logs = res.json().data.logs;
      expect(logs[0].message).toBe('Newest');
      expect(logs[1].message).toBe('Middle');
      expect(logs[2].message).toBe('Oldest');
    });
  });

  describe('GET /api/logs — filters', () => {
    it('should filter by nodeId', async () => {
      insertLog({ message: 'Node A log', nodeId: 'node-a' });
      insertLog({ message: 'Node B log', nodeId: 'node-b' });
      insertLog({ message: 'No node log' });

      const res = await app.inject({ method: 'GET', url: '/api/logs?nodeId=node-a' });
      const body = res.json();
      expect(body.data.logs).toHaveLength(1);
      expect(body.data.logs[0].message).toBe('Node A log');
      expect(body.data.total).toBe(1);
    });

    it('should filter by eventType', async () => {
      insertLog({ message: 'Start event', eventType: 'start' });
      insertLog({ message: 'Stop event', eventType: 'stop' });
      insertLog({ message: 'Error event', eventType: 'error' });

      const res = await app.inject({ method: 'GET', url: '/api/logs?eventType=start' });
      const body = res.json();
      expect(body.data.logs).toHaveLength(1);
      expect(body.data.logs[0].message).toBe('Start event');
    });

    it('should filter by level', async () => {
      insertLog({ message: 'Info log', level: 'info' });
      insertLog({ message: 'Warn log', level: 'warn' });
      insertLog({ message: 'Error log', level: 'error' });

      const res = await app.inject({ method: 'GET', url: '/api/logs?level=error' });
      const body = res.json();
      expect(body.data.logs).toHaveLength(1);
      expect(body.data.logs[0].message).toBe('Error log');
    });

    it('should filter by cascadeId', async () => {
      insertLog({ message: 'Cascade A', cascadeId: 'cascade-a' });
      insertLog({ message: 'Cascade B', cascadeId: 'cascade-b' });
      insertLog({ message: 'No cascade' });

      const res = await app.inject({ method: 'GET', url: '/api/logs?cascadeId=cascade-a' });
      const body = res.json();
      expect(body.data.logs).toHaveLength(1);
      expect(body.data.logs[0].message).toBe('Cascade A');
    });

    it('should filter by dateFrom', async () => {
      const nowSec = Math.floor(Date.now() / 1000);
      insertLog({ message: 'Old log', timestamp: nowSec - 86400 * 2 }); // 2 days ago
      insertLog({ message: 'Recent log', timestamp: nowSec - 3600 }); // 1 hour ago

      const dateFrom = new Date((nowSec - 86400) * 1000).toISOString(); // 1 day ago
      const res = await app.inject({ method: 'GET', url: `/api/logs?dateFrom=${dateFrom}` });
      const body = res.json();
      expect(body.data.logs).toHaveLength(1);
      expect(body.data.logs[0].message).toBe('Recent log');
    });

    it('should filter by dateTo', async () => {
      const nowSec = Math.floor(Date.now() / 1000);
      insertLog({ message: 'Old log', timestamp: nowSec - 86400 * 2 }); // 2 days ago
      insertLog({ message: 'Recent log', timestamp: nowSec - 3600 }); // 1 hour ago

      const dateTo = new Date((nowSec - 86400) * 1000).toISOString(); // 1 day ago
      const res = await app.inject({ method: 'GET', url: `/api/logs?dateTo=${dateTo}` });
      const body = res.json();
      expect(body.data.logs).toHaveLength(1);
      expect(body.data.logs[0].message).toBe('Old log');
    });

    it('should filter by search in message', async () => {
      insertLog({ message: 'Node started successfully' });
      insertLog({ message: 'Node stopped' });
      insertLog({ message: 'Error occurred' });

      const res = await app.inject({ method: 'GET', url: '/api/logs?search=started' });
      const body = res.json();
      expect(body.data.logs).toHaveLength(1);
      expect(body.data.logs[0].message).toBe('Node started successfully');
    });

    it('should filter by search in reason', async () => {
      insertLog({ message: 'Log 1', reason: 'timeout exceeded' });
      insertLog({ message: 'Log 2', reason: 'connection lost' });
      insertLog({ message: 'Log 3' });

      const res = await app.inject({ method: 'GET', url: '/api/logs?search=timeout' });
      const body = res.json();
      expect(body.data.logs).toHaveLength(1);
      expect(body.data.logs[0].message).toBe('Log 1');
    });

    it('should combine multiple filters', async () => {
      insertLog({ message: 'Node A start', nodeId: 'node-a', eventType: 'start', level: 'info' });
      insertLog({ message: 'Node A error', nodeId: 'node-a', eventType: 'error', level: 'error' });
      insertLog({ message: 'Node B start', nodeId: 'node-b', eventType: 'start', level: 'info' });

      const res = await app.inject({ method: 'GET', url: '/api/logs?nodeId=node-a&eventType=start' });
      const body = res.json();
      expect(body.data.logs).toHaveLength(1);
      expect(body.data.logs[0].message).toBe('Node A start');
    });
  });

  describe('GET /api/logs — validation', () => {
    it('should reject invalid limit (> 200)', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/logs?limit=500' });
      expect(res.statusCode).toBe(400);
    });

    it('should reject invalid limit (< 1)', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/logs?limit=0' });
      expect(res.statusCode).toBe(400);
    });

    it('should reject invalid offset (< 0)', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/logs?offset=-1' });
      expect(res.statusCode).toBe(400);
    });

    it('should reject invalid eventType', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/logs?eventType=invalid' });
      expect(res.statusCode).toBe(400);
    });

    it('should reject invalid level', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/logs?level=debug' });
      expect(res.statusCode).toBe(400);
    });
  });

  describe('GET /api/logs — response format', () => {
    it('should return logs with all fields in camelCase', async () => {
      insertLog({
        message: 'Full log',
        level: 'error',
        source: 'cascade-engine',
        reason: 'Timeout',
        details: JSON.stringify({ step: 1 }),
        nodeId: 'n1',
        nodeName: 'Server',
        eventType: 'error',
        errorCode: 'TIMEOUT',
        errorDetails: JSON.stringify({ timeout: 30 }),
        cascadeId: 'c1',
      });

      const res = await app.inject({ method: 'GET', url: '/api/logs' });
      const log = res.json().data.logs[0];

      expect(log).toHaveProperty('id');
      expect(log).toHaveProperty('timestamp');
      expect(log.level).toBe('error');
      expect(log.source).toBe('cascade-engine');
      expect(log.message).toBe('Full log');
      expect(log.reason).toBe('Timeout');
      expect(log.details).toEqual({ step: 1 });
      expect(log.nodeId).toBe('n1');
      expect(log.nodeName).toBe('Server');
      expect(log.eventType).toBe('error');
      expect(log.errorCode).toBe('TIMEOUT');
      expect(log.errorDetails).toEqual({ timeout: 30 });
      expect(log.cascadeId).toBe('c1');
    });

    it('should return timestamp as ISO 8601 string', async () => {
      insertLog({ message: 'Time test' });

      const res = await app.inject({ method: 'GET', url: '/api/logs' });
      const log = res.json().data.logs[0];
      // Should be a valid ISO date string
      expect(() => new Date(log.timestamp)).not.toThrow();
      expect(log.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });
  });
});
