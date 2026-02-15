import { describe, it, expect, beforeAll, beforeEach, afterAll, afterEach, vi } from 'vitest';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { unlinkSync, existsSync } from 'node:fs';
import { eq } from 'drizzle-orm';
import * as schema from '../db/schema.js';
import { nodes, inactivityRules, cascades, operationLogs, dependencyLinks } from '../db/schema.js';

// Mock cascade-engine — MUST use vi.hoisted()
const mockExecuteCascadeStop = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));

vi.mock('./cascade-engine.js', () => ({
  executeCascadeStop: mockExecuteCascadeStop,
}));

// Mock node-ssh for SSH checks
const mockSshExecResult = vi.hoisted(() => ({ stdout: '', stderr: '', code: 0 }));
const mockSshConnectShouldFail = vi.hoisted(() => ({ value: false }));

vi.mock('node-ssh', () => {
  class MockNodeSSH {
    async connect() {
      if (mockSshConnectShouldFail.value) {
        throw new Error('SSH connection failed');
      }
    }
    async execCommand() {
      return { stdout: mockSshExecResult.stdout, stderr: mockSshExecResult.stderr, code: mockSshExecResult.code };
    }
    dispose() {}
  }
  return { NodeSSH: MockNodeSSH };
});

// Mock connector-factory for platform stats
const mockGetStats = vi.hoisted(() => vi.fn());
const mockGetConnector = vi.hoisted(() => vi.fn());

vi.mock('../connectors/connector-factory.js', () => ({
  getConnector: mockGetConnector,
}));

// Mock net module for TCP check
// tcpCheckResult controls what the mock socket does: true = connect, false = timeout
const tcpCheckResult = vi.hoisted(() => ({ value: true }));

vi.mock('node:net', () => {
  class MockSocket {
    private listeners: Record<string, Array<() => void>> = {};
    once(event: string, cb: () => void) {
      if (!this.listeners[event]) this.listeners[event] = [];
      this.listeners[event]!.push(cb);
    }
    connect() {
      // Fire the appropriate callback after microtask
      setTimeout(() => {
        if (tcpCheckResult.value) {
          this.listeners['connect']?.forEach((cb) => cb());
        } else {
          this.listeners['timeout']?.forEach((cb) => cb());
        }
      }, 0);
    }
    destroy() {}
    setTimeout() {}
  }
  return {
    default: {
      Socket: MockSocket,
    },
  };
});

import {
  startInactivityMonitor,
  stopInactivityMonitor,
  checkAllInactivityRules,
  _getInactivityCounters,
  _getMonitorInterval,
  _getNetworkTrafficCache,
} from './inactivity-monitor.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const TEST_DB_PATH = join(__dirname, '../../test-inactivity-monitor-db.sqlite');

let sqlite: InstanceType<typeof Database>;
let db: ReturnType<typeof drizzle<typeof schema>>;
let mockSseManager: { broadcast: ReturnType<typeof vi.fn> };

beforeAll(() => {
  if (existsSync(TEST_DB_PATH)) unlinkSync(TEST_DB_PATH);
  sqlite = new Database(TEST_DB_PATH);
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('foreign_keys = ON');
  db = drizzle(sqlite, { schema });
  migrate(db, { migrationsFolder: join(__dirname, '../../drizzle') });
});

afterAll(() => {
  sqlite.close();
  if (existsSync(TEST_DB_PATH)) unlinkSync(TEST_DB_PATH);
});

function insertNode(
  name: string,
  type: 'physical' | 'vm' | 'lxc' | 'container' = 'physical',
  opts: {
    status?: 'online' | 'offline' | 'starting' | 'stopping' | 'error';
    ipAddress?: string | null;
    sshUser?: string | null;
    parentId?: string | null;
    capabilities?: object | null;
    platformRef?: object | null;
  } = {},
): string {
  const id = crypto.randomUUID();
  db.insert(nodes).values({
    id,
    name,
    type,
    status: opts.status ?? 'online',
    ipAddress: opts.ipAddress !== undefined ? opts.ipAddress : '192.168.1.100',
    sshUser: opts.sshUser !== undefined ? opts.sshUser : 'admin',
    parentId: opts.parentId ?? null,
    capabilities: opts.capabilities ?? null,
    platformRef: opts.platformRef ?? null,
  } as any).run();
  return id;
}

function insertRule(
  nodeId: string,
  opts: { timeoutMinutes?: number; isEnabled?: boolean; monitoringCriteria?: object } = {},
): string {
  const id = crypto.randomUUID();
  db.insert(inactivityRules).values({
    id,
    nodeId,
    timeoutMinutes: opts.timeoutMinutes ?? 5,
    isEnabled: opts.isEnabled ?? true,
    monitoringCriteria: opts.monitoringCriteria ?? { lastAccess: true, networkConnections: false, cpuRamActivity: false },
    createdAt: new Date(),
    updatedAt: new Date(),
  } as any).run();
  return id;
}

function getLogs() {
  return db.select().from(operationLogs).all();
}

function getCascades() {
  return db.select().from(cascades).all();
}

const mockDecryptFn = vi.fn((s: string) => s);

beforeEach(() => {
  sqlite.exec('DELETE FROM cascades');
  sqlite.exec('DELETE FROM operation_logs');
  sqlite.exec('DELETE FROM inactivity_rules');
  sqlite.exec('DELETE FROM dependency_links');
  sqlite.exec('DELETE FROM nodes');
  _getInactivityCounters().clear();
  _getNetworkTrafficCache().clear();
  mockExecuteCascadeStop.mockReset();
  mockExecuteCascadeStop.mockResolvedValue(undefined);
  tcpCheckResult.value = true; // default: node is reachable
  mockSshExecResult.stdout = '';
  mockSshExecResult.stderr = '';
  mockSshExecResult.code = 0;
  mockSshConnectShouldFail.value = false;
  mockDecryptFn.mockReset();
  mockDecryptFn.mockImplementation((s: string) => s);
  mockSseManager = { broadcast: vi.fn() };
  mockGetConnector.mockReset();
  mockGetStats.mockReset();
  // Default: getConnector returns a connector with no getStats
  mockGetConnector.mockReturnValue({});
});

afterEach(() => {
  stopInactivityMonitor();
});

// Helper to simulate TCP check result
function simulateTcpCheck(reachable: boolean): void {
  tcpCheckResult.value = reachable;
}

// ============================================================
// Task 6.2: Start/Stop du moniteur
// ============================================================

describe('startInactivityMonitor / stopInactivityMonitor', () => {
  it('should start the interval timer', () => {
    vi.useFakeTimers();
    startInactivityMonitor(db, mockSseManager as any, mockDecryptFn);
    expect(_getMonitorInterval()).not.toBeNull();
    vi.useRealTimers();
  });

  it('should not start twice', () => {
    vi.useFakeTimers();
    startInactivityMonitor(db, mockSseManager as any, mockDecryptFn);
    const interval1 = _getMonitorInterval();
    startInactivityMonitor(db, mockSseManager as any, mockDecryptFn);
    const interval2 = _getMonitorInterval();
    expect(interval1).toBe(interval2);
    vi.useRealTimers();
  });

  it('should stop the interval timer and clear counters', () => {
    vi.useFakeTimers();
    startInactivityMonitor(db, mockSseManager as any, mockDecryptFn);
    _getInactivityCounters().set('test-node', 5);
    stopInactivityMonitor();
    expect(_getMonitorInterval()).toBeNull();
    expect(_getInactivityCounters().size).toBe(0);
    vi.useRealTimers();
  });
});

// ============================================================
// Task 6.3: Détection d'inactivité et incrémentation du compteur
// ============================================================

describe('checkAllInactivityRules — inactivity detection', () => {
  it('should increment counter when node is inactive (TCP unreachable)', async () => {
    const nodeId = insertNode('Server1', 'physical');
    insertRule(nodeId, { timeoutMinutes: 10 });

    // Simulate unreachable
    simulateTcpCheck(false);

    await checkAllInactivityRules(db, mockSseManager as any, mockDecryptFn);

    expect(_getInactivityCounters().get(nodeId)).toBe(1);
  });

  it('should not increment counter when node is active (TCP reachable)', async () => {
    const nodeId = insertNode('Server1', 'physical');
    insertRule(nodeId, { timeoutMinutes: 10 });

    simulateTcpCheck(true);

    await checkAllInactivityRules(db, mockSseManager as any, mockDecryptFn);

    expect(_getInactivityCounters().get(nodeId) ?? 0).toBe(0);
  });

  it('should skip disabled rules', async () => {
    const nodeId = insertNode('Server1', 'physical');
    insertRule(nodeId, { isEnabled: false });

    simulateTcpCheck(false);

    await checkAllInactivityRules(db, mockSseManager as any, mockDecryptFn);

    expect(_getInactivityCounters().has(nodeId)).toBe(false);
  });

  it('should skip offline nodes', async () => {
    const nodeId = insertNode('Server1', 'physical', { status: 'offline' });
    insertRule(nodeId, { timeoutMinutes: 5 });

    simulateTcpCheck(false);

    await checkAllInactivityRules(db, mockSseManager as any, mockDecryptFn);

    expect(_getInactivityCounters().has(nodeId)).toBe(false);
  });

  it('should consider node active when no SSH credentials (safe fallback)', async () => {
    const nodeId = insertNode('Server1', 'physical', { ipAddress: null, sshUser: null });
    insertRule(nodeId, { timeoutMinutes: 5 });

    await checkAllInactivityRules(db, mockSseManager as any, mockDecryptFn);

    expect(_getInactivityCounters().get(nodeId) ?? 0).toBe(0);
  });

  it('should consider node active when no criteria are enabled', async () => {
    const nodeId = insertNode('Server1', 'physical');
    insertRule(nodeId, {
      timeoutMinutes: 5,
      monitoringCriteria: { lastAccess: false, networkConnections: false, cpuRamActivity: false },
    });

    await checkAllInactivityRules(db, mockSseManager as any, mockDecryptFn);

    expect(_getInactivityCounters().get(nodeId) ?? 0).toBe(0);
  });
});

// ============================================================
// Task 6.4: Déclenchement de cascade stop après timeout
// ============================================================

describe('checkAllInactivityRules — auto-shutdown trigger', () => {
  it('should trigger cascade stop when inactivity counter reaches timeout', async () => {
    const nodeId = insertNode('Server1', 'physical');
    insertRule(nodeId, { timeoutMinutes: 3 });

    simulateTcpCheck(false);

    // Simulate 2 minutes already elapsed
    _getInactivityCounters().set(nodeId, 2);

    await checkAllInactivityRules(db, mockSseManager as any, mockDecryptFn);

    // Counter should reach 3 = timeoutMinutes → trigger
    expect(mockExecuteCascadeStop).toHaveBeenCalledTimes(1);
    expect(_getInactivityCounters().has(nodeId)).toBe(false); // cleared after trigger
  });

  it('should create a cascade record before triggering stop', async () => {
    const nodeId = insertNode('Server1', 'physical');
    insertRule(nodeId, { timeoutMinutes: 1 });

    simulateTcpCheck(false);

    await checkAllInactivityRules(db, mockSseManager as any, mockDecryptFn);

    const allCascades = getCascades();
    expect(allCascades).toHaveLength(1);
    expect(allCascades[0]!.nodeId).toBe(nodeId);
    expect(allCascades[0]!.type).toBe('stop');
  });

  it('should NOT trigger cascade when counter is below timeout', async () => {
    const nodeId = insertNode('Server1', 'physical');
    insertRule(nodeId, { timeoutMinutes: 10 });

    simulateTcpCheck(false);

    await checkAllInactivityRules(db, mockSseManager as any, mockDecryptFn);

    expect(mockExecuteCascadeStop).not.toHaveBeenCalled();
    expect(_getInactivityCounters().get(nodeId)).toBe(1);
  });
});

// ============================================================
// Task 6.5: Réinitialisation du compteur sur activité détectée
// ============================================================

describe('checkAllInactivityRules — counter reset on activity', () => {
  it('should reset counter when activity is detected after being inactive', async () => {
    const nodeId = insertNode('Server1', 'physical');
    insertRule(nodeId, { timeoutMinutes: 10 });

    // Previous inactivity
    _getInactivityCounters().set(nodeId, 5);

    simulateTcpCheck(true);

    await checkAllInactivityRules(db, mockSseManager as any, mockDecryptFn);

    expect(_getInactivityCounters().get(nodeId)).toBe(0);
  });

  it('should log counter reset when previous count > 0', async () => {
    const nodeId = insertNode('Server1', 'physical');
    insertRule(nodeId, { timeoutMinutes: 10 });

    _getInactivityCounters().set(nodeId, 3);
    simulateTcpCheck(true);

    await checkAllInactivityRules(db, mockSseManager as any, mockDecryptFn);

    const logs = getLogs();
    expect(logs.some((l) => l.message.includes('compteur réinitialisé'))).toBe(true);
  });

  it('should NOT log reset if counter was 0', async () => {
    const nodeId = insertNode('Server1', 'physical');
    insertRule(nodeId, { timeoutMinutes: 10 });

    simulateTcpCheck(true);

    await checkAllInactivityRules(db, mockSseManager as any, mockDecryptFn);

    const logs = getLogs();
    expect(logs.some((l) => l.message.includes('compteur réinitialisé'))).toBe(false);
  });
});

// ============================================================
// Task 6.6: Émission de l'événement SSE auto-shutdown
// ============================================================

describe('checkAllInactivityRules — SSE auto-shutdown event', () => {
  it('should broadcast auto-shutdown event when trigger fires', async () => {
    const nodeId = insertNode('ServerX', 'physical');
    const ruleId = insertRule(nodeId, { timeoutMinutes: 1 });

    simulateTcpCheck(false);

    await checkAllInactivityRules(db, mockSseManager as any, mockDecryptFn);

    expect(mockSseManager.broadcast).toHaveBeenCalledWith(
      'auto-shutdown',
      expect.objectContaining({
        nodeId,
        nodeName: 'ServerX',
        ruleId,
        reason: 'inactivity',
        inactiveMinutes: 1,
      }),
    );
  });
});

// ============================================================
// Task 6.7: Logging des opérations
// ============================================================

describe('checkAllInactivityRules — logging', () => {
  it('should log when auto-shutdown is triggered', async () => {
    const nodeId = insertNode('Server1', 'physical');
    insertRule(nodeId, { timeoutMinutes: 1 });

    simulateTcpCheck(false);

    await checkAllInactivityRules(db, mockSseManager as any, mockDecryptFn);

    const logs = getLogs();
    expect(logs.some((l) =>
      l.source === 'inactivity-monitor' &&
      l.level === 'info' &&
      l.message.includes('Arrêt automatique'),
    )).toBe(true);
  });

  it('should log activity detection with counter reset', async () => {
    const nodeId = insertNode('Server1', 'physical');
    insertRule(nodeId, { timeoutMinutes: 10 });
    _getInactivityCounters().set(nodeId, 2);

    simulateTcpCheck(true);

    await checkAllInactivityRules(db, mockSseManager as any, mockDecryptFn);

    const logs = getLogs();
    expect(logs.some((l) =>
      l.source === 'inactivity-monitor' &&
      l.message.includes('Activité détectée'),
    )).toBe(true);
  });

  it('should set enriched fields (nodeId, nodeName, eventType) on auto-shutdown log', async () => {
    const nodeId = insertNode('ServerShutdown', 'physical');
    insertRule(nodeId, { timeoutMinutes: 1 });

    simulateTcpCheck(false);

    await checkAllInactivityRules(db, mockSseManager as any, mockDecryptFn);

    const logs = getLogs();
    const shutdownLog = logs.find((l) =>
      l.source === 'inactivity-monitor' &&
      l.eventType === 'auto-shutdown',
    );
    expect(shutdownLog).toBeDefined();
    expect(shutdownLog!.nodeId).toBe(nodeId);
    expect(shutdownLog!.nodeName).toBe('ServerShutdown');
  });

  it('should set enriched fields (nodeId, nodeName, eventType=decision) on activity reset log', async () => {
    const nodeId = insertNode('ServerReset', 'physical');
    insertRule(nodeId, { timeoutMinutes: 10 });
    _getInactivityCounters().set(nodeId, 3);

    simulateTcpCheck(true);

    await checkAllInactivityRules(db, mockSseManager as any, mockDecryptFn);

    const logs = getLogs();
    const decisionLog = logs.find((l) =>
      l.source === 'inactivity-monitor' &&
      l.eventType === 'decision' &&
      l.nodeId === nodeId,
    );
    expect(decisionLog).toBeDefined();
    expect(decisionLog!.nodeName).toBe('ServerReset');
  });

  it('should set enriched fields on active dependent cancellation log', async () => {
    const nodeA = insertNode('ServerA', 'physical');
    insertRule(nodeA, { timeoutMinutes: 1 });

    const nodeB = insertNode('DependentB', 'physical', { status: 'online' });
    insertDependency(nodeB, nodeA);

    simulateTcpCheck(false);

    await checkAllInactivityRules(db, mockSseManager as any, mockDecryptFn);

    const logs = getLogs();
    const cancelLog = logs.find((l) =>
      l.source === 'inactivity-monitor' &&
      l.eventType === 'decision' &&
      l.nodeId === nodeA,
    );
    expect(cancelLog).toBeDefined();
    expect(cancelLog!.nodeName).toBe('ServerA');
    expect(cancelLog!.message).toContain('annulé');
  });
});

// ============================================================
// M4 fix: Protection contre les cascades concurrentes
// ============================================================

describe('checkAllInactivityRules — concurrent cascade protection', () => {
  it('should skip auto-shutdown when a cascade is already running on the node', async () => {
    const nodeId = insertNode('Server1', 'physical');
    insertRule(nodeId, { timeoutMinutes: 1 });

    // Insert an active cascade on this node
    db.insert(cascades).values({
      nodeId,
      type: 'stop',
      status: 'in_progress',
    }).run();

    simulateTcpCheck(false);

    await checkAllInactivityRules(db, mockSseManager as any, mockDecryptFn);

    // Should NOT trigger cascade stop
    expect(mockExecuteCascadeStop).not.toHaveBeenCalled();
    // Should NOT broadcast auto-shutdown
    expect(mockSseManager.broadcast).not.toHaveBeenCalledWith('auto-shutdown', expect.anything());
    // Should log the skip
    const logs = getLogs();
    expect(logs.some((l) => l.message.includes('cascade déjà en cours'))).toBe(true);
  });

  it('should keep counter when cascade is already running (retry next tick - pending)', async () => {
    const nodeId = insertNode('Server1', 'physical');
    insertRule(nodeId, { timeoutMinutes: 1 });

    // Insert an active cascade
    db.insert(cascades).values({
      nodeId,
      type: 'stop',
      status: 'pending',
    }).run();

    simulateTcpCheck(false);

    await checkAllInactivityRules(db, mockSseManager as any, mockDecryptFn);

    // Counter should still be present (not cleared)
    expect(_getInactivityCounters().get(nodeId)).toBe(1);
  });
});

// Helper to insert a dependency link (fromNodeId "depends on" toNodeId)
function insertDependency(fromNodeId: string, toNodeId: string): void {
  db.insert(dependencyLinks).values({
    fromNodeId,
    toNodeId,
  }).run();
}

// ============================================================
// Story 5.2 Task 1: Vérification des dépendants actifs (AC #2)
// ============================================================

describe('checkAllInactivityRules — active dependent protection', () => {
  it('should cancel auto-shutdown when node has an active dependent', async () => {
    // Node A (the target for auto-shutdown)
    const nodeA = insertNode('ServerA', 'physical');
    insertRule(nodeA, { timeoutMinutes: 1 });

    // Node B depends on A, and B is online
    const nodeB = insertNode('DependentB', 'physical', { status: 'online' });
    insertDependency(nodeB, nodeA); // B depends on A

    simulateTcpCheck(false); // A is inactive

    await checkAllInactivityRules(db, mockSseManager as any, mockDecryptFn);

    // Should NOT trigger cascade stop — A has an active dependent (B)
    expect(mockExecuteCascadeStop).not.toHaveBeenCalled();
    // Counter should be reset to 0
    expect(_getInactivityCounters().get(nodeA)).toBe(0);
  });

  it('should NOT cancel auto-shutdown when all dependents are offline', async () => {
    // Node A (the target for auto-shutdown)
    const nodeA = insertNode('ServerA', 'physical');
    insertRule(nodeA, { timeoutMinutes: 1 });

    // Node B depends on A, but B is offline
    const nodeB = insertNode('DependentB', 'physical', { status: 'offline' });
    insertDependency(nodeB, nodeA); // B depends on A

    simulateTcpCheck(false); // A is inactive

    await checkAllInactivityRules(db, mockSseManager as any, mockDecryptFn);

    // Should trigger cascade stop — all dependents are offline
    expect(mockExecuteCascadeStop).toHaveBeenCalledTimes(1);
  });

  it('should log the cancellation reason with active dependent names', async () => {
    const nodeA = insertNode('ServerA', 'physical');
    insertRule(nodeA, { timeoutMinutes: 1 });

    const nodeB = insertNode('WebApp', 'vm', { status: 'online' });
    insertDependency(nodeB, nodeA); // WebApp depends on ServerA

    simulateTcpCheck(false);

    await checkAllInactivityRules(db, mockSseManager as any, mockDecryptFn);

    const logs = getLogs();
    const cancelLog = logs.find((l) =>
      l.source === 'inactivity-monitor' &&
      l.level === 'info' &&
      l.message.includes('annulé') &&
      l.message.includes('WebApp'),
    );
    expect(cancelLog).toBeDefined();
  });

  it('should reset counter to 0 when cancelling due to active dependent', async () => {
    const nodeA = insertNode('ServerA', 'physical');
    insertRule(nodeA, { timeoutMinutes: 1 });

    const nodeB = insertNode('DependentB', 'vm', { status: 'online' });
    insertDependency(nodeB, nodeA);

    // Set counter at timeout threshold
    _getInactivityCounters().set(nodeA, 0);

    simulateTcpCheck(false);

    await checkAllInactivityRules(db, mockSseManager as any, mockDecryptFn);

    // Counter should be reset to 0, not deleted or incremented
    expect(_getInactivityCounters().get(nodeA)).toBe(0);
    expect(mockExecuteCascadeStop).not.toHaveBeenCalled();
  });

  it('should proceed with shutdown when node has no dependents at all', async () => {
    const nodeA = insertNode('ServerA', 'physical');
    insertRule(nodeA, { timeoutMinutes: 1 });

    // No dependency links — node has no dependents
    simulateTcpCheck(false);

    await checkAllInactivityRules(db, mockSseManager as any, mockDecryptFn);

    // Should trigger cascade stop normally
    expect(mockExecuteCascadeStop).toHaveBeenCalledTimes(1);
  });
});

// ============================================================
// Story 5.2 Task 2: Test d'intégration protection deps partagées (AC #1)
// ============================================================

describe('checkAllInactivityRules — shared dependency integration test', () => {
  it('should trigger cascade stop on A while shared dep B is protected by cascade-engine', async () => {
    // Scenario: A depends on B, C depends on B (B is shared dependency)
    // Auto-shutdown triggered on A (no active dependents on A itself)
    // cascade-engine should protect B (tested in cascade-engine tests)
    // Here we verify the monitor correctly triggers the cascade for A

    const nodeB = insertNode('SharedDB', 'physical', { status: 'online' });
    const nodeA = insertNode('WebApp', 'physical');
    const nodeC = insertNode('APIService', 'physical', { status: 'online' });

    // A depends on B, C depends on B → B is a shared dependency
    insertDependency(nodeA, nodeB);
    insertDependency(nodeC, nodeB);

    // Only A has an inactivity rule
    insertRule(nodeA, { timeoutMinutes: 1 });

    simulateTcpCheck(false); // A is inactive

    await checkAllInactivityRules(db, mockSseManager as any, mockDecryptFn);

    // A has no dependents (nobody depends ON A) → cascade stop should fire
    expect(mockExecuteCascadeStop).toHaveBeenCalledTimes(1);
    expect(mockExecuteCascadeStop).toHaveBeenCalledWith(
      nodeA,
      expect.anything(), // db
      expect.objectContaining({
        cascadeId: expect.any(String),
      }),
    );

    // The cascade-engine's cleanupUpstream will handle B protection
    // (covered by cascade-engine unit tests — B has active dependent C)
  });

  it('should log the auto-shutdown trigger with correct shared dependency context', async () => {
    const nodeB = insertNode('SharedDB', 'physical', { status: 'online' });
    const nodeA = insertNode('WebApp', 'physical');
    const nodeC = insertNode('APIService', 'physical', { status: 'online' });

    insertDependency(nodeA, nodeB);
    insertDependency(nodeC, nodeB);
    insertRule(nodeA, { timeoutMinutes: 1 });

    simulateTcpCheck(false);

    await checkAllInactivityRules(db, mockSseManager as any, mockDecryptFn);

    // Verify the auto-shutdown log for A exists
    const logs = getLogs();
    const shutdownLog = logs.find((l) =>
      l.source === 'inactivity-monitor' &&
      l.message.includes('Arrêt automatique déclenché') &&
      l.message.includes('WebApp'),
    );
    expect(shutdownLog).toBeDefined();
  });
});

// ============================================================
// Story 5.3 Task 7.2: Tests checkNetworkConnections
// ============================================================

describe('checkAllInactivityRules — networkConnections check', () => {
  it('should consider node active when network connections found', async () => {
    const nodeId = insertNode('Server1', 'physical');
    insertRule(nodeId, {
      timeoutMinutes: 5,
      monitoringCriteria: { lastAccess: false, networkConnections: true, cpuRamActivity: false },
    });

    mockSshExecResult.stdout = [
      'Netid  State   Recv-Q  Send-Q   Local Address:Port   Peer Address:Port',
      'tcp    ESTAB   0       0        192.168.1.10:8096    192.168.1.5:41234',
    ].join('\n');

    await checkAllInactivityRules(db, mockSseManager as any, mockDecryptFn);

    expect(_getInactivityCounters().get(nodeId) ?? 0).toBe(0);
  });

  it('should consider node inactive when no network connections (excluding SSH)', async () => {
    const nodeId = insertNode('Server1', 'physical');
    insertRule(nodeId, {
      timeoutMinutes: 5,
      monitoringCriteria: { lastAccess: false, networkConnections: true, cpuRamActivity: false },
    });

    // Only SSH monitoring connection on port 22
    mockSshExecResult.stdout = [
      'Netid  State   Recv-Q  Send-Q   Local Address:Port   Peer Address:Port',
      'tcp    ESTAB   0       0        192.168.1.10:22      192.168.1.1:54321',
    ].join('\n');

    await checkAllInactivityRules(db, mockSseManager as any, mockDecryptFn);

    expect(_getInactivityCounters().get(nodeId)).toBe(1);
  });

  it('should return active (safe fallback) when no SSH credentials', async () => {
    const nodeId = insertNode('Server1', 'physical', { ipAddress: null, sshUser: null });
    insertRule(nodeId, {
      timeoutMinutes: 5,
      monitoringCriteria: { lastAccess: false, networkConnections: true, cpuRamActivity: false },
    });

    await checkAllInactivityRules(db, mockSseManager as any, mockDecryptFn);

    expect(_getInactivityCounters().get(nodeId) ?? 0).toBe(0);
  });

  it('should return active (safe fallback) when SSH connection fails', async () => {
    const nodeId = insertNode('Server1', 'physical');
    insertRule(nodeId, {
      timeoutMinutes: 5,
      monitoringCriteria: { lastAccess: false, networkConnections: true, cpuRamActivity: false },
    });

    mockSshConnectShouldFail.value = true;

    await checkAllInactivityRules(db, mockSseManager as any, mockDecryptFn);

    expect(_getInactivityCounters().get(nodeId) ?? 0).toBe(0);
  });
});

// ============================================================
// Story 5.3 Task 7.3: Tests checkCpuRamActivity
// ============================================================

describe('checkAllInactivityRules — cpuRamActivity check', () => {
  it('should consider node active when CPU load is high', async () => {
    const nodeId = insertNode('Server1', 'physical');
    insertRule(nodeId, {
      timeoutMinutes: 5,
      monitoringCriteria: { lastAccess: false, networkConnections: false, cpuRamActivity: true },
    });

    mockSshExecResult.stdout = [
      '0.75 0.45 0.51 1/234 56789',
      '              total        used        free      shared  buff/cache   available',
      'Mem:           7845        1000        5000         456        1845        6000',
      'Swap:          2047           0        2047',
    ].join('\n');

    await checkAllInactivityRules(db, mockSseManager as any, mockDecryptFn);

    expect(_getInactivityCounters().get(nodeId) ?? 0).toBe(0);
  });

  it('should consider node active when RAM usage is high', async () => {
    const nodeId = insertNode('Server1', 'physical');
    insertRule(nodeId, {
      timeoutMinutes: 5,
      monitoringCriteria: { lastAccess: false, networkConnections: false, cpuRamActivity: true },
    });

    mockSshExecResult.stdout = [
      '0.10 0.15 0.20 1/234 56789',
      '              total        used        free      shared  buff/cache   available',
      'Mem:           8000        5000        1000         500        2000        2500',
      'Swap:          2047           0        2047',
    ].join('\n');

    await checkAllInactivityRules(db, mockSseManager as any, mockDecryptFn);

    expect(_getInactivityCounters().get(nodeId) ?? 0).toBe(0);
  });

  it('should consider node inactive when CPU and RAM are idle', async () => {
    const nodeId = insertNode('Server1', 'physical');
    insertRule(nodeId, {
      timeoutMinutes: 5,
      monitoringCriteria: { lastAccess: false, networkConnections: false, cpuRamActivity: true },
    });

    mockSshExecResult.stdout = [
      '0.10 0.15 0.20 1/234 56789',
      '              total        used        free      shared  buff/cache   available',
      'Mem:           8000        2000        4000         500        1500        5500',
      'Swap:          2047           0        2047',
    ].join('\n');

    await checkAllInactivityRules(db, mockSseManager as any, mockDecryptFn);

    expect(_getInactivityCounters().get(nodeId)).toBe(1);
  });

  it('should return active (safe fallback) when no SSH credentials', async () => {
    const nodeId = insertNode('Server1', 'physical', { ipAddress: null, sshUser: null });
    insertRule(nodeId, {
      timeoutMinutes: 5,
      monitoringCriteria: { lastAccess: false, networkConnections: false, cpuRamActivity: true },
    });

    await checkAllInactivityRules(db, mockSseManager as any, mockDecryptFn);

    expect(_getInactivityCounters().get(nodeId) ?? 0).toBe(0);
  });

  it('should return active (safe fallback) when SSH connection fails', async () => {
    const nodeId = insertNode('Server1', 'physical');
    insertRule(nodeId, {
      timeoutMinutes: 5,
      monitoringCriteria: { lastAccess: false, networkConnections: false, cpuRamActivity: true },
    });

    mockSshConnectShouldFail.value = true;

    await checkAllInactivityRules(db, mockSseManager as any, mockDecryptFn);

    expect(_getInactivityCounters().get(nodeId) ?? 0).toBe(0);
  });

  it('should return active (safe fallback) when parsing fails', async () => {
    const nodeId = insertNode('Server1', 'physical');
    insertRule(nodeId, {
      timeoutMinutes: 5,
      monitoringCriteria: { lastAccess: false, networkConnections: false, cpuRamActivity: true },
    });

    // Garbage output that can't be parsed — NaN cpuLoad triggers safe fallback
    mockSshExecResult.stdout = 'totally invalid output';

    await checkAllInactivityRules(db, mockSseManager as any, mockDecryptFn);

    // Safe fallback: parsing failure → node considered active (never auto-shutdown on bad data)
    expect(_getInactivityCounters().get(nodeId) ?? 0).toBe(0);
  });
});

// ============================================================
// Story 5.3 Task 7.5: Test intégration multi-critères
// ============================================================

describe('checkAllInactivityRules — multi-criteria integration', () => {
  it('should consider node inactive only when ALL enabled criteria return inactive', async () => {
    const nodeId = insertNode('Server1', 'physical');
    insertRule(nodeId, {
      timeoutMinutes: 5,
      monitoringCriteria: {
        lastAccess: true,
        networkConnections: false,
        cpuRamActivity: true,
      },
    });

    // TCP unreachable → lastAccess inactive
    simulateTcpCheck(false);

    // CPU idle → cpuRamActivity inactive
    mockSshExecResult.stdout = [
      '0.10 0.15 0.20 1/234 56789',
      '              total        used        free      shared  buff/cache   available',
      'Mem:           8000        2000        4000         500        1500        5500',
      'Swap:          2047           0        2047',
    ].join('\n');

    await checkAllInactivityRules(db, mockSseManager as any, mockDecryptFn);

    // Both checks returned inactive → node is inactive
    expect(_getInactivityCounters().get(nodeId)).toBe(1);
  });
});

// ============================================================
// Story 5.3-refactor: Type-aware monitoring (platform API stats)
// ============================================================

describe('checkAllInactivityRules — type-aware monitoring', () => {
  it('VM (Proxmox): should use platform stats when CPU is high → active', async () => {
    const parentId = insertNode('ProxmoxHost', 'physical', {
      capabilities: { proxmox_api: { host: '10.0.0.1', port: 8006, authType: 'token' } },
    });
    const vmId = insertNode('MyVM', 'vm', {
      parentId,
      ipAddress: '10.0.0.10',
      sshUser: 'root',
      platformRef: { platform: 'proxmox', platformId: 'pve1/100', node: 'pve1', vmid: 100, type: 'qemu' },
    });
    insertRule(vmId, {
      timeoutMinutes: 5,
      monitoringCriteria: { lastAccess: false, networkConnections: false, cpuRamActivity: true },
    });

    // Platform connector returns high CPU
    mockGetStats.mockResolvedValueOnce({ cpuUsage: 0.8, ramUsage: 0.2 });
    mockGetConnector.mockReturnValue({ getStats: mockGetStats });

    await checkAllInactivityRules(db, mockSseManager as any, mockDecryptFn);

    expect(_getInactivityCounters().get(vmId) ?? 0).toBe(0); // active
    expect(mockGetConnector).toHaveBeenCalled();
  });

  it('VM (Proxmox): should detect inactivity when CPU and RAM are idle', async () => {
    const parentId = insertNode('ProxmoxHost', 'physical', {
      capabilities: { proxmox_api: { host: '10.0.0.1', port: 8006, authType: 'token' } },
    });
    const vmId = insertNode('MyVM', 'vm', {
      parentId,
      ipAddress: '10.0.0.10',
      sshUser: 'root',
      platformRef: { platform: 'proxmox', platformId: 'pve1/100', node: 'pve1', vmid: 100, type: 'qemu' },
    });
    insertRule(vmId, {
      timeoutMinutes: 5,
      monitoringCriteria: { lastAccess: false, networkConnections: false, cpuRamActivity: true },
    });

    // Platform connector returns idle stats
    mockGetStats.mockResolvedValueOnce({ cpuUsage: 0.1, ramUsage: 0.2 });
    mockGetConnector.mockReturnValue({ getStats: mockGetStats });

    await checkAllInactivityRules(db, mockSseManager as any, mockDecryptFn);

    expect(_getInactivityCounters().get(vmId)).toBe(1); // inactive
  });

  it('Docker container: should use platform stats for cpuRamActivity', async () => {
    const parentId = insertNode('DockerHost', 'physical', {
      capabilities: { docker_api: { host: '10.0.0.1', port: 2375 } },
    });
    const containerId = insertNode('MyContainer', 'container', {
      parentId,
      ipAddress: null,
      sshUser: null,
      platformRef: { platform: 'docker', platformId: 'abc123' },
    });
    insertRule(containerId, {
      timeoutMinutes: 5,
      monitoringCriteria: { lastAccess: false, networkConnections: false, cpuRamActivity: true },
    });

    // Platform connector returns high CPU
    mockGetStats.mockResolvedValueOnce({ cpuUsage: 0.7, ramUsage: 0.3 });
    mockGetConnector.mockReturnValue({ getStats: mockGetStats });

    await checkAllInactivityRules(db, mockSseManager as any, mockDecryptFn);

    expect(_getInactivityCounters().get(containerId) ?? 0).toBe(0); // active
  });

  it('Docker container: lastAccess should be skipped (no TCP 22)', async () => {
    const parentId = insertNode('DockerHost', 'physical', {
      capabilities: { docker_api: { host: '10.0.0.1', port: 2375 } },
    });
    const containerId = insertNode('MyContainer', 'container', {
      parentId,
      ipAddress: null,
      sshUser: null,
      platformRef: { platform: 'docker', platformId: 'abc123' },
    });
    insertRule(containerId, {
      timeoutMinutes: 5,
      // Only lastAccess enabled — should be skipped for container → no checks → active (safe fallback)
      monitoringCriteria: { lastAccess: true, networkConnections: false, cpuRamActivity: false },
    });

    mockGetConnector.mockReturnValue({});

    // TCP check would return false (unreachable), but should not be called for containers
    simulateTcpCheck(false);

    await checkAllInactivityRules(db, mockSseManager as any, mockDecryptFn);

    // Container with only lastAccess → skipped → no checks → active (safe fallback)
    expect(_getInactivityCounters().get(containerId) ?? 0).toBe(0);
  });

  it('VM/LXC: networkConnections should be skipped (safe fallback)', async () => {
    const parentId = insertNode('ProxmoxHost', 'physical', {
      capabilities: { proxmox_api: { host: '10.0.0.1', port: 8006, authType: 'token' } },
    });
    const vmId = insertNode('MyVM', 'vm', {
      parentId,
      ipAddress: '10.0.0.10',
      sshUser: 'root',
      platformRef: { platform: 'proxmox', platformId: 'pve1/100', node: 'pve1', vmid: 100, type: 'qemu' },
    });
    insertRule(vmId, {
      timeoutMinutes: 5,
      // Only networkConnections enabled — should be skipped for VM
      monitoringCriteria: { lastAccess: false, networkConnections: true, cpuRamActivity: false },
    });

    mockGetConnector.mockReturnValue({});

    await checkAllInactivityRules(db, mockSseManager as any, mockDecryptFn);

    // VM with only networkConnections → skipped → no checks → active (safe fallback)
    expect(_getInactivityCounters().get(vmId) ?? 0).toBe(0);
  });

  it('should fallback to SSH when getStats returns null', async () => {
    const parentId = insertNode('ProxmoxHost', 'physical', {
      capabilities: { proxmox_api: { host: '10.0.0.1', port: 8006, authType: 'token' } },
    });
    const vmId = insertNode('MyVM', 'vm', {
      parentId,
      ipAddress: '10.0.0.10',
      sshUser: 'root',
      platformRef: { platform: 'proxmox', platformId: 'pve1/100', node: 'pve1', vmid: 100, type: 'qemu' },
    });
    insertRule(vmId, {
      timeoutMinutes: 5,
      monitoringCriteria: { lastAccess: false, networkConnections: false, cpuRamActivity: true },
    });

    // Platform connector returns null (error)
    mockGetStats.mockResolvedValueOnce(null);
    mockGetConnector.mockReturnValue({ getStats: mockGetStats });

    // SSH fallback should be used — simulate high CPU via SSH
    mockSshExecResult.stdout = [
      '0.75 0.45 0.51 1/234 56789',
      '              total        used        free      shared  buff/cache   available',
      'Mem:           7845        1000        5000         456        1845        6000',
      'Swap:          2047           0        2047',
    ].join('\n');

    await checkAllInactivityRules(db, mockSseManager as any, mockDecryptFn);

    // SSH fallback detected high CPU → active
    expect(_getInactivityCounters().get(vmId) ?? 0).toBe(0);
  });

  it('should handle connector creation failure gracefully (fallback to SSH)', async () => {
    const parentId = insertNode('ProxmoxHost', 'physical', {
      capabilities: { proxmox_api: { host: '10.0.0.1', port: 8006, authType: 'token' } },
    });
    const vmId = insertNode('MyVM', 'vm', {
      parentId,
      ipAddress: '10.0.0.10',
      sshUser: 'root',
      platformRef: { platform: 'proxmox', platformId: 'pve1/100', node: 'pve1', vmid: 100, type: 'qemu' },
    });
    insertRule(vmId, {
      timeoutMinutes: 5,
      monitoringCriteria: { lastAccess: false, networkConnections: false, cpuRamActivity: true },
    });

    // getConnector throws
    mockGetConnector.mockImplementation(() => { throw new Error('No connector'); });

    // SSH fallback — low CPU → inactive
    mockSshExecResult.stdout = [
      '0.10 0.15 0.20 1/234 56789',
      '              total        used        free      shared  buff/cache   available',
      'Mem:           8000        2000        4000         500        1500        5500',
      'Swap:          2047           0        2047',
    ].join('\n');

    await checkAllInactivityRules(db, mockSseManager as any, mockDecryptFn);

    // SSH fallback detected idle → inactive
    expect(_getInactivityCounters().get(vmId)).toBe(1);
  });

  it('physical node: should still use SSH checks (no platform stats)', async () => {
    const nodeId = insertNode('PhysicalServer', 'physical');
    insertRule(nodeId, {
      timeoutMinutes: 5,
      monitoringCriteria: { lastAccess: false, networkConnections: false, cpuRamActivity: true },
    });

    // High CPU via SSH
    mockSshExecResult.stdout = [
      '0.75 0.45 0.51 1/234 56789',
      '              total        used        free      shared  buff/cache   available',
      'Mem:           7845        1000        5000         456        1845        6000',
      'Swap:          2047           0        2047',
    ].join('\n');

    await checkAllInactivityRules(db, mockSseManager as any, mockDecryptFn);

    // Should NOT call getConnector for physical nodes
    expect(mockGetConnector).not.toHaveBeenCalled();
    expect(_getInactivityCounters().get(nodeId) ?? 0).toBe(0); // active via SSH
  });

  it('should batch-load parents for multiple nodes', async () => {
    const parentId = insertNode('ProxmoxHost', 'physical', {
      capabilities: { proxmox_api: { host: '10.0.0.1', port: 8006, authType: 'token' } },
    });
    const vm1 = insertNode('VM1', 'vm', {
      parentId,
      ipAddress: '10.0.0.10',
      sshUser: 'root',
      platformRef: { platform: 'proxmox', platformId: 'pve1/100', node: 'pve1', vmid: 100, type: 'qemu' },
    });
    const vm2 = insertNode('VM2', 'vm', {
      parentId,
      ipAddress: '10.0.0.11',
      sshUser: 'root',
      platformRef: { platform: 'proxmox', platformId: 'pve1/101', node: 'pve1', vmid: 101, type: 'qemu' },
    });
    insertRule(vm1, {
      timeoutMinutes: 5,
      monitoringCriteria: { lastAccess: false, networkConnections: false, cpuRamActivity: true },
    });
    insertRule(vm2, {
      timeoutMinutes: 5,
      monitoringCriteria: { lastAccess: false, networkConnections: false, cpuRamActivity: true },
    });

    // Both VMs get stats via platform
    mockGetStats.mockResolvedValue({ cpuUsage: 0.8, ramUsage: 0.2 });
    mockGetConnector.mockReturnValue({ getStats: mockGetStats });

    await checkAllInactivityRules(db, mockSseManager as any, mockDecryptFn);

    // Both nodes should be active
    expect(_getInactivityCounters().get(vm1) ?? 0).toBe(0);
    expect(_getInactivityCounters().get(vm2) ?? 0).toBe(0);
    // getConnector called for each VM
    expect(mockGetConnector).toHaveBeenCalledTimes(2);
  });

  it('VM: lastAccess (TCP) should still work', async () => {
    const parentId = insertNode('ProxmoxHost', 'physical', {
      capabilities: { proxmox_api: { host: '10.0.0.1', port: 8006, authType: 'token' } },
    });
    const vmId = insertNode('MyVM', 'vm', {
      parentId,
      ipAddress: '10.0.0.10',
      sshUser: 'root',
      platformRef: { platform: 'proxmox', platformId: 'pve1/100', node: 'pve1', vmid: 100, type: 'qemu' },
    });
    insertRule(vmId, {
      timeoutMinutes: 5,
      monitoringCriteria: { lastAccess: true, networkConnections: false, cpuRamActivity: false },
    });

    mockGetConnector.mockReturnValue({});

    // TCP reachable → active
    simulateTcpCheck(true);

    await checkAllInactivityRules(db, mockSseManager as any, mockDecryptFn);

    expect(_getInactivityCounters().get(vmId) ?? 0).toBe(0);
  });

  // ============================================================
  // Story 5.3 Task 9: lastAccess fallback for Docker containers (AC #6)
  // ============================================================

  it('Docker container: lastAccess with platformStats CPU high → active', async () => {
    const parentId = insertNode('DockerHost', 'physical', {
      capabilities: { docker_api: { host: '10.0.0.1', port: 2375 } },
    });
    const containerId = insertNode('Jellyfin', 'container', {
      parentId,
      ipAddress: null,
      sshUser: null,
      platformRef: { platform: 'docker', platformId: 'abc123' },
    });
    insertRule(containerId, {
      timeoutMinutes: 5,
      monitoringCriteria: { lastAccess: true, networkConnections: false, cpuRamActivity: false },
    });

    // Platform connector returns high CPU
    mockGetStats.mockResolvedValueOnce({ cpuUsage: 0.8, ramUsage: 0.2 });
    mockGetConnector.mockReturnValue({ getStats: mockGetStats });

    simulateTcpCheck(false); // TCP check would fail, but should not be used for containers

    await checkAllInactivityRules(db, mockSseManager as any, mockDecryptFn);

    // Container with lastAccess + high CPU platformStats → active (counter = 0)
    expect(_getInactivityCounters().get(containerId) ?? 0).toBe(0);
  });

  it('Docker container: lastAccess with platformStats CPU/RAM low → inactive', async () => {
    const parentId = insertNode('DockerHost', 'physical', {
      capabilities: { docker_api: { host: '10.0.0.1', port: 2375 } },
    });
    const containerId = insertNode('Jellyfin', 'container', {
      parentId,
      ipAddress: null,
      sshUser: null,
      platformRef: { platform: 'docker', platformId: 'abc123' },
    });
    insertRule(containerId, {
      timeoutMinutes: 5,
      monitoringCriteria: { lastAccess: true, networkConnections: false, cpuRamActivity: false },
    });

    // Platform connector returns idle stats
    mockGetStats.mockResolvedValueOnce({ cpuUsage: 0.1, ramUsage: 0.2 });
    mockGetConnector.mockReturnValue({ getStats: mockGetStats });

    await checkAllInactivityRules(db, mockSseManager as any, mockDecryptFn);

    // Container with lastAccess + low CPU/RAM → inactive (counter incremented)
    expect(_getInactivityCounters().get(containerId)).toBe(1);
  });

  it('Docker container: lastAccess with platformStats null → safe fallback active', async () => {
    const parentId = insertNode('DockerHost', 'physical', {
      capabilities: { docker_api: { host: '10.0.0.1', port: 2375 } },
    });
    const containerId = insertNode('Jellyfin', 'container', {
      parentId,
      ipAddress: null,
      sshUser: null,
      platformRef: { platform: 'docker', platformId: 'abc123' },
    });
    insertRule(containerId, {
      timeoutMinutes: 5,
      monitoringCriteria: { lastAccess: true, networkConnections: false, cpuRamActivity: false },
    });

    // Platform connector returns null (error)
    mockGetStats.mockResolvedValueOnce(null);
    mockGetConnector.mockReturnValue({ getStats: mockGetStats });

    await checkAllInactivityRules(db, mockSseManager as any, mockDecryptFn);

    // Container with lastAccess + no platformStats → no checks → safe fallback active
    expect(_getInactivityCounters().get(containerId) ?? 0).toBe(0);
  });

});

// ============================================================
// Story 5.5: Configurable CPU/RAM thresholds
// ============================================================

describe('checkAllInactivityRules — configurable thresholds', () => {
  it('should use custom CPU threshold from rule (physical, SSH)', async () => {
    const nodeId = insertNode('Server1', 'physical');
    insertRule(nodeId, {
      timeoutMinutes: 5,
      monitoringCriteria: { lastAccess: false, networkConnections: false, cpuRamActivity: true, cpuThreshold: 0.3, ramThreshold: 0.9 },
    });

    // CPU 0.35 > custom threshold 0.3 → active
    mockSshExecResult.stdout = [
      '0.35 0.20 0.15 1/234 56789',
      '              total        used        free      shared  buff/cache   available',
      'Mem:           8000        1000        5000         500        1500        6500',
      'Swap:          2047           0        2047',
    ].join('\n');

    await checkAllInactivityRules(db, mockSseManager as any, mockDecryptFn);

    // CPU 0.35 > 0.3 → active
    expect(_getInactivityCounters().get(nodeId) ?? 0).toBe(0);
  });

  it('should detect inactivity with strict CPU threshold (physical, SSH)', async () => {
    const nodeId = insertNode('Server1', 'physical');
    insertRule(nodeId, {
      timeoutMinutes: 5,
      monitoringCriteria: { lastAccess: false, networkConnections: false, cpuRamActivity: true, cpuThreshold: 0.9, ramThreshold: 0.9 },
    });

    // CPU 0.75 < strict threshold 0.9, RAM 12.7% < 0.9 → inactive
    mockSshExecResult.stdout = [
      '0.75 0.45 0.51 1/234 56789',
      '              total        used        free      shared  buff/cache   available',
      'Mem:           7845        1000        5000         456        1845        6000',
      'Swap:          2047           0        2047',
    ].join('\n');

    await checkAllInactivityRules(db, mockSseManager as any, mockDecryptFn);

    // CPU 0.75 < 0.9 AND RAM ~12.7% < 0.9 → inactive
    expect(_getInactivityCounters().get(nodeId)).toBe(1);
  });

  it('should use custom RAM threshold from rule (physical, SSH)', async () => {
    const nodeId = insertNode('Server1', 'physical');
    insertRule(nodeId, {
      timeoutMinutes: 5,
      monitoringCriteria: { lastAccess: false, networkConnections: false, cpuRamActivity: true, cpuThreshold: 0.9, ramThreshold: 0.2 },
    });

    // CPU 0.10 < 0.9, RAM 2000/8000 = 0.25 > custom threshold 0.2 → active
    mockSshExecResult.stdout = [
      '0.10 0.15 0.20 1/234 56789',
      '              total        used        free      shared  buff/cache   available',
      'Mem:           8000        2000        4000         500        1500        5500',
      'Swap:          2047           0        2047',
    ].join('\n');

    await checkAllInactivityRules(db, mockSseManager as any, mockDecryptFn);

    // RAM 0.25 > 0.2 → active
    expect(_getInactivityCounters().get(nodeId) ?? 0).toBe(0);
  });

  it('should use default thresholds (0.5) when not specified in rule', async () => {
    const nodeId = insertNode('Server1', 'physical');
    insertRule(nodeId, {
      timeoutMinutes: 5,
      // No cpuThreshold/ramThreshold → defaults to 0.5
      monitoringCriteria: { lastAccess: false, networkConnections: false, cpuRamActivity: true },
    });

    // CPU 0.45 < default 0.5, RAM 1000/8000 = 0.125 < 0.5 → inactive
    mockSshExecResult.stdout = [
      '0.45 0.30 0.25 1/234 56789',
      '              total        used        free      shared  buff/cache   available',
      'Mem:           8000        1000        5000         500        1500        6500',
      'Swap:          2047           0        2047',
    ].join('\n');

    await checkAllInactivityRules(db, mockSseManager as any, mockDecryptFn);

    // Both below default 0.5 → inactive
    expect(_getInactivityCounters().get(nodeId)).toBe(1);
  });

  it('VM (Proxmox): should use custom thresholds with platform stats', async () => {
    const parentId = insertNode('ProxmoxHost', 'physical', {
      capabilities: { proxmox_api: { host: '10.0.0.1', port: 8006, authType: 'token' } },
    });
    const vmId = insertNode('MyVM', 'vm', {
      parentId,
      ipAddress: '10.0.0.10',
      sshUser: 'root',
      platformRef: { platform: 'proxmox', platformId: 'pve1/100', node: 'pve1', vmid: 100, type: 'qemu' },
    });
    insertRule(vmId, {
      timeoutMinutes: 5,
      monitoringCriteria: { lastAccess: false, networkConnections: false, cpuRamActivity: true, cpuThreshold: 0.3, ramThreshold: 0.3 },
    });

    // CPU 0.2 < 0.3, RAM 0.2 < 0.3 → inactive with custom thresholds
    mockGetStats.mockResolvedValueOnce({ cpuUsage: 0.2, ramUsage: 0.2 });
    mockGetConnector.mockReturnValue({ getStats: mockGetStats });

    await checkAllInactivityRules(db, mockSseManager as any, mockDecryptFn);

    expect(_getInactivityCounters().get(vmId)).toBe(1);
  });

  it('Docker container: should use custom thresholds for lastAccess fallback', async () => {
    const parentId = insertNode('DockerHost', 'physical', {
      capabilities: { docker_api: { host: '10.0.0.1', port: 2375 } },
    });
    const containerId = insertNode('Jellyfin', 'container', {
      parentId,
      ipAddress: null,
      sshUser: null,
      platformRef: { platform: 'docker', platformId: 'abc123' },
    });
    insertRule(containerId, {
      timeoutMinutes: 5,
      monitoringCriteria: { lastAccess: true, networkConnections: false, cpuRamActivity: false, cpuThreshold: 0.05, ramThreshold: 0.05 },
    });

    // CPU 0.1 > custom 0.05 → active
    mockGetStats.mockResolvedValueOnce({ cpuUsage: 0.1, ramUsage: 0.01 });
    mockGetConnector.mockReturnValue({ getStats: mockGetStats });

    simulateTcpCheck(false);

    await checkAllInactivityRules(db, mockSseManager as any, mockDecryptFn);

    // CPU 0.1 > 0.05 → active
    expect(_getInactivityCounters().get(containerId) ?? 0).toBe(0);
  });
});

// ============================================================
// Story 7.1: networkTraffic check (delta trafic Docker)
// ============================================================

describe('checkAllInactivityRules — networkTraffic check', () => {
  it('should consider container active on first tick (safe fallback, no previous data)', async () => {
    const parentId = insertNode('DockerHost', 'physical', {
      capabilities: { docker_api: { host: '10.0.0.1', port: 2375 } },
    });
    const containerId = insertNode('MyContainer', 'container', {
      parentId,
      ipAddress: null,
      sshUser: null,
      platformRef: { platform: 'docker', platformId: 'abc123' },
    });
    insertRule(containerId, {
      timeoutMinutes: 5,
      monitoringCriteria: { lastAccess: false, networkConnections: false, cpuRamActivity: false, networkTraffic: true },
    });

    // Platform connector returns stats with network bytes
    mockGetStats.mockResolvedValueOnce({ cpuUsage: 0.1, ramUsage: 0.1, rxBytes: 5000, txBytes: 3000 });
    mockGetConnector.mockReturnValue({ getStats: mockGetStats });

    await checkAllInactivityRules(db, mockSseManager as any, mockDecryptFn);

    // First tick → safe fallback → active (counter = 0)
    expect(_getInactivityCounters().get(containerId) ?? 0).toBe(0);
    // Cache should have the current bytes stored
    expect(_getNetworkTrafficCache().get(containerId)).toEqual({ rxBytes: 5000, txBytes: 3000 });
  });

  it('should consider container active when delta > threshold', async () => {
    const parentId = insertNode('DockerHost', 'physical', {
      capabilities: { docker_api: { host: '10.0.0.1', port: 2375 } },
    });
    const containerId = insertNode('MyContainer', 'container', {
      parentId,
      ipAddress: null,
      sshUser: null,
      platformRef: { platform: 'docker', platformId: 'abc123' },
    });
    insertRule(containerId, {
      timeoutMinutes: 5,
      monitoringCriteria: { lastAccess: false, networkConnections: false, cpuRamActivity: false, networkTraffic: true },
    });

    // Seed cache with previous values
    _getNetworkTrafficCache().set(containerId, { rxBytes: 5000, txBytes: 3000 });

    // Current stats: rx + tx = 10000 + 5000 = 15000, previous = 5000 + 3000 = 8000, delta = 7000 > 1024
    mockGetStats.mockResolvedValueOnce({ cpuUsage: 0.1, ramUsage: 0.1, rxBytes: 10000, txBytes: 5000 });
    mockGetConnector.mockReturnValue({ getStats: mockGetStats });

    await checkAllInactivityRules(db, mockSseManager as any, mockDecryptFn);

    // Delta > threshold → active
    expect(_getInactivityCounters().get(containerId) ?? 0).toBe(0);
  });

  it('should consider container inactive when delta <= threshold', async () => {
    const parentId = insertNode('DockerHost', 'physical', {
      capabilities: { docker_api: { host: '10.0.0.1', port: 2375 } },
    });
    const containerId = insertNode('MyContainer', 'container', {
      parentId,
      ipAddress: null,
      sshUser: null,
      platformRef: { platform: 'docker', platformId: 'abc123' },
    });
    insertRule(containerId, {
      timeoutMinutes: 5,
      monitoringCriteria: { lastAccess: false, networkConnections: false, cpuRamActivity: false, networkTraffic: true },
    });

    // Seed cache with previous values
    _getNetworkTrafficCache().set(containerId, { rxBytes: 5000, txBytes: 3000 });

    // Current stats: rx + tx = 5500 + 3200 = 8700, previous = 5000 + 3000 = 8000, delta = 700 <= 1024
    mockGetStats.mockResolvedValueOnce({ cpuUsage: 0.1, ramUsage: 0.1, rxBytes: 5500, txBytes: 3200 });
    mockGetConnector.mockReturnValue({ getStats: mockGetStats });

    await checkAllInactivityRules(db, mockSseManager as any, mockDecryptFn);

    // Delta <= threshold → inactive
    expect(_getInactivityCounters().get(containerId)).toBe(1);
  });

  it('should use custom networkTrafficThreshold when specified', async () => {
    const parentId = insertNode('DockerHost', 'physical', {
      capabilities: { docker_api: { host: '10.0.0.1', port: 2375 } },
    });
    const containerId = insertNode('MyContainer', 'container', {
      parentId,
      ipAddress: null,
      sshUser: null,
      platformRef: { platform: 'docker', platformId: 'abc123' },
    });
    insertRule(containerId, {
      timeoutMinutes: 5,
      monitoringCriteria: { lastAccess: false, networkConnections: false, cpuRamActivity: false, networkTraffic: true, networkTrafficThreshold: 10000 },
    });

    // Seed cache
    _getNetworkTrafficCache().set(containerId, { rxBytes: 5000, txBytes: 3000 });

    // Delta = 7000, custom threshold = 10000 → 7000 <= 10000 → inactive
    mockGetStats.mockResolvedValueOnce({ cpuUsage: 0.1, ramUsage: 0.1, rxBytes: 10000, txBytes: 5000 });
    mockGetConnector.mockReturnValue({ getStats: mockGetStats });

    await checkAllInactivityRules(db, mockSseManager as any, mockDecryptFn);

    expect(_getInactivityCounters().get(containerId)).toBe(1);
  });

  it('should skip networkTraffic check for physical nodes', async () => {
    const nodeId = insertNode('Server1', 'physical');
    insertRule(nodeId, {
      timeoutMinutes: 5,
      monitoringCriteria: { lastAccess: false, networkConnections: false, cpuRamActivity: false, networkTraffic: true },
    });

    await checkAllInactivityRules(db, mockSseManager as any, mockDecryptFn);

    // Physical node with only networkTraffic → skipped → no checks → active (safe fallback)
    expect(_getInactivityCounters().get(nodeId) ?? 0).toBe(0);
  });

  it('should clean up networkTrafficCache when node is no longer active', async () => {
    const nodeId = insertNode('Server1', 'physical', { status: 'offline' });
    insertRule(nodeId, { timeoutMinutes: 5, isEnabled: true });

    // Seed both caches
    _getInactivityCounters().set(nodeId, 3);
    _getNetworkTrafficCache().set(nodeId, { rxBytes: 1000, txBytes: 500 });

    // Create an active node so the cleanup runs
    const activeId = insertNode('ActiveServer', 'physical');
    insertRule(activeId, { timeoutMinutes: 5 });
    simulateTcpCheck(true);

    await checkAllInactivityRules(db, mockSseManager as any, mockDecryptFn);

    // Offline node's cache entries should be cleaned up
    expect(_getNetworkTrafficCache().has(nodeId)).toBe(false);
    expect(_getInactivityCounters().has(nodeId)).toBe(false);
  });

  it('should consider container active on counter reset (negative delta, e.g. Docker restart)', async () => {
    const parentId = insertNode('DockerHost', 'physical', {
      capabilities: { docker_api: { host: '10.0.0.1', port: 2375 } },
    });
    const containerId = insertNode('MyContainer', 'container', {
      parentId,
      ipAddress: null,
      sshUser: null,
      platformRef: { platform: 'docker', platformId: 'abc123' },
    });
    insertRule(containerId, {
      timeoutMinutes: 5,
      monitoringCriteria: { lastAccess: false, networkConnections: false, cpuRamActivity: false, networkTraffic: true },
    });

    // Seed cache with high previous values (before Docker restart)
    _getNetworkTrafficCache().set(containerId, { rxBytes: 50000, txBytes: 30000 });

    // After Docker restart: counters reset to 0
    mockGetStats.mockResolvedValueOnce({ cpuUsage: 0.1, ramUsage: 0.1, rxBytes: 100, txBytes: 50 });
    mockGetConnector.mockReturnValue({ getStats: mockGetStats });

    await checkAllInactivityRules(db, mockSseManager as any, mockDecryptFn);

    // Negative delta → safe fallback → active (counter = 0)
    expect(_getInactivityCounters().get(containerId) ?? 0).toBe(0);
  });

  // ============================================================
  // Story 7.2: networkTraffic for VM/LXC (Proxmox rrddata)
  // ============================================================

  it('VM: should consider active when networkTraffic delta > threshold', async () => {
    const parentId = insertNode('ProxmoxHost', 'physical', {
      capabilities: { proxmox_api: { host: '10.0.0.1', port: 8006, authType: 'token' } },
    });
    const vmId = insertNode('MyVM', 'vm', {
      parentId,
      ipAddress: '10.0.0.10',
      sshUser: 'root',
      platformRef: { platform: 'proxmox', platformId: 'pve1/100', node: 'pve1', vmid: 100, type: 'qemu' },
    });
    insertRule(vmId, {
      timeoutMinutes: 5,
      monitoringCriteria: { lastAccess: false, networkConnections: false, cpuRamActivity: false, networkTraffic: true },
    });

    // Seed cache with previous values
    _getNetworkTrafficCache().set(vmId, { rxBytes: 5000, txBytes: 3000 });

    // Delta = (10000 + 5000) - (5000 + 3000) = 7000 > 1024
    mockGetStats.mockResolvedValueOnce({ cpuUsage: 0.1, ramUsage: 0.1, rxBytes: 10000, txBytes: 5000 });
    mockGetConnector.mockReturnValue({ getStats: mockGetStats });

    await checkAllInactivityRules(db, mockSseManager as any, mockDecryptFn);

    expect(_getInactivityCounters().get(vmId) ?? 0).toBe(0); // active
  });

  it('VM: should consider inactive when networkTraffic delta <= threshold', async () => {
    const parentId = insertNode('ProxmoxHost', 'physical', {
      capabilities: { proxmox_api: { host: '10.0.0.1', port: 8006, authType: 'token' } },
    });
    const vmId = insertNode('MyVM', 'vm', {
      parentId,
      ipAddress: '10.0.0.10',
      sshUser: 'root',
      platformRef: { platform: 'proxmox', platformId: 'pve1/100', node: 'pve1', vmid: 100, type: 'qemu' },
    });
    insertRule(vmId, {
      timeoutMinutes: 5,
      monitoringCriteria: { lastAccess: false, networkConnections: false, cpuRamActivity: false, networkTraffic: true },
    });

    // Seed cache with previous values
    _getNetworkTrafficCache().set(vmId, { rxBytes: 5000, txBytes: 3000 });

    // Delta = (5500 + 3200) - (5000 + 3000) = 700 <= 1024
    mockGetStats.mockResolvedValueOnce({ cpuUsage: 0.1, ramUsage: 0.1, rxBytes: 5500, txBytes: 3200 });
    mockGetConnector.mockReturnValue({ getStats: mockGetStats });

    await checkAllInactivityRules(db, mockSseManager as any, mockDecryptFn);

    expect(_getInactivityCounters().get(vmId)).toBe(1); // inactive
  });

  it('VM: should consider active on first tick (safe fallback, no previous data)', async () => {
    const parentId = insertNode('ProxmoxHost', 'physical', {
      capabilities: { proxmox_api: { host: '10.0.0.1', port: 8006, authType: 'token' } },
    });
    const vmId = insertNode('MyVM', 'vm', {
      parentId,
      ipAddress: '10.0.0.10',
      sshUser: 'root',
      platformRef: { platform: 'proxmox', platformId: 'pve1/100', node: 'pve1', vmid: 100, type: 'qemu' },
    });
    insertRule(vmId, {
      timeoutMinutes: 5,
      monitoringCriteria: { lastAccess: false, networkConnections: false, cpuRamActivity: false, networkTraffic: true },
    });

    // No cache seeded → first tick
    mockGetStats.mockResolvedValueOnce({ cpuUsage: 0.1, ramUsage: 0.1, rxBytes: 5000, txBytes: 3000 });
    mockGetConnector.mockReturnValue({ getStats: mockGetStats });

    await checkAllInactivityRules(db, mockSseManager as any, mockDecryptFn);

    expect(_getInactivityCounters().get(vmId) ?? 0).toBe(0); // active (safe fallback)
    expect(_getNetworkTrafficCache().get(vmId)).toEqual({ rxBytes: 5000, txBytes: 3000 });
  });

  it('LXC: should consider active when networkTraffic delta > threshold', async () => {
    const parentId = insertNode('ProxmoxHost', 'physical', {
      capabilities: { proxmox_api: { host: '10.0.0.1', port: 8006, authType: 'token' } },
    });
    const lxcId = insertNode('MyLXC', 'lxc', {
      parentId,
      ipAddress: '10.0.0.20',
      sshUser: 'root',
      platformRef: { platform: 'proxmox', platformId: 'pve1/200', node: 'pve1', vmid: 200, type: 'lxc' },
    });
    insertRule(lxcId, {
      timeoutMinutes: 5,
      monitoringCriteria: { lastAccess: false, networkConnections: false, cpuRamActivity: false, networkTraffic: true },
    });

    // Seed cache with previous values
    _getNetworkTrafficCache().set(lxcId, { rxBytes: 5000, txBytes: 3000 });

    // Delta = (10000 + 5000) - (5000 + 3000) = 7000 > 1024
    mockGetStats.mockResolvedValueOnce({ cpuUsage: 0.1, ramUsage: 0.1, rxBytes: 10000, txBytes: 5000 });
    mockGetConnector.mockReturnValue({ getStats: mockGetStats });

    await checkAllInactivityRules(db, mockSseManager as any, mockDecryptFn);

    expect(_getInactivityCounters().get(lxcId) ?? 0).toBe(0); // active
  });

  it('should clear networkTrafficCache on stopInactivityMonitor', () => {
    vi.useFakeTimers();
    startInactivityMonitor(db, mockSseManager as any, mockDecryptFn);
    _getNetworkTrafficCache().set('test-node', { rxBytes: 1000, txBytes: 500 });
    stopInactivityMonitor();
    expect(_getNetworkTrafficCache().size).toBe(0);
    vi.useRealTimers();
  });
});
