// Test handoff creation and retrieval
const BASE = 'http://localhost:3456/api/v1';
const TENANT = 'multi-agent-demo';

// 1. Create tenant
console.log('1. Creating tenant...');
const tenantRes = await fetch(`${BASE}/tenants`, {
  method: 'POST',
  headers: {'Content-Type': 'application/json'},
  body: JSON.stringify({ id: TENANT, name: 'Multi-Agent Demo' })
});
const tenant = await tenantRes.json();
console.log('   Tenant:', tenant);

// 2. Create a handoff
console.log('\n2. Creating handoff...');
const handoffRes = await fetch(`${BASE}/handoff`, {
  method: 'POST',
  headers: {'Content-Type': 'application/json'},
  body: JSON.stringify({
    tenant_id: TENANT,
    session_id: 'test-001',
    with_whom: 'Test',
    experienced: 'Testing',
    noticed: 'Testing',
    learned: 'Testing',
    story: 'Testing',
    becoming: 'I am testing',
    remember: 'Test',
    significance: 0.5,
    tags: []
  })
});
const handoff = await handoffRes.json();
console.log('   Handoff created:', JSON.stringify(handoff, null, 2));

// 3. Fetch handoffs
console.log('\n3. Fetching handoffs...');
const getRes = await fetch(`${BASE}/handoffs?tenant_id=${TENANT}&limit=100`);
const data = await getRes.json();
console.log('   Response:', JSON.stringify(data, null, 2));

// 4. Check database directly
console.log('\n4. Checking database...');
const { execSync } = await import('child_process');
try {
  const result = execSync(`psql postgresql://agent_mem_dba:adminqwer1234@localhost:5432/agent_memory_dev -c "SELECT handoff_id, tenant_id, with_whom FROM session_handoffs WHERE tenant_id = '${TENANT}' LIMIT 5;"`, { encoding: 'utf8' });
  console.log(result);
} catch (err) {
  console.error('DB Error:', err.message);
}
