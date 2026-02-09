/**
 * Unit Tests: Refresh Token Service
 *
 * Tests for refresh token generation, validation, rotation, and revocation
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Pool } from 'pg';
import { TokenService } from '../../../src/services/token-service.js';

describe('TokenService', () => {
  let pool: Pool;
  let tokenService: TokenService;

  beforeEach(async () => {
    // Create test database connection
    pool = new Pool({
      host: process.env.PGHOST || 'localhost',
      port: Number(process.env.PGPORT) || 5432,
      database: process.env.PGDATABASE || 'agent_memory_test',
      user: process.env.PGUSER || 'postgres',
      password: process.env.PGPASSWORD || '',
    });

    tokenService = new TokenService(pool);

    // Setup test schema
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        user_id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL,
        username TEXT NOT NULL,
        password_hash TEXT NOT NULL,
        roles TEXT[] NOT NULL DEFAULT '{user}',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS refresh_tokens (
        token_id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        tenant_id TEXT NOT NULL,
        token_hash TEXT NOT NULL UNIQUE,
        expires_at TIMESTAMPTZ NOT NULL,
        rotated_at TIMESTAMPTZ,
        replaced_by TEXT REFERENCES refresh_tokens(token_id) ON DELETE SET NULL,
        revoked_at TIMESTAMPTZ,
        revoked_reason TEXT,
        device_info JSONB DEFAULT '{}'::jsonb,
        last_used_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT fk_refresh_token_user FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
      );
    `);

    // Create test user
    await pool.query(
      `INSERT INTO users (user_id, tenant_id, username, password_hash, roles)
       VALUES ($1, $2, $3, $4, $5)`,
      ['test_user_1', 'test_tenant', 'testuser', 'hash', ['user']]
    );
  });

  afterEach(async () => {
    // Cleanup
    await pool.query('DROP TABLE IF EXISTS refresh_tokens CASCADE');
    await pool.query('DROP TABLE IF EXISTS users CASCADE');
    await pool.end();
  });

  describe('generateRefreshToken', () => {
    it('should generate a token with proper format', async () => {
      const result = await tokenService.generateRefreshToken(
        'test_user_1',
        'test_tenant',
        { browser: 'Chrome' }
      );

      expect(result.token).toBeDefined();
      expect(result.token).toMatch(/^[A-Za-z0-9_-]+$/);
      expect(result.tokenHash).toBeDefined();
      expect(result.tokenId).toMatch(/^rt_/);
      expect(result.expiresAt).toBeInstanceOf(Date);
    });

    it('should store token hash in database', async () => {
      const { tokenHash, tokenId } = await tokenService.generateRefreshToken(
        'test_user_1',
        'test_tenant'
      );

      const result = await pool.query(
        'SELECT * FROM refresh_tokens WHERE token_id = $1',
        [tokenId]
      );

      expect(result.rows.length).toBe(1);
      expect(result.rows[0].token_hash).toBe(tokenHash);
      expect(result.rows[0].user_id).toBe('test_user_1');
    });

    it('should respect custom expiration time', async () => {
      const expiresIn = 60; // 1 minute
      const { expiresAt } = await tokenService.generateRefreshToken(
        'test_user_1',
        'test_tenant',
        {},
        expiresIn
      );

      const now = Date.now();
      const diff = expiresAt.getTime() - now;

      expect(diff).toBeGreaterThan(expiresIn * 1000 - 1000); // Allow 1s margin
      expect(diff).toBeLessThan(expiresIn * 1000 + 1000);
    });

    it('should store device info', async () => {
      const deviceInfo = { browser: 'Firefox', os: 'Linux' };
      const { tokenId } = await tokenService.generateRefreshToken(
        'test_user_1',
        'test_tenant',
        deviceInfo
      );

      const result = await pool.query(
        'SELECT device_info FROM refresh_tokens WHERE token_id = $1',
        [tokenId]
      );

      expect(result.rows[0].device_info).toEqual(deviceInfo);
    });
  });

  describe('validateRefreshToken', () => {
    it('should validate a valid token', async () => {
      const { token } = await tokenService.generateRefreshToken(
        'test_user_1',
        'test_tenant'
      );

      const tokenData = await tokenService.validateRefreshToken(token);

      expect(tokenData).toBeDefined();
      expect(tokenData?.user_id).toBe('test_user_1');
      expect(tokenData?.tenant_id).toBe('test_tenant');
    });

    it('should return null for invalid token', async () => {
      const tokenData = await tokenService.validateRefreshToken('invalid_token');

      expect(tokenData).toBeNull();
    });

    it('should return null for revoked token', async () => {
      const { token, tokenId } = await tokenService.generateRefreshToken(
        'test_user_1',
        'test_tenant'
      );

      await tokenService.revokeRefreshToken(tokenId, 'test');

      const tokenData = await tokenService.validateRefreshToken(token);

      expect(tokenData).toBeNull();
    });

    it('should return null for expired token', async () => {
      const { token } = await tokenService.generateRefreshToken(
        'test_user_1',
        'test_tenant',
        {},
        -1 // Expired
      );

      const tokenData = await tokenService.validateRefreshToken(token);

      expect(tokenData).toBeNull();
    });
  });

  describe('rotateRefreshToken', () => {
    it('should generate new token and revoke old one', async () => {
      const oldToken = await tokenService.generateRefreshToken(
        'test_user_1',
        'test_tenant'
      );

      const rotated = await tokenService.rotateRefreshToken(oldToken.token);

      expect(rotated.newToken).toBeDefined();
      expect(rotated.newToken).not.toBe(oldToken.token);

      // Verify old token is revoked
      const oldTokenData = await tokenService.validateRefreshToken(oldToken.token);
      expect(oldTokenData).toBeNull();
    });

    it('should link tokens in family chain', async () => {
      const oldToken = await tokenService.generateRefreshToken(
        'test_user_1',
        'test_tenant'
      );

      const rotated = await tokenService.rotateRefreshToken(oldToken.token);

      const result = await pool.query(
        'SELECT replaced_by FROM refresh_tokens WHERE token_id = $1',
        [oldToken.tokenId]
      );

      expect(result.rows[0].replaced_by).toBe(rotated.newTokenId);
    });

    it('should throw error for invalid token', async () => {
      await expect(
        tokenService.rotateRefreshToken('invalid_token')
      ).rejects.toThrow('Invalid or expired refresh token');
    });
  });

  describe('detectTokenTheft', () => {
    it('should detect token reuse after rotation', async () => {
      const token1 = await tokenService.generateRefreshToken(
        'test_user_1',
        'test_tenant'
      );

      // Rotate the token
      await tokenService.rotateRefreshToken(token1.token);

      // Try to use old token again
      const theftDetected = await tokenService.detectTokenTheft(token1.tokenId);

      expect(theftDetected).toBe(true);
    });

    it('should return false for active token', async () => {
      const token1 = await tokenService.generateRefreshToken(
        'test_user_1',
        'test_tenant'
      );

      const theftDetected = await tokenService.detectTokenTheft(token1.tokenId);

      expect(theftDetected).toBe(false);
    });
  });

  describe('revokeRefreshToken', () => {
    it('should revoke a token', async () => {
      const { token, tokenId } = await tokenService.generateRefreshToken(
        'test_user_1',
        'test_tenant'
      );

      await tokenService.revokeRefreshToken(tokenId, 'logout');

      const result = await pool.query(
        'SELECT * FROM refresh_tokens WHERE token_id = $1',
        [tokenId]
      );

      expect(result.rows[0].revoked_at).not.toBeNull();
      expect(result.rows[0].revoked_reason).toBe('logout');
    });
  });

  describe('revokeAllUserTokens', () => {
    it('should revoke all tokens for a user', async () => {
      await tokenService.generateRefreshToken('test_user_1', 'test_tenant');
      await tokenService.generateRefreshToken('test_user_1', 'test_tenant');
      await tokenService.generateRefreshToken('test_user_1', 'test_tenant');

      await tokenService.revokeAllUserTokens('test_user_1', 'security');

      const result = await pool.query(
        'SELECT COUNT(*) FROM refresh_tokens WHERE user_id = $1 AND revoked_at IS NULL',
        ['test_user_1']
      );

      expect(parseInt(result.rows[0].count)).toBe(0);
    });
  });

  describe('getAllUserTokens', () => {
    it('should return all active tokens for user', async () => {
      await tokenService.generateRefreshToken('test_user_1', 'test_tenant');
      await tokenService.generateRefreshToken('test_user_1', 'test_tenant');

      const tokens = await tokenService.getAllUserTokens('test_user_1');

      expect(tokens.length).toBe(2);
      expect(tokens[0].user_id).toBe('test_user_1');
    });
  });

  describe('cleanupExpiredTokens', () => {
    it('should delete expired tokens', async () => {
      // Create an expired token
      await pool.query(
        `INSERT INTO refresh_tokens (token_id, user_id, tenant_id, token_hash, expires_at)
         VALUES ($1, $2, $3, $4, NOW() - INTERVAL '1 day')`,
        ['expired_token', 'test_user_1', 'test_tenant', 'hash']
      );

      const deleted = await tokenService.cleanupExpiredTokens(0);

      expect(deleted).toBeGreaterThanOrEqual(1);
    });
  });

  describe('updateLastUsed', () => {
    it('should update last_used_at timestamp', async () => {
      const { tokenId } = await tokenService.generateRefreshToken(
        'test_user_1',
        'test_tenant'
      );

      await tokenService.updateLastUsed(tokenId);

      const result = await pool.query(
        'SELECT last_used_at FROM refresh_tokens WHERE token_id = $1',
        [tokenId]
      );

      expect(result.rows[0].last_used_at).not.toBeNull();
    });
  });
});
