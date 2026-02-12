import type { FastifyRequest, FastifyReply } from 'fastify';
import { db } from '../db/index.js';
import { sessions } from '../db/schema.js';
import { eq, lt } from 'drizzle-orm';

/**
 * Extract session token from cookie or Authorization header.
 * Supports: Cookie session_token OR Authorization: Bearer <token>
 */
function extractSessionToken(request: FastifyRequest): string | undefined {
  // 1. Try cookie first
  const cookieToken = request.cookies?.session_token;
  if (cookieToken) return cookieToken;

  // 2. Fallback to Authorization: Bearer <token>
  const authHeader = request.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.slice(7);
  }

  return undefined;
}

/**
 * Middleware d'authentification pour Fastify
 * Vérifie la session via cookie HTTP-only OU header Authorization
 * Story 1.4 - AC: #6, #7
 */
export async function authMiddleware(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const appDb = request.server.db;
  const sessionToken = extractSessionToken(request);

  if (!sessionToken) {
    return reply.status(401).send({
      error: {
        code: 'UNAUTHORIZED',
        message: 'Session invalide ou expirée',
      },
    });
  }

  // Vérifier la session en base
  const [session] = await appDb
    .select()
    .from(sessions)
    .where(eq(sessions.token, sessionToken))
    .limit(1);

  if (!session) {
    return reply.status(401).send({
      error: {
        code: 'UNAUTHORIZED',
        message: 'Session invalide ou expirée',
      },
    });
  }

  // Check if session is expired
  const now = new Date();
  const expiresAt = session.expiresAt instanceof Date ? session.expiresAt : new Date(session.expiresAt);
  if (now > expiresAt) {
    await appDb.delete(sessions).where(eq(sessions.token, sessionToken));
    return reply.status(401).send({
      error: {
        code: 'UNAUTHORIZED',
        message: 'Session invalide ou expirée',
      },
    });
  }

  // Session valide
  request.userId = session.userId;
}

/** Exported for reuse in /api/auth/me */
export { extractSessionToken };

/**
 * Nettoyage des sessions expirées — à appeler au démarrage du serveur
 */
export async function cleanExpiredSessions() {
  await db.delete(sessions).where(lt(sessions.expiresAt, new Date()));
}
