export interface ApiResponse<T> {
  data: T;
}

export interface ApiError {
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}

export type ApiResult<T> = ApiResponse<T> | ApiError;

// Node models
export type {
  Node,
  NodeType,
  NodeStatus,
  NodeCapabilities,
  ProxmoxCapability,
  DockerCapability,
  PlatformRef,
} from './models/node.js';

// Node API types
export type {
  CreateNodeRequest,
  UpdateNodeRequest,
  ConfigureProxmoxRequest,
  ConfigureDockerRequest,
  DiscoveredResource,
  DockerDiscoveredResource,
  TestConnectionResponse,
  NodeListResponse,
  NodeResponse,
} from './api/nodes.js';

// Dependency models
export type {
  DependencyLink,
  CreateDependencyRequest,
  DependencyNodeInfo,
  DependencyChain,
} from './models/dependency.js';

// Dependency API types
export type {
  CreateDependencyResponse,
  DependenciesQueryResponse,
  DeleteDependencyResponse,
  DependencyGraphNode,
  DependencyGraphLink,
  DependencyGraphResponse,
} from './api/dependencies.js';
