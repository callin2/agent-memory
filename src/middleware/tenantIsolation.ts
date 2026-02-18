/**
 * Tenant Isolation Middleware
 *
 * Ensures that API key's tenant_id matches request tenant_id
 * Prevents horizontal privilege escalation (Tenant A accessing Tenant B data)
 *
 * Security critical: This prevents cross-tenant data access
 */

import { Request, Response, NextFunction } from 'express';
import { ApiKeyInfo } from './apiKeyAuth.js';

/**
 * Extract tenant_id from various request locations
 */
function extractRequestTenantId(req: Request): string | undefined {
  // Check body first
  if (req.body?.tenant_id) {
    return req.body.tenant_id;
  }

  // Check query parameters
  if (req.query.tenant_id) {
    return req.query.tenant_id as string;
  }

  // Check URL parameters
  if (req.params.tenant_id) {
    return req.params.tenant_id;
  }

  return undefined;
}

/**
 * Tenant isolation middleware factory
 *
 * Verifies that the authenticated API key's tenant_id matches the tenant_id
 * in the request body, query params, or URL params.
 *
 * Options:
 * - allowOverride: Allow body tenant_id to override API key tenant_id (default: false)
 * - requireTenantId: Require tenant_id in request (default: true)
 */
export function createTenantIsolationMiddleware(
  options: {
    allowOverride?: boolean;
    requireTenantId?: boolean;
  } = {}
) {
  const { allowOverride = false, requireTenantId = true } = options;

  return async (req: Request, res: Response, next: NextFunction) => {
    // Get API key info from request (set by apiKeyAuth middleware)
    const apiKey = req.apiKey as ApiKeyInfo | undefined;

    if (!apiKey) {
      // No authentication - tenant isolation doesn't apply
      return next();
    }

    const requestTenantId = extractRequestTenantId(req);
    const keyTenantId = apiKey.tenant_id;

    // If no tenant_id in request and it's required, use the API key's tenant_id
    if (!requestTenantId) {
      if (requireTenantId) {
        // Automatically set tenant_id from API key
        req.body.tenant_id = keyTenantId;
      }
      return next();
    }

    // Verify tenant_id matches
    if (requestTenantId !== keyTenantId) {
      // Security: Attempting to access different tenant's data
      console.warn(
        `[Tenant Isolation] Blocked cross-tenant access attempt: ` +
        `API key tenant=${keyTenantId} requested tenant=${requestTenantId} ` +
        `from ${req.ip} path=${req.path}`
      );

      return res.status(403).json({
        error: 'Tenant mismatch',
        message: `API key is authorized for tenant '${keyTenantId}' but request specifies '${requestTenantId}'`,
        api_key_tenant: keyTenantId,
        request_tenant: requestTenantId,
      });
    }

    // Tenant ID matches - allow request to proceed
    next();
  };
}

/**
 * Middleware to ensure API key has access to specific tenant
 * For use in specific route handlers that need tenant validation
 */
export function requireTenantMatch(req: Request, res: Response, next: NextFunction) {
  const apiKey = req.apiKey as ApiKeyInfo | undefined;

  if (!apiKey) {
    return res.status(401).json({
      error: 'Authentication required',
      message: 'This endpoint requires API key authentication',
    });
  }

  const requestTenantId = extractRequestTenantId(req);

  if (!requestTenantId) {
    return res.status(400).json({
      error: 'tenant_id required',
      message: 'Please specify tenant_id in request body or query parameters',
    });
  }

  if (requestTenantId !== apiKey.tenant_id) {
    return res.status(403).json({
      error: 'Tenant mismatch',
      message: `API key is authorized for tenant '${apiKey.tenant_id}' but request specifies '${requestTenantId}'`,
    });
  }

  next();
}

/**
 * Middleware to automatically inject tenant_id from API key
 * Use for endpoints where tenant_id should come from authentication, not request
 */
export function injectTenantFromApiKey(req: Request, res: Response, next: NextFunction) {
  const apiKey = req.apiKey as ApiKeyInfo | undefined;

  if (apiKey && !req.body.tenant_id) {
    req.body.tenant_id = apiKey.tenant_id;
  }

  next();
}
