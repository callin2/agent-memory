// Test save-handoff endpoint
const response = await fetch('http://localhost:3456/api/demo/save-handoff', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    agent_id: 'planner',
    conversation: [
      { role: 'user', content: 'What did we build?' },
      { role: 'assistant', content: 'We built Thread\'s Memory System with stratified memory layers.' }
    ],
    summary: 'Test conversation about Thread\'s Memory System'
  })
});

const data = await response.json();
console.log('Success:', data.success);
console.log('Message:', data.message || data.error);
console.log('Session ID:', data.session_id);
console.log('Created:', data.created_at);
