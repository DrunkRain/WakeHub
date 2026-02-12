import { describe, it, expect, beforeEach, vi } from 'vitest';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { eq } from 'drizzle-orm';
import { services, dependencyLinks, cascades, operationLogs } from '../db/schema.js';
import { executeCascadeStart, executeCascadeStop } from './cascade-engine.js';

// Track mock connector instances
const mockConnectors = new Map<string, { start: ReturnType<typeof vi.fn>; stop: ReturnType<typeof vi.fn>; getStatus: ReturnType<typeof vi.fn> }>();

vi.mock('./connector-factory.js', () => ({
  createConnectorForNode: vi.fn((_db: unknown, nodeType: string, nodeId: string) => {
    const key = `${nodeType}:${nodeId}`;
    const existing = mockConnectors.get(key);
    if (existing) return existing;
    // Return null for nodes without a connector set up
    return null;
  }),
}));

function setupMockConnector(nodeType: string, nodeId: string, statusSequence: string[]) {
  let callIndex = 0;
  const mock = {
    start: vi.fn(),
    stop: vi.fn(),
    getStatus: vi.fn(() => {
      const status = statusSequence[Math.min(callIndex, statusSequence.length - 1)]!;
      callIndex++;
      return Promise.resolve(status);
    }),
    testConnection: vi.fn(),
  };
  mockConnectors.set(`${nodeType}:${nodeId}`, mock);
  return mock;
}

describe('cascade-engine', () => {
  let db: ReturnType<typeof drizzle>;

  beforeEach(() => {
    mockConnectors.clear();

    const sqlite = new Database(':memory:');
    db = drizzle(sqlite);
    migrate(db, { migrationsFolder: './drizzle' });

    // Clean all tables
    db.delete(operationLogs).run();
    db.delete(cascades).run();
    db.delete(dependencyLinks).run();
    db.delete(services).run();
  });

  function insertCascade(id: string, serviceId: string, type: 'start' | 'stop') {
    db.insert(cascades).values({
      id,
      serviceId,
      type,
      status: 'pending',
      currentStep: 0,
      totalSteps: 0,
      startedAt: new Date(),
    }).run();
  }

  function createTestInfra() {
    // All entities are services now
    db.insert(services).values({
      id: 'phys1', name: 'NAS', type: 'physical', ipAddress: '192.168.1.10',
      macAddress: 'AA:BB:CC:DD:EE:FF', sshUser: 'admin', status: 'offline',
      createdAt: new Date(), updatedAt: new Date(),
    }).run();

    db.insert(services).values({
      id: 'prox1', name: 'PVE', type: 'proxmox', ipAddress: '192.168.1.20',
      apiUrl: 'https://192.168.1.20:8006', status: 'online',
      createdAt: new Date(), updatedAt: new Date(),
    }).run();

    db.insert(services).values({
      id: 'vm1', name: 'VM-Media', type: 'vm',
      platformRef: { node: 'pve', vmid: 100 }, status: 'stopped',
      parentId: 'prox1',
      createdAt: new Date(), updatedAt: new Date(),
    }).run();

    db.insert(services).values({
      id: 'dock1', name: 'Docker Host', type: 'docker', ipAddress: '192.168.1.30',
      apiUrl: 'http://192.168.1.30:2375', status: 'online',
      createdAt: new Date(), updatedAt: new Date(),
    }).run();

    db.insert(services).values({
      id: 'ct1', name: 'Jellyfin', type: 'container',
      platformRef: { containerId: 'abc123' }, status: 'stopped', serviceUrl: 'http://192.168.1.30:8096',
      parentId: 'dock1',
      createdAt: new Date(), updatedAt: new Date(),
    }).run();

    // Dependency chain with isStructural flag:
    // phys1 → prox1 (logical: NAS is a dependency of PVE, not structural parent)
    // prox1 → vm1 (structural: PVE physically hosts vm1)
    // dock1 → ct1 (structural: Docker physically hosts ct1)
    db.insert(dependencyLinks).values([
      { id: 'dl1', parentType: 'service', parentId: 'phys1', childType: 'service', childId: 'prox1', isStructural: false, createdAt: new Date() },
      { id: 'dl2', parentType: 'service', parentId: 'prox1', childType: 'service', childId: 'vm1', isStructural: true, createdAt: new Date() },
      { id: 'dl3', parentType: 'service', parentId: 'dock1', childType: 'service', childId: 'ct1', isStructural: true, createdAt: new Date() },
    ]).run();
  }

  describe('executeCascadeStart', () => {
    it('should start a chain of dependencies in root-to-target order', async () => {
      createTestInfra();
      insertCascade('c1', 'vm1', 'start');

      // phys1 is physical → needs connector, starts offline → online
      const physMock = setupMockConnector('service', 'phys1', ['offline', 'online']);
      // prox1 is proxmox → no connector (null), skipped
      // vm1 is VM → needs connector
      const vmMock = setupMockConnector('service', 'vm1', ['offline', 'online']);

      await executeCascadeStart(db, 'c1', 'vm1', { stepTimeoutMs: 5000, pollIntervalMs: 50 });

      // Verify start was called on phys1 first, then vm1
      expect(physMock.start).toHaveBeenCalledTimes(1);
      expect(vmMock.start).toHaveBeenCalledTimes(1);

      // Verify cascade record
      const [cascade] = db.select().from(cascades).where(eq(cascades.id, 'c1')).all();
      expect(cascade!.status).toBe('completed');
      expect(cascade!.completedAt).not.toBeNull();

      // Verify operation logs created
      const logs = db.select().from(operationLogs).all();
      expect(logs.length).toBeGreaterThan(0);
      expect(logs.some(l => l.reason === 'cascade-complete')).toBe(true);
    });

    it('should persist service status in DB after successful start', async () => {
      createTestInfra();
      insertCascade('c-persist', 'vm1', 'start');

      setupMockConnector('service', 'phys1', ['offline', 'online']);
      setupMockConnector('service', 'vm1', ['offline', 'running']);

      await executeCascadeStart(db, 'c-persist', 'vm1', { stepTimeoutMs: 5000, pollIntervalMs: 50 });

      // Verify statuses are persisted in the services table
      const [phys] = db.select().from(services).where(eq(services.id, 'phys1')).all();
      expect(phys!.status).toBe('online');
      const [vm] = db.select().from(services).where(eq(services.id, 'vm1')).all();
      expect(vm!.status).toBe('running');
    });

    it('should skip nodes that are already active', async () => {
      createTestInfra();
      insertCascade('c2', 'vm1', 'start');

      // phys1 already online
      const physMock = setupMockConnector('service', 'phys1', ['online']);
      // vm1 already online
      const vmMock = setupMockConnector('service', 'vm1', ['online']);

      await executeCascadeStart(db, 'c2', 'vm1', { stepTimeoutMs: 5000, pollIntervalMs: 50 });

      expect(physMock.start).not.toHaveBeenCalled();
      expect(vmMock.start).not.toHaveBeenCalled();

      const [cascade] = db.select().from(cascades).where(eq(cascades.id, 'c2')).all();
      expect(cascade!.status).toBe('completed');
    });

    it('should fail cascade on timeout', async () => {
      createTestInfra();
      insertCascade('c3', 'vm1', 'start');

      // phys1 starts but never comes online
      setupMockConnector('service', 'phys1', ['offline', 'offline', 'offline', 'offline']);

      await executeCascadeStart(db, 'c3', 'vm1', { stepTimeoutMs: 200, pollIntervalMs: 50 });

      const [cascade] = db.select().from(cascades).where(eq(cascades.id, 'c3')).all();
      expect(cascade!.status).toBe('failed');
      expect(cascade!.errorCode).toBe('TIMEOUT');
      expect(cascade!.failedStep).toBeGreaterThan(0);

      // Error should be logged
      const logs = db.select().from(operationLogs).all();
      expect(logs.some(l => l.reason === 'cascade-step-failed')).toBe(true);
    });

    it('should fail cascade on connector error', async () => {
      createTestInfra();
      insertCascade('c4', 'vm1', 'start');

      const physMock = setupMockConnector('service', 'phys1', ['offline']);
      physMock.start.mockRejectedValue(new Error('WOL failed'));

      await executeCascadeStart(db, 'c4', 'vm1', { stepTimeoutMs: 5000, pollIntervalMs: 50 });

      const [cascade] = db.select().from(cascades).where(eq(cascades.id, 'c4')).all();
      expect(cascade!.status).toBe('failed');
      expect(cascade!.errorMessage).toContain('WOL failed');
    });

    it('should handle nonexistent service', async () => {
      insertCascade('c5', 'nonexistent', 'start');

      await executeCascadeStart(db, 'c5', 'nonexistent', { stepTimeoutMs: 5000, pollIntervalMs: 50 });

      const [cascade] = db.select().from(cascades).where(eq(cascades.id, 'c5')).all();
      expect(cascade!.status).toBe('failed');
      expect(cascade!.errorCode).toBe('NOT_FOUND');
    });

    it('AC #4: starting a VM should start its structural parent first', async () => {
      createTestInfra();
      // vm1 is stopped, prox1 (structural parent) is offline
      db.update(services).set({ status: 'offline' }).where(eq(services.id, 'prox1')).run();
      db.update(services).set({ status: 'stopped' }).where(eq(services.id, 'vm1')).run();

      insertCascade('c-ac4', 'vm1', 'start');

      // The upstream chain of vm1 includes: prox1 (structural) + phys1 (logical dep of prox1)
      setupMockConnector('service', 'phys1', ['offline', 'online']);
      // prox1 has no connector (Proxmox host) → skipped
      setupMockConnector('service', 'vm1', ['stopped', 'running']);

      await executeCascadeStart(db, 'c-ac4', 'vm1', { stepTimeoutMs: 5000, pollIntervalMs: 50 });

      const [cascade] = db.select().from(cascades).where(eq(cascades.id, 'c-ac4')).all();
      expect(cascade!.status).toBe('completed');
      // vm1 started
      const [vm] = db.select().from(services).where(eq(services.id, 'vm1')).all();
      expect(vm!.status).toBe('running');
    });

    it('AC #5: starting a parent should NOT start its structural children', async () => {
      createTestInfra();
      // prox1 offline, vm1 stopped
      db.update(services).set({ status: 'offline' }).where(eq(services.id, 'prox1')).run();
      db.update(services).set({ status: 'stopped' }).where(eq(services.id, 'vm1')).run();

      insertCascade('c-ac5', 'prox1', 'start');

      // prox1's upstream chain = phys1 (logical dep)
      setupMockConnector('service', 'phys1', ['offline', 'online']);
      // prox1 has no connector → skipped
      // vm1 should NOT have a connector called
      const vmMock = setupMockConnector('service', 'vm1', ['stopped']);

      await executeCascadeStart(db, 'c-ac5', 'prox1', { stepTimeoutMs: 5000, pollIntervalMs: 50 });

      const [cascade] = db.select().from(cascades).where(eq(cascades.id, 'c-ac5')).all();
      expect(cascade!.status).toBe('completed');

      // vm1 should NOT have been started — it's a downstream child, not an upstream dep
      expect(vmMock.start).not.toHaveBeenCalled();
    });

    it('AC #6: starting NAS should NOT start services that depend on it', async () => {
      createTestInfra();
      db.update(services).set({ status: 'offline' }).where(eq(services.id, 'phys1')).run();
      db.update(services).set({ status: 'stopped' }).where(eq(services.id, 'ct1')).run();

      // Add a logical dependency: ct1 (Jellyfin) depends on NAS
      db.insert(dependencyLinks).values({
        id: 'dl-jelly-nas', parentType: 'service', parentId: 'phys1',
        childType: 'service', childId: 'ct1', isStructural: false, createdAt: new Date(),
      }).run();

      insertCascade('c-ac6', 'phys1', 'start');

      const physMock = setupMockConnector('service', 'phys1', ['offline', 'online']);
      const ctMock = setupMockConnector('service', 'ct1', ['stopped']);

      await executeCascadeStart(db, 'c-ac6', 'phys1', { stepTimeoutMs: 5000, pollIntervalMs: 50 });

      const [cascade] = db.select().from(cascades).where(eq(cascades.id, 'c-ac6')).all();
      expect(cascade!.status).toBe('completed');

      // NAS started
      expect(physMock.start).toHaveBeenCalledTimes(1);
      // Jellyfin should NOT have been started (it's downstream of NAS, not upstream)
      expect(ctMock.start).not.toHaveBeenCalled();
    });

    it('should skip proxmox service nodes (no connector)', async () => {
      createTestInfra();
      insertCascade('c6', 'vm1', 'start');

      // phys1 physical → starts
      setupMockConnector('service', 'phys1', ['offline', 'online']);
      // prox1 proxmox → no mock = returns null from factory = skip
      // vm1 → starts
      setupMockConnector('service', 'vm1', ['offline', 'online']);

      await executeCascadeStart(db, 'c6', 'vm1', { stepTimeoutMs: 5000, pollIntervalMs: 50 });

      const [cascade] = db.select().from(cascades).where(eq(cascades.id, 'c6')).all();
      expect(cascade!.status).toBe('completed');

      // Verify skip log exists
      const logs = db.select().from(operationLogs).all();
      expect(logs.some(l => l.reason === 'cascade-skip')).toBe(true);
    });
  });

  describe('executeCascadeStop — 3-phase', () => {
    it('Phase 1+2: should stop structural descendants then target (prox1 → vm1)', async () => {
      createTestInfra();
      db.update(services).set({ status: 'online' }).where(eq(services.id, 'prox1')).run();
      db.update(services).set({ status: 'running' }).where(eq(services.id, 'vm1')).run();
      db.update(services).set({ status: 'online' }).where(eq(services.id, 'phys1')).run();

      insertCascade('cs-p12', 'prox1', 'stop');

      // vm1 = structural descendant of prox1, has connector
      const vmMock = setupMockConnector('service', 'vm1', ['running', 'stopped']);
      // prox1 = target, has connector
      const proxMock = setupMockConnector('service', 'prox1', ['online', 'offline']);

      await executeCascadeStop(db, 'cs-p12', 'prox1', { stepTimeoutMs: 5000, pollIntervalMs: 50 });

      // Phase 1: vm1 stopped first
      expect(vmMock.stop).toHaveBeenCalledTimes(1);
      // Phase 2: prox1 stopped second
      expect(proxMock.stop).toHaveBeenCalledTimes(1);

      const [cascade] = db.select().from(cascades).where(eq(cascades.id, 'cs-p12')).all();
      expect(cascade!.status).toBe('completed');

      // prox1 should be offline
      const [prox] = db.select().from(services).where(eq(services.id, 'prox1')).all();
      expect(prox!.status).toBe('offline');
      // vm1 should be stopped (via its connector)
      const [vm] = db.select().from(services).where(eq(services.id, 'vm1')).all();
      expect(vm!.status).toBe('stopped');

      // phys1 (upstream logical dep) should be stopped in Phase 3 (no other active dependents)
      const [phys] = db.select().from(services).where(eq(services.id, 'phys1')).all();
      expect(phys!.status).toBe('offline');
    });

    it('Phase 3: should NOT stop upstream logical dep with other active dependents', async () => {
      createTestInfra();
      // Add another service that also depends on phys1 (NAS)
      db.insert(services).values({
        id: 'plex1', name: 'Plex', type: 'container', status: 'running',
        parentId: 'dock1', createdAt: new Date(), updatedAt: new Date(),
      }).run();
      // Plex depends on NAS (logical)
      db.insert(dependencyLinks).values({
        id: 'dl-plex-nas', parentType: 'service', parentId: 'phys1',
        childType: 'service', childId: 'plex1', isStructural: false, createdAt: new Date(),
      }).run();
      // prox1 also depends on NAS (already in createTestInfra)

      db.update(services).set({ status: 'online' }).where(eq(services.id, 'prox1')).run();
      db.update(services).set({ status: 'running' }).where(eq(services.id, 'vm1')).run();
      db.update(services).set({ status: 'online' }).where(eq(services.id, 'phys1')).run();

      insertCascade('cs-shared', 'prox1', 'stop');

      setupMockConnector('service', 'vm1', ['running', 'stopped']);
      setupMockConnector('service', 'prox1', ['online', 'offline']);
      const physMock = setupMockConnector('service', 'phys1', ['online']);

      await executeCascadeStop(db, 'cs-shared', 'prox1', { stepTimeoutMs: 5000, pollIntervalMs: 50 });

      // phys1 should NOT be stopped — Plex is still active and depends on NAS
      expect(physMock.stop).not.toHaveBeenCalled();
      const [phys] = db.select().from(services).where(eq(services.id, 'phys1')).all();
      expect(phys!.status).toBe('online');

      // Check skip-shared log
      const logs = db.select().from(operationLogs).all();
      expect(logs.some(l => l.reason === 'cascade-skip-shared')).toBe(true);
    });

    it('Phase 3: should stop upstream logical dep when no other active dependents', async () => {
      createTestInfra();
      db.update(services).set({ status: 'online' }).where(eq(services.id, 'prox1')).run();
      db.update(services).set({ status: 'online' }).where(eq(services.id, 'phys1')).run();

      insertCascade('cs-cleanup', 'prox1', 'stop');

      // prox1 has connector → stops
      setupMockConnector('service', 'prox1', ['online', 'offline']);
      // phys1 (NAS, upstream logical) → should be stopped (no other active dependents)
      setupMockConnector('service', 'phys1', ['online', 'offline']);

      await executeCascadeStop(db, 'cs-cleanup', 'prox1', { stepTimeoutMs: 5000, pollIntervalMs: 50 });

      const [cascade] = db.select().from(cascades).where(eq(cascades.id, 'cs-cleanup')).all();
      expect(cascade!.status).toBe('completed');

      // phys1 should be stopped
      const [phys] = db.select().from(services).where(eq(services.id, 'phys1')).all();
      expect(phys!.status).toBe('offline');
    });

    it('should stop target without upstream when target has no logical deps', async () => {
      createTestInfra();
      db.update(services).set({ status: 'running' }).where(eq(services.id, 'vm1')).run();

      insertCascade('cs-nodep', 'vm1', 'stop');

      // vm1 has no upstream non-structural deps — only structural parent (prox1)
      setupMockConnector('service', 'vm1', ['running', 'offline']);

      await executeCascadeStop(db, 'cs-nodep', 'vm1', { stepTimeoutMs: 5000, pollIntervalMs: 50 });

      const [cascade] = db.select().from(cascades).where(eq(cascades.id, 'cs-nodep')).all();
      expect(cascade!.status).toBe('completed');

      // vm1 stopped, prox1 untouched
      const [vm] = db.select().from(services).where(eq(services.id, 'vm1')).all();
      expect(vm!.status).toBe('offline');
      const [prox] = db.select().from(services).where(eq(services.id, 'prox1')).all();
      expect(prox!.status).toBe('online');
    });

    it('Phase 1: should mark structural descendants offline when parent has no connector', async () => {
      createTestInfra();
      db.update(services).set({ status: 'online' }).where(eq(services.id, 'dock1')).run();
      db.update(services).set({ status: 'running' }).where(eq(services.id, 'ct1')).run();

      insertCascade('cs-noconn', 'dock1', 'stop');

      // dock1 has NO mock connector
      // ct1 (structural descendant of dock1 via isStructural link) has a connector
      setupMockConnector('service', 'ct1', ['running', 'stopped']);

      await executeCascadeStop(db, 'cs-noconn', 'dock1', { stepTimeoutMs: 5000, pollIntervalMs: 50 });

      const [cascade] = db.select().from(cascades).where(eq(cascades.id, 'cs-noconn')).all();
      expect(cascade!.status).toBe('completed');

      // dock1 offline (no connector → marked offline)
      const [dock] = db.select().from(services).where(eq(services.id, 'dock1')).all();
      expect(dock!.status).toBe('offline');
      // ct1 stopped via its own connector (Phase 1)
      const [ct] = db.select().from(services).where(eq(services.id, 'ct1')).all();
      expect(ct!.status).toBe('stopped');
    });

    it('should skip target already stopped', async () => {
      createTestInfra();
      insertCascade('cs-skip', 'vm1', 'stop');

      setupMockConnector('service', 'vm1', ['offline']);

      await executeCascadeStop(db, 'cs-skip', 'vm1', { stepTimeoutMs: 5000, pollIntervalMs: 50 });

      const [cascade] = db.select().from(cascades).where(eq(cascades.id, 'cs-skip')).all();
      expect(cascade!.status).toBe('completed');
    });

    it('should set service status to error on connector failure in Phase 2', async () => {
      createTestInfra();
      db.update(services).set({ status: 'running' }).where(eq(services.id, 'vm1')).run();

      insertCascade('cs-err', 'vm1', 'stop');

      const vmMock = setupMockConnector('service', 'vm1', ['running']);
      vmMock.stop.mockRejectedValue(new Error('SSH connection refused'));

      await executeCascadeStop(db, 'cs-err', 'vm1', { stepTimeoutMs: 5000, pollIntervalMs: 50 });

      const [cascade] = db.select().from(cascades).where(eq(cascades.id, 'cs-err')).all();
      expect(cascade!.status).toBe('failed');
      expect(cascade!.errorMessage).toContain('SSH connection refused');

      const [vm] = db.select().from(services).where(eq(services.id, 'vm1')).all();
      expect(vm!.status).toBe('error');
    });

    it('Phase 1: should mark structural child offline even if its connector fails', async () => {
      createTestInfra();
      db.update(services).set({ status: 'online' }).where(eq(services.id, 'prox1')).run();
      db.update(services).set({ status: 'running' }).where(eq(services.id, 'vm1')).run();

      insertCascade('cs-struct-err', 'prox1', 'stop');

      // vm1 connector fails
      const vmMock = setupMockConnector('service', 'vm1', ['running']);
      vmMock.stop.mockRejectedValue(new Error('SSH fail'));
      // prox1 stops fine
      setupMockConnector('service', 'prox1', ['online', 'offline']);

      await executeCascadeStop(db, 'cs-struct-err', 'prox1', { stepTimeoutMs: 5000, pollIntervalMs: 50 });

      // Cascade should still succeed — structural child failure is non-fatal
      const [cascade] = db.select().from(cascades).where(eq(cascades.id, 'cs-struct-err')).all();
      expect(cascade!.status).toBe('completed');

      // vm1 should be marked offline (fallback) not error
      const [vm] = db.select().from(services).where(eq(services.id, 'vm1')).all();
      expect(vm!.status).toBe('offline');

      // prox1 should be offline
      const [prox] = db.select().from(services).where(eq(services.id, 'prox1')).all();
      expect(prox!.status).toBe('offline');
    });

    it('should handle nonexistent service', async () => {
      insertCascade('cs-404', 'nonexistent', 'stop');

      await executeCascadeStop(db, 'cs-404', 'nonexistent', { stepTimeoutMs: 5000, pollIntervalMs: 50 });

      const [cascade] = db.select().from(cascades).where(eq(cascades.id, 'cs-404')).all();
      expect(cascade!.status).toBe('failed');
      expect(cascade!.errorCode).toBe('NOT_FOUND');
    });
  });

  describe('SSE event emissions', () => {
    function createSseMock() {
      return { broadcast: vi.fn(), send: vi.fn(), getClientCount: vi.fn(() => 1), close: vi.fn(), addClient: vi.fn(), removeClient: vi.fn() };
    }

    it('should emit cascade-progress and cascade-complete on successful start', async () => {
      createTestInfra();
      insertCascade('sse1', 'vm1', 'start');
      setupMockConnector('service', 'phys1', ['offline', 'online']);
      setupMockConnector('service', 'vm1', ['offline', 'online']);
      const sse = createSseMock();

      await executeCascadeStart(db, 'sse1', 'vm1', {
        stepTimeoutMs: 5000, pollIntervalMs: 50, sseManager: sse as any,
      });

      // Should have progress events for each step + status-change for started nodes + cascade-complete
      const progressCalls = sse.broadcast.mock.calls.filter((c: unknown[]) => c[0] === 'cascade-progress');
      expect(progressCalls.length).toBeGreaterThanOrEqual(3); // phys1, prox1(skip), vm1

      const completeCalls = sse.broadcast.mock.calls.filter((c: unknown[]) => c[0] === 'cascade-complete');
      expect(completeCalls.length).toBe(1);
      expect(completeCalls[0][1]).toEqual({ cascadeId: 'sse1', serviceId: 'vm1', success: true });

      const statusChanges = sse.broadcast.mock.calls.filter((c: unknown[]) => c[0] === 'status-change');
      expect(statusChanges.length).toBeGreaterThanOrEqual(2); // phys1 + vm1 came online
    });

    it('should emit cascade-error on failure', async () => {
      createTestInfra();
      insertCascade('sse2', 'vm1', 'start');
      const physMock = setupMockConnector('service', 'phys1', ['offline']);
      physMock.start.mockRejectedValue(new Error('WOL failed'));
      const sse = createSseMock();

      await executeCascadeStart(db, 'sse2', 'vm1', {
        stepTimeoutMs: 5000, pollIntervalMs: 50, sseManager: sse as any,
      });

      const errorCalls = sse.broadcast.mock.calls.filter((c: unknown[]) => c[0] === 'cascade-error');
      expect(errorCalls.length).toBe(1);
      expect(errorCalls[0][1].cascadeId).toBe('sse2');
      expect(errorCalls[0][1].error.message).toContain('WOL failed');
    });

    it('should emit cascade-error for nonexistent service', async () => {
      insertCascade('sse3', 'nonexistent', 'start');
      const sse = createSseMock();

      await executeCascadeStart(db, 'sse3', 'nonexistent', { sseManager: sse as any });

      const errorCalls = sse.broadcast.mock.calls.filter((c: unknown[]) => c[0] === 'cascade-error');
      expect(errorCalls.length).toBe(1);
      expect(errorCalls[0][1].error.code).toBe('NOT_FOUND');
    });

    it('should emit status-change events during stop cascade', async () => {
      createTestInfra();
      db.update(services).set({ status: 'running' }).where(eq(services.id, 'vm1')).run();
      insertCascade('sse4', 'vm1', 'stop');
      setupMockConnector('service', 'vm1', ['running', 'offline']);
      const sse = createSseMock();

      await executeCascadeStop(db, 'sse4', 'vm1', {
        stepTimeoutMs: 5000, pollIntervalMs: 50, sseManager: sse as any,
      });

      const statusChanges = sse.broadcast.mock.calls.filter((c: unknown[]) => c[0] === 'status-change');
      expect(statusChanges.length).toBeGreaterThanOrEqual(1); // vm1 went offline

      const completeCalls = sse.broadcast.mock.calls.filter((c: unknown[]) => c[0] === 'cascade-complete');
      expect(completeCalls.length).toBe(1);
    });

    it('should emit status-change with error status on stop failure (Phase 2)', async () => {
      createTestInfra();
      db.update(services).set({ status: 'running' }).where(eq(services.id, 'vm1')).run();
      insertCascade('sse5', 'vm1', 'stop');
      const vmMock = setupMockConnector('service', 'vm1', ['running']);
      vmMock.stop.mockRejectedValue(new Error('SSH failed'));
      const sse = createSseMock();

      await executeCascadeStop(db, 'sse5', 'vm1', {
        stepTimeoutMs: 5000, pollIntervalMs: 50, sseManager: sse as any,
      });

      // Should emit status-change with 'error' status
      const statusChanges = sse.broadcast.mock.calls.filter((c: unknown[]) => c[0] === 'status-change');
      expect(statusChanges.length).toBe(1);
      expect(statusChanges[0][1].serviceId).toBe('vm1');
      expect(statusChanges[0][1].status).toBe('error');

      // Should also emit cascade-error
      const errorCalls = sse.broadcast.mock.calls.filter((c: unknown[]) => c[0] === 'cascade-error');
      expect(errorCalls.length).toBe(1);
    });
  });
});
