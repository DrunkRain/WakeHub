import { eq } from 'drizzle-orm';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import type { Node, NodeStatus } from '@wakehub/shared';
import { nodes, cascades, operationLogs } from '../db/schema.js';
import type * as schema from '../db/schema.js';
import { getUpstreamChain, getDownstreamDependents } from './dependency-graph.js';
import { getConnector } from '../connectors/connector-factory.js';
import type { PlatformConnector } from '../connectors/connector.interface.js';

type DB = BetterSQLite3Database<typeof schema>;

// --- Constants ---

export const CASCADE_STEP_TIMEOUT_MS = 30_000;
export const CASCADE_POLL_INTERVAL_MS = 1_000;

// --- Error codes ---

export const CASCADE_NODE_NOT_FOUND = 'CASCADE_NODE_NOT_FOUND';
export const CASCADE_STEP_TIMEOUT = 'CASCADE_STEP_TIMEOUT';
export const CASCADE_CONNECTOR_ERROR = 'CASCADE_CONNECTOR_ERROR';
export const CASCADE_NOT_FOUND = 'CASCADE_NOT_FOUND';

// --- Progress event types ---

export type CascadeProgressEvent =
  | { type: 'cascade-started'; cascadeId: string; nodeId: string; totalSteps: number }
  | { type: 'step-progress'; cascadeId: string; nodeId: string; stepIndex: number; totalSteps: number; currentNodeId: string; currentNodeName: string }
  | { type: 'node-status-change'; nodeId: string; status: NodeStatus }
  | { type: 'cascade-complete'; cascadeId: string; nodeId: string; success: boolean; error?: { code: string; message: string } };

export interface CascadeOptions {
  cascadeId: string;
  onProgress?: (event: CascadeProgressEvent) => void;
  decryptFn?: (ciphertext: string) => string;
}

// --- Layer 1 Structural Utility Functions ---

/**
 * Get all structural ancestors by walking parentId chain from a node up to the root.
 * Returns from highest (root) to lowest (direct parent), excluding the node itself.
 */
export async function getStructuralAncestors(nodeId: string, db: DB): Promise<typeof nodes.$inferSelect[]> {
  const ancestors: typeof nodes.$inferSelect[] = [];
  const visited = new Set<string>();
  let currentId: string | null = nodeId;

  while (currentId) {
    if (visited.has(currentId)) break; // cycle protection
    visited.add(currentId);

    const [node] = await db.select().from(nodes).where(eq(nodes.id, currentId));
    if (!node) break;

    if (currentId !== nodeId) {
      ancestors.push(node);
    }

    currentId = node.parentId;
  }

  // Reverse: root first, direct parent last
  return ancestors.reverse();
}

/**
 * Get all structural descendants recursively via parentId.
 * Returns in bottom-up order (leaf-first) for safe shutdown ordering.
 */
export async function getStructuralDescendants(nodeId: string, db: DB): Promise<typeof nodes.$inferSelect[]> {
  const result: typeof nodes.$inferSelect[] = [];

  async function collectChildren(parentId: string): Promise<void> {
    const children = await db.select().from(nodes).where(eq(nodes.parentId, parentId));
    for (const child of children) {
      await collectChildren(child.id);
      result.push(child);
    }
  }

  await collectChildren(nodeId);
  return result;
}

// --- Poll status utility ---

export async function pollNodeStatus(
  node: Node,
  connector: PlatformConnector,
  targetStatus: NodeStatus,
  timeoutMs: number = CASCADE_STEP_TIMEOUT_MS,
  pollIntervalMs: number = CASCADE_POLL_INTERVAL_MS,
): Promise<boolean> {
  const start = Date.now();

  while (Date.now() - start < timeoutMs) {
    const status = await connector.getStatus(node);
    if (status === targetStatus) return true;
    await new Promise((r) => setTimeout(r, pollIntervalMs));
  }

  return false;
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

// --- Cascade Start ---

export async function executeCascadeStart(
  targetNodeId: string,
  db: DB,
  options: CascadeOptions,
): Promise<void> {
  const { cascadeId, onProgress, decryptFn } = options;

  // 1. Load target node
  const [targetNode] = await db.select().from(nodes).where(eq(nodes.id, targetNodeId));
  if (!targetNode) {
    await db.update(cascades).set({
      status: 'failed',
      errorCode: CASCADE_NODE_NOT_FOUND,
      errorMessage: 'Noeud introuvable',
    }).where(eq(cascades.id, cascadeId));
    return;
  }

  // 2. Resolve execution plan
  // Layer 2: get upstream functional dependencies (deep-first)
  const upstreamChain = await getUpstreamChain(targetNodeId, db);

  // Build ordered plan: for each node (deps first, then target),
  // include structural ancestors (Layer 1)
  const planNodeIds: string[] = [];
  const seen = new Set<string>();

  // Process each functional dependency (deepest first) + target
  // getUpstreamChain returns closest-first, reverse for deep-first
  const reversedChain = [...upstreamChain].reverse();
  const nodesInOrder = [...reversedChain.map((c) => c.nodeId), targetNodeId];

  for (const nid of nodesInOrder) {
    // Get structural ancestors for this node
    const ancestors = await getStructuralAncestors(nid, db);
    for (const ancestor of ancestors) {
      if (!seen.has(ancestor.id)) {
        seen.add(ancestor.id);
        planNodeIds.push(ancestor.id);
      }
    }
    // Add the node itself
    if (!seen.has(nid)) {
      seen.add(nid);
      planNodeIds.push(nid);
    }
  }

  // 3. Filter out nodes already online
  const planNodes: typeof nodes.$inferSelect[] = [];
  for (const nid of planNodeIds) {
    const [node] = await db.select().from(nodes).where(eq(nodes.id, nid));
    if (!node) continue;
    if (node.status === 'online') {
      await logOperation(db, 'info', 'cascade-engine',
        `Noeud ${node.name} déjà online — sauté`,
        'Noeud déjà online',
        { cascadeId, nodeId: nid },
      );
      continue;
    }
    planNodes.push(node);
  }

  const totalSteps = planNodes.length;

  // 4. Update cascade record
  await db.update(cascades).set({
    status: 'in_progress',
    totalSteps,
  }).where(eq(cascades.id, cascadeId));

  onProgress?.({
    type: 'cascade-started',
    cascadeId,
    nodeId: targetNodeId,
    totalSteps,
  });

  // 5. Execute each step sequentially
  for (let i = 0; i < planNodes.length; i++) {
    const node = planNodes[i]!;

    try {
      // Load parent for connector
      const parentNode = node.parentId
        ? (await db.select().from(nodes).where(eq(nodes.id, node.parentId)))[0]
        : undefined;

      const connector = getConnector(node.type, {
        parentNode: parentNode as Node | undefined,
        decryptFn,
      });

      // Update node status to starting
      await db.update(nodes).set({ status: 'starting' }).where(eq(nodes.id, node.id));
      onProgress?.({ type: 'node-status-change', nodeId: node.id, status: 'starting' });

      onProgress?.({
        type: 'step-progress',
        cascadeId,
        nodeId: targetNodeId,
        stepIndex: i,
        totalSteps,
        currentNodeId: node.id,
        currentNodeName: node.name,
      });

      // Start the node
      await connector.start(node as Node);

      // Poll until online or timeout
      const success = await pollNodeStatus(
        node as Node, connector, 'online',
        CASCADE_STEP_TIMEOUT_MS, CASCADE_POLL_INTERVAL_MS,
      );

      if (!success) {
        // Timeout
        await db.update(nodes).set({ status: 'error' }).where(eq(nodes.id, node.id));
        onProgress?.({ type: 'node-status-change', nodeId: node.id, status: 'error' });

        const errorMessage = `Timeout : le noeud ${node.name} n'a pas répondu dans les ${CASCADE_STEP_TIMEOUT_MS / 1000}s`;
        await db.update(cascades).set({
          status: 'failed',
          failedStep: i,
          errorCode: CASCADE_STEP_TIMEOUT,
          errorMessage,
        }).where(eq(cascades.id, cascadeId));

        await logOperation(db, 'error', 'cascade-engine', errorMessage, 'Timeout poll status', { cascadeId, nodeId: node.id });

        onProgress?.({
          type: 'cascade-complete',
          cascadeId,
          nodeId: targetNodeId,
          success: false,
          error: { code: CASCADE_STEP_TIMEOUT, message: errorMessage },
        });
        return;
      }

      // Success — update node and cascade
      await db.update(nodes).set({ status: 'online' }).where(eq(nodes.id, node.id));
      onProgress?.({ type: 'node-status-change', nodeId: node.id, status: 'online' });

      await db.update(cascades).set({ currentStep: i + 1 }).where(eq(cascades.id, cascadeId));

      await logOperation(db, 'info', 'cascade-engine',
        `Noeud ${node.name} démarré (étape ${i + 1}/${totalSteps})`,
        null,
        { cascadeId, nodeId: node.id },
      );
    } catch (err) {
      const errorMessage = (err as Error).message;
      await db.update(nodes).set({ status: 'error' }).where(eq(nodes.id, node.id));
      onProgress?.({ type: 'node-status-change', nodeId: node.id, status: 'error' });

      await db.update(cascades).set({
        status: 'failed',
        failedStep: i,
        errorCode: CASCADE_CONNECTOR_ERROR,
        errorMessage,
      }).where(eq(cascades.id, cascadeId));

      await logOperation(db, 'error', 'cascade-engine',
        `Erreur connecteur pour ${node.name} : ${errorMessage}`,
        errorMessage,
        { cascadeId, nodeId: node.id },
      );

      onProgress?.({
        type: 'cascade-complete',
        cascadeId,
        nodeId: targetNodeId,
        success: false,
        error: { code: CASCADE_CONNECTOR_ERROR, message: errorMessage },
      });
      return;
    }
  }

  // 6. Cascade completed successfully
  await db.update(cascades).set({
    status: 'completed',
    completedAt: new Date(),
  }).where(eq(cascades.id, cascadeId));

  onProgress?.({
    type: 'cascade-complete',
    cascadeId,
    nodeId: targetNodeId,
    success: true,
  });

  await logOperation(db, 'info', 'cascade-engine',
    `Cascade de démarrage terminée avec succès (${totalSteps} étapes)`,
    null,
    { cascadeId, nodeId: targetNodeId },
  );
}

// --- Cascade Stop ---

export async function executeCascadeStop(
  targetNodeId: string,
  db: DB,
  options: CascadeOptions,
): Promise<void> {
  const { cascadeId, onProgress, decryptFn } = options;

  // Load target node
  const [targetNode] = await db.select().from(nodes).where(eq(nodes.id, targetNodeId));
  if (!targetNode) {
    await db.update(cascades).set({
      status: 'failed',
      errorCode: CASCADE_NODE_NOT_FOUND,
      errorMessage: 'Noeud introuvable',
    }).where(eq(cascades.id, cascadeId));
    return;
  }

  // Track all stopped node IDs for shared dependency protection
  const allStoppedIds = new Set<string>();
  let stepIndex = 0;

  // --- Helper: stop a single node ---
  async function stopSingleNode(
    node: typeof nodes.$inferSelect,
    totalSteps: number,
  ): Promise<boolean> {
    if (node.status === 'offline') {
      allStoppedIds.add(node.id);
      await logOperation(db, 'info', 'cascade-engine',
        `Noeud ${node.name} déjà offline — sauté`,
        'Noeud déjà offline',
        { cascadeId, nodeId: node.id },
      );
      return true;
    }

    try {
      const parentNode = node.parentId
        ? (await db.select().from(nodes).where(eq(nodes.id, node.parentId)))[0]
        : undefined;

      const connector = getConnector(node.type, {
        parentNode: parentNode as Node | undefined,
        decryptFn,
      });

      // Update to stopping
      await db.update(nodes).set({ status: 'stopping' }).where(eq(nodes.id, node.id));
      onProgress?.({ type: 'node-status-change', nodeId: node.id, status: 'stopping' });

      onProgress?.({
        type: 'step-progress',
        cascadeId,
        nodeId: targetNodeId,
        stepIndex,
        totalSteps,
        currentNodeId: node.id,
        currentNodeName: node.name,
      });

      await connector.stop(node as Node);

      const success = await pollNodeStatus(
        node as Node, connector, 'offline',
        CASCADE_STEP_TIMEOUT_MS, CASCADE_POLL_INTERVAL_MS,
      );

      if (!success) {
        const errorMessage = `Timeout : le noeud ${node.name} n'a pas répondu dans les ${CASCADE_STEP_TIMEOUT_MS / 1000}s`;
        await db.update(nodes).set({ status: 'error' }).where(eq(nodes.id, node.id));
        onProgress?.({ type: 'node-status-change', nodeId: node.id, status: 'error' });

        await db.update(cascades).set({
          status: 'failed',
          failedStep: stepIndex,
          errorCode: CASCADE_STEP_TIMEOUT,
          errorMessage,
        }).where(eq(cascades.id, cascadeId));

        await logOperation(db, 'error', 'cascade-engine', errorMessage, 'Timeout poll status', { cascadeId, nodeId: node.id });

        onProgress?.({
          type: 'cascade-complete',
          cascadeId,
          nodeId: targetNodeId,
          success: false,
          error: { code: CASCADE_STEP_TIMEOUT, message: errorMessage },
        });
        return false;
      }

      await db.update(nodes).set({ status: 'offline' }).where(eq(nodes.id, node.id));
      onProgress?.({ type: 'node-status-change', nodeId: node.id, status: 'offline' });
      allStoppedIds.add(node.id);

      await db.update(cascades).set({ currentStep: stepIndex + 1 }).where(eq(cascades.id, cascadeId));
      stepIndex++;

      await logOperation(db, 'info', 'cascade-engine',
        `Noeud ${node.name} arrêté (étape ${stepIndex}/${totalSteps})`,
        null,
        { cascadeId, nodeId: node.id },
      );

      return true;
    } catch (err) {
      const errorMessage = (err as Error).message;
      await db.update(nodes).set({ status: 'error' }).where(eq(nodes.id, node.id));
      onProgress?.({ type: 'node-status-change', nodeId: node.id, status: 'error' });

      await db.update(cascades).set({
        status: 'failed',
        failedStep: stepIndex,
        errorCode: CASCADE_CONNECTOR_ERROR,
        errorMessage,
      }).where(eq(cascades.id, cascadeId));

      await logOperation(db, 'error', 'cascade-engine',
        `Erreur connecteur pour ${node.name} : ${errorMessage}`,
        errorMessage,
        { cascadeId, nodeId: node.id },
      );

      onProgress?.({
        type: 'cascade-complete',
        cascadeId,
        nodeId: targetNodeId,
        success: false,
        error: { code: CASCADE_CONNECTOR_ERROR, message: errorMessage },
      });
      return false;
    }
  }

  // --- Calculate total steps ---
  // Phase 1: structural descendants
  const structuralDescendants = await getStructuralDescendants(targetNodeId, db);
  const onlineDescendants = structuralDescendants.filter((d) => d.status !== 'offline');

  // Phase 2: target node
  const targetSteps = targetNode.status !== 'offline' ? 1 : 0;

  // Phase 3: estimate (may grow dynamically, but start with upstream chain)
  // We'll recalculate totalSteps as we go for Phase 3
  let totalSteps = onlineDescendants.length + targetSteps;

  // Update cascade
  await db.update(cascades).set({
    status: 'in_progress',
    totalSteps,
  }).where(eq(cascades.id, cascadeId));

  onProgress?.({
    type: 'cascade-started',
    cascadeId,
    nodeId: targetNodeId,
    totalSteps,
  });

  // --- Phase 1: Stop structural descendants (leaf-first) ---
  for (const descendant of structuralDescendants) {
    if (descendant.status === 'offline') {
      allStoppedIds.add(descendant.id);
      continue;
    }
    const ok = await stopSingleNode(descendant, totalSteps);
    if (!ok) return; // cascade failed
  }

  // --- Phase 2: Stop target node ---
  if (targetNode.status !== 'offline') {
    const ok = await stopSingleNode(targetNode, totalSteps);
    if (!ok) return;
  } else {
    allStoppedIds.add(targetNode.id);
  }

  // --- Phase 3: Conditional upstream cleanup ---
  await cleanupUpstream(targetNodeId, db, options, allStoppedIds, totalSteps, stopSingleNode);

  // --- Cascade completed ---
  await db.update(cascades).set({
    status: 'completed',
    completedAt: new Date(),
    totalSteps: stepIndex, // final actual steps
  }).where(eq(cascades.id, cascadeId));

  onProgress?.({
    type: 'cascade-complete',
    cascadeId,
    nodeId: targetNodeId,
    success: true,
  });

  await logOperation(db, 'info', 'cascade-engine',
    `Cascade d'arrêt terminée avec succès (${stepIndex} étapes)`,
    null,
    { cascadeId, nodeId: targetNodeId },
  );
}

// --- Phase 3 recursive cleanup ---

async function cleanupUpstream(
  nodeId: string,
  db: DB,
  options: CascadeOptions,
  allStoppedIds: Set<string>,
  totalSteps: number,
  stopSingleNode: (node: typeof nodes.$inferSelect, totalSteps: number) => Promise<boolean>,
): Promise<void> {
  const { cascadeId } = options;

  const upstreamChain = await getUpstreamChain(nodeId, db);

  for (const dep of upstreamChain) {
    // Check if already stopped in this cascade
    if (allStoppedIds.has(dep.nodeId)) continue;

    // Load full node from DB (need confirmBeforeShutdown)
    const [depNode] = await db.select().from(nodes).where(eq(nodes.id, dep.nodeId));
    if (!depNode || depNode.status === 'offline') {
      allStoppedIds.add(dep.nodeId);
      continue;
    }

    // Check for active downstream dependents (functional) AND structural children
    const functionalDependents = await getDownstreamDependents(dep.nodeId, db);
    const structuralChildren = await getStructuralDescendants(dep.nodeId, db);

    const activeFunctional = functionalDependents.filter(
      (d) => !allStoppedIds.has(d.nodeId) && d.status !== 'offline',
    );
    const activeStructural = structuralChildren.filter(
      (c) => !allStoppedIds.has(c.id) && c.status !== 'offline',
    );
    const activeDependents = [
      ...activeFunctional,
      ...activeStructural.map((c) => ({ nodeId: c.id, name: c.name, type: c.type, status: c.status })),
    ];

    if (activeDependents.length > 0) {
      // Shared dependency — protected
      const dependentNames = activeDependents.map((d) => d.name).join(', ');
      await logOperation(db, 'warn', 'cascade-engine',
        `Dépendance partagée ${depNode.name} protégée — dépendants actifs: ${dependentNames}`,
        `Dépendance partagée — dépendant actif: ${dependentNames}`,
        { cascadeId, nodeId: dep.nodeId },
      );
      continue;
    }

    if (depNode.confirmBeforeShutdown) {
      // Don't auto-stop — log as proposed
      await logOperation(db, 'warn', 'cascade-engine',
        `Extinction proposée pour ${depNode.name} — confirmBeforeShutdown activé`,
        'Extinction proposée — confirmBeforeShutdown activé',
        { cascadeId, nodeId: dep.nodeId },
      );
      continue;
    }

    // No active dependents and confirmBeforeShutdown is OFF — auto-stop

    // Phase 1 recursive: stop structural descendants of this dep
    const depDescendants = await getStructuralDescendants(dep.nodeId, db);
    for (const child of depDescendants) {
      if (child.status === 'offline') {
        allStoppedIds.add(child.id);
        continue;
      }
      if (allStoppedIds.has(child.id)) continue;
      const ok = await stopSingleNode(child, totalSteps);
      if (!ok) return;
    }

    // Stop the dependency node itself
    const ok = await stopSingleNode(depNode, totalSteps);
    if (!ok) return;

    // Recurse: check upstream deps of this now-stopped dep
    await cleanupUpstream(dep.nodeId, db, options, allStoppedIds, totalSteps, stopSingleNode);
  }
}
