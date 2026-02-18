const response = await fetch('http://localhost:3456/api/v1/handoff', {
  method: 'POST',
  headers: {'Content-Type': 'application/json'},
  body: JSON.stringify({
    tenant_id: 'multi-agent-demo',
    session_id: 'debug-001',
    with_whom: 'Debug',
    experienced: 'test',
    noticed: 'test',
    learned: 'test',
    story: 'test',
    becoming: 'I am debugging',
    remember: 'test',
    significance: 0.5,
    tags: []
  })
});

const created = await response.json();
console.log('Created:', JSON.stringify(created, null, 2));

const getRes = await fetch('http://localhost:3456/api/v1/handoffs?tenant_id=multi-agent-demo&limit=100');
const fetched = await getRes.json();
console.log('\nFetched:', JSON.stringify(fetched, null, 2));
