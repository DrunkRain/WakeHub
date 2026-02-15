export type NodeType = 'physical' | 'vm' | 'lxc' | 'container';

export type NodeStatus = 'online' | 'offline' | 'starting' | 'stopping' | 'error';

export interface ProxmoxCapability {
  host: string;
  port?: number;
  verifySsl?: boolean;
  authType: 'token' | 'password';
  // Token auth
  tokenId?: string;
  tokenSecretEncrypted?: string;
  // Password auth
  username?: string;
  passwordEncrypted?: string;
}

export interface DockerCapability {
  host: string;
  port: number;
  tlsEnabled?: boolean;
}

export interface NodeCapabilities {
  proxmox_api?: ProxmoxCapability;
  docker_api?: DockerCapability;
}

export interface PlatformRef {
  platform: string;
  platformId: string;
  node?: string;
  vmid?: number;
  type?: 'qemu' | 'lxc';
}

export interface Node {
  id: string;
  name: string;
  type: NodeType;
  status: NodeStatus;
  ipAddress: string | null;
  macAddress: string | null;
  sshUser: string | null;
  sshCredentialsEncrypted: string | null;
  parentId: string | null;
  capabilities: NodeCapabilities | null;
  platformRef: PlatformRef | null;
  serviceUrl: string | null;
  isPinned: boolean;
  confirmBeforeShutdown: boolean;
  discovered: boolean;
  configured: boolean;
  createdAt: Date;
  updatedAt: Date;
}
