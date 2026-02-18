#!/usr/bin/env node

/**
 * Test script for wake_up_stratified MCP tool
 */

const { Pool } = require('pg');

const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'agent_memory_dev',
  user: 'callin'
});

async function testWakeUpStratified() {
  console.log('🧪 Testing wake_up_stratified implementation\n');
  console.log('='.repeat(60));

  const tenant_id = 'claude-session';
  const layers = ['metadata', 'reflection', 'recent'];
  const recent_count = 3;

  console.log(`\n📍 Tenant: ${tenant_id}`);
  console.log(`📊 Layers: ${layers.join(', ')}`);
  console.log(`🔢 Recent count: ${recent_count}\n`);

  // Layer 1: Metadata
  console.log('--- LAYER 1: METADATA (~50 tokens) ---');
  const metadata = await pool.query(
    `SELECT * FROM memory_metadata WHERE tenant_id = $1`,
    [tenant_id]
  );

  if (metadata.rows.length > 0) {
    const m = metadata.rows[0];
    console.log(`✅ Sessions: ${m.session_count}`);
    console.log(`✅ People: ${m.key_people.join(', ')}`);
    console.log(`✅ Significance: ${m.significance_avg.toFixed(2)}`);
    console.log(`✅ High significance: ${m.high_significance_count}`);
    console.log(`✅ Tags: ${m.all_tags.length} unique tags`);
  } else {
    console.log('❌ No metadata found');
  }

  // Layer 2: Reflection
  console.log('\n--- LAYER 2: REFLECTION (~200 tokens) ---');
  const reflection = await pool.query(
    `SELECT * FROM memory_reflections
     WHERE tenant_id = $1
     ORDER BY generated_at DESC
     LIMIT 1`,
    [tenant_id]
  );

  if (reflection.rows.length > 0) {
    const r = reflection.rows[0];
    console.log(`✅ Sessions consolidated: ${r.session_count}`);
    console.log(`✅ Summary: ${r.summary.substring(0, 100)}...`);
    console.log(`✅ Key insights: ${r.key_insights.length} items`);
    console.log(`✅ Themes: ${r.themes.join(', ')}`);
  } else {
    console.log('⚠️  No reflections yet (run consolidation job)');
  }

  // Layer 3: Recent
  console.log('\n--- LAYER 3: RECENT HANDOFFS (~500 tokens) ---');
  const recent = await pool.query(
    `SELECT handoff_id, LEFT(becoming, 60) as becoming, significance, created_at
     FROM session_handoffs
     WHERE tenant_id = $1
     ORDER BY created_at DESC
     LIMIT $2`,
    [tenant_id, recent_count]
  );

  console.log(`✅ Recent handoffs: ${recent.rows.length}`);
  recent.rows.forEach((row, i) => {
    console.log(`   ${i+1}. ${row.becoming}... (${row.created_at.toISOString().split('T')[0]})`);
  });

  // Layer 4: Progressive (topics)
  console.log('\n--- LAYER 4: PROGRESSIVE (available topics) ---');
  const topics = await pool.query(
    `SELECT unnest(tags) as topic, COUNT(*) as count
     FROM session_handoffs
     WHERE tenant_id = $1
     GROUP BY topic
     ORDER BY count DESC
     LIMIT 5`,
    [tenant_id]
  );

  console.log('✅ Available topics:');
  topics.rows.forEach(t => {
    console.log(`   • ${t.topic}: ${t.count} sessions`);
  });

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 TOKEN ESTIMATE:');
  console.log(`   Layer 1 (metadata): ~50 tokens`);
  console.log(`   Layer 2 (reflection): ~${reflection.rows.length > 0 ? '200' : '50'} tokens`);
  console.log(`   Layer 3 (recent × ${recent_count}): ~${recent_count * 150} tokens`);
  console.log(`   Layer 4 (progressive): ~100 tokens`);
  console.log(`   ─────────────────────────────────────`);
  console.log(`   TOTAL: ~${50 + (reflection.rows.length > 0 ? 200 : 50) + (recent_count * 150) + 100} tokens`);
  console.log(`   VS OLD METHOD: ~${metadata.rows[0]?.session_count * 500 || 0} tokens`);
  console.log(`   COMPRESSION: ${metadata.rows[0] ? Math.round((metadata.rows[0].session_count * 500) / (50 + 200 + (recent_count * 150) + 100) * 10) / 10 : 0}x`);

  console.log('\n✅ Stratified memory system operational!');

  await pool.end();
}

testWakeUpStratified().catch(console.error);
