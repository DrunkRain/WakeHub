import type { FastifyPluginAsync } from 'fastify';
import { eq } from 'drizzle-orm';
import { sessions } from '../db/schema.js';
import { extractSessionToken } from '../middleware/auth.middleware.js';

const eventsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get<{ Querystring: { token?: string } }>(
    '/api/events',
    {
      schema: {
        querystring: {
          type: 'object',
          properties: {
            token: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      // Auth: check cookie/header first, then query param fallback
      let token = extractSessionToken(request);
      if (!token && request.query.token) {
        token = request.query.token;
      }

      if (!token) {
        return reply.status(401).send({
          error: { code: 'UNAUTHORIZED', message: 'Session invalide ou expirée' },
        });
      }

      // Validate session token in DB
      const [session] = fastify.db
        .select()
        .from(sessions)
        .where(eq(sessions.token, token))
        .limit(1)
        .all();

      if (!session) {
        return reply.status(401).send({
          error: { code: 'UNAUTHORIZED', message: 'Session invalide ou expirée' },
        });
      }

      const now = new Date();
      const expiresAt = session.expiresAt instanceof Date ? session.expiresAt : new Date(session.expiresAt);
      if (now > expiresAt) {
        return reply.status(401).send({
          error: { code: 'UNAUTHORIZED', message: 'Session invalide ou expirée' },
        });
      }

      // Hijack the response — Fastify won't try to serialise/end it
      reply.hijack();

      // Set SSE headers and flush with an initial comment
      reply.raw.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no',
      });
      reply.raw.write(':ok\n\n');

      // Register client
      const clientId = crypto.randomUUID();
      fastify.sseManager.addClient(clientId, reply);

      // Clean up on disconnect
      request.raw.on('close', () => {
        fastify.sseManager.removeClient(clientId);
      });
    },
  );
};

export default eventsRoutes;
