/**
 * Session Routes
 *
 * Endpoints for managing user sessions:
 * - List active sessions
 * - Revoke specific session
 * - Revoke all sessions (logout from all devices)
 */

import { Router, Request, Response } from 'express';
import { SessionService } from '../services/session-service.js';
import { AuditService } from '../services/audit-service.js';
import { authenticate } from '../middleware/auth.js';

export function createSessionRoutes(
  sessionService: SessionService,
  auditService: AuditService
): Router {
  const router = Router();

  /**
   * GET /auth/sessions
   * List all active sessions for the authenticated user
   */
  router.get(
    '/sessions',
    authenticate,
    async (req: Request, res: Response) => {
      try {
        const userId = req.user!.user_id;

        const sessions = await sessionService.listUserSessions(userId);

        return res.json({
          sessions: sessions.map((s) => ({
            session_id: s.session_id,
            created_at: s.created_at,
            last_activity_at: s.last_activity_at,
            expires_at: s.expires_at,
            device_info: s.device_info,
            ip_address: s.ip_address,
            user_agent: s.user_agent,
          })),
          count: sessions.length,
        });
      } catch (error: any) {
        console.error('List sessions error:', error);
        return res.status(500).json({
          error: 'Failed to list sessions',
          message: error.message,
        });
      }
    }
  );

  /**
   * GET /auth/sessions/stats
   * Get session statistics for the authenticated user
   */
  router.get(
    '/sessions/stats',
    authenticate,
    async (req: Request, res: Response) => {
      try {
        const userId = req.user!.user_id;

        const stats = await sessionService.getSessionStats(userId);

        return res.json(stats);
      } catch (error: any) {
        console.error('Get session stats error:', error);
        return res.status(500).json({
          error: 'Failed to get session stats',
          message: error.message,
        });
      }
    }
  );

  /**
   * DELETE /auth/sessions/:sessionId
   * Revoke a specific session (logout from that device)
   */
  router.delete(
    '/sessions/:sessionId',
    authenticate,
    async (req: Request, res: Response) => {
      try {
        const userId = req.user!.user_id;
        const { sessionId } = req.params;

        const revoked = await sessionService.revokeSession(sessionId, userId);

        if (!revoked) {
          return res.status(404).json({
            error: 'Session not found or already revoked',
          });
        }

        await auditService.logSessionEvent(sessionId, userId, req.user!.tenant_id, 'revoke', 'success', req, {
          reason: 'user_initiated',
        });

        return res.json({
          message: 'Session revoked successfully',
        });
      } catch (error: any) {
        console.error('Revoke session error:', error);
        return res.status(500).json({
          error: 'Failed to revoke session',
          message: error.message,
        });
      }
    }
  );

  /**
   * DELETE /auth/sessions
   * Revoke all sessions except the current one (logout from all other devices)
   */
  router.delete(
    '/sessions',
    authenticate,
    async (req: Request, res: Response) => {
      try {
        const userId = req.user!.user_id;
        const { except_session_id } = req.body;

        const revokedCount = await sessionService.revokeAllUserSessions(userId, except_session_id);

        await auditService.logSessionEvent(
          except_session_id || 'unknown',
          userId,
          req.user!.tenant_id,
          'revoke_all',
          'success',
          req,
          {
            reason: 'logout_all_devices',
            revoked_count: revokedCount,
          }
        );

        return res.json({
          message: 'Sessions revoked successfully',
          revoked_count: revokedCount,
        });
      } catch (error: any) {
        console.error('Revoke all sessions error:', error);
        return res.status(500).json({
          error: 'Failed to revoke sessions',
          message: error.message,
        });
      }
    }
  );

  return router;
}
