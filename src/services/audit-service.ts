/**
 * Audit Service
 *
 * Manages security event logging including:
 * - Event logging for auth, API keys, sessions
 * - Event querying and filtering
 * - Audit trail maintenance
 * - Old log cleanup
 */

import { Pool } from 'pg';
import { Request } from 'express';
import crypto from 'crypto';

export interface AuditLogData {
  log_id: string;
  tenant_id: string;
  user_id?: string;
  event_type: string;
  resource_type?: string;
  resource_id?: string;
  action: string;
  outcome: string;
  ip_address?: string;
  user_agent?: string;
  details: Record<string, any>;
  created_at: Date;
}

export interface AuditFilters {
  userId?: string;
  eventType?: string;
  resourceType?: string;
  resourceId?: string;
  outcome?: string;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}

/**
 * Audit Service class for security event logging
 */
export class AuditService {
  constructor(private pool: Pool) {}

  /**
   * Log a generic audit event
   *
   * @param tenantId - Tenant ID
   * @param userId - User ID (optional)
   * @param eventType - Event type (auth, api_key, session, data_access, etc.)
   * @param resourceType - Type of resource affected
   * @param resourceId - ID of resource affected
   * @param action - Action performed
   * @param outcome - Event outcome (success, failure, partial)
   * @param details - Additional event details
   */
  async logEvent(
    tenantId: string,
    userId: string | undefined,
    eventType: string,
    action: string,
    outcome: string,
    details: Record<string, any> = {},
    resourceType?: string,
    resourceId?: string
  ): Promise<void> {
    const logId = `audit_${Date.now()}_${crypto.randomBytes(16).toString('hex')}`;

    await this.pool.query(
      `INSERT INTO audit_logs (log_id, tenant_id, user_id, event_type, resource_type, resource_id, action, outcome, details)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        logId,
        tenantId,
        userId || null,
        eventType,
        resourceType || null,
        resourceId || null,
        action,
        outcome,
        JSON.stringify(details),
      ]
    );
  }

  /**
   * Log an authentication event
   *
   * @param userId - User ID
   * @param eventType - Event type (login, logout, token_refresh, etc.)
   * @param outcome - Event outcome (success, failure)
   * @param req - Express request object
   * @param details - Additional details
   */
  async logAuthEvent(
    userId: string,
    eventType: string,
    outcome: string,
    req?: Request,
    details: Record<string, any> = {}
  ): Promise<void> {
    const tenantId = (req as any)?.tenant_id || details.tenant_id || 'unknown';
    this.extractIP(req);
    const userAgent = req?.get('user-agent');

    const enrichedDetails = {
      ...details,
      userAgent,
      timestamp: new Date().toISOString(),
    };

    await this.logEvent(
      tenantId,
      userId,
      `auth.${eventType}`,
      eventType,
      outcome,
      enrichedDetails,
      'user',
      userId
    );
  }

  /**
   * Log an API key event
   *
   * @param keyId - API key ID
   * @param tenantId - Tenant ID
   * @param action - Action performed (validate, create, revoke, etc.)
   * @param outcome - Event outcome
   * @param req - Express request object
   * @param details - Additional details
   */
  async logAPIKeyEvent(
    keyId: string,
    tenantId: string,
    action: string,
    outcome: string,
    req?: Request,
    details: Record<string, any> = {}
  ): Promise<void> {
    this.extractIP(req);
    const userAgent = req?.get('user-agent');

    const enrichedDetails = {
      ...details,
      keyId,
      userAgent,
      timestamp: new Date().toISOString(),
    };

    await this.logEvent(
      tenantId,
      undefined,
      'api_key',
      action,
      outcome,
      enrichedDetails,
      'api_key',
      keyId
    );
  }

  /**
   * Log a session event
   *
   * @param sessionId - Session ID
   * @param userId - User ID
   * @param tenantId - Tenant ID
   * @param action - Action performed (create, revoke, etc.)
   * @param outcome - Event outcome
   * @param req - Express request object
   * @param details - Additional details
   */
  async logSessionEvent(
    sessionId: string,
    userId: string,
    tenantId: string,
    action: string,
    outcome: string,
    req?: Request,
    details: Record<string, any> = {}
  ): Promise<void> {
    this.extractIP(req);
    const userAgent = req?.get('user-agent');

    const enrichedDetails = {
      ...details,
      sessionId,
      userAgent,
      timestamp: new Date().toISOString(),
    };

    await this.logEvent(
      tenantId,
      userId,
      'session',
      action,
      outcome,
      enrichedDetails,
      'session',
      sessionId
    );
  }

  /**
   * Query audit logs with filters
   *
   * @param tenantId - Tenant ID
   * @param filters - Filter criteria
   * @returns Array of audit logs
   */
  async queryAuditLogs(tenantId: string, filters: AuditFilters = {}): Promise<AuditLogData[]> {
    const conditions: string[] = ['tenant_id = $1'];
    const values: any[] = [tenantId];
    let paramIndex = 2;

    if (filters.userId) {
      conditions.push(`user_id = $${paramIndex++}`);
      values.push(filters.userId);
    }

    if (filters.eventType) {
      conditions.push(`event_type = $${paramIndex++}`);
      values.push(filters.eventType);
    }

    if (filters.resourceType) {
      conditions.push(`resource_type = $${paramIndex++}`);
      values.push(filters.resourceType);
    }

    if (filters.resourceId) {
      conditions.push(`resource_id = $${paramIndex++}`);
      values.push(filters.resourceId);
    }

    if (filters.outcome) {
      conditions.push(`outcome = $${paramIndex++}`);
      values.push(filters.outcome);
    }

    if (filters.startDate) {
      conditions.push(`created_at >= $${paramIndex++}`);
      values.push(filters.startDate);
    }

    if (filters.endDate) {
      conditions.push(`created_at <= $${paramIndex++}`);
      values.push(filters.endDate);
    }

    const limit = filters.limit || 100;
    const offset = filters.offset || 0;

    values.push(limit, offset);

    const result = await this.pool.query<AuditLogData>(
      `SELECT log_id, tenant_id, user_id, event_type, resource_type, resource_id,
              action, outcome, ip_address, user_agent, details, created_at
       FROM audit_logs
       WHERE ${conditions.join(' AND ')}
       ORDER BY created_at DESC
       LIMIT $${paramIndex++} OFFSET $${paramIndex++}`,
      values
    );

    return result.rows;
  }

  /**
   * Get recent security events for a user
   *
   * @param userId - User ID
   * @param limit - Maximum number of events
   * @returns Array of recent audit logs
   */
  async getRecentUserEvents(userId: string, limit: number = 50): Promise<AuditLogData[]> {
    const result = await this.pool.query<AuditLogData>(
      `SELECT log_id, tenant_id, user_id, event_type, resource_type, resource_id,
              action, outcome, ip_address, user_agent, details, created_at
       FROM audit_logs
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT $2`,
      [userId, limit]
    );

    return result.rows;
  }

  /**
   * Get failed login attempts for a user
   *
   * @param userId - User ID
   * @param hours - Number of hours to look back
   * @returns Array of failed login attempts
   */
  async getFailedLogins(userId: string, hours: number = 24): Promise<AuditLogData[]> {
    const result = await this.pool.query<AuditLogData>(
      `SELECT log_id, tenant_id, user_id, event_type, resource_type, resource_id,
              action, outcome, ip_address, user_agent, details, created_at
       FROM audit_logs
       WHERE user_id = $1
         AND event_type = 'auth.login'
         AND outcome = 'failure'
         AND created_at > NOW() - INTERVAL '1 hour' * $2
       ORDER BY created_at DESC`,
      [userId, hours]
    );

    return result.rows;
  }

  /**
   * Clean up old audit logs
   *
   * @param daysToKeep - Keep logs newer than this many days
   * @returns Number of logs deleted
   */
  async cleanupOldLogs(daysToKeep: number = 90): Promise<number> {
    const result = await this.pool.query(
      `DELETE FROM audit_logs
       WHERE created_at < NOW() - INTERVAL '1 day' * $1`,
      [daysToKeep]
    );

    return result.rowCount || 0;
  }

  /**
   * Get audit log statistics for a tenant
   *
   * @param tenantId - Tenant ID
   * @param days - Number of days to analyze
   * @returns Statistics
   */
  async getAuditStats(tenantId: string, days: number = 7): Promise<{
    total: number;
    byOutcome: Record<string, number>;
    byEventType: Record<string, number>;
    failedLogins: number;
  }> {
    const result = await this.pool.query(`
      SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE outcome = 'success') as success,
        COUNT(*) FILTER (WHERE outcome = 'failure') as failure,
        COUNT(*) FILTER (WHERE event_type = 'auth.login' AND outcome = 'failure') as failed_logins
      FROM audit_logs
      WHERE tenant_id = $1
        AND created_at > NOW() - INTERVAL '1 day' * $2
    `, [tenantId, days]);

    const eventTypeResult = await this.pool.query(`
      SELECT event_type, COUNT(*) as count
      FROM audit_logs
      WHERE tenant_id = $1
        AND created_at > NOW() - INTERVAL '1 day' * $2
      GROUP BY event_type
      ORDER BY count DESC
    `, [tenantId, days]);

    const byEventType: Record<string, number> = {};
    for (const row of eventTypeResult.rows) {
      byEventType[row.event_type] = parseInt(row.count, 10);
    }

    return {
      total: parseInt(result.rows[0].total, 10),
      byOutcome: {
        success: parseInt(result.rows[0].success, 10),
        failure: parseInt(result.rows[0].failure, 10),
      },
      byEventType,
      failedLogins: parseInt(result.rows[0].failed_logins, 10),
    };
  }

  /**
   * Extract IP address from request
   *
   * @param req - Express request object
   * @returns IP address or undefined
   */
  private extractIP(req?: Request): string | undefined {
    if (!req) {return undefined;}

    return (
      req.headers['x-forwarded-for'] as string ||
      req.headers['x-real-ip'] as string ||
      req.socket.remoteAddress
    );
  }
}
