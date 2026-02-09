/**
 * Refresh Token Routes
 *
 * Endpoints for managing refresh tokens:
 * - List active tokens
 * - Revoke specific tokens
 * - Revoke all tokens (security measure)
 */

import { Router, Request, Response } from 'express';
import { TokenService } from '../services/token-service.js';
import { AuditService } from '../services/audit-service.js';
import { authenticate } from '../middleware/auth.js';

export function createRefreshRoutes(
  tokenService: TokenService,
  auditService: AuditService
): Router {
  const router = Router();

  /**
   * GET /auth/tokens
   * List all active refresh tokens for the authenticated user
   */
  router.get(
    '/tokens',
    authenticate,
    async (req: Request, res: Response) => {
      try {
        const userId = req.user!.user_id;

        const tokens = await tokenService.getAllUserTokens(userId);

        return res.json({
          tokens: tokens.map((t) => ({
            token_id: t.token_id,
            created_at: t.created_at,
            expires_at: t.expires_at,
            last_used_at: t.last_used_at,
            device_info: t.device_info,
          })),
          count: tokens.length,
        });
      } catch (error: any) {
        console.error('List tokens error:', error);
        return res.status(500).json({
          error: 'Failed to list tokens',
          message: error.message,
        });
      }
    }
  );

  /**
   * POST /auth/tokens/revoke-all
   * Revoke all refresh tokens for the user (security measure)
   */
  router.post(
    '/tokens/revoke-all',
    authenticate,
    async (req: Request, res: Response) => {
      try {
        const userId = req.user!.user_id;
        const { reason = 'user_initiated' } = req.body;

        await tokenService.revokeAllUserTokens(userId, reason);

        await auditService.logAuthEvent(userId, 'revoke_all_tokens', 'success', req, {
          reason,
        });

        return res.json({
          message: 'All tokens revoked successfully',
        });
      } catch (error: any) {
        console.error('Revoke all tokens error:', error);
        return res.status(500).json({
          error: 'Failed to revoke tokens',
          message: error.message,
        });
      }
    }
  );

  /**
   * POST /auth/tokens/:tokenId/revoke
   * Revoke a specific refresh token
   */
  router.post(
    '/tokens/:tokenId/revoke',
    authenticate,
    async (req: Request, res: Response) => {
      try {
        const userId = req.user!.user_id;
        const { tokenId } = req.params;
        const { reason = 'user_initiated' } = req.body;

        // Verify token belongs to user
        const tokens = await tokenService.getAllUserTokens(userId);
        const tokenExists = tokens.some((t) => t.token_id === tokenId);

        if (!tokenExists) {
          return res.status(404).json({
            error: 'Token not found',
          });
        }

        await tokenService.revokeRefreshToken(tokenId, reason);

        await auditService.logAuthEvent(userId, 'revoke_token', 'success', req, {
          token_id: tokenId,
          reason,
        });

        return res.json({
          message: 'Token revoked successfully',
        });
      } catch (error: any) {
        console.error('Revoke token error:', error);
        return res.status(500).json({
          error: 'Failed to revoke token',
          message: error.message,
        });
      }
    }
  );

  return router;
}
