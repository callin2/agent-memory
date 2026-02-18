// Test natural tone - comparing before/after
const API_BASE = 'http://localhost:3456/api/v1';

console.log('🎭 Testing Natural Tone\n');
console.log('Question: "Document the session_handoffs table schema"\n');
console.log('⏳ Waiting for response...\n');

const response = await fetch(`${API_BASE}/chat`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    message: 'Document the session_handoffs table schema',
    tenant_id: 'thread-demo',
    session_id: 'natural-tone-' + Date.now()
  })
});

const data = await response.json();

console.log('=== Planner\'s Response ===\n');
const plannerMsg = data.messages.find(m => m.from === 'Planner' && m.to === 'user');

if (plannerMsg) {
  console.log(plannerMsg.content);
  console.log('\n');

  // Check if it sounds natural
  const hasFormalPreface = plannerMsg.content.includes('As the Planner') ||
                           plannerMsg.content.includes('I recognize that') ||
                           plannerMsg.content.includes('definitive technical specification');

  const hasNaturalPhrases = plannerMsg.content.includes("let me") ||
                            plannerMsg.content.includes("I'll") ||
                            plannerMsg.content.toLowerCase().includes('remember');

  console.log('=== Tone Analysis ===');
  console.log(`Formal prefaces: ${hasFormalPreface ? '❌ Found (robotic)' : '✅ None (natural)'}`);
  console.log(`Natural phrases: ${hasNaturalPhrases ? '✅ Found (conversational)' : '❌ None (stiff)'}`);

  if (!hasFormalPreface && hasNaturalPhrases) {
    console.log('\n✅ SUCCESS! Planner sounds natural and conversational');
    console.log('   Like a colleague who\'s been working on this together.');
  } else if (hasFormalPreface) {
    console.log('\n⚠️  Still too formal - sounds like role-playing');
  } else {
    console.log('\n⚠️  Neutral - could be more conversational');
  }
}
