/**
 * API Key Authentication Middleware
 *
 * Provides API key-based authentication for securing API endpoints.
 * Supports multiple API keys with different permission levels.
 *
 * Features:
 * - Multiple API keys per tenant
 * - Different permission levels (read, write, admin)
 * - API key rotation support
 * - Audit logging
 */

import { Request, Response, NextFunction } from 'express';
import { Pool } from 'pg';

export interface ApiKeyPermissions {
  can_read: boolean;
  can_write: boolean;
  can_delete: boolean;
  can_admin: boolean;
}

export interface ApiKeyInfo {
  id: string;
  tenant_id: string;
  name: string;
  key_prefix: string; // First 8 chars for identification
  permissions: ApiKeyPermissions;
  is_active: boolean;
  created_at: Date;
  last_used_at?: Date;
}

/**
 * Verify API key and return key information
 */
export async function verifyApiKey(
  pool: Pool,
  apiKey: string
): Promise<ApiKeyInfo | null> {
  if (!apiKey || !apiKey.startsWith('ak_')) {
    return null;
  }

  const result = await pool.query(
    `SELECT
       id,
       tenant_id,
       name,
       key_hash,
       key_prefix,
       permissions,
       is_active,
       created_at,
       last_used_at
     FROM api_keys
     WHERE key_prefix = $1
       AND is_active = true`,
    [apiKey.substring(0, 10)] // ak_xxxxxx...
  );

  if (result.rows.length === 0) {
    return null;
  }

  const keyInfo = result.rows[0];

  // Verify the key hash matches
  const crypto = await import('crypto');
  const hash = crypto.createHash('sha256').update(apiKey).digest('hex');

  if (hash !== keyInfo.key_hash) {
    return null;
  }

  // Update last_used_at
  await pool.query(
    'UPDATE api_keys SET last_used_at = NOW() WHERE id = $1',
    [keyInfo.id]
  );

  return {
    id: keyInfo.id,
    tenant_id: keyInfo.tenant_id,
    name: keyInfo.name,
    key_prefix: keyInfo.key_prefix,
    permissions: keyInfo.permissions,
    is_active: keyInfo.is_active,
    created_at: keyInfo.created_at,
    last_used_at: keyInfo.last_used_at,
  };
}

/**
 * API Key authentication middleware factory
 */
export function createApiKeyAuthMiddleware(
  pool: Pool,
  options: {
    required?: boolean;
    permission?: 'read' | 'write' | 'delete' | 'admin';
  } = {}
) {
  const { required = true, permission = 'read' } = options;

  return async (req: Request, res: Response, next: NextFunction) => {
    // Try to get API key from header or query parameter
    const apiKey =
      req.headers['x-api-key'] as string ||
      req.headers['authorization']?.replace('Bearer ', '') ||
      req.query.api_key as string;

    if (!apiKey) {
      if (required) {
        return res.status(401).json({
          error: 'API key required',
          message: 'Please provide API key via X-API-Key header or ?api_key= parameter',
        });
      }
      // Not required - allow anonymous access
      return next();
    }

    // Verify API key
    const keyInfo = await verifyApiKey(pool, apiKey);

    if (!keyInfo) {
      return res.status(403).json({
        error: 'Invalid API key',
        message: 'The provided API key is invalid or inactive',
      });
    }

    // Check permissions
    const permissionMap = {
      read: 'can_read',
      write: 'can_write',
      delete: 'can_delete',
      admin: 'can_admin',
    };

    const requiredPermission = permissionMap[permission];
    if (!keyInfo.permissions[requiredPermission]) {
      return res.status(403).json({
        error: 'Insufficient permissions',
        message: `This operation requires '${permission}' permission`,
      });
    }

    // Attach key info to request for use in handlers
    req.apiKey = keyInfo;

    // Set tenant_id from API key if not already set
    if (!req.body.tenant_id) {
      req.body.tenant_id = keyInfo.tenant_id;
    }

    next();
  };
}

/**
 * Extend Express Request type to include apiKey
 */
declare module 'express' {
  interface Request {
    apiKey?: ApiKeyInfo;
  }
}

/**
 * Middleware to ensure API key has required permission
 */
export function requirePermission(permission: keyof ApiKeyPermissions) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.apiKey) {
      return res.status(401).json({
        error: 'Authentication required',
        message: 'This endpoint requires API key authentication',
      });
    }

    if (!req.apiKey.permissions[permission]) {
      return res.status(403).json({
        error: 'Insufficient permissions',
        message: `Required permission: ${permission}`,
      });
    }

    next();
  };
}
