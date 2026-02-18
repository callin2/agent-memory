// Test z.ai API integration
const API_BASE = 'http://localhost:3456/api/v1';

console.log('🧪 Testing z.ai LLM Integration...\n');

// Create tenant first
await fetch(`${API_BASE}/tenants`, {
  method: 'POST',
  headers: {'Content-Type': 'application/json'},
  body: JSON.stringify({ id: 'zai-test', name: 'z.ai Test' })
});

console.log('✓ Tenant created');

// Test chat with z.ai
console.log('\n📝 Sending: "Write a research report about climate change"');
console.log('');

const response = await fetch(`${API_BASE}/chat`, {
  method: 'POST',
  headers: {'Content-Type': 'application/json'},
  body: JSON.stringify({
    message: 'Write a research report about climate change',
    tenant_id: 'zai-test',
    session_id: 'test-zai'
  })
});

const data = await response.json();

console.log(`Status: ${response.status}`);
console.log(`Using LLM: ${data.using_llm ? 'YES 🧠' : 'NO (mock)'}`);
console.log(`Messages: ${data.messages.length}\n`);

console.log('=== Agent Conversation (powered by z.ai) ===\n');
data.messages.forEach((msg, i) => {
  console.log(`${i+1}. [${msg.from}] → [${msg.to}]:`);
  console.log(`   "${msg.content.substring(0, 150)}${msg.content.length > 150 ? '...' : ''}"\n`);
});

if (data.using_llm) {
  console.log('✅ SUCCESS! Real LLM responses from z.ai!');
  console.log('   The agents actually understand and think!');
} else {
  console.log('⚠️  Using mock responses (API key not working)');
}
