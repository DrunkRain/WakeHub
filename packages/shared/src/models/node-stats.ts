export interface NodeStats {
  cpuUsage: number; // 0.0 to N.0 — equivalent cores in use (1.0 = one full core busy)
  ramUsage: number; // 0.0 to 1.0 — fraction of total RAM
  rxBytes?: number; // cumulative received bytes
  txBytes?: number; // cumulative transmitted bytes
}
