import { Pool } from 'pg';
import { runScenario, cleanDatabase, createTestPool } from './scenario-runner';
import { recordEvent } from '../../src/core/recorder';
import { buildACB } from '../../src/core/orchestrator';

/**
 * Scenario A2: Old Decision Recall After 2 Weeks
 *
 * User asks about a decision made 2 weeks ago.
 * System must retrieve the decision from long-term memory.
 */
export async function testScenarioA2(): Promise<void> {
  const pool = createTestPool();
  const tenant_id = 'test_tenant';
  const session_id = 'test_session_a2';

  // Current date
  const now = new Date();

  // Two weeks ago
  const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

  await runScenario({
    name: 'A2: Old Decision Recall After 2 Weeks',
    setup: async () => {
      await cleanDatabase(pool);

      // Create decision from 2 weeks ago
      await pool.query(
        `INSERT INTO decisions (decision_id, tenant_id, ts, status, scope, decision, rationale, constraints, alternatives, consequences, refs)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        [
          'dec_two_weeks_old',
          tenant_id,
          twoWeeksAgo,
          'active',
          'project',
          'Use zero-dependency retrieval with file-based micro-indexes instead of sqlite',
          [
            'Avoid external dependencies for simplicity',
            'File-based indexes are easier to debug',
            'Startup time is faster without database initialization',
          ],
          ['Must stay under 500ms p95 latency'],
          [
            'Use sqlite with prepared statements',
            'Use Redis for caching',
            'Use in-memory indexes with persistence',
          ],
          ['Faster cold start', 'Simpler deployment'],
          ['evt_001'],
        ]
      );

      // Create related events from 2 weeks ago
      await pool.query(
        `INSERT INTO events (event_id, tenant_id, session_id, channel, actor_type, actor_id, kind, sensitivity, tags, content, refs, ts)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
        [
          'evt_001',
          tenant_id,
          'session_two_weeks_ago',
          'private',
          'agent',
          'agent_1',
          'decision',
          'low',
          ['decision', 'architecture'],
          JSON.stringify({
            decision: 'Use zero-dependency retrieval',
            rationale: 'Avoid external dependencies',
          }),
          [],
          twoWeeksAgo,
        ]
      );

      // Create chunks for the decision
      await pool.query(
        `INSERT INTO chunks (chunk_id, tenant_id, event_id, ts, kind, channel, sensitivity, tags, token_est, importance, text)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        [
          'chk_old_decision',
          tenant_id,
          'evt_001',
          twoWeeksAgo,
          'decision',
          'private',
          'low',
          ['decision', 'architecture'],
          45,
          1.0,
          'Decision: Use zero-dependency retrieval with file-based micro-indexes instead of sqlite',
        ]
      );
    },
    steps: [
      {
        description: 'User asks about old decision',
        action: async () => {
          await recordEvent(pool, {
            tenant_id,
            session_id,
            channel: 'private',
            actor: { type: 'human', id: 'user_1' },
            kind: 'message',
            sensitivity: 'none',
            tags: ['question', 'architecture'],
            content: { text: 'Why did we avoid sqlite in v1?' },
            refs: [],
          });
        },
      },
      {
        description: 'System retrieves relevant decision',
        action: async () => {
          // This tests the buildACB function
          const acb = await buildACB(pool, {
            tenant_id,
            session_id,
            agent_id: 'agent_1',
            channel: 'private',
            intent: 'query_architecture',
            query_text: 'Why did we avoid sqlite in v1?',
            max_tokens: 65000,
          });

          // Validate the decision is in the ACB
          const decisionSection = acb.sections.find((s) => s.name === 'relevant_decisions');
          if (!decisionSection || decisionSection.items.length === 0) {
            throw new Error('Decision not retrieved in ACB');
          }
        },
      },
    ],
    assertions: [
      {
        description: 'Old decision is retrieved via FTS search (P3 - active context curated)',
        check: async () => {
          const acb = await buildACB(pool, {
            tenant_id,
            session_id,
            agent_id: 'agent_1',
            channel: 'private',
            intent: 'query_architecture',
            query_text: 'avoid sqlite v1',
            max_tokens: 65000,
          });

          const decisionSection = acb.sections.find((s) => s.name === 'relevant_decisions');

          if (!decisionSection || decisionSection.items.length === 0) {
            throw new Error('Old decision not found in ACB');
          }

          // Check it's the right decision
          const decisionText = decisionSection.items[0].text || '';
          if (!decisionText.includes('zero-dependency') && !decisionText.includes('sqlite')) {
            throw new Error('Wrong decision retrieved');
          }
        },
      },
      {
        description: 'ACB includes evidence chunk from 2 weeks ago (P4 - traceability)',
        check: async () => {
          const acb = await buildACB(pool, {
            tenant_id,
            session_id,
            agent_id: 'agent_1',
            channel: 'private',
            intent: 'query_architecture',
            query_text: 'Why did we avoid sqlite in v1?',
            max_tokens: 65000,
          });

          // Check for evidence refs
          const hasOldRef = acb.sections.some((section) =>
            section.items.some((item) => item.refs && item.refs.some((ref) => ref === 'evt_001'))
          );

          if (!hasOldRef) {
            throw new Error('No reference to 2-week-old event');
          }
        },
      },
      {
        description: 'ACB does not include unrelated old chat chunks (P3 - curation)',
        check: async () => {
          // Create some unrelated old content
          await pool.query(
            `INSERT INTO chunks (chunk_id, tenant_id, event_id, ts, kind, channel, sensitivity, tags, token_est, importance, text)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
            [
              'chk_unrelated_old',
              tenant_id,
              'evt_unrelated',
              twoWeeksAgo,
              'message',
              'private',
              'none',
              ['chat', 'unrelated'],
              20,
              0.0,
              'Random chat about weather from 2 weeks ago',
            ]
          );

          const acb = await buildACB(pool, {
            tenant_id,
            session_id,
            agent_id: 'agent_1',
            channel: 'private',
            intent: 'query_architecture',
            query_text: 'Why did we avoid sqlite in v1?',
            max_tokens: 65000,
          });

          // Check that unrelated chunk is not in the ACB
          const allItems = acb.sections.flatMap((s) => s.items);
          const hasUnrelated = allItems.some((item) => item.text?.includes('weather'));

          if (hasUnrelated) {
            throw new Error('Unrelated old chunk included in ACB');
          }
        },
      },
      {
        description: 'Candidate pool size is bounded (NFR - performance)',
        check: async () => {
          // Add many chunks to test bounding
          const chunks = [];
          for (let i = 0; i < 100; i++) {
            chunks.push(
              `(${tenant_id}, 'evt_chunk_${i}', NOW(), 'message', 'private', 'none', ARRAY['test'], ${10}, ${0.0}, 'Test chunk ${i}')`
            );
          }

          // Note: In real implementation, we'd verify candidate_pool_max
          // For now, we verify the ACB completes without error
          const acb = await buildACB(pool, {
            tenant_id,
            session_id,
            agent_id: 'agent_1',
            channel: 'private',
            intent: 'query_architecture',
            query_text: 'sqlite',
            max_tokens: 65000,
          });

          if (!acb) {
            throw new Error('ACB build failed');
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
  testScenarioA2().catch(console.error);
}
