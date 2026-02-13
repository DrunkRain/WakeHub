import type { FastifyPluginAsync, FastifyError } from 'fastify';
import { eq, and, inArray } from 'drizzle-orm';
import { nodes, cascades } from '../db/schema.js';
import { decrypt } from '../utils/crypto.js';
import { executeCascadeStart, executeCascadeStop, type CascadeProgressEvent } from '../services/cascade-engine.js';

const errorResponseSchema = {
  type: 'object' as const,
  properties: {
    error: {
      type: 'object' as const,
      properties: {
        code: { type: 'string' as const },
        message: { type: 'string' as const },
        details: { type: 'object' as const, additionalProperties: true },
      },
    },
  },
};

const cascadeShortSchema = {
  type: 'object' as const,
  properties: {
    data: {
      type: 'object' as const,
      properties: {
        cascade: {
          type: 'object' as const,
          properties: {
            id: { type: 'string' as const },
            nodeId: { type: 'string' as const },
            type: { type: 'string' as const },
            status: { type: 'string' as const },
          },
        },
      },
    },
  },
};

const cascadeDetailSchema = {
  type: 'object' as const,
  properties: {
    data: {
      type: 'object' as const,
      properties: {
        cascade: {
          type: 'object' as const,
          properties: {
            id: { type: 'string' as const },
            nodeId: { type: 'string' as const },
            type: { type: 'string' as const },
            status: { type: 'string' as const },
            currentStep: { type: 'number' as const },
            totalSteps: { type: 'number' as const },
            failedStep: { type: ['number', 'null'] as const },
            errorCode: { type: ['string', 'null'] as const },
            errorMessage: { type: ['string', 'null'] as const },
            startedAt: { type: 'string' as const },
            completedAt: { type: ['string', 'null'] as const },
          },
        },
      },
    },
  },
};

function broadcastCascadeEvent(sseManager: { broadcast(event: string, data: unknown): void }, event: CascadeProgressEvent): void {
  switch (event.type) {
    case 'cascade-started':
      sseManager.broadcast('cascade-progress', {
        cascadeId: event.cascadeId,
        nodeId: event.nodeId,
        step: 0,
        totalSteps: event.totalSteps,
        status: 'started',
      });
      break;
    case 'step-progress':
      sseManager.broadcast('cascade-progress', {
        cascadeId: event.cascadeId,
        nodeId: event.nodeId,
        step: event.stepIndex,
        totalSteps: event.totalSteps,
        currentNodeId: event.currentNodeId,
        currentNodeName: event.currentNodeName,
      });
      break;
    case 'node-status-change':
      sseManager.broadcast('status-change', {
        nodeId: event.nodeId,
        status: event.status,
        timestamp: new Date().toISOString(),
      });
      break;
    case 'cascade-complete':
      if (event.success) {
        sseManager.broadcast('cascade-complete', {
          cascadeId: event.cascadeId,
          nodeId: event.nodeId,
          success: true,
        });
      } else {
        sseManager.broadcast('cascade-error', {
          cascadeId: event.cascadeId,
          nodeId: event.nodeId,
          error: event.error,
        });
      }
      break;
  }
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

  // POST /api/cascades/start
  fastify.post<{ Body: { nodeId: string } }>(
    '/start',
    {
      schema: {
        body: {
          type: 'object',
          required: ['nodeId'],
          properties: {
            nodeId: { type: 'string', minLength: 1 },
          },
        },
        response: {
          200: cascadeShortSchema,
          400: errorResponseSchema,
          404: errorResponseSchema,
          409: errorResponseSchema,
          500: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const { nodeId } = request.body;

      try {
        // Verify node exists
        const [node] = await fastify.db.select({ id: nodes.id }).from(nodes).where(eq(nodes.id, nodeId));
        if (!node) {
          return reply.status(404).send({
            error: { code: 'CASCADE_NODE_NOT_FOUND', message: 'Noeud introuvable' },
          });
        }

        // Check for an already-running cascade on this node
        const [active] = await fastify.db
          .select({ id: cascades.id })
          .from(cascades)
          .where(and(eq(cascades.nodeId, nodeId), inArray(cascades.status, ['pending', 'in_progress'])));
        if (active) {
          return reply.status(409).send({
            error: { code: 'CASCADE_ALREADY_RUNNING', message: 'Une cascade est déjà en cours pour ce noeud' },
          });
        }

        // Create cascade record
        const [cascade] = await fastify.db
          .insert(cascades)
          .values({ nodeId, type: 'start' })
          .returning();

        // Fire-and-forget with SSE broadcast
        const onProgress = (event: CascadeProgressEvent) => broadcastCascadeEvent(fastify.sseManager, event);
        executeCascadeStart(nodeId, fastify.db, {
          cascadeId: cascade!.id,
          onProgress,
          decryptFn: decrypt,
        }).catch((err) => {
          fastify.log.error({ err, cascadeId: cascade!.id }, 'Cascade start failed');
        });

        return {
          data: {
            cascade: {
              id: cascade!.id,
              nodeId: cascade!.nodeId,
              type: cascade!.type,
              status: cascade!.status,
            },
          },
        };
      } catch (error) {
        fastify.log.error({ error: (error as Error).message }, 'Failed to create start cascade');
        return reply.status(500).send({
          error: {
            code: 'CASCADE_CREATION_FAILED',
            message: 'Impossible de créer la cascade de démarrage',
          },
        });
      }
    },
  );

  // POST /api/cascades/stop
  fastify.post<{ Body: { nodeId: string } }>(
    '/stop',
    {
      schema: {
        body: {
          type: 'object',
          required: ['nodeId'],
          properties: {
            nodeId: { type: 'string', minLength: 1 },
          },
        },
        response: {
          200: cascadeShortSchema,
          400: errorResponseSchema,
          404: errorResponseSchema,
          409: errorResponseSchema,
          500: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const { nodeId } = request.body;

      try {
        const [node] = await fastify.db.select({ id: nodes.id }).from(nodes).where(eq(nodes.id, nodeId));
        if (!node) {
          return reply.status(404).send({
            error: { code: 'CASCADE_NODE_NOT_FOUND', message: 'Noeud introuvable' },
          });
        }

        // Check for an already-running cascade on this node
        const [active] = await fastify.db
          .select({ id: cascades.id })
          .from(cascades)
          .where(and(eq(cascades.nodeId, nodeId), inArray(cascades.status, ['pending', 'in_progress'])));
        if (active) {
          return reply.status(409).send({
            error: { code: 'CASCADE_ALREADY_RUNNING', message: 'Une cascade est déjà en cours pour ce noeud' },
          });
        }

        const [cascade] = await fastify.db
          .insert(cascades)
          .values({ nodeId, type: 'stop' })
          .returning();

        // Fire-and-forget with SSE broadcast
        const onProgress = (event: CascadeProgressEvent) => broadcastCascadeEvent(fastify.sseManager, event);
        executeCascadeStop(nodeId, fastify.db, {
          cascadeId: cascade!.id,
          onProgress,
          decryptFn: decrypt,
        }).catch((err) => {
          fastify.log.error({ err, cascadeId: cascade!.id }, 'Cascade stop failed');
        });

        return {
          data: {
            cascade: {
              id: cascade!.id,
              nodeId: cascade!.nodeId,
              type: cascade!.type,
              status: cascade!.status,
            },
          },
        };
      } catch (error) {
        fastify.log.error({ error: (error as Error).message }, 'Failed to create stop cascade');
        return reply.status(500).send({
          error: {
            code: 'CASCADE_CREATION_FAILED',
            message: 'Impossible de créer la cascade d\'arrêt',
          },
        });
      }
    },
  );

  // GET /api/cascades/:id
  fastify.get<{ Params: { id: string } }>(
    '/:id',
    {
      schema: {
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string' },
          },
        },
        response: {
          200: cascadeDetailSchema,
          404: errorResponseSchema,
          500: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params;

      try {
        const [cascade] = await fastify.db
          .select()
          .from(cascades)
          .where(eq(cascades.id, id));

        if (!cascade) {
          return reply.status(404).send({
            error: { code: 'CASCADE_NOT_FOUND', message: 'Cascade introuvable' },
          });
        }

        return {
          data: {
            cascade: {
              id: cascade.id,
              nodeId: cascade.nodeId,
              type: cascade.type,
              status: cascade.status,
              currentStep: cascade.currentStep,
              totalSteps: cascade.totalSteps,
              failedStep: cascade.failedStep,
              errorCode: cascade.errorCode,
              errorMessage: cascade.errorMessage,
              startedAt: cascade.startedAt,
              completedAt: cascade.completedAt,
            },
          },
        };
      } catch (error) {
        fastify.log.error({ error: (error as Error).message }, 'Failed to get cascade');
        return reply.status(500).send({
          error: {
            code: 'CASCADE_QUERY_FAILED',
            message: 'Impossible de récupérer la cascade',
          },
        });
      }
    },
  );
};

export default cascadesRoutes;
