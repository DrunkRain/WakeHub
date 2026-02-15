import type { NodeStatus } from './node.js';

export type SSEEventType = 'status-change' | 'cascade-progress' | 'cascade-complete' | 'cascade-error' | 'auto-shutdown';

export interface SSEStatusChangeEvent {
  nodeId: string;
  status: NodeStatus;
  timestamp: string;
}

export interface SSECascadeProgressEvent {
  cascadeId: string;
  nodeId: string;
  step: number;
  totalSteps: number;
  currentNodeId?: string;
  currentNodeName?: string;
  status?: 'started';
}

export interface SSECascadeCompleteEvent {
  cascadeId: string;
  nodeId: string;
  success: true;
}

export interface SSECascadeErrorEvent {
  cascadeId: string;
  nodeId: string;
  failedStep?: number;
  error: {
    code: string;
    message: string;
  };
}

export interface SSEAutoShutdownEvent {
  nodeId: string;
  nodeName: string;
  ruleId: string;
  reason: 'inactivity';
  inactiveMinutes: number;
  timestamp: string;
}

export type SSEEvent =
  | { event: 'status-change'; data: SSEStatusChangeEvent }
  | { event: 'cascade-progress'; data: SSECascadeProgressEvent }
  | { event: 'cascade-complete'; data: SSECascadeCompleteEvent }
  | { event: 'cascade-error'; data: SSECascadeErrorEvent }
  | { event: 'auto-shutdown'; data: SSEAutoShutdownEvent };
