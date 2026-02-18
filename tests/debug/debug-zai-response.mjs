// Debug z.ai response
const response = await fetch('http://localhost:3456/api/v1/chat', {
  method: 'POST',
  headers: {'Content-Type': 'application/json'},
  body: JSON.stringify({
    message: 'Say hello',
    tenant_id: 'zai-test',
    session_id: 'debug'
  })
});

console.log('Status:', response.status);
const data = await response.json();
console.log('\nFull response:', JSON.stringify(data, null, 2));

if (data.messages && data.messages.length > 0) {
  console.log('\n=== Message Contents ===');
  data.messages.forEach((msg, i) => {
    console.log(`${i+1}. [${msg.from}] → [${msg.to}]:`);
    console.log(`   Content: "${msg.content}"`);
    console.log(`   Content length: ${msg.content.length}\n`);
  });
}
