import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

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
