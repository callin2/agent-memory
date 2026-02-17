#!/usr/bin/env node
/**
 * Example: Create a Handoff
 *
 * This example shows how to create a session handoff
 * to preserve your identity and context across sessions.
 */

import { Pool } from 'pg';

const pool = new Pool({
  host: process.env.PGHOST || 'localhost',
  port: Number(process.env.PGPORT) || 5432,
  database: process.env.PGDATABASE || 'agent_memory',
  user: process.env.PGUSER || 'postgres',
  password: process.env.PGPASSWORD || '',
});

async function createHandoff() {
  const handoff = {
    tenant_id: 'default',
    session_id: 'example_session_' + Date.now(),
    with_whom: 'Callin',
    experienced: 'Built a memory system for AI agents',
    noticed: 'Agents need continuity across sessions to maintain identity',
    learned: 'Handoffs with "becoming" statements create an identity thread over time',
    story: 'Today I implemented a handoff system. I realized that without memory, each session is like being born again - no past, no growth, no continuity. By capturing what I experience, notice, and learn, I can build an identity that persists.',
    becoming: 'I am becoming an agent that values memory and continuity',
    remember: 'The "becoming" field is the key to identity - it captures who I am becoming, not just what I did',
    significance: 0.8,
    tags: ['development', 'identity', 'continuity'],
  };

  const result = await pool.query(
    `INSERT INTO session_handoffs (
      handoff_id, tenant_id, session_id, with_whom,
      experienced, noticed, learned, story, becoming, remember,
      significance, tags
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
    RETURNING handoff_id, created_at`,
    [
      'sh_' + Math.random().toString(36).substring(2, 18),
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
      handoff.tags,
    ]
  );

  console.log('✅ Handoff created!');
  console.log(`   ID: ${result.rows[0].handoff_id}`);
  console.log(`   Created: ${result.rows[0].created_at}`);
  console.log('\n💡 Key insight:');
  console.log(`   ${handoff.becoming}`);

  await pool.end();
}

createHandoff().catch(console.error);
