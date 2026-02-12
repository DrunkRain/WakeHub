import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import http from 'node:http';
import Fastify, { type FastifyInstance } from 'fastify';
import fastifyCookie from '@fastify/cookie';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { unlinkSync } from 'node:fs';
import * as schema from '../db/schema.js';
import { SSEManager } from '../sse/sse-manager.js';
import eventsRoutes from './events.routes.js';

const TEST_DB_PATH = './test-events-routes-db.sqlite';

describe('Events Routes (SSE)', () => {
  let app: FastifyInstance;
  let sqlite: Database.Database;
  let sseManager: SSEManager;
  let baseUrl: string;

  const userId = 'user-001';
  const validToken = 'valid-session-token-123';
  const expiredToken = 'expired-session-token-456';

  beforeAll(async () => {
    sqlite = new Database(TEST_DB_PATH);
    sqlite.pragma('journal_mode = WAL');
    sqlite.pragma('foreign_keys = ON');
    const db = drizzle(sqlite, { schema });
    migrate(db, { migrationsFolder: './drizzle' });

    sseManager = new SSEManager();

    app = Fastify();
    await app.register(fastifyCookie);
    app.decorate('db', db as unknown);
    app.decorate('sseManager', sseManager);
    await app.register(eventsRoutes);

    // Listen on random port — needed because SSE streams never end,
    // so app.inject() would hang forever on success cases.
    await app.listen({ port: 0 });
    const addr = app.server.address();
    const port = typeof addr === 'string' ? 0 : addr!.port;
    baseUrl = `http://localhost:${port}`;
  });

  afterAll(async () => {
    sseManager.close();
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
    sqlite.exec('DELETE FROM sessions');
    sqlite.exec('DELETE FROM users');

    const now = Date.now();
    sqlite.exec(`
      INSERT INTO users (id, username, password_hash, security_question, security_answer_hash, created_at, updated_at)
      VALUES ('${userId}', 'testuser', 'hash', 'question?', 'answer_hash', ${now}, ${now})
    `);

    const expiresAt = Math.floor((Date.now() + 3600_000) / 1000);
    sqlite.exec(`
      INSERT INTO sessions (id, user_id, token, expires_at, created_at)
      VALUES ('sess-001', '${userId}', '${validToken}', ${expiresAt}, ${Math.floor(now / 1000)})
    `);

    const pastExpiry = Math.floor((Date.now() - 3600_000) / 1000);
    sqlite.exec(`
      INSERT INTO sessions (id, user_id, token, expires_at, created_at)
      VALUES ('sess-002', '${userId}', '${expiredToken}', ${pastExpiry}, ${Math.floor(now / 1000)})
    `);
  });

  /** Helper: make an HTTP request and resolve with the IncomingMessage (auto-destroyed). */
  function httpGet(path: string, headers?: Record<string, string>): Promise<http.IncomingMessage> {
    return new Promise((resolve, reject) => {
      const req = http.get(`${baseUrl}${path}`, { headers }, (res) => {
        // Destroy immediately — we only need the status + headers
        req.destroy();
        resolve(res);
      });
      req.on('error', (err) => {
        if ((err as NodeJS.ErrnoException).code === 'ECONNRESET') return;
        reject(err);
      });
    });
  }

  it('GET /api/events without auth → 401', async () => {
    const res = await httpGet('/api/events');
    expect(res.statusCode).toBe(401);
  });

  it('GET /api/events with valid cookie → 200 text/event-stream', async () => {
    const res = await httpGet('/api/events', {
      Cookie: `session_token=${validToken}`,
    });

    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toBe('text/event-stream');
    expect(res.headers['cache-control']).toBe('no-cache');
  });

  it('GET /api/events?token=valid → 200 text/event-stream', async () => {
    const res = await httpGet(`/api/events?token=${validToken}`);

    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toBe('text/event-stream');
  });

  it('GET /api/events?token=invalid → 401', async () => {
    const res = await httpGet('/api/events?token=invalid-token-xxx');
    expect(res.statusCode).toBe(401);
  });

  it('GET /api/events with expired session → 401', async () => {
    const res = await httpGet(`/api/events?token=${expiredToken}`);
    expect(res.statusCode).toBe(401);
  });
});
