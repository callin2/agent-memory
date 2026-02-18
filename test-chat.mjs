// Test the new chat endpoint
const response = await fetch('http://localhost:3456/api/v1/chat', {
  method: 'POST',
  headers: {'Content-Type': 'application/json'},
  body: JSON.stringify({
    message: 'Write a research report about climate change in 2026',
    tenant_id: 'agent-conversation-demo',
    session_id: 'test-chat'
  })
});

const data = await response.json();
console.log('Status:', response.status);
console.log('Messages:', data.messages.length);
console.log('\n=== Agent Conversation ===\n');
data.messages.forEach((msg, i) => {
  console.log(`${i+1}. ${msg.from} → ${msg.to}:`);
  console.log(`   "${msg.content}"\n`);
});
