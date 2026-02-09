/**
 * Integration Tests: Admin Server Authentication
 *
 * Tests the complete authentication system in Admin Server:
 * - Login with refresh token
 * - Token refresh with rotation
 * - Multiple concurrent sessions
 * - Session revocation
 * - API key authentication
 * - Logout and token revocation
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Pool } from 'pg';
import bcrypt from 'bcryptjs';
import request from 'supertest';
import express from 'express';
import { createAuthRoutes, ensureUsersTable } from '../../src/routes/auth-routes.js';
import { createRefreshRoutes } from '../../src/routes/refresh-routes.js';
import { createSessionRoutes } from '../../src/routes/session-routes.js';
import { TokenService } from '../../src/services/token-service.js';
import { SessionService } from '../../src/services/session-service.js';
import { AuditService } from '../../src/services/audit-service.js';

describe('Admin Server Authentication Integration Tests', () => {
  let pool: Pool;
  let app: express.Express;
  let tokenService: TokenService;
  let sessionService: SessionService;
  let auditService: AuditService;

  const testUser = {
    user_id: 'admin_test_user',
    tenant_id: 'admin_test_tenant',
    username: 'admintestuser',
    password: 'AdminTestPassword123!',
    email: 'admin-test@example.com',
  };

  beforeAll(async () => {
    // Setup test database
    pool = new Pool({
      host: process.env.PGHOST || 'localhost',
      port: Number(process.env.PGPORT) || 5432,
      database: process.env.PGDATABASE || 'agent_memory_test',
      user: process.env.PGUSER || 'postgres',
      password: process.env.PGPASSWORD || '',
    });

    // Run migrations
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        user_id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL,
        username TEXT NOT NULL,
        email TEXT,
        password_hash TEXT NOT NULL,
        roles TEXT[] NOT NULL DEFAULT '{user}',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        last_login TIMESTAMPTZ,
        UNIQUE(tenant_id, username)
      );

      CREATE TABLE IF NOT EXISTS refresh_tokens (
        token_id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        tenant_id TEXT NOT NULL,
        token_hash TEXT NOT NULL UNIQUE,
        expires_at TIMESTAMPTZ NOT NULL,
        rotated_at TIMESTAMPTZ,
        replaced_by TEXT REFERENCES refresh_tokens(token_id) ON DELETE SET NULL,
        revoked_at TIMESTAMPTZ,
        revoked_reason TEXT,
        device_info JSONB DEFAULT '{}'::jsonb,
        last_used_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS sessions (
        session_id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        tenant_id TEXT NOT NULL,
        device_info JSONB NOT NULL DEFAULT '{}'::jsonb,
        ip_address INET,
        user_agent TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        last_activity_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        expires_at TIMESTAMPTZ NOT NULL,
        is_active BOOLEAN NOT NULL DEFAULT true
      );

      CREATE TABLE IF NOT EXISTS audit_logs (
        log_id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL,
        user_id TEXT,
        event_type TEXT NOT NULL,
        resource_type TEXT,
        resource_id TEXT,
        action TEXT NOT NULL,
        outcome TEXT NOT NULL,
        ip_address INET,
        user_agent TEXT,
        details JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    // Initialize services
    tokenService = new TokenService(pool);
    sessionService = new SessionService(pool);
    auditService = new AuditService(pool);

    // Create test user
    const passwordHash = await bcrypt.hash(testUser.password, 12);
    await pool.query(
      `INSERT INTO users (user_id, tenant_id, username, email, password_hash, roles)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [testUser.user_id, testUser.tenant_id, testUser.username, testUser.email, passwordHash, ['user']]
    );

    // Setup Express app
    app = express();
    app.use(express.json());

    const authRoutes = createAuthRoutes(pool, tokenService, sessionService, auditService);
    const refreshRoutes = createRefreshRoutes(tokenService, auditService);
    const sessionRoutes = createSessionRoutes(sessionService, auditService);

    app.use('/auth', authRoutes);
    app.use('/auth', refreshRoutes);
    app.use('/auth', sessionRoutes);
  });

  afterAll(async () => {
    await pool.query('DROP TABLE IF EXISTS audit_logs CASCADE');
    await pool.query('DROP TABLE IF EXISTS sessions CASCADE');
    await pool.query('DROP TABLE IF EXISTS refresh_tokens CASCADE');
    await pool.query('DROP TABLE IF EXISTS users CASCADE');
    await pool.end();
  });

  describe('Login Flow', () => {
    it('should login with valid credentials and receive tokens', async () => {
      const response = await request(app)
        .post('/auth/login')
        .send({
          username: testUser.username,
          password: testUser.password,
          tenant_id: testUser.tenant_id,
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('access_token');
      expect(response.body).toHaveProperty('refresh_token');
      expect(response.body).toHaveProperty('token_type', 'Bearer');
      expect(response.body).toHaveProperty('expires_in');
      expect(response.body).toHaveProperty('refresh_expires_in');
      expect(response.body).toHaveProperty('user');
      expect(response.body.user.user_id).toBe(testUser.user_id);
    });

    it('should reject login with invalid credentials', async () => {
      const response = await request(app)
        .post('/auth/login')
        .send({
          username: testUser.username,
          password: 'WrongPassword123!',
          tenant_id: testUser.tenant_id,
        });

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error', 'Invalid credentials');
    });

    it('should require username and password', async () => {
      const response = await request(app)
        .post('/auth/login')
        .send({
          tenant_id: testUser.tenant_id,
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('Registration Flow', () => {
    it('should register a new user', async () => {
      const response = await request(app)
        .post('/auth/register')
        .send({
          username: `newuser_${Date.now()}`,
          password: 'NewUserPassword123!',
          tenant_id: testUser.tenant_id,
          email: 'newuser@example.com',
        });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('access_token');
      expect(response.body).toHaveProperty('refresh_token');
      expect(response.body.user).toHaveProperty('user_id');
      expect(response.body.user.roles).toEqual(['user']);
    });

    it('should reject duplicate username', async () => {
      const response = await request(app)
        .post('/auth/register')
        .send({
          username: testUser.username,
          password: 'Password123!',
          tenant_id: testUser.tenant_id,
        });

      expect(response.status).toBe(409);
      expect(response.body).toHaveProperty('error', 'User already exists');
    });
  });

  describe('Token Refresh Flow', () => {
    let refreshToken: string;
    let accessToken: string;

    beforeEach(async () => {
      const loginResponse = await request(app)
        .post('/auth/login')
        .send({
          username: testUser.username,
          password: testUser.password,
          tenant_id: testUser.tenant_id,
        });

      refreshToken = loginResponse.body.refresh_token;
      accessToken = loginResponse.body.access_token;
    });

    it('should refresh access token using refresh token', async () => {
      const response = await request(app)
        .post('/auth/token/refresh')
        .send({ refresh_token: refreshToken });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('access_token');
      expect(response.body).toHaveProperty('refresh_token');
    });

    it('should rotate refresh tokens on refresh', async () => {
      const response1 = await request(app)
        .post('/auth/token/refresh')
        .send({ refresh_token: refreshToken });

      const newRefreshToken = response1.body.refresh_token;

      // Old token should be revoked
      const response2 = await request(app)
        .post('/auth/token/refresh')
        .send({ refresh_token: refreshToken });

      expect(response2.status).toBe(401);

      // New token should work
      const response3 = await request(app)
        .post('/auth/token/refresh')
        .send({ refresh_token: newRefreshToken });

      expect(response3.status).toBe(200);
    });

    it('should detect token theft attempt', async () => {
      // First refresh
      const response1 = await request(app)
        .post('/auth/token/refresh')
        .send({ refresh_token: refreshToken });

      const newToken = response1.body.refresh_token;

      // Try to use old token again (theft detection)
      const response2 = await request(app)
        .post('/auth/token/refresh')
        .send({ refresh_token: refreshToken });

      expect(response2.status).toBe(403);
      expect(response2.body.error).toContain('theft detected');
    });

    it('should reject invalid refresh token', async () => {
      const response = await request(app)
        .post('/auth/token/refresh')
        .send({ refresh_token: 'invalid_token' });

      expect(response.status).toBe(401);
    });
  });

  describe('Session Management Flow', () => {
    let accessToken: string;

    beforeEach(async () => {
      const loginResponse = await request(app)
        .post('/auth/login')
        .send({
          username: testUser.username,
          password: testUser.password,
          tenant_id: testUser.tenant_id,
        });

      accessToken = loginResponse.body.access_token;
    });

    it('should list active sessions', async () => {
      const response = await request(app)
        .get('/auth/sessions')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('sessions');
      expect(Array.isArray(response.body.sessions)).toBe(true);
      expect(response.body.sessions.length).toBeGreaterThan(0);
    });

    it('should get session statistics', async () => {
      const response = await request(app)
        .get('/auth/sessions/stats')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('active');
      expect(response.body).toHaveProperty('total');
      expect(response.body).toHaveProperty('uniqueDevices');
      expect(response.body).toHaveProperty('uniqueIPs');
    });

    it('should revoke a specific session', async () => {
      const sessionsResponse = await request(app)
        .get('/auth/sessions')
        .set('Authorization', `Bearer ${accessToken}`);

      const sessionId = sessionsResponse.body.sessions[0].session_id;

      const response = await request(app)
        .delete(`/auth/sessions/${sessionId}`)
        .set('Authorization', `Bearer ${accessToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message');
    });

    it('should revoke all sessions except current', async () => {
      // Create multiple sessions
      await request(app)
        .post('/auth/login')
        .send({
          username: testUser.username,
          password: testUser.password,
          tenant_id: testUser.tenant_id,
        });

      await request(app)
        .post('/auth/login')
        .send({
          username: testUser.username,
          password: testUser.password,
          tenant_id: testUser.tenant_id,
        });

      const response = await request(app)
        .delete('/auth/sessions')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({});

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('revoked_count');
      expect(response.body.revoked_count).toBeGreaterThan(0);
    });
  });

  describe('Logout Flow', () => {
    it('should revoke refresh token on logout', async () => {
      const loginResponse = await request(app)
        .post('/auth/login')
        .send({
          username: testUser.username,
          password: testUser.password,
          tenant_id: testUser.tenant_id,
        });

      const refreshToken = loginResponse.body.refresh_token;

      const logoutResponse = await request(app)
        .post('/auth/token/revoke')
        .send({ refresh_token: refreshToken });

      expect(logoutResponse.status).toBe(200);

      // Try to refresh with revoked token
      const refreshResponse = await request(app)
        .post('/auth/token/refresh')
        .send({ refresh_token: refreshToken });

      expect(refreshResponse.status).toBe(401);
    });
  });

  describe('Token Management', () => {
    let accessToken: string;

    beforeEach(async () => {
      const loginResponse = await request(app)
        .post('/auth/login')
        .send({
          username: testUser.username,
          password: testUser.password,
          tenant_id: testUser.tenant_id,
        });

      accessToken = loginResponse.body.access_token;
    });

    it('should list active tokens', async () => {
      const response = await request(app)
        .get('/auth/tokens')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('tokens');
      expect(Array.isArray(response.body.tokens)).toBe(true);
      expect(response.body.count).toBeGreaterThan(0);
    });

    it('should revoke all tokens', async () => {
      const response = await request(app)
        .post('/auth/tokens/revoke-all')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ reason: 'test' });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message');
    });
  });

  describe('Token Validation', () => {
    it('should validate a valid token', async () => {
      const loginResponse = await request(app)
        .post('/auth/login')
        .send({
          username: testUser.username,
          password: testUser.password,
          tenant_id: testUser.tenant_id,
        });

      const response = await request(app)
        .post('/auth/validate')
        .send({ token: loginResponse.body.access_token });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('valid', true);
      expect(response.body.user).toHaveProperty('user_id');
    });

    it('should reject invalid token', async () => {
      const response = await request(app)
        .post('/auth/validate')
        .send({ token: 'invalid_token' });

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('valid', false);
    });
  });

  describe('Concurrent Sessions Flow', () => {
    it('should handle multiple concurrent sessions', async () => {
      // Create 3 sessions
      const session1 = await request(app)
        .post('/auth/login')
        .send({
          username: testUser.username,
          password: testUser.password,
          tenant_id: testUser.tenant_id,
        });

      const session2 = await request(app)
        .post('/auth/login')
        .send({
          username: testUser.username,
          password: testUser.password,
          tenant_id: testUser.tenant_id,
        });

      const session3 = await request(app)
        .post('/auth/login')
        .send({
          username: testUser.username,
          password: testUser.password,
          tenant_id: testUser.tenant_id,
        });

      // All should have valid tokens
      expect(session1.body.access_token).toBeDefined();
      expect(session2.body.access_token).toBeDefined();
      expect(session3.body.access_token).toBeDefined();

      // Check session count
      const sessionsResponse = await request(app)
        .get('/auth/sessions')
        .set('Authorization', `Bearer ${session1.body.access_token}`);

      expect(sessionsResponse.body.count).toBeGreaterThanOrEqual(3);
    });
  });
});
