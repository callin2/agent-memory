#!/usr/bin/env node
/**
 * Example: Wake Up with Context
 *
 * This example shows how to wake up with your previous context
 * using the wake-up API.
 */

import { Pool } from 'pg';

const pool = new Pool({
  host: process.env.PGHOST || 'localhost',
  port: Number(process.env.PGPORT) || 5432,
  database: process.env.PGDATABASE || 'agent_memory',
  user: process.env.PGUSER || 'postgres',
  password: process.env.PGPASSWORD || '',
});

async function wakeUp() {
  const tenant_id = process.env.TENANT_ID || 'default';
  const with_whom = process.env.WITH_WHOM || 'Callin';

  console.log(`\n🌅 Waking up...`);
  console.log(`Tenant: ${tenant_id}`);
  console.log(`With: ${with_whom}\n`);

  // Get most recent handoff
  const handoffResult = await pool.query(
    `SELECT * FROM session_handoffs
     WHERE tenant_id = $1 AND with_whom = $2
     ORDER BY created_at DESC
     LIMIT 1`,
    [tenant_id, with_whom]
  );

  if (handoffResult.rows.length === 0) {
    console.log('No previous handoff found. Starting fresh!\n');
    await pool.end();
    return;
  }

  const handoff = handoffResult.rows[0];
  const daysSince = Math.floor(
    (Date.now() - new Date(handoff.created_at).getTime()) / (1000 * 60 * 60 * 24)
  );

  console.log(`Last session: ${new Date(handoff.created_at).toLocaleString()}`);
  console.log(`(${daysSince === 0 ? 'today' : daysSince === 1 ? 'yesterday' : `${daysSince} days ago`})\n`);

  console.log('📝 What happened:');
  console.log(`   ${handoff.experienced}\n`);

  console.log('👀 What you noticed:');
  console.log(`   ${handoff.noticed}\n`);

  console.log('🧠 What you learned:');
  console.log(`   ${handoff.learned}\n`);

  if (handoff.story) {
    console.log('📖 The story:');
    console.log(`   ${handoff.story}\n`);
  }

  console.log('✨ Who you were becoming:');
  console.log(`   ${handoff.becoming}\n`);

  console.log('💡 What to remember:');
  console.log(`   ${handoff.remember}\n`);

  // Get identity thread (last 10 becoming statements)
  const identityResult = await pool.query(
    `SELECT becoming, created_at
     FROM session_handoffs
     WHERE tenant_id = $1 AND with_whom = $2 AND becoming IS NOT NULL
     ORDER BY created_at DESC
     LIMIT 10`,
    [tenant_id, with_whom]
  );

  if (identityResult.rows.length > 1) {
    console.log('🧵 Your identity thread:');
    identityResult.rows.forEach((row, i) => {
      const date = new Date(row.created_at).toLocaleDateString();
      console.log(`   ${i + 1}. [${date}] ${row.becoming}`);
    });
    console.log('');
  }

  console.log('✅ You are awake and ready to continue!\n');

  await pool.end();
}

wakeUp().catch(console.error);
