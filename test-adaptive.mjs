// Test adaptive chat with SSE streaming
const response = await fetch('http://localhost:3456/api/v1/chat-adaptive', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    message: 'What should we build next?',
    tenant_id: 'adaptive-demo',
    session_id: 'test-' + Date.now()
  })
});

console.log('🧪 Testing Adaptive Chat with SSE Streaming\n');
console.log('Question: "What should we build next?"\n');

const reader = response.body.getReader();
const decoder = new TextDecoder();
let buffer = '';
let messageCount = 0;
let thinkingCount = 0;

console.log('=== Streaming Messages ===\n');

while (true) {
  const { done, value } = await reader.read();
  if (done) break;

  buffer += decoder.decode(value, { stream: true });
  const lines = buffer.split('\n');
  buffer = lines.pop() || '';

  for (const line of lines) {
    if (line.startsWith('data: ')) {
      try {
        const msg = JSON.parse(line.slice(6));
        messageCount++;

        if (msg.type === 'thinking') {
          thinkingCount++;
          console.log(`💭 [${msg.from}] thinking: ${msg.thinking?.substring(0, 80)}...`);
        } else if (msg.content) {
          console.log(`\n✅ [${msg.from}] → [${msg.to}]:`);
          console.log(`"${msg.content.substring(0, 150)}${msg.content.length > 150 ? '...' : ''}"\n`);
        }
      } catch (e) {
        console.error('Parse error:', line.substring(0, 100));
      }
    }
  }

  // Limit test to avoid infinite loop
  if (messageCount > 20) {
    console.log('⚠️  Reached message limit, stopping...');
    break;
  }
}

console.log('\n=== Results ===');
console.log(`Total messages: ${messageCount}`);
console.log(`Thinking processes shown: ${thinkingCount}`);
console.log(`Final messages: ${messageCount - thinkingCount}`);

if (thinkingCount > 0) {
  console.log('\n✅ SUCCESS! Thinking process is visible');
} else {
  console.log('\n⚠️  No thinking processes shown');
}
