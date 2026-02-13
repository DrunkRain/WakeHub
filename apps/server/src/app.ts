import Fastify from 'fastify';
import fastifySwagger from '@fastify/swagger';
import fastifySwaggerUi from '@fastify/swagger-ui';
import fastifyStatic from '@fastify/static';
import fastifyCookie from '@fastify/cookie';
import fastifyCors from '@fastify/cors';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { config } from './config.js';

// Establish database connection
import { db } from './db/index.js';
import authRoutes from './routes/auth.js';
import nodesRoutes from './routes/nodes.routes.js';
import dependenciesRoutes from './routes/dependencies.routes.js';
import cascadesRoutes from './routes/cascades.routes.js';
import eventsRoutes from './routes/events.routes.js';
import statsRoutes from './routes/stats.routes.js';
import { SSEManager } from './sse/sse-manager.js';
import { authMiddleware, cleanExpiredSessions } from './middleware/auth.middleware.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = Fastify({ logger: true });

// Inject db into app context
app.decorate('db', db);

// Inject SSE manager into app context (Story 4.2)
const sseManager = new SSEManager();
app.decorate('sseManager', sseManager);

await app.register(fastifyCookie);

// CORS — restrict to configured origin
await app.register(fastifyCors, {
  origin: config.corsOrigin,
  credentials: true,
});

// Register auth routes (public - Story 1.3 & 1.4)
await app.register(authRoutes);

// Register nodes routes (protected - Story 2.1)
await app.register(nodesRoutes);

// Register dependencies routes (protected - Story 3.1)
await app.register(dependenciesRoutes, { prefix: '/api/dependencies' });

// Register cascades routes (protected - Story 4.1)
await app.register(cascadesRoutes, { prefix: '/api/cascades' });

// Register SSE events route (protected - Story 4.2)
await app.register(eventsRoutes, { prefix: '/api' });

// Register stats routes (protected - Story 4.3)
await app.register(statsRoutes, { prefix: '/api/stats' });

// Register auth middleware on all /api routes except auth routes (Story 1.4)
app.addHook('preHandler', async (request, reply) => {
  // Skip middleware for non-API routes and public auth routes
  if (
    !request.url.startsWith('/api') ||
    request.url.startsWith('/api/auth/login') ||
    request.url.startsWith('/api/auth/register') ||
    request.url.startsWith('/api/auth/check-setup') ||
    request.url.startsWith('/api/auth/get-security-question') ||
    request.url.startsWith('/api/auth/reset-password') ||
    request.url.startsWith('/api/auth/logout') ||
    request.url.startsWith('/api/auth/me') ||
    request.url === '/api/health'
  ) {
    return;
  }

  await authMiddleware(request, reply);
});

await app.register(fastifySwagger, {
  openapi: {
    info: {
      title: 'WakeHub API',
      version: '0.1.0',
    },
  },
});

await app.register(fastifySwaggerUi, {
  routePrefix: '/docs',
});

app.get('/api/health', async () => {
  return { data: { status: 'ok' } };
});


if (config.nodeEnv === 'production') {
  await app.register(fastifyStatic, {
    root: path.join(__dirname, '../../web/dist'),
    prefix: '/',
  });

  app.setNotFoundHandler(async (req, reply) => {
    if (!req.url.startsWith('/api')) {
      return reply.sendFile('index.html');
    }
    return reply.status(404).send({
      error: { code: 'NOT_FOUND', message: 'Route not found' },
    });
  });
}

// Clean expired sessions on startup
await cleanExpiredSessions();

try {
  await app.listen({ port: config.port, host: '0.0.0.0' });
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
