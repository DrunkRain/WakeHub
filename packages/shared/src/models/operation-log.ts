export type OperationLogLevel = 'info' | 'warn' | 'error';

export type OperationLogEventType =
  | 'start'
  | 'stop'
  | 'auto-shutdown'
  | 'error'
  | 'decision'
  | 'connection-test'
  | 'register'
  | 'login'
  | 'logout'
  | 'password-reset';

export interface OperationLog {
  id: string;
  timestamp: string;
  level: OperationLogLevel;
  source: string;
  message: string;
  reason: string | null;
  details: Record<string, unknown> | null;
  nodeId: string | null;
  nodeName: string | null;
  eventType: OperationLogEventType | null;
  errorCode: string | null;
  errorDetails: Record<string, unknown> | null;
  cascadeId: string | null;
}
