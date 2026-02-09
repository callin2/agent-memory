import http from 'k6/http';
import { check, sleep } from 'k6';
import { RateLimiter, SharedArray } from 'k6/bundle';

// Test configuration
export const options = {
  stages: [
    { duration: '1m', target: 5 },   // Ramp up to 5 users
    { duration: '2m', target: 10 },  // Ramp up to 10 users
    { duration: '3m', target: 10 },  // Stay at 10 users
    { duration: '2m', target: 20 },  // Ramp up to 20 users
    { duration: '3m', target: 20 },  // Stay at 20 users
    { duration: '2m', target: 0 },   // Ramp down to 0
  ],
  thresholds: {
    http_req_duration: ['p(95)<500', 'p(99)<1000'], // p95 < 500ms, p99 < 1000ms
    http_req_failed: ['rate<0.01'],                  // Error rate < 1%
  },
};

// Base URL
const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

// JWT token (will be set in setup)
let authToken = null;
const tenantId = 'test_tenant_load';

// Register and login to get auth token
export function setup() {
  // Register user
  const registerRes = http.post(`${BASE_URL}/auth/register`, JSON.stringify({
    username: 'loadtest_user',
    password: 'LoadTest123!',
    tenant_id: tenantId,
  }), {
    headers: { 'Content-Type': 'application/json' },
  });

  // Login
  const loginRes = http.post(`${BASE_URL}/auth/login`, JSON.stringify({
    username: 'loadtest_user',
    password: 'LoadTest123!',
    tenant_id: tenantId,
  }), {
    headers: { 'Content-Type': 'application/json' },
  });

  check(loginRes, {
    'Login successful': (r) => r.status === 200,
  });

  authToken = loginRes.json('token').token;
}

export default function () {
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${authToken}`,
  };

  // Test 1: Record events
  group('Record Events', () => {
    const eventPayload = JSON.stringify({
      session_id: `session_${__VU}`,
      channel: 'private',
      actor: { type: 'human', id: `user_${__VU}` },
      kind: 'message',
      content: { text: `Load test message from VU ${__VU}` },
    });

    const recordRes = http.post(`${BASE_URL}/api/v1/events`, eventPayload, { headers });

    check(recordRes, {
      'Event recorded successfully': (r) => r.status === 201,
      'Response time < 200ms': (r) => r.timings.duration < 200,
    });
  });

  // Test 2: Build ACB (most common operation)
  group('Build ACB', () => {
    const acbPayload = JSON.stringify({
      session_id: `session_${__VU}`,
      agent_id: `agent_${__VU}`,
      channel: 'private',
      intent: 'query_context',
      query_text: 'What did we discuss?',
      max_tokens: 65000,
    });

    const acbRes = http.post(`${BASE_URL}/api/v1/acb/build`, acbPayload, { headers });

    check(acbRes, {
      'ACB built successfully': (r) => r.status === 200,
      'Response time < 500ms': (r) => r.timings.duration < 500,
      'ACB under budget': (r) => r.json('token_used_est') <= 65000,
    });

    // Sleep to simulate real user think time
    sleep(1);
  });

  // Test 3: Get events
  group('Get Events', () => {
    const getRes = http.get(`${BASE_URL}/api/v1/events?tenant_id=${tenantId}&session_id=session_1&limit=10`, {
      headers,
    });

    check(getRes, {
      'Events retrieved': (r) => r.status === 200,
      'Response time < 100ms': (r) => r.timings.duration < 100,
    });
  });

  // Test 4: Health check (should be very fast)
  group('Health Check', () => {
    const healthRes = http.get(`${BASE_URL}/health`, {});

    check(healthRes, {
      'Health check passes': (r) => r.status === 200,
      'Response time < 50ms': (r) => r.timings.duration < 50,
    });
  });
}

export function teardown(data) {
  // Cleanup if needed
  console.log('Load test completed');
}
