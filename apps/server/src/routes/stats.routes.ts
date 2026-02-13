import type { FastifyPluginAsync } from 'fastify';
import { nodes, cascades } from '../db/schema.js';
import { eq, sql, and, gte } from 'drizzle-orm';

const errorResponseSchema = {
  type: 'object' as const,
  properties: {
    error: {
      type: 'object' as const,
      properties: {
        code: { type: 'string' as const },
        message: { type: 'string' as const },
      },
    },
  },
};

const statsRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /api/stats/dashboard — Dashboard statistics
  fastify.get('/dashboard', {
    schema: {
      response: {
        200: {
          type: 'object' as const,
          properties: {
            data: {
              type: 'object' as const,
              properties: {
                nodesOnline: { type: 'integer' as const },
                nodesTotal: { type: 'integer' as const },
                cascadesToday: { type: 'integer' as const },
                avgCascadeDurationMs: { type: ['number', 'null'] as const },
              },
            },
          },
        },
        500: errorResponseSchema,
      },
    },
  }, async (_request, reply) => {
    try {
      // Count configured nodes (online and total)
      const [nodeStats] = await fastify.db
        .select({
          nodesOnline: sql<number>`COALESCE(SUM(CASE WHEN ${nodes.status} = 'online' THEN 1 ELSE 0 END), 0)`,
          nodesTotal: sql<number>`COUNT(*)`,
        })
        .from(nodes)
        .where(eq(nodes.configured, true));

      // Start of today (midnight local time)
      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

      // Count cascades started today
      const [cascadeStats] = await fastify.db
        .select({
          cascadesToday: sql<number>`COUNT(*)`,
        })
        .from(cascades)
        .where(gte(cascades.startedAt, todayStart));

      // Average duration of completed cascades today (in ms)
      const [avgStats] = await fastify.db
        .select({
          avgDurationMs: sql<number | null>`AVG(CASE WHEN ${cascades.completedAt} IS NOT NULL THEN (${cascades.completedAt} - ${cascades.startedAt}) * 1000 ELSE NULL END)`,
        })
        .from(cascades)
        .where(
          and(
            gte(cascades.startedAt, todayStart),
            eq(cascades.status, 'completed'),
          ),
        );

      return {
        data: {
          nodesOnline: Number(nodeStats?.nodesOnline ?? 0),
          nodesTotal: Number(nodeStats?.nodesTotal ?? 0),
          cascadesToday: Number(cascadeStats?.cascadesToday ?? 0),
          avgCascadeDurationMs: avgStats?.avgDurationMs != null ? Number(avgStats.avgDurationMs) : null,
        },
      };
    } catch (error) {
      fastify.log.error({ error: (error as Error).message }, 'Failed to fetch dashboard stats');
      return reply.status(500).send({
        error: {
          code: 'STATS_FETCH_FAILED',
          message: (error as Error).message,
        },
      });
    }
  });
};

export default statsRoutes;
