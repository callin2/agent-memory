// Quick test to see raw response
const response = await fetch('http://localhost:3456/api/v1/chat', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    message: 'Hi there',
    tenant_id: 'thread-demo',
    session_id: 'quick-' + Date.now()
  })
});

const data = await response.json();
console.log('Planner first 500 chars:');
console.log(data.messages[0].content.substring(0, 500));
