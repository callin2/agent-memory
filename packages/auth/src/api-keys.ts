/**
 * API Key Operations
 *
 * Provides API key generation and validation functions.
 * API keys are used for service-to-service authentication.
 *
 * @module api-keys
 */

import crypto from 'crypto';
import type { APIKey } from './types.js';

/**
 * In-memory storage for API keys
 *
 * In production, API keys should be stored in a database with proper hashing.
 * This in-memory Map is provided for development and testing purposes only.
 */
const API_KEYS: Map<string, APIKey> = new Map();

/**
 * Clear all API keys from storage
 *
 * Utility function for testing purposes.
 * Resets the in-memory API key storage.
 *
 * @internal
 */
export function clearAPIKeys(): void {
  API_KEYS.clear();
}

/**
 * Generate a new API key
 *
 * Creates a secure API key with format: ak_{timestamp}_{random}.{secret}
 * The key is stored in memory and returned to the caller.
 *
 * @param tenant_id - Tenant identifier
 * @param scopes - Array of permission scopes (default: [])
 * @returns Generated API key string
 *
 * @example
 * ```ts
 * const apiKey = generateAPIKey('tenant123', ['read', 'write']);
 * // Returns: "ak_1704067200_abc123.xyZ987abc123def456"
 * ```
 */
export function generateAPIKey(tenant_id: string, scopes: string[] = []): string {
  const key_id = `ak_${Date.now()}_${crypto.randomBytes(12).toString('base64url').substring(0, 15)}`;
  const keySecret = crypto.randomBytes(24).toString('base64url');
  const apiKey = `${key_id}.${keySecret}`;

  API_KEYS.set(apiKey, {
    key_id,
    tenant_id,
    scopes,
    created_at: new Date(),
  });

  return apiKey;
}

/**
 * Validate an API key
 *
 * Checks if the provided API key exists in storage.
 * Returns the key data if valid, null otherwise.
 *
 * @param apiKey - API key string to validate
 * @returns API key data or null if invalid
 *
 * @example
 * ```ts
 * const keyData = validateAPIKey(apiKey);
 * if (keyData) {
 *   console.log('Tenant:', keyData.tenant_id);
 *   console.log('Scopes:', keyData.scopes);
 * }
 * ```
 */
export function validateAPIKey(apiKey: string): APIKey | null {
  return API_KEYS.get(apiKey) || null;
}

/**
 * Revoke an API key
 *
 * Removes the API key from storage, making it invalid for future requests.
 *
 * @param apiKey - API key string to revoke
 * @returns True if key was revoked, false if not found
 *
 * @example
 * ```ts
 * const revoked = revokeAPIKey(apiKey);
 * if (revoked) {
 *   console.log('API key revoked successfully');
 * }
 * ```
 */
export function revokeAPIKey(apiKey: string): boolean {
  return API_KEYS.delete(apiKey);
}

/**
 * List all API keys for a tenant
 *
 * Returns all API keys associated with a specific tenant.
 *
 * @param tenant_id - Tenant identifier
 * @returns Array of API key data
 *
 * @example
 * ```ts
 * const keys = listAPIKeys('tenant123');
 * console.log(`Found ${keys.length} API keys`);
 * ```
 */
export function listAPIKeys(tenant_id: string): APIKey[] {
  return Array.from(API_KEYS.values()).filter((key) => key.tenant_id === tenant_id);
}

/**
 * Hash an API key for secure storage
 *
 * Generates a SHA-256 hash of the API key for database storage.
 * In production, store only the hash, never the raw key.
 *
 * @param apiKey - API key string to hash
 * @returns Hex-encoded SHA-256 hash
 *
 * @example
 * ```ts
 * const hash = hashAPIKey(apiKey);
 * // Store hash in database, not the raw key
 * ```
 */
export function hashAPIKey(apiKey: string): string {
  return crypto.createHash('sha256').update(apiKey).digest('hex');
}

/**
 * Extract the key prefix from an API key
 *
 * The prefix is the public part of the key that can be displayed to users.
 *
 * @param apiKey - API key string
 * @returns Key prefix or null if invalid format
 *
 * @example
 * ```ts
 * const prefix = extractAPIKeyPrefix(apiKey);
 * // Returns: "ak_1704067200_abc123"
 * ```
 */
export function extractAPIKeyPrefix(apiKey: string): string | null {
  const parts = apiKey.split('.');
  if (parts.length >= 2) {
    return parts[0];
  }
  return null;
}
