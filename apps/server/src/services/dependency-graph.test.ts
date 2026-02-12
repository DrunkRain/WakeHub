import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { unlinkSync } from 'node:fs';
import * as schema from '../db/schema.js';
import {
  getUpstreamChain,
  getDownstreamDependents,
  isSharedDependency,
  validateLink,
  getUpstreamDependencies,
  getStructuralAncestors,
  getDownstreamLogicalDependents,
  getStructuralDescendants,
} from './dependency-graph.js';

const TEST_DB_PATH = './test-depgraph-db.sqlite';

describe('dependency-graph service', () => {
  let db: ReturnType<typeof drizzle>;
  let sqlite: Database.Database;

  // IDs for test fixtures — all are services now
  const serviceA = 'service-aaa'; // physical (NAS)
  const serviceB = 'service-bbb'; // proxmox (PVE)
  const serviceC = 'service-ccc'; // docker host
  const serviceX = 'service-xxx'; // vm (on proxmox B)
  const serviceY = 'service-yyy'; // vm (on proxmox B)
  const serviceZ = 'service-zzz'; // container (on docker C)

  beforeAll(() => {
    sqlite = new Database(TEST_DB_PATH);
    sqlite.pragma('journal_mode = WAL');
    sqlite.pragma('foreign_keys = ON');
    db = drizzle(sqlite, { schema });
    migrate(db, { migrationsFolder: './drizzle' });
  });

  afterAll(() => {
    sqlite.close();
    try {
      unlinkSync(TEST_DB_PATH);
      unlinkSync(`${TEST_DB_PATH}-shm`);
      unlinkSync(`${TEST_DB_PATH}-wal`);
    } catch {
      // Ignore cleanup errors
    }
  });

  beforeEach(() => {
    // Clean all test data
    sqlite.exec('DELETE FROM dependency_links');
    sqlite.exec('DELETE FROM services');

    // Insert test services
    const now = Date.now();
    sqlite.exec(`
      INSERT INTO services (id, name, type, ip_address, status, created_at, updated_at) VALUES
        ('${serviceA}', 'NAS', 'physical', '192.168.1.10', 'online', ${now}, ${now}),
        ('${serviceB}', 'Proxmox', 'proxmox', '192.168.1.20', 'online', ${now}, ${now}),
        ('${serviceC}', 'Docker Host', 'docker', '192.168.1.30', 'offline', ${now}, ${now})
    `);

    // Insert child services (VMs, containers)
    sqlite.exec(`
      INSERT INTO services (id, name, type, platform_ref, status, parent_id, created_at, updated_at) VALUES
        ('${serviceX}', 'VM-Media', 'vm', '{"node":"pve","vmid":100}', 'running', '${serviceB}', ${now}, ${now}),
        ('${serviceY}', 'VM-Backup', 'vm', '{"node":"pve","vmid":101}', 'stopped', '${serviceB}', ${now}, ${now}),
        ('${serviceZ}', 'Jellyfin', 'container', '{"containerId":"abc","image":"jellyfin"}', 'running', '${serviceC}', ${now}, ${now})
    `);
  });

  describe('getUpstreamChain', () => {
    it('should return the upstream chain in order (A → X → Z)', () => {
      // Chain: serviceA → serviceX → serviceZ
      db.insert(schema.dependencyLinks).values({
        id: 'link-1',
        parentType: 'service',
        parentId: serviceA,
        childType: 'service',
        childId: serviceX,
      }).run();

      db.insert(schema.dependencyLinks).values({
        id: 'link-2',
        parentType: 'service',
        parentId: serviceX,
        childType: 'service',
        childId: serviceZ,
      }).run();

      // Upstream of serviceZ → [serviceX, serviceA]
      const chain = getUpstreamChain(db, 'service', serviceZ);
      expect(chain).toHaveLength(2);
      expect(chain[0]).toMatchObject({ nodeType: 'service', nodeId: serviceX, name: 'VM-Media' });
      expect(chain[1]).toMatchObject({ nodeType: 'service', nodeId: serviceA, name: 'NAS' });
    });

    it('should return empty array for a node with no parent', () => {
      const chain = getUpstreamChain(db, 'service', serviceA);
      expect(chain).toEqual([]);
    });
  });

  describe('getDownstreamDependents', () => {
    it('should return the downstream dependents', () => {
      // serviceA → serviceX → serviceZ
      db.insert(schema.dependencyLinks).values({
        id: 'link-1',
        parentType: 'service',
        parentId: serviceA,
        childType: 'service',
        childId: serviceX,
      }).run();

      db.insert(schema.dependencyLinks).values({
        id: 'link-2',
        parentType: 'service',
        parentId: serviceX,
        childType: 'service',
        childId: serviceZ,
      }).run();

      // Downstream of serviceA → [serviceX, serviceZ]
      const deps = getDownstreamDependents(db, 'service', serviceA);
      expect(deps).toHaveLength(2);
      expect(deps[0]).toMatchObject({ nodeType: 'service', nodeId: serviceX, name: 'VM-Media' });
      expect(deps[1]).toMatchObject({ nodeType: 'service', nodeId: serviceZ, name: 'Jellyfin' });
    });

    it('should return empty array for a node with no children', () => {
      const deps = getDownstreamDependents(db, 'service', serviceZ);
      expect(deps).toEqual([]);
    });
  });

  describe('isSharedDependency', () => {
    it('should return true when a node has more than 1 child', () => {
      // serviceA → serviceX AND serviceA → serviceY
      db.insert(schema.dependencyLinks).values([
        {
          id: 'link-1',
          parentType: 'service',
          parentId: serviceA,
          childType: 'service',
          childId: serviceX,
        },
        {
          id: 'link-2',
          parentType: 'service',
          parentId: serviceA,
          childType: 'service',
          childId: serviceY,
        },
      ]).run();

      const result = isSharedDependency(db, 'service', serviceA);
      expect(result).toBe(true);
    });

    it('should return false when a node has 0 or 1 child', () => {
      db.insert(schema.dependencyLinks).values({
        id: 'link-1',
        parentType: 'service',
        parentId: serviceA,
        childType: 'service',
        childId: serviceX,
      }).run();

      expect(isSharedDependency(db, 'service', serviceA)).toBe(false);
      expect(isSharedDependency(db, 'service', serviceC)).toBe(false);
    });
  });

  describe('validateLink', () => {
    it('should return valid for a valid new link', () => {
      const result = validateLink(db, 'service', serviceA, 'service', serviceX);
      expect(result).toEqual({ valid: true });
    });

    it('should detect self-reference (A → A)', () => {
      const result = validateLink(db, 'service', serviceA, 'service', serviceA);
      expect(result).toEqual({ valid: false, error: 'SELF_REFERENCE' });
    });

    it('should detect duplicate links', () => {
      db.insert(schema.dependencyLinks).values({
        id: 'link-1',
        parentType: 'service',
        parentId: serviceA,
        childType: 'service',
        childId: serviceX,
      }).run();

      const result = validateLink(db, 'service', serviceA, 'service', serviceX);
      expect(result).toEqual({ valid: false, error: 'DUPLICATE_LINK' });
    });

    it('should detect simple cycles (A → X → A)', () => {
      db.insert(schema.dependencyLinks).values({
        id: 'link-1',
        parentType: 'service',
        parentId: serviceA,
        childType: 'service',
        childId: serviceX,
      }).run();

      // Now try serviceX → serviceA (would create cycle)
      const result = validateLink(db, 'service', serviceX, 'service', serviceA);
      expect(result).toEqual({ valid: false, error: 'CYCLE_DETECTED' });
    });

    it('should detect indirect cycles (A → X → Z → A)', () => {
      db.insert(schema.dependencyLinks).values([
        {
          id: 'link-1',
          parentType: 'service',
          parentId: serviceA,
          childType: 'service',
          childId: serviceX,
        },
        {
          id: 'link-2',
          parentType: 'service',
          parentId: serviceX,
          childType: 'service',
          childId: serviceZ,
        },
      ]).run();

      // Now try serviceZ → serviceA (would create A → X → Z → A cycle)
      const result = validateLink(db, 'service', serviceZ, 'service', serviceA);
      expect(result).toEqual({ valid: false, error: 'CYCLE_DETECTED' });
    });

    it('should detect non-existent parent node', () => {
      const result = validateLink(db, 'service', 'non-existent-id', 'service', serviceX);
      expect(result).toEqual({ valid: false, error: 'NODE_NOT_FOUND' });
    });

    it('should detect non-existent child node', () => {
      const result = validateLink(db, 'service', serviceA, 'service', 'non-existent-id');
      expect(result).toEqual({ valid: false, error: 'NODE_NOT_FOUND' });
    });
  });

  describe('getUpstreamDependencies (non-structural only)', () => {
    it('should return only non-structural upstream links', () => {
      // Structural: Proxmox(B) → VM-Media(X) (isStructural=true)
      db.insert(schema.dependencyLinks).values({
        id: 'link-s1', parentType: 'service', parentId: serviceB,
        childType: 'service', childId: serviceX, isStructural: true,
      }).run();
      // Logical: NAS(A) → VM-Media(X) (isStructural=false)
      db.insert(schema.dependencyLinks).values({
        id: 'link-l1', parentType: 'service', parentId: serviceA,
        childType: 'service', childId: serviceX, isStructural: false,
      }).run();

      const deps = getUpstreamDependencies(db, serviceX);
      expect(deps).toHaveLength(1);
      expect(deps[0]).toMatchObject({ nodeId: serviceA, name: 'NAS' });
    });

    it('should recursively follow non-structural upstream links', () => {
      // Logical chain: A → X → Z
      db.insert(schema.dependencyLinks).values([
        { id: 'link-l1', parentType: 'service', parentId: serviceA, childType: 'service', childId: serviceX, isStructural: false },
        { id: 'link-l2', parentType: 'service', parentId: serviceX, childType: 'service', childId: serviceZ, isStructural: false },
      ]).run();

      const deps = getUpstreamDependencies(db, serviceZ);
      expect(deps).toHaveLength(2);
      expect(deps[0]).toMatchObject({ nodeId: serviceX });
      expect(deps[1]).toMatchObject({ nodeId: serviceA });
    });

    it('should return empty for node with no non-structural upstream', () => {
      // Only structural link
      db.insert(schema.dependencyLinks).values({
        id: 'link-s1', parentType: 'service', parentId: serviceB,
        childType: 'service', childId: serviceX, isStructural: true,
      }).run();

      const deps = getUpstreamDependencies(db, serviceX);
      expect(deps).toEqual([]);
    });
  });

  describe('getStructuralAncestors (structural only)', () => {
    it('should return only structural upstream links', () => {
      // Structural: B → X
      db.insert(schema.dependencyLinks).values({
        id: 'link-s1', parentType: 'service', parentId: serviceB,
        childType: 'service', childId: serviceX, isStructural: true,
      }).run();
      // Logical: A → X
      db.insert(schema.dependencyLinks).values({
        id: 'link-l1', parentType: 'service', parentId: serviceA,
        childType: 'service', childId: serviceX, isStructural: false,
      }).run();

      const ancestors = getStructuralAncestors(db, serviceX);
      expect(ancestors).toHaveLength(1);
      expect(ancestors[0]).toMatchObject({ nodeId: serviceB, name: 'Proxmox' });
    });

    it('should return empty for node with no structural ancestors', () => {
      const ancestors = getStructuralAncestors(db, serviceA);
      expect(ancestors).toEqual([]);
    });
  });

  describe('getDownstreamLogicalDependents (non-structural only)', () => {
    it('should return only non-structural downstream links', () => {
      // NAS(A) → VM-Media(X) logical
      db.insert(schema.dependencyLinks).values({
        id: 'link-l1', parentType: 'service', parentId: serviceA,
        childType: 'service', childId: serviceX, isStructural: false,
      }).run();
      // NAS(A) → Jellyfin(Z) logical
      db.insert(schema.dependencyLinks).values({
        id: 'link-l2', parentType: 'service', parentId: serviceA,
        childType: 'service', childId: serviceZ, isStructural: false,
      }).run();
      // NAS(A) → Proxmox(B) structural
      db.insert(schema.dependencyLinks).values({
        id: 'link-s1', parentType: 'service', parentId: serviceA,
        childType: 'service', childId: serviceB, isStructural: true,
      }).run();

      const deps = getDownstreamLogicalDependents(db, serviceA);
      expect(deps).toHaveLength(2);
      const ids = deps.map(d => d.nodeId);
      expect(ids).toContain(serviceX);
      expect(ids).toContain(serviceZ);
      expect(ids).not.toContain(serviceB);
    });

    it('should return empty when all downstream are structural', () => {
      db.insert(schema.dependencyLinks).values({
        id: 'link-s1', parentType: 'service', parentId: serviceB,
        childType: 'service', childId: serviceX, isStructural: true,
      }).run();

      const deps = getDownstreamLogicalDependents(db, serviceB);
      expect(deps).toEqual([]);
    });
  });

  describe('getStructuralDescendants (structural only)', () => {
    it('should return only structural downstream descendants', () => {
      // Proxmox(B) → VM-Media(X) structural
      db.insert(schema.dependencyLinks).values({
        id: 'link-s1', parentType: 'service', parentId: serviceB,
        childType: 'service', childId: serviceX, isStructural: true,
      }).run();
      // Proxmox(B) → VM-Backup(Y) structural
      db.insert(schema.dependencyLinks).values({
        id: 'link-s2', parentType: 'service', parentId: serviceB,
        childType: 'service', childId: serviceY, isStructural: true,
      }).run();
      // Proxmox(B) → Jellyfin(Z) logical (should NOT appear)
      db.insert(schema.dependencyLinks).values({
        id: 'link-l1', parentType: 'service', parentId: serviceB,
        childType: 'service', childId: serviceZ, isStructural: false,
      }).run();

      const desc = getStructuralDescendants(db, serviceB);
      expect(desc).toHaveLength(2);
      const ids = desc.map(d => d.nodeId);
      expect(ids).toContain(serviceX);
      expect(ids).toContain(serviceY);
      expect(ids).not.toContain(serviceZ);
    });

    it('should recursively find nested structural descendants', () => {
      // B → X → Z (all structural)
      db.insert(schema.dependencyLinks).values([
        { id: 'link-s1', parentType: 'service', parentId: serviceB, childType: 'service', childId: serviceX, isStructural: true },
        { id: 'link-s2', parentType: 'service', parentId: serviceX, childType: 'service', childId: serviceZ, isStructural: true },
      ]).run();

      const desc = getStructuralDescendants(db, serviceB);
      expect(desc).toHaveLength(2);
      expect(desc[0]).toMatchObject({ nodeId: serviceX });
      expect(desc[1]).toMatchObject({ nodeId: serviceZ });
    });

    it('should return empty for node with no structural descendants', () => {
      const desc = getStructuralDescendants(db, serviceZ);
      expect(desc).toEqual([]);
    });
  });
});
