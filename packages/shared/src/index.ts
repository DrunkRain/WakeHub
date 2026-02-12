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

export type ServiceType = 'physical' | 'proxmox' | 'docker' | 'vm' | 'container';

export type ServiceStatus = 'online' | 'offline' | 'running' | 'stopped' | 'paused' | 'unknown' | 'error';

export interface Service {
  id: string;
  name: string;
  type: ServiceType;
  ipAddress: string | null;
  macAddress: string | null;
  sshUser: string | null;
  apiUrl: string | null;
  serviceUrl: string | null;
  status: ServiceStatus;
  platformRef: PlatformRef | null;
  inactivityTimeout: number | null;
  parentId: string | null;
  pinnedToDashboard: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ProxmoxPlatformRef {
  node: string;
  vmid: number;
}

export interface DockerPlatformRef {
  containerId: string;
  image: string;
}

export type PlatformRef = ProxmoxPlatformRef | DockerPlatformRef | Record<string, unknown>;

export type DependencyNodeType = 'service';

export interface DependencyLink {
  id: string;
  parentType: DependencyNodeType;
  parentId: string;
  childType: DependencyNodeType;
  childId: string;
  isShared: boolean;
  isStructural: boolean;
  createdAt: string;
}

export interface DependencyChainNode {
  nodeType: DependencyNodeType;
  nodeId: string;
  name: string;
  status: string;
}

export interface GraphNode {
  id: string;
  name: string;
  nodeType: DependencyNodeType;
  subType: string;
  status: string;
  isShared: boolean;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  isShared: boolean;
}

// === SSE Event Types ===

export type SSEEventType = 'status-change' | 'cascade-progress' | 'cascade-complete' | 'cascade-error';

export interface StatusChangeEvent {
  serviceId: string;
  status: string;
  timestamp: string; // ISO 8601
}

export interface CascadeProgressEvent {
  cascadeId: string;
  serviceId: string;
  step: number;
  totalSteps: number;
  currentDependency: {
    id: string;
    name: string;
    status: string;
  };
}

export interface CascadeCompleteEvent {
  cascadeId: string;
  serviceId: string;
  success: true;
}

export interface CascadeErrorEvent {
  cascadeId: string;
  serviceId: string;
  failedStep: number;
  error: {
    code: string;
    message: string;
  };
}

export type SSEEventData =
  | { event: 'status-change'; data: StatusChangeEvent }
  | { event: 'cascade-progress'; data: CascadeProgressEvent }
  | { event: 'cascade-complete'; data: CascadeCompleteEvent }
  | { event: 'cascade-error'; data: CascadeErrorEvent };

// === Cascade Types ===

export type CascadeType = 'start' | 'stop';

export type CascadeStatus = 'pending' | 'in_progress' | 'completed' | 'failed';

export interface CascadeRecord {
  id: string;
  serviceId: string;
  type: CascadeType;
  status: CascadeStatus;
  currentStep: number;
  totalSteps: number;
  failedStep: number | null;
  errorCode: string | null;
  errorMessage: string | null;
  startedAt: string;
  completedAt: string | null;
}
