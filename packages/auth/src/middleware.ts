/**
 * Express Authentication Middleware
 *
 * Provides Express middleware functions for JWT and API key authentication.
 * These middleware functions attach user information to the request object.
 *
 * @module middleware
 */

import type { Request, Response, NextFunction } from 'express';
import { verifyToken } from './jwt.js';
import { validateAPIKey } from './api-keys.js';

/**
 * Extended Express Request with user information
 *
 * This type augmentation allows TypeScript to recognize the added
 * user and tenant_id properties on the Request object.
 */
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: {
        tenant_id: string;
        user_id: string;
        roles: string[];
      };
      tenant_id?: string;
    }
  }
}

/**
 * Extract JWT token from Authorization header
 *
 * Parses the Authorization header and extracts the Bearer token.
 * Returns null if header is missing or malformed.
 *
 * @param req - Express Request object
 * @returns Token string or null
 *
 * @example
 * ```ts
 * const token = extractToken(req);
 * if (token) {
 *   const payload = verifyToken(token);
 * }
 * ```
 */
export function extractToken(req: Request): string | null {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return null;
  }

  // Bearer token format
  const parts = authHeader.split(' ');
  if (parts.length === 2 && parts[0] === 'Bearer') {
    return parts[1];
  }

  return null;
}

/**
 * JWT Authentication Middleware
 *
 * Verifies JWT token from Authorization header and attaches user to request.
 * Sends 401 response if token is missing or invalid.
 *
 * @param req - Express Request object
 * @param res - Express Response object
 * @param next - Express NextFunction callback
 *
 * @example
 * ```ts
 * import { authenticate } from '@agent-memory/auth/middleware';
 * app.get('/protected', authenticate, (req, res) => {
 *   res.json({ user: req.user });
 * });
 * ```
 */
export function authenticate(req: Request, res: Response, next: NextFunction): void {
  const token = extractToken(req);

  if (!token) {
    res.status(401).json({
      error: 'Unauthorized',
      message: 'Missing or invalid Authorization header',
    });
    return;
  }

  const payload = verifyToken(token);

  if (!payload) {
    res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid or expired token',
    });
    return;
  }

  // Attach user info to request
  req.user = {
    tenant_id: payload.tenant_id,
    user_id: payload.user_id,
    roles: payload.roles,
  };
  req.tenant_id = payload.tenant_id;

  next();
}

/**
 * Optional Authentication Middleware
 *
 * Attaches user if token is present, but doesn't require it.
 * Useful for endpoints that work both authenticated and unauthenticated.
 *
 * @param req - Express Request object
 * @param _res - Express Response object (unused)
 * @param next - Express NextFunction callback
 *
 * @example
 * ```ts
 * import { optionalAuthenticate } from '@agent-memory/auth/middleware';
 * app.get('/public', optionalAuthenticate, (req, res) => {
 *   if (req.user) {
 *     res.json({ message: 'Hello ' + req.user.user_id });
 *   } else {
 *     res.json({ message: 'Hello anonymous' });
 *   }
 * });
 * ```
 */
export function optionalAuthenticate(req: Request, _res: Response, next: NextFunction): void {
  const token = extractToken(req);

  if (token) {
    const payload = verifyToken(token);
    if (payload) {
      req.user = {
        tenant_id: payload.tenant_id,
        user_id: payload.user_id,
        roles: payload.roles,
      };
      req.tenant_id = payload.tenant_id;
    }
  }

  next();
}

/**
 * Role-based Authorization Middleware Factory
 *
 * Creates middleware that requires specific roles.
 * Returns 401 if not authenticated, 403 if lacking required roles.
 *
 * @param requiredRoles - Array of role strings that are required
 * @returns Express middleware function
 *
 * @example
 * ```ts
 * import { requireRole } from '@agent-memory/auth/middleware';
 * app.delete('/admin', requireRole('admin'), (req, res) => {
 *   res.json({ message: 'Admin access granted' });
 * });
 * ```
 */
export function requireRole(...requiredRoles: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication required',
      });
      return;
    }

    const hasRole = requiredRoles.some((role) => req.user!.roles.includes(role));

    if (!hasRole) {
      res.status(403).json({
        error: 'Forbidden',
        message: `Requires one of roles: ${requiredRoles.join(', ')}`,
      });
      return;
    }

    next();
  };
}

/**
 * API Key Authentication Middleware
 *
 * Verifies API key from X-API-Key header and attaches user to request.
 * Sends 401 response if key is missing or invalid.
 *
 * @param req - Express Request object
 * @param res - Express Response object
 * @param next - Express NextFunction callback
 *
 * @example
 * ```ts
 * import { authenticateAPIKey } from '@agent-memory/auth/middleware';
 * app.post('/api/webhook', authenticateAPIKey, (req, res) => {
 *   res.json({ message: 'API key authenticated' });
 * });
 * ```
 */
export function authenticateAPIKey(req: Request, res: Response, next: NextFunction): void {
  const apiKey = req.headers['x-api-key'] as string;

  if (!apiKey) {
    res.status(401).json({
      error: 'Unauthorized',
      message: 'Missing API key',
    });
    return;
  }

  const keyData = validateAPIKey(apiKey);

  if (!keyData) {
    res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid API key',
    });
    return;
  }

  // Attach tenant info from API key
  req.user = {
    tenant_id: keyData.tenant_id,
    user_id: `service:${keyData.key_id}`,
    roles: keyData.scopes,
  };
  req.tenant_id = keyData.tenant_id;

  next();
}

/**
 * Combined Authentication Middleware (JWT or API Key)
 *
 * Accepts either Bearer token or X-API-Key header.
 * Tries JWT first, then API key.
 * Sends 401 if neither authentication method succeeds.
 *
 * @param req - Express Request object
 * @param res - Express Response object
 * @param next - Express NextFunction callback
 *
 * @example
 * ```ts
 * import { authenticateAny } from '@agent-memory/auth/middleware';
 * app.post('/api/endpoint', authenticateAny, (req, res) => {
 *   res.json({ message: 'Authenticated via JWT or API key' });
 * });
 * ```
 */
export function authenticateAny(req: Request, res: Response, next: NextFunction): void {
  const token = extractToken(req);
  const apiKey = req.headers['x-api-key'] as string;

  if (!token && !apiKey) {
    res.status(401).json({
      error: 'Unauthorized',
      message: 'Missing authentication (Bearer token or X-API-Key header)',
    });
    return;
  }

  // Try JWT first
  if (token) {
    const payload = verifyToken(token);
    if (payload) {
      req.user = {
        tenant_id: payload.tenant_id,
        user_id: payload.user_id,
        roles: payload.roles,
      };
      req.tenant_id = payload.tenant_id;
      next();
      return;
    }
  }

  // Try API key
  if (apiKey) {
    const keyData = validateAPIKey(apiKey);
    if (keyData) {
      req.user = {
        tenant_id: keyData.tenant_id,
        user_id: `service:${keyData.key_id}`,
        roles: keyData.scopes,
      };
      req.tenant_id = keyData.tenant_id;
      next();
      return;
    }
  }

  res.status(401).json({
    error: 'Unauthorized',
    message: 'Invalid authentication credentials',
  });
}
