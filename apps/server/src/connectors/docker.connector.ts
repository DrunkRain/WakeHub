import type { Node, NodeStatus, DockerDiscoveredResource } from '@wakehub/shared';
import type { PlatformConnector } from './connector.interface.js';
import { DockerClient } from './docker-client.js';
import { PlatformError } from '../utils/platform-error.js';

const PLATFORM = 'docker';

interface DockerContainerListItem {
  Id: string;
  Names: string[];
  Image: string;
  State: string;
  Status: string;
  Ports: Array<{ IP: string; PrivatePort: number; PublicPort: number; Type: string }>;
}

interface DockerContainerInspect {
  State: {
    Running: boolean;
  };
}

export class DockerConnector implements PlatformConnector {
  private readonly parentNode: Node;

  constructor(parentNode: Node) {
    const dockerCap = parentNode.capabilities?.docker_api;
    if (!dockerCap) {
      throw new PlatformError('DOCKER_CONNECTION_FAILED', 'No Docker capability configured on parent node', PLATFORM);
    }
    this.parentNode = parentNode;
  }

  async testConnection(_node: Node): Promise<boolean> {
    const client = this.createClient();
    try {
      return await client.ping();
    } catch (error) {
      throw this.wrapError(error, 'testConnection');
    }
  }

  async start(node: Node): Promise<void> {
    const containerId = this.extractContainerId(node);
    const client = this.createClient();
    try {
      await client.post(`/containers/${containerId}/start`);
    } catch (error) {
      throw new PlatformError(
        'DOCKER_START_FAILED',
        `Impossible de demarrer le conteneur ${node.name}`,
        PLATFORM,
        { containerId, cause: (error as Error).message },
      );
    }
  }

  async stop(node: Node): Promise<void> {
    const containerId = this.extractContainerId(node);
    const client = this.createClient();
    try {
      await client.post(`/containers/${containerId}/stop`);
    } catch (error) {
      throw new PlatformError(
        'DOCKER_STOP_FAILED',
        `Impossible d'arreter le conteneur ${node.name}`,
        PLATFORM,
        { containerId, cause: (error as Error).message },
      );
    }
  }

  async getStatus(node: Node): Promise<NodeStatus> {
    const containerId = this.extractContainerId(node);
    const client = this.createClient();
    try {
      const data = await client.get<DockerContainerInspect>(`/containers/${containerId}/json`);
      return data.State.Running ? 'online' : 'offline';
    } catch {
      return 'error';
    }
  }

  async listResources(): Promise<DockerDiscoveredResource[]> {
    const client = this.createClient();
    try {
      const containers = await client.get<DockerContainerListItem[]>('/containers/json?all=true');
      return containers.map((c) => ({
        containerId: c.Id,
        name: c.Names[0]!.replace(/^\//, ''),
        image: c.Image,
        state: c.State,
        status: c.Status,
        ports: c.Ports,
      }));
    } catch (error) {
      throw new PlatformError(
        'DOCKER_DISCOVERY_FAILED',
        'Impossible de lister les conteneurs Docker',
        PLATFORM,
        { cause: (error as Error).message },
      );
    }
  }

  private createClient(): DockerClient {
    const dockerCap = this.parentNode.capabilities!.docker_api!;
    return new DockerClient({
      host: dockerCap.host,
      port: dockerCap.port,
      tlsEnabled: dockerCap.tlsEnabled,
    });
  }

  private extractContainerId(node: Node): string {
    const ref = node.platformRef;
    if (!ref?.platformId || ref.platform !== 'docker') {
      throw new PlatformError(
        'DOCKER_CONTAINER_NOT_FOUND',
        `Missing Docker platformRef on node ${node.id}`,
        PLATFORM,
        { nodeId: node.id },
      );
    }
    return ref.platformId;
  }

  private wrapError(error: unknown, operation: string): PlatformError {
    const message = (error as Error).message ?? String(error);

    if (message.includes('ECONNREFUSED') || message.includes('ETIMEDOUT') || message.includes('ENOTFOUND')) {
      const host = this.parentNode.capabilities?.docker_api?.host ?? 'unknown';
      const port = this.parentNode.capabilities?.docker_api?.port ?? 2375;
      return new PlatformError('DOCKER_UNREACHABLE', `API Docker injoignable a ${host}:${port}`, PLATFORM, { host, port });
    }
    return new PlatformError('DOCKER_API_ERROR', `Erreur API Docker (${operation}): ${message}`, PLATFORM);
  }
}
