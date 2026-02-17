/**
 * Session Startup API Integration Tests
 *
 * Tests the session startup and wake-up functionality.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Pool } from 'pg';
import { randomUUID } from 'crypto';

describe('Session Startup API', () => {
  let pool: Pool;
  const tenantId = 'test-session-tenant';
  const sessionId = 'test-session-123';

  beforeAll(async () => {
    pool = new Pool({
      host: process.env.PGHOST || 'localhost',
      port: Number(process.env.PGPORT) || 5432,
      database: process.env.PGDATABASE || 'agent_memory_test',
      user: process.env.PGUSER || 'postgres',
      password: process.env.PGPASSWORD || 'postgres',
    });

    // Clean up test data
    await pool.query('DELETE FROM session_handoffs WHERE tenant_id = $1', [tenantId]);
  });

  afterAll(async () => {
    await pool.query('DELETE FROM session_handoffs WHERE tenant_id = $1', [tenantId]);
    await pool.end();
  });

  describe('POST /api/v1/session/start', () => {
    it('should initialize a new session', async () => {
      const response = await fetch('http://localhost:3456/api/v1/session/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenant_id: tenantId,
          session_id: sessionId,
          with_whom: 'TestUser',
        }),
      });

      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data).toHaveProperty('status', 'session_started');
    });

    it('should return context if handoffs exist', async () => {
      // Create a previous handoff
      await pool.query(
        `INSERT INTO session_handoffs
          (handoff_id, tenant_id, session_id, with_whom,
           experienced, noticed, learned, story, becoming, remember,
           significance, compression_level)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'full')`,
        [
          randomUUID(),
          tenantId,
          'previous-session',
          'TestUser',
          'Previous work',
          'Noticed something',
          'Learned something',
          'Previous story',
          'An agent that tests',
          'Test this feature',
          0.7,
        ]
      );

      const response = await fetch('http://localhost:3456/api/v1/session/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenant_id: tenantId,
          session_id: sessionId,
          with_whom: 'TestUser',
        }),
      });

      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data).toHaveProperty('context');
      expect(data.context).toHaveProperty('last_handoff');
    });
  });

  describe('GET /api/v1/wake-up', () => {
    beforeEach(async () => {
      // Create test handoffs
      await pool.query(
        `INSERT INTO session_handoffs
          (handoff_id, tenant_id, session_id, with_whom,
           experienced, noticed, learned, story, becoming, remember,
           significance, compression_level)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'full'),
         ($12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, 'full')`,
        [
          randomUUID(),
          tenantId,
          'session-1',
          'TestUser',
          'First session work',
          'Noticed pattern A',
          'Learned technique B',
          'Story 1',
          'An agent that builds incrementally',
          'Remember pattern A',
          0.8,
          randomUUID(),
          tenantId,
          'session-2',
          'TestUser',
          'Second session work',
          'Noticed pattern B',
          'Learned technique C',
          'Story 2',
          'An agent that tests thoroughly',
          'Remember pattern B',
          0.7,
        ]
      );
    });

    it('should wake up with context from previous session', async () => {
      const response = await fetch(
        `http://localhost:3456/api/v1/wake-up?tenant_id=${tenantId}&with_whom=TestUser`
      );

      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data).toHaveProperty('last_handoff');
      expect(data.last_handoff.experienced).toBe('Second session work');
    });

    it('should include identity thread', async () => {
      const response = await fetch(
        `http://localhost:3456/api/v1/wake-up?tenant_id=${tenantId}&with_whom=TestUser`
      );

      const data = await response.json();
      expect(data).toHaveProperty('identity_thread');
      expect(data.identity_thread).toBeInstanceOf(Array);
      expect(data.identity_thread).toHaveLength(2);
    });

    it('should include recent decisions', async () => {
      // Create a test decision
      await pool.query(
        `INSERT INTO decisions
          (decision_id, tenant_id, context, snapshot, options, selected_idx, reasoning, ts)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          randomUUID(),
          tenantId,
          'Test context',
          { test: 'snapshot' },
          [{ name: 'Option 1' }, { name: 'Option 2' }],
          0,
          'Selected first option',
          new Date(),
        ]
      );

      const response = await fetch(
        `http://localhost:3456/api/v1/wake-up?tenant_id=${tenantId}&with_whom=TestUser`
      );

      const data = await response.json();
      expect(data).toHaveProperty('recent_decisions');
      expect(data.recent_decisions).toBeInstanceOf(Array);
    });

    it('should generate human-readable context', async () => {
      const response = await fetch(
        `http://localhost:3456/api/v1/wake-up?tenant_id=${tenantId}&with_whom=TestUser`
      );

      const data = await response.json();
      expect(data).toHaveProperty('context');
      expect(typeof data.context).toBe('string');
      expect(data.context.length).toBeGreaterThan(0);
    });

    it('should return empty context for new tenant', async () => {
      const response = await fetch(
        'http://localhost:3456/api/v1/wake-up?tenant_id=new-tenant&with_whom=TestUser'
      );

      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.last_handoff).toBeNull();
      expect(data.identity_thread).toEqual([]);
      expect(data.recent_decisions).toEqual([]);
    });

    it('should require tenant_id parameter', async () => {
      const response = await fetch(
        'http://localhost:3456/api/v1/wake-up?with_whom=TestUser'
      );

      expect(response.status).toBe(400);
    });

    it('should require with_whom parameter', async () => {
      const response = await fetch(
        `http://localhost:3456/api/v1/wake-up?tenant_id=${tenantId}`
      );

      expect(response.status).toBe(400);
    });
  });

  describe('Wake-Up Context Quality', () => {
    it('should prioritize recent handoffs', async () => {
      // Create multiple handoffs with different timestamps
      const handoffs = [
        {
          experienced: 'Oldest work',
          becoming: 'Oldest identity',
          significance: 0.5,
        },
        {
          experienced: 'Recent work',
          becoming: 'Recent identity',
          significance: 0.9,
        },
      ];

      for (const handoff of handoffs) {
        await pool.query(
          `INSERT INTO session_handoffs
            (handoff_id, tenant_id, session_id, with_whom,
             experienced, noticed, learned, becoming, remember,
             significance, compression_level, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'full',
            NOW() - (random() * interval '7 days'))`,
          [
            randomUUID(),
            tenantId,
            `session-${randomUUID()}`,
            'TestUser',
            handoff.experienced,
            'Noticed',
            'Learned',
            handoff.becoming,
            'Remember',
            handoff.significance,
          ]
        );
      }

      const response = await fetch(
        `http://localhost:3456/api/v1/wake-up?tenant_id=${tenantId}&with_whom=TestUser`
      );

      const data = await response.json();
      expect(data.last_handoff.experienced).toBe('Recent work');
    });

    it('should include only handoffs with becoming in identity thread', async () => {
      // Create handoffs with and without becoming
      await pool.query(
        `INSERT INTO session_handoffs
          (handoff_id, tenant_id, session_id, with_whom,
           experienced, noticed, learned, story, becoming, remember,
           significance, compression_level)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'full'),
         ($12, $13, $14, $15, $16, $17, $18, $19, $20, $21, NULL, $22, 'full')`,
        [
          randomUUID(),
          tenantId,
          'with-becoming',
          'TestUser',
          'Work 1',
          'Notice 1',
          'Learn 1',
          'Story 1',
          'With becoming',
          'Remember 1',
          0.7,
          randomUUID(),
          tenantId,
          'without-becoming',
          'TestUser',
          'Work 2',
          'Notice 2',
          'Learn 2',
          'Story 2',
          null,
          'Remember 2',
          0.6,
        ]
      );

      const response = await fetch(
        `http://localhost:3456/api/v1/wake-up?tenant_id=${tenantId}&with_whom=TestUser`
      );

      const data = await response.json();
      expect(data.identity_thread).toHaveLength(1);
      expect(data.identity_thread[0].becoming).toBe('With becoming');
    });
  });

  describe('Session Continuity', () => {
    it('should maintain thread across multiple wake-ups', async () => {
      // Session 1: Create handoff
      await pool.query(
        `INSERT INTO session_handoffs
          (handoff_id, tenant_id, session_id, with_whom,
           experienced, noticed, learned, becoming, remember,
           significance, compression_level)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'full')`,
        [
          randomUUID(),
          tenantId,
          'session-1',
          'TestUser',
          'Session 1 work',
          'Notice 1',
          'Learn 1',
          'Identity 1',
          'Remember 1',
          0.7,
        ]
      );

      // Wake up after session 1
      const wake1 = await fetch(
        `http://localhost:3456/api/v1/wake-up?tenant_id=${tenantId}&with_whom=TestUser`
      );
      const data1 = await wake1.json();

      expect(data1.identity_thread).toHaveLength(1);
      expect(data1.identity_thread[0].becoming).toBe('Identity 1');

      // Session 2: Create another handoff
      await pool.query(
        `INSERT INTO session_handoffs
          (handoff_id, tenant_id, session_id, with_whom,
           experienced, noticed, learned, becoming, remember,
           significance, compression_level)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'full')`,
        [
          randomUUID(),
          tenantId,
          'session-2',
          'TestUser',
          'Session 2 work',
          'Notice 2',
          'Learn 2',
          'Identity 2',
          'Remember 2',
          0.8,
        ]
      );

      // Wake up after session 2
      const wake2 = await fetch(
        `http://localhost:3456/api/v1/wake-up?tenant_id=${tenantId}&with_whom=TestUser`
      );
      const data2 = await wake2.json();

      expect(data2.identity_thread).toHaveLength(2);
      expect(data2.identity_thread[0].becoming).toBe('Identity 2');
      expect(data2.identity_thread[1].becoming).toBe('Identity 1');
    });
  });
});
