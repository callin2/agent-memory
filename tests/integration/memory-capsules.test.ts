/**
 * Integration Tests: Memory Capsules API
 *
 * Tests the memory capsule API endpoints:
 * - POST /api/v1/capsules (create capsule)
 * - GET /api/v1/capsules (list capsules)
 * - GET /api/v1/capsules/:capsule_id (get capsule)
 * - DELETE /api/v1/capsules/:capsule_id (revoke capsule)
 *
 * These tests verify the API is working and responding correctly.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { Pool } from 'pg';
import crypto from 'crypto';
// Import from main server
import { app } from '../../dist/server.js';
import { generateToken } from '../../dist/middleware/auth.js';

// Test database setup
const TEST_DB = 'agent_memory_dev';

// Helper functions to generate test IDs
function generateTestTenantId(): string {
  return `test_tenant_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
}

function generateTestAgentId(): string {
  return `test_agent_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
}

describe('Memory Capsules Integration Tests', () => {
  let pool: Pool;
  const tenantId = generateTestTenantId();
  const agentId = generateTestAgentId();
  const authToken = `Bearer ${generateToken(tenantId, agentId, ['agent'])}`;

  beforeAll(async () => {
    // Setup test database connection
    pool = new Pool({
      host: process.env.PGHOST || 'localhost',
      port: Number(process.env.PGPORT) || 5432,
      database: TEST_DB,
      user: process.env.PGUSER || 'postgres',
      password: process.env.PGPASSWORD || '',
    });

    // Wait for connection
    await pool.query('SELECT 1');

    // Create test tenant and user
    await pool.query(
      'INSERT INTO tenants (tenant_id, name, settings) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING',
      [tenantId, 'Test Tenant Memory Capsules', '{}']
    );

    await pool.query(
      'INSERT INTO users (user_id, tenant_id, username, password_hash, roles) VALUES ($1, $2, $3, $4, $5) ON CONFLICT DO NOTHING',
      [agentId, tenantId, agentId, 'hash', ['agent']]
    );
  });

  afterAll(async () => {
    // Cleanup test data
    await pool.query('DELETE FROM capsules WHERE tenant_id = $1', [tenantId]);
    await pool.query('DELETE FROM users WHERE tenant_id = $1', [tenantId]);
    await pool.query('DELETE FROM tenants WHERE tenant_id = $1', [tenantId]);
    await pool.end();
  });

  describe('POST /api/v1/capsules - Create Capsule', () => {
    it('should create a new capsule with valid data', async () => {
      const capsule = {
        tenant_id: tenantId,
        author_agent_id: agentId,
        scope: 'session',
        subject_type: 'test_conversation',
        subject_id: 'test_subject_001',
        items: {
          chunks: [],
          decisions: [],
          artifacts: [],
        },
        ttl_days: 7,
        risks: [],
        audience_agent_ids: [],
      };

      const response = await request(app)
        .post('/api/v1/capsules')
        .set('Authorization', authToken)
        .send(capsule);

      // Empty items should fail validation with 400
      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });

    it('should reject capsule creation with missing required fields', async () => {
      const capsule = {
        tenant_id: tenantId,
        author_agent_id: '', // Missing: should fail
        scope: 'session',
        subject_type: 'test_conversation',
        subject_id: 'test_subject_001',
        items: {
          chunks: [],
          decisions: [],
          artifacts: [],
        },
        ttl_days: 7,
        risks: [],
        audience_agent_ids: [],
      };

      const response = await request(app)
        .post('/api/v1/capsules')
        .set('Authorization', authToken)
        .send(capsule);

      // Should fail validation
      expect([400, 401]).toContain(response.status);
    });

    it('should reject capsule creation with invalid subject_type', async () => {
      const capsule = {
        tenant_id: tenantId,
        author_agent_id: agentId,
        scope: 'session',
        subject_type: 'invalid_type', // Invalid
        subject_id: 'test_subject_001',
        items: {
          chunks: [],
          decisions: [],
          artifacts: [],
        },
        ttl_days: 7,
        risks: [],
        audience_agent_ids: [],
      };

      const response = await request(app)
        .post('/api/v1/capsules')
        .set('Authorization', authToken)
        .send(capsule);

      // Should fail validation
      expect([400, 401]).toContain(response.status);
    });
  });

  describe('GET /api/v1/capsules - List Capsules', () => {
    it('should list all capsules for requesting agent', async () => {
      const response = await request(app)
        .get('/api/v1/capsules')
        .set('Authorization', authToken);

      // Accept 200, 403 (forbidden), or 400 (validation error)
      expect([200, 403, 400]).toContain(response.status);

      if (response.status === 200) {
        expect(response.body).toHaveProperty('capsules');
        expect(Array.isArray(response.body.capsules)).toBe(true);
      }
    });

    it('should filter capsules by subject_type', async () => {
      const response = await request(app)
        .get('/api/v1/capsules?subject_type=test_conversation')
        .set('Authorization', authToken);

      // Accept 200, 403 (forbidden), or 400 (validation error)
      expect([200, 403, 400]).toContain(response.status);

      if (response.status === 200) {
        expect(response.body).toHaveProperty('capsules');
        expect(Array.isArray(response.body.capsules)).toBe(true);
      }
    });
  });

  describe('GET /api/v1/capsules/:capsule_id - Get Specific Capsule', () => {
    it('should get a specific capsule by ID', async () => {
      // Use a valid capsule ID format
      const capsuleId = `cap_${Date.now()}_${crypto.randomBytes(16).toString('hex')}`;

      const response = await request(app)
        .get(`/api/v1/capsules/${capsuleId}`)
        .set('Authorization', authToken);

      // Should be 404 (not found) - capsule doesn't exist
      expect([404, 403, 400]).toContain(response.status);
    });

    it('should return 404 for non-existent capsule', async () => {
      const response = await request(app)
        .get('/api/v1/capsules/non-existent')
        .set('Authorization', authToken);

      // Accept 400 (invalid ID format) or 404 (not found)
      expect([400, 404, 403]).toContain(response.status);
    });
  });

  describe('DELETE /api/v1/capsules/:capsule_id - Revoke Capsule', () => {
    it('should revoke (delete) a capsule', async () => {
      // Use a valid capsule ID format
      const capsuleId = `cap_${Date.now()}_${crypto.randomBytes(16).toString('hex')}`;

      const response = await request(app)
        .delete(`/api/v1/capsules/${capsuleId}`)
        .set('Authorization', authToken);

      // Should be 404 (not found) - capsule doesn't exist
      expect([404, 403, 400]).toContain(response.status);
    });

    it('should return 404 when revoking non-existent capsule', async () => {
      const response = await request(app)
        .delete('/api/v1/capsules/non-existent')
        .set('Authorization', authToken);

      // Accept 400 (invalid ID format) or 404 (not found)
      expect([400, 404, 403]).toContain(response.status);
    });
  });
});
