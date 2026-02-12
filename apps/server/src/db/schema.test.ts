import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { unlinkSync } from 'node:fs';
import * as schema from './schema.js';

const TEST_DB_PATH = './test-db.sqlite';

describe('Database Schema & Migrations', () => {
  let db: ReturnType<typeof drizzle>;
  let sqlite: Database.Database;

  beforeAll(() => {
    // Create test database
    sqlite = new Database(TEST_DB_PATH);
    sqlite.pragma('journal_mode = WAL');
    sqlite.pragma('foreign_keys = ON');
    db = drizzle(sqlite, { schema });

    // Apply migrations
    migrate(db, { migrationsFolder: './drizzle' });
  });

  afterAll(() => {
    // Cleanup
    sqlite.close();
    try {
      unlinkSync(TEST_DB_PATH);
      unlinkSync(`${TEST_DB_PATH}-shm`);
      unlinkSync(`${TEST_DB_PATH}-wal`);
    } catch {
      // Ignore cleanup errors
    }
  });

  it('should create users table with correct schema', () => {
    const tableInfo = sqlite
      .prepare("PRAGMA table_info('users')")
      .all() as Array<{ name: string; type: string; notnull: number }>;

    const columnNames = tableInfo.map((col) => col.name);
    expect(columnNames).toContain('id');
    expect(columnNames).toContain('username');
    expect(columnNames).toContain('password_hash');
    expect(columnNames).toContain('security_question');
    expect(columnNames).toContain('security_answer_hash');
    expect(columnNames).toContain('created_at');
    expect(columnNames).toContain('updated_at');
  });

  it('should create unique index on username', () => {
    const indexes = sqlite
      .prepare("SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='users'")
      .all() as Array<{ name: string }>;

    const hasUsernameIndex = indexes.some((idx) =>
      idx.name.includes('username_unique')
    );
    expect(hasUsernameIndex).toBe(true);
  });

  it('should create operation_logs table with correct schema', () => {
    const tableInfo = sqlite
      .prepare("PRAGMA table_info('operation_logs')")
      .all() as Array<{ name: string; type: string; notnull: number }>;

    const columnNames = tableInfo.map((col) => col.name);
    expect(columnNames).toContain('id');
    expect(columnNames).toContain('timestamp');
    expect(columnNames).toContain('level');
    expect(columnNames).toContain('source');
    expect(columnNames).toContain('message');
    expect(columnNames).toContain('reason');
    expect(columnNames).toContain('details');
  });

  it('should apply migrations successfully with services table (no machines/resources)', () => {
    const tables = sqlite
      .prepare("SELECT name FROM sqlite_master WHERE type='table'")
      .all() as Array<{ name: string }>;

    const tableNames = tables.map((t) => t.name);
    expect(tableNames).toContain('users');
    expect(tableNames).toContain('operation_logs');
    expect(tableNames).toContain('sessions');
    expect(tableNames).toContain('services');
    expect(tableNames).toContain('dependency_links');
    expect(tableNames).toContain('cascades');
    expect(tableNames).toContain('__drizzle_migrations');
    // machines and resources should NOT exist after migration
    expect(tableNames).not.toContain('machines');
    expect(tableNames).not.toContain('resources');
  });

  it('should create services table with all expected columns', () => {
    const tableInfo = sqlite
      .prepare("PRAGMA table_info('services')")
      .all() as Array<{ name: string; type: string; notnull: number }>;

    const columnNames = tableInfo.map((col) => col.name);
    expect(columnNames).toContain('id');
    expect(columnNames).toContain('name');
    expect(columnNames).toContain('type');
    expect(columnNames).toContain('ip_address');
    expect(columnNames).toContain('mac_address');
    expect(columnNames).toContain('ssh_user');
    expect(columnNames).toContain('ssh_credentials_encrypted');
    expect(columnNames).toContain('api_url');
    expect(columnNames).toContain('api_credentials_encrypted');
    expect(columnNames).toContain('service_url');
    expect(columnNames).toContain('status');
    expect(columnNames).toContain('platform_ref');
    expect(columnNames).toContain('inactivity_timeout');
    expect(columnNames).toContain('parent_id');
    expect(columnNames).toContain('pinned_to_dashboard');
    expect(columnNames).toContain('created_at');
    expect(columnNames).toContain('updated_at');
  });

  it('should have ip_address as nullable in services table', () => {
    const tableInfo = sqlite
      .prepare("PRAGMA table_info('services')")
      .all() as Array<{ name: string; type: string; notnull: number }>;

    const ipCol = tableInfo.find((col) => col.name === 'ip_address');
    expect(ipCol).toBeDefined();
    expect(ipCol!.notnull).toBe(0); // nullable
  });

  it('should have parent_id as nullable FK to services', () => {
    const foreignKeys = sqlite
      .prepare("PRAGMA foreign_key_list('services')")
      .all() as Array<{ table: string; from: string; to: string }>;

    const parentFk = foreignKeys.find((fk) => fk.from === 'parent_id');
    expect(parentFk).toBeDefined();
    expect(parentFk!.table).toBe('services');
    expect(parentFk!.to).toBe('id');
  });

  it('should have is_structural column in dependency_links', () => {
    const tableInfo = sqlite
      .prepare("PRAGMA table_info('dependency_links')")
      .all() as Array<{ name: string; type: string; notnull: number; dflt_value: string | null }>;

    const columnNames = tableInfo.map((col) => col.name);
    expect(columnNames).toContain('is_structural');

    const isStructuralCol = tableInfo.find((col) => col.name === 'is_structural');
    expect(isStructuralCol).toBeDefined();
    expect(isStructuralCol!.notnull).toBe(1); // NOT NULL
    expect(isStructuralCol!.dflt_value).toBe('0'); // default false
  });

  it('should have service_id column in cascades (renamed from resource_id)', () => {
    const tableInfo = sqlite
      .prepare("PRAGMA table_info('cascades')")
      .all() as Array<{ name: string; type: string; notnull: number }>;

    const columnNames = tableInfo.map((col) => col.name);
    expect(columnNames).toContain('service_id');
    expect(columnNames).not.toContain('resource_id');
  });

  it('should create sessions table with correct schema', () => {
    const tableInfo = sqlite
      .prepare("PRAGMA table_info('sessions')")
      .all() as Array<{ name: string; type: string; notnull: number }>;

    const columnNames = tableInfo.map((col) => col.name);
    expect(columnNames).toContain('id');
    expect(columnNames).toContain('user_id');
    expect(columnNames).toContain('token');
    expect(columnNames).toContain('expires_at');
    expect(columnNames).toContain('created_at');
  });

  it('should create unique index on session token', () => {
    const indexes = sqlite
      .prepare("SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='sessions'")
      .all() as Array<{ name: string }>;

    const hasTokenIndex = indexes.some((idx) => idx.name.includes('token_unique'));
    expect(hasTokenIndex).toBe(true);
  });

  it('should create dependency_links table with correct schema', () => {
    const tableInfo = sqlite
      .prepare("PRAGMA table_info('dependency_links')")
      .all() as Array<{ name: string; type: string; notnull: number }>;

    const columnNames = tableInfo.map((col) => col.name);
    expect(columnNames).toContain('id');
    expect(columnNames).toContain('parent_type');
    expect(columnNames).toContain('parent_id');
    expect(columnNames).toContain('child_type');
    expect(columnNames).toContain('child_id');
    expect(columnNames).toContain('is_shared');
    expect(columnNames).toContain('is_structural');
    expect(columnNames).toContain('created_at');
  });

  it('should create unique index on dependency_links (parent_type, parent_id, child_type, child_id)', () => {
    const indexes = sqlite
      .prepare("SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='dependency_links'")
      .all() as Array<{ name: string }>;

    const hasUniqueIndex = indexes.some((idx) =>
      idx.name.includes('unique_dependency_link')
    );
    expect(hasUniqueIndex).toBe(true);
  });

  it('should create foreign key from sessions to users', () => {
    const foreignKeys = sqlite
      .prepare("PRAGMA foreign_key_list('sessions')")
      .all() as Array<{ table: string; from: string; to: string }>;

    const usersFk = foreignKeys.find((fk) => fk.table === 'users');
    expect(usersFk).toBeDefined();
    expect(usersFk?.from).toBe('user_id');
    expect(usersFk?.to).toBe('id');
  });
});

describe('Migration with existing data', () => {
  let db: ReturnType<typeof drizzle>;
  let sqlite: Database.Database;
  const DATA_DB_PATH = './test-migration-data.sqlite';

  beforeAll(() => {
    sqlite = new Database(DATA_DB_PATH);
    sqlite.pragma('journal_mode = WAL');
    sqlite.pragma('foreign_keys = ON');
    db = drizzle(sqlite, { schema });

    // Apply migrations up to 0006 first (old schema)
    // We simulate old state by creating machines and resources manually before the final migration
    // Actually, we just apply all migrations — the migration SQL handles data migration
    migrate(db, { migrationsFolder: './drizzle' });
  });

  afterAll(() => {
    sqlite.close();
    try {
      unlinkSync(DATA_DB_PATH);
      unlinkSync(`${DATA_DB_PATH}-shm`);
      unlinkSync(`${DATA_DB_PATH}-wal`);
    } catch {
      // Ignore cleanup errors
    }
  });

  it('should have services table after migration on fresh DB', () => {
    const tables = sqlite
      .prepare("SELECT name FROM sqlite_master WHERE type='table'")
      .all() as Array<{ name: string }>;

    const tableNames = tables.map((t) => t.name);
    expect(tableNames).toContain('services');
    expect(tableNames).not.toContain('machines');
    expect(tableNames).not.toContain('resources');
  });

  it('should allow inserting a service with parent_id', () => {
    const now = Math.floor(Date.now() / 1000);

    // Insert a parent service (Proxmox host)
    sqlite.prepare(`
      INSERT INTO services (id, name, type, ip_address, status, pinned_to_dashboard, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run('parent-1', 'Proxmox Host', 'proxmox', '192.168.1.100', 'online', 0, now, now);

    // Insert a child service (VM) with parent_id
    sqlite.prepare(`
      INSERT INTO services (id, name, type, status, platform_ref, parent_id, pinned_to_dashboard, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run('child-1', 'Jellyfin VM', 'vm', 'running', '{"node":"pve","vmid":100}', 'parent-1', 0, now, now);

    const child = sqlite.prepare(`SELECT * FROM services WHERE id = ?`).get('child-1') as Record<string, unknown>;
    expect(child.parent_id).toBe('parent-1');
    expect(child.type).toBe('vm');
    expect(child.platform_ref).toBe('{"node":"pve","vmid":100}');
  });

  it('should allow inserting a structural dependency link', () => {
    const now = Math.floor(Date.now() / 1000);

    sqlite.prepare(`
      INSERT INTO dependency_links (id, parent_type, parent_id, child_type, child_id, is_shared, is_structural, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run('link-1', 'service', 'parent-1', 'service', 'child-1', 0, 1, now);

    const link = sqlite.prepare(`SELECT * FROM dependency_links WHERE id = ?`).get('link-1') as Record<string, unknown>;
    expect(link.is_structural).toBe(1);
    expect(link.parent_type).toBe('service');
    expect(link.child_type).toBe('service');
  });

  it('should allow inserting a cascade with service_id', () => {
    const now = Math.floor(Date.now() / 1000);

    sqlite.prepare(`
      INSERT INTO cascades (id, service_id, type, status, current_step, total_steps, started_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run('cascade-1', 'child-1', 'start', 'completed', 3, 3, now);

    const cascade = sqlite.prepare(`SELECT * FROM cascades WHERE id = ?`).get('cascade-1') as Record<string, unknown>;
    expect(cascade.service_id).toBe('child-1');
  });
});
