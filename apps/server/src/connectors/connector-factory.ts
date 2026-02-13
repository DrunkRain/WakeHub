import type { Node, NodeType } from '@wakehub/shared';
import type { PlatformConnector } from './connector.interface.js';
import { WolSshConnector } from './wol-ssh.connector.js';
import { ProxmoxConnector } from './proxmox.connector.js';
import { DockerConnector } from './docker.connector.js';

const wolSshConnector = new WolSshConnector();

export interface ConnectorOptions {
  parentNode?: Node;
  decryptFn?: (ciphertext: string) => string;
}

export function getConnector(nodeType: NodeType, options?: ConnectorOptions): PlatformConnector {
  switch (nodeType) {
    case 'physical':
      return wolSshConnector;
    case 'vm':
    case 'lxc': {
      if (!options?.parentNode || !options.decryptFn) {
        throw new Error(`Proxmox connector requires parentNode and decryptFn`);
      }
      return new ProxmoxConnector(options.parentNode, options.decryptFn);
    }
    case 'container': {
      if (!options?.parentNode) {
        throw new Error(`Docker connector requires parentNode`);
      }
      return new DockerConnector(options.parentNode);
    }
    default:
      throw new Error(`No connector available for node type: ${nodeType}`);
  }
}
