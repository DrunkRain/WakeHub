import type { Node, NodeStatus, NodeStats, DockerDiscoveredResource } from '@wakehub/shared';
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

interface DockerStatsResponse {
  cpu_stats: {
    cpu_usage: { total_usage: number };
    system_cpu_usage: number;
    online_cpus: number;
  };
  precpu_stats: {
    cpu_usage: { total_usage: number };
    system_cpu_usage: number;
  };
  memory_stats: {
    usage: number;
    limit: number;
    stats?: { inactive_file?: number };
  };
  networks?: Record<string, { rx_bytes: number; tx_bytes: number }>;
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

  async getStats(node: Node): Promise<NodeStats | null> {
    const containerId = this.extractContainerId(node);
    const client = this.createClient();
    try {
      const data = await client.get<DockerStatsResponse>(`/containers/${containerId}/stats?stream=false`);

      // Docker CPU usage formula: (delta container / delta system) * number of host CPUs
      const cpuDelta = data.cpu_stats.cpu_usage.total_usage - data.precpu_stats.cpu_usage.total_usage;
      const systemDelta = data.cpu_stats.system_cpu_usage - data.precpu_stats.system_cpu_usage;
      const onlineCpus = data.cpu_stats.online_cpus || 1;
      const cpuUsage = systemDelta > 0 ? (cpuDelta / systemDelta) * onlineCpus : 0;

      const cacheUsage = data.memory_stats.stats?.inactive_file ?? 0;
      const ramUsage = data.memory_stats.limit > 0 ? Math.max(0, data.memory_stats.usage - cacheUsage) / data.memory_stats.limit : 0;

      let rxBytes = 0;
      let txBytes = 0;
      if (data.networks) {
        for (const iface of Object.values(data.networks)) {
          rxBytes += iface.rx_bytes;
          txBytes += iface.tx_bytes;
        }
      }

      return { cpuUsage, ramUsage, rxBytes, txBytes };
    } catch {
      return null;
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
