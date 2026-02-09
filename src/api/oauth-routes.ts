/**
 * OAuth2/SSO Routes
 *
 * OAuth authentication endpoints:
 * - Initiate OAuth flow
 * - Handle OAuth callback
 * - Link OAuth accounts
 * - List OAuth connections
 * - Unlink OAuth accounts
 */

import { Router, Request, Response } from 'express';
import { Pool } from 'pg';
import { OAuthService } from '../services/oauth-service.js';
import { generateToken } from '../middleware/auth.js';
import { randomBytes } from 'crypto';
import { AuditService } from '../services/audit-service.js';

// Extend Express Request type to include user
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: {
        tenant_id: string;
        user_id: string;
        roles: string[];
      };
    }
  }
}

// OAuth state storage (in production, use Redis)
interface OAuthState {
  providerId: string;
  redirectUri: string;
  tenantId: string;
  timestamp: number;
}

const oauthStates = new Map<string, OAuthState>();

/**
 * Create OAuth routes
 */
export function createOAuthRoutes(pool: Pool, auditService: AuditService): Router {
  const router = Router();
  const oauthService = new OAuthService(pool);

  /**
   * GET /auth/oauth/providers
   * List available OAuth providers
   */
  router.get('/providers', async (_req: Request, res: Response) => {
    try {
      const providers = await oauthService.getActiveProviders();
      return res.json({ providers });
    } catch (error: any) {
      console.error('List providers error:', error);
      return res.status(500).json({ error: 'Failed to list providers' });
    }
  });

  /**
   * GET /auth/oauth/:provider
   * Initiate OAuth flow
   *
   * Query params:
   * - redirect_uri: OAuth callback URL
   * - tenant_id: Tenant ID (optional, defaults to 'default')
   */
  router.get('/:provider', async (req: Request, res: Response) => {
    try {
      const { provider } = req.params;
      const redirect_uri = req.query.redirect_uri as string;
      const tenant_id = (req.query.tenant_id as string) || 'default';

      if (!redirect_uri) {
        return res.status(400).json({ error: 'Missing redirect_uri' });
      }

      // Validate provider exists
      const providerConfig = await oauthService.getProvider(provider);
      if (!providerConfig) {
        return res.status(404).json({ error: 'OAuth provider not found' });
      }

      // Generate state parameter for CSRF protection
      const state = randomBytes(16).toString('hex');
      oauthStates.set(state, {
        providerId: provider,
        redirectUri: redirect_uri,
        tenantId: tenant_id,
        timestamp: Date.now(),
      });

      // Get authorization URL
      const authUrl = await oauthService.getAuthorizationUrl(
        provider,
        redirect_uri,
        state
      );

      // Redirect to OAuth provider
      return res.redirect(authUrl);
    } catch (error: any) {
      console.error('OAuth initiate error:', error);
      return res.status(500).json({ error: 'OAuth initiation failed', message: error.message });
    }
  });

  /**
   * GET /auth/oauth/:provider/callback
   * OAuth callback handler
   *
   * Query params:
   * - code: Authorization code from OAuth provider
   * - state: State parameter for CSRF protection
   * - error: Error parameter if OAuth flow failed
   * - redirect_uri: Original redirect URI
   * - tenant_id: Tenant ID (optional)
   */
  router.get('/:provider/callback', async (req: Request, res: Response) => {
    try {
      const { provider } = req.params;
      const { code, state, error, error_description } = req.query;
      const redirect_uri = req.query.redirect_uri as string;

      // Check for OAuth error
      if (error) {
        return res.redirect(
          `${redirect_uri}?error=${error}&error_description=${encodeURIComponent(error_description as string || 'Authentication failed')}`
        );
      }

      if (!code || !state) {
        return res.status(400).json({ error: 'Missing code or state' });
      }

      // Verify state
      const storedState = oauthStates.get(state as string);
      if (!storedState || storedState.providerId !== provider) {
        return res.status(400).json({ error: 'Invalid state' });
      }

      // Check state age (reject if older than 10 minutes)
      if (Date.now() - storedState.timestamp > 10 * 60 * 1000) {
        oauthStates.delete(state as string);
        return res.redirect(`${redirect_uri}?error=state_expired`);
      }

      // Exchange code for token
      const tokens = await oauthService.exchangeCodeForToken(
        provider,
        code as string,
        storedState.redirectUri
      );

      // Get user info
      const userInfo = await oauthService.getUserInfo(provider, tokens.access_token);

      // Find or create user
      const { user_id, created } = await oauthService.findOrCreateUser(
        provider,
        userInfo,
        storedState.tenantId
      );

      // Generate JWT access token
      const accessToken = generateToken(storedState.tenantId, user_id, ['user']);

      // Log OAuth login
      await auditService.logAuthEvent(
        user_id,
        'oauth_login',
        'success',
        undefined,
        {
          tenant_id: storedState.tenantId,
          provider,
          provider_user_id: userInfo.provider_user_id,
          email: userInfo.email,
          created,
        }
      );

      // Clean up state
      oauthStates.delete(state as string);

      // Redirect with tokens
      return res.redirect(
        `${storedState.redirectUri}?token=${accessToken}&provider=${provider}&created=${created}`
      );
    } catch (error: any) {
      console.error('OAuth callback error:', error);
      const redirectUri = req.query.redirect_uri as string;
      return res.redirect(`${redirectUri}?error=authentication_failed&error_description=${encodeURIComponent(error.message)}`);
    }
  });

  /**
   * POST /auth/oauth/link
   * Link OAuth account to existing user
   *
   * Body:
   * - provider: Provider ID (google, github)
   * - code: Authorization code
   * - redirect_uri: OAuth callback URL
   *
   * Requires authentication
   */
  router.post('/link', async (req: Request, res: Response) => {
    try {
      const user = req.user;
      if (!user) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const { provider, code, redirect_uri } = req.body;

      if (!provider || !code || !redirect_uri) {
        return res.status(400).json({
          error: 'Missing required fields',
          required: ['provider', 'code', 'redirect_uri'],
        });
      }

      // Exchange code for token
      const tokens = await oauthService.exchangeCodeForToken(provider, code, redirect_uri);

      // Get user info
      const userInfo = await oauthService.getUserInfo(provider, tokens.access_token);

      // Check if already linked
      const existing = await pool.query(
        `SELECT connection_id FROM oauth_connections
         WHERE user_id = $1 AND provider_id = $2 AND is_active = true`,
        [user.user_id, provider]
      );

      if (existing.rows.length > 0) {
        return res.status(409).json({ error: 'Account already linked' });
      }

      // Check if OAuth account is linked to another user
      const otherUser = await pool.query(
        `SELECT user_id FROM oauth_connections
         WHERE provider_id = $1 AND provider_user_id = $2 AND is_active = true`,
        [provider, userInfo.provider_user_id]
      );

      if (otherUser.rows.length > 0) {
        return res.status(409).json({ error: 'OAuth account already linked to another user' });
      }

      // Create connection
      await oauthService.createOAuthConnection(
        user.user_id,
        provider,
        userInfo.provider_user_id,
        tokens.access_token,
        tokens.refresh_token,
        tokens.expires_in ? new Date(Date.now() + tokens.expires_in * 1000) : undefined
      );

      // Log account linking
      await auditService.logAuthEvent(
        user.user_id,
        'oauth_account_linked',
        'success',
        undefined,
        {
          tenant_id: user.tenant_id,
          provider,
          provider_user_id: userInfo.provider_user_id,
          email: userInfo.email,
        }
      );

      return res.json({
        success: true,
        provider,
        provider_user_id: userInfo.provider_user_id,
        email: userInfo.email,
      });
    } catch (error: any) {
      console.error('OAuth link error:', error);
      return res.status(500).json({ error: 'Failed to link account', message: error.message });
    }
  });

  /**
   * GET /auth/oauth/connections
   * List OAuth connections for user
   *
   * Requires authentication
   */
  router.get('/connections', async (req: Request, res: Response) => {
    try {
      const user = req.user;
      if (!user) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const connections = await oauthService.listConnections(user.user_id);

      return res.json({ connections });
    } catch (error: any) {
      console.error('List connections error:', error);
      return res.status(500).json({ error: 'Failed to list connections' });
    }
  });

  /**
   * DELETE /auth/oauth/connections/:connectionId
   * Unlink OAuth account
   *
   * Requires authentication
   */
  router.delete('/connections/:connectionId', async (req: Request, res: Response) => {
    try {
      const user = req.user;
      if (!user) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const { connectionId } = req.params;

      // Get connection details for audit log
      const connection = await pool.query(
        `SELECT provider_id, provider_user_id FROM oauth_connections
         WHERE connection_id = $1 AND user_id = $2 AND is_active = true`,
        [connectionId, user.user_id]
      );

      if (connection.rows.length === 0) {
        return res.status(404).json({ error: 'Connection not found' });
      }

      await oauthService.revokeConnection(connectionId, user.user_id);

      // Log account unlinking
      await auditService.logAuthEvent(
        user.user_id,
        'oauth_account_unlinked',
        'success',
        undefined,
        {
          tenant_id: user.tenant_id,
          connection_id: connectionId,
          provider_id: connection.rows[0].provider_id,
          provider_user_id: connection.rows[0].provider_user_id,
        }
      );

      return res.json({ success: true });
    } catch (error: any) {
      console.error('Unlink account error:', error);
      return res.status(500).json({ error: 'Failed to unlink account', message: error.message });
    }
  });

  /**
   * Clean up expired states (run every hour)
   */
  setInterval(() => {
    const now = Date.now();
    const hour = 60 * 60 * 1000;
    for (const [state, data] of oauthStates.entries()) {
      if (now - data.timestamp > hour) {
        oauthStates.delete(state);
      }
    }
  }, 60 * 60 * 1000);

  return router;
}
