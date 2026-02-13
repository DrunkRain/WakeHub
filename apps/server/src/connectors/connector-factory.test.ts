import { describe, it, expect, vi } from 'vitest';
import type { Node } from '@wakehub/shared';

const { mockGet, mockPost, mockDestroy } = vi.hoisted(() => ({
  mockGet: vi.fn(),
  mockPost: vi.fn(),
  mockDestroy: vi.fn(),
}));

vi.mock('./proxmox-client.js', () => ({
  ProxmoxClient: class {
    get = mockGet;
    post = mockPost;
    destroy = mockDestroy;
  },
}));

vi.mock('./docker-client.js', () => ({
  DockerClient: class {
    ping = vi.fn();
    get = vi.fn();
    post = vi.fn();
  },
}));

import { getConnector } from './connector-factory.js';
import { WolSshConnector } from './wol-ssh.connector.js';
import { ProxmoxConnector } from './proxmox.connector.js';
import { DockerConnector } from './docker.connector.js';

function makeParentNode(): Node {
  return {
    id: 'parent-1',
    name: 'Proxmox Server',
    type: 'physical',
    status: 'online',
    ipAddress: '192.168.1.100',
    macAddress: null,
    sshUser: null,
    sshCredentialsEncrypted: null,
    parentId: null,
    capabilities: {
      proxmox_api: {
        host: '192.168.1.100',
        authType: 'token',
        tokenId: 'root@pam!test',
        tokenSecretEncrypted: 'encrypted',
      },
    },
    platformRef: null,
    serviceUrl: null,
    isPinned: false,
    confirmBeforeShutdown: false,
    discovered: false,
    configured: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

describe('ConnectorFactory', () => {
  it('should return WolSshConnector for physical nodes', () => {
    const connector = getConnector('physical');
    expect(connector).toBeInstanceOf(WolSshConnector);
  });

  it('should return ProxmoxConnector for vm node type', () => {
    const connector = getConnector('vm', {
      parentNode: makeParentNode(),
      decryptFn: (s) => s,
    });
    expect(connector).toBeInstanceOf(ProxmoxConnector);
  });

  it('should return ProxmoxConnector for lxc node type', () => {
    const connector = getConnector('lxc', {
      parentNode: makeParentNode(),
      decryptFn: (s) => s,
    });
    expect(connector).toBeInstanceOf(ProxmoxConnector);
  });

  it('should throw for vm without parentNode', () => {
    expect(() => getConnector('vm')).toThrow('Proxmox connector requires parentNode and decryptFn');
  });

  it('should throw for lxc without decryptFn', () => {
    expect(() => getConnector('lxc', { parentNode: makeParentNode() })).toThrow(
      'Proxmox connector requires parentNode and decryptFn',
    );
  });

  it('should return DockerConnector for container node type', () => {
    const dockerParent: Node = {
      ...makeParentNode(),
      capabilities: {
        docker_api: { host: '10.0.0.1', port: 2375 },
      },
    };
    const connector = getConnector('container', { parentNode: dockerParent });
    expect(connector).toBeInstanceOf(DockerConnector);
  });

  it('should throw for container without parentNode', () => {
    expect(() => getConnector('container')).toThrow('Docker connector requires parentNode');
  });

  it('should return the same instance for multiple physical calls', () => {
    const connector1 = getConnector('physical');
    const connector2 = getConnector('physical');
    expect(connector1).toBe(connector2);
  });
});
