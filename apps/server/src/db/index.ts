import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from '../config.js';
import * as schema from './schema.js';

mkdirSync(dirname(config.databasePath), { recursive: true });

const sqlite = new Database(config.databasePath);
sqlite.pragma('journal_mode = WAL');
sqlite.pragma('foreign_keys = ON');

export const db = drizzle(sqlite, { schema });

// Apply migrations automatically on startup (Story 1.3)
// Determine migrations folder path (works in dev and production)
const __dirname = dirname(fileURLToPath(import.meta.url));
const devMigrationsPath = join(__dirname, '../../drizzle');
const prodMigrationsPath = join(__dirname, '../drizzle');

const migrationsFolder = existsSync(devMigrationsPath)
  ? devMigrationsPath
  : prodMigrationsPath;

migrate(db, { migrationsFolder });
