/**
 * JWT Token Operations
 *
 * Provides JWT token generation and validation functions.
 * Maintains backward compatibility with existing token format.
 *
 * @module jwt
 */

import jwt from 'jsonwebtoken';
import type { JWTPayload, AuthConfig } from './types.js';

/**
 * Get default authentication configuration from environment variables
 *
 * Reads configuration from environment variables with fallback defaults.
 * In production, ensure JWT_SECRET is set to a secure value.
 *
 * @returns AuthConfig object with secret, expiresIn, and issuer
 *
 * @example
 * ```ts
 * const config = getAuthConfig();
 * // Uses process.env.JWT_SECRET, process.env.JWT_EXPIRES_IN, process.env.JWT_ISSUER
 * ```
 */
export function getAuthConfig(): AuthConfig {
  return {
    secret: process.env.JWT_SECRET || 'change-this-secret-in-production',
    expiresIn: process.env.JWT_EXPIRES_IN || '15m',
    issuer: process.env.JWT_ISSUER || 'agent-memory-system',
  };
}

/**
 * Generate a JWT token for a user
 *
 * Creates a signed JWT token containing user identification and roles.
 * The token includes standard claims (iss, sub, aud) plus custom payload.
 *
 * @param tenant_id - Tenant identifier for multi-tenancy
 * @param user_id - User identifier
 * @param roles - Array of role strings for authorization (default: [])
 * @param config - Optional auth config (defaults to getAuthConfig())
 * @param jti - Optional JWT ID for token tracking and revocation
 * @returns Signed JWT token string
 *
 * @example
 * ```ts
 * const token = generateToken('tenant123', 'user456', ['admin', 'user']);
 * // Returns: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
 * ```
 */
export function generateToken(
  tenant_id: string,
  user_id: string,
  roles: string[] = [],
  config?: AuthConfig,
  jti?: string
): string {
  const authConfig = config || getAuthConfig();

  const payload: Omit<JWTPayload, 'iat' | 'exp' | 'jti'> = {
    tenant_id,
    user_id,
    roles,
  };

  const signOptions = {
    expiresIn: authConfig.expiresIn,
    issuer: authConfig.issuer,
    subject: user_id,
    audience: 'agent-memory-api' as const,
  } as const;

  if (jti) {
    signOptions.jwtid = jti;
  }

  return jwt.sign(payload, authConfig.secret, signOptions);
}

/**
 * Verify a JWT token
 *
 * Validates a JWT token and returns the decoded payload if valid.
 * Returns null for invalid, expired, or malformed tokens.
 *
 * @param token - JWT token string to verify
 * @param config - Optional auth config (defaults to getAuthConfig())
 * @returns Decoded JWT payload or null if invalid
 *
 * @example
 * ```ts
 * const payload = verifyToken(token);
 * if (payload) {
 *   console.log('User:', payload.user_id);
 *   console.log('Tenant:', payload.tenant_id);
 *   console.log('Roles:', payload.roles);
 * }
 * ```
 */
export function verifyToken(token: string, config?: AuthConfig): JWTPayload | null {
  try {
    const authConfig = config || getAuthConfig();
    const decoded = jwt.verify(token, authConfig.secret, {
      issuer: authConfig.issuer,
      audience: 'agent-memory-api',
    });

    return decoded as JWTPayload;
  } catch (error) {
    return null;
  }
}

/**
 * Decode a JWT token without verification
 *
 * Returns the decoded payload without verifying the signature.
 * Useful for debugging or extracting data before verification.
 * WARNING: Do not use for authentication decisions.
 *
 * @param token - JWT token string to decode
 * @returns Decoded JWT payload or null if malformed
 *
 * @example
 * ```ts
 * const payload = decodeToken(token);
 * // Payload data without signature verification
 * ```
 */
export function decodeToken(token: string): JWTPayload | null {
  try {
    const decoded = jwt.decode(token);
    return decoded as JWTPayload;
  } catch (error) {
    return null;
  }
}
