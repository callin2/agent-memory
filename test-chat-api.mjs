const response = await fetch('http://localhost:3456/api/demo/chat', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    agent_id: 'planner',
    message: 'Hello! Who are you and what do you do?'
  })
});

const data = await response.json();
console.log('Success:', data.success);
console.log('Model:', data.model);
console.log('Response:', data.response?.substring(0, 300));
