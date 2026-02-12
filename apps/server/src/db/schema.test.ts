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

  it('should apply migrations successfully with expected tables', () => {
    const tables = sqlite
      .prepare("SELECT name FROM sqlite_master WHERE type='table'")
      .all() as Array<{ name: string }>;

    const tableNames = tables.map((t) => t.name);
    expect(tableNames).toContain('users');
    expect(tableNames).toContain('operation_logs');
    expect(tableNames).toContain('sessions');
    expect(tableNames).toContain('__drizzle_migrations');
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
