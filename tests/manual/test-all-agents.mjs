// Test all specialists for internal process
const response = await fetch('http://localhost:3456/api/v1/chat', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    message: 'Research and document your experience with TypeScript errors, then review it',
    tenant_id: 'thread-demo',
    session_id: 'all-agents-test-' + Date.now()
  })
});

const data = await response.json();

function checkInternalProcess(content, agentName) {
  const hasNumberedSteps = content.match(/^\d+\.\s+\*\*/m) ||
                           content.includes('**1**') ||
                           content.includes('**2**');

  const hasDraftingNotes = content.includes('*Drafting') ||
                           content.includes('*Critique:') ||
                           content.includes('*Refinement:*') ||
                           content.includes('*Analysis*') ||
                           content.includes('*Synthesis*');

  const hasProcessHeaders = content.includes('Analyze the Request') ||
                            content.includes('Determine the') ||
                            content.includes('Final Polish');

  const hasInternalMarkers = content.includes('(Internal') ||
                             content.includes('(too formal)') ||
                             content.includes('Draft ');

  const fail = hasNumberedSteps || hasDraftingNotes || hasProcessHeaders || hasInternalMarkers;

  return {
    agent: agentName,
    pass: !fail,
    issues: {
      numberedSteps: hasNumberedSteps,
      draftingNotes: hasDraftingNotes,
      processHeaders: hasProcessHeaders,
      internalMarkers: hasInternalMarkers
    },
    preview: content.substring(0, 150) + (content.length > 150 ? '...' : '')
  };
}

const specialists = ['Researcher', 'Writer', 'Reviewer'];
const results = [];

console.log('🧪 Testing All Specialist Agents\n');
console.log('Question: "Research and document your experience with TypeScript errors, then review it"\n');

for (const agent of specialists) {
  const msg = data.messages.find(m => m.from === agent && m.to === 'Planner');
  if (msg) {
    const result = checkInternalProcess(msg.content, agent);
    results.push(result);

    console.log(`=== ${agent} ===`);
    console.log(result.preview);
    console.log('');
  }
}

console.log('\n=== Results Summary ===\n');
let allPass = true;
for (const result of results) {
  console.log(`${result.pass ? '✅' : '❌'} ${result.agent}`);
  if (!result.pass) {
    allPass = false;
    Object.entries(result.issues).forEach(([issue, found]) => {
      if (found) console.log(`   ❌ ${issue}`);
    });
  }
}

if (allPass) {
  console.log('\n✅ SUCCESS! All specialists give final content directly');
  console.log('   No internal process shown anywhere!');
} else {
  console.log('\n⚠️  Some agents still showing internal process');
}
