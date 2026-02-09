/**
 * Unit Tests: Audit Service
 *
 * Tests for audit logging and querying
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Pool } from 'pg';
import { AuditService } from '../../../src/services/audit-service.js';
import { Request } from 'express';

describe('AuditService', () => {
  let pool: Pool;
  let auditService: AuditService;

  beforeEach(async () => {
    pool = new Pool({
      host: process.env.PGHOST || 'localhost',
      port: Number(process.env.PGPORT) || 5432,
      database: process.env.PGDATABASE || 'agent_memory_test',
      user: process.env.PGUSER || 'postgres',
      password: process.env.PGPASSWORD || '',
    });

    auditService = new AuditService(pool);

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
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT fk_audit_user FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE SET NULL
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
    await pool.query('DROP TABLE IF EXISTS audit_logs CASCADE');
    await pool.query('DROP TABLE IF EXISTS users CASCADE');
    await pool.end();
  });

  describe('logEvent', () => {
    it('should log an audit event', async () => {
      await auditService.logEvent(
        'test_tenant',
        'test_user_1',
        'test.event',
        'test_action',
        'success',
        { key: 'value' },
        'test_resource',
        'res_123'
      );

      const result = await pool.query(
        'SELECT * FROM audit_logs WHERE tenant_id = $1',
        ['test_tenant']
      );

      expect(result.rows.length).toBe(1);
      expect(result.rows[0].event_type).toBe('test.event');
      expect(result.rows[0].action).toBe('test_action');
      expect(result.rows[0].outcome).toBe('success');
      expect(result.rows[0].user_id).toBe('test_user_1');
      expect(result.rows[0].resource_type).toBe('test_resource');
      expect(result.rows[0].resource_id).toBe('res_123');
      expect(result.rows[0].details).toEqual({ key: 'value' });
    });

    it('should handle logs without user_id', async () => {
      await auditService.logEvent(
        'test_tenant',
        undefined,
        'system.event',
        'system_action',
        'success'
      );

      const result = await pool.query(
        'SELECT * FROM audit_logs WHERE tenant_id = $1',
        ['test_tenant']
      );

      expect(result.rows[0].user_id).toBeNull();
    });

    it('should generate unique log IDs', async () => {
      await auditService.logEvent('test_tenant', 'test_user_1', 'event1', 'action1', 'success');
      await auditService.logEvent('test_tenant', 'test_user_1', 'event2', 'action2', 'success');

      const result = await pool.query(
        'SELECT log_id FROM audit_logs WHERE tenant_id = $1',
        ['test_tenant']
      );

      expect(result.rows[0].log_id).not.toBe(result.rows[1].log_id);
    });
  });

  describe('logAuthEvent', () => {
    it('should log authentication events', async () => {
      const mockReq = {
        headers: {
          'user-agent': 'Mozilla/5.0',
          'x-forwarded-for': '192.168.1.1',
        },
      } as Request;

      await auditService.logAuthEvent('test_user_1', 'login', 'success', mockReq, {
        username: 'testuser',
      });

      const result = await pool.query(
        "SELECT * FROM audit_logs WHERE event_type = 'auth.login'"
      );

      expect(result.rows.length).toBe(1);
      expect(result.rows[0].action).toBe('login');
      expect(result.rows[0].outcome).toBe('success');
      expect(result.rows[0].ip_address).toBe('192.168.1.1');
      expect(result.rows[0].user_agent).toBe('Mozilla/5.0');
      expect(result.rows[0].details.username).toBe('testuser');
    });
  });

  describe('logAPIKeyEvent', () => {
    it('should log API key events', async () => {
      const mockReq = {
        headers: {
          'user-agent': 'API-Client/1.0',
        },
        get(name: string) {
          return name === 'user-agent' ? 'API-Client/1.0' : undefined;
        },
      } as Request;

      await auditService.logAPIKeyEvent(
        'key_123',
        'test_tenant',
        'validate',
        'success',
        mockReq
      );

      const result = await pool.query(
        "SELECT * FROM audit_logs WHERE event_type = 'api_key'"
      );

      expect(result.rows.length).toBe(1);
      expect(result.rows[0].action).toBe('validate');
      expect(result.rows[0].resource_id).toBe('key_123');
      expect(result.rows[0].details.keyId).toBe('key_123');
    });
  });

  describe('logSessionEvent', () => {
    it('should log session events', async () => {
      const mockReq = {
        headers: {
          'x-forwarded-for': '10.0.0.1',
        },
        get(name: string) {
          return name === 'user-agent' ? undefined : undefined;
        },
      } as Request;

      await auditService.logSessionEvent(
        'sess_123',
        'test_user_1',
        'test_tenant',
        'create',
        'success',
        mockReq
      );

      const result = await pool.query(
        "SELECT * FROM audit_logs WHERE event_type = 'session'"
      );

      expect(result.rows.length).toBe(1);
      expect(result.rows[0].action).toBe('create');
      expect(result.rows[0].resource_id).toBe('sess_123');
      expect(result.rows[0].ip_address).toBe('10.0.0.1');
    });
  });

  describe('queryAuditLogs', () => {
    beforeEach(async () => {
      // Create sample audit logs
      await auditService.logEvent('test_tenant', 'user_1', 'auth.login', 'login', 'success');
      await auditService.logEvent('test_tenant', 'user_1', 'auth.logout', 'logout', 'success');
      await auditService.logEvent('test_tenant', 'user_2', 'auth.login', 'login', 'failure');
      await auditService.logEvent('test_tenant', 'user_1', 'api_key', 'validate', 'success', {}, 'api_key', 'key_1');
    });

    it('should query all logs for tenant', async () => {
      const logs = await auditService.queryAuditLogs('test_tenant');

      expect(logs.length).toBe(4);
    });

    it('should filter by user_id', async () => {
      const logs = await auditService.queryAuditLogs('test_tenant', { userId: 'user_1' });

      expect(logs.length).toBe(3);
      expect(logs.every((log) => log.user_id === 'user_1')).toBe(true);
    });

    it('should filter by event_type', async () => {
      const logs = await auditService.queryAuditLogs('test_tenant', { eventType: 'auth.login' });

      expect(logs.length).toBe(2);
      expect(logs.every((log) => log.event_type === 'auth.login')).toBe(true);
    });

    it('should filter by outcome', async () => {
      const logs = await auditService.queryAuditLogs('test_tenant', { outcome: 'failure' });

      expect(logs.length).toBe(1);
      expect(logs[0].outcome).toBe('failure');
    });

    it('should filter by resource_type and resource_id', async () => {
      const logs = await auditService.queryAuditLogs('test_tenant', {
        resourceType: 'api_key',
        resourceId: 'key_1',
      });

      expect(logs.length).toBe(1);
      expect(logs[0].resource_id).toBe('key_1');
    });

    it('should respect limit', async () => {
      const logs = await auditService.queryAuditLogs('test_tenant', { limit: 2 });

      expect(logs.length).toBe(2);
    });

    it('should respect offset', async () => {
      const logs1 = await auditService.queryAuditLogs('test_tenant', { limit: 2, offset: 0 });
      const logs2 = await auditService.queryAuditLogs('test_tenant', { limit: 2, offset: 2 });

      expect(logs1.length).toBe(2);
      expect(logs2.length).toBe(2);
      expect(logs1[0].log_id).not.toBe(logs2[0].log_id);
    });
  });

  describe('getRecentUserEvents', () => {
    it('should return recent events for user', async () => {
      await auditService.logEvent('test_tenant', 'test_user_1', 'event1', 'action1', 'success');
      await auditService.logEvent('test_tenant', 'test_user_1', 'event2', 'action2', 'success');
      await auditService.logEvent('test_tenant', 'other_user', 'event3', 'action3', 'success');

      const events = await auditService.getRecentUserEvents('test_user_1', 10);

      expect(events.length).toBe(2);
      expect(events.every((e) => e.user_id === 'test_user_1')).toBe(true);
    });

    it('should respect limit parameter', async () => {
      await auditService.logEvent('test_tenant', 'test_user_1', 'event1', 'action1', 'success');
      await auditService.logEvent('test_tenant', 'test_user_1', 'event2', 'action2', 'success');
      await auditService.logEvent('test_tenant', 'test_user_1', 'event3', 'action3', 'success');

      const events = await auditService.getRecentUserEvents('test_user_1', 2);

      expect(events.length).toBe(2);
    });
  });

  describe('getFailedLogins', () => {
    it('should return failed login attempts', async () => {
      await auditService.logAuthEvent('test_user_1', 'login', 'failure', undefined as any);
      await auditService.logAuthEvent('test_user_1', 'login', 'failure', undefined as any);
      await auditService.logAuthEvent('test_user_1', 'login', 'success', undefined as any);

      const failed = await auditService.getFailedLogins('test_user_1', 24);

      expect(failed.length).toBe(2);
      expect(failed.every((f) => f.outcome === 'failure')).toBe(true);
    });
  });

  describe('cleanupOldLogs', () => {
    it('should delete old logs', async () => {
      // Create an old log
      await pool.query(
        `INSERT INTO audit_logs (log_id, tenant_id, user_id, event_type, action, outcome, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, NOW() - INTERVAL '100 days')`,
        ['old_log', 'test_tenant', 'user_1', 'old_event', 'old_action', 'success']
      );

      const deleted = await auditService.cleanupOldLogs(90);

      expect(deleted).toBeGreaterThanOrEqual(1);
    });
  });

  describe('getAuditStats', () => {
    it('should return statistics for tenant', async () => {
      await auditService.logEvent('test_tenant', 'user_1', 'auth.login', 'login', 'success');
      await auditService.logEvent('test_tenant', 'user_1', 'auth.login', 'login', 'failure');
      await auditService.logEvent('test_tenant', 'user_1', 'auth.logout', 'logout', 'success');

      const stats = await auditService.getAuditStats('test_tenant', 7);

      expect(stats.total).toBe(3);
      expect(stats.byOutcome.success).toBe(2);
      expect(stats.byOutcome.failure).toBe(1);
      expect(stats.byEventType['auth.login']).toBe(2);
      expect(stats.byEventType['auth.logout']).toBe(1);
    });
  });
});
