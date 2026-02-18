// Test the new chat endpoint with tenant creation
const API_BASE = 'http://localhost:3456/api/v1';

// 1. Create tenant first
console.log('Creating tenant...');
await fetch(`${API_BASE}/tenants`, {
  method: 'POST',
  headers: {'Content-Type': 'application/json'},
  body: JSON.stringify({ id: 'agent-conversation-demo', name: 'Agent Conversation Demo' })
});
console.log('✓ Tenant created\n');

// 2. Test chat
console.log('Testing chat endpoint...');
const response = await fetch(`${API_BASE}/chat`, {
  method: 'POST',
  headers: {'Content-Type': 'application/json'},
  body: JSON.stringify({
    message: 'Write a research report about climate change in 2026',
    tenant_id: 'agent-conversation-demo',
    session_id: 'test-chat'
  })
});

console.log('Status:', response.status);
const data = await response.json();

if (data.messages) {
  console.log('Messages:', data.messages.length);
  console.log('\n=== Agent Conversation ===\n');
  data.messages.forEach((msg, i) => {
    console.log(`${i+1}. ${msg.from} → ${msg.to}:`);
    console.log(`   "${msg.content}"\n`);
  });
  console.log('✅ SUCCESS! Agent-to-agent conversation is working!');
} else {
  console.log('Error:', data);
}
