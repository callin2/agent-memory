// Test orchestration API
const response = await fetch('http://localhost:3456/api/v1/orchestration/chat', {
  method: 'POST',
  headers: {'Content-Type': 'application/json'},
  body: JSON.stringify({
    message: 'Write a research report about climate change',
    tenant_id: 'orch-test',
    session_id: 'test-123',
    user_id: 'user'
  })
});

const data = await response.json();
console.log('Response:', JSON.stringify(data, null, 2));
