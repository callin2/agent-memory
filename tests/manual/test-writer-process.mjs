// Test if Writer shows internal process
const response = await fetch('http://localhost:3456/api/v1/chat', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    message: 'Write about your experience documenting this project',
    tenant_id: 'thread-demo',
    session_id: 'writer-test-' + Date.now()
  })
});

const data = await response.json();
const writerMsg = data.messages.find(m => m.from === 'Writer' && m.to === 'Planner');

console.log('=== Writer Agent Response ===\n');
console.log(writerMsg.content.substring(0, 800));
if (writerMsg.content.length > 800) console.log('...\n');

// Check for internal process markers
const hasNumberedSteps = writerMsg.content.includes('1.') ||
                         writerMsg.content.includes('**1**') ||
                         writerMsg.content.match(/^\d+\./m);

const hasDraftingNotes = writerMsg.content.includes('*Drafting') ||
                         writerMsg.content.includes('*Critique:') ||
                         writerMsg.content.includes('*Refinement:');

const hasAnalysisHeaders = writerMsg.content.includes('Analyze the Request') ||
                           writerMsg.content.includes('Determine the') ||
                           writerMsg.content.includes('Final Polish');

console.log('=== Internal Process Check ===');
console.log(`${hasNumberedSteps ? '❌' : '✅'} Numbered steps: ${hasNumberedSteps ? 'Found' : 'None'}`);
console.log(`${hasDraftingNotes ? '❌' : '✅'} Drafting notes: ${hasDraftingNotes ? 'Found' : 'None'}`);
console.log(`${hasAnalysisHeaders ? '❌' : '✅'} Analysis headers: ${hasAnalysisHeaders ? 'Found' : 'None'}`);

if (!hasNumberedSteps && !hasDraftingNotes && !hasAnalysisHeaders) {
  console.log('\n✅ SUCCESS! Writer gives final content directly');
  console.log('   No internal process shown!');
} else {
  console.log('\n❌ FAIL! Writer still showing internal process');
}
