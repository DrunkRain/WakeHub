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
  configured?: boolean;
}

export interface ConfigureProxmoxRequest {
  host: string;
  port?: number;
  verifySsl?: boolean;
  authType: 'token' | 'password';
  tokenId?: string;
  tokenSecret?: string;
  username?: string;
  password?: string;
}

export interface DiscoveredResource {
  vmid: number;
  name: string;
  node: string;
  type: 'qemu' | 'lxc';
  status: string;
}

export interface ConfigureDockerRequest {
  host: string;
  port: number;
  tlsEnabled?: boolean;
}

export interface DockerDiscoveredResource {
  containerId: string;
  name: string;
  image: string;
  state: string;
  status: string;
  ports: Array<{ IP: string; PrivatePort: number; PublicPort: number; Type: string }>;
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
