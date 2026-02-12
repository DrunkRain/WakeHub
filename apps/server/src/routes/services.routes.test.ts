import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
import fastifyCookie from '@fastify/cookie';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { unlinkSync } from 'node:fs';
import * as schema from '../db/schema.js';
import servicesRoutes from './services.routes.js';

// Mock ssh2 and wake_on_lan for test-connection route
vi.mock('ssh2', () => {
  const { EventEmitter: EE } = require('node:events');
  return {
    Client: class extends EE {
      connect = vi.fn();
      end = vi.fn();
      destroy = vi.fn();
      exec = vi.fn();
      constructor() {
        super();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (globalThis as any).__lastSshClient = this;
      }
    },
  };
});

vi.mock('wake_on_lan', () => ({
  default: { wake: vi.fn() },
}));

// Mock fetch for Proxmox/Docker test-connection and discover tests
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

function jsonResponse(data: unknown, status = 200) {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    statusText: 'OK',
    json: () => Promise.resolve({ data }),
    text: () => Promise.resolve(JSON.stringify({ data })),
  } as unknown as Response);
}

function errorResponse(status: number, body = '') {
  return Promise.resolve({
    ok: false,
    status,
    statusText: 'Error',
    json: () => Promise.resolve({}),
    text: () => Promise.resolve(body),
  } as unknown as Response);
}

const TEST_DB_PATH = './test-services-db.sqlite';

describe('Services Routes', () => {
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
    await app.register(servicesRoutes);
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
    sqlite.prepare('DELETE FROM dependency_links').run();
    sqlite.prepare('DELETE FROM services').run();
    sqlite.prepare('DELETE FROM operation_logs').run();
    mockFetch.mockReset();
  });

  /** Helper: insert a parent service (proxmox/docker) directly in DB for discover/resources tests */
  function createTestParentService(overrides: Record<string, unknown> = {}) {
    const id = crypto.randomUUID();
    const now = Math.floor(Date.now() / 1000);
    sqlite
      .prepare(
        `INSERT INTO services (id, name, type, ip_address, api_url, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        id,
        overrides.name ?? 'Proxmox Server',
        overrides.type ?? 'proxmox',
        overrides.ip_address ?? '192.168.1.10',
        overrides.api_url ?? 'https://192.168.1.10:8006',
        'unknown',
        now,
        now,
      );
    return id;
  }

  // ─── POST /api/services ───────────────────────────────────────────────

  describe('POST /api/services', () => {
    it('creates a service with valid data', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/services',
        payload: {
          name: 'My Server',
          type: 'physical',
          ipAddress: '192.168.1.100',
          macAddress: 'AA:BB:CC:DD:EE:FF',
          sshUser: 'admin',
          sshPassword: 'secret',
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body).toHaveProperty('data');
      expect(body.data.name).toBe('My Server');
      expect(body.data.type).toBe('physical');
      expect(body.data.ipAddress).toBe('192.168.1.100');
      expect(body.data.macAddress).toBe('AA:BB:CC:DD:EE:FF');
      expect(body.data.sshUser).toBe('admin');
      expect(body.data.id).toBeDefined();
      expect(body.data.pinnedToDashboard).toBe(false);
      expect(body.data.parentId).toBeNull();
      // Credentials must NOT be returned
      expect(body.data).not.toHaveProperty('sshPassword');
      expect(body.data).not.toHaveProperty('sshCredentialsEncrypted');
    });

    it('returns 400 with missing required fields', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/services',
        payload: { name: 'My Server' },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error.code).toBe('VALIDATION_ERROR');
    });

    it('stores credentials encrypted, not in plain text', async () => {
      await app.inject({
        method: 'POST',
        url: '/api/services',
        payload: {
          name: 'My Server',
          type: 'physical',
          ipAddress: '192.168.1.100',
          sshUser: 'admin',
          sshPassword: 'my-secret-password',
        },
      });

      const row = sqlite
        .prepare('SELECT ssh_credentials_encrypted FROM services WHERE name = ?')
        .get('My Server') as { ssh_credentials_encrypted: string } | undefined;

      expect(row).toBeDefined();
      expect(row!.ssh_credentials_encrypted).not.toBe('my-secret-password');
      expect(row!.ssh_credentials_encrypted).toMatch(/^[0-9a-f]+:[0-9a-f]+:[0-9a-f]+$/);
    });

    it('logs the operation', async () => {
      await app.inject({
        method: 'POST',
        url: '/api/services',
        payload: { name: 'My Server', type: 'physical', ipAddress: '192.168.1.100' },
      });

      const logs = sqlite
        .prepare('SELECT * FROM operation_logs WHERE source = ? AND message LIKE ?')
        .all('services', '%Service created%') as Array<{ source: string; level: string; message: string }>;

      expect(logs.length).toBe(1);
      expect(logs[0]!.level).toBe('info');
    });
  });

  // ─── GET /api/services ────────────────────────────────────────────────

  describe('GET /api/services', () => {
    it('returns empty list when no services', async () => {
      const response = await app.inject({ method: 'GET', url: '/api/services' });

      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.body).data).toEqual([]);
    });

    it('returns list of services', async () => {
      await app.inject({
        method: 'POST',
        url: '/api/services',
        payload: { name: 'Server 1', type: 'physical', ipAddress: '192.168.1.1' },
      });
      await app.inject({
        method: 'POST',
        url: '/api/services',
        payload: { name: 'Server 2', type: 'physical', ipAddress: '192.168.1.2' },
      });

      const response = await app.inject({ method: 'GET', url: '/api/services' });

      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.body).data).toHaveLength(2);
    });

    it('does NOT return encrypted credentials', async () => {
      await app.inject({
        method: 'POST',
        url: '/api/services',
        payload: { name: 'Server 1', type: 'physical', ipAddress: '192.168.1.1', sshUser: 'admin', sshPassword: 'secret' },
      });

      const response = await app.inject({ method: 'GET', url: '/api/services' });
      const body = JSON.parse(response.body);
      const service = body.data[0];

      expect(service).not.toHaveProperty('sshCredentialsEncrypted');
      expect(service).not.toHaveProperty('sshPassword');
      expect(service).not.toHaveProperty('apiCredentialsEncrypted');
    });
  });

  // ─── GET /api/services/:id ────────────────────────────────────────────

  describe('GET /api/services/:id', () => {
    it('returns a specific service', async () => {
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/services',
        payload: { name: 'My Server', type: 'physical', ipAddress: '192.168.1.100' },
      });
      const { id } = JSON.parse(createRes.body).data;

      const response = await app.inject({ method: 'GET', url: `/api/services/${id}` });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data.name).toBe('My Server');
      expect(body.data.id).toBe(id);
    });

    it('returns 404 for non-existent service', async () => {
      const response = await app.inject({ method: 'GET', url: '/api/services/non-existent-id' });

      expect(response.statusCode).toBe(404);
      expect(JSON.parse(response.body).error.code).toBe('NOT_FOUND');
    });
  });

  // ─── PUT /api/services/:id ────────────────────────────────────────────

  describe('PUT /api/services/:id', () => {
    it('updates service name', async () => {
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/services',
        payload: { name: 'Old Name', type: 'physical', ipAddress: '192.168.1.1' },
      });
      const { id } = JSON.parse(createRes.body).data;

      const response = await app.inject({
        method: 'PUT',
        url: `/api/services/${id}`,
        payload: { name: 'New Name' },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data.name).toBe('New Name');
      expect(body.data.ipAddress).toBe('192.168.1.1');
    });

    it('re-encrypts credentials when updated', async () => {
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/services',
        payload: { name: 'Server', type: 'physical', ipAddress: '192.168.1.1', sshUser: 'admin', sshPassword: 'old-password' },
      });
      const { id } = JSON.parse(createRes.body).data;

      const oldRow = sqlite
        .prepare('SELECT ssh_credentials_encrypted FROM services WHERE id = ?')
        .get(id) as { ssh_credentials_encrypted: string };

      await app.inject({
        method: 'PUT',
        url: `/api/services/${id}`,
        payload: { sshPassword: 'new-password' },
      });

      const newRow = sqlite
        .prepare('SELECT ssh_credentials_encrypted FROM services WHERE id = ?')
        .get(id) as { ssh_credentials_encrypted: string };

      expect(newRow.ssh_credentials_encrypted).not.toBe(oldRow.ssh_credentials_encrypted);
      expect(newRow.ssh_credentials_encrypted).toMatch(/^[0-9a-f]+:[0-9a-f]+:[0-9a-f]+$/);
    });

    it('does not return credentials in response', async () => {
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/services',
        payload: { name: 'Server', type: 'physical', ipAddress: '192.168.1.1', sshUser: 'admin', sshPassword: 'secret' },
      });
      const { id } = JSON.parse(createRes.body).data;

      const response = await app.inject({
        method: 'PUT',
        url: `/api/services/${id}`,
        payload: { name: 'Updated' },
      });

      const body = JSON.parse(response.body);
      expect(body.data).not.toHaveProperty('sshPassword');
      expect(body.data).not.toHaveProperty('sshCredentialsEncrypted');
      expect(body.data).not.toHaveProperty('apiCredentialsEncrypted');
    });

    it('returns 404 for non-existent service', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: '/api/services/non-existent-id',
        payload: { name: 'Updated' },
      });

      expect(response.statusCode).toBe(404);
      expect(JSON.parse(response.body).error.code).toBe('NOT_FOUND');
    });

    it('toggles pinnedToDashboard', async () => {
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/services',
        payload: { name: 'Server', type: 'physical', ipAddress: '192.168.1.1' },
      });
      const { id } = JSON.parse(createRes.body).data;

      const getRes1 = await app.inject({ method: 'GET', url: `/api/services/${id}` });
      expect(JSON.parse(getRes1.body).data.pinnedToDashboard).toBe(false);

      const pinRes = await app.inject({
        method: 'PUT',
        url: `/api/services/${id}`,
        payload: { pinnedToDashboard: true },
      });
      expect(pinRes.statusCode).toBe(200);
      expect(JSON.parse(pinRes.body).data.pinnedToDashboard).toBe(true);

      const unpinRes = await app.inject({
        method: 'PUT',
        url: `/api/services/${id}`,
        payload: { pinnedToDashboard: false },
      });
      expect(unpinRes.statusCode).toBe(200);
      expect(JSON.parse(unpinRes.body).data.pinnedToDashboard).toBe(false);
    });

    it('logs the update operation', async () => {
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/services',
        payload: { name: 'Server', type: 'physical', ipAddress: '192.168.1.1' },
      });
      const { id } = JSON.parse(createRes.body).data;

      await app.inject({
        method: 'PUT',
        url: `/api/services/${id}`,
        payload: { name: 'Updated' },
      });

      const logs = sqlite
        .prepare('SELECT * FROM operation_logs WHERE source = ? AND reason = ?')
        .all('services', 'service-update') as Array<{ message: string }>;

      expect(logs.length).toBe(1);
      expect(logs[0]!.message).toContain('Service updated');
    });

    it('updates serviceUrl on a child service', async () => {
      const parentId = createTestParentService();

      const saveRes = await app.inject({
        method: 'POST',
        url: `/api/services/${parentId}/resources`,
        payload: {
          resources: [
            { name: 'my-vm', type: 'vm', platformRef: { node: 'pve1', vmid: 100 }, status: 'running' },
          ],
        },
      });
      const childId = JSON.parse(saveRes.body).data[0].id;

      const patchRes = await app.inject({
        method: 'PUT',
        url: `/api/services/${childId}`,
        payload: { serviceUrl: 'http://my-service:8080' },
      });

      expect(patchRes.statusCode).toBe(200);
      expect(JSON.parse(patchRes.body).data.serviceUrl).toBe('http://my-service:8080');
    });
  });

  // ─── DELETE /api/services/:id ─────────────────────────────────────────

  describe('DELETE /api/services/:id', () => {
    it('deletes an existing service', async () => {
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/services',
        payload: { name: 'To Delete', type: 'physical', ipAddress: '192.168.1.1' },
      });
      const { id } = JSON.parse(createRes.body).data;

      const response = await app.inject({ method: 'DELETE', url: `/api/services/${id}` });

      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.body).data.success).toBe(true);

      const getRes = await app.inject({ method: 'GET', url: `/api/services/${id}` });
      expect(getRes.statusCode).toBe(404);
    });

    it('returns 404 for non-existent service', async () => {
      const response = await app.inject({ method: 'DELETE', url: '/api/services/non-existent-id' });

      expect(response.statusCode).toBe(404);
      expect(JSON.parse(response.body).error.code).toBe('NOT_FOUND');
    });

    it('logs the delete operation', async () => {
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/services',
        payload: { name: 'To Delete', type: 'physical', ipAddress: '192.168.1.1' },
      });
      const { id } = JSON.parse(createRes.body).data;

      await app.inject({ method: 'DELETE', url: `/api/services/${id}` });

      const logs = sqlite
        .prepare('SELECT * FROM operation_logs WHERE source = ? AND reason = ?')
        .all('services', 'service-deletion') as Array<{ message: string }>;

      expect(logs.length).toBe(1);
      expect(logs[0]!.message).toContain('Service deleted');
    });

    it('cascade-deletes dependency_links involving the service', async () => {
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/services',
        payload: { name: 'NAS', type: 'physical', ipAddress: '192.168.1.10' },
      });
      const { id } = JSON.parse(createRes.body).data;

      const createRes2 = await app.inject({
        method: 'POST',
        url: '/api/services',
        payload: { name: 'Proxmox', type: 'proxmox', ipAddress: '192.168.1.20' },
      });
      const { id: id2 } = JSON.parse(createRes2.body).data;

      const now = Date.now();
      sqlite.exec(`
        INSERT INTO dependency_links (id, parent_type, parent_id, child_type, child_id, is_shared, is_structural, created_at)
        VALUES
          ('link-1', 'service', '${id}', 'service', '${id2}', 0, 0, ${now}),
          ('link-2', 'service', '${id2}', 'service', '${id}', 0, 0, ${now})
      `);

      const linksBefore = sqlite.prepare('SELECT COUNT(*) as cnt FROM dependency_links').get() as { cnt: number };
      expect(linksBefore.cnt).toBe(2);

      await app.inject({ method: 'DELETE', url: `/api/services/${id}` });

      const linksAfter = sqlite.prepare('SELECT COUNT(*) as cnt FROM dependency_links').get() as { cnt: number };
      expect(linksAfter.cnt).toBe(0);
    });

    it('cascade-deletes children and their dependency links', async () => {
      const parentId = createTestParentService();

      const saveRes = await app.inject({
        method: 'POST',
        url: `/api/services/${parentId}/resources`,
        payload: {
          resources: [
            { name: 'vm', type: 'vm', platformRef: { node: 'n', vmid: 1 }, status: 'running' },
          ],
        },
      });
      expect(saveRes.statusCode).toBe(200);

      // Verify child + parent + structural link exist
      const allBefore = await app.inject({ method: 'GET', url: '/api/services' });
      expect(JSON.parse(allBefore.body).data).toHaveLength(2);
      const linksBefore = sqlite.prepare('SELECT COUNT(*) as cnt FROM dependency_links').get() as { cnt: number };
      expect(linksBefore.cnt).toBe(1);

      // Delete parent
      await app.inject({ method: 'DELETE', url: `/api/services/${parentId}` });

      // Both parent and child should be gone
      const allAfter = await app.inject({ method: 'GET', url: '/api/services' });
      expect(JSON.parse(allAfter.body).data).toHaveLength(0);

      // Structural link should be gone too
      const linksAfter = sqlite.prepare('SELECT COUNT(*) as cnt FROM dependency_links').get() as { cnt: number };
      expect(linksAfter.cnt).toBe(0);

      // Cascade-delete logged
      const logs = sqlite
        .prepare("SELECT * FROM operation_logs WHERE source = 'services' AND reason = 'service-cascade-delete'")
        .all() as Array<{ message: string }>;
      expect(logs.length).toBe(1);
      expect(logs[0]!.message).toContain('cascade-deleted');
    });
  });

  // ─── POST /api/services/test-connection ───────────────────────────────

  describe('POST /api/services/test-connection', () => {
    it('returns success when SSH connects (physical)', async () => {
      const promise = app.inject({
        method: 'POST',
        url: '/api/services/test-connection',
        payload: { host: '192.168.1.100', sshUser: 'admin', sshPassword: 'secret' },
      });

      await new Promise((r) => setTimeout(r, 50));
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const client = (globalThis as any).__lastSshClient;
      if (client) client.emit('ready');

      const response = await promise;
      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.body).data.success).toBe(true);
    });

    it('returns failure when SSH errors', async () => {
      const promise = app.inject({
        method: 'POST',
        url: '/api/services/test-connection',
        payload: { host: '192.168.1.100', sshUser: 'admin', sshPassword: 'wrong' },
      });

      await new Promise((r) => setTimeout(r, 50));
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const client = (globalThis as any).__lastSshClient;
      if (client) client.emit('error', new Error('Auth failed'));

      const response = await promise;
      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.body).data.success).toBe(false);
    });

    it('returns 400 with missing SSH fields (physical)', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/services/test-connection',
        payload: { host: '192.168.1.100' },
      });

      expect(response.statusCode).toBe(400);
    });

    it('logs connection test', async () => {
      const promise = app.inject({
        method: 'POST',
        url: '/api/services/test-connection',
        payload: { host: '192.168.1.100', sshUser: 'admin', sshPassword: 'secret' },
      });

      await new Promise((r) => setTimeout(r, 50));
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const client = (globalThis as any).__lastSshClient;
      if (client) client.emit('ready');

      await promise;

      const logs = sqlite
        .prepare('SELECT * FROM operation_logs WHERE source = ? AND reason = ?')
        .all('services', 'connection-test') as Array<{ source: string; level: string }>;

      expect(logs.length).toBe(1);
      expect(logs[0]!.level).toBe('info');
    });

    it('returns success for Proxmox token auth', async () => {
      mockFetch.mockReturnValueOnce(
        Promise.resolve({
          ok: true, status: 200, statusText: 'OK',
          json: () => Promise.resolve({ data: [{ node: 'pve1' }] }),
          text: () => Promise.resolve(JSON.stringify({ data: [{ node: 'pve1' }] })),
        } as unknown as Response),
      );

      const response = await app.inject({
        method: 'POST',
        url: '/api/services/test-connection',
        payload: {
          type: 'proxmox', apiUrl: 'https://pve:8006',
          authMode: 'token', tokenId: 'root@pam!mytoken', tokenSecret: 'secret-uuid',
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data.success).toBe(true);
      expect(body.data.message).toContain('Proxmox');
    });

    it('returns failure for Proxmox bad credentials', async () => {
      mockFetch.mockReturnValueOnce(errorResponse(401, 'authentication failure'));

      const response = await app.inject({
        method: 'POST',
        url: '/api/services/test-connection',
        payload: {
          type: 'proxmox', apiUrl: 'https://pve:8006',
          authMode: 'token', tokenId: 'root@pam!bad', tokenSecret: 'wrong',
        },
      });

      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.body).data.success).toBe(false);
    });

    it('returns 400 for Proxmox without apiUrl', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/services/test-connection',
        payload: { type: 'proxmox', authMode: 'token' },
      });

      expect(response.statusCode).toBe(400);
    });

    it('returns success for Docker test-connection', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true, text: async () => 'OK' });
      mockFetch.mockResolvedValueOnce({
        ok: true, status: 200,
        json: async () => ({ Version: '27.5.1', ApiVersion: '1.47' }),
      });

      const response = await app.inject({
        method: 'POST',
        url: '/api/services/test-connection',
        payload: { type: 'docker', apiUrl: 'http://192.168.1.10:2375' },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data.success).toBe(true);
      expect(body.data.message).toContain('Docker');
    });

    it('returns failure for Docker unreachable host', async () => {
      mockFetch.mockRejectedValueOnce(new Error('connect ECONNREFUSED'));

      const response = await app.inject({
        method: 'POST',
        url: '/api/services/test-connection',
        payload: { type: 'docker', apiUrl: 'http://192.168.1.99:2375' },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data.success).toBe(false);
      expect(body.data.message).toContain('ECONNREFUSED');
    });

    it('returns 400 for Docker without apiUrl', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/services/test-connection',
        payload: { type: 'docker' },
      });

      expect(response.statusCode).toBe(400);
    });
  });

  // ─── POST /api/proxmox/discover ──────────────────────────────────────

  describe('POST /api/proxmox/discover', () => {
    it('discovers VMs with token auth', async () => {
      mockFetch.mockReturnValueOnce(jsonResponse([{ node: 'pve1' }]));
      mockFetch.mockReturnValueOnce(
        jsonResponse([
          { vmid: 100, name: 'web-vm', status: 'running' },
          { vmid: 101, name: 'db-vm', status: 'stopped' },
        ]),
      );
      mockFetch.mockReturnValueOnce(jsonResponse([]));

      const response = await app.inject({
        method: 'POST',
        url: '/api/proxmox/discover',
        payload: {
          apiUrl: 'https://pve:8006', authMode: 'token',
          tokenId: 'root@pam!mytoken', tokenSecret: 'secret-uuid',
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data).toHaveLength(2);
      expect(body.data[0].name).toBe('web-vm');
      expect(body.data[0].platformRef.node).toBe('pve1');
      expect(body.data[0].platformRef.vmid).toBe(100);
    });

    it('discovers VMs with password auth', async () => {
      mockFetch.mockReturnValueOnce(jsonResponse({ ticket: 'PVE:ticket', CSRFPreventionToken: 'csrf' }));
      mockFetch.mockReturnValueOnce(jsonResponse([{ node: 'pve1' }]));
      mockFetch.mockReturnValueOnce(jsonResponse([{ vmid: 200, name: 'test-vm', status: 'running' }]));
      mockFetch.mockReturnValueOnce(jsonResponse([]));

      const response = await app.inject({
        method: 'POST',
        url: '/api/proxmox/discover',
        payload: {
          apiUrl: 'https://pve:8006', authMode: 'password',
          username: 'root@pam', password: 'pass123',
        },
      });

      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.body).data).toHaveLength(1);
    });

    it('returns 400 on connection failure', async () => {
      mockFetch.mockRejectedValueOnce(new Error('ECONNREFUSED'));

      const response = await app.inject({
        method: 'POST',
        url: '/api/proxmox/discover',
        payload: {
          apiUrl: 'https://unreachable:8006', authMode: 'token',
          tokenId: 'root@pam!t', tokenSecret: 's',
        },
      });

      expect(response.statusCode).toBe(400);
      expect(JSON.parse(response.body).error.code).toBe('DISCOVER_FAILED');
    });

    it('returns 400 with missing apiUrl', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/proxmox/discover',
        payload: { authMode: 'token' },
      });

      expect(response.statusCode).toBe(400);
    });

    it('logs the discover operation', async () => {
      mockFetch.mockReturnValueOnce(jsonResponse([{ node: 'pve1' }]));
      mockFetch.mockReturnValueOnce(jsonResponse([]));
      mockFetch.mockReturnValueOnce(jsonResponse([]));

      await app.inject({
        method: 'POST',
        url: '/api/proxmox/discover',
        payload: {
          apiUrl: 'https://pve:8006', authMode: 'token',
          tokenId: 'root@pam!t', tokenSecret: 's',
        },
      });

      const logs = sqlite
        .prepare('SELECT * FROM operation_logs WHERE reason = ?')
        .all('proxmox-discover') as Array<{ message: string }>;

      expect(logs.length).toBe(1);
    });
  });

  // ─── POST /api/docker/discover ────────────────────────────────────────

  describe('POST /api/docker/discover', () => {
    it('discovers containers with valid apiUrl', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true, status: 200,
        json: () =>
          Promise.resolve([
            { Id: 'abc123def456', Names: ['/jellyfin'], Image: 'jellyfin/jellyfin:latest', State: 'running', Status: 'Up 5 minutes' },
            { Id: 'xyz789ghi012', Names: ['/nextcloud'], Image: 'nextcloud:latest', State: 'exited', Status: 'Exited (0) 3 hours ago' },
          ]),
      });

      const response = await app.inject({
        method: 'POST',
        url: '/api/docker/discover',
        payload: { apiUrl: 'http://192.168.1.10:2375' },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data).toHaveLength(2);
      expect(body.data[0].name).toBe('jellyfin');
      expect(body.data[0].type).toBe('container');
      expect(body.data[0].platformRef.containerId).toBe('abc123def456');
      expect(body.data[0].status).toBe('running');
      expect(body.data[1].name).toBe('nextcloud');
      expect(body.data[1].status).toBe('stopped');
    });

    it('returns 400 without apiUrl', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/docker/discover',
        payload: {},
      });

      expect(response.statusCode).toBe(400);
    });

    it('returns 400 on connection failure', async () => {
      mockFetch.mockRejectedValueOnce(new Error('connect ECONNREFUSED'));

      const response = await app.inject({
        method: 'POST',
        url: '/api/docker/discover',
        payload: { apiUrl: 'http://192.168.1.99:2375' },
      });

      expect(response.statusCode).toBe(400);
      expect(JSON.parse(response.body).error.code).toBe('DISCOVER_FAILED');
    });

    it('logs the discover operation', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true, status: 200, json: () => Promise.resolve([]) });

      await app.inject({
        method: 'POST',
        url: '/api/docker/discover',
        payload: { apiUrl: 'http://192.168.1.10:2375' },
      });

      const logs = sqlite
        .prepare('SELECT * FROM operation_logs WHERE reason = ?')
        .all('docker-discover') as Array<{ message: string }>;

      expect(logs.length).toBe(1);
    });
  });

  // ─── POST /api/services/:id/discover ──────────────────────────────────

  describe('POST /api/services/:id/discover', () => {
    it('returns 404 for non-existent service', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/services/nonexistent/discover',
      });

      expect(response.statusCode).toBe(404);
    });

    it('returns 400 for non-proxmox/docker service', async () => {
      const id = createTestParentService({ type: 'physical' });

      const response = await app.inject({
        method: 'POST',
        url: `/api/services/${id}/discover`,
      });

      expect(response.statusCode).toBe(400);
      expect(JSON.parse(response.body).error.code).toBe('INVALID_TYPE');
    });

    it('discovers containers from saved Docker service', async () => {
      const id = createTestParentService({ name: 'Docker Host', type: 'docker', api_url: 'http://192.168.1.10:2375' });

      mockFetch.mockResolvedValueOnce({
        ok: true, status: 200,
        json: () => Promise.resolve([
          { Id: 'abc123', Names: ['/myapp'], Image: 'myapp:latest', State: 'running', Status: 'Up 1 hour' },
        ]),
      });

      const response = await app.inject({
        method: 'POST',
        url: `/api/services/${id}/discover`,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data).toHaveLength(1);
      expect(body.data[0].name).toBe('myapp');
      expect(body.data[0].type).toBe('container');
      expect(body.data[0].platformRef.containerId).toBe('abc123');
    });
  });

  // ─── POST /api/services/:id/resources ─────────────────────────────────

  describe('POST /api/services/:id/resources', () => {
    it('saves child services for a parent', async () => {
      const parentId = createTestParentService();

      const response = await app.inject({
        method: 'POST',
        url: `/api/services/${parentId}/resources`,
        payload: {
          resources: [
            { name: 'web-vm', type: 'vm', platformRef: { node: 'pve1', vmid: 100 }, status: 'running' },
            { name: 'db-vm', type: 'vm', platformRef: { node: 'pve1', vmid: 101 }, status: 'stopped' },
          ],
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data).toHaveLength(2);
      expect(body.data[0].name).toBe('web-vm');
      expect(body.data[0].parentId).toBe(parentId);
      expect(body.data[0].id).toBeDefined();
      expect(body.data[0].platformRef).toEqual({ node: 'pve1', vmid: 100 });
      expect(body.data[0].pinnedToDashboard).toBe(false);
    });

    it('returns 404 for non-existent parent', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/services/nonexistent/resources',
        payload: {
          resources: [
            { name: 'vm', type: 'vm', platformRef: { node: 'n', vmid: 1 }, status: 'running' },
          ],
        },
      });

      expect(response.statusCode).toBe(404);
    });

    it('returns 400 with invalid body', async () => {
      const parentId = createTestParentService();

      const response = await app.inject({
        method: 'POST',
        url: `/api/services/${parentId}/resources`,
        payload: { resources: 'not an array' },
      });

      expect(response.statusCode).toBe(400);
    });

    it('logs the save operation', async () => {
      const parentId = createTestParentService();

      await app.inject({
        method: 'POST',
        url: `/api/services/${parentId}/resources`,
        payload: {
          resources: [
            { name: 'vm', type: 'vm', platformRef: { node: 'pve1', vmid: 100 }, status: 'running' },
          ],
        },
      });

      const logs = sqlite
        .prepare('SELECT * FROM operation_logs WHERE reason = ?')
        .all('resources-save') as Array<{ message: string }>;

      expect(logs.length).toBe(1);
    });

    it('auto-creates structural dependency links', async () => {
      const parentId = createTestParentService();

      const response = await app.inject({
        method: 'POST',
        url: `/api/services/${parentId}/resources`,
        payload: {
          resources: [
            { name: 'web-vm', type: 'vm', platformRef: { node: 'pve1', vmid: 100 }, status: 'running' },
            { name: 'db-vm', type: 'vm', platformRef: { node: 'pve1', vmid: 101 }, status: 'stopped' },
          ],
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      const childIds = body.data.map((r: { id: string }) => r.id);

      const links = sqlite
        .prepare('SELECT * FROM dependency_links WHERE parent_type = ? AND parent_id = ?')
        .all('service', parentId) as Array<{ child_type: string; child_id: string; is_structural: number }>;

      expect(links).toHaveLength(2);
      expect(links.map((l) => l.child_id).sort()).toEqual(childIds.sort());
      expect(links.every((l) => l.child_type === 'service')).toBe(true);
      expect(links.every((l) => l.is_structural === 1)).toBe(true);
    });

    it('saves Docker container resources', async () => {
      const parentId = createTestParentService({ name: 'Docker Host', type: 'docker', api_url: 'http://192.168.1.10:2375' });

      const response = await app.inject({
        method: 'POST',
        url: `/api/services/${parentId}/resources`,
        payload: {
          resources: [
            {
              name: 'jellyfin',
              type: 'container',
              platformRef: { containerId: 'abc123def456', image: 'jellyfin/jellyfin:latest' },
              status: 'running',
            },
          ],
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data).toHaveLength(1);
      expect(body.data[0].name).toBe('jellyfin');
      expect(body.data[0].type).toBe('container');
      expect(body.data[0].platformRef).toEqual({ containerId: 'abc123def456', image: 'jellyfin/jellyfin:latest' });
    });

    it('children appear in GET /api/services', async () => {
      const parentId = createTestParentService();

      await app.inject({
        method: 'POST',
        url: `/api/services/${parentId}/resources`,
        payload: {
          resources: [
            { name: 'vm-a', type: 'vm', platformRef: { node: 'pve1', vmid: 100 }, status: 'running' },
          ],
        },
      });

      const response = await app.inject({ method: 'GET', url: '/api/services' });
      const body = JSON.parse(response.body);
      const children = body.data.filter((s: { parentId: string | null }) => s.parentId === parentId);
      expect(children).toHaveLength(1);
      expect(children[0].name).toBe('vm-a');
    });
  });
});
