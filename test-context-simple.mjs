// Simple context test
const API_BASE = 'http://localhost:3456/api/v1';

console.log('🧪 Testing Context-Aware Agents\n');
console.log('Question: "What did we build for Thread\'s Memory System?"\n');

const response = await fetch(`${API_BASE}/chat`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    message: 'What did we build for Thread\'s Memory System?',
    tenant_id: 'thread-demo',
    session_id: 'final-test-' + Date.now()
  })
});

const data = await response.json();

console.log('=== All Agent Messages ===\n');
data.messages.forEach((msg, i) => {
  console.log(`${i+1}. [${msg.from}] → [${msg.to}]:`);
  console.log(`   ${msg.content.substring(0, 200)}${msg.content.length > 200 ? '...' : ''}\n`);
});

console.log('=== Context Check ===');
const allContent = data.messages.map(m => m.content).join(' ').toLowerCase();
const checks = [
  { name: 'z.ai', found: allContent.includes('z.ai') },
  { name: 'glm', found: allContent.includes('glm') },
  { name: 'typescript', found: allContent.includes('typescript') },
  { name: 'session_handoffs', found: allContent.includes('session_handoffs') },
  { name: 'becoming', found: allContent.includes('becoming') },
  { name: 'foreign key', found: allContent.includes('foreign key') },
];

checks.forEach(c => console.log(`  ${c.found ? '✅' : '❌'} ${c.name}`));

const foundCount = checks.filter(c => c.found).length;
console.log(`\n${foundCount}/${checks.length} details found`);

if (foundCount >= 3) {
  console.log('\n✅ Agents are using actual project context!');
} else {
  console.log('\n⚠️  Agents need more context awareness.');
}
