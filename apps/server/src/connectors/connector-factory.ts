import type { NodeType } from '@wakehub/shared';
import type { PlatformConnector } from './connector.interface.js';
import { WolSshConnector } from './wol-ssh.connector.js';

const wolSshConnector = new WolSshConnector();

export function getConnector(nodeType: NodeType): PlatformConnector {
  switch (nodeType) {
    case 'physical':
      return wolSshConnector;
    default:
      throw new Error(`No connector available for node type: ${nodeType}`);
  }
}
