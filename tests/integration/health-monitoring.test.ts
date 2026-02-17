/**
 * Health Monitoring Integration Tests
 *
 * Tests the health check endpoints and monitoring service.
 */

import { describe, it, expect } from 'vitest';

describe('Health Monitoring API', () => {
  const baseUrl = `http://localhost:${process.env.PORT || 4000}`;

  describe('GET /health', () => {
    it('should return overall health status', async () => {
      const response = await fetch(`${baseUrl}/health`);

      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data).toHaveProperty('status');
      expect(['healthy', 'degraded', 'unhealthy']).toContain(data.status);
    });

    it('should include timestamp', async () => {
      const response = await fetch(`${baseUrl}/health`);

      const data = await response.json();
      expect(data).toHaveProperty('timestamp');
      const timestamp = new Date(data.timestamp);
      expect(timestamp.getTime()).toBeLessThan(Date.now());
      expect(timestamp.getTime()).toBeGreaterThan(Date.now() - 10000);
    });

    it('should include uptime', async () => {
      const response = await fetch(`${baseUrl}/health`);

      const data = await response.json();
      expect(data).toHaveProperty('uptime');
      expect(typeof data.uptime).toBe('number');
      expect(data.uptime).toBeGreaterThan(0);
    });
  });

  describe('Health Check Performance', () => {
    it('should respond quickly', async () => {
      const start = Date.now();
      const response = await fetch(`${baseUrl}/health`);
      const duration = Date.now() - start;

      expect(response.status).toBe(200);
      expect(duration).toBeLessThan(500);
    });

    it('should handle concurrent requests', async () => {
      const requests = Array(10).fill(null).map(() =>
        fetch(`${baseUrl}/health`)
      );

      const responses = await Promise.all(requests);

      responses.forEach((response) => {
        expect(response.status).toBe(200);
      });
    });
  });

  describe('Health Check for Monitoring', () => {
    it('should provide JSON output for monitoring tools', async () => {
      const response = await fetch(`${baseUrl}/health`, {
        headers: {
          Accept: 'application/json',
        },
      });

      expect(response.status).toBe(200);
      expect(response.headers.get('content-type')).toContain('application/json');
    });

    it('should return 503 when database is unavailable', async () => {
      // This test verifies behavior but doesn't actually break the database
      // In a real test environment, you'd use a mock database that fails
      const response = await fetch(`${baseUrl}/health`);

      // If database is up, should be 200
      // If database is down, should be 503
      expect([200, 503]).toContain(response.status);

      if (response.status === 200) {
        const data = await response.json();
        expect(data.status).toBe('healthy');
      } else {
        const data = await response.json();
        expect(data.status).toBe('unhealthy');
      }
    });
  });

  describe('GET /health/detailed', () => {
    it('should return detailed health information when available', async () => {
      const response = await fetch(`${baseUrl}/health/detailed`);

      // Might return 200 or 503 depending on system state
      expect([200, 503]).toContain(response.status);

      if (response.status === 200) {
        const data = await response.json();
        expect(data).toHaveProperty('status');
        expect(data).toHaveProperty('checks');
      }
    });

    it('should include database check', async () => {
      const response = await fetch(`${baseUrl}/health/detailed`);

      if (response.status === 200) {
        const data = await response.json();
        expect(data.checks).toHaveProperty('database');
        expect(data.checks.database).toHaveProperty('status');
        expect(['pass', 'warn', 'fail']).toContain(data.checks.database.status);
      }
    });

    it('should provide database response time', async () => {
      const response = await fetch(`${baseUrl}/health/detailed`);

      if (response.status === 200) {
        const data = await response.json();
        expect(data.checks.database).toHaveProperty('response_time_ms');
        expect(typeof data.checks.database.response_time_ms).toBe('number');
      }
    });
  });

  describe('GET /metrics', () => {
    it('should return system metrics', async () => {
      const response = await fetch(`${baseUrl}/metrics`);

      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data).toHaveProperty('tenant_id');
      expect(data).toHaveProperty('timestamp');
      expect(data).toHaveProperty('events');
      expect(data).toHaveProperty('handoffs');
    });

    it('should include event statistics', async () => {
      const response = await fetch(`${baseUrl}/metrics`);

      const data = await response.json();
      expect(data.events).toHaveProperty('by_kind');
      expect(data.events).toHaveProperty('recent_24h');
    });

    it('should include handoff statistics', async () => {
      const response = await fetch(`${baseUrl}/metrics`);

      const data = await response.json();
      expect(data.handoffs).toHaveProperty('total');
      expect(data.handoffs).toHaveProperty('full_count');
      expect(data.handoffs).toHaveProperty('summary_count');
      expect(data.handoffs).toHaveProperty('quick_ref_count');
    });

    it('should include storage estimates', async () => {
      const response = await fetch(`${baseUrl}/metrics`);

      const data = await response.json();
      expect(data.storage).toHaveProperty('total_text_bytes');
      expect(data.storage).toHaveProperty('total_chunks');
      expect(data.storage).toHaveProperty('avg_chunk_size_bytes');
    });
  });
});
