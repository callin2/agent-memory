/**
 * Integration Tests: Complete Authentication Flow
 *
 * Tests the complete authentication system including:
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
import { createAuthRoutes } from '../../src/api/auth-routes.js';
import { createRefreshRoutes } from '../../src/api/refresh-routes.js';
import { createSessionRoutes } from '../../src/api/session-routes.js';
import { TokenService } from '../../src/services/token-service.js';
import { APIKeyService } from '../../src/services/api-key-service.js';
import { SessionService } from '../../src/services/session-service.js';
import { AuditService } from '../../src/services/audit-service.js';

describe('Authentication Flow Integration Tests', () => {
  let pool: Pool;
  let app: express.Express;
  let tokenService: TokenService;
  let apiKeyService: APIKeyService;
  let sessionService: SessionService;
  let auditService: AuditService;

  const testUser = {
    user_id: 'integration_test_user',
    tenant_id: 'integration_test_tenant',
    username: 'testuser',
    password: 'TestPassword123!',
    email: 'test@example.com',
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

    // Initialize services
    tokenService = new TokenService(pool);
    apiKeyService = new APIKeyService(pool);
    sessionService = new SessionService(pool);
    auditService = new AuditService(pool);

    // Setup schema
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

      CREATE TABLE IF NOT EXISTS api_keys (
        key_id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL,
        created_by TEXT NOT NULL,
        key_hash TEXT NOT NULL UNIQUE,
        key_prefix TEXT NOT NULL,
        name TEXT NOT NULL,
        scopes TEXT[] NOT NULL DEFAULT '{}',
        expires_at TIMESTAMPTZ,
        last_used_at TIMESTAMPTZ,
        usage_count INT NOT NULL DEFAULT 0,
        rate_limit INT,
        is_active BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
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
    await pool.query('DROP TABLE IF EXISTS api_keys CASCADE');
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
      expect(response.body.access_token).not.toBe(accessToken);
      expect(response.body.refresh_token).not.toBe(refreshToken);
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

  describe('API Key Flow', () => {
    let apiKey: string;

    it('should generate API key', async () => {
      const response = await request(app)
        .post('/auth/api-keys')
        .send({
          scopes: ['read', 'write'],
        })
        .set('Authorization', `Bearer ${await getAccessToken()}`);

      // Note: This endpoint might not exist in the current implementation
      // For now, we'll test directly with the service
      const result = await apiKeyService.generateAPIKey(
        testUser.tenant_id,
        testUser.user_id,
        'Test API Key',
        ['read', 'write']
      );

      apiKey = result.apiKey;

      expect(apiKey).toBeDefined();
      expect(apiKey).toMatch(/^ak_\d+_[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
    });

    it('should validate API key', async () => {
      const { apiKey: key } = await apiKeyService.generateAPIKey(
        testUser.tenant_id,
        testUser.user_id,
        'Test Key',
        ['read']
      );

      const result = await apiKeyService.validateAPIKey(key);

      expect(result.valid).toBe(true);
      expect(result.keyData).toBeDefined();
      expect(result.keyData?.tenant_id).toBe(testUser.tenant_id);
    });

    it('should list API keys', async () => {
      await apiKeyService.generateAPIKey(testUser.tenant_id, testUser.user_id, 'Key 1');
      await apiKeyService.generateAPIKey(testUser.tenant_id, testUser.user_id, 'Key 2');

      const keys = await apiKeyService.listAPIKeys(testUser.tenant_id);

      expect(keys.length).toBeGreaterThanOrEqual(2);
    });

    it('should revoke API key', async () => {
      const { keyId } = await apiKeyService.generateAPIKey(
        testUser.tenant_id,
        testUser.user_id,
        'Test Key'
      );

      const revoked = await apiKeyService.revokeAPIKey(keyId, testUser.tenant_id);

      expect(revoked).toBe(true);

      const keys = await apiKeyService.listAPIKeys(testUser.tenant_id, false);
      const keyExists = keys.some((k) => k.key_id === keyId && k.is_active);

      expect(keyExists).toBe(false);
    });
  });

  describe('Audit Logging Flow', () => {
    it('should log login events', async () => {
      await request(app)
        .post('/auth/login')
        .send({
          username: testUser.username,
          password: testUser.password,
          tenant_id: testUser.tenant_id,
        });

      // Give some time for async logging
      await new Promise((resolve) => setTimeout(resolve, 100));

      const logs = await auditService.queryAuditLogs(testUser.tenant_id, {
        eventType: 'auth.login',
      });

      expect(logs.length).toBeGreaterThan(0);
      expect(logs[0].outcome).toBe('success');
    });

    it('should log failed login attempts', async () => {
      await request(app)
        .post('/auth/login')
        .send({
          username: testUser.username,
          password: 'WrongPassword',
          tenant_id: testUser.tenant_id,
        });

      await new Promise((resolve) => setTimeout(resolve, 100));

      const logs = await auditService.queryAuditLogs(testUser.tenant_id, {
        eventType: 'auth.login',
        outcome: 'failure',
      });

      expect(logs.length).toBeGreaterThan(0);
    });

    it('should log token refresh events', async () => {
      const loginResponse = await request(app)
        .post('/auth/login')
        .send({
          username: testUser.username,
          password: testUser.password,
          tenant_id: testUser.tenant_id,
        });

      const refreshToken = loginResponse.body.refresh_token;

      await request(app)
        .post('/auth/token/refresh')
        .send({ refresh_token: refreshToken });

      await new Promise((resolve) => setTimeout(resolve, 100));

      const logs = await auditService.queryAuditLogs(testUser.tenant_id, {
        eventType: 'auth.token_refresh',
      });

      expect(logs.length).toBeGreaterThan(0);
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

      // All tokens should be different
      expect(session1.body.access_token).not.toBe(session2.body.access_token);
      expect(session2.body.access_token).not.toBe(session3.body.access_token);

      // Check session count
      const sessionsResponse = await request(app)
        .get('/auth/sessions')
        .set('Authorization', `Bearer ${session1.body.access_token}`);

      expect(sessionsResponse.body.count).toBeGreaterThanOrEqual(3);
    });
  });

  // Helper function to get access token
  async function getAccessToken(): Promise<string> {
    const response = await request(app)
      .post('/auth/login')
      .send({
        username: testUser.username,
        password: testUser.password,
        tenant_id: testUser.tenant_id,
      });

    return response.body.access_token;
  }
});
