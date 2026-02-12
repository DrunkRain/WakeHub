import { Agent } from 'undici';
import type { PlatformConnector, DiscoveredResource } from './connector.interface.js';
import { PlatformError } from '../utils/platform-error.js';

export interface ProxmoxConfig {
  apiUrl: string; // e.g. https://192.168.1.10:8006
  username?: string; // e.g. root@pam
  password?: string;
  tokenId?: string; // e.g. root@pam!mytoken
  tokenSecret?: string;
  resourceRef?: { node: string; vmid: number; type?: 'qemu' | 'lxc' };
}

// Disable TLS verification for self-signed Proxmox certs
const insecureAgent = new Agent({
  connect: { rejectUnauthorized: false },
});

export class ProxmoxConnector implements PlatformConnector {
  private ticket: string | null = null;
  private csrfToken: string | null = null;

  constructor(private readonly config: ProxmoxConfig) {}

  private get baseUrl(): string {
    return `${this.config.apiUrl}/api2/json`;
  }

  private get isTokenAuth(): boolean {
    return !!this.config.tokenId && !!this.config.tokenSecret;
  }

  private async fetchProxmox(
    path: string,
    options: { method?: string; body?: Record<string, unknown> } = {},
  ): Promise<unknown> {
    const url = `${this.baseUrl}${path}`;
    const headers: Record<string, string> = {};

    if (this.isTokenAuth) {
      headers['Authorization'] = `PVEAPIToken=${this.config.tokenId}=${this.config.tokenSecret}`;
    } else if (this.ticket) {
      headers['Cookie'] = `PVEAuthCookie=${this.ticket}`;
      if (this.csrfToken && options.method && options.method !== 'GET') {
        headers['CSRFPreventionToken'] = this.csrfToken;
      }
    }

    const fetchOptions: RequestInit = {
      method: options.method ?? 'GET',
      headers,
      // @ts-expect-error undici dispatcher
      dispatcher: insecureAgent,
    };

    if (options.body) {
      headers['Content-Type'] = 'application/x-www-form-urlencoded';
      fetchOptions.body = new URLSearchParams(
        Object.entries(options.body).map(([k, v]) => [k, String(v)] as [string, string]),
      ).toString();
    }

    let response: Response;
    try {
      response = await fetch(url, fetchOptions);
    } catch (err) {
      throw new PlatformError(
        'PROXMOX_NETWORK_ERROR',
        `Impossible de contacter le serveur Proxmox : ${(err as Error).message}`,
        'proxmox',
        { url },
      );
    }

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new PlatformError(
        `PROXMOX_HTTP_${response.status}`,
        `Erreur Proxmox ${response.status} : ${text || response.statusText}`,
        'proxmox',
        { status: response.status, url, body: text },
      );
    }

    const json = (await response.json()) as { data: unknown };
    return json.data;
  }

  private async authenticate(): Promise<void> {
    if (this.isTokenAuth) return;
    if (this.ticket) return;

    const data = (await this.fetchProxmox('/access/ticket', {
      method: 'POST',
      body: {
        username: this.config.username ?? '',
        password: this.config.password ?? '',
      },
    })) as { ticket: string; CSRFPreventionToken: string };

    this.ticket = data.ticket;
    this.csrfToken = data.CSRFPreventionToken;
  }

  async testConnection(): Promise<{ success: boolean; message: string }> {
    try {
      if (this.isTokenAuth) {
        await this.fetchProxmox('/nodes');
        return { success: true, message: 'Connexion Proxmox réussie (API token)' };
      } else {
        await this.authenticate();
        return { success: true, message: 'Connexion Proxmox réussie (ticket)' };
      }
    } catch (err) {
      if (err instanceof PlatformError) {
        return { success: false, message: err.message };
      }
      return { success: false, message: `Erreur inattendue : ${(err as Error).message}` };
    }
  }

  /** Resolve the Proxmox API kind path from the resourceRef type. Defaults to 'qemu'. */
  private get apiKind(): 'qemu' | 'lxc' {
    return this.config.resourceRef?.type ?? 'qemu';
  }

  async listResources(): Promise<DiscoveredResource[]> {
    await this.authenticate();

    const nodes = (await this.fetchProxmox('/nodes')) as Array<{ node: string }>;
    const results: DiscoveredResource[] = [];

    for (const n of nodes) {
      // Discover QEMU VMs
      const vms = (await this.fetchProxmox(`/nodes/${n.node}/qemu`)) as Array<{
        vmid: number;
        name?: string;
        status: string;
      }>;

      for (const vm of vms) {
        results.push({
          name: vm.name ?? `VM ${vm.vmid}`,
          type: 'vm',
          platformRef: { node: n.node, vmid: vm.vmid, type: 'qemu' as const },
          status: mapProxmoxStatus(vm.status),
        });
      }

      // Discover LXC containers
      const cts = (await this.fetchProxmox(`/nodes/${n.node}/lxc`)) as Array<{
        vmid: number;
        name?: string;
        status: string;
      }>;

      for (const ct of cts) {
        results.push({
          name: ct.name ?? `CT ${ct.vmid}`,
          type: 'container',
          platformRef: { node: n.node, vmid: ct.vmid, type: 'lxc' as const },
          status: mapProxmoxStatus(ct.status),
        });
      }
    }

    return results;
  }

  async start(): Promise<void> {
    const ref = this.config.resourceRef;
    if (!ref) throw new PlatformError('PROXMOX_NO_REF', 'resourceRef requis pour start', 'proxmox');

    await this.authenticate();
    await this.fetchProxmox(`/nodes/${ref.node}/${this.apiKind}/${ref.vmid}/status/start`, {
      method: 'POST',
    });
  }

  async stop(): Promise<void> {
    const ref = this.config.resourceRef;
    if (!ref) throw new PlatformError('PROXMOX_NO_REF', 'resourceRef requis pour stop', 'proxmox');

    await this.authenticate();
    await this.fetchProxmox(`/nodes/${ref.node}/${this.apiKind}/${ref.vmid}/status/stop`, {
      method: 'POST',
    });
  }

  async getStatus(): Promise<'online' | 'offline' | 'unknown' | 'error'> {
    const ref = this.config.resourceRef;
    if (!ref) return 'unknown';

    try {
      await this.authenticate();
      const data = (await this.fetchProxmox(
        `/nodes/${ref.node}/${this.apiKind}/${ref.vmid}/status/current`,
      )) as { status: string };

      const s = mapProxmoxStatus(data.status);
      if (s === 'running') return 'online';
      if (s === 'stopped' || s === 'paused') return 'offline';
      return 'unknown';
    } catch {
      return 'error';
    }
  }
}

function mapProxmoxStatus(
  status: string,
): 'running' | 'stopped' | 'paused' | 'unknown' | 'error' {
  switch (status) {
    case 'running':
      return 'running';
    case 'stopped':
      return 'stopped';
    case 'paused':
      return 'paused';
    default:
      return 'unknown';
  }
}
