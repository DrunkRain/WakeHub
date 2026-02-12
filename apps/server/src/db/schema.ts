import { sqliteTable, text, integer, uniqueIndex, type AnySQLiteColumn } from 'drizzle-orm/sqlite-core';

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
 * Table services — Modèle unifié pour toutes les entités gérées
 * (physique, Proxmox, Docker, VM, conteneur)
 * Implémentée dans Story 7.1 (fusion de machines + resources)
 */
export const services = sqliteTable('services', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text('name').notNull(),
  type: text('type', {
    enum: ['physical', 'proxmox', 'docker', 'vm', 'container'],
  }).notNull(),
  ipAddress: text('ip_address'),
  macAddress: text('mac_address'),
  sshUser: text('ssh_user'),
  sshCredentialsEncrypted: text('ssh_credentials_encrypted'),
  apiUrl: text('api_url'),
  apiCredentialsEncrypted: text('api_credentials_encrypted'),
  serviceUrl: text('service_url'),
  status: text('status', {
    enum: ['online', 'offline', 'running', 'stopped', 'paused', 'unknown', 'error'],
  })
    .notNull()
    .default('unknown'),
  platformRef: text('platform_ref', { mode: 'json' }),
  inactivityTimeout: integer('inactivity_timeout'),
  parentId: text('parent_id').references((): AnySQLiteColumn => services.id),
  pinnedToDashboard: integer('pinned_to_dashboard', { mode: 'boolean' }).notNull().default(false),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' })
    .notNull()
    .$defaultFn(() => new Date()),
});

/**
 * Table dependency_links — Liens de dépendance entre machines et resources
 * Implémentée dans Story 3.1
 */
export const dependencyLinks = sqliteTable('dependency_links', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  parentType: text('parent_type', { enum: ['service'] }).notNull(),
  parentId: text('parent_id').notNull(),
  childType: text('child_type', { enum: ['service'] }).notNull(),
  childId: text('child_id').notNull(),
  isShared: integer('is_shared', { mode: 'boolean' }).notNull().default(false),
  isStructural: integer('is_structural', { mode: 'boolean' }).notNull().default(false),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .$defaultFn(() => new Date()),
}, (table) => [
  uniqueIndex('unique_dependency_link').on(table.parentType, table.parentId, table.childType, table.childId),
]);

/**
 * Table cascades — Suivi des opérations de cascade (start/stop)
 * Implémentée dans Story 4.1
 */
export const cascades = sqliteTable('cascades', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  serviceId: text('service_id').notNull(),
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
