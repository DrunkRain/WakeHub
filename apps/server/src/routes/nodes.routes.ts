import type { FastifyPluginAsync, FastifyError } from 'fastify';
import { eq } from 'drizzle-orm';
import { nodes, operationLogs } from '../db/schema.js';
import { encrypt, decrypt } from '../utils/crypto.js';
import { getConnector } from '../connectors/connector-factory.js';
import { ProxmoxConnector } from '../connectors/proxmox.connector.js';
import { ProxmoxClient } from '../connectors/proxmox-client.js';
import { DockerClient } from '../connectors/docker-client.js';
import { DockerConnector } from '../connectors/docker.connector.js';
import { PlatformError } from '../utils/platform-error.js';
import type { Node, NodeCapabilities, ProxmoxCapability, ConfigureProxmoxRequest, ConfigureDockerRequest, DockerCapability } from '@wakehub/shared';

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

  // Strip encrypted fields from capabilities.proxmox_api
  const caps = safe.capabilities as NodeCapabilities | null;
  if (caps?.proxmox_api) {
    const { tokenSecretEncrypted, passwordEncrypted, ...safeCap } = caps.proxmox_api;
    safe.capabilities = { ...caps, proxmox_api: safeCap } as unknown;
  }

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
          500: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const { name, type, ipAddress, macAddress, sshUser, sshPassword, parentId, serviceUrl } = request.body;

      try {
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
      } catch (error) {
        fastify.log.error({ error: (error as Error).message }, `Failed to create node: ${name}`);
        return reply.status(500).send({
          error: {
            code: 'NODE_CREATION_FAILED',
            message: (error as Error).message,
          },
        });
      }
    },
  );

  // GET /api/nodes — List nodes (optionally filter by parentId)
  fastify.get<{ Querystring: { parentId?: string } }>(
    '/api/nodes',
    {
      schema: {
        querystring: {
          type: 'object',
          properties: {
            parentId: { type: 'string' },
          },
        },
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
    async (request) => {
      let allNodes;
      if (request.query.parentId) {
        // Return ALL children of the given parent (including discovered+unconfigured)
        allNodes = await fastify.db
          .select()
          .from(nodes)
          .where(eq(nodes.parentId, request.query.parentId));
      } else {
        // Default: return only configured nodes
        allNodes = await fastify.db
          .select()
          .from(nodes)
          .where(eq(nodes.configured, true));
      }

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
        // For VMs/LXCs/containers, load the parent node to get the platform connector
        let parentNode: Node | undefined;
        if (node.parentId && (node.type === 'vm' || node.type === 'lxc' || node.type === 'container')) {
          const [parent] = await fastify.db.select().from(nodes).where(eq(nodes.id, node.parentId));
          if (parent) {
            parentNode = {
              ...parent,
              capabilities: parent.capabilities as Node['capabilities'],
              platformRef: parent.platformRef as Node['platformRef'],
              createdAt: parent.createdAt,
              updatedAt: parent.updatedAt,
            };
          }
        }

        const connector = getConnector(node.type as 'physical' | 'vm' | 'lxc' | 'container', {
          parentNode,
          decryptFn: decrypt,
        });

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
  // GET /api/nodes/:id — Get a single node
  fastify.get<{ Params: { id: string } }>(
    '/api/nodes/:id',
    {
      schema: {
        params: {
          type: 'object',
          required: ['id'],
          properties: { id: { type: 'string' } },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              data: { type: 'object', properties: { node: nodeSchema } },
            },
          },
          404: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params;
      const [node] = await fastify.db.select().from(nodes).where(eq(nodes.id, id));

      if (!node) {
        return reply.status(404).send({
          error: { code: 'NODE_NOT_FOUND', message: `Node ${id} not found` },
        });
      }

      return { data: { node: sanitizeNode(node as unknown as Record<string, unknown>) } };
    },
  );

  // PUT /api/nodes/:id/capabilities/proxmox — Configure Proxmox capability + run discovery
  fastify.put<{ Params: { id: string }; Body: ConfigureProxmoxRequest }>(
    '/api/nodes/:id/capabilities/proxmox',
    {
      schema: {
        params: {
          type: 'object',
          required: ['id'],
          properties: { id: { type: 'string' } },
        },
        body: {
          type: 'object',
          required: ['host', 'authType'],
          properties: {
            host: { type: 'string', minLength: 1 },
            port: { type: 'number' },
            verifySsl: { type: 'boolean' },
            authType: { type: 'string', enum: ['token', 'password'] },
            tokenId: { type: 'string' },
            tokenSecret: { type: 'string' },
            username: { type: 'string' },
            password: { type: 'string' },
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
                  discovered: { type: 'array', items: { type: 'object', additionalProperties: true } },
                },
                additionalProperties: true,
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
      const { id } = request.params;
      const body = request.body;

      // Verify node exists and is physical
      const [node] = await fastify.db.select().from(nodes).where(eq(nodes.id, id));
      if (!node) {
        return reply.status(404).send({
          error: { code: 'NODE_NOT_FOUND', message: `Node ${id} not found` },
        });
      }
      if (node.type !== 'physical') {
        return reply.status(400).send({
          error: { code: 'INVALID_NODE_TYPE', message: 'Proxmox capabilities can only be configured on physical nodes' },
        });
      }

      // Test connection first
      const clientConfig = {
        host: body.host,
        port: body.port,
        verifySsl: body.verifySsl,
        authType: body.authType,
        tokenId: body.tokenId,
        tokenSecret: body.tokenSecret,
        username: body.username,
        password: body.password,
      };

      let client: ProxmoxClient;
      try {
        client = new ProxmoxClient(clientConfig);
        await client.get('/nodes');
      } catch (error) {
        return reply.status(400).send({
          error: {
            code: 'PROXMOX_CONNECTION_FAILED',
            message: `Failed to connect to Proxmox: ${(error as Error).message}`,
          },
        });
      }

      // Build encrypted capabilities
      let proxmoxCapability: ProxmoxCapability;
      let updatedNode: typeof node;
      try {
        proxmoxCapability = {
          host: body.host,
          port: body.port ?? 8006,
          verifySsl: body.verifySsl ?? false,
          authType: body.authType,
          ...(body.authType === 'token'
            ? {
                tokenId: body.tokenId,
                tokenSecretEncrypted: body.tokenSecret ? encrypt(body.tokenSecret) : undefined,
              }
            : {
                username: body.username,
                passwordEncrypted: body.password ? encrypt(body.password) : undefined,
              }),
        };

        const capabilities: NodeCapabilities = { ...(node.capabilities ?? {}), proxmox_api: proxmoxCapability };

        // Save capabilities
        const [result] = await fastify.db
          .update(nodes)
          .set({ capabilities, updatedAt: new Date() })
          .where(eq(nodes.id, id))
          .returning();
        updatedNode = result!;
      } catch (error) {
        client!.destroy();
        fastify.log.error({ error: (error as Error).message }, `Failed to save Proxmox capabilities for node: ${id}`);
        return reply.status(500).send({
          error: {
            code: 'PROXMOX_SAVE_FAILED',
            message: (error as Error).message,
          },
        });
      }

      // Run discovery
      const connector = new ProxmoxConnector(
        { ...updatedNode, capabilities: updatedNode.capabilities } as Node,
        decrypt,
      );

      let discovered: Array<Record<string, unknown>> = [];
      try {
        const resources = await connector.listResources();

        // Insert discovered nodes
        for (const resource of resources) {
          const nodeType = resource.type === 'qemu' ? 'vm' : 'lxc';
          const status = resource.status === 'running' ? 'online' : 'offline';
          const platformRef = {
            platform: 'proxmox',
            platformId: `${resource.node}/${resource.vmid}`,
            node: resource.node,
            vmid: resource.vmid,
            type: resource.type,
          };

          const [inserted] = await fastify.db
            .insert(nodes)
            .values({
              name: resource.name,
              type: nodeType,
              status,
              parentId: id,
              platformRef,
              discovered: true,
              configured: false,
              confirmBeforeShutdown: false,
            })
            .returning();

          discovered.push(sanitizeNode(inserted as unknown as Record<string, unknown>) as Record<string, unknown>);
        }
      } catch (error) {
        // Discovery failed but capabilities were saved — log and continue
        fastify.log.warn({ error: (error as Error).message }, 'Proxmox discovery failed');
      } finally {
        client!.destroy();
      }

      // Log the operation
      await fastify.db.insert(operationLogs).values({
        level: 'info',
        source: 'nodes',
        message: `Proxmox configured on ${node.name}: ${discovered.length} resources discovered`,
        details: { nodeId: id, discoveredCount: discovered.length },
      });

      fastify.log.info({ nodeId: id, discoveredCount: discovered.length }, `Proxmox configured on ${node.name}`);

      return {
        data: {
          node: sanitizeNode(updatedNode as unknown as Record<string, unknown>),
          discovered,
        },
      };
    },
  );

  // PUT /api/nodes/:id/capabilities/docker — Configure Docker capability + run discovery
  fastify.put<{ Params: { id: string }; Body: ConfigureDockerRequest }>(
    '/api/nodes/:id/capabilities/docker',
    {
      schema: {
        params: {
          type: 'object',
          required: ['id'],
          properties: { id: { type: 'string' } },
        },
        body: {
          type: 'object',
          required: ['host', 'port'],
          properties: {
            host: { type: 'string', minLength: 1 },
            port: { type: 'integer', minimum: 1, maximum: 65535 },
            tlsEnabled: { type: 'boolean' },
          },
          additionalProperties: false,
        },
        response: {
          200: {
            type: 'object',
            properties: {
              data: {
                type: 'object',
                properties: {
                  node: nodeSchema,
                  discovered: { type: 'array', items: { type: 'object', additionalProperties: true } },
                },
                additionalProperties: true,
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
      const { id } = request.params;
      const body = request.body;

      // Verify node exists and is not a container
      const [node] = await fastify.db.select().from(nodes).where(eq(nodes.id, id));
      if (!node) {
        return reply.status(404).send({
          error: { code: 'NODE_NOT_FOUND', message: `Node ${id} not found` },
        });
      }
      if (node.type === 'container') {
        return reply.status(400).send({
          error: { code: 'INVALID_NODE_TYPE', message: 'Docker capabilities cannot be configured on container nodes' },
        });
      }

      // Test connection first
      let client: DockerClient;
      try {
        client = new DockerClient({ host: body.host, port: body.port, tlsEnabled: body.tlsEnabled });
        await client.ping();
      } catch (error) {
        return reply.status(400).send({
          error: {
            code: 'DOCKER_CONNECTION_FAILED',
            message: `Failed to connect to Docker: ${(error as Error).message}`,
          },
        });
      }

      // Build capabilities
      let updatedNode: typeof node;
      try {
        const dockerCapability: DockerCapability = {
          host: body.host,
          port: body.port,
          tlsEnabled: body.tlsEnabled,
        };

        const capabilities: NodeCapabilities = { ...(node.capabilities ?? {}), docker_api: dockerCapability };

        const [result] = await fastify.db
          .update(nodes)
          .set({ capabilities, updatedAt: new Date() })
          .where(eq(nodes.id, id))
          .returning();
        updatedNode = result!;
      } catch (error) {
        fastify.log.error({ error: (error as Error).message }, `Failed to save Docker capabilities for node: ${id}`);
        return reply.status(500).send({
          error: {
            code: 'DOCKER_SAVE_FAILED',
            message: (error as Error).message,
          },
        });
      }

      // Run discovery
      const connector = new DockerConnector(
        { ...updatedNode, capabilities: updatedNode.capabilities } as Node,
      );

      let discovered: Array<Record<string, unknown>> = [];
      try {
        const resources = await connector.listResources();

        for (const resource of resources) {
          const status = resource.state === 'running' ? 'online' : 'offline';
          const platformRef = {
            platform: 'docker',
            platformId: resource.containerId,
          };

          const [inserted] = await fastify.db
            .insert(nodes)
            .values({
              name: resource.name,
              type: 'container' as const,
              status,
              parentId: id,
              platformRef,
              discovered: true,
              configured: false,
              confirmBeforeShutdown: false,
            })
            .returning();

          discovered.push(sanitizeNode(inserted as unknown as Record<string, unknown>) as Record<string, unknown>);
        }
      } catch (error) {
        fastify.log.warn({ error: (error as Error).message }, 'Docker discovery failed');
      }

      // Log the operation
      await fastify.db.insert(operationLogs).values({
        level: 'info',
        source: 'nodes',
        message: `Docker configured on ${node.name}: ${discovered.length} containers discovered`,
        details: { nodeId: id, discoveredCount: discovered.length },
      });

      fastify.log.info({ nodeId: id, discoveredCount: discovered.length }, `Docker configured on ${node.name}`);

      return {
        data: {
          node: sanitizeNode(updatedNode as unknown as Record<string, unknown>),
          discovered,
        },
      };
    },
  );

  // DELETE /api/nodes/:id — Delete a node (cascade deletes children via FK)
  fastify.delete<{ Params: { id: string } }>(
    '/api/nodes/:id',
    {
      schema: {
        params: {
          type: 'object',
          required: ['id'],
          properties: { id: { type: 'string' } },
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
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params;

      const [node] = await fastify.db.select().from(nodes).where(eq(nodes.id, id));
      if (!node) {
        return reply.status(404).send({
          error: { code: 'NODE_NOT_FOUND', message: `Node ${id} not found` },
        });
      }

      await fastify.db.delete(nodes).where(eq(nodes.id, id));

      // Log the operation
      await fastify.db.insert(operationLogs).values({
        level: 'info',
        source: 'nodes',
        message: `Node deleted: ${node.name} (${node.type})`,
        details: { nodeId: id, type: node.type },
      });

      fastify.log.info({ nodeId: id }, `Node deleted: ${node.name}`);

      return { data: { success: true } };
    },
  );

  // PATCH /api/nodes/:id — Partial update of a node
  fastify.patch<{ Params: { id: string }; Body: { name?: string; serviceUrl?: string; configured?: boolean; ipAddress?: string; macAddress?: string; sshUser?: string; sshPassword?: string } }>(
    '/api/nodes/:id',
    {
      schema: {
        params: {
          type: 'object',
          required: ['id'],
          properties: { id: { type: 'string' } },
        },
        body: {
          type: 'object',
          properties: {
            name: { type: 'string', minLength: 1, maxLength: 100 },
            serviceUrl: { type: 'string' },
            configured: { type: 'boolean' },
            ipAddress: { type: 'string' },
            macAddress: { type: 'string' },
            sshUser: { type: 'string' },
            sshPassword: { type: 'string' },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              data: { type: 'object', properties: { node: nodeSchema } },
            },
          },
          400: errorResponseSchema,
          404: errorResponseSchema,
          500: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params;
      const body = request.body;

      const [existing] = await fastify.db.select().from(nodes).where(eq(nodes.id, id));
      if (!existing) {
        return reply.status(404).send({
          error: { code: 'NODE_NOT_FOUND', message: `Node ${id} not found` },
        });
      }

      try {
        const updates: Record<string, unknown> = { updatedAt: new Date() };
        if (body.name !== undefined) updates.name = body.name;
        if (body.serviceUrl !== undefined) updates.serviceUrl = body.serviceUrl;
        if (body.configured !== undefined) updates.configured = body.configured;
        if (body.ipAddress !== undefined) updates.ipAddress = body.ipAddress;
        if (body.macAddress !== undefined) updates.macAddress = body.macAddress;
        if (body.sshUser !== undefined) updates.sshUser = body.sshUser;
        if (body.sshPassword !== undefined) {
          updates.sshCredentialsEncrypted = body.sshPassword === '' ? null : encrypt(body.sshPassword);
        }

        const [updated] = await fastify.db
          .update(nodes)
          .set(updates)
          .where(eq(nodes.id, id))
          .returning();

        return { data: { node: sanitizeNode(updated as unknown as Record<string, unknown>) } };
      } catch (error) {
        fastify.log.error({ error: (error as Error).message }, `Failed to update node: ${id}`);
        return reply.status(500).send({
          error: {
            code: 'NODE_UPDATE_FAILED',
            message: (error as Error).message,
          },
        });
      }
    },
  );
};

export default nodesRoutes;
