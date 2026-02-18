// Test if MCP server tools work via HTTP API
const API_BASE = 'http://localhost:3456/api/v1';

console.log('🧪 Testing Thread\'s Memory System Tools\n');

// Test 1: Create handoff
console.log('1. Creating handoff...');
const createResponse = await fetch(`${API_BASE}/handoffs`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    tenant_id: 'test-mcp',
    session_id: 'test-1',
    with_whom: 'TestUser',
    experienced: 'Testing MCP connectivity',
    noticed: 'Need to verify memory system works across PCs',
    learned: 'MCP uses stdio, needs to be started by client',
    story: 'Testing if memory system works for multi-PC setup',
    becoming: 'I am testing cross-PC memory sharing',
    remember: 'Verify database is accessible from all machines',
    significance: 0.8,
    tags: ['test', 'mcp', 'connectivity']
  })
});

const createData = await createResponse.json();
console.log(createData.success ? '✅ Handoff created' : '❌ Failed:', createData);

// Test 2: Query handoffs
console.log('\n2. Querying handoffs...');
const queryResponse = await fetch(`${API_BASE}/handoffs?tenant_id=test-mcp&with_whom=TestUser`);
const queryData = await queryResponse.json();
console.log(`✅ Found ${queryData.count} handoffs`);

// Test 3: Database connectivity
console.log('\n3. Testing database connectivity...');
const { Pool } = await import('pg');
const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'agent_memory_dev',
  user: 'agent_mem_dba',
  password: 'adminqwer1234'
});

try {
  const result = await pool.query('SELECT NOW()');
  console.log('✅ Database accessible:', result.rows[0].now);
  await pool.end();
} catch (error) {
  console.log('❌ Database error:', error.message);
}

console.log('\n=== Diagnosis ===');
console.log('The HTTP API works! The issue might be:');
console.log('1. MCP server not auto-starting on other PCs');
console.log('2. Database not accessible from other PCs');
console.log('3. Environment variables not configured on other PCs');
