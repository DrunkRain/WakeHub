export interface MonitoringCriteria {
  lastAccess: boolean;
  networkConnections: boolean;
  cpuRamActivity: boolean;
  cpuThreshold?: number;
  ramThreshold?: number;
}

export interface InactivityRule {
  id: string;
  nodeId: string;
  timeoutMinutes: number;
  monitoringCriteria: MonitoringCriteria;
  isEnabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}
