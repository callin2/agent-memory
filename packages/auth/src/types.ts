/**
 * JWT Payload Interface
 *
 * Standard payload structure for JWT tokens in the Agent Memory System.
 * Maintains backward compatibility with existing token format.
 *
 * @property tenant_id - Tenant identifier for multi-tenancy
 * @property user_id - User identifier
 * @property roles - Array of role strings for authorization
 * @property jti - JWT ID for token tracking and revocation (optional)
 * @property iat - Issued at timestamp (added by jwt.sign)
 * @property exp - Expiration timestamp (added by jwt.sign)
 */
export interface JWTPayload {
  tenant_id: string;
  user_id: string;
  roles: string[];
  jti?: string;
  iat: number;
  exp: number;
}

/**
 * Authentication Configuration
 *
 * Configuration options for JWT token generation and validation.
 * Defaults are provided for convenience but should be overridden in production.
 *
 * @property secret - Secret key for signing JWT tokens (required)
 * @property expiresIn - Token expiration time (e.g., '15m', '1h', '7d')
 * @property issuer - JWT issuer claim (default: 'agent-memory-system')
 */
export interface AuthConfig {
  secret: string;
  expiresIn: string;
  issuer: string;
}

/**
 * API Key Data Interface
 *
 * Represents an API key with its metadata.
 * Used for service-to-service authentication.
 *
 * @property key_id - Unique key identifier
 * @property tenant_id - Tenant identifier
 * @property scopes - Array of permission scopes
 * @property created_at - Key creation timestamp
 */
export interface APIKey {
  key_id: string;
  tenant_id: string;
  scopes: string[];
  created_at: Date;
}

/**
 * Express Request Extension
 *
 * Extends Express Request to include authenticated user information.
 * This type augmentation should be imported in consuming applications.
 */
export interface AuthenticatedRequest {
  user?: {
    tenant_id: string;
    user_id: string;
    roles: string[];
  };
  tenant_id?: string;
}
