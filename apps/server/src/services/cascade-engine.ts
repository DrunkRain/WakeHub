import { eq } from 'drizzle-orm';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { cascades, operationLogs, services } from '../db/schema.js';
import {
  getUpstreamChain,
  getStructuralDescendants,
  getUpstreamDependencies,
  getDownstreamLogicalDependents,
} from './dependency-graph.js';
import { createConnectorForNode } from './connector-factory.js';
import { PlatformError } from '../utils/platform-error.js';
import type { SSEManager } from '../sse/sse-manager.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = BetterSQLite3Database<any>;

type NodeType = 'service';
type ServiceStatus = typeof services.$inferInsert.status;

const DEFAULT_STEP_TIMEOUT_MS = 30_000;
const POLL_INTERVAL_MS = 2_000;

interface CascadeOptions {
  stepTimeoutMs?: number;
  pollIntervalMs?: number;
  sseManager?: SSEManager;
}

/**
 * Determine the node type for a given ID by checking services table.
 */
function resolveNodeType(db: Db, nodeId: string): { nodeType: NodeType; name: string } | null {
  const rows = db.select({ name: services.name }).from(services).where(eq(services.id, nodeId)).all();
  if (rows.length > 0) return { nodeType: 'service', name: rows[0]!.name };
  return null;
}

/**
 * Check if a node is already online/running.
 */
function isNodeActive(status: string): boolean {
  return status === 'online' || status === 'running';
}

function isNodeStopped(status: string): boolean {
  return status === 'offline' || status === 'stopped';
}

/**
 * Poll a connector's getStatus() until target status is reached or timeout.
 */
async function pollUntilStatus(
  connector: { getStatus(): Promise<string> },
  targetCheck: (status: string) => boolean,
  timeoutMs: number,
  intervalMs: number,
): Promise<string> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const status = await connector.getStatus();
    if (targetCheck(status)) return status;
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  throw new PlatformError('TIMEOUT', 'Timeout en attente du changement de statut', 'cascade');
}

/**
 * After a successful stop(), poll for confirmation.
 * If poll times out, assume 'offline' — the host was told to shut down
 * and becoming unreachable is expected behavior (e.g. SSH shutdown).
 */
async function pollOrAssumeOffline(
  connector: { getStatus(): Promise<string> },
  targetCheck: (status: string) => boolean,
  timeoutMs: number,
  intervalMs: number,
): Promise<string> {
  try {
    return await pollUntilStatus(connector, targetCheck, timeoutMs, intervalMs);
  } catch (err) {
    if (err instanceof PlatformError && err.code === 'TIMEOUT') {
      return 'offline';
    }
    throw err;
  }
}

/**
 * Execute a start cascade for the given service.
 * Starts dependencies from root to target in upstream order.
 */
export async function executeCascadeStart(
  db: Db,
  cascadeId: string,
  serviceId: string,
  options: CascadeOptions = {},
): Promise<void> {
  const stepTimeout = options.stepTimeoutMs ?? DEFAULT_STEP_TIMEOUT_MS;
  const pollInterval = options.pollIntervalMs ?? POLL_INTERVAL_MS;
  const sse = options.sseManager;

  const resolved = resolveNodeType(db, serviceId);
  if (!resolved) {
    updateCascadeFailed(db, cascadeId, 0, 'NOT_FOUND', `Service ${serviceId} non trouvé`);
    sse?.broadcast('cascade-error', {
      cascadeId, serviceId, failedStep: 0,
      error: { code: 'NOT_FOUND', message: `Service ${serviceId} non trouvé` },
    });
    return;
  }

  // Get upstream chain (closest parent first → farthest ancestor last)
  const upstreamChain = getUpstreamChain(db, resolved.nodeType, serviceId);

  // Build full chain: reverse upstream (root first) + target at the end
  const chain = [
    ...upstreamChain.reverse(),
    { nodeType: resolved.nodeType, nodeId: serviceId, name: resolved.name, status: '' },
  ];

  // Update cascade record with total steps
  db.update(cascades)
    .set({ status: 'in_progress', totalSteps: chain.length })
    .where(eq(cascades.id, cascadeId))
    .run();

  for (let i = 0; i < chain.length; i++) {
    const node = chain[i]!;
    const stepNum = i + 1;

    try {
      const connector = createConnectorForNode(db, node.nodeType as NodeType, node.nodeId);

      if (!connector) {
        // No connector (proxmox/docker host) — skip but count as step
        db.update(cascades).set({ currentStep: stepNum }).where(eq(cascades.id, cascadeId)).run();
        logOperation(db, cascadeId, 'info', `Étape ${stepNum}/${chain.length}: ${node.name} — ignoré (pas de connecteur)`, 'cascade-skip');
        sse?.broadcast('cascade-progress', {
          cascadeId, serviceId, step: stepNum, totalSteps: chain.length,
          currentDependency: { id: node.nodeId, name: node.name, status: 'skipped' },
        });
        continue;
      }

      // Check if already online — skip start
      const currentStatus = await connector.getStatus();
      if (isNodeActive(currentStatus)) {
        // Persist actual status (e.g. Docker host was 'unknown' but API responds → 'online')
        db.update(services).set({ status: currentStatus as ServiceStatus, updatedAt: new Date() }).where(eq(services.id, node.nodeId)).run();
        db.update(cascades).set({ currentStep: stepNum }).where(eq(cascades.id, cascadeId)).run();
        logOperation(db, cascadeId, 'info', `Étape ${stepNum}/${chain.length}: ${node.name} — déjà actif`, 'cascade-skip-active');
        sse?.broadcast('cascade-progress', {
          cascadeId, serviceId, step: stepNum, totalSteps: chain.length,
          currentDependency: { id: node.nodeId, name: node.name, status: currentStatus },
        });
        sse?.broadcast('status-change', { serviceId: node.nodeId, status: currentStatus, timestamp: new Date().toISOString() });
        continue;
      }

      // Start the node
      logOperation(db, cascadeId, 'info', `Étape ${stepNum}/${chain.length}: Démarrage de ${node.name}`, 'cascade-start-step');
      sse?.broadcast('cascade-progress', {
        cascadeId, serviceId, step: stepNum, totalSteps: chain.length,
        currentDependency: { id: node.nodeId, name: node.name, status: 'starting' },
      });

      try {
        await connector.start();
      } catch (startErr) {
        // Host can't be started (no WoL) — check if it's actually reachable anyway
        if (startErr instanceof PlatformError && startErr.code === 'NO_START_CAPABILITY') {
          const actualStatus = await connector.getStatus();
          db.update(services).set({ status: actualStatus as ServiceStatus, updatedAt: new Date() }).where(eq(services.id, node.nodeId)).run();
          if (isNodeActive(actualStatus)) {
            // Host is already online even though we can't start it — continue cascade
            db.update(cascades).set({ currentStep: stepNum }).where(eq(cascades.id, cascadeId)).run();
            logOperation(db, cascadeId, 'info', `Étape ${stepNum}/${chain.length}: ${node.name} — non démarrable (pas de WoL), mais joignable`, 'cascade-skip-no-capability');
            sse?.broadcast('status-change', { serviceId: node.nodeId, status: actualStatus, timestamp: new Date().toISOString() });
            propagateToStructuralChildren(db, node.nodeId, 'start', sse);
            continue;
          }
          // Host is offline and can't be started — fail the cascade
          throw new PlatformError('HOST_UNREACHABLE', `${node.name} est éteint et ne peut pas être démarré (pas de WoL configuré)`, 'cascade');
        }
        throw startErr;
      }

      // Poll until online
      const finalStatus = await pollUntilStatus(connector, isNodeActive, stepTimeout, pollInterval);

      // Persist status to DB
      db.update(services).set({ status: finalStatus as ServiceStatus, updatedAt: new Date() }).where(eq(services.id, node.nodeId)).run();

      db.update(cascades).set({ currentStep: stepNum }).where(eq(cascades.id, cascadeId)).run();
      logOperation(db, cascadeId, 'info', `Étape ${stepNum}/${chain.length}: ${node.name} — démarré avec succès`, 'cascade-step-ok');

      // Emit status-change for the node that just came online
      sse?.broadcast('status-change', {
        serviceId: node.nodeId,
        status: finalStatus, timestamp: new Date().toISOString(),
      });

      // Refresh structural children statuses (e.g. Docker containers, Proxmox VMs)
      propagateToStructuralChildren(db, node.nodeId, 'start', sse);
    } catch (err) {
      const errorCode = err instanceof PlatformError ? err.code : 'UNKNOWN_ERROR';
      const errorMessage = err instanceof Error ? err.message : String(err);

      updateCascadeFailed(db, cascadeId, stepNum, errorCode, errorMessage);
      logOperation(db, cascadeId, 'error', `Échec étape ${stepNum}/${chain.length}: ${node.name} — ${errorMessage}`, 'cascade-step-failed', {
        nodeType: node.nodeType,
        nodeId: node.nodeId,
        errorCode,
      });
      sse?.broadcast('cascade-error', {
        cascadeId, serviceId, failedStep: stepNum,
        error: { code: errorCode, message: errorMessage },
      });
      return;
    }
  }

  // All steps completed
  db.update(cascades)
    .set({ status: 'completed', completedAt: new Date() })
    .where(eq(cascades.id, cascadeId))
    .run();
  logOperation(db, cascadeId, 'info', `Cascade start terminée avec succès (${chain.length} étapes)`, 'cascade-complete');
  sse?.broadcast('cascade-complete', { cascadeId, serviceId, success: true });
}

/**
 * Execute a stop cascade for the given service.
 * 3-phase approach:
 *   Phase 1: Force-stop structural descendants (leaf-first) — they become unreachable when parent stops
 *   Phase 2: Stop the target service itself
 *   Phase 3: Conditionally clean up upstream logical dependencies (if no other active dependents)
 */
export async function executeCascadeStop(
  db: Db,
  cascadeId: string,
  serviceId: string,
  options: CascadeOptions = {},
): Promise<void> {
  const stepTimeout = options.stepTimeoutMs ?? DEFAULT_STEP_TIMEOUT_MS;
  const pollInterval = options.pollIntervalMs ?? POLL_INTERVAL_MS;
  const sse = options.sseManager;

  const resolved = resolveNodeType(db, serviceId);
  if (!resolved) {
    updateCascadeFailed(db, cascadeId, 0, 'NOT_FOUND', `Service ${serviceId} non trouvé`);
    sse?.broadcast('cascade-error', {
      cascadeId, serviceId, failedStep: 0,
      error: { code: 'NOT_FOUND', message: `Service ${serviceId} non trouvé` },
    });
    return;
  }

  // Phase 1: structural descendants (leaf-first)
  const structuralDescendants = getStructuralDescendants(db, serviceId).reverse();
  // Phase 2: target
  const target = { nodeType: resolved.nodeType, nodeId: serviceId, name: resolved.name, status: '' };
  // Phase 3: upstream logical dependencies
  const upstreamLogical = getUpstreamDependencies(db, serviceId);

  // Total steps = phase1 + phase2(1) + phase3
  const totalSteps = structuralDescendants.length + 1 + upstreamLogical.length;

  db.update(cascades)
    .set({ status: 'in_progress', totalSteps })
    .where(eq(cascades.id, cascadeId))
    .run();

  // Track all services being stopped in this cascade (for shared dependency checks)
  const stoppingIds = new Set([
    serviceId,
    ...structuralDescendants.map(n => n.nodeId),
  ]);

  let stepNum = 0;

  // ─── Phase 1: Force-stop structural descendants (leaf-first) ───
  for (const node of structuralDescendants) {
    stepNum++;
    try {
      // Structural children are forcibly stopped — no shared dependency check
      const connector = createConnectorForNode(db, node.nodeType as NodeType, node.nodeId);

      if (connector) {
        const currentStatus = await connector.getStatus();
        if (!isNodeStopped(currentStatus)) {
          logOperation(db, cascadeId, 'info', `Étape ${stepNum}/${totalSteps}: Arrêt structurel de ${node.name}`, 'cascade-stop-step');
          sse?.broadcast('cascade-progress', {
            cascadeId, serviceId, step: stepNum, totalSteps,
            currentDependency: { id: node.nodeId, name: node.name, status: 'stopping' },
          });
          await connector.stop();
          const finalStatus = await pollOrAssumeOffline(connector, isNodeStopped, stepTimeout, pollInterval);
          db.update(services).set({ status: finalStatus as ServiceStatus, updatedAt: new Date() }).where(eq(services.id, node.nodeId)).run();
          db.update(cascades).set({ currentStep: stepNum }).where(eq(cascades.id, cascadeId)).run();
          logOperation(db, cascadeId, 'info', `Étape ${stepNum}/${totalSteps}: ${node.name} — arrêté (structurel)`, 'cascade-step-ok');
          sse?.broadcast('status-change', { serviceId: node.nodeId, status: finalStatus, timestamp: new Date().toISOString() });
        } else {
          db.update(services).set({ status: currentStatus as ServiceStatus, updatedAt: new Date() }).where(eq(services.id, node.nodeId)).run();
          db.update(cascades).set({ currentStep: stepNum }).where(eq(cascades.id, cascadeId)).run();
          sse?.broadcast('cascade-progress', {
            cascadeId, serviceId, step: stepNum, totalSteps,
            currentDependency: { id: node.nodeId, name: node.name, status: currentStatus },
          });
          sse?.broadcast('status-change', { serviceId: node.nodeId, status: currentStatus, timestamp: new Date().toISOString() });
        }
      } else {
        // No connector — mark offline (parent going down makes this unreachable)
        db.update(services).set({ status: 'offline' as ServiceStatus, updatedAt: new Date() }).where(eq(services.id, node.nodeId)).run();
        db.update(cascades).set({ currentStep: stepNum }).where(eq(cascades.id, cascadeId)).run();
        logOperation(db, cascadeId, 'info', `Étape ${stepNum}/${totalSteps}: ${node.name} — marqué hors ligne (enfant structurel)`, 'cascade-skip');
        sse?.broadcast('cascade-progress', {
          cascadeId, serviceId, step: stepNum, totalSteps,
          currentDependency: { id: node.nodeId, name: node.name, status: 'offline' },
        });
        sse?.broadcast('status-change', { serviceId: node.nodeId, status: 'offline', timestamp: new Date().toISOString() });
      }
    } catch (err) {
      // Structural child failed to stop — mark offline anyway (parent is going down)
      db.update(services).set({ status: 'offline' as ServiceStatus, updatedAt: new Date() }).where(eq(services.id, node.nodeId)).run();
      sse?.broadcast('status-change', { serviceId: node.nodeId, status: 'offline', timestamp: new Date().toISOString() });
      logOperation(db, cascadeId, 'warn', `Étape ${stepNum}/${totalSteps}: ${node.name} — échec arrêt structurel, marqué offline`, 'cascade-structural-fallback');
      db.update(cascades).set({ currentStep: stepNum }).where(eq(cascades.id, cascadeId)).run();
    }
  }

  // ─── Phase 2: Stop the target service ───
  stepNum++;
  try {
    const connector = createConnectorForNode(db, target.nodeType as NodeType, target.nodeId);

    if (!connector) {
      db.update(services).set({ status: 'offline' as ServiceStatus, updatedAt: new Date() }).where(eq(services.id, target.nodeId)).run();
      db.update(cascades).set({ currentStep: stepNum }).where(eq(cascades.id, cascadeId)).run();
      logOperation(db, cascadeId, 'info', `Étape ${stepNum}/${totalSteps}: ${target.name} — marqué hors ligne (pas de connecteur)`, 'cascade-skip');
      sse?.broadcast('cascade-progress', {
        cascadeId, serviceId, step: stepNum, totalSteps,
        currentDependency: { id: target.nodeId, name: target.name, status: 'offline' },
      });
      sse?.broadcast('status-change', { serviceId: target.nodeId, status: 'offline', timestamp: new Date().toISOString() });
    } else {
      const currentStatus = await connector.getStatus();
      if (isNodeStopped(currentStatus)) {
        db.update(services).set({ status: currentStatus as ServiceStatus, updatedAt: new Date() }).where(eq(services.id, target.nodeId)).run();
        db.update(cascades).set({ currentStep: stepNum }).where(eq(cascades.id, cascadeId)).run();
        logOperation(db, cascadeId, 'info', `Étape ${stepNum}/${totalSteps}: ${target.name} — déjà arrêté`, 'cascade-skip-stopped');
        sse?.broadcast('cascade-progress', {
          cascadeId, serviceId, step: stepNum, totalSteps,
          currentDependency: { id: target.nodeId, name: target.name, status: currentStatus },
        });
        sse?.broadcast('status-change', { serviceId: target.nodeId, status: currentStatus, timestamp: new Date().toISOString() });
      } else {
        logOperation(db, cascadeId, 'info', `Étape ${stepNum}/${totalSteps}: Arrêt de ${target.name}`, 'cascade-stop-step');
        sse?.broadcast('cascade-progress', {
          cascadeId, serviceId, step: stepNum, totalSteps,
          currentDependency: { id: target.nodeId, name: target.name, status: 'stopping' },
        });

        let stopHandled = false;
        try {
          await connector.stop();
        } catch (stopErr) {
          // Host can't be stopped (no SSH/WoL) — update status from actual state, continue cascade
          if (stopErr instanceof PlatformError && stopErr.code === 'NO_STOP_CAPABILITY') {
            const actualStatus = await connector.getStatus();
            db.update(services).set({ status: actualStatus as ServiceStatus, updatedAt: new Date() }).where(eq(services.id, target.nodeId)).run();
            db.update(cascades).set({ currentStep: stepNum }).where(eq(cascades.id, cascadeId)).run();
            logOperation(db, cascadeId, 'info', `Étape ${stepNum}/${totalSteps}: ${target.name} — non arrêtable (pas de SSH), statut: ${actualStatus}`, 'cascade-skip-no-capability');
            sse?.broadcast('cascade-progress', {
              cascadeId, serviceId, step: stepNum, totalSteps,
              currentDependency: { id: target.nodeId, name: target.name, status: actualStatus },
            });
            sse?.broadcast('status-change', { serviceId: target.nodeId, status: actualStatus, timestamp: new Date().toISOString() });
            stopHandled = true;
          } else {
            throw stopErr;
          }
        }

        if (!stopHandled) {
          const finalStatus = await pollOrAssumeOffline(connector, isNodeStopped, stepTimeout, pollInterval);
          db.update(services).set({ status: finalStatus as ServiceStatus, updatedAt: new Date() }).where(eq(services.id, target.nodeId)).run();
          db.update(cascades).set({ currentStep: stepNum }).where(eq(cascades.id, cascadeId)).run();
          logOperation(db, cascadeId, 'info', `Étape ${stepNum}/${totalSteps}: ${target.name} — arrêté avec succès`, 'cascade-step-ok');
          sse?.broadcast('status-change', { serviceId: target.nodeId, status: finalStatus, timestamp: new Date().toISOString() });
        }
      }
    }
  } catch (err) {
    const errorCode = err instanceof PlatformError ? err.code : 'UNKNOWN_ERROR';
    const errorMessage = err instanceof Error ? err.message : String(err);

    db.update(services).set({ status: 'error' as ServiceStatus, updatedAt: new Date() }).where(eq(services.id, target.nodeId)).run();
    sse?.broadcast('status-change', { serviceId: target.nodeId, status: 'error', timestamp: new Date().toISOString() });

    updateCascadeFailed(db, cascadeId, stepNum, errorCode, errorMessage);
    logOperation(db, cascadeId, 'error', `Échec arrêt étape ${stepNum}/${totalSteps}: ${target.name} — ${errorMessage}`, 'cascade-step-failed', {
      nodeType: target.nodeType, nodeId: target.nodeId, errorCode,
    });
    sse?.broadcast('cascade-error', {
      cascadeId, serviceId, failedStep: stepNum,
      error: { code: errorCode, message: errorMessage },
    });
    return;
  }

  // ─── Phase 3: Conditional upstream logical cleanup ───
  for (const dep of upstreamLogical) {
    stepNum++;
    try {
      // Check if this dependency has other active logical dependents outside this cascade
      const logicalDependents = getDownstreamLogicalDependents(db, dep.nodeId);
      const activeDependents = logicalDependents.filter(
        (d) => !stoppingIds.has(d.nodeId) && isNodeActive(d.status),
      );

      if (activeDependents.length > 0) {
        db.update(cascades).set({ currentStep: stepNum }).where(eq(cascades.id, cascadeId)).run();
        logOperation(db, cascadeId, 'info',
          `Arrêt de ${dep.name} annulé — dépendant actif : ${activeDependents[0]!.name}`,
          'cascade-skip-shared',
        );
        sse?.broadcast('cascade-progress', {
          cascadeId, serviceId, step: stepNum, totalSteps,
          currentDependency: { id: dep.nodeId, name: dep.name, status: 'skipped-shared' },
        });
        continue;
      }

      const connector = createConnectorForNode(db, dep.nodeType as NodeType, dep.nodeId);

      if (!connector) {
        db.update(services).set({ status: 'offline' as ServiceStatus, updatedAt: new Date() }).where(eq(services.id, dep.nodeId)).run();
        db.update(cascades).set({ currentStep: stepNum }).where(eq(cascades.id, cascadeId)).run();
        logOperation(db, cascadeId, 'info', `Étape ${stepNum}/${totalSteps}: ${dep.name} — marqué hors ligne (pas de connecteur)`, 'cascade-skip');
        sse?.broadcast('cascade-progress', {
          cascadeId, serviceId, step: stepNum, totalSteps,
          currentDependency: { id: dep.nodeId, name: dep.name, status: 'offline' },
        });
        sse?.broadcast('status-change', { serviceId: dep.nodeId, status: 'offline', timestamp: new Date().toISOString() });
        continue;
      }

      const currentStatus = await connector.getStatus();
      if (isNodeStopped(currentStatus)) {
        db.update(services).set({ status: currentStatus as ServiceStatus, updatedAt: new Date() }).where(eq(services.id, dep.nodeId)).run();
        db.update(cascades).set({ currentStep: stepNum }).where(eq(cascades.id, cascadeId)).run();
        logOperation(db, cascadeId, 'info', `Étape ${stepNum}/${totalSteps}: ${dep.name} — déjà arrêté`, 'cascade-skip-stopped');
        sse?.broadcast('cascade-progress', {
          cascadeId, serviceId, step: stepNum, totalSteps,
          currentDependency: { id: dep.nodeId, name: dep.name, status: currentStatus },
        });
        continue;
      }

      logOperation(db, cascadeId, 'info', `Étape ${stepNum}/${totalSteps}: Arrêt de ${dep.name} (dépendance inutilisée)`, 'cascade-stop-step');
      sse?.broadcast('cascade-progress', {
        cascadeId, serviceId, step: stepNum, totalSteps,
        currentDependency: { id: dep.nodeId, name: dep.name, status: 'stopping' },
      });

      await connector.stop();
      const finalStatus = await pollOrAssumeOffline(connector, isNodeStopped, stepTimeout, pollInterval);
      db.update(services).set({ status: finalStatus as ServiceStatus, updatedAt: new Date() }).where(eq(services.id, dep.nodeId)).run();
      db.update(cascades).set({ currentStep: stepNum }).where(eq(cascades.id, cascadeId)).run();
      logOperation(db, cascadeId, 'info', `Étape ${stepNum}/${totalSteps}: ${dep.name} — arrêté (dépendance nettoyée)`, 'cascade-step-ok');
      sse?.broadcast('status-change', { serviceId: dep.nodeId, status: finalStatus, timestamp: new Date().toISOString() });

      // Add this dep to stoppingIds for recursive checks
      stoppingIds.add(dep.nodeId);
    } catch (err) {
      const errorCode = err instanceof PlatformError ? err.code : 'UNKNOWN_ERROR';
      const errorMessage = err instanceof Error ? err.message : String(err);

      db.update(services).set({ status: 'error' as ServiceStatus, updatedAt: new Date() }).where(eq(services.id, dep.nodeId)).run();
      sse?.broadcast('status-change', { serviceId: dep.nodeId, status: 'error', timestamp: new Date().toISOString() });

      updateCascadeFailed(db, cascadeId, stepNum, errorCode, errorMessage);
      logOperation(db, cascadeId, 'error', `Échec arrêt étape ${stepNum}/${totalSteps}: ${dep.name} — ${errorMessage}`, 'cascade-step-failed', {
        nodeType: dep.nodeType, nodeId: dep.nodeId, errorCode,
      });
      sse?.broadcast('cascade-error', {
        cascadeId, serviceId, failedStep: stepNum,
        error: { code: errorCode, message: errorMessage },
      });
      return;
    }
  }

  db.update(cascades)
    .set({ status: 'completed', completedAt: new Date() })
    .where(eq(cascades.id, cascadeId))
    .run();
  logOperation(db, cascadeId, 'info', `Cascade stop terminée avec succès (${totalSteps} étapes)`, 'cascade-complete');
  sse?.broadcast('cascade-complete', { cascadeId, serviceId, success: true });
}

/**
 * When a parent service changes status, propagate to structural children (parentId).
 * On stop: children become unreachable → mark as offline.
 * On start: poll each child's actual status via its connector.
 */
function propagateToStructuralChildren(
  db: Db,
  parentId: string,
  direction: 'stop' | 'start',
  sse?: SSEManager,
) {
  const children = db.select({ id: services.id, name: services.name, type: services.type })
    .from(services)
    .where(eq(services.parentId, parentId))
    .all();

  for (const child of children) {
    if (direction === 'stop') {
      db.update(services)
        .set({ status: 'offline' as ServiceStatus, updatedAt: new Date() })
        .where(eq(services.id, child.id))
        .run();
      sse?.broadcast('status-change', {
        serviceId: child.id,
        status: 'offline',
        timestamp: new Date().toISOString(),
      });
    } else {
      // Start: poll actual status from connector
      const connector = createConnectorForNode(db, 'service', child.id);
      if (connector) {
        connector.getStatus().then((childStatus) => {
          db.update(services)
            .set({ status: childStatus as ServiceStatus, updatedAt: new Date() })
            .where(eq(services.id, child.id))
            .run();
          sse?.broadcast('status-change', {
            serviceId: child.id,
            status: childStatus,
            timestamp: new Date().toISOString(),
          });
        }).catch(() => {
          // Child unreachable — leave current status
        });
      }
    }
  }
}

function updateCascadeFailed(db: Db, cascadeId: string, step: number, code: string, message: string) {
  db.update(cascades)
    .set({ status: 'failed', failedStep: step, errorCode: code, errorMessage: message, completedAt: new Date() })
    .where(eq(cascades.id, cascadeId))
    .run();
}

function logOperation(
  db: Db,
  cascadeId: string,
  level: 'info' | 'warn' | 'error',
  message: string,
  reason: string,
  extraDetails?: Record<string, unknown>,
) {
  db.insert(operationLogs).values({
    timestamp: new Date(),
    level,
    source: 'cascade-engine',
    message,
    reason,
    details: { cascadeId, ...extraDetails },
  }).run();
}
