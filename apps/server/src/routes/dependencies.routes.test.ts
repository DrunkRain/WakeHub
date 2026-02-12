import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
import fastifyCookie from '@fastify/cookie';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { unlinkSync } from 'node:fs';
import * as schema from '../db/schema.js';
import dependenciesRoutes from './dependencies.routes.js';

const TEST_DB_PATH = './test-dependencies-db.sqlite';

describe('Dependencies Routes', () => {
  let app: FastifyInstance;
  let sqlite: Database.Database;

  const serviceA = 'service-aaa';
  const serviceB = 'service-bbb';
  const serviceC = 'service-ccc';
  const serviceD = 'service-ddd';
  const serviceE = 'service-eee';

  beforeAll(async () => {
    sqlite = new Database(TEST_DB_PATH);
    sqlite.pragma('journal_mode = WAL');
    sqlite.pragma('foreign_keys = ON');
    const db = drizzle(sqlite, { schema });
    migrate(db, { migrationsFolder: './drizzle' });

    app = Fastify();
    await app.register(fastifyCookie);
    app.decorate('db', db as unknown);
    await app.register(dependenciesRoutes);
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
    sqlite.exec('DELETE FROM dependency_links');
    sqlite.exec('DELETE FROM operation_logs');
    sqlite.exec('DELETE FROM services');

    const now = Math.floor(Date.now() / 1000);
    sqlite.exec(`
      INSERT INTO services (id, name, type, ip_address, status, created_at, updated_at) VALUES
        ('${serviceA}', 'NAS', 'physical', '192.168.1.10', 'online', ${now}, ${now}),
        ('${serviceB}', 'Proxmox', 'proxmox', '192.168.1.20', 'online', ${now}, ${now})
    `);
    sqlite.exec(`
      INSERT INTO services (id, name, type, status, platform_ref, parent_id, created_at, updated_at) VALUES
        ('${serviceC}', 'VM-Media', 'vm', 'running', '{"node":"pve","vmid":100}', '${serviceB}', ${now}, ${now}),
        ('${serviceD}', 'VM-Backup', 'vm', 'stopped', '{"node":"pve","vmid":101}', '${serviceB}', ${now}, ${now}),
        ('${serviceE}', 'Jellyfin', 'container', 'running', '{"containerId":"abc","image":"jf"}', '${serviceB}', ${now}, ${now})
    `);
  });

  describe('POST /api/dependencies', () => {
    it('should create a valid dependency link -> 200', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/dependencies',
        payload: {
          parentType: 'service',
          parentId: serviceA,
          childType: 'service',
          childId: serviceC,
        },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.data).toMatchObject({
        parentType: 'service',
        parentId: serviceA,
        childType: 'service',
        childId: serviceC,
        isShared: false,
      });
      expect(body.data.id).toBeDefined();
      expect(body.data.createdAt).toBeDefined();
    });

    it('should refuse a cycle -> 409', async () => {
      await app.inject({
        method: 'POST',
        url: '/api/dependencies',
        payload: { parentType: 'service', parentId: serviceA, childType: 'service', childId: serviceC },
      });

      const res = await app.inject({
        method: 'POST',
        url: '/api/dependencies',
        payload: { parentType: 'service', parentId: serviceC, childType: 'service', childId: serviceA },
      });

      expect(res.statusCode).toBe(409);
      expect(res.json().error.code).toBe('CYCLE_DETECTED');
    });

    it('should refuse a duplicate -> 409', async () => {
      await app.inject({
        method: 'POST',
        url: '/api/dependencies',
        payload: { parentType: 'service', parentId: serviceA, childType: 'service', childId: serviceC },
      });

      const res = await app.inject({
        method: 'POST',
        url: '/api/dependencies',
        payload: { parentType: 'service', parentId: serviceA, childType: 'service', childId: serviceC },
      });

      expect(res.statusCode).toBe(409);
      expect(res.json().error.code).toBe('DUPLICATE_LINK');
    });

    it('should refuse a non-existent node -> 404', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/dependencies',
        payload: { parentType: 'service', parentId: 'non-existent', childType: 'service', childId: serviceC },
      });

      expect(res.statusCode).toBe(404);
      expect(res.json().error.code).toBe('NODE_NOT_FOUND');
    });

    it('should refuse a self-reference -> 400', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/dependencies',
        payload: { parentType: 'service', parentId: serviceA, childType: 'service', childId: serviceA },
      });

      expect(res.statusCode).toBe(400);
      expect(res.json().error.code).toBe('SELF_REFERENCE');
    });

    it('should log the operation', async () => {
      await app.inject({
        method: 'POST',
        url: '/api/dependencies',
        payload: { parentType: 'service', parentId: serviceA, childType: 'service', childId: serviceC },
      });

      const logs = sqlite.prepare(
        "SELECT * FROM operation_logs WHERE source = 'dependencies' AND reason = 'dependency-created'"
      ).all() as Array<{ message: string }>;
      expect(logs.length).toBe(1);
    });
  });

  describe('GET /api/dependencies', () => {
    it('should return links filtered by nodeType and nodeId', async () => {
      await app.inject({
        method: 'POST',
        url: '/api/dependencies',
        payload: { parentType: 'service', parentId: serviceA, childType: 'service', childId: serviceC },
      });
      await app.inject({
        method: 'POST',
        url: '/api/dependencies',
        payload: { parentType: 'service', parentId: serviceA, childType: 'service', childId: serviceD },
      });

      const res = await app.inject({
        method: 'GET',
        url: `/api/dependencies?nodeType=service&nodeId=${serviceA}`,
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().data).toHaveLength(2);
    });

    it('should return all links when no filter', async () => {
      await app.inject({
        method: 'POST',
        url: '/api/dependencies',
        payload: { parentType: 'service', parentId: serviceA, childType: 'service', childId: serviceC },
      });

      const res = await app.inject({
        method: 'GET',
        url: '/api/dependencies',
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().data).toHaveLength(1);
    });
  });

  describe('GET /api/dependencies/chain', () => {
    it('should return the complete upstream/downstream chain', async () => {
      // serviceA -> serviceC -> serviceE
      await app.inject({
        method: 'POST',
        url: '/api/dependencies',
        payload: { parentType: 'service', parentId: serviceA, childType: 'service', childId: serviceC },
      });
      await app.inject({
        method: 'POST',
        url: '/api/dependencies',
        payload: { parentType: 'service', parentId: serviceC, childType: 'service', childId: serviceE },
      });

      const res = await app.inject({
        method: 'GET',
        url: `/api/dependencies/chain?nodeType=service&nodeId=${serviceC}`,
      });

      expect(res.statusCode).toBe(200);
      const { upstream, downstream } = res.json().data;
      expect(upstream).toHaveLength(1);
      expect(upstream[0]).toMatchObject({ nodeType: 'service', nodeId: serviceA, name: 'NAS' });
      expect(downstream).toHaveLength(1);
      expect(downstream[0]).toMatchObject({ nodeType: 'service', nodeId: serviceE, name: 'Jellyfin' });
    });
  });

  describe('DELETE /api/dependencies/:id', () => {
    it('should delete an existing link -> 200', async () => {
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/dependencies',
        payload: { parentType: 'service', parentId: serviceA, childType: 'service', childId: serviceC },
      });
      const linkId = createRes.json().data.id;

      const res = await app.inject({ method: 'DELETE', url: `/api/dependencies/${linkId}` });

      expect(res.statusCode).toBe(200);
      expect(res.json().data.success).toBe(true);

      const getRes = await app.inject({ method: 'GET', url: '/api/dependencies' });
      expect(getRes.json().data).toHaveLength(0);
    });

    it('should return 404 for non-existent link', async () => {
      const res = await app.inject({ method: 'DELETE', url: '/api/dependencies/non-existent-id' });

      expect(res.statusCode).toBe(404);
      expect(res.json().error.code).toBe('NOT_FOUND');
    });

    it('should return 403 for structural links', async () => {
      const now = Date.now();
      sqlite.exec(`
        INSERT INTO dependency_links (id, parent_type, parent_id, child_type, child_id, is_shared, is_structural, created_at)
        VALUES ('structural-link', 'service', '${serviceB}', 'service', '${serviceC}', 0, 1, ${now})
      `);

      const res = await app.inject({ method: 'DELETE', url: '/api/dependencies/structural-link' });

      expect(res.statusCode).toBe(403);
      expect(res.json().error.code).toBe('STRUCTURAL_LINK');
    });

    it('should log the deletion', async () => {
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/dependencies',
        payload: { parentType: 'service', parentId: serviceA, childType: 'service', childId: serviceC },
      });
      const linkId = createRes.json().data.id;

      await app.inject({ method: 'DELETE', url: `/api/dependencies/${linkId}` });

      const logs = sqlite.prepare(
        "SELECT * FROM operation_logs WHERE source = 'dependencies' AND reason = 'dependency-deleted'"
      ).all() as Array<{ message: string }>;
      expect(logs.length).toBe(1);
    });
  });

  describe('PATCH /api/dependencies/:id', () => {
    it('should update isShared -> 200', async () => {
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/dependencies',
        payload: { parentType: 'service', parentId: serviceA, childType: 'service', childId: serviceC },
      });
      const linkId = createRes.json().data.id;

      const res = await app.inject({
        method: 'PATCH',
        url: `/api/dependencies/${linkId}`,
        payload: { isShared: true },
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().data.isShared).toBe(true);
    });

    it('should return 404 for non-existent link', async () => {
      const res = await app.inject({
        method: 'PATCH',
        url: '/api/dependencies/non-existent-id',
        payload: { isShared: true },
      });

      expect(res.statusCode).toBe(404);
      expect(res.json().error.code).toBe('NOT_FOUND');
    });

    it('should log the update', async () => {
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/dependencies',
        payload: { parentType: 'service', parentId: serviceA, childType: 'service', childId: serviceC },
      });
      const linkId = createRes.json().data.id;

      await app.inject({
        method: 'PATCH',
        url: `/api/dependencies/${linkId}`,
        payload: { isShared: true },
      });

      const logs = sqlite.prepare(
        "SELECT * FROM operation_logs WHERE source = 'dependencies' AND reason = 'dependency-updated'"
      ).all() as Array<{ message: string }>;
      expect(logs.length).toBe(1);
    });
  });

  describe('GET /api/dependencies/graph', () => {
    it('should return nodes and edges for the full graph -> 200', async () => {
      // serviceA -> serviceC -> serviceE
      await app.inject({
        method: 'POST',
        url: '/api/dependencies',
        payload: { parentType: 'service', parentId: serviceA, childType: 'service', childId: serviceC },
      });
      await app.inject({
        method: 'POST',
        url: '/api/dependencies',
        payload: { parentType: 'service', parentId: serviceC, childType: 'service', childId: serviceE },
      });

      const res = await app.inject({ method: 'GET', url: '/api/dependencies/graph' });

      expect(res.statusCode).toBe(200);
      const { nodes, edges } = res.json().data;
      expect(nodes).toHaveLength(3);
      expect(edges).toHaveLength(2);

      const nasNode = nodes.find((n: { id: string }) => n.id === `service:${serviceA}`);
      expect(nasNode).toMatchObject({
        name: 'NAS',
        nodeType: 'service',
        subType: 'physical',
        status: 'online',
      });

      const vmNode = nodes.find((n: { id: string }) => n.id === `service:${serviceC}`);
      expect(vmNode).toMatchObject({
        name: 'VM-Media',
        nodeType: 'service',
        subType: 'vm',
      });
    });

    it('should return empty graph when no dependencies -> 200', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/dependencies/graph' });

      expect(res.statusCode).toBe(200);
      expect(res.json().data.nodes).toHaveLength(0);
      expect(res.json().data.edges).toHaveLength(0);
    });

    it('should correctly mark shared nodes', async () => {
      // serviceA -> serviceC AND serviceA -> serviceD (serviceA has 2 children = shared)
      await app.inject({
        method: 'POST',
        url: '/api/dependencies',
        payload: { parentType: 'service', parentId: serviceA, childType: 'service', childId: serviceC },
      });
      await app.inject({
        method: 'POST',
        url: '/api/dependencies',
        payload: { parentType: 'service', parentId: serviceA, childType: 'service', childId: serviceD },
      });

      const res = await app.inject({ method: 'GET', url: '/api/dependencies/graph' });

      const { nodes } = res.json().data;
      const nasNode = nodes.find((n: { id: string }) => n.id === `service:${serviceA}`);
      expect(nasNode.isShared).toBe(true);

      const vmNode = nodes.find((n: { id: string }) => n.id === `service:${serviceC}`);
      expect(vmNode.isShared).toBe(false);
    });
  });
});
