export interface DiscoveredResource {
  name: string;
  type: 'vm' | 'container';
  platformRef: Record<string, unknown>;
  status: 'running' | 'stopped' | 'paused' | 'unknown' | 'error';
}

export interface PlatformConnector {
  testConnection(): Promise<{ success: boolean; message: string }>;
  start(): Promise<void>;
  stop(): Promise<void>;
  getStatus(): Promise<'online' | 'offline' | 'unknown' | 'error'>;
  listResources?(): Promise<DiscoveredResource[]>;
}
