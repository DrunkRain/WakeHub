import { sqliteTable, text, integer, index, foreignKey } from 'drizzle-orm/sqlite-core';
import type { NodeCapabilities, PlatformRef } from '@wakehub/shared';

/**
 * Table users — Gestion des comptes utilisateurs
 * Implémentée dans Story 1.3
 */
export const users = sqliteTable('users', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  username: text('username').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  securityQuestion: text('security_question').notNull(),
  securityAnswerHash: text('security_answer_hash').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' })
    .notNull()
    .$defaultFn(() => new Date()),
});

/**
 * Table operation_logs — Persistance des logs d'opérations (pino + DB)
 * Implémentée dans Story 1.3
 */
export const operationLogs = sqliteTable('operation_logs', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  timestamp: integer('timestamp', { mode: 'timestamp' })
    .notNull()
    .$defaultFn(() => new Date()),
  level: text('level', { enum: ['info', 'warn', 'error'] }).notNull(),
  source: text('source').notNull(),
  message: text('message').notNull(),
  reason: text('reason'),
  details: text('details', { mode: 'json' }),
});

/**
 * Table sessions — Gestion des sessions utilisateur (cookie-based auth)
 * Implémentée dans Story 1.4
 */
export const sessions = sqliteTable('sessions', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  token: text('token').notNull().unique(),
  expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .$defaultFn(() => new Date()),
});

/**
 * Table nodes — Arbre d'hébergement unifié (machines physiques, VMs, LXCs, conteneurs)
 * Implémentée dans Story 2.1
 */
export const nodes = sqliteTable('nodes', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text('name').notNull(),
  type: text('type', { enum: ['physical', 'vm', 'lxc', 'container'] }).notNull(),
  status: text('status', { enum: ['online', 'offline', 'starting', 'stopping', 'error'] })
    .notNull()
    .default('offline'),
  ipAddress: text('ip_address'),
  macAddress: text('mac_address'),
  sshUser: text('ssh_user'),
  sshCredentialsEncrypted: text('ssh_credentials_encrypted'),
  parentId: text('parent_id'),
  capabilities: text('capabilities', { mode: 'json' })
    .$type<NodeCapabilities>()
    .default({}),
  platformRef: text('platform_ref', { mode: 'json' })
    .$type<PlatformRef | null>(),
  serviceUrl: text('service_url'),
  isPinned: integer('is_pinned', { mode: 'boolean' }).notNull().default(false),
  confirmBeforeShutdown: integer('confirm_before_shutdown', { mode: 'boolean' })
    .notNull()
    .default(true),
  discovered: integer('discovered', { mode: 'boolean' }).notNull().default(false),
  configured: integer('configured', { mode: 'boolean' }).notNull().default(true),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' })
    .notNull()
    .$defaultFn(() => new Date()),
}, (table) => [
  foreignKey({
    columns: [table.parentId],
    foreignColumns: [table.id],
  }).onDelete('cascade'),
  index('idx_nodes_parent_id').on(table.parentId),
  index('idx_nodes_type').on(table.type),
  index('idx_nodes_status').on(table.status),
]);
