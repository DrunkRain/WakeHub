import type { FastifyPluginAsync, FastifyError } from 'fastify';
import { eq } from 'drizzle-orm';
import { inactivityRules, nodes } from '../db/schema.js';

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

const ruleSchema = {
  type: 'object' as const,
  properties: {
    id: { type: 'string' as const },
    nodeId: { type: 'string' as const },
    timeoutMinutes: { type: 'number' as const },
    monitoringCriteria: {
      type: 'object' as const,
      properties: {
        lastAccess: { type: 'boolean' as const },
        networkConnections: { type: 'boolean' as const },
        cpuRamActivity: { type: 'boolean' as const },
        cpuThreshold: { type: 'number' as const },
        ramThreshold: { type: 'number' as const },
      },
    },
    isEnabled: { type: 'boolean' as const },
    createdAt: { type: 'string' as const },
    updatedAt: { type: 'string' as const },
  },
};

const monitoringCriteriaSchema = {
  type: 'object' as const,
  properties: {
    lastAccess: { type: 'boolean' as const },
    networkConnections: { type: 'boolean' as const },
    cpuRamActivity: { type: 'boolean' as const },
    cpuThreshold: { type: 'number' as const, minimum: 0.01, maximum: 1.0 },
    ramThreshold: { type: 'number' as const, minimum: 0.01, maximum: 1.0 },
  },
  additionalProperties: false,
};

const inactivityRulesRoutes: FastifyPluginAsync = async (fastify) => {
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

  // GET /api/inactivity-rules?nodeId=X
  fastify.get<{ Querystring: { nodeId: string } }>(
    '/',
    {
      schema: {
        querystring: {
          type: 'object',
          required: ['nodeId'],
          properties: {
            nodeId: { type: 'string', minLength: 1 },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              data: {
                type: 'object',
                properties: {
                  rules: { type: 'array', items: ruleSchema },
                },
              },
            },
          },
          500: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      try {
        const rules = await fastify.db
          .select()
          .from(inactivityRules)
          .where(eq(inactivityRules.nodeId, request.query.nodeId));

        return { data: { rules } };
      } catch (error) {
        fastify.log.error({ error: (error as Error).message }, 'Failed to get inactivity rules');
        return reply.status(500).send({
          error: {
            code: 'INACTIVITY_RULES_QUERY_FAILED',
            message: 'Impossible de récupérer les règles d\'inactivité',
          },
        });
      }
    },
  );

  // PUT /api/inactivity-rules/:id
  fastify.put<{
    Params: { id: string };
    Body: { timeoutMinutes?: number; monitoringCriteria?: { lastAccess: boolean; networkConnections: boolean; cpuRamActivity: boolean; cpuThreshold?: number; ramThreshold?: number }; isEnabled?: boolean };
  }>(
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
        body: {
          type: 'object',
          properties: {
            timeoutMinutes: { type: 'integer', minimum: 1 },
            monitoringCriteria: monitoringCriteriaSchema,
            isEnabled: { type: 'boolean' },
          },
          additionalProperties: false,
        },
        response: {
          200: {
            type: 'object',
            properties: {
              data: { type: 'object', properties: { rule: ruleSchema } },
            },
          },
          404: errorResponseSchema,
          500: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params;
      const body = request.body;

      try {
        const [existing] = await fastify.db
          .select()
          .from(inactivityRules)
          .where(eq(inactivityRules.id, id));

        if (!existing) {
          return reply.status(404).send({
            error: { code: 'INACTIVITY_RULE_NOT_FOUND', message: 'Règle d\'inactivité introuvable' },
          });
        }

        const updates: Record<string, unknown> = { updatedAt: new Date() };
        if (body.timeoutMinutes !== undefined) updates.timeoutMinutes = body.timeoutMinutes;
        if (body.monitoringCriteria !== undefined) updates.monitoringCriteria = body.monitoringCriteria;
        if (body.isEnabled !== undefined) updates.isEnabled = body.isEnabled;

        const [updated] = await fastify.db
          .update(inactivityRules)
          .set(updates)
          .where(eq(inactivityRules.id, id))
          .returning();

        return { data: { rule: updated } };
      } catch (error) {
        fastify.log.error({ error: (error as Error).message }, 'Failed to update inactivity rule');
        return reply.status(500).send({
          error: {
            code: 'INACTIVITY_RULE_UPDATE_FAILED',
            message: 'Impossible de mettre à jour la règle d\'inactivité',
          },
        });
      }
    },
  );

  // POST /api/inactivity-rules
  fastify.post<{
    Body: {
      nodeId: string;
      timeoutMinutes?: number;
      monitoringCriteria?: { lastAccess: boolean; networkConnections: boolean; cpuRamActivity: boolean; cpuThreshold?: number; ramThreshold?: number };
      isEnabled?: boolean;
    };
  }>(
    '/',
    {
      schema: {
        body: {
          type: 'object',
          required: ['nodeId'],
          properties: {
            nodeId: { type: 'string', minLength: 1 },
            timeoutMinutes: { type: 'integer', minimum: 1 },
            monitoringCriteria: monitoringCriteriaSchema,
            isEnabled: { type: 'boolean' },
          },
          additionalProperties: false,
        },
        response: {
          201: {
            type: 'object',
            properties: {
              data: { type: 'object', properties: { rule: ruleSchema } },
            },
          },
          404: errorResponseSchema,
          500: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const { nodeId, timeoutMinutes, monitoringCriteria, isEnabled } = request.body;

      try {
        // Verify node exists
        const [node] = await fastify.db
          .select({ id: nodes.id })
          .from(nodes)
          .where(eq(nodes.id, nodeId));

        if (!node) {
          return reply.status(404).send({
            error: { code: 'NODE_NOT_FOUND', message: 'Noeud introuvable' },
          });
        }

        const values: Record<string, unknown> = { nodeId };
        if (timeoutMinutes !== undefined) values.timeoutMinutes = timeoutMinutes;
        if (monitoringCriteria !== undefined) values.monitoringCriteria = monitoringCriteria;
        if (isEnabled !== undefined) values.isEnabled = isEnabled;

        const [rule] = await fastify.db
          .insert(inactivityRules)
          .values(values as typeof inactivityRules.$inferInsert)
          .returning();

        return reply.status(201).send({ data: { rule } });
      } catch (error) {
        fastify.log.error({ error: (error as Error).message }, 'Failed to create inactivity rule');
        return reply.status(500).send({
          error: {
            code: 'INACTIVITY_RULE_CREATION_FAILED',
            message: 'Impossible de créer la règle d\'inactivité',
          },
        });
      }
    },
  );
};

export default inactivityRulesRoutes;
