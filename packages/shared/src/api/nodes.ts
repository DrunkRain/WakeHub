import type { Node, NodeType } from '../models/node.js';

export interface CreateNodeRequest {
  name: string;
  type: NodeType;
  ipAddress?: string;
  macAddress?: string;
  sshUser?: string;
  sshPassword?: string;
  parentId?: string;
  serviceUrl?: string;
}

export interface UpdateNodeRequest {
  name?: string;
  ipAddress?: string;
  macAddress?: string;
  sshUser?: string;
  sshPassword?: string;
  serviceUrl?: string;
  isPinned?: boolean;
  confirmBeforeShutdown?: boolean;
}

export interface TestConnectionResponse {
  success: boolean;
  message: string;
}

export interface NodeListResponse {
  nodes: Omit<Node, 'sshCredentialsEncrypted'>[];
}

export interface NodeResponse {
  node: Omit<Node, 'sshCredentialsEncrypted'>;
}
