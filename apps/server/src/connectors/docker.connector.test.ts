import { vi, describe, it, expect, beforeEach } from 'vitest';

const { mockPing, mockGet, mockPost } = vi.hoisted(() => ({
  mockPing: vi.fn(),
  mockGet: vi.fn(),
  mockPost: vi.fn(),
}));

vi.mock('./docker-client.js', () => ({
  DockerClient: class {
    ping = mockPing;
    get = mockGet;
    post = mockPost;
  },
}));

import { DockerConnector } from './docker.connector.js';
import { PlatformError } from '../utils/platform-error.js';
import type { Node } from '@wakehub/shared';

function makeParentNode(overrides?: Partial<Node>): Node {
  return {
    id: 'parent-1',
    name: 'Docker Host',
    type: 'physical',
    status: 'online',
    ipAddress: '10.0.0.1',
    macAddress: null,
    sshUser: null,
    sshCredentialsEncrypted: null,
    parentId: null,
    capabilities: {
      docker_api: { host: '10.0.0.1', port: 2375 },
    },
    platformRef: null,
    serviceUrl: null,
    isPinned: false,
    confirmBeforeShutdown: false,
    discovered: false,
    configured: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function makeContainerNode(overrides?: Partial<Node>): Node {
  return {
    id: 'container-1',
    name: 'my-nginx',
    type: 'container',
    status: 'online',
    ipAddress: null,
    macAddress: null,
    sshUser: null,
    sshCredentialsEncrypted: null,
    parentId: 'parent-1',
    capabilities: null,
    platformRef: { platform: 'docker', platformId: 'abc123def456' },
    serviceUrl: null,
    isPinned: false,
    confirmBeforeShutdown: false,
    discovered: true,
    configured: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe('DockerConnector', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('constructor', () => {
    it('should throw PlatformError if parent has no docker_api capability', () => {
      const parent = makeParentNode({ capabilities: null });
      expect(() => new DockerConnector(parent)).toThrow(PlatformError);
    });
  });

  describe('testConnection', () => {
    it('should return true when ping succeeds', async () => {
      mockPing.mockResolvedValueOnce(true);

      const connector = new DockerConnector(makeParentNode());
      const result = await connector.testConnection(makeContainerNode());
      expect(result).toBe(true);
      expect(mockPing).toHaveBeenCalled();
    });

    it('should throw PlatformError on connection failure', async () => {
      mockPing.mockRejectedValueOnce(new Error('connect ECONNREFUSED'));

      const connector = new DockerConnector(makeParentNode());
      await expect(connector.testConnection(makeContainerNode())).rejects.toThrow(PlatformError);
    });

    it('should include DOCKER_UNREACHABLE code on network error', async () => {
      mockPing.mockRejectedValueOnce(new Error('connect ECONNREFUSED'));

      const connector = new DockerConnector(makeParentNode());
      try {
        await connector.testConnection(makeContainerNode());
      } catch (error) {
        expect(error).toBeInstanceOf(PlatformError);
        expect((error as PlatformError).code).toBe('DOCKER_UNREACHABLE');
        expect((error as PlatformError).platform).toBe('docker');
      }
    });
  });

  describe('start', () => {
    it('should POST to start container endpoint', async () => {
      mockPost.mockResolvedValueOnce(undefined);

      const connector = new DockerConnector(makeParentNode());
      await connector.start(makeContainerNode());

      expect(mockPost).toHaveBeenCalledWith('/containers/abc123def456/start');
    });

    it('should throw PlatformError if platformRef is missing', async () => {
      const connector = new DockerConnector(makeParentNode());
      const node = makeContainerNode({ platformRef: null });

      await expect(connector.start(node)).rejects.toThrow(PlatformError);
    });

    it('should throw DOCKER_START_FAILED on error', async () => {
      mockPost.mockRejectedValueOnce(new Error('Docker POST failed (500)'));

      const connector = new DockerConnector(makeParentNode());
      try {
        await connector.start(makeContainerNode());
      } catch (error) {
        expect(error).toBeInstanceOf(PlatformError);
        expect((error as PlatformError).code).toBe('DOCKER_START_FAILED');
      }
    });
  });

  describe('stop', () => {
    it('should POST to stop container endpoint', async () => {
      mockPost.mockResolvedValueOnce(undefined);

      const connector = new DockerConnector(makeParentNode());
      await connector.stop(makeContainerNode());

      expect(mockPost).toHaveBeenCalledWith('/containers/abc123def456/stop');
    });

    it('should throw DOCKER_STOP_FAILED on error', async () => {
      mockPost.mockRejectedValueOnce(new Error('Docker POST failed (500)'));

      const connector = new DockerConnector(makeParentNode());
      try {
        await connector.stop(makeContainerNode());
      } catch (error) {
        expect(error).toBeInstanceOf(PlatformError);
        expect((error as PlatformError).code).toBe('DOCKER_STOP_FAILED');
      }
    });
  });

  describe('getStatus', () => {
    it('should return online when container is running', async () => {
      mockGet.mockResolvedValueOnce({ State: { Running: true } });

      const connector = new DockerConnector(makeParentNode());
      const status = await connector.getStatus(makeContainerNode());
      expect(status).toBe('online');
    });

    it('should return offline when container is not running', async () => {
      mockGet.mockResolvedValueOnce({ State: { Running: false } });

      const connector = new DockerConnector(makeParentNode());
      const status = await connector.getStatus(makeContainerNode());
      expect(status).toBe('offline');
    });

    it('should return error on request failure', async () => {
      mockGet.mockRejectedValueOnce(new Error('connection error'));

      const connector = new DockerConnector(makeParentNode());
      const status = await connector.getStatus(makeContainerNode());
      expect(status).toBe('error');
    });
  });

  describe('listResources', () => {
    it('should return mapped DockerDiscoveredResource array', async () => {
      mockGet.mockResolvedValueOnce([
        {
          Id: 'abc123',
          Names: ['/my-nginx'],
          Image: 'nginx:latest',
          State: 'running',
          Status: 'Up 2 hours',
          Ports: [{ IP: '0.0.0.0', PrivatePort: 80, PublicPort: 8080, Type: 'tcp' }],
        },
        {
          Id: 'def456',
          Names: ['/my-redis'],
          Image: 'redis:7',
          State: 'exited',
          Status: 'Exited (0) 3 hours ago',
          Ports: [],
        },
      ]);

      const connector = new DockerConnector(makeParentNode());
      const resources = await connector.listResources();

      expect(resources).toHaveLength(2);
      expect(resources[0]).toEqual({
        containerId: 'abc123',
        name: 'my-nginx',
        image: 'nginx:latest',
        state: 'running',
        status: 'Up 2 hours',
        ports: [{ IP: '0.0.0.0', PrivatePort: 80, PublicPort: 8080, Type: 'tcp' }],
      });
      expect(resources[1]).toEqual({
        containerId: 'def456',
        name: 'my-redis',
        image: 'redis:7',
        state: 'exited',
        status: 'Exited (0) 3 hours ago',
        ports: [],
      });
    });

    it('should strip leading / from container names', async () => {
      mockGet.mockResolvedValueOnce([
        { Id: 'abc', Names: ['/test-container'], Image: 'alpine', State: 'running', Status: 'Up', Ports: [] },
      ]);

      const connector = new DockerConnector(makeParentNode());
      const resources = await connector.listResources();
      expect(resources[0]!.name).toBe('test-container');
    });

    it('should throw DOCKER_DISCOVERY_FAILED on error', async () => {
      mockGet.mockRejectedValueOnce(new Error('connection failed'));

      const connector = new DockerConnector(makeParentNode());
      try {
        await connector.listResources();
      } catch (error) {
        expect(error).toBeInstanceOf(PlatformError);
        expect((error as PlatformError).code).toBe('DOCKER_DISCOVERY_FAILED');
      }
    });
  });
});
