import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
import fastifyCookie from '@fastify/cookie';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { unlinkSync } from 'node:fs';
import * as schema from '../db/schema.js';
import cascadesRoutes from './cascades.routes.js';

// Mock the cascade engine — we just need to verify the routes call it, not test the engine itself
vi.mock('../services/cascade-engine.js', () => ({
  executeCascadeStart: vi.fn(() => Promise.resolve()),
  executeCascadeStop: vi.fn(() => Promise.resolve()),
}));

const TEST_DB_PATH = './test-cascades-routes-db.sqlite';

describe('Cascades Routes', () => {
  let app: FastifyInstance;
  let sqlite: Database.Database;

  const serviceA = 'service-aaa';
  const serviceB = 'service-bbb';

  beforeAll(async () => {
    sqlite = new Database(TEST_DB_PATH);
    sqlite.pragma('journal_mode = WAL');
    sqlite.pragma('foreign_keys = ON');
    const db = drizzle(sqlite, { schema });
    migrate(db, { migrationsFolder: './drizzle' });

    app = Fastify();
    await app.register(fastifyCookie);
    app.decorate('db', db as unknown);
    await app.register(cascadesRoutes);
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
    sqlite.exec('DELETE FROM operation_logs');
    sqlite.exec('DELETE FROM services');

    const now = Date.now();
    sqlite.exec(`
      INSERT INTO services (id, name, type, ip_address, status, created_at, updated_at) VALUES
        ('${serviceA}', 'NAS', 'physical', '192.168.1.10', 'online', ${now}, ${now})
    `);
    sqlite.exec(`
      INSERT INTO services (id, name, type, status, platform_ref, parent_id, created_at, updated_at) VALUES
        ('${serviceB}', 'VM-Media', 'vm', 'running', '{"node":"pve","vmid":100}', '${serviceA}', ${now}, ${now})
    `);
  });

  describe('POST /api/cascades/start', () => {
    it('should create a start cascade for a valid service -> 200', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/cascades/start',
        payload: { serviceId: serviceB },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.data).toBeDefined();
      expect(body.data.serviceId).toBe(serviceB);
      expect(body.data.type).toBe('start');
      expect(body.data.status).toBe('pending');
      expect(body.data.id).toBeTruthy();
      expect(body.data.startedAt).toBeTruthy();
    });

    it('should create a start cascade for a parent service -> 200', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/cascades/start',
        payload: { serviceId: serviceA },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.data.serviceId).toBe(serviceA);
      expect(body.data.type).toBe('start');
    });

    it('should return 404 for nonexistent service', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/cascades/start',
        payload: { serviceId: 'nonexistent-id' },
      });

      expect(res.statusCode).toBe(404);
      expect(res.json().error.code).toBe('NOT_FOUND');
    });

    it('should return 400 when a cascade is already in progress', async () => {
      const res1 = await app.inject({
        method: 'POST',
        url: '/api/cascades/start',
        payload: { serviceId: serviceB },
      });
      expect(res1.statusCode).toBe(200);

      const res2 = await app.inject({
        method: 'POST',
        url: '/api/cascades/start',
        payload: { serviceId: serviceB },
      });

      expect(res2.statusCode).toBe(400);
      expect(res2.json().error.code).toBe('CASCADE_IN_PROGRESS');
    });

    it('should return 400 for missing serviceId', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/cascades/start',
        payload: {},
      });

      expect(res.statusCode).toBe(400);
    });
  });

  describe('POST /api/cascades/stop', () => {
    it('should create a stop cascade for a valid service -> 200', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/cascades/stop',
        payload: { serviceId: serviceB },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.data.serviceId).toBe(serviceB);
      expect(body.data.type).toBe('stop');
      expect(body.data.status).toBe('pending');
    });

    it('should return 404 for nonexistent service', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/cascades/stop',
        payload: { serviceId: 'nonexistent-id' },
      });

      expect(res.statusCode).toBe(404);
    });

    it('should return 400 when a cascade is already in progress', async () => {
      await app.inject({
        method: 'POST',
        url: '/api/cascades/stop',
        payload: { serviceId: serviceB },
      });

      const res = await app.inject({
        method: 'POST',
        url: '/api/cascades/stop',
        payload: { serviceId: serviceB },
      });

      expect(res.statusCode).toBe(400);
      expect(res.json().error.code).toBe('CASCADE_IN_PROGRESS');
    });
  });

  describe('GET /api/cascades/history', () => {
    it('should return cascades filtered by serviceId, sorted DESC -> 200', async () => {
      const now = Date.now();
      sqlite.exec(`
        INSERT INTO cascades (id, service_id, type, status, current_step, total_steps, started_at, completed_at) VALUES
          ('c1', '${serviceB}', 'start', 'completed', 2, 2, ${now - 3000}, ${now - 2000}),
          ('c2', '${serviceB}', 'start', 'failed', 1, 2, ${now - 1000}, ${now}),
          ('c3', '${serviceB}', 'stop', 'completed', 1, 1, ${now}, ${now + 500})
      `);

      const res = await app.inject({
        method: 'GET',
        url: `/api/cascades/history?serviceId=${serviceB}`,
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.data).toHaveLength(3);
      expect(body.data[0].id).toBe('c3');
      expect(body.data[1].id).toBe('c2');
      expect(body.data[2].id).toBe('c1');
    });

    it('should return empty array for service with no cascades -> 200', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/cascades/history?serviceId=${serviceB}`,
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().data).toHaveLength(0);
    });

    it('should not include cascades from other services', async () => {
      const now = Date.now();
      sqlite.exec(`
        INSERT INTO cascades (id, service_id, type, status, current_step, total_steps, started_at) VALUES
          ('c1', '${serviceB}', 'start', 'completed', 1, 1, ${now}),
          ('c2', 'other-service', 'start', 'completed', 1, 1, ${now})
      `);

      const res = await app.inject({
        method: 'GET',
        url: `/api/cascades/history?serviceId=${serviceB}`,
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.data).toHaveLength(1);
      expect(body.data[0].id).toBe('c1');
    });

    it('should limit results to 20', async () => {
      const now = Date.now();
      const values = Array.from({ length: 25 }, (_, i) =>
        `('c${i}', '${serviceB}', 'start', 'completed', 1, 1, ${now + i})`,
      ).join(',\n        ');
      sqlite.exec(`
        INSERT INTO cascades (id, service_id, type, status, current_step, total_steps, started_at) VALUES
        ${values}
      `);

      const res = await app.inject({
        method: 'GET',
        url: `/api/cascades/history?serviceId=${serviceB}`,
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().data).toHaveLength(20);
    });

    it('should return 400 for missing serviceId', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/cascades/history',
      });

      expect(res.statusCode).toBe(400);
    });
  });

  describe('GET /api/cascades/:id', () => {
    it('should return cascade by id -> 200', async () => {
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/cascades/start',
        payload: { serviceId: serviceB },
      });
      const cascadeId = createRes.json().data.id;

      const res = await app.inject({
        method: 'GET',
        url: `/api/cascades/${cascadeId}`,
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.data.id).toBe(cascadeId);
      expect(body.data.serviceId).toBe(serviceB);
      expect(body.data.type).toBe('start');
    });

    it('should return 404 for nonexistent cascade', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/cascades/nonexistent-id',
      });

      expect(res.statusCode).toBe(404);
      expect(res.json().error.code).toBe('NOT_FOUND');
    });
  });
});
