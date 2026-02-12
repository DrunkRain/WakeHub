import { eq } from 'drizzle-orm';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { services } from '../db/schema.js';
import type { PlatformConnector } from '../connectors/connector.interface.js';
import { WolSshConnector } from '../connectors/wol-ssh.connector.js';
import { ProxmoxConnector } from '../connectors/proxmox.connector.js';
import { DockerConnector } from '../connectors/docker.connector.js';
import { decrypt } from '../utils/crypto.js';
import { PlatformError } from '../utils/platform-error.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = BetterSQLite3Database<any>;

type NodeType = 'service';

/**
 * Creates the appropriate PlatformConnector for a dependency chain node.
 * Returns null for nodes without sufficient credentials for control.
 */
export function createConnectorForNode(
  db: Db,
  _nodeType: NodeType,
  nodeId: string,
): PlatformConnector | null {
  return createConnectorForService(db, nodeId);
}

function createConnectorForService(db: Db, serviceId: string): PlatformConnector | null {
  const rows = db.select().from(services).where(eq(services.id, serviceId)).all();
  if (rows.length === 0) {
    throw new PlatformError('SERVICE_NOT_FOUND', `Service ${serviceId} non trouvé`, 'cascade');
  }
  const service = rows[0]!;

  if (service.type === 'physical') {
    if (!service.macAddress) {
      throw new PlatformError('NO_MAC_ADDRESS', `Service ${service.name} : adresse MAC manquante pour WoL`, 'wol-ssh');
    }

    let sshPassword = '';
    if (service.sshCredentialsEncrypted) {
      try {
        sshPassword = decrypt(service.sshCredentialsEncrypted);
      } catch {
        throw new PlatformError('DECRYPT_FAILED', `Impossible de déchiffrer les credentials SSH de ${service.name}`, 'wol-ssh');
      }
    }

    return new WolSshConnector({
      host: service.ipAddress ?? '',
      macAddress: service.macAddress,
      sshUser: service.sshUser ?? 'root',
      sshPassword,
    });
  }

  if (service.type === 'vm' || service.type === 'container') {
    // Find parent service to determine connector type
    if (!service.parentId) return null;

    const parentRows = db.select().from(services).where(eq(services.id, service.parentId)).all();
    if (parentRows.length === 0) {
      throw new PlatformError('SERVICE_NOT_FOUND', `Service parent ${service.parentId} non trouvé`, 'cascade');
    }
    const parent = parentRows[0]!;

    if (parent.type === 'proxmox') {
      if (!parent.apiUrl) {
        throw new PlatformError('NO_API_URL', `Service ${parent.name} : URL API manquante`, 'proxmox');
      }

      let credentials: Record<string, string> = {};
      if (parent.apiCredentialsEncrypted) {
        try {
          credentials = JSON.parse(decrypt(parent.apiCredentialsEncrypted));
        } catch {
          throw new PlatformError('DECRYPT_FAILED', `Impossible de déchiffrer les credentials API de ${parent.name}`, 'proxmox');
        }
      }

      const platformRef = service.platformRef as { node: string; vmid: number; type?: 'qemu' | 'lxc' };
      return new ProxmoxConnector({
        apiUrl: parent.apiUrl,
        ...credentials,
        resourceRef: platformRef,
      });
    }

    if (parent.type === 'docker') {
      if (!parent.apiUrl) {
        throw new PlatformError('NO_API_URL', `Service ${parent.name} : URL API manquante`, 'docker');
      }

      const platformRef = service.platformRef as { containerId: string };
      return new DockerConnector({
        apiUrl: parent.apiUrl,
        resourceRef: platformRef,
      });
    }

    return null;
  }

  // Proxmox/Docker hosts: use SSH if IP + SSH credentials are available (MAC optional for WoL start)
  if (service.type === 'proxmox' || service.type === 'docker') {
    if (service.ipAddress && service.sshCredentialsEncrypted) {
      let sshPassword = '';
      try {
        sshPassword = decrypt(service.sshCredentialsEncrypted);
      } catch {
        throw new PlatformError('DECRYPT_FAILED', `Impossible de déchiffrer les credentials SSH de ${service.name}`, 'wol-ssh');
      }

      return new WolSshConnector({
        host: service.ipAddress,
        macAddress: service.macAddress ?? undefined,
        sshUser: service.sshUser ?? 'root',
        sshPassword,
      });
    }

    // No SSH credentials but has API URL — return status-only connector
    if (service.apiUrl) {
      return createHostStatusConnector(service.type, service.apiUrl, service.name);
    }

    return null;
  }

  return null;
}

/**
 * Creates a status-only connector for Docker/Proxmox hosts that have an API URL
 * but no WoL/SSH credentials. Can check if the host is reachable but cannot start/stop it.
 */
function createHostStatusConnector(
  type: 'docker' | 'proxmox',
  apiUrl: string,
  name: string,
): PlatformConnector {
  const pingUrl = type === 'docker'
    ? `${apiUrl}/_ping`
    : `${apiUrl}/api2/json/version`;

  return {
    async testConnection() {
      try {
        const resp = await fetch(pingUrl, { signal: AbortSignal.timeout(5000) });
        return resp.ok
          ? { success: true, message: `${name} joignable` }
          : { success: false, message: `${name} non joignable (${resp.status})` };
      } catch (err) {
        return { success: false, message: `${name} non joignable: ${(err as Error).message}` };
      }
    },
    async getStatus() {
      try {
        const resp = await fetch(pingUrl, { signal: AbortSignal.timeout(5000) });
        return resp.ok ? 'online' : 'offline';
      } catch {
        return 'offline';
      }
    },
    async start() {
      throw new PlatformError('NO_START_CAPABILITY', `${name} ne peut pas être démarré — pas de WoL/SSH configuré`, 'host');
    },
    async stop() {
      throw new PlatformError('NO_STOP_CAPABILITY', `${name} ne peut pas être arrêté — pas de SSH configuré`, 'host');
    },
  };
}
