import type { FastifyPluginAsync, FastifyError } from 'fastify';
import { eq, and, or } from 'drizzle-orm';
import { services, operationLogs, dependencyLinks } from '../db/schema.js';
import { encrypt, decrypt } from '../utils/crypto.js';
import { WolSshConnector } from '../connectors/wol-ssh.connector.js';
import { ProxmoxConnector } from '../connectors/proxmox.connector.js';
import { DockerConnector } from '../connectors/docker.connector.js';
import { PlatformError } from '../utils/platform-error.js';

interface CreateServiceBody {
  name: string;
  type: 'physical' | 'proxmox' | 'docker';
  ipAddress: string;
  macAddress?: string;
  sshUser?: string;
  sshPassword?: string;
  apiUrl?: string;
  apiCredentials?: string;
  serviceUrl?: string;
}

interface UpdateServiceBody {
  name?: string;
  ipAddress?: string;
  macAddress?: string;
  sshUser?: string;
  sshPassword?: string;
  apiUrl?: string;
  apiCredentials?: string;
  serviceUrl?: string;
  pinnedToDashboard?: boolean;
  inactivityTimeout?: number | null;
}

interface TestConnectionBody {
  type?: 'physical' | 'proxmox' | 'docker';
  host?: string;
  sshUser?: string;
  sshPassword?: string;
  apiUrl?: string;
  authMode?: 'password' | 'token';
  username?: string;
  password?: string;
  tokenId?: string;
  tokenSecret?: string;
}

interface DiscoverBody {
  apiUrl: string;
  authMode: 'password' | 'token';
  username?: string;
  password?: string;
  tokenId?: string;
  tokenSecret?: string;
}

interface DockerDiscoverBody {
  apiUrl: string;
}

interface SaveResourcesBody {
  resources: Array<{
    name: string;
    type: 'vm' | 'container';
    platformRef: Record<string, unknown>;
    status: 'running' | 'stopped' | 'paused' | 'unknown' | 'error';
  }>;
}

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

const serviceSchema = {
  type: 'object' as const,
  properties: {
    id: { type: 'string' as const },
    name: { type: 'string' as const },
    type: { type: 'string' as const },
    ipAddress: { type: 'string' as const, nullable: true },
    macAddress: { type: 'string' as const, nullable: true },
    sshUser: { type: 'string' as const, nullable: true },
    apiUrl: { type: 'string' as const, nullable: true },
    serviceUrl: { type: 'string' as const, nullable: true },
    status: { type: 'string' as const },
    platformRef: { type: 'object' as const, additionalProperties: true, nullable: true },
    inactivityTimeout: { type: 'number' as const, nullable: true },
    parentId: { type: 'string' as const, nullable: true },
    pinnedToDashboard: { type: 'boolean' as const },
    createdAt: { type: 'string' as const },
    updatedAt: { type: 'string' as const },
  },
};

const discoveredResourceSchema = {
  type: 'object' as const,
  properties: {
    name: { type: 'string' as const },
    type: { type: 'string' as const },
    platformRef: { type: 'object' as const, additionalProperties: true },
    status: { type: 'string' as const },
  },
};

function formatService(s: typeof services.$inferSelect) {
  return {
    id: s.id,
    name: s.name,
    type: s.type,
    ipAddress: s.ipAddress,
    macAddress: s.macAddress,
    sshUser: s.sshUser,
    apiUrl: s.apiUrl,
    serviceUrl: s.serviceUrl,
    status: s.status,
    platformRef: s.platformRef,
    inactivityTimeout: s.inactivityTimeout,
    parentId: s.parentId,
    pinnedToDashboard: s.pinnedToDashboard,
    createdAt: s.createdAt.toISOString(),
    updatedAt: s.updatedAt.toISOString(),
  };
}

const servicesRoutes: FastifyPluginAsync = async (fastify) => {
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

  // POST /api/services — Create a service (physical, proxmox, docker)
  fastify.post<{ Body: CreateServiceBody }>(
    '/api/services',
    {
      schema: {
        body: {
          type: 'object',
          required: ['name', 'type', 'ipAddress'],
          properties: {
            name: { type: 'string', minLength: 1, maxLength: 100 },
            type: { type: 'string', enum: ['physical', 'proxmox', 'docker'] },
            ipAddress: { type: 'string', minLength: 1 },
            macAddress: { type: 'string' },
            sshUser: { type: 'string' },
            sshPassword: { type: 'string' },
            apiUrl: { type: 'string' },
            apiCredentials: { type: 'string' },
            serviceUrl: { type: 'string' },
          },
        },
        response: {
          200: { type: 'object', properties: { data: serviceSchema } },
          400: errorSchema,
          401: errorSchema,
        },
      },
    },
    async (request) => {
      const { name, type, ipAddress, macAddress, sshUser, sshPassword, apiUrl, apiCredentials, serviceUrl } = request.body;

      const now = new Date();
      const id = crypto.randomUUID();
      const sshCredentialsEncrypted = sshPassword ? encrypt(sshPassword) : null;
      const apiCredentialsEncrypted = apiCredentials ? encrypt(apiCredentials) : null;

      await fastify.db.insert(services).values({
        id, name, type, ipAddress,
        macAddress: macAddress ?? null,
        sshUser: sshUser ?? null,
        sshCredentialsEncrypted,
        apiUrl: apiUrl ?? null,
        apiCredentialsEncrypted,
        serviceUrl: serviceUrl ?? null,
        status: 'unknown',
        createdAt: now, updatedAt: now,
      });

      await fastify.db.insert(operationLogs).values({
        timestamp: now, level: 'info', source: 'services',
        message: `Service created: ${name}`,
        reason: 'service-creation',
        details: { serviceId: id, name, type, ipAddress },
      });

      fastify.log.info({ serviceId: id, name, type }, 'Service created');

      const [created] = await fastify.db.select().from(services).where(eq(services.id, id)).limit(1);
      return { data: formatService(created!) };
    },
  );

  // POST /api/services/test-connection — Test connection
  fastify.post<{ Body: TestConnectionBody }>(
    '/api/services/test-connection',
    {
      schema: {
        body: {
          type: 'object',
          properties: {
            type: { type: 'string', enum: ['physical', 'proxmox', 'docker'] },
            host: { type: 'string', minLength: 1 },
            sshUser: { type: 'string', minLength: 1 },
            sshPassword: { type: 'string', minLength: 1 },
            apiUrl: { type: 'string', minLength: 1 },
            authMode: { type: 'string', enum: ['password', 'token'] },
            username: { type: 'string' },
            password: { type: 'string' },
            tokenId: { type: 'string' },
            tokenSecret: { type: 'string' },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: { data: { type: 'object', properties: { success: { type: 'boolean' }, message: { type: 'string' } } } },
          },
          400: errorSchema,
          401: errorSchema,
        },
      },
    },
    async (request, reply) => {
      const body = request.body;
      const serviceType = body.type ?? 'physical';

      let connector;

      if (serviceType === 'proxmox') {
        if (!body.apiUrl) {
          return reply.status(400).send({ error: { code: 'VALIDATION_ERROR', message: 'apiUrl est requis pour Proxmox' } });
        }
        connector = new ProxmoxConnector(
          body.authMode === 'token'
            ? { apiUrl: body.apiUrl, tokenId: body.tokenId, tokenSecret: body.tokenSecret }
            : { apiUrl: body.apiUrl, username: body.username, password: body.password },
        );
      } else if (serviceType === 'docker') {
        if (!body.apiUrl) {
          return reply.status(400).send({ error: { code: 'VALIDATION_ERROR', message: 'apiUrl est requis pour Docker' } });
        }
        connector = new DockerConnector({ apiUrl: body.apiUrl });
      } else {
        if (!body.host || !body.sshUser || !body.sshPassword) {
          return reply.status(400).send({ error: { code: 'VALIDATION_ERROR', message: 'host, sshUser et sshPassword sont requis' } });
        }
        connector = new WolSshConnector({ host: body.host, macAddress: '', sshUser: body.sshUser, sshPassword: body.sshPassword });
      }

      try {
        const result = await connector.testConnection();
        const target = serviceType === 'proxmox' || serviceType === 'docker' ? body.apiUrl : body.host;

        await fastify.db.insert(operationLogs).values({
          timestamp: new Date(), level: 'info', source: 'services',
          message: `Connection test to ${target}: ${result.success ? 'success' : 'failure'}`,
          reason: 'connection-test',
          details: { target, type: serviceType, success: result.success },
        });

        fastify.log.info({ target, type: serviceType, success: result.success }, 'Connection test completed');
        return { data: result };
      } catch (err) {
        const message = err instanceof PlatformError ? err.message : 'Erreur inattendue lors du test';
        return { data: { success: false, message } };
      }
    },
  );

  // GET /api/services — List all services
  fastify.get(
    '/api/services',
    {
      schema: {
        response: {
          200: { type: 'object', properties: { data: { type: 'array', items: serviceSchema } } },
          401: errorSchema,
        },
      },
    },
    async () => {
      const all = await fastify.db.select().from(services);
      return { data: all.map(formatService) };
    },
  );

  // GET /api/services/:id — Get a single service
  fastify.get<{ Params: { id: string } }>(
    '/api/services/:id',
    {
      schema: {
        params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } },
        response: {
          200: { type: 'object', properties: { data: serviceSchema } },
          401: errorSchema,
          404: errorSchema,
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params;
      const [service] = await fastify.db.select().from(services).where(eq(services.id, id)).limit(1);

      if (!service) {
        return reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'Service non trouvé' } });
      }

      return { data: formatService(service) };
    },
  );

  // PUT /api/services/:id — Update a service
  fastify.put<{ Params: { id: string }; Body: UpdateServiceBody }>(
    '/api/services/:id',
    {
      schema: {
        params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } },
        body: {
          type: 'object',
          properties: {
            name: { type: 'string', minLength: 1, maxLength: 100 },
            ipAddress: { type: 'string', minLength: 1 },
            macAddress: { type: 'string' },
            sshUser: { type: 'string' },
            sshPassword: { type: 'string' },
            apiUrl: { type: 'string' },
            apiCredentials: { type: 'string' },
            serviceUrl: { type: 'string' },
            pinnedToDashboard: { type: 'boolean' },
            inactivityTimeout: { type: 'number', nullable: true },
          },
        },
        response: {
          200: { type: 'object', properties: { data: serviceSchema } },
          400: errorSchema,
          401: errorSchema,
          404: errorSchema,
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params;
      const [existing] = await fastify.db.select().from(services).where(eq(services.id, id)).limit(1);

      if (!existing) {
        return reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'Service non trouvé' } });
      }

      const { sshPassword, apiCredentials, ...rest } = request.body;
      const updateFields: Record<string, unknown> = { ...rest, updatedAt: new Date() };
      if (sshPassword !== undefined) updateFields.sshCredentialsEncrypted = encrypt(sshPassword);
      if (apiCredentials !== undefined) updateFields.apiCredentialsEncrypted = encrypt(apiCredentials);

      await fastify.db.update(services).set(updateFields).where(eq(services.id, id));

      const [updated] = await fastify.db.select().from(services).where(eq(services.id, id)).limit(1);

      if (!updated) {
        return reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'Service non trouvé après mise à jour' } });
      }

      await fastify.db.insert(operationLogs).values({
        timestamp: new Date(), level: 'info', source: 'services',
        message: `Service updated: ${updated.name}`,
        reason: 'service-update',
        details: { serviceId: id, fields: Object.keys(request.body) },
      });

      fastify.log.info({ serviceId: id }, 'Service updated');
      return { data: formatService(updated) };
    },
  );

  // DELETE /api/services/:id — Delete a service (+ children + dependency links)
  fastify.delete<{ Params: { id: string } }>(
    '/api/services/:id',
    {
      schema: {
        params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } },
        response: {
          200: { type: 'object', properties: { data: { type: 'object', properties: { success: { type: 'boolean' } } } } },
          401: errorSchema,
          404: errorSchema,
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params;
      const [existing] = await fastify.db.select().from(services).where(eq(services.id, id)).limit(1);

      if (!existing) {
        return reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'Service non trouvé' } });
      }

      // Find children (services with parentId = id)
      const children = fastify.db.select({ id: services.id }).from(services).where(eq(services.parentId, id)).all();
      const allIds = [id, ...children.map(c => c.id)];

      // Delete dependency links involving this service or its children
      for (const nodeId of allIds) {
        fastify.db.delete(dependencyLinks)
          .where(or(
            and(eq(dependencyLinks.parentType, 'service'), eq(dependencyLinks.parentId, nodeId)),
            and(eq(dependencyLinks.childType, 'service'), eq(dependencyLinks.childId, nodeId)),
          ))
          .run();
      }

      // Delete children first, then the service
      if (children.length > 0) {
        for (const child of children) {
          fastify.db.delete(services).where(eq(services.id, child.id)).run();
        }
      }

      fastify.db.delete(services).where(eq(services.id, id)).run();

      if (children.length > 0) {
        fastify.db.insert(operationLogs).values({
          timestamp: new Date(), level: 'info', source: 'services',
          message: `${children.length} child service(s) cascade-deleted with service ${existing.name}`,
          reason: 'service-cascade-delete',
          details: { serviceId: id, deletedCount: children.length },
        }).run();
      }

      fastify.db.insert(operationLogs).values({
        timestamp: new Date(), level: 'info', source: 'services',
        message: `Service deleted: ${existing.name}`,
        reason: 'service-deletion',
        details: { serviceId: id, name: existing.name },
      }).run();

      fastify.log.info({ serviceId: id }, 'Service deleted');
      return { data: { success: true } };
    },
  );

  // POST /api/proxmox/discover — Stateless Proxmox discover (wizard)
  fastify.post<{ Body: DiscoverBody }>(
    '/api/proxmox/discover',
    {
      schema: {
        body: {
          type: 'object',
          required: ['apiUrl', 'authMode'],
          properties: {
            apiUrl: { type: 'string', minLength: 1 },
            authMode: { type: 'string', enum: ['password', 'token'] },
            username: { type: 'string' },
            password: { type: 'string' },
            tokenId: { type: 'string' },
            tokenSecret: { type: 'string' },
          },
        },
        response: {
          200: { type: 'object', properties: { data: { type: 'array', items: discoveredResourceSchema } } },
          400: errorSchema,
          401: errorSchema,
        },
      },
    },
    async (request, reply) => {
      const { apiUrl, authMode, username, password, tokenId, tokenSecret } = request.body;
      const connector = new ProxmoxConnector(
        authMode === 'token' ? { apiUrl, tokenId, tokenSecret } : { apiUrl, username, password },
      );

      try {
        const discovered = await connector.listResources();
        await fastify.db.insert(operationLogs).values({
          timestamp: new Date(), level: 'info', source: 'services',
          message: `Proxmox discover (stateless): ${discovered.length} resources found`,
          reason: 'proxmox-discover',
          details: { apiUrl, count: discovered.length },
        });
        return { data: discovered };
      } catch (err) {
        const message = err instanceof PlatformError ? err.message : 'Erreur lors de la découverte des VMs';
        return reply.status(400).send({ error: { code: 'DISCOVER_FAILED', message } });
      }
    },
  );

  // POST /api/docker/discover — Stateless Docker discover (wizard)
  fastify.post<{ Body: DockerDiscoverBody }>(
    '/api/docker/discover',
    {
      schema: {
        body: {
          type: 'object',
          required: ['apiUrl'],
          properties: { apiUrl: { type: 'string', minLength: 1 } },
        },
        response: {
          200: { type: 'object', properties: { data: { type: 'array', items: discoveredResourceSchema } } },
          400: errorSchema,
          401: errorSchema,
        },
      },
    },
    async (request, reply) => {
      const { apiUrl } = request.body;
      const connector = new DockerConnector({ apiUrl });

      try {
        const discovered = await connector.listResources();
        await fastify.db.insert(operationLogs).values({
          timestamp: new Date(), level: 'info', source: 'services',
          message: `Docker discover (stateless): ${discovered.length} containers found`,
          reason: 'docker-discover',
          details: { apiUrl, count: discovered.length },
        });
        return { data: discovered };
      } catch (err) {
        const message = err instanceof PlatformError ? err.message : 'Erreur lors de la découverte des conteneurs';
        return reply.status(400).send({ error: { code: 'DISCOVER_FAILED', message } });
      }
    },
  );

  // POST /api/services/:id/discover — Discover VMs/containers from a saved service
  fastify.post<{ Params: { id: string } }>(
    '/api/services/:id/discover',
    {
      schema: {
        params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } },
        response: {
          200: { type: 'object', properties: { data: { type: 'array', items: discoveredResourceSchema } } },
          400: errorSchema,
          401: errorSchema,
          404: errorSchema,
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params;
      const [service] = await fastify.db.select().from(services).where(eq(services.id, id)).limit(1);

      if (!service) {
        return reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'Service non trouvé' } });
      }

      if ((service.type !== 'proxmox' && service.type !== 'docker') || !service.apiUrl) {
        return reply.status(400).send({ error: { code: 'INVALID_TYPE', message: 'Ce service n\'est pas de type Proxmox ou Docker' } });
      }

      let connector;
      if (service.type === 'docker') {
        connector = new DockerConnector({ apiUrl: service.apiUrl });
      } else {
        let credentials: { username?: string; password?: string; tokenId?: string; tokenSecret?: string } = {};
        if (service.apiCredentialsEncrypted) {
          try {
            credentials = JSON.parse(decrypt(service.apiCredentialsEncrypted));
          } catch {
            return reply.status(400).send({ error: { code: 'DECRYPT_FAILED', message: 'Impossible de déchiffrer les identifiants API' } });
          }
        }
        connector = new ProxmoxConnector({ apiUrl: service.apiUrl, ...credentials });
      }

      try {
        const discovered = await connector.listResources();
        const label = service.type === 'docker' ? 'containers' : 'VMs';
        await fastify.db.insert(operationLogs).values({
          timestamp: new Date(), level: 'info', source: 'services',
          message: `${service.type} discover for service ${service.name}: ${discovered.length} ${label}`,
          reason: `${service.type}-discover`,
          details: { serviceId: id, count: discovered.length },
        });
        return { data: discovered };
      } catch (err) {
        const message = err instanceof PlatformError ? err.message : 'Erreur lors de la découverte';
        return reply.status(400).send({ error: { code: 'DISCOVER_FAILED', message } });
      }
    },
  );

  // POST /api/services/:id/resources — Save discovered resources as child services
  fastify.post<{ Params: { id: string }; Body: SaveResourcesBody }>(
    '/api/services/:id/resources',
    {
      schema: {
        params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } },
        body: {
          type: 'object',
          required: ['resources'],
          properties: {
            resources: {
              type: 'array',
              items: {
                type: 'object',
                required: ['name', 'type', 'platformRef', 'status'],
                properties: {
                  name: { type: 'string' },
                  type: { type: 'string', enum: ['vm', 'container'] },
                  platformRef: { type: 'object', additionalProperties: true },
                  status: { type: 'string', enum: ['running', 'stopped', 'paused', 'unknown', 'error'] },
                },
              },
            },
          },
        },
        response: {
          200: { type: 'object', properties: { data: { type: 'array', items: serviceSchema } } },
          400: errorSchema,
          401: errorSchema,
          404: errorSchema,
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params;
      const [parent] = await fastify.db.select().from(services).where(eq(services.id, id)).limit(1);

      if (!parent) {
        return reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'Service non trouvé' } });
      }

      const now = new Date();
      const saved = [];

      for (const r of request.body.resources) {
        const childId = crypto.randomUUID();
        await fastify.db.insert(services).values({
          id: childId,
          name: r.name,
          type: r.type,
          platformRef: r.platformRef,
          status: r.status,
          parentId: id,
          createdAt: now,
          updatedAt: now,
        });

        // Auto-create structural dependency link
        await fastify.db.insert(dependencyLinks).values({
          id: crypto.randomUUID(),
          parentType: 'service',
          parentId: id,
          childType: 'service',
          childId,
          isShared: false,
          isStructural: true,
          createdAt: now,
        });

        saved.push({
          id: childId,
          name: r.name,
          type: r.type,
          ipAddress: null,
          macAddress: null,
          sshUser: null,
          apiUrl: null,
          serviceUrl: null,
          status: r.status,
          platformRef: r.platformRef,
          inactivityTimeout: null,
          parentId: id,
          pinnedToDashboard: false,
          createdAt: now.toISOString(),
          updatedAt: now.toISOString(),
        });
      }

      await fastify.db.insert(operationLogs).values({
        timestamp: now, level: 'info', source: 'services',
        message: `${saved.length} child services saved for ${parent.name} (with structural links)`,
        reason: 'resources-save',
        details: { serviceId: id, count: saved.length },
      });

      fastify.log.info({ serviceId: id, count: saved.length }, 'Child services saved');
      return { data: saved };
    },
  );
};

export default servicesRoutes;
