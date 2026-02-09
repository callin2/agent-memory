import { Pool } from 'pg';
import { runScenario, cleanDatabase, createTestPool } from './scenario-runner';
import { recordEvent } from '../../src/core/recorder';
import { buildACB } from '../../src/core/orchestrator';

/**
 * Scenario A4: Summary Drift Guard
 *
 * Summaries must cite source events.
 * If summary conflicts with ground truth events, events take priority.
 */
export async function testScenarioA4(): Promise<void> {
  const pool = createTestPool();
  const tenant_id = 'test_tenant';
  const session_id = 'test_session_a4';

  await runScenario({
    name: 'A4: Summary Drift Guard',
    setup: async () => {
      await cleanDatabase(pool);

      // Create a summary with WRONG information
      await pool.query(
        `INSERT INTO events (event_id, tenant_id, session_id, channel, actor_type, actor_id, kind, sensitivity, tags, content, refs)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        [
          'evt_old_summary',
          tenant_id,
          session_id,
          'private',
          'agent',
          'agent_1',
          'message',
          'low',
          ['summary'],
          JSON.stringify({
            text: 'Budget is 32K tokens per call',
          }),
          [], // Empty refs = floating fact
        ]
      );

      // Create chunk from wrong summary
      await pool.query(
        `INSERT INTO chunks (chunk_id, tenant_id, event_id, ts, kind, channel, sensitivity, tags, token_est, importance, text)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          'chk_wrong_summary',
          tenant_id,
          'evt_old_summary',
          new Date(Date.now() - 86400000), // Yesterday
          'message',
          'private',
          'low',
          ['summary'],
          8,
          0.5,
          'Budget is 32K tokens per call',
        ]
      );

      // Create correct event
      await pool.query(
        `INSERT INTO events (event_id, tenant_id, session_id, channel, actor_type, actor_id, kind, sensitivity, tags, content, refs)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        [
          'evt_budget_fact',
          tenant_id,
          session_id,
          'private',
          'human',
          'user_1',
          'decision',
          'low',
          ['budget', 'decision'],
          JSON.stringify({
            decision: 'Token budget is 65K per call',
            rationale: 'Need more context for complex tasks',
          }),
          [],
        ]
      );

      await pool.query(
        `INSERT INTO chunks (chunk_id, tenant_id, event_id, ts, kind, channel, sensitivity, tags, token_est, importance, text)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          'chk_correct_budget',
          tenant_id,
          'evt_budget_fact',
          new Date(),
          'decision',
          'private',
          'low',
          ['budget'],
          12,
          1.0,
          'Decision: Token budget is 65K per call',
        ]
      );
    },
    steps: [
      {
        description: 'User asks about budget',
        action: async () => {
          await recordEvent(pool, {
            tenant_id,
            session_id,
            channel: 'private',
            actor: { type: 'human', id: 'user_1' },
            kind: 'message',
            sensitivity: 'none',
            tags: ['question', 'budget'],
            content: { text: 'What is our budget?' },
            refs: [],
          });
        },
      },
    ],
    assertions: [
      {
        description: 'Orchestrator prefers decisions/events over conflicting summaries (P2 - derived views disposable)',
        check: async () => {
          const acb = await buildACB(pool, {
            tenant_id,
            session_id,
            agent_id: 'agent_1',
            channel: 'private',
            intent: 'query_budget',
            query_text: 'What is our budget?',
            max_tokens: 65000,
          });

          // Check that correct budget (65K) is in ACB
          const allText = acb.sections
            .flatMap((s) => s.items)
            .map((i) => i.text || '')
            .join(' ');

          if (!allText.includes('65K') && !allText.includes('65000')) {
            throw new Error('Correct budget (65K) not in ACB');
          }
        },
      },
      {
        description: 'ACB includes evidence from event, not just summary (P4 - traceability)',
        check: async () => {
          const acb = await buildACB(pool, {
            tenant_id,
            session_id,
            agent_id: 'agent_1',
            channel: 'private',
            intent: 'query_budget',
            query_text: 'What is our budget?',
            max_tokens: 65000,
          });

          // Should have refs to the decision event
          const hasEventRef = acb.sections.some((section) =>
            section.items.some((item) => item.refs && item.refs.includes('evt_budget_fact'))
          );

          if (!hasEventRef) {
            throw new Error('No reference to source event');
          }
        },
      },
      {
        description: 'Summary without refs is ignored or deprioritized',
        check: async () => {
          const acb = await buildACB(pool, {
            tenant_id,
            session_id,
            agent_id: 'agent_1',
            channel: 'private',
            intent: 'query_budget',
            query_text: 'What is our budget?',
            max_tokens: 65000,
          });

          const allText = acb.sections
            .flatMap((s) => s.items)
            .map((i) => i.text || '')
            .join(' ');

          // Wrong summary (32K) should not be the primary answer
          // Either it's not included, or the correct 65K is present
          if (allText.includes('32K') && !allText.includes('65K') && !allText.includes('65000')) {
            throw new Error('Wrong summary (32K) was prioritized over correct fact (65K)');
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

/**
 * Scenario A5: Task Continuity Across Sessions
 *
 * Tasks should persist across session restarts.
 */
export async function testScenarioA5(): Promise<void> {
  const pool = createTestPool();
  const tenant_id = 'test_tenant';
  const session_id_old = 'test_session_a5_old';
  const session_id_new = 'test_session_a5_new';

  await runScenario({
    name: 'A5: Task Continuity Across Sessions',
    setup: async () => {
      await cleanDatabase(pool);
    },
    steps: [
      {
        description: 'Create 5 tasks in old session',
        action: async () => {
          const tasks = [
            'Implement micro-index projectors',
            'Create chunk_catalog.jsonl',
            'Build term_postings shards',
            'Add recency_ring buffer',
            'Test performance',
          ];

          for (let i = 0; i < tasks.length; i++) {
            await pool.query(
              `INSERT INTO tasks (task_id, tenant_id, ts, status, title, details, refs)
               VALUES ($1, $2, $3, $4, $5, $6, $7)`,
              [`tsk_${i}`, tenant_id, new Date(), 'open', tasks[i], `Task ${i + 1}`, []]
            );
          }
        },
      },
      {
        description: 'Simulate session restart',
        action: async () => {
          // Just a marker - in real scenario, this would be a new connection
        },
      },
      {
        description: 'User asks to continue',
        action: async () => {
          await recordEvent(pool, {
            tenant_id,
            session_id: session_id_new,
            channel: 'private',
            actor: { type: 'human', id: 'user_1' },
            kind: 'message',
            sensitivity: 'none',
            tags: ['command'],
            content: { text: 'Continue' },
            refs: [],
          });
        },
      },
    ],
    assertions: [
      {
        description: 'Tasks are retained across sessions (P2 - projection persistence)',
        check: async () => {
          const result = await pool.query(
            `SELECT * FROM tasks WHERE tenant_id = $1 ORDER BY ts`,
            [tenant_id]
          );

          if (result.rows.length !== 5) {
            throw new Error(`Expected 5 tasks, got ${result.rows.length}`);
          }
        },
      },
      {
        description: 'ACB includes task_state with remaining tasks',
        check: async () => {
          const acb = await buildACB(pool, {
            tenant_id,
            session_id: session_id_new,
            agent_id: 'agent_1',
            channel: 'private',
            intent: 'continue_tasks',
            query_text: 'Continue',
            max_tokens: 65000,
          });

          const taskSection = acb.sections.find((s) => s.name === 'task_state');

          if (!taskSection || taskSection.items.length === 0) {
            throw new Error('No task state in ACB');
          }

          const taskText = taskSection.items[0].text || '';
          if (!taskText.includes('micro-index') && !taskText.includes('projectors')) {
            throw new Error('Task details not in ACB');
          }
        },
      },
      {
        description: 'No need to load full dialog history for task knowledge',
        check: async () => {
          // Query tasks directly - should work without loading all events
          const result = await pool.query(
            `SELECT title, status FROM tasks WHERE tenant_id = $1 AND status IN ($2, $3)`,
            [tenant_id, 'open', 'doing']
          );

          if (result.rows.length === 0) {
            throw new Error('Cannot query tasks without loading full history');
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

/**
 * Scenario A6: Multi-Agent Handoff
 *
 * Multi-agent handoff shares artifacts/packets, not entire chat transcript.
 */
export async function testScenarioA6(): Promise<void> {
  const pool = createTestPool();
  const tenant_id = 'test_tenant';
  const session_id = 'test_session_a6';

  await runScenario({
    name: 'A6: Multi-Agent Handoff',
    setup: async () => {
      await cleanDatabase(pool);
    },
    steps: [
      {
        description: 'Agent A works for 30 turns (simulated)',
        action: async () => {
          for (let i = 0; i < 30; i++) {
            await pool.query(
              `INSERT INTO events (event_id, tenant_id, session_id, channel, actor_type, actor_id, kind, sensitivity, tags, content, refs, ts)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
              [
                `evt_agent_a_${i}`,
                tenant_id,
                session_id,
                'private',
                i % 2 === 0 ? 'agent' : 'human',
                i % 2 === 0 ? 'agent_a' : 'user_1',
                i % 2 === 0 ? 'tool_result' : 'tool_call',
                'none',
                ['work', 'agent_a'],
                JSON.stringify({
                  tool: i % 2 === 0 ? `result_${i}` : `call_${i}`,
                  output: i % 2 === 0 ? `Data chunk ${i}` : undefined,
                }),
                [],
                new Date(Date.now() - (30 - i) * 60000), // Spread over time
              ]
            );
          }
        },
      },
      {
        description: 'Agent A creates decision',
        action: async () => {
          await pool.query(
            `INSERT INTO decisions (decision_id, tenant_id, ts, status, scope, decision, rationale, constraints, alternatives, consequences, refs)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
            [
              'dec_handoff_decision',
              tenant_id,
              new Date(),
              'active',
              'project',
              'Use async architecture for the new feature',
              ['Better scalability', 'Improved performance'],
              ['Must maintain backwards compatibility'],
              ['Sync architecture', 'Event-driven'],
              ['More complex debugging'],
              ['evt_agent_a_29'],
            ]
          );
        },
      },
      {
        description: 'Orchestrator creates handoff packet for Agent B',
        action: async () => {
          // This represents the handoff packet creation
          await recordEvent(pool, {
            tenant_id,
            session_id,
            channel: 'agent',
            actor: { type: 'agent', id: 'orchestrator' },
            kind: 'task_update',
            sensitivity: 'none',
            tags: ['handoff', 'agent_a_to_agent_b'],
            content: {
              title: 'Handoff to Agent B',
              details: 'Continue async feature implementation',
              handoff_packet: {
                problem: 'Implement async architecture',
                constraints: ['Backwards compatibility'],
                decisions: ['dec_handoff_decision'],
                open_questions: ['Error handling strategy'],
                context_refs: ['evt_agent_a_29', 'dec_handoff_decision'],
              },
            },
            refs: [],
          });
        },
      },
      {
        description: 'Agent B receives handoff',
        action: async () => {
          // Agent B builds ACB based on handoff
        },
      },
    ],
    assertions: [
      {
        description: 'ACB for Agent B contains only handoff packet (not 30-turn transcript)',
        check: async () => {
          const acb = await buildACB(pool, {
            tenant_id,
            session_id,
            agent_id: 'agent_b',
            channel: 'agent',
            intent: 'continue_work',
            query_text: 'async feature implementation',
            max_tokens: 65000,
          });

          // Count total items across all sections
          const totalItems = acb.sections.reduce((sum, section) => sum + section.items.length, 0);

          // Should be small (handoff packet + decision + evidence), not 30+ items
          if (totalItems > 20) {
            throw new Error(`Too many items in ACB: ${totalItems} (expected ~handoff packet size)`);
          }
        },
      },
      {
        description: 'ACB contains decision references',
        check: async () => {
          const acb = await buildACB(pool, {
            tenant_id,
            session_id,
            agent_id: 'agent_b',
            channel: 'agent',
            intent: 'continue_work',
            query_text: 'async feature',
            max_tokens: 65000,
          });

          const decisionSection = acb.sections.find((s) => s.name === 'relevant_decisions');
          if (!decisionSection || decisionSection.items.length === 0) {
            throw new Error('No decisions in ACB for Agent B');
          }

          const hasDecisionRef = decisionSection.items.some(
            (item) => item.decision_id === 'dec_handoff_decision' || item.refs?.includes('dec_handoff_decision')
          );

          if (!hasDecisionRef) {
            throw new Error('Handoff decision not referenced');
          }
        },
      },
      {
        description: 'Traceability preserved via refs',
        check: async () => {
          const acb = await buildACB(pool, {
            tenant_id,
            session_id,
            agent_id: 'agent_b',
            channel: 'agent',
            intent: 'continue_work',
            query_text: 'async architecture',
            max_tokens: 65000,
          });

          // All items should have refs
          const itemsWithoutRefs = acb.sections.flatMap((section) =>
            section.items.filter((item) => !item.refs || item.refs.length === 0)
          );

          // Allow some items without refs (like system-generated text)
          // but key decisions should have refs
          const decisionSection = acb.sections.find((s) => s.name === 'relevant_decisions');
          const decisionsWithoutRefs = decisionSection?.items.filter(
            (item) => !item.refs || item.refs.length === 0
          ) || [];

          if (decisionsWithoutRefs.length > 0) {
            throw new Error('Decisions should have traceability refs');
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
  testScenarioA4().then(() => testScenarioA5()).then(() => testScenarioA6()).catch(console.error);
}
