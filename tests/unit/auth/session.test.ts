/**
 * Unit Tests: Session Service
 *
 * Tests for session creation, validation, and management
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Pool } from 'pg';
import { SessionService } from '../../../src/services/session-service.js';

describe('SessionService', () => {
  let pool: Pool;
  let sessionService: SessionService;

  beforeEach(async () => {
    pool = new Pool({
      host: process.env.PGHOST || 'localhost',
      port: Number(process.env.PGPORT) || 5432,
      database: process.env.PGDATABASE || 'agent_memory_test',
      user: process.env.PGUSER || 'postgres',
      password: process.env.PGPASSWORD || '',
    });

    sessionService = new SessionService(pool);

    // Setup test schema
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        user_id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL,
        username TEXT NOT NULL,
        password_hash TEXT NOT NULL,
        roles TEXT[] NOT NULL DEFAULT '{user}',
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
        is_active BOOLEAN NOT NULL DEFAULT true,
        CONSTRAINT fk_session_user FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
        CONSTRAINT fk_session_tenant FOREIGN KEY (tenant_id) REFERENCES users(tenant_id)
      );
    `);

    // Create test user
    await pool.query(
      `INSERT INTO users (user_id, tenant_id, username, password_hash, roles)
       VALUES ($1, $2, $3, $4, $5)`,
      ['test_user_1', 'test_tenant', 'testuser', 'hash', ['user']]
    );
  });

  afterEach(async () => {
    await pool.query('DROP TABLE IF EXISTS sessions CASCADE');
    await pool.query('DROP TABLE IF EXISTS users CASCADE');
    await pool.end();
  });

  describe('createSession', () => {
    it('should create a session with proper ID format', async () => {
      const sessionId = await sessionService.createSession(
        'test_user_1',
        'test_tenant',
        { browser: 'Chrome' },
        '192.168.1.1',
        'Mozilla/5.0'
      );

      expect(sessionId).toBeDefined();
      expect(sessionId).toMatch(/^sess_/);
    });

    it('should store session data in database', async () => {
      const deviceInfo = { browser: 'Firefox', os: 'Linux' };
      const sessionId = await sessionService.createSession(
        'test_user_1',
        'test_tenant',
        deviceInfo,
        '192.168.1.1',
        'Mozilla/5.0'
      );

      const result = await pool.query(
        'SELECT * FROM sessions WHERE session_id = $1',
        [sessionId]
      );

      expect(result.rows.length).toBe(1);
      expect(result.rows[0].user_id).toBe('test_user_1');
      expect(result.rows[0].tenant_id).toBe('test_tenant');
      expect(result.rows[0].device_info).toEqual(deviceInfo);
      expect(result.rows[0].ip_address).toBe('192.168.1.1');
      expect(result.rows[0].user_agent).toBe('Mozilla/5.0');
    });

    it('should set expiration time', async () => {
      const expiresIn = 3600; // 1 hour
      const sessionId = await sessionService.createSession(
        'test_user_1',
        'test_tenant',
        {},
        undefined,
        undefined,
        expiresIn
      );

      const result = await pool.query(
        'SELECT expires_at FROM sessions WHERE session_id = $1',
        [sessionId]
      );

      const expiresAt = new Date(result.rows[0].expires_at);
      const now = new Date();
      const diff = expiresAt.getTime() - now.getTime();

      expect(diff).toBeGreaterThan(expiresIn * 1000 - 1000);
      expect(diff).toBeLessThan(expiresIn * 1000 + 1000);
    });
  });

  describe('getSession', () => {
    it('should retrieve a valid session', async () => {
      const sessionId = await sessionService.createSession(
        'test_user_1',
        'test_tenant',
        { browser: 'Chrome' }
      );

      const session = await sessionService.getSession(sessionId);

      expect(session).toBeDefined();
      expect(session?.user_id).toBe('test_user_1');
      expect(session?.is_active).toBe(true);
    });

    it('should return null for non-existent session', async () => {
      const session = await sessionService.getSession('non_existent');

      expect(session).toBeNull();
    });

    it('should return null for expired session', async () => {
      const sessionId = await sessionService.createSession(
        'test_user_1',
        'test_tenant',
        {},
        undefined,
        undefined,
        -1 // Expired
      );

      const session = await sessionService.getSession(sessionId);

      expect(session).toBeNull();
    });

    it('should return null for inactive session', async () => {
      const sessionId = await sessionService.createSession(
        'test_user_1',
        'test_tenant'
      );

      await sessionService.revokeSession(sessionId, 'test_user_1');

      const session = await sessionService.getSession(sessionId);

      expect(session).toBeNull();
    });
  });

  describe('updateSessionActivity', () => {
    it('should update last_activity_at timestamp', async () => {
      const sessionId = await sessionService.createSession(
        'test_user_1',
        'test_tenant'
      );

      await sessionService.updateSessionActivity(sessionId);

      const result = await pool.query(
        'SELECT last_activity_at FROM sessions WHERE session_id = $1',
        [sessionId]
      );

      expect(result.rows[0].last_activity_at).not.toBeNull();
    });
  });

  describe('listUserSessions', () => {
    it('should list all active sessions for user', async () => {
      await sessionService.createSession('test_user_1', 'test_tenant');
      await sessionService.createSession('test_user_1', 'test_tenant');

      const sessions = await sessionService.listUserSessions('test_user_1');

      expect(sessions.length).toBe(2);
      expect(sessions[0].user_id).toBe('test_user_1');
    });

    it('should not include inactive sessions', async () => {
      const sessionId1 = await sessionService.createSession('test_user_1', 'test_tenant');
      await sessionService.createSession('test_user_1', 'test_tenant');

      await sessionService.revokeSession(sessionId1, 'test_user_1');

      const sessions = await sessionService.listUserSessions('test_user_1');

      expect(sessions.length).toBe(1);
    });

    it('should not include expired sessions', async () => {
      await sessionService.createSession('test_user_1', 'test_tenant');
      await sessionService.createSession('test_user_1', 'test_tenant', {}, undefined, undefined, -1);

      const sessions = await sessionService.listUserSessions('test_user_1');

      expect(sessions.length).toBe(1);
    });
  });

  describe('revokeSession', () => {
    it('should revoke a session', async () => {
      const sessionId = await sessionService.createSession(
        'test_user_1',
        'test_tenant'
      );

      const revoked = await sessionService.revokeSession(sessionId, 'test_user_1');

      expect(revoked).toBe(true);

      const result = await pool.query(
        'SELECT is_active FROM sessions WHERE session_id = $1',
        [sessionId]
      );

      expect(result.rows[0].is_active).toBe(false);
    });

    it('should return false for non-existent session', async () => {
      const revoked = await sessionService.revokeSession('non_existent', 'test_user_1');

      expect(revoked).toBe(false);
    });

    it('should only revoke sessions for the correct user', async () => {
      const sessionId = await sessionService.createSession('test_user_1', 'test_tenant');

      const revoked = await sessionService.revokeSession(sessionId, 'other_user');

      expect(revoked).toBe(false);

      const session = await sessionService.getSession(sessionId);
      expect(session?.is_active).toBe(true);
    });
  });

  describe('revokeAllUserSessions', () => {
    it('should revoke all sessions for user', async () => {
      const sessionId1 = await sessionService.createSession('test_user_1', 'test_tenant');
      const sessionId2 = await sessionService.createSession('test_user_1', 'test_tenant');
      const sessionId3 = await sessionService.createSession('test_user_1', 'test_tenant');

      const revokedCount = await sessionService.revokeAllUserSessions('test_user_1');

      expect(revokedCount).toBe(3);

      const result = await pool.query(
        'SELECT COUNT(*) FROM sessions WHERE user_id = $1 AND is_active = true',
        ['test_user_1']
      );

      expect(parseInt(result.rows[0].count)).toBe(0);
    });

    it('should keep specified session active', async () => {
      const sessionId1 = await sessionService.createSession('test_user_1', 'test_tenant');
      const sessionId2 = await sessionService.createSession('test_user_1', 'test_tenant');

      const revokedCount = await sessionService.revokeAllUserSessions('test_user_1', sessionId1);

      expect(revokedCount).toBe(1);

      const session1 = await sessionService.getSession(sessionId1);
      const session2 = await sessionService.getSession(sessionId2);

      expect(session1?.is_active).toBe(true);
      expect(session2).toBeNull();
    });
  });

  describe('cleanupExpiredSessions', () => {
    it('should delete old inactive sessions', async () => {
      // Create an old inactive session
      await pool.query(
        `INSERT INTO sessions (session_id, user_id, tenant_id, device_info, is_active, last_activity_at)
         VALUES ($1, $2, $3, $4, false, NOW() - INTERVAL '10 days')`,
        ['old_session', 'test_user_1', 'test_tenant', '{}']
      );

      const deleted = await sessionService.cleanupExpiredSessions(7);

      expect(deleted).toBeGreaterThanOrEqual(1);
    });
  });

  describe('getActiveSessionCount', () => {
    it('should count active sessions', async () => {
      await sessionService.createSession('test_user_1', 'test_tenant');
      await sessionService.createSession('test_user_1', 'test_tenant');

      const count = await sessionService.getActiveSessionCount('test_user_1');

      expect(count).toBe(2);
    });

    it('should not count inactive sessions', async () => {
      const sessionId = await sessionService.createSession('test_user_1', 'test_tenant');
      await sessionService.createSession('test_user_1', 'test_tenant');

      await sessionService.revokeSession(sessionId, 'test_user_1');

      const count = await sessionService.getActiveSessionCount('test_user_1');

      expect(count).toBe(1);
    });
  });

  describe('revokeSessionsByIP', () => {
    it('should revoke sessions from specific IP', async () => {
      await sessionService.createSession('test_user_1', 'test_tenant', {}, '192.168.1.1');
      await sessionService.createSession('test_user_1', 'test_tenant', {}, '192.168.1.1');
      await sessionService.createSession('test_user_1', 'test_tenant', {}, '192.168.1.2');

      const revokedCount = await sessionService.revokeSessionsByIP('test_user_1', '192.168.1.1');

      expect(revokedCount).toBe(2);
    });
  });

  describe('getSessionStats', () => {
    it('should return session statistics', async () => {
      await sessionService.createSession('test_user_1', 'test_tenant', { device_type: 'desktop' }, '192.168.1.1');
      await sessionService.createSession('test_user_1', 'test_tenant', { device_type: 'mobile' }, '192.168.1.2');

      const stats = await sessionService.getSessionStats('test_user_1');

      expect(stats.active).toBe(2);
      expect(stats.total).toBe(2);
      expect(stats.uniqueDevices).toBe(2);
      expect(stats.uniqueIPs).toBe(2);
    });
  });
});
