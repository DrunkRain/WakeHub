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

// Cascade models
export type {
  Cascade,
  CascadeType,
  CascadeStatus,
} from './models/cascade.js';

// Cascade API types
export type {
  StartCascadeRequest,
  StopCascadeRequest,
  CascadeResponse,
  CascadeDetailResponse,
} from './api/cascades.js';

// SSE event types
export type {
  SSEEventType,
  SSEStatusChangeEvent,
  SSECascadeProgressEvent,
  SSECascadeCompleteEvent,
  SSECascadeErrorEvent,
  SSEAutoShutdownEvent,
  SSEEvent,
} from './models/sse-event.js';

// Node stats
export type { NodeStats } from './models/node-stats.js';

// Inactivity rule models
export type {
  InactivityRule,
  MonitoringCriteria,
} from './models/inactivity-rule.js';

// Operation log models
export type {
  OperationLog,
  OperationLogLevel,
  OperationLogEventType,
} from './models/operation-log.js';

// Inactivity rule API types
export type {
  InactivityRuleResponse,
  InactivityRuleListResponse,
  CreateInactivityRuleRequest,
  UpdateInactivityRuleRequest,
} from './api/inactivity-rules.js';
