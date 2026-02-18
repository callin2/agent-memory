const response = await fetch('http://localhost:3456/api/v1/orchestration/chat', {
  method: 'POST',
  headers: {'Content-Type': 'application/json'},
  body: JSON.stringify({
    message: 'test',
    tenant_id: 'test',
    session_id: 'test'
  })
});

const text = await response.text();
console.log('Status:', response.status);
console.log('Response:', text.substring(0, 500));
