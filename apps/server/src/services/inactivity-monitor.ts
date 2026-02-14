import { eq, and, inArray } from 'drizzle-orm';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import type { MonitoringCriteria, NodeStats, NodeType } from '@wakehub/shared';
import { nodes, inactivityRules, cascades, operationLogs } from '../db/schema.js';
import type * as schema from '../db/schema.js';
import { executeCascadeStop } from './cascade-engine.js';
import { getDownstreamDependents } from './dependency-graph.js';
import { getConnector } from '../connectors/connector-factory.js';
import type { SSEManager } from '../sse/sse-manager.js';
import { broadcastCascadeEvent } from '../sse/broadcast-helpers.js';
import net from 'node:net';
import { NodeSSH } from 'node-ssh';

type DB = BetterSQLite3Database<typeof schema>;
type NodeRow = typeof nodes.$inferSelect;
type RuleRow = typeof inactivityRules.$inferSelect;

// --- Module-level state ---

const inactivityCounters = new Map<string, number>();
let monitorInterval: NodeJS.Timeout | null = null;
const MONITOR_INTERVAL_MS = 60_000;
const SSH_CHECK_TIMEOUT_MS = 5_000;
// NOTE: cpuThreshold semantics differ by monitoring method:
//   - SSH (/proc/loadavg): compared against load average (0-N, where N = core count).
//     0.5 = "very light" on a 4-core machine (~12.5% total CPU).
//   - Docker/Proxmox platform API: compared against equivalent cores in use (0-N).
//     0.5 = "50% of one core".
// Future improvement: normalize SSH loadavg to per-core fraction for consistency.
const DEFAULT_CPU_THRESHOLD = 0.5;
const DEFAULT_RAM_THRESHOLD = 0.5;   // 50% RAM (consistent across all methods)

// --- Exported functions ---

export function startInactivityMonitor(
  db: DB,
  sseManager: SSEManager,
  decryptFn: (ciphertext: string) => string,
): void {
  if (monitorInterval) return;

  monitorInterval = setInterval(() => {
    checkAllInactivityRules(db, sseManager, decryptFn).catch((err) => {
      logOperation(db, 'error', 'inactivity-monitor',
        `Erreur lors de la vérification d'inactivité : ${(err as Error).message}`,
        (err as Error).message,
        {},
      ).catch(() => { /* ignore logging errors */ });
    });
  }, MONITOR_INTERVAL_MS);
}

export function stopInactivityMonitor(): void {
  if (monitorInterval) {
    clearInterval(monitorInterval);
    monitorInterval = null;
  }
  inactivityCounters.clear();
}

export async function checkAllInactivityRules(
  db: DB,
  sseManager: SSEManager,
  decryptFn: (ciphertext: string) => string,
): Promise<void> {
  // M1 fix: Single JOIN query instead of N+1
  const rulesWithNodes = await db
    .select({
      rule: inactivityRules,
      node: nodes,
    })
    .from(inactivityRules)
    .innerJoin(nodes, and(
      eq(inactivityRules.nodeId, nodes.id),
      eq(nodes.status, 'online'),
      eq(nodes.configured, true),
    ))
    .where(eq(inactivityRules.isEnabled, true));

  // Batch preload parent nodes for platform connector usage
  const parentIds = [...new Set(
    rulesWithNodes.map(r => r.node.parentId).filter((id): id is string => id !== null),
  )];
  const parentNodes = parentIds.length > 0
    ? await db.select().from(nodes).where(inArray(nodes.id, parentIds))
    : [];
  const parentMap = new Map(parentNodes.map(p => [p.id, p]));

  // Clean up counters for nodes no longer online/configured
  const activeNodeIds = new Set(rulesWithNodes.map(r => r.rule.nodeId));
  for (const [nodeId] of inactivityCounters) {
    if (!activeNodeIds.has(nodeId)) {
      inactivityCounters.delete(nodeId);
    }
  }

  for (const { rule, node } of rulesWithNodes) {
    const criteria = rule.monitoringCriteria as MonitoringCriteria;
    const isActive = await checkActivity(node, criteria, decryptFn, parentMap);

    if (isActive) {
      // Activity detected — reset counter
      const previousCount = inactivityCounters.get(rule.nodeId) ?? 0;
      if (previousCount > 0) {
        inactivityCounters.set(rule.nodeId, 0);
        await logOperation(db, 'info', 'inactivity-monitor',
          `Activité détectée sur ${node.name} — compteur réinitialisé (était ${previousCount} min)`,
          'Activité détectée',
          { nodeId: rule.nodeId, previousInactiveMinutes: previousCount },
        );
      }
    } else {
      // No activity — increment counter
      const counter = (inactivityCounters.get(rule.nodeId) ?? 0) + 1;
      inactivityCounters.set(rule.nodeId, counter);

      if (counter >= rule.timeoutMinutes) {
        // AC2: Check for active dependents before triggering auto-shutdown
        const dependents = await getDownstreamDependents(node.id, db);
        const activeDependents = dependents.filter(d => d.status !== 'offline');

        if (activeDependents.length > 0) {
          const names = activeDependents.map(d => d.name).join(', ');
          await logOperation(db, 'info', 'inactivity-monitor',
            `Arrêt automatique annulé pour ${node.name} — dépendants actifs: ${names}`,
            'Dépendant actif détecté',
            { nodeId: node.id, ruleId: rule.id, activeDependents: names },
          );
          inactivityCounters.set(rule.nodeId, 0);
          continue;
        }

        // Timeout reached — trigger auto-shutdown
        const triggered = await triggerAutoShutdown(db, sseManager, decryptFn, node, rule, counter);
        if (triggered) {
          inactivityCounters.delete(rule.nodeId);
        }
        // If not triggered (cascade already running), keep counter
        // so we don't re-wait the full timeout once the cascade completes
      }
    }
  }
}

// --- Activity checking ---

async function checkActivity(
  node: NodeRow,
  criteria: MonitoringCriteria,
  decryptFn: (ciphertext: string) => string,
  parentMap: Map<string, NodeRow>,
): Promise<boolean> {
  const nodeType = node.type as NodeType;

  // Fetch platform stats once for non-physical nodes with a parent
  let platformStats: NodeStats | null = null;
  if (nodeType !== 'physical' && node.parentId) {
    const parent = parentMap.get(node.parentId);
    if (parent) {
      try {
        const connector = getConnector(nodeType, { parentNode: parent as any, decryptFn });
        if (connector.getStats) {
          platformStats = await connector.getStats(node as any);
        }
      } catch {
        // Connector creation failed — fallback to SSH checks
      }
    }
  }

  const enabledChecks: Array<() => Promise<boolean>> = [];

  const cpuThreshold = criteria.cpuThreshold ?? DEFAULT_CPU_THRESHOLD;
  const ramThreshold = criteria.ramThreshold ?? DEFAULT_RAM_THRESHOLD;

  if (criteria.lastAccess) {
    if (nodeType !== 'container') {
      // Physical/VM/LXC: TCP port 22 check
      enabledChecks.push(() => checkLastAccess(node));
    }
    if (nodeType === 'container' && platformStats) {
      // Containers: no SSH — use platform API stats as substitute
      const stats = platformStats;
      enabledChecks.push(async () =>
        stats.cpuUsage > cpuThreshold || stats.ramUsage > ramThreshold,
      );
    }
  }
  if (criteria.networkConnections) {
    // Only physical nodes support SSH-based network connection check
    if (nodeType === 'physical') {
      enabledChecks.push(() => checkNetworkConnections(node, decryptFn));
    }
    // VMs/LXCs/containers: skip (safe fallback — don't add check = won't block shutdown)
  }
  if (criteria.cpuRamActivity) {
    if (platformStats) {
      // Use platform API stats
      const stats = platformStats;
      enabledChecks.push(async () => stats.cpuUsage > cpuThreshold || stats.ramUsage > ramThreshold);
    } else {
      // Fallback to SSH for physical nodes or when platform stats unavailable
      enabledChecks.push(() => checkCpuRamActivity(node, decryptFn, cpuThreshold, ramThreshold));
    }
  }
  if (enabledChecks.length === 0) {
    // No criteria enabled — consider active (safe fallback)
    return true;
  }

  // Node is "inactive" only if ALL enabled criteria return inactive
  for (const check of enabledChecks) {
    const active = await check();
    if (active) return true;
  }

  return false;
}

async function checkLastAccess(node: NodeRow): Promise<boolean> {
  // Phase 1: Simple TCP port 22 check
  // If SSH is reachable → active. If unreachable → inactive.
  // If no SSH credentials → active (safe fallback).
  if (!node.ipAddress || !node.sshUser) {
    return true; // safe fallback
  }

  return checkTcpPort(node.ipAddress, 22, SSH_CHECK_TIMEOUT_MS);
}

function checkTcpPort(host: string, port: number, timeoutMs: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(timeoutMs);
    socket.once('connect', () => {
      socket.destroy();
      resolve(true);
    });
    socket.once('timeout', () => {
      socket.destroy();
      resolve(false);
    });
    socket.once('error', () => {
      socket.destroy();
      resolve(false);
    });
    socket.connect(port, host);
  });
}

async function checkNetworkConnections(
  node: NodeRow,
  decryptFn: (ciphertext: string) => string,
): Promise<boolean> {
  if (!node.ipAddress || !node.sshUser) {
    return true; // safe fallback — no credentials
  }

  const ssh = new NodeSSH();
  try {
    await ssh.connect({
      host: node.ipAddress,
      username: node.sshUser,
      password: node.sshCredentialsEncrypted ? decryptFn(node.sshCredentialsEncrypted) : undefined,
      readyTimeout: SSH_CHECK_TIMEOUT_MS,
    });
    const result = await ssh.execCommand('ss -tun state established');
    ssh.dispose();

    const lines = result.stdout.split('\n').filter((l) => l.trim() !== '');
    // Skip header line, filter out SSH monitoring connections (port 22)
    const nonSshConnections = lines.slice(1).filter((line) => {
      const localAddr = line.split(/\s+/)[4] ?? '';
      return !localAddr.endsWith(':22');
    });

    return nonSshConnections.length > 0;
  } catch {
    ssh.dispose();
    return true; // safe fallback — SSH error
  }
}

async function checkCpuRamActivity(
  node: NodeRow,
  decryptFn: (ciphertext: string) => string,
  cpuThreshold: number,
  ramThreshold: number,
): Promise<boolean> {
  if (!node.ipAddress || !node.sshUser) {
    return true; // safe fallback — no credentials
  }

  const ssh = new NodeSSH();
  try {
    await ssh.connect({
      host: node.ipAddress,
      username: node.sshUser,
      password: node.sshCredentialsEncrypted ? decryptFn(node.sshCredentialsEncrypted) : undefined,
      readyTimeout: SSH_CHECK_TIMEOUT_MS,
    });
    const result = await ssh.execCommand('cat /proc/loadavg && free -m');
    ssh.dispose();

    const lines = result.stdout.split('\n');
    // First line: loadavg — first field is 1-min load average
    const cpuLoad = parseFloat(lines[0]?.split(/\s+/)[0] ?? '0');
    // Find "Mem:" line for RAM usage
    const memLine = lines.find((l) => l.startsWith('Mem:'));

    // Safe fallback: if parsing produced NaN, treat as active (don't auto-shutdown on bad data)
    if (isNaN(cpuLoad) || !memLine) return true;

    const parts = memLine.split(/\s+/);
    const total = parseFloat(parts[1] ?? '1');
    const used = parseFloat(parts[2] ?? '0');
    const ramUsage = total > 0 ? used / total : 0;

    return cpuLoad > cpuThreshold || ramUsage > ramThreshold;
  } catch {
    ssh.dispose();
    return true; // safe fallback — SSH or parsing error
  }
}

// --- Auto-shutdown trigger ---

// M4 fix: returns false if cascade already running (caller keeps counter)
async function triggerAutoShutdown(
  db: DB,
  sseManager: SSEManager,
  decryptFn: (ciphertext: string) => string,
  node: NodeRow,
  rule: RuleRow,
  inactiveMinutes: number,
): Promise<boolean> {
  // M4 fix: Check for already-running cascade on this node
  const [activeCascade] = await db
    .select({ id: cascades.id })
    .from(cascades)
    .where(and(
      eq(cascades.nodeId, node.id),
      inArray(cascades.status, ['pending', 'in_progress']),
    ));

  if (activeCascade) {
    await logOperation(db, 'info', 'inactivity-monitor',
      `Arrêt automatique ignoré pour ${node.name} — cascade déjà en cours`,
      'Cascade déjà active',
      { nodeId: node.id, ruleId: rule.id, existingCascadeId: activeCascade.id },
    );
    return false;
  }

  await logOperation(db, 'info', 'inactivity-monitor',
    `Arrêt automatique déclenché pour ${node.name} après ${inactiveMinutes} min d'inactivité`,
    `Timeout d'inactivité dépassé (${rule.timeoutMinutes} min)`,
    { nodeId: node.id, ruleId: rule.id, inactiveMinutes },
  );

  // Create cascade record
  const [cascade] = await db.insert(cascades).values({
    nodeId: node.id,
    type: 'stop',
  }).returning();

  // H1 fix: use shared broadcastCascadeEvent
  const onProgress = (event: Parameters<typeof broadcastCascadeEvent>[1]) => {
    broadcastCascadeEvent(sseManager, event);
  };

  // Fire-and-forget cascade stop
  executeCascadeStop(node.id, db, {
    cascadeId: cascade!.id,
    onProgress,
    decryptFn,
  }).catch(async (err) => {
    await logOperation(db, 'error', 'inactivity-monitor',
      `Erreur cascade d'arrêt auto pour ${node.name} : ${(err as Error).message}`,
      (err as Error).message,
      { nodeId: node.id, cascadeId: cascade!.id },
    ).catch(() => { /* ignore */ });
  });

  // Broadcast auto-shutdown SSE event separately
  sseManager.broadcast('auto-shutdown', {
    nodeId: node.id,
    nodeName: node.name,
    ruleId: rule.id,
    reason: 'inactivity',
    inactiveMinutes,
    timestamp: new Date().toISOString(),
  });

  return true;
}

// --- Logging utility ---

async function logOperation(
  db: DB,
  level: 'info' | 'warn' | 'error',
  source: string,
  message: string,
  reason: string | null,
  details: Record<string, unknown>,
): Promise<void> {
  await db.insert(operationLogs).values({
    level,
    source,
    message,
    reason,
    details,
  });
}

// --- Exported for testing ---

export function _getInactivityCounters(): Map<string, number> {
  return inactivityCounters;
}

export function _getMonitorInterval(): NodeJS.Timeout | null {
  return monitorInterval;
}

export { MONITOR_INTERVAL_MS };
