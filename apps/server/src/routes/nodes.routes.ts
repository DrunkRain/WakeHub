import type { FastifyPluginAsync, FastifyError } from 'fastify';
import { eq } from 'drizzle-orm';
import { nodes, operationLogs } from '../db/schema.js';
import { encrypt, decrypt } from '../utils/crypto.js';
import { getConnector } from '../connectors/connector-factory.js';
import { PlatformError } from '../utils/platform-error.js';
import type { Node } from '@wakehub/shared';

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

const nodeSchema = {
  type: 'object' as const,
  properties: {
    id: { type: 'string' as const },
    name: { type: 'string' as const },
    type: { type: 'string' as const },
    status: { type: 'string' as const },
    ipAddress: { type: ['string', 'null'] as const },
    macAddress: { type: ['string', 'null'] as const },
    sshUser: { type: ['string', 'null'] as const },
    parentId: { type: ['string', 'null'] as const },
    capabilities: {},
    platformRef: {},
    serviceUrl: { type: ['string', 'null'] as const },
    isPinned: { type: 'boolean' as const },
    confirmBeforeShutdown: { type: 'boolean' as const },
    discovered: { type: 'boolean' as const },
    configured: { type: 'boolean' as const },
    createdAt: { type: 'string' as const },
    updatedAt: { type: 'string' as const },
  },
};

function sanitizeNode(node: Record<string, unknown>): Omit<Node, 'sshCredentialsEncrypted'> {
  const { sshCredentialsEncrypted: _, ...safe } = node;
  return safe as Omit<Node, 'sshCredentialsEncrypted'>;
}

interface CreateNodeBody {
  name: string;
  type: 'physical' | 'vm' | 'lxc' | 'container';
  ipAddress?: string;
  macAddress?: string;
  sshUser?: string;
  sshPassword?: string;
  parentId?: string;
  serviceUrl?: string;
}

interface TestConnectionParams {
  id: string;
}

const nodesRoutes: FastifyPluginAsync = async (fastify) => {
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

  // POST /api/nodes — Create a new node
  fastify.post<{ Body: CreateNodeBody }>(
    '/api/nodes',
    {
      schema: {
        body: {
          type: 'object',
          required: ['name', 'type'],
          properties: {
            name: { type: 'string', minLength: 1, maxLength: 100 },
            type: { type: 'string', enum: ['physical', 'vm', 'lxc', 'container'] },
            ipAddress: { type: 'string' },
            macAddress: { type: 'string' },
            sshUser: { type: 'string' },
            sshPassword: { type: 'string' },
            parentId: { type: 'string' },
            serviceUrl: { type: 'string' },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              data: {
                type: 'object',
                properties: {
                  node: nodeSchema,
                },
              },
            },
          },
          400: errorResponseSchema,
        },
      },
    },
    async (request, _reply) => {
      const { name, type, ipAddress, macAddress, sshUser, sshPassword, parentId, serviceUrl } = request.body;

      // Encrypt SSH password if provided
      const sshCredentialsEncrypted = sshPassword ? encrypt(sshPassword) : null;

      const [newNode] = await fastify.db
        .insert(nodes)
        .values({
          name,
          type,
          ipAddress: ipAddress ?? null,
          macAddress: macAddress ?? null,
          sshUser: sshUser ?? null,
          sshCredentialsEncrypted,
          parentId: parentId ?? null,
          serviceUrl: serviceUrl ?? null,
          confirmBeforeShutdown: type === 'physical',
        })
        .returning();

      // Log the operation
      await fastify.db.insert(operationLogs).values({
        level: 'info',
        source: 'nodes',
        message: `Node created: ${name} (${type})`,
        details: { nodeId: newNode!.id, type },
      });

      fastify.log.info({ nodeId: newNode!.id, type }, `Node created: ${name}`);

      return { data: { node: sanitizeNode(newNode as unknown as Record<string, unknown>) } };
    },
  );

  // GET /api/nodes — List all configured nodes
  fastify.get(
    '/api/nodes',
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
                    items: nodeSchema,
                  },
                },
              },
            },
          },
        },
      },
    },
    async () => {
      const allNodes = await fastify.db
        .select()
        .from(nodes)
        .where(eq(nodes.configured, true));

      const safeNodes = allNodes.map((n) => sanitizeNode(n as unknown as Record<string, unknown>));
      return { data: { nodes: safeNodes } };
    },
  );

  // POST /api/nodes/:id/test-connection — Test connection to a node
  fastify.post<{ Params: TestConnectionParams }>(
    '/api/nodes/:id/test-connection',
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
                  message: { type: 'string' },
                },
              },
            },
          },
          400: errorResponseSchema,
          404: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params;

      const [node] = await fastify.db
        .select()
        .from(nodes)
        .where(eq(nodes.id, id));

      if (!node) {
        return reply.status(404).send({
          error: { code: 'NODE_NOT_FOUND', message: `Node ${id} not found` },
        });
      }

      try {
        const connector = getConnector(node.type as 'physical' | 'vm' | 'lxc' | 'container');

        // Decrypt credentials before passing to connector
        const decryptedPassword = node.sshCredentialsEncrypted
          ? decrypt(node.sshCredentialsEncrypted)
          : null;

        const nodeForConnector: Node = {
          ...node,
          sshCredentialsEncrypted: decryptedPassword,
          capabilities: node.capabilities as Node['capabilities'],
          platformRef: node.platformRef as Node['platformRef'],
          createdAt: node.createdAt,
          updatedAt: node.updatedAt,
        };

        await connector.testConnection(nodeForConnector);

        return { data: { success: true, message: 'Connection successful' } };
      } catch (error) {
        if (error instanceof PlatformError) {
          return reply.status(400).send({
            error: {
              code: error.code,
              message: error.message,
              details: { platform: error.platform, ...error.details },
            },
          });
        }
        return reply.status(400).send({
          error: {
            code: 'CONNECTION_TEST_FAILED',
            message: (error as Error).message,
          },
        });
      }
    },
  );
};

export default nodesRoutes;
