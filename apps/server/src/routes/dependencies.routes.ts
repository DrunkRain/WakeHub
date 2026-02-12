import type { FastifyPluginAsync, FastifyError } from 'fastify';
import { eq, and, or } from 'drizzle-orm';
import { dependencyLinks, services, operationLogs } from '../db/schema.js';
import {
  isSharedDependency,
  validateLink,
  getUpstreamChain,
  getDownstreamDependents,
} from '../services/dependency-graph.js';

interface CreateBody {
  parentType: 'service';
  parentId: string;
  childType: 'service';
  childId: string;
  isShared?: boolean;
}

interface PatchBody {
  isShared: boolean;
}

interface NodeQuery {
  nodeType: 'service';
  nodeId: string;
}

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

const dependencyLinkSchema = {
  type: 'object' as const,
  properties: {
    id: { type: 'string' as const },
    parentType: { type: 'string' as const },
    parentId: { type: 'string' as const },
    childType: { type: 'string' as const },
    childId: { type: 'string' as const },
    isShared: { type: 'boolean' as const },
    isStructural: { type: 'boolean' as const },
    createdAt: { type: 'string' as const },
  },
};

const chainNodeSchema = {
  type: 'object' as const,
  properties: {
    nodeType: { type: 'string' as const },
    nodeId: { type: 'string' as const },
    name: { type: 'string' as const },
    status: { type: 'string' as const },
  },
};

function formatLink(link: typeof dependencyLinks.$inferSelect) {
  return {
    id: link.id,
    parentType: link.parentType,
    parentId: link.parentId,
    childType: link.childType,
    childId: link.childId,
    isShared: link.isShared,
    isStructural: link.isStructural,
    createdAt: link.createdAt.toISOString(),
  };
}

const ERROR_MESSAGES: Record<string, { status: number; message: string }> = {
  SELF_REFERENCE: { status: 400, message: 'Un noeud ne peut pas dépendre de lui-même' },
  NODE_NOT_FOUND: { status: 404, message: 'Le parent ou l\'enfant n\'existe pas' },
  DUPLICATE_LINK: { status: 409, message: 'Ce lien de dépendance existe déjà' },
  CYCLE_DETECTED: { status: 409, message: 'Ce lien créerait un cycle de dépendances' },
};

const dependenciesRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.setErrorHandler((error: FastifyError, _request, reply) => {
    if ('validation' in error && error.validation) {
      return reply.status(400).send({
        error: { code: 'VALIDATION_ERROR', message: error.message },
      });
    }
    throw error;
  });

  // POST /api/dependencies — Create a dependency link
  fastify.post<{ Body: CreateBody }>(
    '/api/dependencies',
    {
      schema: {
        body: {
          type: 'object',
          required: ['parentType', 'parentId', 'childType', 'childId'],
          properties: {
            parentType: { type: 'string', enum: ['service'] },
            parentId: { type: 'string', minLength: 1 },
            childType: { type: 'string', enum: ['service'] },
            childId: { type: 'string', minLength: 1 },
            isShared: { type: 'boolean' },
          },
        },
        response: {
          200: { type: 'object', properties: { data: dependencyLinkSchema } },
          400: errorSchema,
          401: errorSchema,
          404: errorSchema,
          409: errorSchema,
        },
      },
    },
    async (request, reply) => {
      const { parentType, parentId, childType, childId, isShared } = request.body;
      const validation = validateLink(fastify.db, parentType, parentId, childType, childId);

      if (!validation.valid) {
        const errInfo = ERROR_MESSAGES[validation.error!] ?? { status: 400, message: 'Erreur de validation' };

        fastify.db.insert(operationLogs).values({
          timestamp: new Date(), level: 'warn', source: 'dependencies',
          message: `Dependency creation rejected: ${validation.error}`,
          reason: validation.error!,
          details: { parentType, parentId, childType, childId },
        }).run();

        return reply.status(errInfo.status).send({
          error: { code: validation.error!, message: errInfo.message },
        });
      }

      const now = new Date();
      const id = crypto.randomUUID();

      fastify.db.insert(dependencyLinks).values({
        id, parentType, parentId, childType, childId,
        isShared: isShared ?? false,
        createdAt: now,
      }).run();

      const link = {
        id, parentType, parentId, childType, childId,
        isShared: isShared ?? false,
        isStructural: false,
        createdAt: now.toISOString(),
      };

      fastify.db.insert(operationLogs).values({
        timestamp: now, level: 'info', source: 'dependencies',
        message: `Dependency created: ${parentType}:${parentId} → ${childType}:${childId}`,
        reason: 'dependency-created',
        details: { linkId: id, parentType, parentId, childType, childId },
      }).run();

      fastify.log.info({ linkId: id }, 'Dependency link created');
      return { data: link };
    },
  );

  // GET /api/dependencies
  fastify.get<{ Querystring: Partial<NodeQuery> }>(
    '/api/dependencies',
    {
      schema: {
        querystring: {
          type: 'object',
          properties: {
            nodeType: { type: 'string', enum: ['service'] },
            nodeId: { type: 'string' },
          },
        },
        response: {
          200: { type: 'object', properties: { data: { type: 'array', items: dependencyLinkSchema } } },
          401: errorSchema,
        },
      },
    },
    async (request) => {
      const { nodeType, nodeId } = request.query;

      let links;
      if (nodeType && nodeId) {
        links = fastify.db.select().from(dependencyLinks)
          .where(or(
            and(eq(dependencyLinks.parentType, nodeType), eq(dependencyLinks.parentId, nodeId)),
            and(eq(dependencyLinks.childType, nodeType), eq(dependencyLinks.childId, nodeId)),
          ))
          .all();
      } else {
        links = fastify.db.select().from(dependencyLinks).all();
      }

      return { data: links.map(formatLink) };
    },
  );

  // GET /api/dependencies/chain
  fastify.get<{ Querystring: NodeQuery }>(
    '/api/dependencies/chain',
    {
      schema: {
        querystring: {
          type: 'object',
          required: ['nodeType', 'nodeId'],
          properties: {
            nodeType: { type: 'string', enum: ['service'] },
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
                  upstream: { type: 'array', items: chainNodeSchema },
                  downstream: { type: 'array', items: chainNodeSchema },
                },
              },
            },
          },
          401: errorSchema,
        },
      },
    },
    async (request) => {
      const { nodeType, nodeId } = request.query;
      const upstream = getUpstreamChain(fastify.db, nodeType, nodeId);
      const downstream = getDownstreamDependents(fastify.db, nodeType, nodeId);
      return { data: { upstream, downstream } };
    },
  );

  // DELETE /api/dependencies/:id — Protected against structural links
  fastify.delete<{ Params: { id: string } }>(
    '/api/dependencies/:id',
    {
      schema: {
        params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } },
        response: {
          200: { type: 'object', properties: { data: { type: 'object', properties: { success: { type: 'boolean' as const } } } } },
          401: errorSchema,
          403: errorSchema,
          404: errorSchema,
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params;
      const [existing] = fastify.db.select().from(dependencyLinks).where(eq(dependencyLinks.id, id)).all();

      if (!existing) {
        return reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'Lien de dépendance non trouvé' } });
      }

      if (existing.isStructural) {
        return reply.status(403).send({ error: { code: 'STRUCTURAL_LINK', message: 'Les liens structurels ne peuvent pas être supprimés' } });
      }

      fastify.db.delete(dependencyLinks).where(eq(dependencyLinks.id, id)).run();

      fastify.db.insert(operationLogs).values({
        timestamp: new Date(), level: 'info', source: 'dependencies',
        message: `Dependency deleted: ${existing.parentType}:${existing.parentId} → ${existing.childType}:${existing.childId}`,
        reason: 'dependency-deleted',
        details: { linkId: id },
      }).run();

      fastify.log.info({ linkId: id }, 'Dependency link deleted');
      return { data: { success: true } };
    },
  );

  // PATCH /api/dependencies/:id
  fastify.patch<{ Params: { id: string }; Body: PatchBody }>(
    '/api/dependencies/:id',
    {
      schema: {
        params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } },
        body: { type: 'object', required: ['isShared'], properties: { isShared: { type: 'boolean' } } },
        response: {
          200: { type: 'object', properties: { data: dependencyLinkSchema } },
          401: errorSchema,
          404: errorSchema,
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params;
      const { isShared } = request.body;

      const [existing] = fastify.db.select().from(dependencyLinks).where(eq(dependencyLinks.id, id)).all();

      if (!existing) {
        return reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'Lien de dépendance non trouvé' } });
      }

      fastify.db.update(dependencyLinks).set({ isShared }).where(eq(dependencyLinks.id, id)).run();

      fastify.db.insert(operationLogs).values({
        timestamp: new Date(), level: 'info', source: 'dependencies',
        message: `Dependency updated: isShared=${isShared}`,
        reason: 'dependency-updated',
        details: { linkId: id, isShared },
      }).run();

      fastify.log.info({ linkId: id, isShared }, 'Dependency link updated');
      return { data: formatLink({ ...existing, isShared }) };
    },
  );

  // GET /api/dependencies/graph
  const graphNodeSchema = {
    type: 'object' as const,
    properties: {
      id: { type: 'string' as const },
      name: { type: 'string' as const },
      nodeType: { type: 'string' as const },
      subType: { type: 'string' as const },
      status: { type: 'string' as const },
      isShared: { type: 'boolean' as const },
    },
  };

  const graphEdgeSchema = {
    type: 'object' as const,
    properties: {
      id: { type: 'string' as const },
      source: { type: 'string' as const },
      target: { type: 'string' as const },
      isShared: { type: 'boolean' as const },
      isStructural: { type: 'boolean' as const },
    },
  };

  fastify.get(
    '/api/dependencies/graph',
    {
      schema: {
        response: {
          200: {
            type: 'object',
            properties: {
              data: {
                type: 'object',
                properties: {
                  nodes: { type: 'array', items: graphNodeSchema },
                  edges: { type: 'array', items: graphEdgeSchema },
                },
              },
            },
          },
          401: errorSchema,
        },
      },
    },
    async () => {
      const allServices = fastify.db.select().from(services).all();
      const allLinks = fastify.db.select().from(dependencyLinks).all();

      // Build set of node IDs that appear in dependency links
      const linkedNodeIds = new Set<string>();
      for (const link of allLinks) {
        linkedNodeIds.add(`${link.parentType}:${link.parentId}`);
        linkedNodeIds.add(`${link.childType}:${link.childId}`);
      }

      // Build nodes array — only include nodes that participate in dependencies
      const nodes: Array<{
        id: string; name: string; nodeType: string; subType: string; status: string; isShared: boolean;
      }> = [];

      for (const s of allServices) {
        const key = `service:${s.id}`;
        if (!linkedNodeIds.has(key)) continue;
        nodes.push({
          id: key,
          name: s.name,
          nodeType: 'service',
          subType: s.type,
          status: s.status,
          isShared: isSharedDependency(fastify.db, 'service', s.id),
        });
      }

      // Build edges array
      const edges = allLinks.map((link) => ({
        id: link.id,
        source: `${link.parentType}:${link.parentId}`,
        target: `${link.childType}:${link.childId}`,
        isShared: link.isShared,
        isStructural: link.isStructural,
      }));

      return { data: { nodes, edges } };
    },
  );
};

export default dependenciesRoutes;
