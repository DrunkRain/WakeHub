import type { Node, NodeStatus, NodeStats, DiscoveredResource } from '@wakehub/shared';
import type { PlatformConnector } from './connector.interface.js';
import { ProxmoxClient } from './proxmox-client.js';
import { PlatformError } from '../utils/platform-error.js';

const PLATFORM = 'proxmox';

interface ProxmoxResource {
  id: string;
  type: 'qemu' | 'lxc';
  vmid: number;
  name: string;
  node: string;
  status: string;
  template: number;
}

export class ProxmoxConnector implements PlatformConnector {
  private readonly parentNode: Node;
  private readonly decryptFn: (ciphertext: string) => string;

  constructor(parentNode: Node, decryptFn: (ciphertext: string) => string) {
    this.parentNode = parentNode;
    this.decryptFn = decryptFn;
  }

  async testConnection(_node: Node): Promise<boolean> {
    const client = this.createClient();
    try {
      await client.get('/nodes');
      return true;
    } catch (error) {
      throw this.wrapError(error, 'testConnection');
    } finally {
      client.destroy();
    }
  }

  async start(node: Node): Promise<void> {
    const { pveNode, vmid, vmType } = this.extractPlatformRef(node);
    const client = this.createClient();
    try {
      await client.post(`/nodes/${pveNode}/${vmType}/${vmid}/status/start`);
    } catch (error) {
      throw new PlatformError(
        'PROXMOX_START_FAILED',
        `Impossible de demarrer ${vmType} ${vmid}`,
        PLATFORM,
        { node: pveNode, vmid, type: vmType, cause: (error as Error).message },
      );
    } finally {
      client.destroy();
    }
  }

  async stop(node: Node): Promise<void> {
    const { pveNode, vmid, vmType } = this.extractPlatformRef(node);
    const client = this.createClient();
    try {
      await client.post(`/nodes/${pveNode}/${vmType}/${vmid}/status/shutdown`);
    } catch (error) {
      throw new PlatformError(
        'PROXMOX_SHUTDOWN_FAILED',
        `Impossible d'arreter ${vmType} ${vmid}`,
        PLATFORM,
        { node: pveNode, vmid, type: vmType, cause: (error as Error).message },
      );
    } finally {
      client.destroy();
    }
  }

  async getStatus(node: Node): Promise<NodeStatus> {
    const { pveNode, vmid, vmType } = this.extractPlatformRef(node);
    const client = this.createClient();
    try {
      const data = await client.get<{ status: string }>(`/nodes/${pveNode}/${vmType}/${vmid}/status/current`);
      return data.status === 'running' ? 'online' : 'offline';
    } catch {
      return 'error';
    } finally {
      client.destroy();
    }
  }

  async getStats(node: Node): Promise<NodeStats | null> {
    const { pveNode, vmid, vmType } = this.extractPlatformRef(node);
    const client = this.createClient();
    try {
      const data = await client.get<{ cpu: number; maxcpu: number; mem: number; maxmem: number }>(
        `/nodes/${pveNode}/${vmType}/${vmid}/status/current`,
      );
      return {
        cpuUsage: data.cpu,
        ramUsage: data.maxmem > 0 ? data.mem / data.maxmem : 0,
      };
    } catch {
      return null;
    } finally {
      client.destroy();
    }
  }

  async listResources(): Promise<DiscoveredResource[]> {
    const client = this.createClient();
    try {
      const resources = await client.get<ProxmoxResource[]>('/cluster/resources?type=vm');
      return resources
        .filter((r) => r.template !== 1)
        .map((r) => ({
          vmid: r.vmid,
          name: r.name,
          node: r.node,
          type: r.type,
          status: r.status,
        }));
    } catch (error) {
      throw new PlatformError(
        'PROXMOX_DISCOVERY_FAILED',
        'Impossible de lister les ressources Proxmox',
        PLATFORM,
        { cause: (error as Error).message },
      );
    } finally {
      client.destroy();
    }
  }

  private createClient(): ProxmoxClient {
    const proxCap = this.parentNode.capabilities?.proxmox_api;
    if (!proxCap) {
      throw new PlatformError('PROXMOX_AUTH_FAILED', 'No Proxmox capability configured on parent node', PLATFORM);
    }

    if (proxCap.authType === 'token') {
      const tokenSecret = proxCap.tokenSecretEncrypted ? this.decryptFn(proxCap.tokenSecretEncrypted) : undefined;
      return new ProxmoxClient({
        host: proxCap.host,
        port: proxCap.port,
        verifySsl: proxCap.verifySsl,
        authType: 'token',
        tokenId: proxCap.tokenId,
        tokenSecret,
      });
    }

    // Password auth
    const password = proxCap.passwordEncrypted ? this.decryptFn(proxCap.passwordEncrypted) : undefined;
    return new ProxmoxClient({
      host: proxCap.host,
      port: proxCap.port,
      verifySsl: proxCap.verifySsl,
      authType: 'password',
      username: proxCap.username,
      password,
    });
  }

  private extractPlatformRef(node: Node): { pveNode: string; vmid: number; vmType: 'qemu' | 'lxc' } {
    const ref = node.platformRef;
    if (!ref?.node || !ref.vmid || !ref.type) {
      throw new PlatformError(
        'PROXMOX_VM_NOT_FOUND',
        `Missing platformRef on node ${node.id}`,
        PLATFORM,
        { nodeId: node.id },
      );
    }
    return { pveNode: ref.node, vmid: ref.vmid, vmType: ref.type };
  }

  private wrapError(error: unknown, operation: string): PlatformError {
    const message = (error as Error).message ?? String(error);

    if (message.includes('401') || message.includes('403')) {
      return new PlatformError('PROXMOX_AUTH_FAILED', 'Identifiants Proxmox invalides', PLATFORM);
    }
    if (message.includes('ECONNREFUSED') || message.includes('ETIMEDOUT') || message.includes('ENOTFOUND')) {
      const host = this.parentNode.capabilities?.proxmox_api?.host ?? 'unknown';
      const port = this.parentNode.capabilities?.proxmox_api?.port ?? 8006;
      return new PlatformError('PROXMOX_UNREACHABLE', `API Proxmox injoignable a ${host}:${port}`, PLATFORM, { host, port });
    }
    return new PlatformError('PROXMOX_API_ERROR', `Erreur API Proxmox (${operation}): ${message}`, PLATFORM);
  }
}
