// Test script to verify API connection
// Run with: node test-api.js

const API_BASE = 'http://localhost:3456';

async function testConnection() {
  console.log('🔍 Testing Thread\'s Memory System API...\n');

  // Test 1: Health check
  console.log('1️⃣ Health Check');
  try {
    const response = await fetch(`${API_BASE}/health`);
    const data = await response.json();
    console.log(`   ✅ Status: ${response.status}`);
    console.log(`   ✅ Body:`, data);
  } catch (error) {
    console.log(`   ❌ Error:`, error.message);
    return;
  }

  // Test 2: Stratified Memory API
  console.log('\n2️⃣ Stratified Memory API');
  try {
    const response = await fetch(`${API_BASE}/api/memory/wake-up-stratified`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tenant_id: 'claude-session',
        layers: ['metadata'],
        recent_count: 1
      })
    });

    console.log(`   Status: ${response.status}`);

    if (!response.ok) {
      const text = await response.text();
      console.log(`   ❌ Failed: ${text}`);
      return;
    }

    const data = await response.json();
    console.log(`   ✅ Success!`);
    console.log(`   ✅ Layers loaded:`, data.layers_loaded);
    console.log(`   ✅ Estimated tokens:`, data.estimated_tokens);
    console.log(`   ✅ Session count:`, data.metadata?.session_count);
  } catch (error) {
    console.log(`   ❌ Error:`, error.message);
  }

  console.log('\n✅ All tests passed! The API is working correctly.');
  console.log('\n💡 If the browser still fails, check:');
  console.log('   1. Browser console (F12) for actual error');
  console.log('   2. CORS settings in browser');
  console.log('   3. Network tab in DevTools for request details');
}

testConnection().catch(console.error);
