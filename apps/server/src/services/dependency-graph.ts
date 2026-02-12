import { eq, and } from 'drizzle-orm';
import { dependencyLinks, services } from '../db/schema.js';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = BetterSQLite3Database<any>;

type NodeType = 'service';

export interface ChainNode {
  nodeType: NodeType;
  nodeId: string;
  name: string;
  status: string;
}

/**
 * Resolve the name and status of a node by looking up in services table.
 */
function resolveNode(
  db: Db,
  nodeType: NodeType,
  nodeId: string,
): ChainNode | null {
  const rows = db.select({ name: services.name, status: services.status })
    .from(services)
    .where(eq(services.id, nodeId))
    .all();
  if (rows.length === 0) return null;
  const row = rows[0]!;
  return { nodeType, nodeId, name: row.name, status: row.status };
}

/**
 * Check if a node exists in the database.
 */
export function nodeExists(db: Db, _nodeType: NodeType, nodeId: string): boolean {
  return db.select({ id: services.id }).from(services).where(eq(services.id, nodeId)).all().length > 0;
}

/**
 * Returns the upstream chain (recursive parents) for a given node.
 * Result is ordered from closest parent to farthest ancestor.
 */
export function getUpstreamChain(
  db: Db,
  nodeType: NodeType,
  nodeId: string,
): ChainNode[] {
  const chain: ChainNode[] = [];
  const visited = new Set<string>();
  const queue: Array<{ type: NodeType; id: string }> = [{ type: nodeType, id: nodeId }];
  visited.add(`${nodeType}:${nodeId}`);

  while (queue.length > 0) {
    const current = queue.shift()!;

    // Find parents of current node
    const parents = db.select()
      .from(dependencyLinks)
      .where(and(
        eq(dependencyLinks.childType, current.type),
        eq(dependencyLinks.childId, current.id),
      ))
      .all();

    for (const link of parents) {
      const key = `${link.parentType}:${link.parentId}`;
      if (visited.has(key)) continue;
      visited.add(key);

      const node = resolveNode(db, link.parentType as NodeType, link.parentId);
      if (node) {
        chain.push(node);
        queue.push({ type: link.parentType as NodeType, id: link.parentId });
      }
    }
  }

  return chain;
}

/**
 * Returns the downstream dependents (recursive children) for a given node.
 * Result is ordered breadth-first from closest children to farthest descendants.
 */
export function getDownstreamDependents(
  db: Db,
  nodeType: NodeType,
  nodeId: string,
): ChainNode[] {
  const chain: ChainNode[] = [];
  const visited = new Set<string>();
  const queue: Array<{ type: NodeType; id: string }> = [{ type: nodeType, id: nodeId }];
  visited.add(`${nodeType}:${nodeId}`);

  while (queue.length > 0) {
    const current = queue.shift()!;

    // Find children of current node
    const children = db.select()
      .from(dependencyLinks)
      .where(and(
        eq(dependencyLinks.parentType, current.type),
        eq(dependencyLinks.parentId, current.id),
      ))
      .all();

    for (const link of children) {
      const key = `${link.childType}:${link.childId}`;
      if (visited.has(key)) continue;
      visited.add(key);

      const node = resolveNode(db, link.childType as NodeType, link.childId);
      if (node) {
        chain.push(node);
        queue.push({ type: link.childType as NodeType, id: link.childId });
      }
    }
  }

  return chain;
}

/**
 * Checks if a node is a shared dependency (has more than 1 child link).
 */
export function isSharedDependency(
  db: Db,
  nodeType: NodeType,
  nodeId: string,
): boolean {
  const children = db.select()
    .from(dependencyLinks)
    .where(and(
      eq(dependencyLinks.parentType, nodeType),
      eq(dependencyLinks.parentId, nodeId),
    ))
    .all();

  return children.length > 1;
}

/**
 * Validates whether a proposed dependency link is valid.
 * Checks for: self-reference, node existence, duplicates, and cycles.
 */
export function validateLink(
  db: Db,
  parentType: NodeType,
  parentId: string,
  childType: NodeType,
  childId: string,
): { valid: boolean; error?: string } {
  // Self-reference check
  if (parentType === childType && parentId === childId) {
    return { valid: false, error: 'SELF_REFERENCE' };
  }

  // Node existence check
  if (!nodeExists(db, parentType, parentId)) {
    return { valid: false, error: 'NODE_NOT_FOUND' };
  }
  if (!nodeExists(db, childType, childId)) {
    return { valid: false, error: 'NODE_NOT_FOUND' };
  }

  // Duplicate check
  const existing = db.select()
    .from(dependencyLinks)
    .where(and(
      eq(dependencyLinks.parentType, parentType),
      eq(dependencyLinks.parentId, parentId),
      eq(dependencyLinks.childType, childType),
      eq(dependencyLinks.childId, childId),
    ))
    .all();

  if (existing.length > 0) {
    return { valid: false, error: 'DUPLICATE_LINK' };
  }

  // Cycle detection: BFS from the parent, going upstream.
  // If we reach the proposed child, adding child→parent would create a cycle.
  if (wouldCreateCycle(db, parentType, parentId, childType, childId)) {
    return { valid: false, error: 'CYCLE_DETECTED' };
  }

  return { valid: true };
}

/**
 * Returns upstream dependencies that are NON-structural (logical dependencies only).
 * E.g., Jellyfin depends on NAS → returns NAS (and NAS's own upstream logical deps).
 */
export function getUpstreamDependencies(
  db: Db,
  nodeId: string,
): ChainNode[] {
  const chain: ChainNode[] = [];
  const visited = new Set<string>();
  const queue: string[] = [nodeId];
  visited.add(nodeId);

  while (queue.length > 0) {
    const currentId = queue.shift()!;

    const parents = db.select()
      .from(dependencyLinks)
      .where(and(
        eq(dependencyLinks.childType, 'service'),
        eq(dependencyLinks.childId, currentId),
        eq(dependencyLinks.isStructural, false),
      ))
      .all();

    for (const link of parents) {
      if (visited.has(link.parentId)) continue;
      visited.add(link.parentId);

      const node = resolveNode(db, link.parentType as NodeType, link.parentId);
      if (node) {
        chain.push(node);
        queue.push(link.parentId);
      }
    }
  }

  return chain;
}

/**
 * Returns upstream ancestors that are STRUCTURAL (physical parent chain).
 * E.g., VM → Proxmox host → returns Proxmox.
 */
export function getStructuralAncestors(
  db: Db,
  nodeId: string,
): ChainNode[] {
  const chain: ChainNode[] = [];
  const visited = new Set<string>();
  const queue: string[] = [nodeId];
  visited.add(nodeId);

  while (queue.length > 0) {
    const currentId = queue.shift()!;

    const parents = db.select()
      .from(dependencyLinks)
      .where(and(
        eq(dependencyLinks.childType, 'service'),
        eq(dependencyLinks.childId, currentId),
        eq(dependencyLinks.isStructural, true),
      ))
      .all();

    for (const link of parents) {
      if (visited.has(link.parentId)) continue;
      visited.add(link.parentId);

      const node = resolveNode(db, link.parentType as NodeType, link.parentId);
      if (node) {
        chain.push(node);
        queue.push(link.parentId);
      }
    }
  }

  return chain;
}

/**
 * Returns downstream dependents that are NON-structural (logical dependents only).
 * E.g., NAS has logical dependents Jellyfin and Plex → returns them.
 */
export function getDownstreamLogicalDependents(
  db: Db,
  nodeId: string,
): ChainNode[] {
  const chain: ChainNode[] = [];
  const visited = new Set<string>();
  const queue: string[] = [nodeId];
  visited.add(nodeId);

  while (queue.length > 0) {
    const currentId = queue.shift()!;

    const children = db.select()
      .from(dependencyLinks)
      .where(and(
        eq(dependencyLinks.parentType, 'service'),
        eq(dependencyLinks.parentId, currentId),
        eq(dependencyLinks.isStructural, false),
      ))
      .all();

    for (const link of children) {
      if (visited.has(link.childId)) continue;
      visited.add(link.childId);

      const node = resolveNode(db, link.childType as NodeType, link.childId);
      if (node) {
        chain.push(node);
        queue.push(link.childId);
      }
    }
  }

  return chain;
}

/**
 * Returns downstream descendants that are STRUCTURAL (physical children, recursively).
 * E.g., Proxmox → VM1, VM2 → returns all VMs (and their structural sub-children).
 */
export function getStructuralDescendants(
  db: Db,
  nodeId: string,
): ChainNode[] {
  const chain: ChainNode[] = [];
  const visited = new Set<string>();
  const queue: string[] = [nodeId];
  visited.add(nodeId);

  while (queue.length > 0) {
    const currentId = queue.shift()!;

    const children = db.select()
      .from(dependencyLinks)
      .where(and(
        eq(dependencyLinks.parentType, 'service'),
        eq(dependencyLinks.parentId, currentId),
        eq(dependencyLinks.isStructural, true),
      ))
      .all();

    for (const link of children) {
      if (visited.has(link.childId)) continue;
      visited.add(link.childId);

      const node = resolveNode(db, link.childType as NodeType, link.childId);
      if (node) {
        chain.push(node);
        queue.push(link.childId);
      }
    }
  }

  return chain;
}

/**
 * Detects if adding a link parent→child would create a cycle.
 * We traverse upstream from the parent. If we find the child in the ancestors,
 * that means child is already an ancestor of parent, so adding parent→child
 * would create a cycle.
 */
function wouldCreateCycle(
  db: Db,
  parentType: NodeType,
  parentId: string,
  childType: NodeType,
  childId: string,
): boolean {
  const visited = new Set<string>();
  const queue: Array<{ type: NodeType; id: string }> = [{ type: parentType, id: parentId }];

  while (queue.length > 0) {
    const current = queue.shift()!;
    const key = `${current.type}:${current.id}`;

    if (key === `${childType}:${childId}`) return true;
    if (visited.has(key)) continue;
    visited.add(key);

    // Go upstream: find parents of current
    const parents = db.select()
      .from(dependencyLinks)
      .where(and(
        eq(dependencyLinks.childType, current.type),
        eq(dependencyLinks.childId, current.id),
      ))
      .all();

    for (const p of parents) {
      queue.push({ type: p.parentType as NodeType, id: p.parentId });
    }
  }

  return false;
}
