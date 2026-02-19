# Review: MODE_FILTERING_IMPLEMENTATION.md

**Date:** 2026-02-19  
**Target:** `docs/MODE_FILTERING_IMPLEMENTATION.md`  
**Review style:** Findings-first, five expert perspectives

## Expert 1: LLM Systems Researcher

### Findings (ordered by severity)

1. **Medium**: Performance claims are presented as measured facts without measurement artifacts.  
References: `docs/MODE_FILTERING_IMPLEMENTATION.md:114`, `docs/MODE_FILTERING_IMPLEMENTATION.md:117`, `docs/MODE_FILTERING_IMPLEMENTATION.md:118`, `docs/MODE_FILTERING_IMPLEMENTATION.md:119`  
Issue: “Zero overhead,” compile time, and test time are asserted but not linked to benchmark method/logs.  
Recommendation: Attach measurement procedure and outputs, or relabel as estimates.

2. **Medium**: Test breakdown count mismatch in the summary.  
References: `docs/MODE_FILTERING_IMPLEMENTATION.md:44`, `tests/unit/mode-detection.test.ts:21`  
Issue: Doc says “Mode detection: 8 tests,” but the `detectModeFromIntent` block has 7 test cases.  
Recommendation: Correct the count or add the missing case.

3. **Low**: File-size claim is inaccurate.  
References: `docs/MODE_FILTERING_IMPLEMENTATION.md:61`, `tests/unit/mode-detection.test.ts:299`  
Issue: Doc claims “350+ lines” for the test file; actual file length is under 300 lines.  
Recommendation: Update or remove line-count claims.

## Expert 2: Backend Architecture Reviewer (agent_memory_v2)

### Findings (ordered by severity)

1. **High**: Guardrail and invariant logic are documented as implemented but not integrated into runtime `buildACB()`.  
References: `docs/MODE_FILTERING_IMPLEMENTATION.md:19`, `docs/MODE_FILTERING_IMPLEMENTATION.md:27`, `src/core/orchestrator.ts:458`, `src/core/mode-detection.ts:205`, `src/core/mode-detection.ts:255`  
Issue: Orchestrator calls `detectModeFromIntent()` directly and does not invoke `detectModeWithGuardrails()` or `detectInvariantBreach()`.  
Recommendation: Wire guardrail/invariant checks into `buildACB()` or explicitly mark them as not yet integrated.

2. **Medium**: “Integration scenario tests” language overstates current coverage depth.  
References: `docs/MODE_FILTERING_IMPLEMENTATION.md:32`, `tests/unit/mode-detection.test.ts:251`  
Issue: Scenarios are utility-level tests; no direct `buildACB()` integration test is present.  
Recommendation: Add orchestrator-level integration tests and adjust doc wording until then.

## Expert 3: Testing & Quality Engineering

### Findings (ordered by severity)

1. **High**: Unit tests validate helpers but do not validate end-to-end orchestrator behavior.  
References: `docs/MODE_FILTERING_IMPLEMENTATION.md:32`, `tests/unit/mode-detection.test.ts:8`, `src/core/orchestrator.ts:446`  
Issue: No test confirms that mode-aware budgets and mode output in `buildACB()` behave as documented.  
Recommendation: Add integration tests that call `buildACB()` with mocked dependencies and verify mode routing/budget effects.

2. **Medium**: Test-result taxonomy is slightly misleading.  
References: `docs/MODE_FILTERING_IMPLEMENTATION.md:42`  
Issue: “Unit tested” is true for helper module, but document framing implies broader integration confidence than covered.  
Recommendation: Split “utility unit tests passed” vs “orchestrator integration pending.”

## Expert 4: Product & UX Documentation Reviewer

### Findings (ordered by severity)

1. **High**: Next steps are actionable only at headline level.  
References: `docs/MODE_FILTERING_IMPLEMENTATION.md:123`  
Issue: Steps lack owners, explicit acceptance criteria, and target dates.  
Recommendation: Add owner + exit criteria for each next step.

2. **Medium**: Usage section states outcomes but not observable behavior deltas.  
References: `docs/MODE_FILTERING_IMPLEMENTATION.md:90`  
Issue: “Optimized for task/exploration” does not specify concrete changed budget dimensions for reviewers.  
Recommendation: Include a compact before/after budget diff by mode.

3. **Medium**: Reproducibility context for test result is missing in doc body.  
References: `docs/MODE_FILTERING_IMPLEMENTATION.md:42`  
Issue: No explicit command/environment details adjacent to the test summary.  
Recommendation: Add the exact command and runtime context used to produce the reported result.

## Expert 5: Reliability & Safety Engineer

### Findings (ordered by severity)

1. **High**: Safety posture is overstated because fallback guardrails are dormant in production path.  
References: `docs/MODE_FILTERING_IMPLEMENTATION.md:19`, `docs/MODE_FILTERING_IMPLEMENTATION.md:37`, `src/core/orchestrator.ts:458`, `src/core/mode-detection.ts:205`  
Issue: Confidence/drift/error-rate fallback is only tested, not wired into runtime mode selection.  
Recommendation: Integrate guardrail invocation with telemetry hooks and expose `fallbackReason` in observability.

2. **High**: Sticky invariants are declared “never-drop” but not enforced by `buildACB()`.  
References: `docs/MODE_FILTERING_IMPLEMENTATION.md:24`, `src/core/mode-detection.ts:172`, `src/core/mode-detection.ts:255`, `src/core/orchestrator.ts:446`  
Issue: No runtime breach check protects against missing critical invariants before returning ACB.  
Recommendation: Enforce invariant checks in ACB assembly and fail-safe to `GENERAL`/alert on breach.

3. **Medium**: Monitoring plan is aspirational without current metric emission points.  
References: `docs/MODE_FILTERING_IMPLEMENTATION.md:75`, `docs/MODE_FILTERING_IMPLEMENTATION.md:128`  
Issue: Doc recommends monitoring mode distribution/confidence, but current code path does not emit those runtime signals.  
Recommendation: Define and implement concrete metrics/events prior to staging rollout claim.

## Consolidated Top Priorities

1. Correct documentation to distinguish implemented runtime behavior from helper-only readiness.  
2. Wire `detectModeWithGuardrails()` and invariant enforcement into `buildACB()` before claiming safe staging rollout.  
3. Add true orchestrator integration tests (`buildACB()` path), not only helper-level tests.  
4. Tighten evidence and reproducibility claims (timings, counts, environment, ownership).

## Residual Risk If Unchanged

The implementation doc currently reads as deployment-ready, but runtime safety controls and end-to-end verification are not fully integrated. This creates a high risk of false confidence during staging rollout.
