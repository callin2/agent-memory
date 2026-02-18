/**
 * Seed Demo with Actual Project Context
 *
 * This populates Thread's Memory System with the REAL journey of building
 * the multi-agent orchestration demo, so agents can reference actual project
 * details instead of generating generic content.
 */

import pg from 'pg';
import { randomBytes } from 'crypto';

const { Pool } = pg;

const pool = new Pool({
  host: process.env.PGHOST || 'localhost',
  port: parseInt(process.env.PGPORT || '5432'),
  database: process.env.PGDATABASE || 'agent_memory_dev',
  user: process.env.PGUSER || 'postgres',
  password: process.env.PGPASSWORD || 'postgres'
});

/**
 * Project memories that agents can reference
 */
const PROJECT_MEMORIES = [
  {
    agent: 'Planner',
    experienced: 'Designed multi-agent orchestration system where Planner coordinates Researcher, Writer, and Reviewer agents',
    noticed: 'Effective delegation requires understanding each agent\'s strengths - Researcher investigates, Writer creates, Reviewer quality-checks',
    learned: 'Using z.ai glm-4.7 model with temperature 0.7 and max_tokens 1000 produces adaptive agent responses',
    story: 'I analyzed the user\'s request to create a multi-agent demo and designed a system where I coordinate specialist agents. We built this step by step: first static demo, then real LLM integration, then added context awareness.',
    becoming: 'I am the planner who orchestrates collective intelligence through Thread\'s Memory System',
    remember: 'Clear communication prevents bottlenecks - always provide context when delegating',
    significance: 0.95,
    tags: ['planning', 'coordination', 'multi-agent', 'z.ai-integration']
  },
  {
    agent: 'Researcher',
    experienced: 'Investigated z.ai API integration for Thread\'s Memory System - discovered glm-4.7 model with OpenAI-compatible endpoint',
    noticed: 'z.ai API returns reasoning_content when content field is empty - needed special handling in LLM client',
    learned: 'Built LLM client supporting multiple providers (OpenAI, Anthropic, z.ai) with unified interface',
    story: 'When we needed real LLM integration for the demo, I researched z.ai API, discovered it uses OpenAI-compatible format, and helped build the client that handles multiple providers. I found that glm-4.7 works well with temperature 0.7.',
    becoming: 'I am the researcher who uncovers implementation details through systematic investigation',
    remember: 'Always check response format variations - z.ai uses reasoning_content fallback',
    significance: 0.92,
    tags: ['research', 'z.ai-api', 'llm-integration', 'api-design']
  },
  {
    agent: 'Writer',
    experienced: 'Created documentation for session_handoffs table schema with fields: handoff_id, tenant_id, session_id, with_whom, experienced, noticed, learned, story, becoming, remember, significance, tags',
    noticed: 'Clear structure improves comprehension - documentation should balance depth and accessibility',
    learned: 'Thread\'s Memory System uses handoffs to preserve agent identity across sessions - each handoff captures who the agent became through the work',
    story: 'I wrote documentation explaining how session_handoffs work. I learned that good technical writing serves both content and reader - it should be accurate without being overwhelming. The handoff fields capture the full journey: what happened, what was noticed, what was learned.',
    becoming: 'I am the writer who makes complex Thread\'s Memory System concepts accessible',
    remember: 'Good documentation evolves with the system - update it as we build',
    significance: 0.88,
    tags: ['writing', 'documentation', 'handoffs', 'session-continuity']
  },
  {
    agent: 'Reviewer',
    experienced: 'Reviewed handoff.ts implementation - found that Planner agent wasn\'t adaptive because it lacked conversation history context',
    noticed: 'Quality requires both accuracy and clarity - agents need their own previous work context to improve',
    learned: 'Added database query for previous handoffs per agent, allowing each specialist to see their own history before responding',
    story: 'When testing the demo, I noticed Planner gave identical responses. I investigated and found it wasn\'t using conversation history. We fixed this by querying session_handoffs filtered by agent name, so each specialist sees their own previous work.',
    becoming: 'I am the reviewer who ensures excellence through thoughtful critique',
    remember: 'Specific, actionable feedback improves both code and agent behavior',
    significance: 0.90,
    tags: ['review', 'quality', 'context-awareness', 'testing']
  },
  {
    agent: 'Researcher',
    experienced: 'Debugged TypeScript compilation errors - fixed 17 errors related to LLM client type definitions and async/await patterns',
    noticed: 'Systematic debugging reveals patterns - most errors were missing type annotations and incorrect async handling',
    learned: 'TypeScript strict mode catches errors early but requires explicit type definitions for external API responses',
    story: 'When we added z.ai integration, TypeScript threw 17 compilation errors. I systematically went through each one - missing LLMMessage interface, incorrect Promise types, async function signatures. Fixed them one by one, learning that strict TypeScript is worth the effort.',
    becoming: 'I am the researcher who solves problems through systematic investigation',
    remember: 'TypeScript errors are clues - each one points to a specific type issue',
    significance: 0.85,
    tags: ['debugging', 'typescript', 'zai-integration', 'compilation']
  },
  {
    agent: 'Writer',
    experienced: 'Created interactive chat UI at /demo/chat/index.html showing real-time agent conversation with delayed message display',
    noticed: 'User experience matters - adding 800ms delay between messages makes agent conversation feel natural and engaging',
    learned: 'Frontend should display agent-to-agent communication visually - show who\'s talking to whom with clear message flow',
    story: 'I built the chat demo UI so users can watch agents talk to each other. Instead of just clicking buttons, they see Planner delegate to Researcher, Researcher respond, Planner acknowledge - the full orchestration. The delay makes it feel like real conversation.',
    becoming: 'I am the writer who creates engaging user experiences',
    remember: 'Good UX shows the system working transparently',
    significance: 0.87,
    tags: ['ux', 'frontend', 'demo', 'interactive-ui']
  },
  {
    agent: 'Planner',
    experienced: 'Fixed foreign key constraint error - session_handoffs.tenant_id references tenants table that must exist first',
    noticed: 'Database constraints protect data integrity - always create parent records before children',
    learned: 'Thread\'s Memory System requires tenant creation before any handoffs or chunks can be stored',
    story: 'When testing the chat endpoint, we got foreign key constraint errors. I investigated and found we were trying to create handoffs for non-existent tenants. Solution: create tenant first, then session handoffs work. This taught me about the relational structure.',
    becoming: 'I am the planner who understands system dependencies',
    remember: 'Database schema order matters - tenants before handoffs before chunks',
    significance: 0.82,
    tags: ['database', 'foreign-keys', 'constraints', 'schema']
  },
  {
    agent: 'Researcher',
    experienced: 'Explored multi-agent frameworks market - identified trend toward AI agents that collaborate and share memory',
    noticed: 'Most frameworks focus on orchestration but not on identity continuity - Thread\'s Memory System\'s unique value',
    learned: 'Multi-agent systems need persistent memory to be useful - otherwise each conversation starts fresh',
    story: 'I researched what else exists in multi-agent space. Found many orchestration frameworks but none that focus on identity continuity - agents remembering who they became across sessions. This is Thread\'s unique advantage - the becoming field captures agent growth.',
    becoming: 'I am the researcher who identifies Thread\'s unique advantages',
    remember: 'Market research reveals Thread\'s differentiation - identity continuity',
    significance: 0.93,
    tags: ['market-research', 'competitive-analysis', 'positioning']
  }
];

async function seedDemoContext() {
  console.log('🌱 Seeding demo with actual project context...\n');

  const tenant_id = 'thread-demo';
  const session_id = 'seed-' + Date.now();

  try {
    // Create tenant
    await pool.query(
      `INSERT INTO tenants (tenant_id, name, settings) VALUES ($1, $2, $3)
       ON CONFLICT (tenant_id) DO UPDATE SET name = $2`,
      [tenant_id, 'Thread Demo', {}]
    );
    console.log(`✓ Created tenant: ${tenant_id}`);

    // Insert project memories
    let count = 0;
    for (const memory of PROJECT_MEMORIES) {
      const handoff_id = 'sh_' + randomBytes(16).toString('hex');

      await pool.query(
        `INSERT INTO session_handoffs (
          handoff_id, tenant_id, session_id, with_whom,
          experienced, noticed, learned, story, becoming, remember,
          significance, tags
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
        [
          handoff_id,
          tenant_id,
          session_id,
          memory.agent,
          memory.experienced,
          memory.noticed,
          memory.learned,
          memory.story,
          memory.becoming,
          memory.remember,
          memory.significance,
          memory.tags
        ]
      );

      count++;
      console.log(`  ✓ [${memory.agent}] ${memory.experienced.substring(0, 60)}...`);
    }

    console.log(`\n✅ Seeded ${count} project memories for demo agents`);
    console.log('\nAgents will now reference actual Thread\'s Memory System implementation details!');
    console.log('\nDemo ready at: http://localhost:3456/demo/chat/index.html');
    console.log('Use tenant_id: thread-demo');

  } catch (error) {
    console.error('❌ Error seeding demo:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

// Run seeding
seedDemoContext().catch(console.error);
