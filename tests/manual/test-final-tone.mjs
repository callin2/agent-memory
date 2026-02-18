// Test final natural tone
const response = await fetch('http://localhost:3456/api/v1/chat', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    message: 'What do you remember about our project?',
    tenant_id: 'thread-demo',
    session_id: 'final-' + Date.now()
  })
});

const data = await response.json();
const planner = data.messages.find(m => m.from === 'Planner' && m.to === 'user');

console.log('=== Planner (Natural Tone Test) ===\n');
console.log(planner.content.substring(0, 700));
if (planner.content.length > 700) console.log('...\n');

// Check tone indicators
const content = planner.content.toLowerCase();
const natural = content.includes('remember') || content.includes('we fixed') || content.includes('we built');
const robotic = content.includes('as the planner') || content.includes('step 1') || content.includes('analysis:');

console.log('\n=== Tone Check ===');
console.log(`${natural ? '✅' : '❌'} Natural phrases: ${natural ? 'Found' : 'None'}`);
console.log(`${robotic ? '❌' : '✅'} Robotic patterns: ${robotic ? 'Found' : 'None'}`);

if (natural && !robotic) {
  console.log('\n✅ SUCCESS! Planner sounds natural and conversational');
} else {
  console.log('\n⚠️  Still needs improvement');
}
