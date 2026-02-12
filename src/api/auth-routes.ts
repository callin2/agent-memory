/**
 * Authentication routes
 * Handles login, token refresh, and user management
 */

import { Router, Request, Response } from "express";
import { Pool } from "pg";
import bcrypt from "bcryptjs";
import {
  verifyToken,
  generateAPIKey,
  requireRole,
  extractDeviceInfo,
} from "../middleware/auth.js";
import { TokenService } from "../services/token-service.js";
import { SessionService } from "../services/session-service.js";
import { AuditService } from "../services/audit-service.js";

export function createAuthRoutes(
  pool: Pool,
  tokenService: TokenService,
  sessionService: SessionService,
  auditService: AuditService,
): Router {
  const router = Router();

  /**
   * POST /auth/login
   * Authenticate user and return JWT + refresh tokens
   */
  router.post("/login", async (req: Request, res: Response) => {
    try {
      const { username, password, tenant_id } = req.body;

      if (!username || !password) {
        return res.status(400).json({
          error: "Missing required fields",
          fields: ["username", "password"],
        });
      }

      // Query user from database
      const user = await getUser(pool, username, tenant_id || "default");

      if (!user) {
        await auditService.logAuthEvent(
          "unknown",
          "auth.login",
          "failure",
          req,
          {
            username,
            tenant_id: tenant_id || "default",
            reason: "user_not_found",
          },
        );

        return res.status(401).json({
          error: "Invalid credentials",
        });
      }

      // Verify password with bcrypt (12 rounds)
      const isValid = await bcrypt.compare(password, user.password_hash);

      if (!isValid) {
        await auditService.logAuthEvent(
          user.user_id,
          "auth.login",
          "failure",
          req,
          {
            username,
            reason: "invalid_password",
          },
        );

        return res.status(401).json({
          error: "Invalid credentials",
        });
      }

      // Extract device info
      const deviceInfo = extractDeviceInfo(req);

      // Generate refresh token (7 days)
      const { token: refreshToken } = await tokenService.generateRefreshToken(
        user.user_id,
        user.tenant_id,
        deviceInfo,
        7 * 24 * 60 * 60,
      );

      // Generate access token (15 minutes)
      const accessToken = tokenService.generateAccessToken(
        user.user_id,
        user.tenant_id,
        user.roles,
      );

      // Create session
      const sessionId = await sessionService.createSession(
        user.user_id,
        user.tenant_id,
        deviceInfo,
        deviceInfo.ip,
        deviceInfo.userAgent,
      );

      // Update last login
      await pool.query(
        "UPDATE users SET last_login = NOW() WHERE user_id = $1",
        [user.user_id],
      );

      // Log successful login
      await auditService.logAuthEvent(
        user.user_id,
        "auth.login",
        "success",
        req,
        {
          username,
          session_id: sessionId,
          refresh_token_id: refreshToken.split("_")[1],
        },
      );

      return res.json({
        access_token: accessToken,
        refresh_token: refreshToken,
        token_type: "Bearer",
        expires_in: 15 * 60, // 15 minutes
        refresh_expires_in: 7 * 24 * 60 * 60, // 7 days
        user: {
          tenant_id: user.tenant_id,
          user_id: user.user_id,
          username: user.username,
          roles: user.roles,
        },
      });
    } catch (error: any) {
      console.error("Login error:", error);
      return res.status(500).json({
        error: "Login failed",
        message: error.message,
      });
    }
  });

  /**
   * POST /auth/register
   * Register a new user
   */
  router.post("/register", async (req: Request, res: Response) => {
    try {
      const { username, password, tenant_id, email } = req.body;

      if (!username || !password) {
        return res.status(400).json({
          error: "Missing required fields",
          fields: ["username", "password"],
        });
      }

      // Check if user exists
      const existingUser = await getUser(
        pool,
        username,
        tenant_id || "default",
      );
      if (existingUser) {
        return res.status(409).json({
          error: "User already exists",
        });
      }

      // Hash password with bcrypt (12 rounds)
      const password_hash = await bcrypt.hash(password, 12);

      // Create user
      const user_id = `user_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;

      await pool.query(
        `INSERT INTO users (user_id, tenant_id, username, email, password_hash, roles, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
        [
          user_id,
          tenant_id || "default",
          username,
          email || null,
          password_hash,
          ["user"],
        ],
      );

      // Extract device info
      const deviceInfo = extractDeviceInfo(req);

      // Generate refresh token
      const { token: refreshToken } = await tokenService.generateRefreshToken(
        user_id,
        tenant_id || "default",
        deviceInfo,
      );

      // Generate access token
      const accessToken = tokenService.generateAccessToken(
        tenant_id || "default",
        user_id,
        ["user"],
      );

      // Create session
      await sessionService.createSession(
        user_id,
        tenant_id || "default",
        deviceInfo,
        deviceInfo.ip,
        deviceInfo.userAgent,
      );

      // Log registration
      await auditService.logAuthEvent(user_id, "register", "success", req, {
        username,
        email,
        tenant_id: tenant_id || "default",
      });

      return res.status(201).json({
        access_token: accessToken,
        refresh_token: refreshToken,
        token_type: "Bearer",
        expires_in: 15 * 60,
        refresh_expires_in: 7 * 24 * 60 * 60,
        user: {
          user_id,
          tenant_id: tenant_id || "default",
          username,
          roles: ["user"],
        },
      });
    } catch (error: any) {
      console.error("Registration error:", error);
      return res.status(500).json({
        error: "Registration failed",
        message: error.message,
      });
    }
  });

  /**
   * POST /auth/token/refresh
   * Exchange refresh token for new access token (with rotation)
   */
  router.post("/token/refresh", async (req: Request, res: Response) => {
    try {
      const { refresh_token } = req.body;

      if (!refresh_token) {
        return res.status(400).json({
          error: "Missing refresh token",
        });
      }

      // Validate refresh token
      const tokenData = await tokenService.validateRefreshToken(refresh_token);

      if (!tokenData) {
        // Check if this is a token theft attempt (revoked token being reused)
        const theftDetected =
          await tokenService.checkTokenTheftAttempt(refresh_token);
        if (theftDetected) {
          // Get token data for logging (even though it's revoked)
          const revokedTokenData =
            await tokenService.lookupRefreshTokenForLogging(refresh_token);
          if (revokedTokenData) {
            // Revoke all tokens in the family
            await tokenService.revokeAllUserTokens(
              revokedTokenData.user_id,
              "theft_detected",
            );

            await auditService.logAuthEvent(
              revokedTokenData.user_id,
              "auth.token_refresh",
              "failure",
              req,
              {
                reason: "token_theft_detected",
                token_id: revokedTokenData.token_id,
              },
            );

            return res.status(403).json({
              error: "Token theft detected. All sessions revoked.",
            });
          }
        }

        await auditService.logAuthEvent(
          "unknown",
          "auth.token_refresh",
          "failure",
          req,
          { reason: "invalid_refresh_token" },
        );

        return res.status(401).json({
          error: "Invalid or expired refresh token",
        });
      }

      // Get user roles
      const userResult = await pool.query(
        "SELECT roles FROM users WHERE user_id = $1",
        [tokenData.user_id],
      );

      const roles = userResult.rows[0]?.roles || [];

      // Rotate refresh token (issue new one, revoke old)
      const deviceInfo = extractDeviceInfo(req);
      const { newToken, newTokenId } = await tokenService.rotateRefreshToken(
        refresh_token,
        deviceInfo,
      );

      // Generate new access token
      const accessToken = tokenService.generateAccessToken(
        tokenData.user_id,
        tokenData.tenant_id,
        roles,
      );

      // Update session activity
      await sessionService.updateSessionActivity(newTokenId);

      // Log token refresh
      await auditService.logAuthEvent(
        tokenData.user_id,
        "auth.token_refresh",
        "success",
        req,
        {
          old_token_id: tokenData.token_id,
          new_token_id: newTokenId,
        },
      );

      return res.json({
        access_token: accessToken,
        refresh_token: newToken,
        token_type: "Bearer",
        expires_in: 15 * 60,
        refresh_expires_in: 7 * 24 * 60 * 60,
      });
    } catch (error: any) {
      console.error("Token refresh error:", error);
      return res.status(500).json({
        error: "Token refresh failed",
        message: error.message,
      });
    }
  });

  /**
   * POST /auth/token/revoke
   * Revoke a refresh token (logout)
   */
  router.post("/token/revoke", async (req: Request, res: Response) => {
    try {
      const { refresh_token } = req.body;

      if (!refresh_token) {
        return res.status(400).json({
          error: "Missing refresh token",
        });
      }

      // Validate and get token data
      const tokenData = await tokenService.validateRefreshToken(refresh_token);

      if (!tokenData) {
        return res.status(401).json({
          error: "Invalid or expired refresh token",
        });
      }

      // Revoke the token
      await tokenService.revokeRefreshToken(tokenData.token_id, "logout");

      // Revoke associated session
      await sessionService.revokeSession(tokenData.token_id, tokenData.user_id);

      // Log logout
      await auditService.logAuthEvent(
        tokenData.user_id,
        "logout",
        "success",
        req,
        {
          token_id: tokenData.token_id,
        },
      );

      return res.json({
        message: "Token revoked successfully",
      });
    } catch (error: any) {
      console.error("Token revoke error:", error);
      return res.status(500).json({
        error: "Token revoke failed",
        message: error.message,
      });
    }
  });

  /**
   * POST /auth/api-keys
   * Generate a new API key
   */
  router.post(
    "/api-keys",
    requireRole("admin", "tenant_admin"),
    async (req: Request, res: Response) => {
      try {
        const { scopes = [] } = req.body;
        const tenant_id = req.user!.tenant_id;

        const apiKey = generateAPIKey(tenant_id, scopes);

        return res.status(201).json({
          api_key: apiKey,
          tenant_id,
          scopes,
        });
      } catch (error: any) {
        console.error("API key generation error:", error);
        return res.status(500).json({
          error: "Failed to generate API key",
          message: error.message,
        });
      }
    },
  );

  /**
   * POST /auth/validate
   * Validate a token without refreshing
   */
  router.post("/validate", async (req: Request, res: Response) => {
    try {
      const { token } = req.body;

      if (!token) {
        return res.status(400).json({
          error: "Missing token",
        });
      }

      const payload = verifyToken(token);

      if (!payload) {
        return res.status(401).json({
          valid: false,
        });
      }

      return res.json({
        valid: true,
        user: {
          tenant_id: payload.tenant_id,
          user_id: payload.user_id,
          roles: payload.roles,
        },
      });
    } catch (error: any) {
      return res.status(500).json({
        error: "Validation failed",
        message: error.message,
      });
    }
  });

  return router;
}

/**
 * Get user from database
 * In production, this would query a users table
 */
async function getUser(
  pool: Pool,
  username: string,
  tenant_id: string,
): Promise<any | null> {
  // For demo: check if users table exists
  try {
    const result = await pool.query(
      `SELECT user_id, tenant_id, username, email, password_hash, roles
       FROM users
       WHERE username = $1 AND tenant_id = $2`,
      [username, tenant_id],
    );

    return result.rows[0] || null;
  } catch (error) {
    // If users table doesn't exist, return null
    return null;
  }
}

/**
 * Create users table if it doesn't exist
 */
export async function ensureUsersTable(pool: Pool): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      user_id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      username TEXT NOT NULL,
      email TEXT,
      password_hash TEXT NOT NULL,
      roles TEXT[] NOT NULL DEFAULT '{user}',
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      last_login TIMESTAMPTZ,
      UNIQUE(tenant_id, username)
    );

    CREATE INDEX IF NOT EXISTS idx_users_tenant_id ON users(tenant_id);
    CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
  `);
}
