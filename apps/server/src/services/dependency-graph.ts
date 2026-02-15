import { eq, and, sql } from 'drizzle-orm';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { dependencyLinks, nodes } from '../db/schema.js';
import type * as schema from '../db/schema.js';

type DB = BetterSQLite3Database<typeof schema>;

export interface ValidationResult {
  valid: boolean;
  code?: string;
  message?: string;
}

export interface ChainNode {
  nodeId: string;
  name: string;
  type: string;
  status: string;
}

/**
 * Validate a dependency link before creation.
 * Checks self-link, duplicate, and cycles via DFS.
 */
export async function validateLink(fromId: string, toId: string, db: DB): Promise<ValidationResult> {
  // Self-link check
  if (fromId === toId) {
    return { valid: false, code: 'DEPENDENCY_SELF_LINK', message: 'Un noeud ne peut pas dépendre de lui-même' };
  }

  // Duplicate check
  const existing = await db
    .select({ id: dependencyLinks.id })
    .from(dependencyLinks)
    .where(and(eq(dependencyLinks.fromNodeId, fromId), eq(dependencyLinks.toNodeId, toId)));

  if (existing.length > 0) {
    return { valid: false, code: 'DEPENDENCY_DUPLICATE', message: 'Ce lien de dépendance existe déjà' };
  }

  // Cycle detection via DFS from toId — check if fromId is reachable
  const visited = new Set<string>();
  const stack = [toId];

  while (stack.length > 0) {
    const current = stack.pop()!;
    if (current === fromId) {
      return { valid: false, code: 'DEPENDENCY_CYCLE_DETECTED', message: 'Ce lien créerait un cycle de dépendances' };
    }
    if (visited.has(current)) continue;
    visited.add(current);

    // Follow existing dependencies: current "depends on" X → walk to X
    const deps = await db
      .select({ toNodeId: dependencyLinks.toNodeId })
      .from(dependencyLinks)
      .where(eq(dependencyLinks.fromNodeId, current));

    for (const dep of deps) {
      if (!visited.has(dep.toNodeId)) {
        stack.push(dep.toNodeId);
      }
    }
  }

  return { valid: true };
}

/**
 * Get all upstream dependencies recursively (Layer 2 functional only).
 * Follows: fromNodeId "depends on" toNodeId, so upstream = walk toNodeId direction.
 */
export async function getUpstreamChain(nodeId: string, db: DB): Promise<ChainNode[]> {
  const result: ChainNode[] = [];
  const visited = new Set<string>();
  const stack = [nodeId];

  while (stack.length > 0) {
    const current = stack.pop()!;
    if (visited.has(current)) continue;
    visited.add(current);

    // Find what "current" depends on
    const deps = await db
      .select({
        toNodeId: dependencyLinks.toNodeId,
        name: nodes.name,
        type: nodes.type,
        status: nodes.status,
      })
      .from(dependencyLinks)
      .innerJoin(nodes, eq(dependencyLinks.toNodeId, nodes.id))
      .where(eq(dependencyLinks.fromNodeId, current));

    for (const dep of deps) {
      if (!visited.has(dep.toNodeId)) {
        result.push({
          nodeId: dep.toNodeId,
          name: dep.name,
          type: dep.type,
          status: dep.status,
        });
        stack.push(dep.toNodeId);
      }
    }
  }

  return result;
}

/**
 * Get all nodes that depend on the given node (direct downstream dependents).
 */
export async function getDownstreamDependents(nodeId: string, db: DB): Promise<ChainNode[]> {
  const deps = await db
    .select({
      fromNodeId: dependencyLinks.fromNodeId,
      name: nodes.name,
      type: nodes.type,
      status: nodes.status,
    })
    .from(dependencyLinks)
    .innerJoin(nodes, eq(dependencyLinks.fromNodeId, nodes.id))
    .where(eq(dependencyLinks.toNodeId, nodeId));

  return deps.map((dep) => ({
    nodeId: dep.fromNodeId,
    name: dep.name,
    type: dep.type,
    status: dep.status,
  }));
}

/**
 * Check if a node is a shared dependency (more than one node depends on it).
 */
export async function isSharedDependency(nodeId: string, db: DB): Promise<boolean> {
  const result = await db
    .select({ count: sql<number>`count(*)` })
    .from(dependencyLinks)
    .where(eq(dependencyLinks.toNodeId, nodeId));

  return (result[0]?.count ?? 0) > 1;
}
