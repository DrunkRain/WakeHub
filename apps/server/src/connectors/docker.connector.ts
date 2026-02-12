import type { PlatformConnector, DiscoveredResource } from './connector.interface.js';
import { PlatformError } from '../utils/platform-error.js';

export interface DockerConfig {
  apiUrl: string; // e.g. http://192.168.1.10:2375
  resourceRef?: { containerId: string };
}

interface DockerContainer {
  Id: string;
  Names: string[];
  Image: string;
  State: string;
  Status: string;
}

interface DockerVersion {
  Version: string;
  ApiVersion: string;
}

function mapDockerStatus(
  state: string,
): 'running' | 'stopped' | 'paused' | 'unknown' | 'error' {
  switch (state) {
    case 'running':
      return 'running';
    case 'exited':
    case 'created':
    case 'removing':
      return 'stopped';
    case 'paused':
      return 'paused';
    case 'dead':
      return 'error';
    case 'restarting':
      return 'running';
    default:
      return 'unknown';
  }
}

export class DockerConnector implements PlatformConnector {
  constructor(private readonly config: DockerConfig) {}

  private async fetchDocker(
    path: string,
    options: { method?: string } = {},
  ): Promise<unknown> {
    const url = `${this.config.apiUrl}${path}`;

    let response: Response;
    try {
      response = await fetch(url, {
        method: options.method ?? 'GET',
      });
    } catch (err) {
      throw new PlatformError(
        'DOCKER_NETWORK_ERROR',
        `Impossible de contacter l'hôte Docker : ${(err as Error).message}`,
        'docker',
        { url },
      );
    }

    // Docker returns 204 for successful start/stop, 304 for already in state
    if (response.status === 204 || response.status === 304) {
      return null;
    }

    if (!response.ok) {
      const body = (await response.json().catch(() => ({ message: response.statusText }))) as {
        message?: string;
      };
      throw new PlatformError(
        `DOCKER_HTTP_${response.status}`,
        `Erreur Docker ${response.status} : ${body.message ?? response.statusText}`,
        'docker',
        { status: response.status, url, body },
      );
    }

    return response.json();
  }

  async testConnection(): Promise<{ success: boolean; message: string }> {
    try {
      // Step 1: Quick ping
      const pingUrl = `${this.config.apiUrl}/_ping`;
      let pingResp: Response;
      try {
        pingResp = await fetch(pingUrl);
      } catch (err) {
        return {
          success: false,
          message: `Impossible de contacter l'hôte Docker : ${(err as Error).message}`,
        };
      }

      if (!pingResp.ok) {
        return {
          success: false,
          message: `Docker API non disponible (${pingResp.status})`,
        };
      }

      // Step 2: Get version for info
      const version = (await this.fetchDocker('/version')) as DockerVersion;
      return {
        success: true,
        message: `Connexion Docker réussie (v${version.Version}, API v${version.ApiVersion})`,
      };
    } catch (err) {
      if (err instanceof PlatformError) {
        return { success: false, message: err.message };
      }
      return { success: false, message: `Erreur inattendue : ${(err as Error).message}` };
    }
  }

  async listResources(): Promise<DiscoveredResource[]> {
    const containers = (await this.fetchDocker(
      '/containers/json?all=true',
    )) as DockerContainer[];

    return containers.map((c) => ({
      name: c.Names[0]?.replace(/^\//, '') ?? c.Id.slice(0, 12),
      type: 'container' as const,
      platformRef: { containerId: c.Id, image: c.Image },
      status: mapDockerStatus(c.State),
    }));
  }

  async start(): Promise<void> {
    const ref = this.config.resourceRef;
    if (!ref) {
      throw new PlatformError('DOCKER_NO_REF', 'resourceRef requis pour start', 'docker');
    }
    await this.fetchDocker(`/containers/${ref.containerId}/start`, { method: 'POST' });
  }

  async stop(): Promise<void> {
    const ref = this.config.resourceRef;
    if (!ref) {
      throw new PlatformError('DOCKER_NO_REF', 'resourceRef requis pour stop', 'docker');
    }
    await this.fetchDocker(`/containers/${ref.containerId}/stop`, { method: 'POST' });
  }

  async getStatus(): Promise<'online' | 'offline' | 'unknown' | 'error'> {
    const ref = this.config.resourceRef;
    if (!ref) return 'unknown';

    try {
      const data = (await this.fetchDocker(`/containers/${ref.containerId}/json`)) as {
        State: { Status: string };
      };

      const s = mapDockerStatus(data.State.Status);
      if (s === 'running') return 'online';
      if (s === 'stopped' || s === 'paused') return 'offline';
      return 'unknown';
    } catch {
      return 'error';
    }
  }
}
