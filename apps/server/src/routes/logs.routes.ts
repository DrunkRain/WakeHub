import type { FastifyPluginAsync } from 'fastify';
import { desc, eq, and, gte, lte, like, or, sql } from 'drizzle-orm';
import { operationLogs } from '../db/schema.js';

interface LogsQuerystring {
  limit?: number;
  offset?: number;
  nodeId?: string;
  eventType?: string;
  level?: string;
  cascadeId?: string;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
}

const logsRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /api/logs — List operation logs with pagination and filters
  fastify.get<{ Querystring: LogsQuerystring }>(
    '/',
    {
      schema: {
        querystring: {
          type: 'object',
          properties: {
            limit: { type: 'integer', minimum: 1, maximum: 200, default: 50 },
            offset: { type: 'integer', minimum: 0, default: 0 },
            nodeId: { type: 'string', minLength: 1 },
            eventType: { type: 'string', enum: ['start', 'stop', 'auto-shutdown', 'error', 'decision', 'connection-test', 'register', 'login', 'logout', 'password-reset'] },
            level: { type: 'string', enum: ['info', 'warn', 'error'] },
            cascadeId: { type: 'string', minLength: 1 },
            dateFrom: { type: 'string', format: 'date-time' },
            dateTo: { type: 'string', format: 'date-time' },
            search: { type: 'string', minLength: 1 },
          },
        },
      },
    },
    async (request, reply) => {
      try {
        const {
          limit = 50,
          offset = 0,
          nodeId,
          eventType,
          level,
          cascadeId,
          dateFrom,
          dateTo,
          search,
        } = request.query;

        // Build filter conditions
        const conditions = [];

        if (nodeId) {
          conditions.push(eq(operationLogs.nodeId, nodeId));
        }
        if (eventType) {
          conditions.push(eq(operationLogs.eventType, eventType));
        }
        if (level) {
          conditions.push(eq(operationLogs.level, level as 'info' | 'warn' | 'error'));
        }
        if (cascadeId) {
          conditions.push(eq(operationLogs.cascadeId, cascadeId));
        }
        if (dateFrom) {
          conditions.push(gte(operationLogs.timestamp, new Date(dateFrom)));
        }
        if (dateTo) {
          conditions.push(lte(operationLogs.timestamp, new Date(dateTo)));
        }
        if (search) {
          const pattern = `%${search}%`;
          conditions.push(
            or(
              like(operationLogs.message, pattern),
              like(operationLogs.reason, pattern),
            )!,
          );
        }

        const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

        // Count total matching rows
        const [countResult] = await fastify.db
          .select({ count: sql<number>`count(*)` })
          .from(operationLogs)
          .where(whereClause);

        const total = countResult?.count ?? 0;

        // Fetch paginated logs (most recent first)
        const logs = await fastify.db
          .select()
          .from(operationLogs)
          .where(whereClause)
          .orderBy(desc(operationLogs.timestamp))
          .limit(limit)
          .offset(offset);

        // Map to API format (timestamp as ISO string)
        const mappedLogs = logs.map((log) => ({
          id: log.id,
          timestamp: log.timestamp instanceof Date
            ? log.timestamp.toISOString()
            : new Date((log.timestamp as unknown as number) * 1000).toISOString(),
          level: log.level,
          source: log.source,
          message: log.message,
          reason: log.reason ?? null,
          details: log.details ?? null,
          nodeId: log.nodeId ?? null,
          nodeName: log.nodeName ?? null,
          eventType: log.eventType ?? null,
          errorCode: log.errorCode ?? null,
          errorDetails: log.errorDetails ?? null,
          cascadeId: log.cascadeId ?? null,
        }));

        return { data: { logs: mappedLogs, total } };
      } catch (error) {
        fastify.log.error({ error: (error as Error).message }, 'Failed to fetch logs');
        return reply.status(500).send({
          error: {
            code: 'LOGS_QUERY_FAILED',
            message: 'Impossible de récupérer les logs',
          },
        });
      }
    },
  );
};

export default logsRoutes;
