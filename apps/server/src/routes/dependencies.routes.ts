import type { FastifyPluginAsync, FastifyError } from 'fastify';
import { eq } from 'drizzle-orm';
import { dependencyLinks, nodes, operationLogs } from '../db/schema.js';
import { validateLink } from '../services/dependency-graph.js';
import type { DependencyNodeInfo } from '@wakehub/shared';

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

const dependencySchema = {
  type: 'object' as const,
  properties: {
    id: { type: 'string' as const },
    fromNodeId: { type: 'string' as const },
    toNodeId: { type: 'string' as const },
    createdAt: { type: 'string' as const },
  },
};

const dependencyNodeInfoSchema = {
  type: 'object' as const,
  properties: {
    linkId: { type: 'string' as const },
    nodeId: { type: 'string' as const },
    name: { type: 'string' as const },
    type: { type: 'string' as const },
    status: { type: 'string' as const },
  },
};

const dependenciesRoutes: FastifyPluginAsync = async (fastify) => {
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

  // POST /api/dependencies — Create a dependency link
  fastify.post<{ Body: { fromNodeId: string; toNodeId: string } }>(
    '/',
    {
      schema: {
        body: {
          type: 'object',
          required: ['fromNodeId', 'toNodeId'],
          properties: {
            fromNodeId: { type: 'string', minLength: 1 },
            toNodeId: { type: 'string', minLength: 1 },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              data: {
                type: 'object',
                properties: {
                  dependency: dependencySchema,
                },
              },
            },
          },
          400: errorResponseSchema,
          404: errorResponseSchema,
          500: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const { fromNodeId, toNodeId } = request.body;

      try {
        // Verify both nodes exist
        const [fromNode] = await fastify.db.select({ id: nodes.id }).from(nodes).where(eq(nodes.id, fromNodeId));
        if (!fromNode) {
          return reply.status(404).send({
            error: { code: 'NODE_NOT_FOUND', message: 'Noeud introuvable' },
          });
        }

        const [toNode] = await fastify.db.select({ id: nodes.id }).from(nodes).where(eq(nodes.id, toNodeId));
        if (!toNode) {
          return reply.status(404).send({
            error: { code: 'NODE_NOT_FOUND', message: 'Noeud introuvable' },
          });
        }

        // Validate the link (self-link, duplicate, cycle)
        const validation = await validateLink(fromNodeId, toNodeId, fastify.db);
        if (!validation.valid) {
          return reply.status(400).send({
            error: { code: validation.code!, message: validation.message! },
          });
        }

        // Insert the dependency link
        const [dependency] = await fastify.db
          .insert(dependencyLinks)
          .values({ fromNodeId, toNodeId })
          .returning();

        // Log the operation
        fastify.log.info({ dependencyId: dependency!.id }, 'Dependency link created');
        await fastify.db.insert(operationLogs).values({
          level: 'info',
          source: 'dependencies',
          message: `Dependency link created: ${fromNodeId} → ${toNodeId}`,
          details: { dependencyId: dependency!.id, fromNodeId, toNodeId },
        });

        return { data: { dependency: dependency! } };
      } catch (error) {
        fastify.log.error({ error: (error as Error).message }, 'Failed to create dependency link');
        return reply.status(500).send({
          error: {
            code: 'DEPENDENCY_CREATION_FAILED',
            message: 'Impossible de créer le lien de dépendance',
          },
        });
      }
    },
  );

  // GET /api/dependencies?nodeId=X — Get upstream and downstream dependencies
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
                  upstream: { type: 'array', items: dependencyNodeInfoSchema },
                  downstream: { type: 'array', items: dependencyNodeInfoSchema },
                },
                additionalProperties: true,
              },
            },
          },
          404: errorResponseSchema,
          500: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const { nodeId } = request.query;

      try {
        // Verify node exists
        const [node] = await fastify.db.select({ id: nodes.id }).from(nodes).where(eq(nodes.id, nodeId));
        if (!node) {
          return reply.status(404).send({
            error: { code: 'NODE_NOT_FOUND', message: 'Noeud introuvable' },
          });
        }

        // Get direct upstream (what this node depends on) with link info
        const upstreamLinks = await fastify.db
          .select({
            linkId: dependencyLinks.id,
            nodeId: dependencyLinks.toNodeId,
            name: nodes.name,
            type: nodes.type,
            status: nodes.status,
          })
          .from(dependencyLinks)
          .innerJoin(nodes, eq(dependencyLinks.toNodeId, nodes.id))
          .where(eq(dependencyLinks.fromNodeId, nodeId));

        // Get direct downstream (nodes that depend on this one) with link info
        const downstreamLinks = await fastify.db
          .select({
            linkId: dependencyLinks.id,
            nodeId: dependencyLinks.fromNodeId,
            name: nodes.name,
            type: nodes.type,
            status: nodes.status,
          })
          .from(dependencyLinks)
          .innerJoin(nodes, eq(dependencyLinks.fromNodeId, nodes.id))
          .where(eq(dependencyLinks.toNodeId, nodeId));

        const upstream: DependencyNodeInfo[] = upstreamLinks.map((l) => ({
          linkId: l.linkId,
          nodeId: l.nodeId,
          name: l.name,
          type: l.type,
          status: l.status,
        }));

        const downstream: DependencyNodeInfo[] = downstreamLinks.map((l) => ({
          linkId: l.linkId,
          nodeId: l.nodeId,
          name: l.name,
          type: l.type,
          status: l.status,
        }));

        return { data: { upstream, downstream } };
      } catch (error) {
        fastify.log.error({ error: (error as Error).message }, 'Failed to get dependencies');
        return reply.status(500).send({
          error: {
            code: 'DEPENDENCY_QUERY_FAILED',
            message: 'Impossible de récupérer les dépendances',
          },
        });
      }
    },
  );

  // GET /api/dependencies/graph — Full dependency graph
  fastify.get(
    '/graph',
    {
      schema: {
        response: {
          200: {
            type: 'object',
            properties: {
              data: {
                type: 'object',
                properties: {
                  nodes: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        id: { type: 'string' },
                        name: { type: 'string' },
                        type: { type: 'string' },
                        status: { type: 'string' },
                      },
                    },
                  },
                  links: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        id: { type: 'string' },
                        fromNodeId: { type: 'string' },
                        toNodeId: { type: 'string' },
                        linkType: { type: 'string' },
                      },
                    },
                  },
                },
              },
            },
          },
          500: errorResponseSchema,
        },
      },
    },
    async (_request, reply) => {
      try {
        const allNodesRaw = await fastify.db
          .select({
            id: nodes.id,
            name: nodes.name,
            type: nodes.type,
            status: nodes.status,
            parentId: nodes.parentId,
          })
          .from(nodes);

        const functionalLinks = await fastify.db
          .select({
            id: dependencyLinks.id,
            fromNodeId: dependencyLinks.fromNodeId,
            toNodeId: dependencyLinks.toNodeId,
          })
          .from(dependencyLinks);

        // Build structural links from parentId relationships
        const structuralLinks = allNodesRaw
          .filter((n) => n.parentId)
          .map((n) => ({
            id: `structural-${n.id}`,
            fromNodeId: n.id,
            toNodeId: n.parentId!,
            linkType: 'structural' as const,
          }));

        const allLinks = [
          ...functionalLinks.map((l) => ({ ...l, linkType: 'functional' as const })),
          ...structuralLinks,
        ];

        const allNodes = allNodesRaw.map(({ parentId: _parentId, ...rest }) => rest);

        return { data: { nodes: allNodes, links: allLinks } };
      } catch (error) {
        fastify.log.error({ error: (error as Error).message }, 'Failed to get dependency graph');
        return reply.status(500).send({
          error: {
            code: 'DEPENDENCY_GRAPH_FAILED',
            message: 'Impossible de récupérer le graphe de dépendances',
          },
        });
      }
    },
  );

  // DELETE /api/dependencies/:id — Delete a dependency link
  fastify.delete<{ Params: { id: string } }>(
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
          200: {
            type: 'object',
            properties: {
              data: {
                type: 'object',
                properties: {
                  success: { type: 'boolean' },
                },
              },
            },
          },
          404: errorResponseSchema,
          500: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params;

      try {
        const [link] = await fastify.db
          .select()
          .from(dependencyLinks)
          .where(eq(dependencyLinks.id, id));

        if (!link) {
          return reply.status(404).send({
            error: { code: 'DEPENDENCY_NOT_FOUND', message: 'Lien de dépendance introuvable' },
          });
        }

        await fastify.db.delete(dependencyLinks).where(eq(dependencyLinks.id, id));

        fastify.log.info({ dependencyId: id }, 'Dependency link deleted');
        await fastify.db.insert(operationLogs).values({
          level: 'info',
          source: 'dependencies',
          message: `Dependency link deleted: ${link.fromNodeId} → ${link.toNodeId}`,
          details: { dependencyId: id, fromNodeId: link.fromNodeId, toNodeId: link.toNodeId },
        });

        return { data: { success: true } };
      } catch (error) {
        fastify.log.error({ error: (error as Error).message }, 'Failed to delete dependency link');
        return reply.status(500).send({
          error: {
            code: 'DEPENDENCY_DELETE_FAILED',
            message: 'Impossible de supprimer le lien de dépendance',
          },
        });
      }
    },
  );
};

export default dependenciesRoutes;
