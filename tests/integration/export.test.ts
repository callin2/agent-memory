/**
 * Export API Integration Tests
 *
 * Tests memory export functionality for backup and portability
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Pool } from 'pg';
import { request } from 'undici';

describe('Export API', () => {
  let pool: Pool;
  const baseUrl = 'http://localhost:3456';
  const tenantId = 'test-export-tenant';

  beforeAll(async () => {
    pool = new Pool({
      host: process.env.PGHOST || 'localhost',
      port: Number(process.env.PGPORT) || 5432,
      database: process.env.PGDATABASE || 'agent_memory_test',
      user: process.env.PGUSER || 'postgres',
      password: process.env.PGPASSWORD || 'postgres',
    });

    // Insert test data
    await pool.query(
      `INSERT INTO session_handoffs
        (tenant_id, session_id, with_whom, experienced, noticed, learned, story, becoming, remember, significance, tags)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [
        tenantId,
        'test-session-1',
        'TestUser',
        'Built export functionality',
        'Export enables memory portability',
        'TypeScript type safety prevents bugs',
        'We added export endpoints for backup and portability',
        'An agent who values data sovereignty',
        'Test the export endpoints',
        0.8,
        ['export', 'test']
      ]
    );

    // Insert a second handoff without becoming (should not appear in identity thread)
    await pool.query(
      `INSERT INTO session_handoffs
        (tenant_id, session_id, with_whom, experienced, noticed, learned, remember, significance, tags)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        tenantId,
        'test-session-2',
        'TestUser',
        'Regular handoff without becoming',
        'Some observations',
        'Some learning',
        'Remember this',
        0.5,
        ['test']
      ]
    );

    // Insert test decision
    await pool.query(
      `INSERT INTO decisions
        (tenant_id, decision_id, context, snapshot, options, selected_idx, reasoning, ts)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        tenantId,
        'test-decision-1',
        'Test context',
        { test: 'snapshot' },
        [{ name: 'Option A' }, { name: 'Option B' }],
        0,
        'Selected Option A because...',
        new Date()
      ]
    );
  });

  afterAll(async () => {
    // Clean up test data
    await pool.query('DELETE FROM session_handoffs WHERE tenant_id = $1', [tenantId]);
    await pool.query('DELETE FROM decisions WHERE tenant_id = $1', [tenantId]);
    await pool.query('DELETE FROM chunks WHERE tenant_id = $1', [tenantId]);

    await pool.end();
  });

  describe('GET /api/v1/export/thread', () => {
    it('should export identity thread as JSON', async () => {
      const response = await request(`${baseUrl}/api/v1/export/thread?tenant_id=${tenantId}&format=json`);

      expect(response.statusCode).toBe(200);
      expect(response.headers['content-type']).toContain('application/json');

      const data = await response.body.json();

      expect(data).toHaveProperty('tenant_id', tenantId);
      expect(data).toHaveProperty('export_date');
      expect(data).toHaveProperty('total_statements', 1); // Only handoffs with becoming
      expect(data).toHaveProperty('identity_thread');
      expect(data.identity_thread).toHaveLength(1);
      expect(data.identity_thread[0].becoming).toBe('An agent who values data sovereignty');
    });

    it('should export identity thread as markdown', async () => {
      const response = await request(`${baseUrl}/api/v1/export/thread?tenant_id=${tenantId}&format=markdown`);

      expect(response.statusCode).toBe(200);
      expect(response.headers['content-type']).toContain('text/markdown');

      const markdown = await response.body.text();

      expect(markdown).toContain('# Identity Thread Export');
      expect(markdown).toContain('An agent who values data sovereignty');
      expect(markdown).toContain('### Who I Am Becoming');
      expect(markdown).toContain('Built export functionality');
    });

    it('should return empty result for tenant with no identity statements', async () => {
      const emptyTenant = 'empty-tenant-xyz';
      const response = await request(`${baseUrl}/api/v1/export/thread?tenant_id=${emptyTenant}`);

      expect(response.statusCode).toBe(200);

      const data = await response.body.json();
      expect(data.total_statements).toBe(0);
      expect(data.identity_thread).toHaveLength(0);
    });

    it('should require tenant_id parameter', async () => {
      const response = await request(`${baseUrl}/api/v1/export/thread`);

      expect(response.statusCode).toBe(400);

      const data = await response.body.json();
      expect(data).toHaveProperty('error', 'tenant_id is required');
    });
  });

  describe('GET /api/v1/export/all', () => {
    it('should export handoffs and decisions', async () => {
      const response = await request(`${baseUrl}/api/v1/export/all?tenant_id=${tenantId}`);

      expect(response.statusCode).toBe(200);
      expect(response.headers['content-type']).toContain('application/json');

      const data = await response.body.json();

      expect(data).toHaveProperty('tenant_id', tenantId);
      expect(data).toHaveProperty('export_date');
      expect(data).toHaveProperty('handoffs');
      expect(data).toHaveProperty('decisions');

      expect(data.handoffs.total).toBe(2); // Both handoffs
      expect(data.handoffs.items).toHaveLength(2);
      expect(data.decisions.total).toBe(1);
      expect(data.decisions.items).toHaveLength(1);
    });

    it('should optionally include event chunks', async () => {
      // Insert a test chunk
      await pool.query(
        `INSERT INTO chunks (tenant_id, chunk_id, role, content, ts)
         VALUES ($1, $2, $3, $4, $5)`,
        [tenantId, 'test-chunk-1', 'user', 'Test chunk content', new Date()]
      );

      const response = await request(`${baseUrl}/api/v1/export/all?tenant_id=${tenantId}&include_events=true`);

      expect(response.statusCode).toBe(200);

      const data = await response.body.json();
      expect(data).toHaveProperty('events');
      expect(data.events.total).toBeGreaterThanOrEqual(1);
      expect(data.events).toHaveProperty('note', 'Limited to 1000 most recent chunks');
    });

    it('should not include events by default', async () => {
      const response = await request(`${baseUrl}/api/v1/export/all?tenant_id=${tenantId}`);

      expect(response.statusCode).toBe(200);

      const data = await response.body.json();
      expect(data).not.toHaveProperty('events');
    });

    it('should require tenant_id parameter', async () => {
      const response = await request(`${baseUrl}/api/v1/export/all`);

      expect(response.statusCode).toBe(400);

      const data = await response.body.json();
      expect(data).toHaveProperty('error', 'tenant_id is required');
    });
  });

  describe('Data integrity', () => {
    it('should preserve handoff fields in export', async () => {
      const response = await request(`${baseUrl}/api/v1/export/all?tenant_id=${tenantId}`);

      const data = await response.body.json();
      const handoff = data.handoffs.items.find((h: any) => h.becoming);

      expect(handoff).toHaveProperty('handoff_id');
      expect(handoff).toHaveProperty('session_id', 'test-session-1');
      expect(handoff).toHaveProperty('with_whom', 'TestUser');
      expect(handoff).toHaveProperty('experienced', 'Built export functionality');
      expect(handoff).toHaveProperty('noticed', 'Export enables memory portability');
      expect(handoff).toHaveProperty('learned', 'TypeScript type safety prevents bugs');
      expect(handoff).toHaveProperty('story');
      expect(handoff).toHaveProperty('becoming');
      expect(handoff).toHaveProperty('remember');
      expect(handoff).toHaveProperty('significance', 0.8);
      expect(handoff).toHaveProperty('tags');
      expect(handoff.tags).toContain('export');
    });

    it('should preserve decision fields in export', async () => {
      const response = await request(`${baseUrl}/api/v1/export/all?tenant_id=${tenantId}`);

      const data = await response.body.json();
      const decision = data.decisions.items[0];

      expect(decision).toHaveProperty('decision_id', 'test-decision-1');
      expect(decision).toHaveProperty('context', 'Test context');
      expect(decision).toHaveProperty('snapshot');
      expect(decision).toHaveProperty('options');
      expect(decision).toHaveProperty('selected_idx', 0);
      expect(decision).toHaveProperty('reasoning');
      expect(decision).toHaveProperty('ts');
    });
  });
});
