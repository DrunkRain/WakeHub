import { sqliteTable, text, integer, index, foreignKey, uniqueIndex } from 'drizzle-orm/sqlite-core';
import type { NodeCapabilities, PlatformRef, MonitoringCriteria } from '@wakehub/shared';

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
 * Implémentée dans Story 1.3, enrichie dans Story 6.1
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
  nodeId: text('node_id'),
  nodeName: text('node_name'),
  eventType: text('event_type'),
  errorCode: text('error_code'),
  errorDetails: text('error_details', { mode: 'json' }),
  cascadeId: text('cascade_id'),
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

/**
 * Table dependency_links — Liens de dépendance fonctionnelle entre noeuds (Layer 2)
 * Sémantique : from_node_id "dépend de" to_node_id
 * Implémentée dans Story 3.1
 */
export const dependencyLinks = sqliteTable('dependency_links', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  fromNodeId: text('from_node_id').notNull(),
  toNodeId: text('to_node_id').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .$defaultFn(() => new Date()),
}, (table) => [
  foreignKey({
    columns: [table.fromNodeId],
    foreignColumns: [nodes.id],
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.toNodeId],
    foreignColumns: [nodes.id],
  }).onDelete('cascade'),
  uniqueIndex('idx_dependency_links_unique').on(table.fromNodeId, table.toNodeId),
  index('idx_dependency_links_from').on(table.fromNodeId),
  index('idx_dependency_links_to').on(table.toNodeId),
]);

/**
 * Table cascades — Suivi des cascades de démarrage/arrêt orchestrées
 * Implémentée dans Story 4.1
 */
export const cascades = sqliteTable('cascades', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  nodeId: text('node_id').notNull(),
  type: text('type', { enum: ['start', 'stop'] }).notNull(),
  status: text('status', { enum: ['pending', 'in_progress', 'completed', 'failed'] })
    .notNull()
    .default('pending'),
  currentStep: integer('current_step').notNull().default(0),
  totalSteps: integer('total_steps').notNull().default(0),
  failedStep: integer('failed_step'),
  errorCode: text('error_code'),
  errorMessage: text('error_message'),
  startedAt: integer('started_at', { mode: 'timestamp' })
    .notNull()
    .$defaultFn(() => new Date()),
  completedAt: integer('completed_at', { mode: 'timestamp' }),
}, (table) => [
  foreignKey({
    columns: [table.nodeId],
    foreignColumns: [nodes.id],
  }).onDelete('cascade'),
  index('idx_cascades_node_id').on(table.nodeId),
]);

/**
 * Table inactivity_rules — Règles de surveillance d'inactivité par nœud
 * Implémentée dans Story 5.1
 */
export const inactivityRules = sqliteTable('inactivity_rules', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  nodeId: text('node_id').notNull(),
  timeoutMinutes: integer('timeout_minutes').notNull().default(30),
  monitoringCriteria: text('monitoring_criteria', { mode: 'json' })
    .$type<MonitoringCriteria>()
    .notNull()
    .$defaultFn(() => ({ lastAccess: true, networkConnections: false, cpuRamActivity: false })),
  isEnabled: integer('is_enabled', { mode: 'boolean' }).notNull().default(true),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' })
    .notNull()
    .$defaultFn(() => new Date()),
}, (table) => [
  foreignKey({
    columns: [table.nodeId],
    foreignColumns: [nodes.id],
  }).onDelete('cascade'),
  index('idx_inactivity_rules_node_id').on(table.nodeId),
  index('idx_inactivity_rules_enabled').on(table.isEnabled),
]);
