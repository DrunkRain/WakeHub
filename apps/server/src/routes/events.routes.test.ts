import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import http from 'node:http';
import Fastify, { type FastifyInstance } from 'fastify';
import fastifyCookie from '@fastify/cookie';
import { SSEManager } from '../sse/sse-manager.js';
import eventsRoutes from './events.routes.js';

/**
 * Helper: make a real HTTP GET request and return headers + accumulated body.
 * Waits for `waitMs` after first data to collect all initial writes, then aborts.
 */
function sseRequest(
  port: number,
  path: string,
  headers: Record<string, string> = {},
  waitMs = 50,
): Promise<{ statusCode: number; headers: http.IncomingHttpHeaders; body: string }> {
  return new Promise((resolve, reject) => {
    const req = http.get(
      { hostname: '127.0.0.1', port, path, headers },
      (res) => {
        let body = '';
        let resolved = false;
        res.on('data', (chunk: Buffer) => {
          body += chunk.toString();
        });
        // Wait a short time after first data to collect all initial writes
        setTimeout(() => {
          if (!resolved) {
            resolved = true;
            req.destroy();
            resolve({ statusCode: res.statusCode!, headers: res.headers, body });
          }
        }, waitMs);
        res.on('error', () => {
          // Expected when we destroy the request
        });
      },
    );
    req.on('error', (err) => {
      // ECONNRESET is expected when we destroy
      if ((err as NodeJS.ErrnoException).code === 'ECONNRESET') {
        return;
      }
      reject(err);
    });
    // Safety timeout
    setTimeout(() => {
      req.destroy();
      reject(new Error('SSE request timed out'));
    }, 3000);
  });
}

describe('Events SSE Route', () => {
  let app: FastifyInstance;
  let sseManager: SSEManager;
  let port: number;

  beforeAll(async () => {
    app = Fastify();
    await app.register(fastifyCookie);

    sseManager = new SSEManager(50, 30_000);
    app.decorate('sseManager', sseManager);
    app.decorate('db', {} as any);

    // Simulate auth — inject userId on all requests
    app.addHook('preHandler', async (request) => {
      request.userId = 'test-user-id';
    });

    await app.register(eventsRoutes, { prefix: '/api' });

    // Start on a random port
    const address = await app.listen({ port: 0, host: '127.0.0.1' });
    port = parseInt(new URL(address).port, 10);
  });

  afterAll(async () => {
    await app.close();
  });

  it('should return Content-Type text/event-stream', async () => {
    const res = await sseRequest(port, '/api/events');

    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toBe('text/event-stream');
  });

  it('should include SSE headers (Cache-Control, Connection, X-Accel-Buffering)', async () => {
    const res = await sseRequest(port, '/api/events');

    expect(res.headers['cache-control']).toBe('no-cache');
    expect(res.headers['connection']).toBe('keep-alive');
    expect(res.headers['x-accel-buffering']).toBe('no');
  });

  it('should include CORS credentials header', async () => {
    const res = await sseRequest(port, '/api/events', {
      Origin: 'http://localhost:5173',
    });

    expect(res.headers['access-control-allow-credentials']).toBe('true');
    expect(res.headers['access-control-allow-origin']).toBe('http://localhost:5173');
  });

  it('should send retry field in initial response', async () => {
    const res = await sseRequest(port, '/api/events');

    expect(res.body).toContain('retry: 5000\n\n');
  });

  it('should replay events when Last-Event-ID is provided', async () => {
    // Broadcast events before connecting
    sseManager.broadcast('test-event', { value: 1 });
    sseManager.broadcast('test-event', { value: 2 });

    const res = await sseRequest(port, '/api/events', {
      'Last-Event-ID': '1',
    });

    // Should contain the replayed event (id 2)
    expect(res.body).toContain('event: test-event');
    expect(res.body).toContain('"value":2');
  });
});
