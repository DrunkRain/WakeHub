import type { Node, NodeStatus } from '@wakehub/shared';

export interface PlatformConnector {
  testConnection(node: Node): Promise<boolean>;
  start(node: Node): Promise<void>;
  stop(node: Node): Promise<void>;
  getStatus(node: Node): Promise<NodeStatus>;
}
