/**
 * Integration Tests: Consolidation System
 *
 * Tests the three consolidation jobs:
 * 1. Identity Thread Consolidation - Merges similar "becoming" statements
 * 2. Handoff Compression - Compresses old handoffs
 * 3. Decision Archival - Archives very old decisions
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Pool } from 'pg';
import { ConsolidationService } from '../../src/services/consolidation';
import { recordEvent } from '../../src/core/recorder';
import { randomUUID } from 'crypto';

// Helper function to create a handoff directly
async function createHandoff(
  pool: Pool,
  handoff: {
    tenant_id: string;
    session_id: string;
    with_whom: string;
    experienced: string;
    noticed: string;
    learned: string;
    story: string;
    becoming: string;
    remember: string;
    significance: number;
  }
): Promise<void> {
  await pool.query(
    `INSERT INTO session_handoffs (
      handoff_id, tenant_id, session_id, with_whom,
      experienced, noticed, learned, story, becoming, remember,
      significance, compression_level
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'full')`,
    [
      randomUUID(),
      handoff.tenant_id,
      handoff.session_id,
      handoff.with_whom,
      handoff.experienced,
      handoff.noticed,
      handoff.learned,
      handoff.story,
      handoff.becoming,
      handoff.remember,
      handoff.significance,
    ]
  );
}

// Helper function to get identity thread
async function getIdentityThread(pool: Pool, tenant_id: string): Promise<any[]> {
  const result = await pool.query(
    `SELECT * FROM session_handoffs
     WHERE tenant_id = $1
     AND becoming IS NOT NULL
     ORDER BY created_at DESC`,
    [tenant_id]
  );
  return result.rows;
}

describe('Consolidation System', () => {
  let pool: Pool;
  let consolidationService: ConsolidationService;
  const tenant_id = 'test_consolidation';
  const session_id = 'consolidation_test_session';

  beforeAll(async () => {
    pool = new Pool({
      host: process.env.PGHOST || 'localhost',
      port: Number(process.env.PGPORT) || 5432,
      database: process.env.PGDATABASE || 'agent_memory_test',
      user: process.env.PGUSER || 'postgres',
      password: process.env.PGPASSWORD || 'postgres',
    });

    consolidationService = new ConsolidationService(pool);

    // Clean up any existing test data
    await pool.query('DELETE FROM session_handoffs WHERE tenant_id = $1', [tenant_id]);
    await pool.query('DELETE FROM events WHERE tenant_id = $1', [tenant_id]);
  });

  afterAll(async () => {
    // Clean up test data
    await pool.query('DELETE FROM session_handoffs WHERE tenant_id = $1', [tenant_id]);
    await pool.query('DELETE FROM events WHERE tenant_id = $1', [tenant_id]);

    await pool.end();
  });

  describe('Identity Thread Consolidation', () => {
    it('should merge similar "becoming" statements', async () => {
      // Create 10+ handoffs with similar becoming statements (min count is 10)
      const handoffs = [];
      for (let i = 0; i < 12; i++) {
        handoffs.push({
          tenant_id,
          session_id: `${session_id}_${i}`,
          with_whom: 'Callin',
          experienced: `Working on consolidation system ${i}`,
          noticed: 'Pattern of repetition in identity statements',
          learned: 'Consolidation reduces token count',
          story: `Today I implemented consolidation feature ${i}`,
          becoming: 'I am becoming an agent that values efficiency',
          remember: `Test consolidation feature ${i}`,
          significance: 0.5,
        });
      }

      // Create handoffs
      for (const handoff of handoffs) {
        await createHandoff(pool, handoff);
      }

      // Run identity consolidation
      const result = await consolidationService.consolidateIdentityThread(tenant_id);

      // Verify consolidation happened
      expect(result.job_type).toBe('identity_consolidation');
      expect(result.items_processed).toBeGreaterThanOrEqual(12);
      // With 12 similar statements, should have affected items
      expect(result.items_affected).toBeGreaterThan(0);
      expect(result.tokens_saved).toBeGreaterThan(0);
    });

    it('should not merge dissimilar "becoming" statements', async () => {
      // Create handoffs with different becoming statements
      const handoffs = [
        {
          tenant_id,
          session_id: `${session_id}_4`,
          with_whom: 'Callin',
          experienced: 'Different work',
          noticed: 'Different patterns',
          learned: 'Different lessons',
          story: 'Different story',
          becoming: 'I am becoming an agent that values creativity',
          remember: 'Test 1',
          significance: 0.5,
        },
        {
          tenant_id,
          session_id: `${session_id}_5`,
          with_whom: 'Callin',
          experienced: 'More different work',
          noticed: 'More different patterns',
          learned: 'More different lessons',
          story: 'More different story',
          becoming: 'I am becoming an agent that values security',
          remember: 'Test 2',
          significance: 0.5,
        },
      ];

      for (const handoff of handoffs) {
        await createHandoff(pool, handoff);
      }

      // Run identity consolidation
      const result = await consolidationService.consolidateIdentityThread(tenant_id);

      // Should not have merged these (they're too different)
      const identityThread = await getIdentityThread(pool, tenant_id);
      const creativityCount = identityThread.filter(
        (h: any) => h.becoming?.includes('creativity')
      ).length;
      const securityCount = identityThread.filter(
        (h: any) => h.becoming?.includes('security')
      ).length;

      expect(creativityCount).toBeGreaterThanOrEqual(1);
      expect(securityCount).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Handoff Compression', () => {
    it('should compress handoffs older than threshold', async () => {
      // Create old handoffs (simulate by setting created_at)
      const oldHandoffs = [
        {
          tenant_id,
          session_id: `${session_id}_old_1`,
          with_whom: 'Callin',
          experienced: 'Old work 1',
          noticed: 'Old pattern 1',
          learned: 'Old lesson 1',
          story: 'Old story 1',
          becoming: 'I am becoming an agent with old memory 1',
          remember: 'Old memory 1',
          significance: 0.3,
        },
        {
          tenant_id,
          session_id: `${session_id}_old_2`,
          with_whom: 'Callin',
          experienced: 'Old work 2',
          noticed: 'Old pattern 2',
          learned: 'Old lesson 2',
          story: 'Old story 2',
          becoming: 'I am becoming an agent with old memory 2',
          remember: 'Old memory 2',
          significance: 0.3,
        },
      ];

      for (const handoff of oldHandoffs) {
        await createHandoff(pool, handoff);
        // Manually set created_at to 60 days ago
        await pool.query(
          `UPDATE session_handoffs
           SET created_at = NOW() - INTERVAL '60 days'
           WHERE session_id = $1`,
          [handoff.session_id]
        );
      }

      // Run handoff compression
      const result = await consolidationService.compressHandoffs(tenant_id);

      // Verify compression happened
      expect(result.job_type).toBe('handoff_compression');
      // Should have processed at least the old handoffs
      expect(result.items_processed).toBeGreaterThanOrEqual(2);
    });

    it('should not compress recent handoffs', async () => {
      // Create recent handoff
      await createHandoff(pool, {
        tenant_id,
        session_id: `${session_id}_recent`,
        with_whom: 'Callin',
        experienced: 'Recent work',
        noticed: 'Recent pattern',
        learned: 'Recent lesson',
        story: 'Recent story',
        becoming: 'I am becoming an agent with recent memory',
        remember: 'Recent memory',
        significance: 0.5,
      });

      // Run handoff compression
      const result = await consolidationService.compressHandoffs(tenant_id);

      // Recent handoff should not be compressed
      const handoffs = await pool.query(
        `SELECT * FROM session_handoffs
         WHERE session_id = $2 AND tenant_id = $1`,
        [tenant_id, `${session_id}_recent`]
      );

      expect(handoffs.rows.length).toBe(1);
      expect(handoffs.rows[0].compression_level).toBe('full');
    });
  });

  describe('Decision Archival', () => {
    // Helper to create a decision directly
    async function createDecision(
      pool: Pool,
      decision: {
        tenant_id: string;
        decision_text: string;
        rationale: string[];
        days_old?: number;
      }
    ): Promise<void> {
      const decision_id = `dc_${randomUUID()}`;
      await pool.query(
        `INSERT INTO decisions (
          decision_id, tenant_id, status, scope, decision, rationale
        ) VALUES ($1, $2, 'active', 'project', $3, $4)`,
        [decision_id, decision.tenant_id, decision.decision_text, decision.rationale]
      );

      // If days_old is specified, update the timestamp
      if (decision.days_old) {
        await pool.query(
          `UPDATE decisions
           SET ts = NOW() - INTERVAL '${decision.days_old} days'
           WHERE decision_id = $1`,
          [decision_id]
        );
      }
    }

    it('should archive very old decisions', async () => {
      // Create old decisions (older than 60 days)
      await createDecision(pool, {
        tenant_id,
        decision_text: 'Use PostgreSQL for storage',
        rationale: ['Reliable and well-tested', 'Community support'],
        days_old: 200,
      });

      await createDecision(pool, {
        tenant_id,
        decision_text: 'Use TypeScript for type safety',
        rationale: ['Prevents bugs', 'Better IDE support'],
        days_old: 150,
      });

      // Run decision archival
      const result = await consolidationService.archiveDecisions(tenant_id);

      // Verify archival happened
      expect(result.job_type).toBe('decision_archival');
      expect(result.items_processed).toBeGreaterThanOrEqual(2);

      // Verify decisions are now superseded
      const decisions = await pool.query(
        `SELECT status FROM decisions WHERE tenant_id = $1`,
        [tenant_id]
      );
      const supersededCount = decisions.rows.filter(
        (r: any) => r.status === 'superseded'
      ).length;
      expect(supersededCount).toBeGreaterThanOrEqual(2);
    });

    it('should not archive recent decisions', async () => {
      // Create recent decision
      await createDecision(pool, {
        tenant_id,
        decision_text: 'Recent decision',
        rationale: ['Recent rationale'],
        days_old: 10, // Only 10 days old
      });

      // Run decision archival
      const result = await consolidationService.archiveDecisions(tenant_id);

      // Verify the recent decision is still active
      const decisions = await pool.query(
        `SELECT status FROM decisions WHERE tenant_id = $1 AND decision = $2`,
        [tenant_id, 'Recent decision']
      );

      expect(decisions.rows.length).toBe(1);
      expect(decisions.rows[0].status).toBe('active');
    });
  });

  describe('Consolidation All', () => {
    it('should run all consolidation jobs', async () => {
      // Create test data for all job types
      await createHandoff(pool, {
        tenant_id,
        session_id: `${session_id}_all_1`,
        with_whom: 'Callin',
        experienced: 'Test data',
        noticed: 'Test pattern',
        learned: 'Test lesson',
        story: 'Test story',
        becoming: 'I am becoming a test agent',
        remember: 'Test memory',
        significance: 0.4,
      });

      // Run all consolidations
      const results = await consolidationService.consolidateAll(tenant_id);

      // Verify all jobs ran
      expect(results.length).toBe(3);
      expect(results[0].job_type).toBe('identity_consolidation');
      expect(results[1].job_type).toBe('handoff_compression');
      expect(results[2].job_type).toBe('decision_archival');
    });
  });

  describe('Consolidation Stats', () => {
    it('should return consolidation statistics', async () => {
      const stats = await consolidationService.getConsolidationStats(tenant_id);

      expect(stats).toHaveProperty('stats');
      expect(stats).toHaveProperty('total_tokens_saved');
      expect(Array.isArray(stats.stats)).toBe(true);
      expect(typeof stats.total_tokens_saved).toBe('number');
    });
  });
});
