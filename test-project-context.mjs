// Test if agents are using actual project context
const API_BASE = 'http://localhost:3456/api/v1';

console.log('🧪 Testing Project Context Awareness\n');
console.log('Sending: "Document the session_handoffs table schema"\n');

const response = await fetch(`${API_BASE}/chat`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    message: 'Document the session_handoffs table schema',
    tenant_id: 'thread-demo',
    session_id: 'test-context-' + Date.now()
  })
});

const data = await response.json();

console.log('=== Agent Responses ===\n');

// Check if agents reference actual implementation details
const hasProjectContext = data.messages.some(msg => {
  const content = msg.content.toLowerCase();
  return (
    content.includes('handoff_id') ||
    content.includes('becoming') ||
    content.includes('tenant_id') ||
    content.includes('experienced') ||
    content.includes('z.ai') ||
    content.includes('glm-4.7') ||
    content.includes('typescript') ||
    content.includes('foreign key')
  );
});

data.messages.forEach(msg => {
  console.log(`[${msg.from}] → [${msg.to}]:`);
  console.log(`"${msg.content.substring(0, 150)}${msg.content.length > 150 ? '...' : ''}"\n`);
});

console.log('=== Context Check ===');
if (hasProjectContext) {
  console.log('✅ SUCCESS! Agents are referencing actual Thread\'s Memory System implementation details!');
  console.log('   They remember the real project journey.');
} else {
  console.log('❌ FAIL! Agents are generating generic content without project context.');
  console.log('   They should be referencing actual implementation details.');
}
