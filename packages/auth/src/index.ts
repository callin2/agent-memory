/**
 * @agent-memory/auth
 *
 * Shared authentication library for Agent Memory System.
 * Provides JWT generation/validation, API key operations, and Express middleware.
 *
 * @example
 * ```ts
 * // JWT Operations
 * import { generateToken, verifyToken } from '@agent-memory/auth';
 *
 * const token = generateToken('tenant123', 'user456', ['admin']);
 * const payload = verifyToken(token);
 * ```
 *
 * @example
 * ```ts
 * // API Key Operations
 * import { generateAPIKey, validateAPIKey } from '@agent-memory/auth';
 *
 * const apiKey = generateAPIKey('tenant123', ['read', 'write']);
 * const keyData = validateAPIKey(apiKey);
 * ```
 *
 * @example
 * ```ts
 * // Express Middleware
 * import { authenticate, authenticateAPIKey } from '@agent-memory/auth/middleware';
 *
 * app.get('/protected', authenticate, (req, res) => {
 *   res.json({ user: req.user });
 * });
 * ```
 *
 * @module @agent-memory/auth
 */

// Type exports
export type { JWTPayload, AuthConfig, APIKey, AuthenticatedRequest } from './types.js';

// JWT operations
export {
  getAuthConfig,
  generateToken,
  verifyToken,
  decodeToken,
} from './jwt.js';

// API Key operations
export {
  generateAPIKey,
  validateAPIKey,
  revokeAPIKey,
  listAPIKeys,
  hashAPIKey,
  extractAPIKeyPrefix,
} from './api-keys.js';

// Middleware is available via /middleware subpath
export {
  extractToken,
  authenticate,
  optionalAuthenticate,
  requireRole,
  authenticateAPIKey,
  authenticateAny,
} from './middleware.js';
