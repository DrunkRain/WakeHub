import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
import fastifyCookie from '@fastify/cookie';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { eq } from 'drizzle-orm';
import { unlinkSync } from 'node:fs';
import * as schema from '../db/schema.js';
import authRoutes from './auth.js';

const TEST_DB_PATH = './test-auth-db.sqlite';

describe('POST /api/auth/register', () => {
  let app: FastifyInstance;
  let db: ReturnType<typeof drizzle>;
  let sqlite: Database.Database;

  beforeAll(async () => {
    // Setup test database
    sqlite = new Database(TEST_DB_PATH);
    sqlite.pragma('journal_mode = WAL');
    sqlite.pragma('foreign_keys = ON');
    db = drizzle(sqlite, { schema });
    migrate(db, { migrationsFolder: './drizzle' });

    // Setup Fastify app
    app = Fastify();
    await app.register(fastifyCookie);

    // Inject db into app context for routes
    app.decorate('db', db as any);

    await app.register(authRoutes);
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
    sqlite.close();
    try {
      unlinkSync(TEST_DB_PATH);
      unlinkSync(`${TEST_DB_PATH}-shm`);
      unlinkSync(`${TEST_DB_PATH}-wal`);
    } catch {
      // Ignore cleanup errors
    }
  });

  beforeEach(() => {
    // Clean all tables before each test
    sqlite.prepare('DELETE FROM sessions').run();
    sqlite.prepare('DELETE FROM users').run();
    sqlite.prepare('DELETE FROM operation_logs').run();
  });

  it('should register a new user successfully', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        username: 'testuser',
        password: 'SecurePass123',
        passwordConfirm: 'SecurePass123',
        securityQuestion: 'Quel est le nom de votre premier animal de compagnie ?',
        securityAnswer: 'Max',
      },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body).toHaveProperty('data');
    expect(body.data).toHaveProperty('userId');
    expect(body.data).toHaveProperty('username', 'testuser');

    // Should set a session cookie
    const cookies = response.cookies;
    expect(cookies).toBeDefined();
    expect(cookies.length).toBeGreaterThan(0);
  });

  it('should reject password shorter than 8 characters', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        username: 'testuser',
        password: 'Short1',
        passwordConfirm: 'Short1',
        securityQuestion: 'Question?',
        securityAnswer: 'Answer',
      },
    });

    expect(response.statusCode).toBe(400);
    const body = JSON.parse(response.body);
    expect(body).toHaveProperty('error');
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  it('should reject mismatched password confirmation', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        username: 'testuser',
        password: 'SecurePass123',
        passwordConfirm: 'DifferentPass123',
        securityQuestion: 'Question?',
        securityAnswer: 'Answer',
      },
    });

    expect(response.statusCode).toBe(400);
    const body = JSON.parse(response.body);
    expect(body).toHaveProperty('error');
    expect(body.error.code).toBe('PASSWORD_MISMATCH');
  });

  it('should reject if user already exists', async () => {
    // Register first user
    await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        username: 'testuser',
        password: 'SecurePass123',
        passwordConfirm: 'SecurePass123',
        securityQuestion: 'Question?',
        securityAnswer: 'Answer',
      },
    });

    // Try to register again with same username
    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        username: 'testuser',
        password: 'SecurePass456',
        passwordConfirm: 'SecurePass456',
        securityQuestion: 'Question?',
        securityAnswer: 'Answer',
      },
    });

    expect(response.statusCode).toBe(400);
    const body = JSON.parse(response.body);
    expect(body).toHaveProperty('error');
    expect(body.error.code).toBe('USER_ALREADY_EXISTS');
  });

  it('should hash password and security answer', async () => {
    await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        username: 'testuser',
        password: 'SecurePass123',
        passwordConfirm: 'SecurePass123',
        securityQuestion: 'Question?',
        securityAnswer: 'Answer',
      },
    });

    const user = sqlite
      .prepare('SELECT password_hash, security_answer_hash FROM users WHERE username = ?')
      .get('testuser') as { password_hash: string; security_answer_hash: string } | undefined;

    expect(user).toBeDefined();
    if (!user) throw new Error('User should exist');

    expect(user.password_hash).not.toBe('SecurePass123');
    expect(user.security_answer_hash).not.toBe('Answer');
    expect(user.password_hash).toContain('$argon2');
    expect(user.security_answer_hash).toContain('$argon2');
  });

  it('should log operation to operation_logs', async () => {
    await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        username: 'testuser',
        password: 'SecurePass123',
        passwordConfirm: 'SecurePass123',
        securityQuestion: 'Question?',
        securityAnswer: 'Answer',
      },
    });

    const logs = sqlite
      .prepare('SELECT * FROM operation_logs WHERE source = ? AND message LIKE ?')
      .all('auth', '%created%') as Array<{ source: string; level: string; message: string }>;

    expect(logs.length).toBeGreaterThan(0);
    const firstLog = logs[0];
    if (!firstLog) throw new Error('Log should exist');

    expect(firstLog.source).toBe('auth');
    expect(firstLog.level).toBe('info');
  });
});

describe('GET /api/auth/check-setup', () => {
  let app: FastifyInstance;
  let db: ReturnType<typeof drizzle>;
  let sqlite: Database.Database;

  beforeAll(async () => {
    sqlite = new Database(TEST_DB_PATH);
    sqlite.pragma('journal_mode = WAL');
    sqlite.pragma('foreign_keys = ON');
    db = drizzle(sqlite, { schema });
    migrate(db, { migrationsFolder: './drizzle' });

    app = Fastify();
    await app.register(fastifyCookie);
    app.decorate('db', db as any);
    await app.register(authRoutes);
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
    sqlite.close();
    try {
      unlinkSync(TEST_DB_PATH);
      unlinkSync(`${TEST_DB_PATH}-shm`);
      unlinkSync(`${TEST_DB_PATH}-wal`);
    } catch {
      // Ignore cleanup errors
    }
  });

  beforeEach(() => {
    sqlite.prepare('DELETE FROM sessions').run();
    sqlite.prepare('DELETE FROM users').run();
  });

  it('should return setupComplete: false when no users exist', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/auth/check-setup',
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body).toHaveProperty('data');
    expect(body.data).toHaveProperty('setupComplete', false);
  });

  it('should return setupComplete: true when user exists', async () => {
    // Create a user first
    await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        username: 'testuser',
        password: 'SecurePass123',
        passwordConfirm: 'SecurePass123',
        securityQuestion: 'Question?',
        securityAnswer: 'Answer',
      },
    });

    const response = await app.inject({
      method: 'GET',
      url: '/api/auth/check-setup',
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body).toHaveProperty('data');
    expect(body.data).toHaveProperty('setupComplete', true);
  });
});

describe('POST /api/auth/login - Story 1.4', () => {
  let app: FastifyInstance;
  let db: ReturnType<typeof drizzle>;
  let sqlite: Database.Database;

  beforeAll(async () => {
    sqlite = new Database(TEST_DB_PATH);
    sqlite.pragma('journal_mode = WAL');
    sqlite.pragma('foreign_keys = ON');
    db = drizzle(sqlite, { schema });
    migrate(db, { migrationsFolder: './drizzle' });

    app = Fastify();
    await app.register(fastifyCookie);
    app.decorate('db', db as any);
    await app.register(authRoutes);
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
    sqlite.close();
    try {
      unlinkSync(TEST_DB_PATH);
      unlinkSync(`${TEST_DB_PATH}-shm`);
      unlinkSync(`${TEST_DB_PATH}-wal`);
    } catch {
      // Ignore cleanup errors
    }
  });

  beforeEach(() => {
    sqlite.prepare('DELETE FROM sessions').run();
    sqlite.prepare('DELETE FROM users').run();
    sqlite.prepare('DELETE FROM operation_logs').run();
  });

  it('should login with valid credentials', async () => {
    // Register a user first
    await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        username: 'testuser',
        password: 'SecurePass123',
        passwordConfirm: 'SecurePass123',
        securityQuestion: 'Question?',
        securityAnswer: 'Answer',
      },
    });

    // Login
    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: {
        username: 'testuser',
        password: 'SecurePass123',
      },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body).toHaveProperty('data');
    expect(body.data).toHaveProperty('userId');
    expect(body.data).toHaveProperty('username', 'testuser');

    // Should set session_token cookie
    const cookies = response.cookies;
    expect(cookies).toBeDefined();
    const sessionCookie = cookies.find((c) => c.name === 'session_token');
    expect(sessionCookie).toBeDefined();
    expect(sessionCookie?.value).toBeDefined();
  });

  it('should reject login with invalid username', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: {
        username: 'nonexistent',
        password: 'SomePass123',
      },
    });

    expect(response.statusCode).toBe(401);
    const body = JSON.parse(response.body);
    expect(body).toHaveProperty('error');
    expect(body.error.code).toBe('INVALID_CREDENTIALS');
    expect(body.error.message).toBe('Identifiants incorrects');
  });

  it('should reject login with invalid password', async () => {
    // Register a user first
    await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        username: 'testuser',
        password: 'SecurePass123',
        passwordConfirm: 'SecurePass123',
        securityQuestion: 'Question?',
        securityAnswer: 'Answer',
      },
    });

    // Try login with wrong password
    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: {
        username: 'testuser',
        password: 'WrongPass123',
      },
    });

    expect(response.statusCode).toBe(401);
    const body = JSON.parse(response.body);
    expect(body).toHaveProperty('error');
    expect(body.error.code).toBe('INVALID_CREDENTIALS');
  });

  it('should create session with 24h expiry by default', async () => {
    // Register and login
    await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        username: 'testuser',
        password: 'SecurePass123',
        passwordConfirm: 'SecurePass123',
        securityQuestion: 'Question?',
        securityAnswer: 'Answer',
      },
    });

    const before = Date.now();
    const loginResponse = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: {
        username: 'testuser',
        password: 'SecurePass123',
        rememberMe: false,
      },
    });
    const after = Date.now();

    // Get session token from login response cookie to find the exact login session
    const sessionCookie = loginResponse.cookies.find((c) => c.name === 'session_token');
    expect(sessionCookie).toBeDefined();

    const [session] = await db
      .select()
      .from(schema.sessions)
      .where(eq(schema.sessions.token, sessionCookie!.value))
      .limit(1);

    expect(session).toBeDefined();
    if (!session) throw new Error('Session should exist');

    // Drizzle returns expiresAt as a Date object
    const expiresAtMs = session.expiresAt instanceof Date ? session.expiresAt.getTime() : session.expiresAt;
    const expectedMin = before + 24 * 60 * 60 * 1000 - 60 * 1000; // 24h - 1 minute tolerance
    const expectedMax = after + 24 * 60 * 60 * 1000 + 60 * 1000; // 24h + 1 minute tolerance

    expect(expiresAtMs).toBeGreaterThanOrEqual(expectedMin);
    expect(expiresAtMs).toBeLessThanOrEqual(expectedMax);
  });

  it('should create session with 30 days expiry when rememberMe is true', async () => {
    // Register and login with rememberMe
    await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        username: 'testuser',
        password: 'SecurePass123',
        passwordConfirm: 'SecurePass123',
        securityQuestion: 'Question?',
        securityAnswer: 'Answer',
      },
    });

    const before = Date.now();
    const loginResponse = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: {
        username: 'testuser',
        password: 'SecurePass123',
        rememberMe: true,
      },
    });
    const after = Date.now();

    // Get session token from login response cookie to find the exact login session
    const sessionCookie = loginResponse.cookies.find((c) => c.name === 'session_token');
    expect(sessionCookie).toBeDefined();

    const [session] = await db
      .select()
      .from(schema.sessions)
      .where(eq(schema.sessions.token, sessionCookie!.value))
      .limit(1);

    expect(session).toBeDefined();
    if (!session) throw new Error('Session should exist');

    // Drizzle returns expiresAt as a Date object
    const expiresAtMs = session.expiresAt instanceof Date ? session.expiresAt.getTime() : session.expiresAt;
    const expectedMin = before + 30 * 24 * 60 * 60 * 1000 - 60 * 1000; // 30 days - 1 minute tolerance
    const expectedMax = after + 30 * 24 * 60 * 60 * 1000 + 60 * 1000; // 30 days + 1 minute tolerance

    expect(expiresAtMs).toBeGreaterThanOrEqual(expectedMin);
    expect(expiresAtMs).toBeLessThanOrEqual(expectedMax);
  });

  it('should log login operation', async () => {
    await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        username: 'testuser',
        password: 'SecurePass123',
        passwordConfirm: 'SecurePass123',
        securityQuestion: 'Question?',
        securityAnswer: 'Answer',
      },
    });

    await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: {
        username: 'testuser',
        password: 'SecurePass123',
      },
    });

    const logs = sqlite
      .prepare('SELECT * FROM operation_logs WHERE message LIKE ?')
      .all('%logged in%') as Array<{ source: string; level: string }>;

    expect(logs.length).toBeGreaterThan(0);
    const firstLog = logs[0];
    if (!firstLog) throw new Error('Log should exist');

    expect(firstLog.source).toBe('auth');
    expect(firstLog.level).toBe('info');
  });
});

describe('POST /api/auth/logout - Story 1.4', () => {
  let app: FastifyInstance;
  let db: ReturnType<typeof drizzle>;
  let sqlite: Database.Database;

  beforeAll(async () => {
    sqlite = new Database(TEST_DB_PATH);
    sqlite.pragma('journal_mode = WAL');
    sqlite.pragma('foreign_keys = ON');
    db = drizzle(sqlite, { schema });
    migrate(db, { migrationsFolder: './drizzle' });

    app = Fastify();
    await app.register(fastifyCookie);
    app.decorate('db', db as any);
    await app.register(authRoutes);
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
    sqlite.close();
    try {
      unlinkSync(TEST_DB_PATH);
      unlinkSync(`${TEST_DB_PATH}-shm`);
      unlinkSync(`${TEST_DB_PATH}-wal`);
    } catch {
      // Ignore cleanup errors
    }
  });

  beforeEach(() => {
    sqlite.prepare('DELETE FROM sessions').run();
    sqlite.prepare('DELETE FROM users').run();
    sqlite.prepare('DELETE FROM operation_logs').run();
  });

  it('should logout and delete session', async () => {
    // Register and login
    await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        username: 'testuser',
        password: 'SecurePass123',
        passwordConfirm: 'SecurePass123',
        securityQuestion: 'Question?',
        securityAnswer: 'Answer',
      },
    });

    const loginResponse = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: {
        username: 'testuser',
        password: 'SecurePass123',
      },
    });

    const sessionCookie = loginResponse.cookies.find((c) => c.name === 'session_token');
    expect(sessionCookie).toBeDefined();

    // Get session count before logout (should have 2: one from register, one from login)
    const sessionsBeforeLogout = sqlite.prepare('SELECT * FROM sessions').all();
    const initialCount = sessionsBeforeLogout.length;
    expect(initialCount).toBeGreaterThan(0);

    // Logout
    const logoutResponse = await app.inject({
      method: 'POST',
      url: '/api/auth/logout',
      cookies: { session_token: sessionCookie!.value },
    });

    expect(logoutResponse.statusCode).toBe(200);
    const body = JSON.parse(logoutResponse.body);
    expect(body.data.success).toBe(true);

    // Verify the login session was deleted (should have 1 less session)
    const sessionsAfterLogout = sqlite.prepare('SELECT * FROM sessions').all();
    expect(sessionsAfterLogout.length).toBe(initialCount - 1);
  });

  it('should clear session_token cookie', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/logout',
    });

    expect(response.statusCode).toBe(200);
    const setCookieHeader = response.headers['set-cookie'];
    expect(setCookieHeader).toBeDefined();
    const cookieString = Array.isArray(setCookieHeader) ? setCookieHeader[0] : setCookieHeader;
    expect(cookieString).toContain('session_token');
    expect(cookieString).toMatch(/Expires=Thu, 01 Jan 1970/);
  });

  it('should log logout operation', async () => {
    // First register and login to have a valid session
    await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        username: 'testuser',
        password: 'SecurePass123',
        passwordConfirm: 'SecurePass123',
        securityQuestion: 'Question?',
        securityAnswer: 'Answer',
      },
    });

    const loginResponse = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: {
        username: 'testuser',
        password: 'SecurePass123',
      },
    });

    const sessionCookie = loginResponse.cookies.find((c) => c.name === 'session_token');

    // Clear logs before logout
    sqlite.prepare('DELETE FROM operation_logs').run();

    // Now logout
    await app.inject({
      method: 'POST',
      url: '/api/auth/logout',
      cookies: { session_token: sessionCookie!.value },
    });

    const logs = sqlite
      .prepare('SELECT * FROM operation_logs WHERE message LIKE ?')
      .all('%logged out%') as Array<{ source: string; level: string }>;

    expect(logs.length).toBeGreaterThan(0);
    const firstLog = logs[0];
    if (!firstLog) throw new Error('Log should exist');

    expect(firstLog.source).toBe('auth');
    expect(firstLog.level).toBe('info');
  });
});

describe('GET /api/auth/me - Story 1.4', () => {
  let app: FastifyInstance;
  let db: ReturnType<typeof drizzle>;
  let sqlite: Database.Database;

  beforeAll(async () => {
    sqlite = new Database(TEST_DB_PATH);
    sqlite.pragma('journal_mode = WAL');
    sqlite.pragma('foreign_keys = ON');
    db = drizzle(sqlite, { schema });
    migrate(db, { migrationsFolder: './drizzle' });

    app = Fastify();
    await app.register(fastifyCookie);
    app.decorate('db', db as any);
    await app.register(authRoutes);
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
    sqlite.close();
    try {
      unlinkSync(TEST_DB_PATH);
      unlinkSync(`${TEST_DB_PATH}-shm`);
      unlinkSync(`${TEST_DB_PATH}-wal`);
    } catch {
      // Ignore cleanup errors
    }
  });

  beforeEach(() => {
    sqlite.prepare('DELETE FROM sessions').run();
    sqlite.prepare('DELETE FROM users').run();
  });

  it('should return user data with valid session', async () => {
    // Register and login
    await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        username: 'testuser',
        password: 'SecurePass123',
        passwordConfirm: 'SecurePass123',
        securityQuestion: 'Question?',
        securityAnswer: 'Answer',
      },
    });

    const loginResponse = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: {
        username: 'testuser',
        password: 'SecurePass123',
      },
    });

    const sessionCookie = loginResponse.cookies.find((c) => c.name === 'session_token');

    // Get current user
    const response = await app.inject({
      method: 'GET',
      url: '/api/auth/me',
      cookies: { session_token: sessionCookie!.value },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.data).toHaveProperty('userId');
    expect(body.data).toHaveProperty('username', 'testuser');
  });

  it('should return 401 without session cookie', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/auth/me',
    });

    expect(response.statusCode).toBe(401);
    const body = JSON.parse(response.body);
    expect(body.error.code).toBe('UNAUTHORIZED');
  });

  it('should return 401 with expired session', async () => {
    // Register and login
    await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        username: 'testuser',
        password: 'SecurePass123',
        passwordConfirm: 'SecurePass123',
        securityQuestion: 'Question?',
        securityAnswer: 'Answer',
      },
    });

    const loginResponse = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: {
        username: 'testuser',
        password: 'SecurePass123',
      },
    });

    const sessionCookie = loginResponse.cookies.find((c) => c.name === 'session_token');

    // Manually expire the session using Drizzle (handles timestamp conversion)
    const expiredDate = new Date(Date.now() - 10000); // 10 seconds ago
    await db
      .update(schema.sessions)
      .set({ expiresAt: expiredDate })
      .where(eq(schema.sessions.token, sessionCookie!.value));

    // Verify the session was actually updated
    const [session] = await db
      .select()
      .from(schema.sessions)
      .where(eq(schema.sessions.token, sessionCookie!.value))
      .limit(1);
    expect(session).toBeDefined();
    expect(session.expiresAt).toBeInstanceOf(Date);
    expect(session.expiresAt.getTime()).toBeLessThan(Date.now());

    // Try to get current user
    const response = await app.inject({
      method: 'GET',
      url: '/api/auth/me',
      cookies: { session_token: sessionCookie!.value },
    });

    expect(response.statusCode).toBe(401);
    const body = JSON.parse(response.body);
    expect(body.error.code).toBe('UNAUTHORIZED');
  });
});

describe('POST /api/auth/get-security-question - Story 1.5', () => {
  let app: FastifyInstance;
  let db: ReturnType<typeof drizzle>;
  let sqlite: Database.Database;

  beforeAll(async () => {
    sqlite = new Database(TEST_DB_PATH);
    sqlite.pragma('journal_mode = WAL');
    sqlite.pragma('foreign_keys = ON');
    db = drizzle(sqlite, { schema });
    migrate(db, { migrationsFolder: './drizzle' });

    app = Fastify();
    await app.register(fastifyCookie);
    app.decorate('db', db as any);
    await app.register(authRoutes);
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
    sqlite.close();
    try {
      unlinkSync(TEST_DB_PATH);
      unlinkSync(`${TEST_DB_PATH}-shm`);
      unlinkSync(`${TEST_DB_PATH}-wal`);
    } catch {
      // Ignore cleanup errors
    }
  });

  beforeEach(() => {
    sqlite.prepare('DELETE FROM sessions').run();
    sqlite.prepare('DELETE FROM users').run();
    sqlite.prepare('DELETE FROM operation_logs').run();
  });

  it('should return security question for valid user', async () => {
    // Register a user
    await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        username: 'testuser',
        password: 'SecurePass123',
        passwordConfirm: 'SecurePass123',
        securityQuestion: 'Quel est le nom de votre premier animal ?',
        securityAnswer: 'Max',
      },
    });

    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/get-security-question',
      payload: { username: 'testuser' },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.data.securityQuestion).toBe('Quel est le nom de votre premier animal ?');
  });

  it('should return generic error for non-existent user', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/get-security-question',
      payload: { username: 'nonexistent' },
    });

    expect(response.statusCode).toBe(400);
    const body = JSON.parse(response.body);
    expect(body.error.code).toBe('INVALID_REQUEST');
    expect(body.error.message).toBe('Impossible de traiter la demande');
  });

  it('should reject username shorter than 3 characters', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/get-security-question',
      payload: { username: 'ab' },
    });

    expect(response.statusCode).toBe(400);
    const body = JSON.parse(response.body);
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });
});

describe('POST /api/auth/reset-password - Story 1.5', () => {
  let app: FastifyInstance;
  let db: ReturnType<typeof drizzle>;
  let sqlite: Database.Database;

  beforeAll(async () => {
    sqlite = new Database(TEST_DB_PATH);
    sqlite.pragma('journal_mode = WAL');
    sqlite.pragma('foreign_keys = ON');
    db = drizzle(sqlite, { schema });
    migrate(db, { migrationsFolder: './drizzle' });

    app = Fastify();
    await app.register(fastifyCookie);
    app.decorate('db', db as any);
    await app.register(authRoutes);
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
    sqlite.close();
    try {
      unlinkSync(TEST_DB_PATH);
      unlinkSync(`${TEST_DB_PATH}-shm`);
      unlinkSync(`${TEST_DB_PATH}-wal`);
    } catch {
      // Ignore cleanup errors
    }
  });

  beforeEach(() => {
    sqlite.prepare('DELETE FROM sessions').run();
    sqlite.prepare('DELETE FROM users').run();
    sqlite.prepare('DELETE FROM operation_logs').run();
  });

  it('should reset password with correct security answer', async () => {
    // Register a user
    await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        username: 'testuser',
        password: 'SecurePass123',
        passwordConfirm: 'SecurePass123',
        securityQuestion: 'Question?',
        securityAnswer: 'Answer',
      },
    });

    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/reset-password',
      payload: {
        username: 'testuser',
        securityAnswer: 'Answer',
        newPassword: 'NewSecurePass456',
        newPasswordConfirm: 'NewSecurePass456',
      },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.data.success).toBe(true);
  });

  it('should allow login with new password after reset', async () => {
    await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        username: 'testuser',
        password: 'SecurePass123',
        passwordConfirm: 'SecurePass123',
        securityQuestion: 'Question?',
        securityAnswer: 'Answer',
      },
    });

    await app.inject({
      method: 'POST',
      url: '/api/auth/reset-password',
      payload: {
        username: 'testuser',
        securityAnswer: 'Answer',
        newPassword: 'NewSecurePass456',
        newPasswordConfirm: 'NewSecurePass456',
      },
    });

    // Login with new password
    const loginResponse = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { username: 'testuser', password: 'NewSecurePass456' },
    });

    expect(loginResponse.statusCode).toBe(200);
    const body = JSON.parse(loginResponse.body);
    expect(body.data.username).toBe('testuser');
  });

  it('should reject login with old password after reset', async () => {
    await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        username: 'testuser',
        password: 'SecurePass123',
        passwordConfirm: 'SecurePass123',
        securityQuestion: 'Question?',
        securityAnswer: 'Answer',
      },
    });

    await app.inject({
      method: 'POST',
      url: '/api/auth/reset-password',
      payload: {
        username: 'testuser',
        securityAnswer: 'Answer',
        newPassword: 'NewSecurePass456',
        newPasswordConfirm: 'NewSecurePass456',
      },
    });

    // Login with old password should fail
    const loginResponse = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { username: 'testuser', password: 'SecurePass123' },
    });

    expect(loginResponse.statusCode).toBe(401);
    const body = JSON.parse(loginResponse.body);
    expect(body.error.code).toBe('INVALID_CREDENTIALS');
  });

  it('should invalidate all sessions after reset', async () => {
    await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        username: 'testuser',
        password: 'SecurePass123',
        passwordConfirm: 'SecurePass123',
        securityQuestion: 'Question?',
        securityAnswer: 'Answer',
      },
    });

    // Login to create additional session
    await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { username: 'testuser', password: 'SecurePass123' },
    });

    // Should have 2 sessions (register + login)
    const sessionsBefore = sqlite.prepare('SELECT * FROM sessions').all();
    expect(sessionsBefore.length).toBe(2);

    // Reset password
    await app.inject({
      method: 'POST',
      url: '/api/auth/reset-password',
      payload: {
        username: 'testuser',
        securityAnswer: 'Answer',
        newPassword: 'NewSecurePass456',
        newPasswordConfirm: 'NewSecurePass456',
      },
    });

    // All sessions should be deleted
    const sessionsAfter = sqlite.prepare('SELECT * FROM sessions').all();
    expect(sessionsAfter.length).toBe(0);
  });

  it('should reject with wrong security answer', async () => {
    await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        username: 'testuser',
        password: 'SecurePass123',
        passwordConfirm: 'SecurePass123',
        securityQuestion: 'Question?',
        securityAnswer: 'Answer',
      },
    });

    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/reset-password',
      payload: {
        username: 'testuser',
        securityAnswer: 'WrongAnswer',
        newPassword: 'NewSecurePass456',
        newPasswordConfirm: 'NewSecurePass456',
      },
    });

    expect(response.statusCode).toBe(400);
    const body = JSON.parse(response.body);
    expect(body.error.code).toBe('INVALID_SECURITY_ANSWER');
    expect(body.error.message).toBe('Reponse incorrecte');
  });

  it('should return same error for non-existent user as wrong answer', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/reset-password',
      payload: {
        username: 'nonexistent',
        securityAnswer: 'Answer',
        newPassword: 'NewSecurePass456',
        newPasswordConfirm: 'NewSecurePass456',
      },
    });

    expect(response.statusCode).toBe(400);
    const body = JSON.parse(response.body);
    expect(body.error.code).toBe('INVALID_SECURITY_ANSWER');
    expect(body.error.message).toBe('Reponse incorrecte');
  });

  it('should reject password mismatch', async () => {
    await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        username: 'testuser',
        password: 'SecurePass123',
        passwordConfirm: 'SecurePass123',
        securityQuestion: 'Question?',
        securityAnswer: 'Answer',
      },
    });

    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/reset-password',
      payload: {
        username: 'testuser',
        securityAnswer: 'Answer',
        newPassword: 'NewSecurePass456',
        newPasswordConfirm: 'DifferentPass789',
      },
    });

    expect(response.statusCode).toBe(400);
    const body = JSON.parse(response.body);
    expect(body.error.code).toBe('PASSWORD_MISMATCH');
  });

  it('should reject password shorter than 8 characters', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/reset-password',
      payload: {
        username: 'testuser',
        securityAnswer: 'Answer',
        newPassword: 'Short1',
        newPasswordConfirm: 'Short1',
      },
    });

    expect(response.statusCode).toBe(400);
    const body = JSON.parse(response.body);
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  it('should log password reset operation', async () => {
    await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        username: 'testuser',
        password: 'SecurePass123',
        passwordConfirm: 'SecurePass123',
        securityQuestion: 'Question?',
        securityAnswer: 'Answer',
      },
    });

    // Clear logs before reset
    sqlite.prepare('DELETE FROM operation_logs').run();

    await app.inject({
      method: 'POST',
      url: '/api/auth/reset-password',
      payload: {
        username: 'testuser',
        securityAnswer: 'Answer',
        newPassword: 'NewSecurePass456',
        newPasswordConfirm: 'NewSecurePass456',
      },
    });

    const logs = sqlite
      .prepare('SELECT * FROM operation_logs WHERE message LIKE ? AND reason = ?')
      .all('%Password reset%', 'password-reset') as Array<{ source: string; level: string; reason: string }>;

    expect(logs.length).toBe(1);
    expect(logs[0]!.source).toBe('auth');
    expect(logs[0]!.level).toBe('info');
    expect(logs[0]!.reason).toBe('password-reset');
  });
});
