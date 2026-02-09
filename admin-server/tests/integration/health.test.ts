/**
 * Integration Tests: Health Check Endpoint
 *
 * Tests the health check endpoint for Admin Server.
 * Verifies server responds correctly to health checks.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createDatabasePool } from '../../src/config/database.js';
import { app } from '../../src/index.js';

describe('Admin Server Health Check Integration Tests', () => {
  let pool: ReturnType<typeof createDatabasePool>;

  beforeAll(async () => {
    // Setup database connection
    pool = createDatabasePool();
    // Wait for connection to be established
    await pool.query('SELECT 1');
  });

  afterAll(async () => {
    // Close database connection
    await pool.end();
  });

  describe('GET /health', () => {
    it('should return healthy status', async () => {
      const response = await request(app)
        .get('/health')
        .expect('Content-Type', /json/)
        .expect(200);

      expect(response.body).toHaveProperty('status', 'healthy');
      expect(response.body).toHaveProperty('service', 'admin-server');
      expect(response.body).toHaveProperty('version', '1.0.0');
      expect(response.body).toHaveProperty('timestamp');
      expect(new Date(response.body.timestamp)).toBeInstanceOf(Date);
    });

    it('should return JSON format', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.headers['content-type']).toMatch(/json/);
    });
  });

  describe('GET /', () => {
    it('should return server information', async () => {
      const response = await request(app)
        .get('/')
        .expect('Content-Type', /json/)
        .expect(200);

      expect(response.body).toHaveProperty('name', 'Admin Server');
      expect(response.body).toHaveProperty('version', '1.0.0');
      expect(response.body).toHaveProperty('status', 'running');
      expect(response.body).toHaveProperty('port');
      expect(response.body).toHaveProperty('environment');
      expect(response.body).toHaveProperty('endpoints');
      expect(response.body.endpoints).toHaveProperty('health', 'GET /health');
      expect(response.body.endpoints).toHaveProperty('root', 'GET /');
    });
  });
});
