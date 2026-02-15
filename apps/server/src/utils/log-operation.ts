import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { operationLogs } from '../db/schema.js';
import type * as schema from '../db/schema.js';

type DB = BetterSQLite3Database<typeof schema>;

export async function logOperation(
  db: DB,
  level: 'info' | 'warn' | 'error',
  source: string,
  message: string,
  reason: string | null,
  details: Record<string, unknown>,
  extra?: {
    nodeId?: string;
    nodeName?: string;
    eventType?: string;
    cascadeId?: string;
    errorCode?: string;
    errorDetails?: Record<string, unknown>;
  },
): Promise<void> {
  await db.insert(operationLogs).values({
    level,
    source,
    message,
    reason,
    details,
    nodeId: extra?.nodeId ?? null,
    nodeName: extra?.nodeName ?? null,
    eventType: extra?.eventType ?? null,
    cascadeId: extra?.cascadeId ?? null,
    errorCode: extra?.errorCode ?? null,
    errorDetails: extra?.errorDetails ?? null,
  });
}
