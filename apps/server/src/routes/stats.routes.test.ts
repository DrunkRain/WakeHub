import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
import fastifyCookie from '@fastify/cookie';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { unlinkSync } from 'node:fs';
import * as schema from '../db/schema.js';
import statsRoutes from './stats.routes.js';

const TEST_DB_PATH = './test-stats-routes-db.sqlite';

describe('Stats Routes', () => {
  let app: FastifyInstance;
  let sqlite: Database.Database;

  beforeAll(async () => {
    sqlite = new Database(TEST_DB_PATH);
    sqlite.pragma('journal_mode = WAL');
    sqlite.pragma('foreign_keys = ON');
    const db = drizzle(sqlite, { schema });
    migrate(db, { migrationsFolder: './drizzle' });

    app = Fastify();
    await app.register(fastifyCookie);
    app.decorate('db', db as unknown);
    await app.register(statsRoutes);
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
    sqlite.exec('DELETE FROM cascades');
    sqlite.exec('DELETE FROM services');
  });

  describe('GET /api/stats', () => {
    it('should return zeros when no data exists -> 200', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/stats',
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.data).toEqual({
        activeServices: 0,
        cascadesToday: 0,
        avgCascadeTime: 0,
        inactivityHours: 0,
      });
    });

    it('should count active services (running + serviceUrl)', async () => {
      const now = Math.floor(Date.now() / 1000);
      // Running with serviceUrl -> counted
      sqlite.exec(`
        INSERT INTO services (id, name, type, status, service_url, created_at, updated_at) VALUES
          ('s1', 'Jellyfin', 'vm', 'running', 'http://jf:8096', ${now}, ${now})
      `);
      // Running without serviceUrl -> not counted
      sqlite.exec(`
        INSERT INTO services (id, name, type, status, created_at, updated_at) VALUES
          ('s2', 'DNS', 'vm', 'running', ${now}, ${now})
      `);
      // Stopped with serviceUrl -> not counted
      sqlite.exec(`
        INSERT INTO services (id, name, type, status, service_url, created_at, updated_at) VALUES
          ('s3', 'Nextcloud', 'vm', 'stopped', 'http://nc:8080', ${now}, ${now})
      `);

      const res = await app.inject({ method: 'GET', url: '/api/stats' });

      expect(res.statusCode).toBe(200);
      expect(res.json().data.activeServices).toBe(1);
    });

    it('should count cascades started today', async () => {
      const now = Date.now();
      const todayTimestamp = Math.floor(now / 1000);
      const yesterdayTimestamp = todayTimestamp - 86400;

      sqlite.exec(`
        INSERT INTO cascades (id, service_id, type, status, current_step, total_steps, started_at) VALUES
          ('c1', 's1', 'start', 'completed', 3, 3, ${todayTimestamp})
      `);
      sqlite.exec(`
        INSERT INTO cascades (id, service_id, type, status, current_step, total_steps, started_at) VALUES
          ('c2', 's2', 'start', 'in_progress', 1, 3, ${todayTimestamp})
      `);
      // Cascade from yesterday -> not counted
      sqlite.exec(`
        INSERT INTO cascades (id, service_id, type, status, current_step, total_steps, started_at) VALUES
          ('c3', 's1', 'start', 'completed', 3, 3, ${yesterdayTimestamp})
      `);

      const res = await app.inject({ method: 'GET', url: '/api/stats' });

      expect(res.statusCode).toBe(200);
      expect(res.json().data.cascadesToday).toBe(2);
    });

    it('should compute avg cascade time for completed cascades today', async () => {
      const now = Math.floor(Date.now() / 1000);

      sqlite.exec(`
        INSERT INTO cascades (id, service_id, type, status, current_step, total_steps, started_at, completed_at) VALUES
          ('c1', 's1', 'start', 'completed', 3, 3, ${now - 10}, ${now})
      `);
      sqlite.exec(`
        INSERT INTO cascades (id, service_id, type, status, current_step, total_steps, started_at, completed_at) VALUES
          ('c2', 's2', 'start', 'completed', 3, 3, ${now - 20}, ${now})
      `);

      const res = await app.inject({ method: 'GET', url: '/api/stats' });

      expect(res.statusCode).toBe(200);
      expect(res.json().data.avgCascadeTime).toBe(15);
    });

    it('should return inactivityHours as 0 (v1 simplified)', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/stats' });

      expect(res.statusCode).toBe(200);
      expect(res.json().data.inactivityHours).toBe(0);
    });
  });
});
