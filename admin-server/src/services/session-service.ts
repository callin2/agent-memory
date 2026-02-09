/**
 * Session Service
 *
 * Manages user sessions including:
 * - Session creation and tracking
 * - Activity updates
 * - Session listing and querying
 * - Session revocation (single or all)
 * - Cleanup of expired sessions
 *
 * Migrated from monolith to Admin Server
 */

import { Pool } from 'pg';
import crypto from 'crypto';

export interface SessionData {
  session_id: string;
  user_id: string;
  tenant_id: string;
  device_info: Record<string, any>;
  ip_address?: string;
  user_agent?: string;
  created_at: Date;
  last_activity_at: Date;
  expires_at: Date;
  is_active: boolean;
}

export interface DeviceInfo {
  browser?: string;
  os?: string;
  device_type?: string;
  user_agent?: string;
}

/**
 * Session Service class for session management
 */
export class SessionService {
  constructor(private pool: Pool) {}

  /**
   * Create a new session
   *
   * @param userId - User ID
   * @param tenantId - Tenant ID
   * @param deviceInfo - Device fingerprint information
   * @param ipAddress - IP address
   * @param userAgent - User agent string
   * @param expiresIn - Session lifetime in seconds (default: 24 hours)
   * @returns Session ID
   */
  async createSession(
    userId: string,
    tenantId: string,
    deviceInfo: DeviceInfo = {},
    ipAddress?: string,
    userAgent?: string,
    expiresIn: number = 24 * 60 * 60 // 24 hours
  ): Promise<string> {
    const sessionId = `sess_${Date.now()}_${crypto.randomBytes(16).toString('hex')}`;
    const expiresAt = new Date(Date.now() + expiresIn * 1000);

    await this.pool.query(
      `INSERT INTO sessions (session_id, user_id, tenant_id, device_info, ip_address, user_agent, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [sessionId, userId, tenantId, JSON.stringify(deviceInfo), ipAddress || null, userAgent || null, expiresAt]
    );

    return sessionId;
  }

  /**
   * Get session by ID
   *
   * @param sessionId - Session ID
   * @returns Session data or null
   */
  async getSession(sessionId: string): Promise<SessionData | null> {
    const result = await this.pool.query<SessionData>(
      `SELECT session_id, user_id, tenant_id, device_info, ip_address, user_agent,
              created_at, last_activity_at, expires_at, is_active
       FROM sessions
       WHERE session_id = $1`,
      [sessionId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const session = result.rows[0];

    // Check if expired
    if (new Date() > session.expires_at || !session.is_active) {
      await this.revokeSession(sessionId, session.user_id);
      return null;
    }

    return session;
  }

  /**
   * Update session activity timestamp
   *
   * @param sessionId - Session ID
   */
  async updateSessionActivity(sessionId: string): Promise<void> {
    await this.pool.query(
      `UPDATE sessions
       SET last_activity_at = NOW()
       WHERE session_id = $1`,
      [sessionId]
    );
  }

  /**
   * List all active sessions for a user
   *
   * @param userId - User ID
   * @returns Array of active sessions
   */
  async listUserSessions(userId: string): Promise<SessionData[]> {
    const result = await this.pool.query<SessionData>(
      `SELECT session_id, user_id, tenant_id, device_info, ip_address, user_agent,
              created_at, last_activity_at, expires_at, is_active
       FROM sessions
       WHERE user_id = $1 AND is_active = true AND expires_at > NOW()
       ORDER BY last_activity_at DESC`,
      [userId]
    );

    return result.rows;
  }

  /**
   * Revoke a specific session
   *
   * @param sessionId - Session ID
   * @param userId - User ID (for authorization)
   * @returns True if session was revoked
   */
  async revokeSession(sessionId: string, userId: string): Promise<boolean> {
    const result = await this.pool.query(
      `UPDATE sessions
       SET is_active = false
       WHERE session_id = $1 AND user_id = $2`,
      [sessionId, userId]
    );

    return (result.rowCount || 0) > 0;
  }

  /**
   * Revoke all sessions for a user except one
   *
   * Useful for "logout all other devices" functionality
   *
   * @param userId - User ID
   * @param exceptSessionId - Session ID to keep active
   * @returns Number of sessions revoked
   */
  async revokeAllUserSessions(userId: string, exceptSessionId?: string): Promise<number> {
    const result = await this.pool.query(
      `UPDATE sessions
       SET is_active = false
       WHERE user_id = $1
         AND is_active = true
         ${exceptSessionId ? 'AND session_id != $2' : ''}`,
      exceptSessionId ? [userId, exceptSessionId] : [userId]
    );

    return result.rowCount || 0;
  }

  /**
   * Clean up expired sessions
   *
   * @param daysOld - Delete sessions older than this many days
   * @returns Number of sessions deleted
   */
  async cleanupExpiredSessions(daysOld: number = 7): Promise<number> {
    const result = await this.pool.query(
      `DELETE FROM sessions
       WHERE (expires_at < NOW() OR is_active = false)
         AND last_activity_at < NOW() - INTERVAL '1 day' * $1`,
      [daysOld]
    );

    return result.rowCount || 0;
  }

  /**
   * Get active session count for a user
   *
   * @param userId - User ID
   * @returns Number of active sessions
   */
  async getActiveSessionCount(userId: string): Promise<number> {
    const result = await this.pool.query(
      `SELECT COUNT(*) as count
       FROM sessions
       WHERE user_id = $1 AND is_active = true AND expires_at > NOW()`,
      [userId]
    );

    return parseInt(result.rows[0].count, 10);
  }

  /**
   * Revoke sessions by IP address (security measure)
   *
   * @param userId - User ID
   * @param ipAddress - IP address to revoke
   * @returns Number of sessions revoked
   */
  async revokeSessionsByIP(userId: string, ipAddress: string): Promise<number> {
    const result = await this.pool.query(
      `UPDATE sessions
       SET is_active = false
       WHERE user_id = $1 AND ip_address = $2 AND is_active = true`,
      [userId, ipAddress]
    );

    return result.rowCount || 0;
  }

  /**
   * Get session statistics for a user
   *
   * @param userId - User ID
   * @returns Session statistics
   */
  async getSessionStats(userId: string): Promise<{
    active: number;
    total: number;
    uniqueDevices: number;
    uniqueIPs: number;
  }> {
    const result = await this.pool.query(`
      SELECT
        COUNT(*) FILTER (WHERE is_active = true AND expires_at > NOW()) as active,
        COUNT(*) as total,
        COUNT(DISTINCT device_info->>'device_type') as unique_devices,
        COUNT(DISTINCT ip_address) as unique_ips
      FROM sessions
      WHERE user_id = $1
    `, [userId]);

    return {
      active: parseInt(result.rows[0].active, 10),
      total: parseInt(result.rows[0].total, 10),
      uniqueDevices: parseInt(result.rows[0].unique_devices, 10),
      uniqueIPs: parseInt(result.rows[0].unique_ips, 10),
    };
  }
}
