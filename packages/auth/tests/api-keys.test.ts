/**
 * Unit Tests: API Key Operations
 *
 * Tests for API key generation, validation, and management
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  generateAPIKey,
  validateAPIKey,
  revokeAPIKey,
  listAPIKeys,
  hashAPIKey,
  extractAPIKeyPrefix,
  clearAPIKeys,
} from '../src/api-keys.js';

describe('API Key Operations', () => {
  beforeEach(() => {
    // Clear in-memory storage before each test
    clearAPIKeys();
  });

  describe('generateAPIKey', () => {
    it('should generate a valid API key', () => {
      const apiKey = generateAPIKey('tenant123');

      expect(apiKey).toBeDefined();
      expect(typeof apiKey).toBe('string');
      expect(apiKey.length).toBeGreaterThan(0);
    });

    it('should use correct format: ak_timestamp_random.secret', () => {
      const apiKey = generateAPIKey('tenant123');

      // Format: ak_{timestamp}_{random}.{secret}
      const match = apiKey.match(/^ak_\d+_[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);

      expect(match).not.toBeNull();
    });

    it('should include scopes in stored data', () => {
      const scopes = ['read', 'write', 'admin'];
      const apiKey = generateAPIKey('tenant123', scopes);
      const keyData = validateAPIKey(apiKey);

      expect(keyData).toBeDefined();
      expect(keyData?.scopes).toEqual(scopes);
    });

    it('should store tenant_id in key data', () => {
      const tenantId = 'tenant456';
      const apiKey = generateAPIKey(tenantId);
      const keyData = validateAPIKey(apiKey);

      expect(keyData).toBeDefined();
      expect(keyData?.tenant_id).toBe(tenantId);
    });

    it('should set created_at timestamp', () => {
      const beforeTime = Date.now();
      const apiKey = generateAPIKey('tenant123');
      const keyData = validateAPIKey(apiKey);
      const afterTime = Date.now();

      expect(keyData).toBeDefined();
      expect(keyData?.created_at).toBeInstanceOf(Date);
      expect(keyData!.created_at.getTime()).toBeGreaterThanOrEqual(beforeTime);
      expect(keyData!.created_at.getTime()).toBeLessThanOrEqual(afterTime);
    });

    it('should generate unique keys', () => {
      const key1 = generateAPIKey('tenant123');
      const key2 = generateAPIKey('tenant123');

      expect(key1).not.toBe(key2);
    });

    it('should default to empty scopes array', () => {
      const apiKey = generateAPIKey('tenant123');
      const keyData = validateAPIKey(apiKey);

      expect(keyData).toBeDefined();
      expect(keyData?.scopes).toEqual([]);
    });
  });

  describe('validateAPIKey', () => {
    it('should validate a generated API key', () => {
      const apiKey = generateAPIKey('tenant123');
      const keyData = validateAPIKey(apiKey);

      expect(keyData).toBeDefined();
      expect(keyData?.tenant_id).toBe('tenant123');
    });

    it('should return null for invalid API key', () => {
      const keyData = validateAPIKey('invalid-key');

      expect(keyData).toBeNull();
    });

    it('should return null for empty string', () => {
      const keyData = validateAPIKey('');

      expect(keyData).toBeNull();
    });

    it('should return correct key data for valid key', () => {
      const scopes = ['read', 'write'];
      const apiKey = generateAPIKey('tenant789', scopes);
      const keyData = validateAPIKey(apiKey);

      expect(keyData).toBeDefined();
      expect(keyData?.tenant_id).toBe('tenant789');
      expect(keyData?.scopes).toEqual(scopes);
      expect(keyData?.key_id).toBeDefined();
      expect(keyData?.created_at).toBeInstanceOf(Date);
    });

    it('should not validate after revocation', () => {
      const apiKey = generateAPIKey('tenant123');
      const revoked = revokeAPIKey(apiKey);

      expect(revoked).toBe(true);

      const keyData = validateAPIKey(apiKey);
      expect(keyData).toBeNull();
    });
  });

  describe('revokeAPIKey', () => {
    it('should revoke a valid API key', () => {
      const apiKey = generateAPIKey('tenant123');
      const revoked = revokeAPIKey(apiKey);

      expect(revoked).toBe(true);
    });

    it('should return false for non-existent key', () => {
      const revoked = revokeAPIKey('non-existent-key');

      expect(revoked).toBe(false);
    });

    it('should prevent validation after revocation', () => {
      const apiKey = generateAPIKey('tenant123');
      revokeAPIKey(apiKey);

      const keyData = validateAPIKey(apiKey);
      expect(keyData).toBeNull();
    });

    it('should return false when revoking already revoked key', () => {
      const apiKey = generateAPIKey('tenant123');
      revokeAPIKey(apiKey);

      const secondRevoke = revokeAPIKey(apiKey);
      expect(secondRevoke).toBe(false);
    });
  });

  describe('listAPIKeys', () => {
    it('should list all keys for a tenant', () => {
      generateAPIKey('tenant123');
      generateAPIKey('tenant123');
      generateAPIKey('tenant456'); // Different tenant

      const keys = listAPIKeys('tenant123');

      expect(keys.length).toBe(2);
    });

    it('should return empty array for tenant with no keys', () => {
      const keys = listAPIKeys('non-existent-tenant');

      expect(keys).toEqual([]);
    });

    it('should not include keys from other tenants', () => {
      generateAPIKey('tenant123');
      generateAPIKey('tenant456');

      const keys = listAPIKeys('tenant123');

      expect(keys.length).toBe(1);
      expect(keys[0].tenant_id).toBe('tenant123');
    });

    it('should not include revoked keys', () => {
      const apiKey1 = generateAPIKey('tenant123');
      const apiKey2 = generateAPIKey('tenant123');

      revokeAPIKey(apiKey1);

      const keys = listAPIKeys('tenant123');

      expect(keys.length).toBe(1);
    });
  });

  describe('hashAPIKey', () => {
    it('should produce consistent hash for same input', () => {
      const apiKey = 'ak_test_api_key';
      const hash1 = hashAPIKey(apiKey);
      const hash2 = hashAPIKey(apiKey);

      expect(hash1).toBe(hash2);
    });

    it('should produce different hashes for different inputs', () => {
      const hash1 = hashAPIKey('ak_key_1');
      const hash2 = hashAPIKey('ak_key_2');

      expect(hash1).not.toBe(hash2);
    });

    it('should produce 64-character hex string (SHA-256)', () => {
      const apiKey = 'ak_test_key';
      const hash = hashAPIKey(apiKey);

      expect(hash).toHaveLength(64);
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should hash the entire key', () => {
      const apiKey1 = 'ak_1234567890_abc.def';
      const apiKey2 = 'ak_1234567890_abc.dfg'; // Different secret

      const hash1 = hashAPIKey(apiKey1);
      const hash2 = hashAPIKey(apiKey2);

      expect(hash1).not.toBe(hash2);
    });
  });

  describe('extractAPIKeyPrefix', () => {
    it('should extract prefix from valid key', () => {
      const apiKey = 'ak_1704067200_abc123.xyZ987';
      const prefix = extractAPIKeyPrefix(apiKey);

      expect(prefix).toBe('ak_1704067200_abc123');
    });

    it('should return null for key without separator', () => {
      const prefix = extractAPIKeyPrefix('ak_1704067200_abc123');

      expect(prefix).toBeNull();
    });

    it('should return null for empty string', () => {
      const prefix = extractAPIKeyPrefix('');

      expect(prefix).toBeNull();
    });

    it('should return null for invalid format', () => {
      const prefix = extractAPIKeyPrefix('invalid-key-format');

      expect(prefix).toBeNull();
    });

    it('should handle key with multiple separators', () => {
      const apiKey = 'ak_1704067200_abc123.xyZ987.extra';
      const prefix = extractAPIKeyPrefix(apiKey);

      expect(prefix).toBe('ak_1704067200_abc123');
    });
  });

  describe('API Key Format Backward Compatibility', () => {
    it('should maintain format from existing implementation', () => {
      const apiKey = generateAPIKey('tenant123');

      // Verify format: ak_{timestamp}_{random}.{secret}
      const parts = apiKey.split('.');

      expect(parts).toHaveLength(2);

      const prefix = parts[0];
      const secret = parts[1];

      expect(prefix).toMatch(/^ak_\d+_[A-Za-z0-9_-]+$/);
      expect(secret).toMatch(/^[A-Za-z0-9_-]+$/);
      expect(secret.length).toBeGreaterThan(20); // Should be substantial
    });

    it('should extract key_id correctly from generated key', () => {
      const apiKey = generateAPIKey('tenant123');
      const keyData = validateAPIKey(apiKey);

      expect(keyData).toBeDefined();
      expect(keyData?.key_id).toMatch(/^ak_\d+_[A-Za-z0-9_-]+$/);
    });
  });
});
