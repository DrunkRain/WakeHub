import type { FastifyPluginAsync } from 'fastify';
import { config } from '../config.js';

const eventsRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /api/events — SSE endpoint
  fastify.get('/events', async (request, reply) => {
    const clientId = crypto.randomUUID();

    reply.hijack();
    const raw = reply.raw;
    raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
      // CORS headers (hijack bypasses @fastify/cors — use same configured origin)
      'Access-Control-Allow-Origin': config.corsOrigin,
      'Access-Control-Allow-Credentials': 'true',
    });

    // Retry delay for client reconnection
    raw.write('retry: 5000\n\n');

    // Replay missed events if reconnecting
    const lastEventIdHeader = request.headers['last-event-id'];
    const lastEventId = Array.isArray(lastEventIdHeader) ? lastEventIdHeader[0] : lastEventIdHeader;
    if (lastEventId) {
      const parsed = parseInt(lastEventId, 10);
      if (!Number.isNaN(parsed)) {
        fastify.sseManager.replayEvents(parsed, raw);
      }
    }

    // Register client
    fastify.sseManager.addClient(clientId, raw);

    // Cleanup on disconnect
    request.raw.on('close', () => {
      fastify.sseManager.removeClient(clientId);
      fastify.log.info({ clientId }, 'SSE client disconnected');
    });
  });
};

export default eventsRoutes;
