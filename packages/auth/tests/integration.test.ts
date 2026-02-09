/**
 * Integration Tests: Package Consumption
 *
 * Tests to verify the package can be imported and used correctly
 */

import { describe, it, expect } from 'vitest';
import {
  generateToken,
  verifyToken,
  generateAPIKey,
  validateAPIKey,
  getAuthConfig,
} from '../src/index.js';

describe('Package Integration Tests', () => {
  beforeAll(() => {
    process.env.JWT_SECRET = 'integration-test-secret';
    process.env.JWT_EXPIRES_IN = '15m';
    process.env.JWT_ISSUER = 'integration-test-issuer';
  });

  describe('Index Exports', () => {
    it('should export JWT functions', () => {
      expect(generateToken).toBeDefined();
      expect(verifyToken).toBeDefined();
      expect(getAuthConfig).toBeDefined();
      expect(typeof generateToken).toBe('function');
      expect(typeof verifyToken).toBe('function');
    });

    it('should export API key functions', () => {
      expect(generateAPIKey).toBeDefined();
      expect(validateAPIKey).toBeDefined();
      expect(typeof generateAPIKey).toBe('function');
      expect(typeof validateAPIKey).toBe('function');
    });
  });

  describe('End-to-End JWT Flow', () => {
    it('should complete full token lifecycle', () => {
      // Generate token
      const token = generateToken('tenant123', 'user456', ['admin', 'user']);
      expect(token).toBeDefined();
      expect(typeof token).toBe('string');

      // Verify token
      const payload = verifyToken(token);
      expect(payload).toBeDefined();
      expect(payload?.tenant_id).toBe('tenant123');
      expect(payload?.user_id).toBe('user456');
      expect(payload?.roles).toEqual(['admin', 'user']);
    });
  });

  describe('End-to-End API Key Flow', () => {
    it('should complete full API key lifecycle', () => {
      // Generate API key
      const apiKey = generateAPIKey('tenant123', ['read', 'write']);
      expect(apiKey).toBeDefined();
      expect(typeof apiKey).toBe('string');

      // Validate API key
      const keyData = validateAPIKey(apiKey);
      expect(keyData).toBeDefined();
      expect(keyData?.tenant_id).toBe('tenant123');
      expect(keyData?.scopes).toEqual(['read', 'write']);
    });
  });

  describe('TypeScript Type Exports', () => {
    it('should export JWTPayload type', async () => {
      // This test verifies that the type is exported correctly
      // If this compiles, the type export is working
      const token = generateToken('tenant123', 'user456');
      const payload = verifyToken(token);

      if (payload) {
        // Type assertion test
        const tenantId: string = payload.tenant_id;
        const userId: string = payload.user_id;
        const roles: string[] = payload.roles;

        expect(tenantId).toBe('tenant123');
        expect(userId).toBe('user456');
        expect(Array.isArray(roles)).toBe(true);
      }
    });
  });

  describe('Backward Compatibility', () => {
    it('should maintain same JWT format as existing implementation', () => {
      const token = generateToken('tenant123', 'user456', ['admin'], undefined, 'jti-123');
      const parts = token.split('.');

      // JWT format: header.payload.signature
      expect(parts).toHaveLength(3);

      const payload = verifyToken(token);
      expect(payload).toBeDefined();

      // Verify all expected fields
      expect(payload).toHaveProperty('tenant_id');
      expect(payload).toHaveProperty('user_id');
      expect(payload).toHaveProperty('roles');
      expect(payload).toHaveProperty('iat');
      expect(payload).toHaveProperty('exp');
      expect(payload).toHaveProperty('jti');

      expect(payload?.tenant_id).toBe('tenant123');
      expect(payload?.user_id).toBe('user456');
      expect(payload?.roles).toEqual(['admin']);
      expect(payload?.jti).toBe('jti-123');
    });

    it('should maintain same API key format as existing implementation', () => {
      const apiKey = generateAPIKey('tenant123', ['read', 'write']);

      // Format: ak_timestamp_random.secret
      expect(apiKey).toMatch(/^ak_\d+_[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);

      const keyData = validateAPIKey(apiKey);
      expect(keyData).toBeDefined();
      expect(keyData?.tenant_id).toBe('tenant123');
      expect(keyData?.scopes).toEqual(['read', 'write']);
    });
  });

  describe('Environment Configuration', () => {
    it('should use environment variables for config', () => {
      const config = getAuthConfig();

      expect(config.secret).toBe('integration-test-secret');
      expect(config.expiresIn).toBe('15m');
      expect(config.issuer).toBe('integration-test-issuer');
    });
  });
});
