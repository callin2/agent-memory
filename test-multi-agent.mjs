#!/usr/bin/env node

/**
 * Test script for multi-agent demo
 * Verifies that multiple agents can share memory and build collective identity
 */

async function test() {
  const BASE = 'http://localhost:3456/api/v1';
  const TENANT = 'multi-agent-demo';

  console.log('🧪 Testing Multi-Agent Demo\n');

  // 1. Create tenant
  console.log('1. Creating demo tenant...');
  await fetch(`${BASE}/tenants`, {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({id: TENANT})
  });
  console.log('   ✓ Tenant created\n');

  // 2. Create handoffs for all three agents
  console.log('2. Creating agent handoffs...');

  const researcher = await fetch(`${BASE}/handoff`, {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({
      tenant_id: TENANT,
      session_id: 'test-researcher-001',
      with_whom: 'Researcher',
      experienced: 'Tested multi-agent collaboration system',
      noticed: 'All agents share the same tenant_id',
      learned: 'Identity threads work across multiple agents',
      story: 'Set up the demo and verified that agents can build collective identity',
      becoming: 'I am the researcher who proves multi-agent memory works',
      remember: 'Multi-agent systems need shared identity',
      significance: 0.9,
      tags: ['test', 'multi-agent']
    })
  });
  console.log('   ✓ Researcher handoff created');

  const writer = await fetch(`${BASE}/handoff`, {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({
      tenant_id: TENANT,
      session_id: 'test-writer-001',
      with_whom: 'Writer',
      experienced: 'Wrote documentation for multi-agent demo',
      noticed: 'Clear explanations help users understand the system',
      learned: 'Visual demos are powerful for showing capabilities',
      story: 'Created documentation showing how multiple agents collaborate',
      becoming: 'I am the writer who makes complex systems understandable',
      remember: 'Good docs = adoption',
      significance: 0.85,
      tags: ['test', 'writing']
    })
  });
  console.log('   ✓ Writer handoff created');

  const reviewer = await fetch(`${BASE}/handoff`, {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({
      tenant_id: TENANT,
      session_id: 'test-reviewer-001',
      with_whom: 'Reviewer',
      experienced: 'Reviewed the multi-agent demo implementation',
      noticed: 'The demo clearly shows collaborative identity building',
      learned: 'Shared memory enables true multi-agent collaboration',
      story: 'Verified that all agents can access and build upon shared identity thread',
      becoming: 'I am the reviewer who ensures quality across all agents',
      remember: 'Quality matters in multi-agent systems',
      significance: 0.88,
      tags: ['test', 'review']
    })
  });
  console.log('   ✓ Reviewer handoff created\n');

  // 3. Get collective identity thread
  console.log('3. Fetching collective identity thread...');
  const threadRes = await fetch(`${BASE}/handoffs?tenant_id=${TENANT}&limit=100`);
  const data = await threadRes.json();
  const thread = data.handoffs || [];

  console.log(`   Found ${thread.length} handoffs\n`);

  // 4. Display collective identity
  console.log('🧵 Collective Identity Thread:\n');
  thread.forEach(h => {
    const time = new Date(h.timestamp).toLocaleTimeString();
    console.log(`   [${time}] ${h.with_whom}:`);
    console.log(`   "${h.becoming}"\n`);
  });

  // 5. Verify all agents are present
  const agents = new Set(thread.thread.map(h => h.with_whom));
  console.log('✓ Agents in collective memory:', Array.from(agents).join(', '));

  if (agents.has('Researcher') && agents.has('Writer') && agents.has('Reviewer')) {
    console.log('\n✅ SUCCESS: Multi-agent memory system working!');
    console.log('   All three agents can share and build collective identity.');
  } else {
    console.log('\n❌ FAILED: Not all agents found in thread');
  }
}

test().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
