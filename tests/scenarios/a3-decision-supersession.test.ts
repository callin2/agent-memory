import { Pool } from 'pg';
import { runScenario, cleanDatabase, createTestPool } from './scenario-runner';
import { recordEvent } from '../../src/core/recorder';
import { buildACB } from '../../src/core/orchestrator';

/**
 * Scenario A3: Superseding Decisions
 *
 * When a decision is superseded by a new one,
 * the system should return only the active (latest) decision
 * unless explicitly querying for history.
 */
export async function testScenarioA3(): Promise<void> {
  const pool = createTestPool();
  const tenant_id = 'test_tenant';
  const session_id = 'test_session_a3';

  await runScenario({
    name: 'A3: Decision Supersession',
    setup: async () => {
      await cleanDatabase(pool);

      // Create first decision (active)
      await pool.query(
        `INSERT INTO decisions (decision_id, tenant_id, ts, status, scope, decision, rationale, constraints, alternatives, consequences, refs)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        [
          'dec_secrets_v1',
          tenant_id,
          new Date(Date.now() - 100000),
          'superseded',
          'project',
          'Never store secrets in memory',
          ['Secrets can leak in logs', 'Secrets in memory are a security risk'],
          ['All secrets must be redacted'],
          ['Encrypt secrets', 'Store in separate vault'],
          ['Maximum security', 'No secret exposure'],
          [],
        ]
      );

      // Create second decision (supersedes first)
      await pool.query(
        `INSERT INTO decisions (decision_id, tenant_id, ts, status, scope, decision, rationale, constraints, alternatives, consequences, refs)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        [
          'dec_secrets_v2',
          tenant_id,
          new Date(),
          'active',
          'project',
          'Store secrets encrypted with AES-256 in memory',
          [
            'Need to store some secrets for functionality',
            'Encryption provides security with usability',
            'V1 was too restrictive',
          ],
          ['Must use AES-256', 'Keys stored in env vars'],
          ['Keep v1 approach', 'Use external vault'],
          ['Better functionality while secure'],
          ['dec_secrets_v1'], // Ref to superseded decision
        ]
      );
    },
    steps: [
      {
        description: 'User asks current policy',
        action: async () => {
          await recordEvent(pool, {
            tenant_id,
            session_id,
            channel: 'private',
            actor: { type: 'human', id: 'user_1' },
            kind: 'message',
            sensitivity: 'none',
            tags: ['question', 'policy'],
            content: { text: 'What is the policy now?' },
            refs: [],
          });
        },
      },
    ],
    assertions: [
      {
        description: 'Decision ledger contains both decisions (P1 - append-only)',
        check: async () => {
          const result = await pool.query(
            `SELECT decision_id, status FROM decisions WHERE tenant_id = $1 ORDER BY ts`,
            [tenant_id]
          );

          if (result.rows.length !== 2) {
            throw new Error(`Expected 2 decisions, got ${result.rows.length}`);
          }

          const v1 = result.rows.find((r) => r.decision_id === 'dec_secrets_v1');
          const v2 = result.rows.find((r) => r.decision_id === 'dec_secrets_v2');

          if (!v1 || !v2) {
            throw new Error('Both decisions not found');
          }

          if (v1.status !== 'superseded') {
            throw new Error('V1 decision should be superseded');
          }

          if (v2.status !== 'active') {
            throw new Error('V2 decision should be active');
          }
        },
      },
      {
        description: 'ACB includes active decision (D2) and excludes superseded (D1)',
        check: async () => {
          const acb = await buildACB(pool, {
            tenant_id,
            session_id,
            agent_id: 'agent_1',
            channel: 'private',
            intent: 'query_policy',
            query_text: 'What is the policy now?',
            max_tokens: 65000,
          });

          const decisionSection = acb.sections.find((s) => s.name === 'relevant_decisions');

          if (!decisionSection || decisionSection.items.length === 0) {
            throw new Error('No decisions in ACB');
          }

          const decisionText = decisionSection.items[0].text || '';

          // Should mention v2 (encrypted) not v1 (never store)
          if (!decisionText.includes('encrypted') && !decisionText.includes('AES-256')) {
            throw new Error('Active decision (v2) not returned');
          }

          // Should not mention v1's "never store" as current policy
          if (decisionText.includes('Never store secrets') && !decisionText.includes('superseded')) {
            throw new Error('Superseded decision (v1) returned as current');
          }
        },
      },
      {
        description: 'V2 decision has ref to V1 (P4 - traceability)',
        check: async () => {
          const result = await pool.query(
            `SELECT refs FROM decisions WHERE decision_id = $2`,
            [tenant_id, 'dec_secrets_v2']
          );

          const refs = result.rows[0].refs;
          if (!refs || !refs.includes('dec_secrets_v1')) {
            throw new Error('V2 decision does not reference V1');
          }
        },
      },
      {
        description: 'Deterministic tie-break: latest active wins',
        check: async () => {
          // Create two active decisions about the same topic
          await pool.query(
            `INSERT INTO decisions (decision_id, tenant_id, ts, status, scope, decision, rationale, constraints, alternatives, consequences, refs)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
            [
              'dec_db_choice_1',
              tenant_id,
              new Date(Date.now() - 1000),
              'active',
              'project',
              'Use PostgreSQL for database',
              ['Reliable and feature-rich'],
              [],
              [],
              [],
              [],
            ]
          );

          await pool.query(
            `INSERT INTO decisions (decision_id, tenant_id, ts, status, scope, decision, rationale, constraints, alternatives, consequences, refs)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
            [
              'dec_db_choice_2',
              tenant_id,
              new Date(),
              'active',
              'project',
              'Use PostgreSQL with optimizations',
              ['Proven choice with better performance'],
              [],
              [],
              [],
              [],
            ]
          );

          const acb = await buildACB(pool, {
            tenant_id,
            session_id,
            agent_id: 'agent_1',
            channel: 'private',
            intent: 'query_db',
            query_text: 'What database should we use?',
            max_tokens: 65000,
          });

          const decisionSection = acb.sections.find((s) => s.name === 'relevant_decisions');
          const decisionText = decisionSection?.items[0].text || '';

          // Should prefer the latest decision (with optimizations)
          if (!decisionText.includes('optimizations')) {
            throw new Error('Latest decision not preferred');
          }
        },
      },
    ],
    cleanup: async () => {
      await cleanDatabase(pool);
      await pool.end();
    },
  });
}

if (require.main === module) {
  testScenarioA3().catch(console.error);
}
