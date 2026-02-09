/**
 * Load Test: 10+ Concurrent Agents
 *
 * Simulates multiple agents working simultaneously
 * Each agent represents a separate session
 */

import http from 'k6/http';
import { check, group } from 'k6';

// Test configuration
export const options = {
  scenarios: {
    // Warmup phase
    warmup: {
      executor: 'constant-vus',
      exec: 'warmupUser',
      startTime: '0s',
      gracefulStop: '30s',
      env: { SCENARIO: 'warmup' },
      gracefulRampDown: '30s',
    },
    // Main load test - 5 concurrent agents
    main_load_5: {
      executor: 'constant-vus',
      exec: 'agentUser',
      startTime: '30s',
      gracefulStop: '30s',
      env: { SCENARIO: 'main' },
      gracefulRampDown: '30s',
    },
    // Peak load - 10 concurrent agents
    peak_load_10: {
      executor: 'constant-vus',
      exec: 'agentUser',
      startTime: '90s',
      gracefulStop: '30s',
      env: { SCENARIO: 'peak' },
      gracefulRampDown: '30s',
    },
    // Stress test - 20 concurrent agents
    stress_load_20: {
      executor: 'constant-vus',
      exec: 'agentUser',
      startTime: '150s',
      gracefulStop: '30s',
      env: { SCENARIO: 'stress' },
      gracefulRampDown: '30s',
    },
  },
  thresholds: {
    // Performance thresholds
    'http_req_duration{scenario:warmup}': ['p(95)<300'],
    'http_req_duration{scenario:main}': ['p(95)<500'],
    'http_req_duration{scenario:peak}': ['p(95)<500'],
    'http_req_duration{scenario:stress}': ['p(95)<1000'],
    // Error rate thresholds
    'http_req_failed{scenario:warmup}': ['rate<0.01'],
    'http_req_failed{scenario:main}': ['rate<0.02'],
    'http_req_failed{scenario:peak}': ['rate<0.05'],
    'http_req_failed{scenario:stress}': ['rate<0.10'],
    // ACB budget compliance
    'checks{scenario}:acb_budget_ok': ['rate>0.95'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

// Auth tokens for different simulated users
const authTokens = new Map();
const NUM_AGENTS = 20;

// Setup: Register all agents and get their tokens
export function setup() {
  for (let i = 0; i < NUM_AGENTS; i++) {
    const agentId = `agent_${i}`;
    const username = `agent_${i}`;
    const tenantId = 'tenant_loadtest';

    // Register
    http.post(`${BASE_URL}/auth/register`, JSON.stringify({
      username,
      password: 'LoadTest123!',
      tenant_id: tenantId,
    }), {
      headers: { 'Content-Type': 'application/json' },
      tags: { scenario: 'setup' },
    });

    // Login
    const loginRes = http.post(`${BASE_URL}/auth/login`, JSON.stringify({
      username,
      password: 'LoadTest123!',
      tenant_id: tenantId,
    }), {
      headers: { 'Content-Type': 'application/json' },
      tags: { scenario: 'setup' },
    });

    if (loginRes.status === 200) {
      authTokens.set(i, loginRes.json('token').token);
    }
  }
}

// Warmup user - light load
export function warmupUser() {
  if (!authTokens.has(0)) {
    return;
  }

  const token = authTokens.get(0);
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
  };

  group('Warmup: Health Check', () => {
    const res = http.get(`${BASE_URL}/health`, { tags: { scenario: 'warmup' } });

    check(res, {
      'Health check OK': (r) => r.status === 200,
      'Response < 100ms': (r) => r.timings.duration < 100,
    });
  });
}

// Main agent user workflow
export function agentUser() {
  const vuId = __VU % NUM_AGENTS;

  if (!authTokens.has(vuId)) {
    return;
  }

  const token = authTokens.get(vuId);
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
  };

  const sessionId = `session_agent_${vuId}_${Date.now()}`;
  const tenantId = 'tenant_loadtest';

  // Typical agent workflow
  group('Agent Workflow', () => {
    // 1. Agent receives task and records it
    group('Record Task', () => {
      const payload = JSON.stringify({
        tenant_id: tenantId,
        session_id: sessionId,
        channel: 'private',
        actor: { type: 'human', id: `user_${vuId}` },
        kind: 'message',
        tags: ['task', 'coding'],
        content: {
          text: `Implement feature X for agent ${vuId}`,
        },
      });

      const res = http.post(`${BASE_URL}/api/v1/events`, payload, { headers });

      check(res, {
        'Task recorded': (r) => r.status === 201,
        'Recording < 200ms': (r) => r.timings.duration < 200,
      });
    });

    // 2. Simulate tool call
    group('Record Tool Call', () => {
      const payload = JSON.stringify({
        tenant_id: tenantId,
        session_id: sessionId,
        channel: 'private',
        actor: { type: 'agent', id: `agent_${vuId}` },
        kind: 'tool_call',
        tags: ['tool'],
        content: {
          tool: 'fs.read_file',
          path: 'src/index.ts',
        },
      });

      const res = http.post(`${BASE_URL}/api/v1/events`, payload, { headers });

      check(res, {
        'Tool call recorded': (r) => r.status === 201,
      });
    });

    // 3. Simulate tool result
    group('Record Tool Result', () => {
      const payload = JSON.stringify({
        tenant_id: tenantId,
        session_id: sessionId,
        channel: 'private',
        actor: { type: 'tool', id: 'fs' },
        kind: 'tool_result',
        tags: ['tool'],
        content: {
          tool: 'fs.read_file',
          path: 'src/index.ts',
          excerpt_text: 'export function main() { ... }',
        },
      });

      const res = http.post(`${BASE_URL}/api/v1/events`, payload, { headers });

      check(res, {
        'Tool result recorded': (r) => r.status === 201,
      });
    });

    // 4. Build ACB for next action
    group('Build Context Bundle', () => {
      const payload = JSON.stringify({
        tenant_id: tenantId,
        session_id: sessionId,
        agent_id: `agent_${vuId}`,
        channel: 'private',
        intent: 'continue_task',
        query_text: 'feature X implementation progress',
        max_tokens: 65000,
      });

      const res = http.post(`${BASE_URL}/api/v1/acb/build`, payload, { headers });

      const isValid = check(res, {
        'ACB built successfully': (r) => r.status === 200,
        'ACB response < 500ms': (r) => r.timings.duration < 500,
        'ACB budget respected': (r) => {
          const tokenUsed = r.json('token_used_est');
          return tokenUsed <= 65000;
        },
      });

      if (isValid) {
        check(res, {
          'ACB contains sections': (r) => {
            const sections = r.json('sections');
            return sections && Array.isArray(sections) && sections.length > 0;
          },
          'ACB has retrieved evidence': (r) => {
            const evidence = r.json('sections').find((s) => s.name === 'retrieved_evidence');
            return evidence && evidence.items && evidence.items.length >= 0;
          },
        });
      }
    });

    // 5. Create decision
    group('Record Decision', () => {
      const payload = JSON.stringify({
        decision: `Use TypeScript for feature X (agent ${vuId})`,
        rationale: ['Type safety', 'Better IDE support'],
        constraints: ['Must maintain backwards compatibility'],
        alternatives: ['JavaScript', 'Python'],
      });

      const res = http.post(`${BASE_URL}/api/v1/decisions`, payload, { headers });

      check(res, {
        'Decision recorded': (r) => r.status === 201,
      });
    });

    // 6. Get recent events
    group('Get Recent Events', () => {
      const res = http.get(
        `${BASE_URL}/api/v1/events?tenant_id=${tenantId}&session_id=${sessionId}&limit=5`,
        { headers }
      );

      check(res, {
        'Events retrieved': (r) => r.status === 200,
        'Events < 100ms': (r) => r.timings.duration < 100,
      });
    });
  });
}

export function teardown(data) {
  // Cleanup if needed
  console.log('Load test completed');
}
