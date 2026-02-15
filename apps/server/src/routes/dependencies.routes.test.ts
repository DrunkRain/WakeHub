import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
import fastifyCookie from '@fastify/cookie';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { unlinkSync } from 'node:fs';
import argon2 from 'argon2';
import * as schema from '../db/schema.js';
import dependenciesRoutes from './dependencies.routes.js';

const TEST_DB_PATH = './test-dependencies-db.sqlite';

describe('Dependencies Routes', () => {
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

    await app.register(dependenciesRoutes, { prefix: '/api/dependencies' });
    await app.ready();

    // Create a test user and session for auth
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

  // Helper: insert a node and return its id
  function insertNode(name: string, type: 'physical' | 'vm' | 'lxc' | 'container' = 'physical'): string {
    const id = crypto.randomUUID();
    sqlite.prepare(
      `INSERT INTO nodes (id, name, type, status, is_pinned, confirm_before_shutdown, discovered, configured, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(id, name, type, 'online', 0, 1, 0, 1, Date.now(), Date.now());
    return id;
  }

  // Helper: insert a dependency link and return its id
  function insertLink(fromId: string, toId: string): string {
    const id = crypto.randomUUID();
    sqlite.prepare(
      `INSERT INTO dependency_links (id, from_node_id, to_node_id, created_at) VALUES (?, ?, ?, ?)`,
    ).run(id, fromId, toId, Date.now());
    return id;
  }

  beforeEach(() => {
    sqlite.prepare('DELETE FROM dependency_links').run();
    sqlite.prepare('DELETE FROM nodes').run();
    sqlite.prepare('DELETE FROM operation_logs').run();
  });

  describe('POST /api/dependencies', () => {
    it('should create a dependency link', async () => {
      const nodeA = insertNode('Jellyfin');
      const nodeB = insertNode('NAS');

      const response = await app.inject({
        method: 'POST',
        url: '/api/dependencies',
        payload: { fromNodeId: nodeA, toNodeId: nodeB },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data.dependency).toBeDefined();
      expect(body.data.dependency.fromNodeId).toBe(nodeA);
      expect(body.data.dependency.toNodeId).toBe(nodeB);
      expect(body.data.dependency.id).toBeDefined();
    });

    it('should reject self-link (400)', async () => {
      const nodeA = insertNode('Node A');

      const response = await app.inject({
        method: 'POST',
        url: '/api/dependencies',
        payload: { fromNodeId: nodeA, toNodeId: nodeA },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error.code).toBe('DEPENDENCY_SELF_LINK');
    });

    it('should reject duplicate link (400)', async () => {
      const nodeA = insertNode('Node A');
      const nodeB = insertNode('Node B');
      insertLink(nodeA, nodeB);

      const response = await app.inject({
        method: 'POST',
        url: '/api/dependencies',
        payload: { fromNodeId: nodeA, toNodeId: nodeB },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error.code).toBe('DEPENDENCY_DUPLICATE');
    });

    it('should reject cycle (400)', async () => {
      const nodeA = insertNode('Node A');
      const nodeB = insertNode('Node B');
      insertLink(nodeA, nodeB); // A depends on B

      const response = await app.inject({
        method: 'POST',
        url: '/api/dependencies',
        payload: { fromNodeId: nodeB, toNodeId: nodeA }, // B depends on A → cycle
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error.code).toBe('DEPENDENCY_CYCLE_DETECTED');
    });

    it('should return 404 when fromNodeId does not exist', async () => {
      const nodeB = insertNode('Node B');

      const response = await app.inject({
        method: 'POST',
        url: '/api/dependencies',
        payload: { fromNodeId: 'nonexistent-id', toNodeId: nodeB },
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.error.code).toBe('NODE_NOT_FOUND');
    });

    it('should return 404 when toNodeId does not exist', async () => {
      const nodeA = insertNode('Node A');

      const response = await app.inject({
        method: 'POST',
        url: '/api/dependencies',
        payload: { fromNodeId: nodeA, toNodeId: 'nonexistent-id' },
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.error.code).toBe('NODE_NOT_FOUND');
    });
  });

  describe('GET /api/dependencies', () => {
    it('should return upstream and downstream dependencies with node info', async () => {
      const nas = insertNode('NAS', 'physical');
      const jellyfin = insertNode('Jellyfin', 'container');
      const plex = insertNode('Plex', 'container');
      const storage = insertNode('Storage', 'vm');

      insertLink(jellyfin, nas); // Jellyfin depends on NAS
      insertLink(plex, nas);     // Plex depends on NAS
      insertLink(nas, storage);   // NAS depends on Storage

      const response = await app.inject({
        method: 'GET',
        url: `/api/dependencies?nodeId=${nas}`,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);

      // NAS depends on Storage (upstream)
      expect(body.data.upstream).toHaveLength(1);
      expect(body.data.upstream[0].name).toBe('Storage');
      expect(body.data.upstream[0].type).toBe('vm');
      expect(body.data.upstream[0].status).toBe('online');
      expect(body.data.upstream[0].linkId).toBeDefined();
      expect(body.data.upstream[0].nodeId).toBe(storage);

      // Jellyfin + Plex depend on NAS (downstream)
      expect(body.data.downstream).toHaveLength(2);
      const downstreamNames = body.data.downstream.map((d: any) => d.name);
      expect(downstreamNames).toContain('Jellyfin');
      expect(downstreamNames).toContain('Plex');
    });

    it('should return empty arrays when node has no dependencies', async () => {
      const nodeA = insertNode('Isolated Node');

      const response = await app.inject({
        method: 'GET',
        url: `/api/dependencies?nodeId=${nodeA}`,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data.upstream).toEqual([]);
      expect(body.data.downstream).toEqual([]);
    });

    it('should return 404 for nonexistent node', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/dependencies?nodeId=nonexistent-id',
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.error.code).toBe('NODE_NOT_FOUND');
    });
  });

  describe('GET /api/dependencies/graph', () => {
    it('should return an empty graph when no links exist', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/dependencies/graph',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data.nodes).toEqual([]);
      expect(body.data.links).toEqual([]);
    });

    it('should return graph with nodes and links', async () => {
      const nas = insertNode('NAS', 'physical');
      const jellyfin = insertNode('Jellyfin', 'container');
      const plex = insertNode('Plex', 'container');
      insertLink(jellyfin, nas);
      insertLink(plex, nas);

      const response = await app.inject({
        method: 'GET',
        url: '/api/dependencies/graph',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data.nodes).toHaveLength(3);
      expect(body.data.links).toHaveLength(2);

      const nodeNames = body.data.nodes.map((n: any) => n.name);
      expect(nodeNames).toContain('NAS');
      expect(nodeNames).toContain('Jellyfin');
      expect(nodeNames).toContain('Plex');

      body.data.nodes.forEach((n: any) => {
        expect(n.id).toBeDefined();
        expect(n.name).toBeDefined();
        expect(n.type).toBeDefined();
        expect(n.status).toBeDefined();
      });

      body.data.links.forEach((l: any) => {
        expect(l.id).toBeDefined();
        expect(l.fromNodeId).toBeDefined();
        expect(l.toNodeId).toBeDefined();
      });
    });

    it('should return 200 for unauthenticated request (auth handled by middleware)', async () => {
      // Note: auth is handled at the middleware level, not at route level
      // This test verifies the route itself works; auth would be blocked by middleware in production
      const response = await app.inject({
        method: 'GET',
        url: '/api/dependencies/graph',
      });

      expect(response.statusCode).toBe(200);
    });
  });

  describe('DELETE /api/dependencies/:id', () => {
    it('should delete a dependency link', async () => {
      const nodeA = insertNode('Node A');
      const nodeB = insertNode('Node B');
      const linkId = insertLink(nodeA, nodeB);

      const response = await app.inject({
        method: 'DELETE',
        url: `/api/dependencies/${linkId}`,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data.success).toBe(true);

      // Verify link is gone
      const checkResponse = await app.inject({
        method: 'GET',
        url: `/api/dependencies?nodeId=${nodeA}`,
      });
      const checkBody = JSON.parse(checkResponse.body);
      expect(checkBody.data.upstream).toEqual([]);
    });

    it('should return 404 for nonexistent dependency', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: '/api/dependencies/nonexistent-id',
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.error.code).toBe('DEPENDENCY_NOT_FOUND');
    });
  });
});
