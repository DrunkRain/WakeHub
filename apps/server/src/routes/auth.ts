import type { FastifyPluginAsync, FastifyError } from 'fastify';
import argon2 from 'argon2';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { eq } from 'drizzle-orm';
import { users, operationLogs, sessions } from '../db/schema.js';
import { extractSessionToken } from '../middleware/auth.middleware.js';
import { config } from '../config.js';

declare module 'fastify' {
  interface FastifyInstance {
    db: BetterSQLite3Database<typeof import('../db/schema.js')>;
    sseManager: import('../sse/sse-manager.js').SSEManager;
  }
  interface FastifyRequest {
    userId?: string;
  }
}

interface RegisterBody {
  username: string;
  password: string;
  passwordConfirm: string;
  securityQuestion: string;
  securityAnswer: string;
}

interface LoginBody {
  username: string;
  password: string;
  rememberMe?: boolean;
}

interface GetSecurityQuestionBody {
  username: string;
}

interface ResetPasswordBody {
  username: string;
  securityAnswer: string;
  newPassword: string;
  newPasswordConfirm: string;
}

const authRoutes: FastifyPluginAsync = async (fastify) => {
  // Error handler for validation errors
  fastify.setErrorHandler((error: FastifyError, _request, reply) => {
    if ('validation' in error && error.validation) {
      return reply.status(400).send({
        error: {
          code: 'VALIDATION_ERROR',
          message: error.message,
          details: error.validation,
        },
      });
    }
    throw error;
  });

  // POST /api/auth/register - Create new user account
  fastify.post<{ Body: RegisterBody }>(
    '/api/auth/register',
    {
      schema: {
        body: {
          type: 'object',
          required: ['username', 'password', 'passwordConfirm', 'securityQuestion', 'securityAnswer'],
          properties: {
            username: { type: 'string', minLength: 3, maxLength: 50 },
            password: { type: 'string', minLength: 8, maxLength: 128 },
            passwordConfirm: { type: 'string', minLength: 8, maxLength: 128 },
            securityQuestion: { type: 'string', minLength: 1 },
            securityAnswer: { type: 'string', minLength: 1 },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              data: {
                type: 'object',
                properties: {
                  userId: { type: 'string' },
                  username: { type: 'string' },
                  token: { type: 'string' },
                },
              },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const { username, password, passwordConfirm, securityQuestion, securityAnswer } = request.body;

      // Validation: Password confirmation match
      if (password !== passwordConfirm) {
        return reply.status(400).send({
          error: {
            code: 'PASSWORD_MISMATCH',
            message: 'Password and confirmation do not match',
          },
        });
      }

      // Hash password and security answer with argon2id (before transaction)
      const passwordHash = await argon2.hash(password, {
        type: argon2.argon2id,
      });
      const securityAnswerHash = await argon2.hash(securityAnswer, {
        type: argon2.argon2id,
      });

      // Atomic check-and-insert to prevent TOCTOU race (sync for better-sqlite3)
      const userId = crypto.randomUUID();
      const inserted = fastify.db.transaction((tx) => {
        const existingUsers = tx.select({ id: users.id }).from(users).limit(1).all();
        if (existingUsers.length > 0) {
          return null;
        }

        tx.insert(users).values({
          id: userId,
          username: username.trim(),
          passwordHash,
          securityQuestion,
          securityAnswerHash,
          createdAt: new Date(),
          updatedAt: new Date(),
        }).run();
        return true;
      });

      if (!inserted) {
        return reply.status(400).send({
          error: {
            code: 'USER_ALREADY_EXISTS',
            message: 'A user account already exists',
          },
        });
      }

      // Log the operation
      await fastify.db.insert(operationLogs).values({
        id: crypto.randomUUID(),
        timestamp: new Date(),
        level: 'info',
        source: 'auth',
        message: `User created: ${username}`,
        reason: 'first-time-setup',
        details: { userId, username },
      });

      // Log via pino
      fastify.log.info({ userId, username }, 'User account created');

      // Create session using proper session system (Story 1.4)
      const token = crypto.randomUUID();
      const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

      await fastify.db.insert(sessions).values({
        userId,
        token,
        expiresAt,
      });

      // Set HTTP-only cookie with session token
      reply.setCookie('session_token', token, {
        httpOnly: true,
        secure: config.cookieSecure,
        sameSite: 'lax',
        path: '/',
        maxAge: 30 * 24 * 60 * 60, // 30 days in seconds
      });

      return {
        data: {
          userId,
          username,
          token,
        },
      };
    }
  );

  // GET /api/auth/check-setup - Check if initial setup is complete
  fastify.get('/api/auth/check-setup', async () => {
    // Check if at least one user exists
    const existingUsers = await fastify.db.select().from(users).limit(1);
    const setupComplete = existingUsers.length > 0;

    return {
      data: {
        setupComplete,
      },
    };
  });

  // POST /api/auth/login - Login with credentials
  fastify.post<{ Body: LoginBody }>(
    '/api/auth/login',
    {
      schema: {
        body: {
          type: 'object',
          required: ['username', 'password'],
          properties: {
            username: { type: 'string', minLength: 3, maxLength: 50 },
            password: { type: 'string', minLength: 1 },
            rememberMe: { type: 'boolean' },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              data: {
                type: 'object',
                properties: {
                  userId: { type: 'string' },
                  username: { type: 'string' },
                  token: { type: 'string' },
                },
              },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const { username: rawUsername, password, rememberMe = false } = request.body;
      const username = rawUsername.trim();

      // Find user by username
      const [user] = await fastify.db
        .select()
        .from(users)
        .where(eq(users.username, username))
        .limit(1);

      // Generic error message to not reveal if username or password is wrong
      if (!user) {
        return reply.status(401).send({
          error: {
            code: 'INVALID_CREDENTIALS',
            message: 'Identifiants incorrects',
          },
        });
      }

      // Verify password with argon2
      const isValidPassword = await argon2.verify(user.passwordHash, password);
      if (!isValidPassword) {
        return reply.status(401).send({
          error: {
            code: 'INVALID_CREDENTIALS',
            message: 'Identifiants incorrects',
          },
        });
      }

      // Create session
      const token = crypto.randomUUID();
      const sessionDuration = rememberMe
        ? 30 * 24 * 60 * 60 * 1000 // 30 days
        : 24 * 60 * 60 * 1000; // 24 hours
      const expiresAt = new Date(Date.now() + sessionDuration);

      await fastify.db.insert(sessions).values({
        userId: user.id,
        token,
        expiresAt,
      });

      // Set HTTP-only cookie with session token
      reply.setCookie('session_token', token, {
        httpOnly: true,
        secure: config.cookieSecure,
        sameSite: 'lax',
        path: '/',
        maxAge: Math.floor(sessionDuration / 1000), // Convert to seconds
      });

      // Log the operation
      await fastify.db.insert(operationLogs).values({
        timestamp: new Date(),
        level: 'info',
        source: 'auth',
        message: `User logged in: ${username}`,
        reason: null,
        details: { userId: user.id, username, rememberMe },
      });

      fastify.log.info({ userId: user.id, username }, 'User logged in');

      return {
        data: {
          userId: user.id,
          username: user.username,
          token,
        },
      };
    }
  );

  // POST /api/auth/logout - Logout user
  fastify.post('/api/auth/logout', async (request, reply) => {
    const sessionToken = extractSessionToken(request);

    if (sessionToken) {
      // Delete session from database
      await fastify.db.delete(sessions).where(eq(sessions.token, sessionToken));

      // Log the operation
      await fastify.db.insert(operationLogs).values({
        timestamp: new Date(),
        level: 'info',
        source: 'auth',
        message: 'User logged out',
        reason: null,
        details: null,
      });

      fastify.log.info('User logged out');
    }

    // Clear the cookie
    reply.clearCookie('session_token', {
      path: '/',
    });

    return {
      data: {
        success: true,
      },
    };
  });

  // POST /api/auth/get-security-question - Get user's security question for password reset
  fastify.post<{ Body: GetSecurityQuestionBody }>(
    '/api/auth/get-security-question',
    {
      schema: {
        body: {
          type: 'object',
          required: ['username'],
          properties: {
            username: { type: 'string', minLength: 3, maxLength: 50 },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              data: {
                type: 'object',
                properties: {
                  securityQuestion: { type: 'string' },
                },
              },
            },
          },
          400: {
            type: 'object',
            properties: {
              error: {
                type: 'object',
                properties: {
                  code: { type: 'string' },
                  message: { type: 'string' },
                },
              },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const username = request.body.username.trim();

      const [user] = await fastify.db
        .select({ securityQuestion: users.securityQuestion })
        .from(users)
        .where(eq(users.username, username))
        .limit(1);

      if (!user) {
        return reply.status(400).send({
          error: {
            code: 'INVALID_REQUEST',
            message: 'Impossible de traiter la demande',
          },
        });
      }

      return {
        data: {
          securityQuestion: user.securityQuestion,
        },
      };
    }
  );

  // POST /api/auth/reset-password - Reset password via security question
  fastify.post<{ Body: ResetPasswordBody }>(
    '/api/auth/reset-password',
    {
      schema: {
        body: {
          type: 'object',
          required: ['username', 'securityAnswer', 'newPassword', 'newPasswordConfirm'],
          properties: {
            username: { type: 'string', minLength: 3, maxLength: 50 },
            securityAnswer: { type: 'string', minLength: 1 },
            newPassword: { type: 'string', minLength: 8, maxLength: 128 },
            newPasswordConfirm: { type: 'string', minLength: 8, maxLength: 128 },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              data: {
                type: 'object',
                properties: {
                  success: { type: 'boolean' },
                },
              },
            },
          },
          400: {
            type: 'object',
            properties: {
              error: {
                type: 'object',
                properties: {
                  code: { type: 'string' },
                  message: { type: 'string' },
                },
              },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const { username: rawUsername, securityAnswer, newPassword, newPasswordConfirm } = request.body;
      const username = rawUsername.trim();

      // Validate password confirmation
      if (newPassword !== newPasswordConfirm) {
        return reply.status(400).send({
          error: {
            code: 'PASSWORD_MISMATCH',
            message: 'Le mot de passe et la confirmation ne correspondent pas',
          },
        });
      }

      // Find user (only fetch needed fields)
      const [user] = await fastify.db
        .select({ id: users.id, securityAnswerHash: users.securityAnswerHash })
        .from(users)
        .where(eq(users.username, username))
        .limit(1);

      // User not found - return same error as wrong answer (don't reveal existence)
      if (!user) {
        return reply.status(400).send({
          error: {
            code: 'INVALID_SECURITY_ANSWER',
            message: 'Reponse incorrecte',
          },
        });
      }

      // Verify security answer
      const isValidAnswer = await argon2.verify(user.securityAnswerHash, securityAnswer);
      if (!isValidAnswer) {
        return reply.status(400).send({
          error: {
            code: 'INVALID_SECURITY_ANSWER',
            message: 'Reponse incorrecte',
          },
        });
      }

      // Hash new password
      const passwordHash = await argon2.hash(newPassword, {
        type: argon2.argon2id,
      });

      // Update password in database
      await fastify.db
        .update(users)
        .set({ passwordHash, updatedAt: new Date() })
        .where(eq(users.id, user.id));

      // Invalidate all sessions for this user
      await fastify.db.delete(sessions).where(eq(sessions.userId, user.id));

      // Log the operation
      await fastify.db.insert(operationLogs).values({
        timestamp: new Date(),
        level: 'info',
        source: 'auth',
        message: `Password reset for user: ${username}`,
        reason: 'password-reset',
        details: { userId: user.id, username },
      });

      fastify.log.info({ userId: user.id, username }, 'Password reset completed');

      return {
        data: {
          success: true,
        },
      };
    }
  );

  // GET /api/auth/me - Get current user from session
  fastify.get(
    '/api/auth/me',
    {
      schema: {
        response: {
          200: {
            type: 'object',
            properties: {
              data: {
                type: 'object',
                properties: {
                  userId: { type: 'string' },
                  username: { type: 'string' },
                },
              },
            },
          },
          401: {
            type: 'object',
            properties: {
              error: {
                type: 'object',
                properties: {
                  code: { type: 'string' },
                  message: { type: 'string' },
                },
              },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const sessionToken = extractSessionToken(request);

      if (!sessionToken) {
        return reply.status(401).send({
          error: {
            code: 'UNAUTHORIZED',
            message: 'Session invalide ou expirée',
          },
        });
      }

      // Verify session in database
      const [session] = await fastify.db
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
        return reply.status(401).send({
          error: {
            code: 'UNAUTHORIZED',
            message: 'Session invalide ou expirée',
          },
        });
      }

      // Get user data
      const [user] = await fastify.db
        .select()
        .from(users)
        .where(eq(users.id, session.userId))
        .limit(1);

      if (!user) {
        return reply.status(401).send({
          error: {
            code: 'UNAUTHORIZED',
            message: 'Session invalide ou expirée',
          },
        });
      }

      return {
        data: {
          userId: user.id,
          username: user.username,
        },
      };
    }
  );
};

export default authRoutes;
