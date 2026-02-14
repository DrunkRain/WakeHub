import type { Node, NodeStatus, NodeStats } from '@wakehub/shared';

export interface PlatformConnector {
  testConnection(node: Node): Promise<boolean>;
  start(node: Node): Promise<void>;
  stop(node: Node): Promise<void>;
  getStatus(node: Node): Promise<NodeStatus>;
  getStats?(node: Node): Promise<NodeStats | null>;
}
