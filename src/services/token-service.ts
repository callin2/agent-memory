/**
 * Refresh Token Service
 *
 * Manages refresh token lifecycle including:
 * - Token generation with secure random values
 * - Token validation and hash verification
 * - Token rotation (new token on each use)
 * - Token revocation with reason tracking
 * - Token family tracking for theft detection
 * - Cleanup of expired tokens
 */

import { Pool } from "pg";
import crypto from "crypto";
import { generateToken } from "../middleware/auth.js";

export interface RefreshTokenData {
  token_id: string;
  user_id: string;
  tenant_id: string;
  expires_at: Date;
  rotated_at?: Date;
  replaced_by?: string;
  revoked_at?: Date;
  revoked_reason?: string;
  device_info?: Record<string, any>;
  last_used_at?: Date;
  created_at: Date;
}

export interface GeneratedToken {
  token: string;
  tokenHash: string;
  tokenId: string;
  expiresAt: Date;
}

export interface RotatedToken {
  newToken: string;
  newTokenHash: string;
  newTokenId: string;
  expiresAt: Date;
}

/**
 * Token Service class for refresh token management
 */
export class TokenService {
  constructor(private pool: Pool) {}

  /**
   * Generate a new refresh token
   *
   * @param userId - User ID
   * @param tenantId - Tenant ID
   * @param deviceInfo - Device fingerprint information
   * @param expiresIn - Token lifetime in seconds (default: 7 days)
   * @returns Generated token with metadata
   */
  async generateRefreshToken(
    userId: string,
    tenantId: string,
    deviceInfo?: Record<string, any>,
    expiresIn: number = 7 * 24 * 60 * 60, // 7 days
  ): Promise<GeneratedToken> {
    // Generate secure random token (48 bytes = 384 bits)
    const token = crypto.randomBytes(48).toString("base64url");
    const tokenHash = this.hashToken(token);
    const tokenId = `rt_${Date.now()}_${crypto.randomBytes(16).toString("hex")}`;
    const expiresAt = new Date(Date.now() + expiresIn * 1000);

    await this.pool.query(
      `INSERT INTO refresh_tokens (token_id, user_id, tenant_id, token_hash, expires_at, device_info)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        tokenId,
        userId,
        tenantId,
        tokenHash,
        expiresAt,
        JSON.stringify(deviceInfo || {}),
      ],
    );

    return {
      token,
      tokenHash,
      tokenId,
      expiresAt,
    };
  }

  /**
   * Look up a refresh token by hash (includes revoked tokens)
   *
   * @param token - The refresh token string
   * @returns Token data or null if not found
   */
  private async lookupRefreshToken(
    token: string,
  ): Promise<RefreshTokenData | null> {
    const tokenHash = this.hashToken(token);

    const result = await this.pool.query<RefreshTokenData>(
      `SELECT token_id, user_id, tenant_id, expires_at, rotated_at, replaced_by,
              revoked_at, revoked_reason, device_info, last_used_at, created_at
       FROM refresh_tokens
       WHERE token_hash = $1`,
      [tokenHash],
    );

    if (result.rows.length === 0) {
      return null;
    }

    return result.rows[0];
  }

  /**
   * Look up a refresh token for logging purposes (public method)
   *
   * @param token - The refresh token string
   * @returns Token data or null if not found
   */
  async lookupRefreshTokenForLogging(
    token: string,
  ): Promise<RefreshTokenData | null> {
    const tokenHash = this.hashToken(token);

    const result = await this.pool.query<RefreshTokenData>(
      `SELECT token_id, user_id, tenant_id, expires_at, rotated_at, replaced_by,
              revoked_at, revoked_reason, device_info, last_used_at, created_at
       FROM refresh_tokens
       WHERE token_hash = $1`,
      [tokenHash],
    );

    if (result.rows.length === 0) {
      return null;
    }

    return result.rows[0];
  }

  /**
   * Validate a refresh token and return its data
   *
   * @param token - The refresh token string
   * @returns Token data or null if invalid
   */
  async validateRefreshToken(token: string): Promise<RefreshTokenData | null> {
    const tokenData = await this.lookupRefreshToken(token);

    if (!tokenData) {
      return null;
    }

    // Check if revoked (rotated, expired manually, or theft)
    if (tokenData.revoked_at !== null) {
      return null;
    }

    // Check if expired
    if (new Date() > tokenData.expires_at) {
      await this.revokeRefreshToken(tokenData.token_id, "expired");
      return null;
    }

    return tokenData;
  }

  /**
   * Check if a refresh token indicates theft attempt
   * This should be called when validateRefreshToken returns null
   *
   * @param token - The refresh token string
   * @returns True if token theft is detected
   */
  async checkTokenTheftAttempt(token: string): Promise<boolean> {
    const tokenData = await this.lookupRefreshToken(token);

    if (!tokenData) {
      return false;
    }

    // Token was rotated (replaced by a newer token)
    return (
      tokenData.revoked_at !== null &&
      tokenData.revoked_reason === "rotated" &&
      tokenData.replaced_by !== null
    );
  }

  /**
   * Rotate a refresh token (issue new token, revoke old one)
   *
   * @param oldToken - The old refresh token
   * @param deviceInfo - Updated device info
   * @returns New token data
   */
  async rotateRefreshToken(
    oldToken: string,
    deviceInfo?: Record<string, any>,
  ): Promise<RotatedToken> {
    const oldTokenData = await this.validateRefreshToken(oldToken);

    if (!oldTokenData) {
      throw new Error("Invalid or expired refresh token");
    }

    // Generate new token
    const { token, tokenHash, tokenId, expiresAt } =
      await this.generateRefreshToken(
        oldTokenData.user_id,
        oldTokenData.tenant_id,
        deviceInfo || oldTokenData.device_info,
      );

    // Mark old token as rotated and link to new token
    await this.pool.query(
      `UPDATE refresh_tokens
       SET rotated_at = NOW(),
           replaced_by = $1,
           revoked_at = NOW(),
           revoked_reason = 'rotated'
       WHERE token_id = $2`,
      [tokenId, oldTokenData.token_id],
    );

    return {
      newToken: token,
      newTokenHash: tokenHash,
      newTokenId: tokenId,
      expiresAt,
    };
  }

  /**
   * Revoke a refresh token
   *
   * @param tokenId - Token ID to revoke
   * @param reason - Revocation reason (logout, compromised, expired, etc.)
   */
  async revokeRefreshToken(tokenId: string, reason: string): Promise<void> {
    await this.pool.query(
      `UPDATE refresh_tokens
       SET revoked_at = NOW(),
           revoked_reason = $1
       WHERE token_id = $2`,
      [reason, tokenId],
    );
  }

  /**
   * Detect token theft by checking token family
   *
   * If a token from the family is used after being rotated/replaced,
   * it indicates a potential token theft
   *
   * @param tokenId - Token ID to check
   * @returns True if token theft is detected
   */
  async detectTokenTheft(tokenId: string): Promise<boolean> {
    const result = await this.pool.query(
      `SELECT replaced_by, revoked_at, revoked_reason
       FROM refresh_tokens
       WHERE token_id = $1`,
      [tokenId],
    );

    if (result.rows.length === 0) {
      return false;
    }

    const tokenData = result.rows[0];

    // If token was rotated and someone tries to use it again
    return (
      tokenData.revoked_at !== null &&
      tokenData.revoked_reason === "rotated" &&
      tokenData.replaced_by !== null
    );
  }

  /**
   * Get all active tokens for a user
   *
   * @param userId - User ID
   * @returns Array of active tokens
   */
  async getAllUserTokens(userId: string): Promise<RefreshTokenData[]> {
    const result = await this.pool.query<RefreshTokenData>(
      `SELECT token_id, user_id, tenant_id, expires_at, rotated_at, replaced_by,
              revoked_at, revoked_reason, device_info, last_used_at, created_at
       FROM refresh_tokens
       WHERE user_id = $1 AND revoked_at IS NULL AND expires_at > NOW()
       ORDER BY created_at DESC`,
      [userId],
    );

    return result.rows;
  }

  /**
   * Update the last used timestamp for a token
   *
   * @param tokenId - Token ID
   */
  async updateLastUsed(tokenId: string): Promise<void> {
    await this.pool.query(
      `UPDATE refresh_tokens
       SET last_used_at = NOW()
       WHERE token_id = $1`,
      [tokenId],
    );
  }

  /**
   * Revoke all tokens for a user (e.g., on password change)
   *
   * @param userId - User ID
   * @param reason - Revocation reason
   */
  async revokeAllUserTokens(
    userId: string,
    reason: string = "security",
  ): Promise<void> {
    await this.pool.query(
      `UPDATE refresh_tokens
       SET revoked_at = NOW(),
           revoked_reason = $1
       WHERE user_id = $2 AND revoked_at IS NULL`,
      [reason, userId],
    );
  }

  /**
   * Clean up expired tokens older than specified days
   *
   * @param daysOld - Delete tokens older than this many days
   * @returns Number of tokens deleted
   */
  async cleanupExpiredTokens(daysOld: number = 30): Promise<number> {
    const result = await this.pool.query(
      `DELETE FROM refresh_tokens
       WHERE expires_at < NOW() - INTERVAL '1 day' * $1`,
      [daysOld],
    );

    return result.rowCount || 0;
  }

  /**
   * Hash a token using SHA-256
   *
   * @param token - Token to hash
   * @returns Hex-encoded hash
   */
  private hashToken(token: string): string {
    return crypto.createHash("sha256").update(token).digest("hex");
  }

  /**
   * Generate a new access token for a user
   *
   * @param userId - User ID
   * @param tenantId - Tenant ID
   * @param roles - User roles
   * @returns JWT access token
   */
  generateAccessToken(
    userId: string,
    tenantId: string,
    roles: string[] = [],
  ): string {
    const jti = `atk_${Date.now()}_${crypto.randomBytes(8).toString("hex")}`;
    return generateToken(tenantId, userId, roles, undefined, jti);
  }
}
