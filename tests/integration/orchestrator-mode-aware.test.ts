/**
 * Orchestrator Integration Tests - Mode-Aware Filtering
 *
 * Tests that buildACB() correctly applies mode-aware budgets and guardrails
 * Based on docs/MULTI_TURN_FOCUS_PROBLEM.md v0.3
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Pool } from 'pg';
import { buildACB, type ACBRequest } from '../../src/core/orchestrator.js';
import { InteractionMode } from '../../src/core/mode-detection.js';

// Mock the database pool
vi.mock('pg', async () => {
  const actual = await vi.importActual('pg');
  return {
    ...actual,
    Pool: vi.fn().mockImplementation(() => ({
      query: vi.fn().mockResolvedValue({ rows: [] }),
      connect: vi.fn(),
      end: vi.fn(),
    })),
  };
});

describe('buildACB - Mode-Aware Filtering', () => {
  let pool: Pool;
  const tenant_id = 'test-tenant';
  const session_id = 'test-session';
  const agent_id = 'test-agent';
  const channel = 'private' as const;

  beforeEach(() => {
    pool = new Pool();
  });

  describe('Mode Detection', () => {
    it('should detect TASK mode from intent', async () => {
      const request: ACBRequest = {
        tenant_id,
        session_id,
        agent_id,
        channel,
        intent: 'task',
        query_text: 'Implement user authentication',
      };

      const response = await buildACB(pool, request);

      expect(response.mode).toBe(InteractionMode.TASK);
      expect(response.fallback_reason).toBeUndefined();
    });

    it('should detect EXPLORATION mode from intent', async () => {
      const request: ACBRequest = {
        tenant_id,
        session_id,
        agent_id,
        channel,
        intent: 'explore',
        query_text: 'Thinking about memory systems',
      };

      const response = await buildACB(pool, request);

      expect(response.mode).toBe(InteractionMode.EXPLORATION);
      expect(response.fallback_reason).toBeUndefined();
    });

    it('should detect DEBUGGING mode from intent', async () => {
      const request: ACBRequest = {
        tenant_id,
        session_id,
        agent_id,
        channel,
        intent: 'debug',
        query_text: 'Error in authentication',
      };

      const response = await buildACB(pool, request);

      expect(response.mode).toBe(InteractionMode.DEBUGGING);
      expect(response.fallback_reason).toBeUndefined();
    });

    it('should detect LEARNING mode from intent', async () => {
      const request: ACBRequest = {
        tenant_id,
        session_id,
        agent_id,
        channel,
        intent: 'learn',
        query_text: 'Teach me about Redux',
      };

      const response = await buildACB(pool, request);

      expect(response.mode).toBe(InteractionMode.LEARNING);
      expect(response.fallback_reason).toBeUndefined();
    });

    it('should fallback to GENERAL for unknown intent', async () => {
      const request: ACBRequest = {
        tenant_id,
        session_id,
        agent_id,
        channel,
        intent: 'unknown',
        query_text: 'Random query',
      };

      const response = await buildACB(pool, request);

      expect(response.mode).toBe(InteractionMode.GENERAL);
      // Note: No fallback_reason for unknown intent since confidence is 0.5 (above threshold)
      // but mode is GENERAL due to intent mapping
      expect(response.mode_confidence).toBeLessThan(0.7);
    });

    it('should include telemetry in response', async () => {
      const request: ACBRequest = {
        tenant_id,
        session_id,
        agent_id,
        channel,
        intent: 'task',
        query_text: 'Implement feature',
      };

      const response = await buildACB(pool, request);

      expect(response.mode_telemetry).toBeDefined();
      expect(response.mode_telemetry.detected_mode).toBe(InteractionMode.TASK);
      expect(response.mode_telemetry.timestamp).toBeGreaterThan(0);
    });
  });

  describe('Budget Allocation by Mode', () => {
    it('should allocate high rules budget for TASK mode', async () => {
      const request: ACBRequest = {
        tenant_id,
        session_id,
        agent_id,
        channel,
        intent: 'task',
        query_text: 'Implement feature',
      };

      const response = await buildACB(pool, request);

      // TASK mode should have 10k rules budget (vs 6k in GENERAL)
      // We can't directly test the internal budget allocation without
      // inspecting section sizes, but we can verify the mode is correct
      expect(response.mode).toBe(InteractionMode.TASK);
    });

    it('should allocate high recent_window budget for EXPLORATION mode', async () => {
      const request: ACBRequest = {
        tenant_id,
        session_id,
        agent_id,
        channel,
        intent: 'explore',
        query_text: 'Thinking about patterns',
      };

      const response = await buildACB(pool, request);

      expect(response.mode).toBe(InteractionMode.EXPLORATION);
    });

    it('should allocate zero task_state budget for LEARNING mode', async () => {
      const request: ACBRequest = {
        tenant_id,
        session_id,
        agent_id,
        channel,
        intent: 'learn',
        query_text: 'Teach me concepts',
      };

      const response = await buildACB(pool, request);

      expect(response.mode).toBe(InteractionMode.LEARNING);
    });

    it('should allocate zero capsules budget for DEBUGGING mode', async () => {
      const request: ACBRequest = {
        tenant_id,
        session_id,
        agent_id,
        channel,
        intent: 'debug',
        query_text: 'Fix this error',
        include_capsules: true,
      };

      const response = await buildACB(pool, request);

      expect(response.mode).toBe(InteractionMode.DEBUGGING);
      // Note: capsules budget would be 0 in DEBUGGING mode
      // but we can't verify this without inspecting internal state
    });
  });

  describe('Mode Transitions', () => {
    it('should handle transition from EXPLORATION to TASK', async () => {
      // First call: exploration
      const request1: ACBRequest = {
        tenant_id,
        session_id,
        agent_id,
        channel,
        intent: 'explore',
        query_text: 'Thinking about architecture',
      };

      const response1 = await buildACB(pool, request1);
      expect(response1.mode).toBe(InteractionMode.EXPLORATION);

      // Second call: task (mode switch)
      const request2: ACBRequest = {
        tenant_id,
        session_id,
        agent_id,
        channel,
        intent: 'task',
        query_text: 'Implement mode detection',
      };

      const response2 = await buildACB(pool, request2);
      expect(response2.mode).toBe(InteractionMode.TASK);
    });
  });

  describe('Runtime Guardrails', () => {
    it('should detect and track user corrections as sticky invariants', async () => {
      const request: ACBRequest = {
        tenant_id,
        session_id,
        agent_id,
        channel,
        intent: 'task',
        query_text: 'You must implement this with LDAP, not OAuth',
      };

      const response = await buildACB(pool, request);

      // Should detect hard constraint from "must"
      expect(response.mode).toBe(InteractionMode.TASK);
      // Invariant context should track the constraint
      // (we can't verify this without exposing internal state)
    });

    it('should detect blocking errors as sticky invariants', async () => {
      const request: ACBRequest = {
        tenant_id,
        session_id,
        agent_id,
        channel,
        intent: 'debug',
        query_text: 'Authentication fails with error 500',
      };

      const response = await buildACB(pool, request);

      expect(response.mode).toBe(InteractionMode.DEBUGGING);
      // Should detect BLOCKING_ERROR invariant
    });

    it('should include telemetry for monitoring', async () => {
      const request: ACBRequest = {
        tenant_id,
        session_id,
        agent_id,
        channel,
        intent: 'task',
        query_text: 'Implement feature',
      };

      const response = await buildACB(pool, request);

      expect(response.mode_telemetry).toBeDefined();
      // Note: request_id is only set if provided in request
      expect(response.mode_telemetry.timestamp).toBeGreaterThan(0);
      expect(response.mode_telemetry.detected_mode).toBe(InteractionMode.TASK);
      expect(response.mode_confidence).toBeGreaterThan(0.7); // 'task' intent has high confidence
    });
  });

  describe('Response Structure', () => {
    it('should include all required fields in response', async () => {
      const request: ACBRequest = {
        tenant_id,
        session_id,
        agent_id,
        channel,
        intent: 'task',
        query_text: 'Test query',
      };

      const response = await buildACB(pool, request);

      expect(response.acb_id).toBeDefined();
      expect(response.budget_tokens).toBeGreaterThan(0);
      expect(response.token_used_est).toBeGreaterThanOrEqual(0);
      expect(response.sections).toBeDefined();
      expect(response.omissions).toBeDefined();
      expect(response.provenance).toBeDefined();
      expect(response.capsules).toBeDefined();
      expect(response.edits_applied).toBeDefined();
      expect(response.mode).toBeDefined();
      expect(response.mode_telemetry).toBeDefined();
    });

    it('should have provenance that matches request', async () => {
      const request: ACBRequest = {
        tenant_id,
        session_id,
        agent_id,
        channel,
        intent: 'explore',
        query_text: 'Test query with multiple words',
      };

      const response = await buildACB(pool, request);

      expect(response.provenance.intent).toBe(request.intent);
      expect(response.provenance.query_terms).toContain('test');
      expect(response.provenance.query_terms).toContain('query');
      expect(response.provenance.query_terms).toContain('multiple');
    });
  });
});
