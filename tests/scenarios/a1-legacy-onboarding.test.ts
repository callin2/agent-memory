import { Pool } from 'pg';
import { runScenario, cleanDatabase, createTestPool } from './scenario-runner';
import { recordEvent } from '../../src/core/recorder';
import { buildACB } from '../../src/core/orchestrator';

/**
 * Scenario A1: Legacy Project Onboarding
 *
 * User: "what this project for?"
 * Agent must answer while persisting all interactions and curating ACB under 65K tokens
 */
export async function testScenarioA1(): Promise<void> {
  const pool = createTestPool();
  const tenant_id = 'test_tenant';
  const session_id = 'test_session_a1';

  await runScenario({
    name: 'A1: Legacy Project Onboarding',
    setup: async () => {
      await cleanDatabase(pool);
    },
    steps: [
      {
        description: 'User asks about project purpose',
        action: async () => {
          await recordEvent(pool, {
            tenant_id,
            session_id,
            channel: 'private',
            actor: { type: 'human', id: 'user_1' },
            kind: 'message',
            sensitivity: 'none',
            tags: ['topic:onboarding', 'repo:legacy'],
            content: { text: 'what this project for?' },
            refs: [],
          });
        },
      },
      {
        description: 'Agent calls list_root tool',
        action: async () => {
          await recordEvent(pool, {
            tenant_id,
            session_id,
            channel: 'private',
            actor: { type: 'agent', id: 'agent_1' },
            kind: 'tool_call',
            sensitivity: 'none',
            tags: ['tool:fs'],
            content: { tool: 'fs.list_root', path: '/project/root' },
            refs: [],
          });
        },
      },
      {
        description: 'Tool returns file list',
        action: async () => {
          await recordEvent(pool, {
            tenant_id,
            session_id,
            channel: 'private',
            actor: { type: 'tool', id: 'fs' },
            kind: 'tool_result',
            sensitivity: 'none',
            tags: ['tool:fs'],
            content: {
              tool: 'fs.list_root',
              path: '/project/root',
              excerpt_text: 'README.md\npackage.json\nsrc/\ndocker-compose.yml',
            },
            refs: [],
          });
        },
      },
      {
        description: 'Agent reads README',
        action: async () => {
          await recordEvent(pool, {
            tenant_id,
            session_id,
            channel: 'private',
            actor: { type: 'agent', id: 'agent_1' },
            kind: 'tool_call',
            sensitivity: 'none',
            tags: ['tool:fs'],
            content: { tool: 'fs.read_file', path: 'README.md' },
            refs: [],
          });
        },
      },
      {
        description: 'Tool returns README content',
        action: async () => {
          await recordEvent(pool, {
            tenant_id,
            session_id,
            channel: 'private',
            actor: { type: 'tool', id: 'fs' },
            kind: 'tool_result',
            sensitivity: 'none',
            tags: ['tool:fs', 'file:README'],
            content: {
              tool: 'fs.read_file',
              path: 'README.md',
              excerpt_text: '# Agent Memory System\n\nA PostgreSQL-backed daemon service for AI agent persistent memory.\n\n## Features\n\n- Persist almost all dialog + tool I/O\n- Curate small active context (≤65K tokens)\n- Multi-agent support\n- Fast context assembly',
            },
            refs: [],
          });
        },
      },
      {
        description: 'Agent creates decision about project purpose',
        action: async () => {
          await recordEvent(pool, {
            tenant_id,
            session_id,
            channel: 'private',
            actor: { type: 'agent', id: 'agent_1' },
            kind: 'decision',
            sensitivity: 'low',
            tags: ['decision:purpose', 'auto'],
            content: {
              decision: 'This project is an Agent Memory System - a PostgreSQL-backed daemon for AI agent persistent memory',
              rationale: [
                'README identifies it as "PostgreSQL-backed daemon service"',
                'Features include persistent memory, curated context, multi-agent support',
                'Architecture focuses on keeping LLM context small via Active Context Bundles',
              ],
            },
            refs: [],
          });
        },
      },
    ],
    assertions: [
      {
        description: 'All events are persisted (P1 - append-only)',
        check: async () => {
          const result = await pool.query(
            'SELECT COUNT(*) as count FROM events WHERE tenant_id = $1 AND session_id = $2',
            [tenant_id, session_id]
          );
          const count = parseInt(result.rows[0].count);
          if (count !== 6) {
            throw new Error(`Expected 6 events, got ${count}`);
          }
        },
      },
      {
        description: 'Chunks created for text events (P2 - derived views)',
        check: async () => {
          const result = await pool.query(
            'SELECT COUNT(*) as count FROM chunks WHERE tenant_id = $1 AND session_id = $2',
            [tenant_id, session_id]
          );
          const count = parseInt(result.rows[0].count);
          // Should have chunks for message, tool_results, and decision
          if (count < 3) {
            throw new Error(`Expected at least 3 chunks, got ${count}`);
          }
        },
      },
      {
        description: 'ACB is under 65K token budget (P3 - active context curated)',
        check: async () => {
          const acb = await buildACB(pool, {
            tenant_id,
            session_id,
            agent_id: 'agent_1',
            channel: 'private',
            intent: 'repo_onboarding',
            query_text: 'what this project for?',
            max_tokens: 65000,
          });

          if (acb.token_used_est > 65000) {
            throw new Error(`ACB exceeds budget: ${acb.token_used_est} tokens`);
          }

          if (acb.token_used_est === 0) {
            throw new Error('ACB is empty - no context retrieved');
          }
        },
      },
      {
        description: 'Retrieved evidence section is populated',
        check: async () => {
          const acb = await buildACB(pool, {
            tenant_id,
            session_id,
            agent_id: 'agent_1',
            channel: 'private',
            intent: 'repo_onboarding',
            query_text: 'what this project for?',
            max_tokens: 65000,
          });

          const evidenceSection = acb.sections.find((s) => s.name === 'retrieved_evidence');
          if (!evidenceSection || evidenceSection.items.length === 0) {
            throw new Error('No retrieved evidence in ACB');
          }
        },
      },
      {
        description: 'Recent window contains user question',
        check: async () => {
          const acb = await buildACB(pool, {
            tenant_id,
            session_id,
            agent_id: 'agent_1',
            channel: 'private',
            intent: 'repo_onboarding',
            query_text: 'what this project for?',
            max_tokens: 65000,
          });

          const recentSection = acb.sections.find((s) => s.name === 'recent_window');
          const hasQuestion = recentSection?.items.some(
            (item) => item.text?.includes('what this project for?')
          );

          if (!hasQuestion) {
            throw new Error('Recent window does not contain user question');
          }
        },
      },
      {
        description: 'All event IDs are referenced properly (P4 - traceability)',
        check: async () => {
          const result = await pool.query(
            'SELECT refs FROM events WHERE tenant_id = $1 AND session_id = $2',
            [tenant_id, session_id]
          );

          // All events should have refs array (even if empty)
          for (const row of result.rows) {
            if (!Array.isArray(row.refs)) {
              throw new Error('Event missing refs array');
            }
          }
        },
      },
      {
        description: 'Sensitivity filtering works (P5 - least privilege)',
        check: async () => {
          // Query with public channel should not return high sensitivity items
          const acb = await buildACB(pool, {
            tenant_id,
            session_id,
            agent_id: 'agent_1',
            channel: 'public',
            intent: 'repo_onboarding',
            query_text: 'project purpose',
            max_tokens: 65000,
          });

          // Public channel should have fewer items than private
          const acbPrivate = await buildACB(pool, {
            tenant_id,
            session_id,
            agent_id: 'agent_1',
            channel: 'private',
            intent: 'repo_onboarding',
            query_text: 'project purpose',
            max_tokens: 65000,
          });

          if (acb.token_used_est >= acbPrivate.token_used_est) {
            throw new Error('Public channel should filter out more content than private');
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

// Run if executed directly
if (require.main === module) {
  testScenarioA1().catch(console.error);
}
