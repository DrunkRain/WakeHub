import type { FastifyPluginAsync } from 'fastify';
import { eq, and, gte, isNotNull, sql } from 'drizzle-orm';
import { services, cascades } from '../db/schema.js';

const errorSchema = {
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
  // GET /api/stats — Dashboard stats
  fastify.get(
    '/api/stats',
    {
      schema: {
        response: {
          200: {
            type: 'object',
            properties: {
              data: {
                type: 'object',
                properties: {
                  activeServices: { type: 'number' },
                  cascadesToday: { type: 'number' },
                  avgCascadeTime: { type: 'number' },
                  inactivityHours: { type: 'number' },
                },
              },
            },
          },
          401: errorSchema,
        },
      },
    },
    async () => {
      // Active services: services with status='running' and service_url IS NOT NULL
      const activeRows = fastify.db
        .select({ count: sql<number>`count(*)` })
        .from(services)
        .where(and(eq(services.status, 'running'), isNotNull(services.serviceUrl)))
        .all();
      const activeServices = activeRows[0]?.count ?? 0;

      // Cascades today
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const cascadeTodayRows = fastify.db
        .select({ count: sql<number>`count(*)` })
        .from(cascades)
        .where(gte(cascades.startedAt, todayStart))
        .all();
      const cascadesToday = cascadeTodayRows[0]?.count ?? 0;

      // Avg cascade time
      const avgRows = fastify.db
        .select({ avg: sql<number>`avg(completed_at - started_at)` })
        .from(cascades)
        .where(and(eq(cascades.status, 'completed'), gte(cascades.startedAt, todayStart), isNotNull(cascades.completedAt)))
        .all();
      const avgCascadeTime = Math.round(avgRows[0]?.avg ?? 0);

      const inactivityHours = 0;

      return { data: { activeServices, cascadesToday, avgCascadeTime, inactivityHours } };
    },
  );
};

export default statsRoutes;
