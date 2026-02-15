import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { unlinkSync, existsSync } from 'node:fs';
import * as schema from '../db/schema.js';
import { nodes, dependencyLinks } from '../db/schema.js';
import { validateLink, getUpstreamChain, getDownstreamDependents, isSharedDependency } from './dependency-graph.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const TEST_DB_PATH = join(__dirname, '../../test-dependency-graph-db.sqlite');

let sqlite: InstanceType<typeof Database>;
let db: ReturnType<typeof drizzle<typeof schema>>;

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

// Helper: insert a node and return its id
function insertNode(name: string, type: 'physical' | 'vm' | 'lxc' | 'container' = 'physical', parentId?: string): string {
  const id = crypto.randomUUID();
  db.insert(nodes).values({
    id,
    name,
    type,
    status: 'online',
    parentId: parentId ?? null,
  }).run();
  return id;
}

// Helper: insert a dependency link
function insertLink(fromId: string, toId: string): string {
  const id = crypto.randomUUID();
  db.insert(dependencyLinks).values({
    id,
    fromNodeId: fromId,
    toNodeId: toId,
    createdAt: new Date(),
  }).run();
  return id;
}

beforeEach(() => {
  sqlite.exec('DELETE FROM dependency_links');
  sqlite.exec('DELETE FROM nodes');
});

describe('validateLink', () => {
  it('should accept a valid link between two nodes', async () => {
    const a = insertNode('Node A');
    const b = insertNode('Node B');
    const result = await validateLink(a, b, db);
    expect(result).toEqual({ valid: true });
  });

  it('should reject self-link', async () => {
    const a = insertNode('Node A');
    const result = await validateLink(a, a, db);
    expect(result.valid).toBe(false);
    expect(result.code).toBe('DEPENDENCY_SELF_LINK');
  });

  it('should reject duplicate link', async () => {
    const a = insertNode('Node A');
    const b = insertNode('Node B');
    insertLink(a, b);
    const result = await validateLink(a, b, db);
    expect(result.valid).toBe(false);
    expect(result.code).toBe('DEPENDENCY_DUPLICATE');
  });

  it('should detect simple cycle (A→B, B→A)', async () => {
    const a = insertNode('Node A');
    const b = insertNode('Node B');
    insertLink(a, b); // A depends on B
    const result = await validateLink(b, a, db); // B depends on A → cycle
    expect(result.valid).toBe(false);
    expect(result.code).toBe('DEPENDENCY_CYCLE_DETECTED');
  });

  it('should detect deep cycle (A→B→C→D→A)', async () => {
    const a = insertNode('A');
    const b = insertNode('B');
    const c = insertNode('C');
    const d = insertNode('D');
    insertLink(a, b); // A depends on B
    insertLink(b, c); // B depends on C
    insertLink(c, d); // C depends on D
    const result = await validateLink(d, a, db); // D depends on A → cycle
    expect(result.valid).toBe(false);
    expect(result.code).toBe('DEPENDENCY_CYCLE_DETECTED');
  });

  it('should allow cross-tree dependencies (nodes with different parentId)', async () => {
    const machineA = insertNode('Machine A', 'physical');
    const machineB = insertNode('Machine B', 'physical');
    const vmOnA = insertNode('VM on A', 'vm', machineA);
    const containerOnB = insertNode('Container on B', 'container', machineB);
    const result = await validateLink(containerOnB, vmOnA, db);
    expect(result).toEqual({ valid: true });
  });
});

describe('getUpstreamChain', () => {
  it('should return empty array for node with no dependencies', async () => {
    const a = insertNode('Node A');
    const result = await getUpstreamChain(a, db);
    expect(result).toEqual([]);
  });

  it('should return direct upstream dependency', async () => {
    const a = insertNode('Jellyfin');
    const b = insertNode('NAS');
    insertLink(a, b); // Jellyfin depends on NAS
    const result = await getUpstreamChain(a, db);
    expect(result).toHaveLength(1);
    expect(result[0].nodeId).toBe(b);
    expect(result[0].name).toBe('NAS');
  });

  it('should return deep upstream chain', async () => {
    const a = insertNode('App');
    const b = insertNode('DB');
    const c = insertNode('Storage');
    const d = insertNode('Machine');
    insertLink(a, b); // App → DB
    insertLink(b, c); // DB → Storage
    insertLink(c, d); // Storage → Machine
    const result = await getUpstreamChain(a, db);
    expect(result).toHaveLength(3);
    const nodeIds = result.map((n) => n.nodeId);
    expect(nodeIds).toContain(b);
    expect(nodeIds).toContain(c);
    expect(nodeIds).toContain(d);
  });

  it('should handle diamond-shaped dependencies without duplicates', async () => {
    const a = insertNode('App');
    const b = insertNode('Service1');
    const c = insertNode('Service2');
    const d = insertNode('Shared');
    insertLink(a, b); // App → Service1
    insertLink(a, c); // App → Service2
    insertLink(b, d); // Service1 → Shared
    insertLink(c, d); // Service2 → Shared
    const result = await getUpstreamChain(a, db);
    expect(result).toHaveLength(3);
    const nodeIds = result.map((n) => n.nodeId);
    expect(nodeIds).toContain(b);
    expect(nodeIds).toContain(c);
    expect(nodeIds).toContain(d);
  });
});

describe('getDownstreamDependents', () => {
  it('should return empty array for node with no dependents', async () => {
    const a = insertNode('Node A');
    const result = await getDownstreamDependents(a, db);
    expect(result).toEqual([]);
  });

  it('should return direct downstream dependents', async () => {
    const nas = insertNode('NAS');
    const jellyfin = insertNode('Jellyfin');
    const plex = insertNode('Plex');
    insertLink(jellyfin, nas); // Jellyfin depends on NAS
    insertLink(plex, nas); // Plex depends on NAS
    const result = await getDownstreamDependents(nas, db);
    expect(result).toHaveLength(2);
    const nodeIds = result.map((n) => n.nodeId);
    expect(nodeIds).toContain(jellyfin);
    expect(nodeIds).toContain(plex);
  });
});

describe('isSharedDependency', () => {
  it('should return false for node with 0 dependents', async () => {
    const a = insertNode('Node A');
    const result = await isSharedDependency(a, db);
    expect(result).toBe(false);
  });

  it('should return false for node with 1 dependent', async () => {
    const a = insertNode('Node A');
    const b = insertNode('Node B');
    insertLink(b, a); // B depends on A
    const result = await isSharedDependency(a, db);
    expect(result).toBe(false);
  });

  it('should return true for node with 2+ dependents', async () => {
    const shared = insertNode('Shared');
    const a = insertNode('App A');
    const b = insertNode('App B');
    insertLink(a, shared);
    insertLink(b, shared);
    const result = await isSharedDependency(shared, db);
    expect(result).toBe(true);
  });
});
