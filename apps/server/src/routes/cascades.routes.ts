import type { FastifyPluginAsync, FastifyError } from 'fastify';
import { eq, desc } from 'drizzle-orm';
import { cascades } from '../db/schema.js';
import { executeCascadeStart, executeCascadeStop } from '../services/cascade-engine.js';
import { nodeExists } from '../services/dependency-graph.js';

const errorSchema = {
  type: 'object' as const,
  properties: {
    error: {
      type: 'object' as const,
      properties: {
        code: { type: 'string' as const },
        message: { type: 'string' as const },
        details: {},
      },
    },
  },
};

const cascadeSchema = {
  type: 'object' as const,
  properties: {
    id: { type: 'string' as const },
    serviceId: { type: 'string' as const },
    type: { type: 'string' as const },
    status: { type: 'string' as const },
    currentStep: { type: 'number' as const },
    totalSteps: { type: 'number' as const },
    failedStep: { type: 'number' as const, nullable: true },
    errorCode: { type: 'string' as const, nullable: true },
    errorMessage: { type: 'string' as const, nullable: true },
    startedAt: { type: 'string' as const },
    completedAt: { type: 'string' as const, nullable: true },
  },
};

function formatCascade(c: typeof cascades.$inferSelect) {
  return {
    id: c.id,
    serviceId: c.serviceId,
    type: c.type,
    status: c.status,
    currentStep: c.currentStep,
    totalSteps: c.totalSteps,
    failedStep: c.failedStep,
    errorCode: c.errorCode,
    errorMessage: c.errorMessage,
    startedAt: c.startedAt.toISOString(),
    completedAt: c.completedAt?.toISOString() ?? null,
  };
}

const cascadesRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.setErrorHandler((error: FastifyError, _request, reply) => {
    if ('validation' in error && error.validation) {
      return reply.status(400).send({
        error: {
          code: 'VALIDATION_ERROR',
          message: error.message,
          details: error.validation,
        },
      });
    }
    throw error;
  });

  // POST /api/cascades/start — Launch async start cascade
  fastify.post<{ Body: { serviceId: string } }>(
    '/api/cascades/start',
    {
      schema: {
        body: {
          type: 'object',
          required: ['serviceId'],
          properties: {
            serviceId: { type: 'string', minLength: 1 },
          },
        },
        response: {
          200: { type: 'object', properties: { data: cascadeSchema } },
          400: errorSchema,
          401: errorSchema,
          404: errorSchema,
        },
      },
    },
    async (request, reply) => {
      const { serviceId } = request.body;

      if (!nodeExists(fastify.db, 'service', serviceId)) {
        return reply.status(404).send({
          error: { code: 'NOT_FOUND', message: 'Service non trouvé' },
        });
      }

      const existing = fastify.db.select().from(cascades)
        .where(eq(cascades.serviceId, serviceId))
        .all()
        .filter((c) => c.status === 'pending' || c.status === 'in_progress');

      if (existing.length > 0) {
        return reply.status(400).send({
          error: { code: 'CASCADE_IN_PROGRESS', message: 'Une cascade est déjà en cours pour ce service' },
        });
      }

      const cascadeId = crypto.randomUUID();
      fastify.db.insert(cascades).values({
        id: cascadeId,
        serviceId,
        type: 'start',
        status: 'pending',
        currentStep: 0,
        totalSteps: 0,
        startedAt: new Date(),
      }).run();

      executeCascadeStart(fastify.db, cascadeId, serviceId, { sseManager: fastify.sseManager }).catch((err) => {
        fastify.log.error({ cascadeId, err }, 'Cascade start failed unexpectedly');
      });

      const [cascade] = fastify.db.select().from(cascades).where(eq(cascades.id, cascadeId)).all();
      return { data: formatCascade(cascade!) };
    },
  );

  // POST /api/cascades/stop — Launch async stop cascade
  fastify.post<{ Body: { serviceId: string } }>(
    '/api/cascades/stop',
    {
      schema: {
        body: {
          type: 'object',
          required: ['serviceId'],
          properties: {
            serviceId: { type: 'string', minLength: 1 },
          },
        },
        response: {
          200: { type: 'object', properties: { data: cascadeSchema } },
          400: errorSchema,
          401: errorSchema,
          404: errorSchema,
        },
      },
    },
    async (request, reply) => {
      const { serviceId } = request.body;

      if (!nodeExists(fastify.db, 'service', serviceId)) {
        return reply.status(404).send({
          error: { code: 'NOT_FOUND', message: 'Service non trouvé' },
        });
      }

      const existing = fastify.db.select().from(cascades)
        .where(eq(cascades.serviceId, serviceId))
        .all()
        .filter((c) => c.status === 'pending' || c.status === 'in_progress');

      if (existing.length > 0) {
        return reply.status(400).send({
          error: { code: 'CASCADE_IN_PROGRESS', message: 'Une cascade est déjà en cours pour ce service' },
        });
      }

      const cascadeId = crypto.randomUUID();
      fastify.db.insert(cascades).values({
        id: cascadeId,
        serviceId,
        type: 'stop',
        status: 'pending',
        currentStep: 0,
        totalSteps: 0,
        startedAt: new Date(),
      }).run();

      executeCascadeStop(fastify.db, cascadeId, serviceId, { sseManager: fastify.sseManager }).catch((err) => {
        fastify.log.error({ cascadeId, err }, 'Cascade stop failed unexpectedly');
      });

      const [cascade] = fastify.db.select().from(cascades).where(eq(cascades.id, cascadeId)).all();
      return { data: formatCascade(cascade!) };
    },
  );

  // GET /api/cascades/active
  fastify.get(
    '/api/cascades/active',
    {
      schema: {
        response: {
          200: { type: 'object', properties: { data: { type: 'array', items: cascadeSchema } } },
          401: errorSchema,
        },
      },
    },
    async () => {
      const rows = fastify.db.select().from(cascades).all()
        .filter((c) => c.status === 'pending' || c.status === 'in_progress');
      return { data: rows.map(formatCascade) };
    },
  );

  // GET /api/cascades/history
  fastify.get<{ Querystring: { serviceId: string } }>(
    '/api/cascades/history',
    {
      schema: {
        querystring: {
          type: 'object',
          required: ['serviceId'],
          properties: { serviceId: { type: 'string', minLength: 1 } },
        },
        response: {
          200: { type: 'object', properties: { data: { type: 'array', items: cascadeSchema } } },
          400: errorSchema,
          401: errorSchema,
        },
      },
    },
    async (request) => {
      const { serviceId } = request.query;
      const rows = fastify.db.select().from(cascades)
        .where(eq(cascades.serviceId, serviceId))
        .orderBy(desc(cascades.startedAt))
        .limit(20)
        .all();
      return { data: rows.map(formatCascade) };
    },
  );

  // GET /api/cascades/:id
  fastify.get<{ Params: { id: string } }>(
    '/api/cascades/:id',
    {
      schema: {
        params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } },
        response: {
          200: { type: 'object', properties: { data: cascadeSchema } },
          401: errorSchema,
          404: errorSchema,
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params;
      const [cascade] = fastify.db.select().from(cascades).where(eq(cascades.id, id)).all();

      if (!cascade) {
        return reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'Cascade non trouvée' } });
      }

      return { data: formatCascade(cascade) };
    },
  );
};

export default cascadesRoutes;
