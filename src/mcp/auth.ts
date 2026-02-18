/**
 * Authentication utilities for MCP Server
 *
 * Simple Bearer token validation for n8n-style authentication:
 * - Validates API keys from Authorization header
 * - Extracts tenant_id from valid tokens
 * - Supports dev mode with single test token
 */

import { Pool } from "pg";

/**
 * Parsed authentication result
 */
export interface AuthResult {
  valid: boolean;
  tenant_id?: string;
  error?: string;
}

/**
 * Validate Bearer token and extract tenant_id
 *
 * Token format: ak_<timestamp>_<tenant_id>.<signature>
 * Example: ak_1704067200_default.abc123xyz
 */
export async function validateBearerToken(
  token: string,
  pool?: Pool
): Promise<AuthResult> {
  // Dev mode: accept test token
  if (process.env.NODE_ENV !== "production" && token === "test-mcp-token") {
    return {
      valid: true,
      tenant_id: "default",
    };
  }

  // Validate API key format
  const apiKeyRegex = /^ak_\d+_(.+)\.[a-zA-Z0-9]+$/;
  const match = token.match(apiKeyRegex);

  if (!match) {
    return {
      valid: false,
      error: "Invalid token format. Expected: ak_<timestamp>_<tenant_id>.<signature>",
    };
  }

  const tenant_id = match[1];

  // In production, validate against database
  if (pool && process.env.NODE_ENV === "production") {
    try {
      const result = await pool.query(
        `SELECT api_key, is_active, tenant_id
         FROM api_keys
         WHERE api_key = $1 AND is_active = true`,
        [token]
      );

      if (result.rows.length === 0) {
        return {
          valid: false,
          error: "Invalid or inactive API key",
        };
      }

      return {
        valid: true,
        tenant_id: result.rows[0].tenant_id,
      };
    } catch (error) {
      console.error("Error validating API key:", error);
      return {
        valid: false,
        error: "Database error validating token",
      };
    }
  }

  // Dev mode: trust the token format
  return {
    valid: true,
    tenant_id,
  };
}

/**
 * Extract Bearer token from Authorization header
 */
export function extractBearerToken(authHeader: string | undefined): string | null {
  if (!authHeader) {
    return null;
  }

  const parts = authHeader.split(" ");
  if (parts.length !== 2 || parts[0] !== "Bearer") {
    return null;
  }

  return parts[1];
}
