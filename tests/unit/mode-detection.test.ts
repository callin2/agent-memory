/**
 * Mode Detection System Tests
 *
 * Tests for mode-aware context filtering
 * Based on docs/MULTI_TURN_FOCUS_PROBLEM.md v0.3
 */

import { describe, it, expect } from 'vitest';
import {
  detectModeFromIntent,
  getBudgets,
  detectModeWithGuardrails,
  detectInvariantBreach,
  STICKY_INVARIANTS,
  InteractionMode,
  StickyInvariantType,
} from '../../src/core/mode-detection.js';

describe('Mode Detection', () => {
  describe('detectModeFromIntent', () => {
    it('should map direct intents correctly', () => {
      expect(detectModeFromIntent('task')).toBe(InteractionMode.TASK);
      expect(detectModeFromIntent('debug')).toBe(InteractionMode.DEBUGGING);
      expect(detectModeFromIntent('explore')).toBe(InteractionMode.EXPLORATION);
      expect(detectModeFromIntent('learn')).toBe(InteractionMode.LEARNING);
      expect(detectModeFromIntent('general')).toBe(InteractionMode.GENERAL);
    });

    it('should map common variations', () => {
      expect(detectModeFromIntent('implement')).toBe(InteractionMode.TASK);
      expect(detectModeFromIntent('fix')).toBe(InteractionMode.DEBUGGING);
      expect(detectModeFromIntent('error')).toBe(InteractionMode.DEBUGGING);
      expect(detectModeFromIntent('investigate')).toBe(InteractionMode.EXPLORATION);
      expect(detectModeFromIntent('explain')).toBe(InteractionMode.LEARNING);
    });

    it('should handle case insensitive matching', () => {
      expect(detectModeFromIntent('TASK')).toBe(InteractionMode.TASK);
      expect(detectModeFromIntent('Task')).toBe(InteractionMode.TASK);
      expect(detectModeFromIntent('TaSk')).toBe(InteractionMode.TASK);
    });

    it('should handle whitespace', () => {
      expect(detectModeFromIntent('  task  ')).toBe(InteractionMode.TASK);
    });

    it('should fallback to GENERAL for unknown intents', () => {
      expect(detectModeFromIntent('unknown')).toBe(InteractionMode.GENERAL);
      expect(detectModeFromIntent('random')).toBe(InteractionMode.GENERAL);
    });

    it('should handle empty intent', () => {
      expect(detectModeFromIntent('')).toBe(InteractionMode.GENERAL);
    });

    it('should handle null/undefined', () => {
      expect(detectModeFromIntent(null as any)).toBe(InteractionMode.GENERAL);
      expect(detectModeFromIntent(undefined as any)).toBe(InteractionMode.GENERAL);
    });
  });

  describe('getBudgets', () => {
    it('should return TASK budgets with high rules and task_state', () => {
      const budgets = getBudgets(InteractionMode.TASK);
      expect(budgets.rules).toBe(10000);
      expect(budgets.task_state).toBe(5000);
      expect(budgets.recent_window).toBe(2000);
      expect(budgets.retrieved_evidence).toBe(28000);
    });

    it('should return EXPLORATION budgets with high recent_window', () => {
      const budgets = getBudgets(InteractionMode.EXPLORATION);
      expect(budgets.rules).toBe(3000);
      expect(budgets.task_state).toBe(1000);
      expect(budgets.recent_window).toBe(15000);
      expect(budgets.retrieved_evidence).toBe(35000);
    });

    it('should return DEBUGGING budgets with high recent_window and no capsules', () => {
      const budgets = getBudgets(InteractionMode.DEBUGGING);
      expect(budgets.rules).toBe(5000);
      expect(budgets.task_state).toBe(4000);
      expect(budgets.recent_window).toBe(12000);
      expect(budgets.capsules).toBe(0);
    });

    it('should return LEARNING budgets with high retrieved_evidence', () => {
      const budgets = getBudgets(InteractionMode.LEARNING);
      expect(budgets.rules).toBe(8000);
      expect(budgets.task_state).toBe(0);
      expect(budgets.recent_window).toBe(2000);
      expect(budgets.retrieved_evidence).toBe(40000);
    });

    it('should return GENERAL budgets with balanced defaults', () => {
      const budgets = getBudgets(InteractionMode.GENERAL);
      expect(budgets.rules).toBe(6000);
      expect(budgets.task_state).toBe(3000);
      expect(budgets.recent_window).toBe(8000);
      expect(budgets.retrieved_evidence).toBe(28000);
    });

    it('should sum to reasonable totals for each mode', () => {
      const taskTotal = Object.values(getBudgets(InteractionMode.TASK)).reduce((a, b) => a + b, 0);
      const explorationTotal = Object.values(getBudgets(InteractionMode.EXPLORATION)).reduce((a, b) => a + b, 0);
      const debuggingTotal = Object.values(getBudgets(InteractionMode.DEBUGGING)).reduce((a, b) => a + b, 0);
      const learningTotal = Object.values(getBudgets(InteractionMode.LEARNING)).reduce((a, b) => a + b, 0);
      const generalTotal = Object.values(getBudgets(InteractionMode.GENERAL)).reduce((a, b) => a + b, 0);

      // All should be under 65k (DEFAULT_MAX_TOKENS)
      expect(taskTotal).toBeLessThanOrEqual(65000);
      expect(explorationTotal).toBeLessThanOrEqual(65000);
      expect(debuggingTotal).toBeLessThanOrEqual(65000);
      expect(learningTotal).toBeLessThanOrEqual(65000);
      expect(generalTotal).toBeLessThanOrEqual(65000);
    });
  });
});

describe('Sticky Invariants', () => {
  it('should have 4 invariants defined', () => {
    expect(STICKY_INVARIANTS.length).toBe(4);
  });

  it('should have priorities in descending order', () => {
    const priorities = STICKY_INVARIANTS.map(i => i.priority);
    expect(priorities).toEqual([1000, 900, 800, 700]);
  });

  it('should include all required invariant types', () => {
    const types = STICKY_INVARIANTS.map(i => i.type);
    expect(types).toContain(StickyInvariantType.SAFETY_REQUIREMENT);
    expect(types).toContain(StickyInvariantType.USER_CORRECTION);
    expect(types).toContain(StickyInvariantType.HARD_CONSTRAINT);
    expect(types).toContain(StickyInvariantType.BLOCKING_ERROR);
  });
});

describe('Runtime Guardrails', () => {
  describe('detectModeWithGuardrails', () => {
    it('should return detected mode when confidence is high', () => {
      const result = detectModeWithGuardrails(
        { intent: 'task' },
        { getConfidence: () => 0.9 }
      );
      expect(result.mode).toBe(InteractionMode.TASK);
      expect(result.fallbackReason).toBeUndefined();
    });

    it('should fallback to GENERAL when confidence is low (< 70%)', () => {
      const result = detectModeWithGuardrails(
        { intent: 'task' },
        { getConfidence: () => 0.5 }
      );
      expect(result.mode).toBe(InteractionMode.GENERAL);
      expect(result.fallbackReason).toBe('low_confidence');
    });

    it('should fallback to GENERAL when drift is detected', () => {
      const result = detectModeWithGuardrails(
        { intent: 'task' },
        {
          getConfidence: () => 0.9,
          detectDrift: () => true,
        }
      );
      expect(result.mode).toBe(InteractionMode.GENERAL);
      expect(result.fallbackReason).toBe('drift_detected');
    });

    it('should fallback to GENERAL when error rate is high', () => {
      const result = detectModeWithGuardrails(
        { intent: 'task' },
        {
          getConfidence: () => 0.9,
          getModeErrorRate: () => 0.2,
          getBaselineErrorRate: () => 0.05, // 4x baseline
        }
      );
      expect(result.mode).toBe(InteractionMode.GENERAL);
      expect(result.fallbackReason).toBe('high_error_rate');
    });

    it('should not fallback when error rate is within bounds', () => {
      const result = detectModeWithGuardrails(
        { intent: 'task' },
        {
          getConfidence: () => 0.9,
          getModeErrorRate: () => 0.08, // < 2x baseline
          getBaselineErrorRate: () => 0.05,
        }
      );
      expect(result.mode).toBe(InteractionMode.TASK);
      expect(result.fallbackReason).toBeUndefined();
    });

    it('should default to no fallback when options not provided', () => {
      const result = detectModeWithGuardrails({ intent: 'task' });
      expect(result.mode).toBe(InteractionMode.TASK);
      expect(result.fallbackReason).toBeUndefined();
    });
  });

  describe('detectInvariantBreach', () => {
    it('should detect no breach when all invariants present', () => {
      const context = {
        has: (type: StickyInvariantType) => true,
      };
      const result = detectInvariantBreach(context);
      expect(result.breached).toBe(false);
      expect(result.missing).toBeUndefined();
    });

    it('should detect breach when safety requirement missing', () => {
      const context = {
        has: (type: StickyInvariantType) => type !== StickyInvariantType.SAFETY_REQUIREMENT,
      };
      const result = detectInvariantBreach(context);
      expect(result.breached).toBe(true);
      expect(result.missing).toBe(StickyInvariantType.SAFETY_REQUIREMENT);
    });

    it('should detect breach when user correction missing', () => {
      const context = {
        has: (type: StickyInvariantType) => type !== StickyInvariantType.USER_CORRECTION,
      };
      const result = detectInvariantBreach(context);
      expect(result.breached).toBe(true);
      expect(result.missing).toBe(StickyInvariantType.USER_CORRECTION);
    });

    it('should check only invariants with priority >= threshold', () => {
      const context = {
        // Only priority 700 (blocking_error) is missing
        has: (type: StickyInvariantType) => type !== StickyInvariantType.BLOCKING_ERROR,
      };
      const result = detectInvariantBreach(context, 800); // Only check 800+
      expect(result.breached).toBe(false); // 700 < 800, so not checked
    });

    it('should default to checking priority >= 800', () => {
      const context = {
        has: (type: StickyInvariantType) => type !== StickyInvariantType.BLOCKING_ERROR,
      };
      const result = detectInvariantBreach(context); // Default threshold 800
      expect(result.breached).toBe(false); // 700 < 800, not checked
    });
  });
});

describe('Integration Scenarios', () => {
  it('should handle task mode with sticky invariants', () => {
    // Scenario: User implementing auth with JWT, then adds LDAP constraint
    const mode1 = detectModeFromIntent('task');
    const budgets1 = getBudgets(mode1);

    expect(mode1).toBe(InteractionMode.TASK);
    expect(budgets1.rules).toBe(10000); // High for constraints

    // Context should include sticky invariants
    const context = {
      has: (type: StickyInvariantType) => true, // All invariants present
    };
    const breach = detectInvariantBreach(context);
    expect(breach.breached).toBe(false);
  });

  it('should handle exploration to task transition', () => {
    // Exploration phase
    const mode1 = detectModeFromIntent('explore');
    expect(mode1).toBe(InteractionMode.EXPLORATION);

    // Transition to task
    const mode2 = detectModeFromIntent('task');
    expect(mode2).toBe(InteractionMode.TASK);

    // Budgets should change appropriately
    const budgets1 = getBudgets(mode1);
    const budgets2 = getBudgets(mode2);

    expect(budgets1.recent_window).toBeGreaterThan(budgets2.recent_window); // Exploration needs more history
    expect(budgets2.task_state).toBeGreaterThan(budgets1.task_state); // Task needs more state
  });

  it('should handle debugging mode with runtime fallback', () => {
    // Debugging mode detected
    const mode = detectModeFromIntent('debug');
    expect(mode).toBe(InteractionMode.DEBUGGING);

    // But if confidence is low, fallback to GENERAL
    const result = detectModeWithGuardrails(
      { intent: 'debug' },
      { getConfidence: () => 0.6 }
    );

    expect(result.mode).toBe(InteractionMode.GENERAL);
    expect(result.fallbackReason).toBe('low_confidence');
  });
});
