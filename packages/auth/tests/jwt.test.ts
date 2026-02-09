/**
 * Unit Tests: JWT Operations
 *
 * Tests for JWT token generation, verification, and decoding
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { generateToken, verifyToken, decodeToken, getAuthConfig } from '../src/jwt.js';

describe('JWT Operations', () => {
  beforeAll(() => {
    // Set test environment variables
    process.env.JWT_SECRET = 'test-secret-key';
    process.env.JWT_EXPIRES_IN = '15m';
    process.env.JWT_ISSUER = 'test-issuer';
  });

  describe('getAuthConfig', () => {
    it('should return config from environment variables', () => {
      const config = getAuthConfig();

      expect(config.secret).toBe('test-secret-key');
      expect(config.expiresIn).toBe('15m');
      expect(config.issuer).toBe('test-issuer');
    });

    it('should provide defaults when environment variables are missing', () => {
      // Clear environment variables
      const originalSecret = process.env.JWT_SECRET;
      const originalExpiresIn = process.env.JWT_EXPIRES_IN;
      const originalIssuer = process.env.JWT_ISSUER;

      delete process.env.JWT_SECRET;
      delete process.env.JWT_EXPIRES_IN;
      delete process.env.JWT_ISSUER;

      const config = getAuthConfig();

      expect(config.secret).toBe('change-this-secret-in-production');
      expect(config.expiresIn).toBe('15m');
      expect(config.issuer).toBe('agent-memory-system');

      // Restore environment variables
      process.env.JWT_SECRET = originalSecret;
      process.env.JWT_EXPIRES_IN = originalExpiresIn;
      process.env.JWT_ISSUER = originalIssuer;
    });
  });

  describe('generateToken', () => {
    it('should generate a valid JWT token', () => {
      const token = generateToken('tenant123', 'user456', ['admin', 'user']);

      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3); // JWT format: header.payload.signature
    });

    it('should include tenant_id in payload', () => {
      const token = generateToken('tenant123', 'user456');
      const payload = decodeToken(token);

      expect(payload).toBeDefined();
      expect(payload?.tenant_id).toBe('tenant123');
    });

    it('should include user_id in payload', () => {
      const token = generateToken('tenant123', 'user456');
      const payload = decodeToken(token);

      expect(payload).toBeDefined();
      expect(payload?.user_id).toBe('user456');
    });

    it('should include roles in payload', () => {
      const roles = ['admin', 'user', 'moderator'];
      const token = generateToken('tenant123', 'user456', roles);
      const payload = decodeToken(token);

      expect(payload).toBeDefined();
      expect(payload?.roles).toEqual(roles);
    });

    it('should default to empty roles array', () => {
      const token = generateToken('tenant123', 'user456');
      const payload = decodeToken(token);

      expect(payload).toBeDefined();
      expect(payload?.roles).toEqual([]);
    });

    it('should include jti when provided', () => {
      const jti = 'token-123';
      const token = generateToken('tenant123', 'user456', [], undefined, jti);
      const payload = decodeToken(token);

      expect(payload).toBeDefined();
      expect(payload?.jti).toBe(jti);
    });

    it('should not include jti when not provided', () => {
      const token = generateToken('tenant123', 'user456');
      const payload = decodeToken(token);

      expect(payload).toBeDefined();
      expect(payload?.jti).toBeUndefined();
    });

    it('should use custom config when provided', () => {
      const customConfig = {
        secret: 'custom-secret',
        expiresIn: '1h',
        issuer: 'custom-issuer',
      };

      const token = generateToken('tenant123', 'user456', [], customConfig);

      expect(token).toBeDefined();
      // Token should be verifiable with custom config
      const payload = verifyToken(token, customConfig);
      expect(payload).toBeDefined();
    });
  });

  describe('verifyToken', () => {
    it('should verify a valid token', () => {
      const token = generateToken('tenant123', 'user456', ['admin']);
      const payload = verifyToken(token);

      expect(payload).toBeDefined();
      expect(payload?.tenant_id).toBe('tenant123');
      expect(payload?.user_id).toBe('user456');
      expect(payload?.roles).toEqual(['admin']);
    });

    it('should return null for invalid token', () => {
      const payload = verifyToken('invalid.token.here');

      expect(payload).toBeNull();
    });

    it('should return null for malformed token', () => {
      const payload = verifyToken('not-a-jwt');

      expect(payload).toBeNull();
    });

    it('should return null for token signed with different secret', () => {
      const token = generateToken('tenant123', 'user456');

      // Try to verify with different config
      const differentConfig = {
        secret: 'different-secret',
        expiresIn: '15m',
        issuer: 'test-issuer',
      };

      const payload = verifyToken(token, differentConfig);

      expect(payload).toBeNull();
    });

    it('should return null for token with different issuer', () => {
      const token = generateToken('tenant123', 'user456');

      // Try to verify with different config
      const differentConfig = {
        secret: 'test-secret-key',
        expiresIn: '15m',
        issuer: 'different-issuer',
      };

      const payload = verifyToken(token, differentConfig);

      expect(payload).toBeNull();
    });

    it('should include standard JWT claims', () => {
      const token = generateToken('tenant123', 'user456');
      const payload = verifyToken(token);

      expect(payload).toBeDefined();
      expect(payload?.iat).toBeDefined();
      expect(typeof payload?.iat).toBe('number');
      expect(payload?.exp).toBeDefined();
      expect(typeof payload?.exp).toBe('number');
    });
  });

  describe('decodeToken', () => {
    it('should decode a valid token without verification', () => {
      const token = generateToken('tenant123', 'user456', ['admin']);
      const payload = decodeToken(token);

      expect(payload).toBeDefined();
      expect(payload?.tenant_id).toBe('tenant123');
      expect(payload?.user_id).toBe('user456');
      expect(payload?.roles).toEqual(['admin']);
    });

    it('should decode a token with invalid signature', () => {
      const token = generateToken('tenant123', 'user456');
      // Tamper with the token
      const parts = token.split('.');
      const tamperedToken = `${parts[0]}.${parts[1]}.tamperedsignature`;

      const payload = decodeToken(tamperedToken);

      // decodeToken should still return the payload (without verification)
      expect(payload).toBeDefined();
    });

    it('should return null for malformed token', () => {
      const payload = decodeToken('not-a-jwt');

      expect(payload).toBeNull();
    });

    it('should return null for empty string', () => {
      const payload = decodeToken('');

      expect(payload).toBeNull();
    });
  });

  describe('Token Format Backward Compatibility', () => {
    it('should maintain payload structure from existing implementation', () => {
      const token = generateToken('tenant123', 'user456', ['admin'], undefined, 'jti-123');
      const payload = verifyToken(token);

      expect(payload).toBeDefined();

      // Verify all required fields exist
      expect(payload).toHaveProperty('tenant_id');
      expect(payload).toHaveProperty('user_id');
      expect(payload).toHaveProperty('roles');
      expect(payload).toHaveProperty('iat');
      expect(payload).toHaveProperty('exp');

      // Verify optional field
      expect(payload).toHaveProperty('jti');

      // Verify values
      expect(payload?.tenant_id).toBe('tenant123');
      expect(payload?.user_id).toBe('user456');
      expect(payload?.roles).toEqual(['admin']);
      expect(payload?.jti).toBe('jti-123');
    });
  });
});
