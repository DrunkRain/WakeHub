import { describe, it, expect, beforeEach, vi } from 'vitest';
import { authMiddleware } from './auth.middleware.js';
import { db } from '../db/index.js';
import { users, sessions } from '../db/schema.js';
import type { FastifyRequest, FastifyReply } from 'fastify';

const mockLog = { warn: vi.fn(), info: vi.fn(), error: vi.fn() };

function makeRequest(cookies: Record<string, string> = {}, headers: Record<string, string> = {}) {
  return {
    cookies,
    headers,
    server: { db },
    log: mockLog,
    url: '/api/test',
    method: 'GET',
  } as unknown as FastifyRequest;
}

function makeReply() {
  let statusCode = 0;
  let responseData: any;
  const reply = {
    status: (code: number) => {
      statusCode = code;
      return {
        send: (data: any) => {
          responseData = data;
        },
      };
    },
  } as unknown as FastifyReply;
  return { reply, getStatus: () => statusCode, getData: () => responseData };
}

describe('Auth Middleware - Story 1.4', () => {
  beforeEach(async () => {
    await db.delete(sessions);
    await db.delete(users);
    mockLog.warn.mockClear();
  });

  it('should return 401 if no session token in cookie', async () => {
    const request = makeRequest({});
    const { reply, getStatus, getData } = makeReply();

    await authMiddleware(request, reply);

    expect(getStatus()).toBe(401);
    expect(getData().error.code).toBe('UNAUTHORIZED');
    expect(getData().error.message).toBe('Session invalide ou expirée');
  });

  it('should return 401 if session token is invalid', async () => {
    const request = makeRequest({ session_token: 'invalid-token' });
    const { reply, getStatus, getData } = makeReply();

    await authMiddleware(request, reply);

    expect(getStatus()).toBe(401);
    expect(getData().error.code).toBe('UNAUTHORIZED');
  });

  it('should return 401 if session is expired', async () => {
    const [user] = await db
      .insert(users)
      .values({
        username: 'testuser',
        passwordHash: 'hashed_password',
        securityQuestion: 'Test question',
        securityAnswerHash: 'hashed_answer',
      })
      .returning();

    const token = crypto.randomUUID();
    const expiredDate = new Date(Date.now() - 1000);
    await db.insert(sessions).values({
      userId: user.id,
      token,
      expiresAt: expiredDate,
    });

    const request = makeRequest({ session_token: token });
    const { reply, getStatus, getData } = makeReply();

    await authMiddleware(request, reply);

    expect(getStatus()).toBe(401);
    expect(getData().error.code).toBe('UNAUTHORIZED');
  });

  it('should inject userId into request if session is valid', async () => {
    const [user] = await db
      .insert(users)
      .values({
        username: 'testuser',
        passwordHash: 'hashed_password',
        securityQuestion: 'Test question',
        securityAnswerHash: 'hashed_answer',
      })
      .returning();

    const token = crypto.randomUUID();
    const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await db.insert(sessions).values({
      userId: user.id,
      token,
      expiresAt: futureDate,
    });

    const request = makeRequest({ session_token: token });
    const reply = {} as FastifyReply;

    await authMiddleware(request, reply);

    expect((request as any).userId).toBe(user.id);
  });

  it('should allow access with valid non-expired session', async () => {
    const [user] = await db
      .insert(users)
      .values({
        username: 'testuser',
        passwordHash: 'hashed_password',
        securityQuestion: 'Test question',
        securityAnswerHash: 'hashed_answer',
      })
      .returning();

    const token = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
    await db.insert(sessions).values({
      userId: user.id,
      token,
      expiresAt,
    });

    const request = makeRequest({ session_token: token });
    const reply = {} as FastifyReply;

    await authMiddleware(request, reply);

    expect((request as any).userId).toBe(user.id);
  });
});
