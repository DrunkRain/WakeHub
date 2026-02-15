import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
import fastifyCookie from '@fastify/cookie';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { unlinkSync } from 'node:fs';
import argon2 from 'argon2';
import * as schema from '../db/schema.js';
import statsRoutes from './stats.routes.js';

const TEST_DB_PATH = './test-stats-routes-db.sqlite';

describe('Stats Routes', () => {
  let app: FastifyInstance;
  let db: ReturnType<typeof drizzle>;
  let sqlite: Database.Database;

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

    await app.register(statsRoutes, { prefix: '/api/stats' });
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

  beforeEach(() => {
    sqlite.prepare('DELETE FROM cascades').run();
    sqlite.prepare('DELETE FROM nodes').run();
  });

  function insertNode(name: string, status: string = 'offline'): string {
    const id = crypto.randomUUID();
    sqlite.prepare(
      `INSERT INTO nodes (id, name, type, status, is_pinned, confirm_before_shutdown, discovered, configured, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(id, name, 'physical', status, 0, 1, 0, 1, Date.now(), Date.now());
    return id;
  }

  function insertCascade(nodeId: string, status: string, startedAt: Date, completedAt: Date | null): string {
    const id = crypto.randomUUID();
    sqlite.prepare(
      `INSERT INTO cascades (id, node_id, type, status, current_step, total_steps, started_at, completed_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(id, nodeId, 'start', status, 0, 1, Math.floor(startedAt.getTime() / 1000), completedAt ? Math.floor(completedAt.getTime() / 1000) : null);
    return id;
  }

  describe('GET /api/stats/dashboard', () => {
    it('should return zeros when database is empty', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/stats/dashboard',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data).toEqual({
        nodesOnline: 0,
        nodesTotal: 0,
        cascadesToday: 0,
        avgCascadeDurationMs: null,
      });
    });

    it('should return correct node counts', async () => {
      insertNode('Server A', 'online');
      insertNode('Server B', 'online');
      insertNode('Server C', 'offline');
      insertNode('Server D', 'error');

      const response = await app.inject({
        method: 'GET',
        url: '/api/stats/dashboard',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data.nodesOnline).toBe(2);
      expect(body.data.nodesTotal).toBe(4);
    });

    it('should return correct cascade stats for today', async () => {
      const nodeId = insertNode('Server A', 'online');

      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

      // Completed cascade today — 5 seconds duration
      const start1 = new Date(todayStart.getTime() + 3600000); // 1h after midnight
      const end1 = new Date(start1.getTime() + 5000); // +5s
      insertCascade(nodeId, 'completed', start1, end1);

      // Completed cascade today — 15 seconds duration
      const start2 = new Date(todayStart.getTime() + 7200000); // 2h after midnight
      const end2 = new Date(start2.getTime() + 15000); // +15s
      insertCascade(nodeId, 'completed', start2, end2);

      // In-progress cascade today (no completedAt)
      const start3 = new Date(todayStart.getTime() + 10800000); // 3h after midnight
      insertCascade(nodeId, 'in_progress', start3, null);

      // Completed cascade YESTERDAY — should NOT count
      const yesterday = new Date(todayStart.getTime() - 86400000);
      const yesterdayEnd = new Date(yesterday.getTime() + 10000);
      insertCascade(nodeId, 'completed', yesterday, yesterdayEnd);

      const response = await app.inject({
        method: 'GET',
        url: '/api/stats/dashboard',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data.cascadesToday).toBe(3); // All 3 started today
      expect(body.data.avgCascadeDurationMs).toBe(10000); // avg(5000, 15000) = 10000
    });

    it('should only count configured nodes in total', async () => {
      insertNode('Configured Online', 'online');
      insertNode('Configured Offline', 'offline');

      // Insert a discovered/unconfigured node
      const unconfiguredId = crypto.randomUUID();
      sqlite.prepare(
        `INSERT INTO nodes (id, name, type, status, is_pinned, confirm_before_shutdown, discovered, configured, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(unconfiguredId, 'Discovered VM', 'vm', 'offline', 0, 1, 1, 0, Date.now(), Date.now());

      const response = await app.inject({
        method: 'GET',
        url: '/api/stats/dashboard',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      // Unconfigured nodes should not count in total
      expect(body.data.nodesTotal).toBe(2);
      expect(body.data.nodesOnline).toBe(1);
    });
  });
});
