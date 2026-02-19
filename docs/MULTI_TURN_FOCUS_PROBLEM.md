# Multi-Turn Focus Problem: A Two-Level Discrimination Pattern

**Date:** 2026-02-19
**Authors:** Callin + Claude (Thread)
**Version:** 0.3 (Revised after Round 2 Expert Review)
**Status:** Internal Draft - For Review

## Changelog

### v0.3 (Round 2 Review)
- Weakened causal language in executive summary to match evidence strength
- Added inline metric definitions in executive summary for cross-functional readers
- Added planned instrumentation for H1 validation
- Positioned anecdotal source as user-perception context only
- Corrected baseline filtering description (removed unsupported scope/project claims)
- Added exact adjudication hierarchy for primary metrics
- Recomputed power analysis with stratification/clustering effects
- Pre-declared matched-budget as confirmatory analysis
- Added runtime guardrails (telemetry, alerts, auto-fallback)
- Added annotation quality controls (agreement thresholds, pause criteria)
- Defined machine-detectable safety-critical failures
- Added stage ownership table with ready-to-ship gates

### v0.2 (Round 1 Review)
- Added evidence type tags to all claims (paper-reported / inferred / anecdotal)
- Reframed "context accumulation" as operational model with stated assumptions
- Added competing hypotheses to core causal claim
- Corrected baseline system description (capsules conditional, existing filtering acknowledged)
- Added falsifiable hypothesis with explicit decision rules
- Added detailed experiment design (randomization, metrics, safety gates)
- Defined sticky invariants for context pruning
- Specified mode taxonomy with label policy
- Added rollout safety criteria

---

## Executive Summary

**[PAPER-REPORTED]** Microsoft Research and Salesforce analyzed 200K+ conversations across 15 top LLMs (arxiv:2505.06120). Finding: Single-turn performance ~90%, multi-turn drops to ~65%.

**Metric Definitions:**
- **Performance:** Task completion rate (completed tasks / total tasks)
- **Intelligence decrease:** Model's capability score drops from 100% to 85%
- **Error variability:** Standard deviation of error rates across conversations increases by 112%

**[INFERRED]** This pattern suggests the problem may be reliability collapse rather than pure capability loss, but direct measurement of signal-to-noise degradation is needed to confirm.

**[USER-PERCEPTION]** Korean blogger's observation: Multi-turn conversations feel "blocked" with context drift; single comprehensive prompts feel more stable. (Note: This is user experience context, not causal evidence.)

This document proposes:
1. An **operational model** for multi-turn degradation (context accumulation hypothesis)
2. A **two-level discrimination pattern** for memory systems (mode detection + context filtering)
3. A **rigorous experiment** to test whether this approach improves multi-turn reliability

---

## Part 1: The Problem

### 1.1 What the Study Found

**[PAPER-REPORTED - arxiv:2505.06120, Table 2]**

| Metric | Single-Turn | Multi-Turn | Change |
|--------|-------------|------------|--------|
| Performance | 90% | 65% | -25% |
| Intelligence | 100% | 85% | -15% |
| Error Variability | Baseline | +112% | **+112%** |

**[USER-PERCEPTION]** Blogger's translated observations:
- Multi-turn: "Blocked feeling, context drift, increasing errors"
- Single comprehensive: "Stable, accurate performance"
- Perceived cause: "Models make answers before finishing, obsess over initial assumptions, forget mid-conversation conditions"

**Note:** User perception is valuable for motivating the problem but is not presented as causal evidence for any specific mechanism.

### 1.2 Our Operational Model

**[INFERRED]** Every LLM API call is single-turn at the protocol level:

```
Call 1: [initial_prompt] → response
Call 2: [previous_conversation + new_prompt] → response
Call 3: [more_previous_conversation + new_prompt] → response
```

**[MODEL ASSUMPTION]** What we call "multi-turn conversation" is **context accumulation into each new API call**.

**Limitations of this model:**
- Assumes context is passed via conversation history (not true for all systems)
- Does not account for tool/runtime effects
- Does not account for planner behavior or policy interactions
- May not apply to architectures with explicit state management

### 1.3 Competing Hypotheses

We propose **H1 as primary** but acknowledge **alternatives**:

**H1 (Context Accumulation):** Self-contamination from previous model outputs causes reliability collapse
- **Prediction:** Performance degrades with number of previous turns included
- **Test:** Ablation on number of previous turns
- **Confounder to rule out:** Context length effects (control for token count)
- **[PLANNED INSTRUMENTATION]** Error propagation tracking, attention weight analysis on previous turns

**H2 (Context Length):** Longer contexts inherently reduce performance independent of content
- **Prediction:** Performance correlates with token count, not turn count
- **Test:** Match token count across single-turn and multi-turn
- **Confounder to rule out:** Retrieval noise (use synthetic context)

**H3 (Policy Interference):** Multi-turn triggers different model behaviors (e.g., conversational niceties)
- **Prediction:** Performance degradation is task-independent
- **Test:** Compare tasks with/without conversational framing
- **Confounder to rule out:** Task difficulty differences

**H4 (Evaluation Artifact):** Multi-turn evaluations are inherently harder or scored differently
- **Prediction:** Effect disappears with controlled evaluation design
- **Test:** Blind evaluation with balanced task difficulty
- **Confounder to rule out:** Human rater bias

### 1.4 H1 Mechanism (with Validation Plan)

**H1 Proposed Mechanism:**
- **Single comprehensive prompt:** Clean context (user-provided only), minimal self-contamination
- **Multi-turn accumulation:** Context includes previous model outputs (which may contain errors, wrong assumptions)
- **Plausible consequence:** Each turn builds on previous → errors compound → signal-to-noise degrades

**[VALIDATION PLAN]** To strengthen from "plausible" to "supported":
1. **Error propagation tracking:** Instrument system to trace when errors in turn N appear in context for turn N+1
2. **Attention analysis:** Log attention weights to detect model attending to its own previous outputs
3. **Signal-to-noise measurement:** Define and measure signal (task-relevant tokens) vs noise (irrelevant context) in each turn

**Current status:** Mechanism is plausible but requires instrumentation evidence to move from "inferred" to "supported."

---

## Part 2: The Pattern

### 2.1 Two Levels, Same Architecture

**Layer 1 - Interaction Mode Level**
```
[Input] → [Detect Mode] → [Filter for Mode] → [Output]
```
- Discriminates: What KIND of interaction is this?
- Task mode vs Exploration mode
- Different retention rules

**Layer 2 - Context Level**
```
[Context] → [Discriminate] → [Keep Signal] → [Drop Noise] → [Next API Call]
```
- Discriminates: What in the context matters?
- Signal vs Noise
- Maintain high signal-to-noise ratio

**[INFERRED]** Both solve the same problem: Focus via filtering.

### 2.2 Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                   Level 1: Mode Detection                   │
├─────────────────────────────────────────────────────────────┤
│  Input: User request + existing intent field                │
│  Process: Classify interaction type                         │
│  Output: Mode label (TASK | EXPLORATION | DEBUG | LEARN)    │
│  Runtime: Telemetry, drift detection, auto-fallback         │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                   Level 2: Context Filtering                 │
├─────────────────────────────────────────────────────────────┤
│  Input: Accumulated context + mode label                    │
│  Process: Filter based on mode + sticky invariants          │
│  Output: Clean context for next API call                    │
│  Runtime: Invariant breach detection → rollback             │
│                                                             │
│  Example filters:                                           │
│  - TASK mode: Keep goal, constraints, progress state        │
│  - EXPLORATION mode: Keep insights, decisions, open questions│
│  - STICKY: Never drop safety reqs, latest corrections       │
└─────────────────────────────────────────────────────────────┘
                              ↓
                        [API Call]
```

### 2.3 Mode Taxonomy (Proposed)

**Label Policy:**
- **Primary mode:** One label per request (mutually exclusive for initial classification)
- **Precision target:** ≥85% (measured via held-out annotated set)
- **Recall target:** ≥80% (minimize mode confusion)
- **Fallback:** GENERAL mode if classifier confidence < threshold

**Mode Definitions:**

| Mode | Trigger Examples | What to Keep | What to Drop |
|------|------------------|--------------|--------------|
| TASK | "Implement X", "Fix bug Y", "Add feature Z" | Goal, constraints, current state, safety reqs | Exploration history, speculative options |
| EXPLORATION | "Thinking about X", "What if Y", "Let's explore" | Recent window, insights found, decisions made, open questions | Task details, implementation noise |
| DEBUGGING | "Error in X", "Why does Y fail", "Stack trace Z" | Error events, recent changes, known constraints | Successful task history |
| LEARNING | "Teach me X", "How does Y work", "Explain Z" | Principles, examples, patterns | Recent conversation (clutter) |
| GENERAL | (fallback) | Conservative defaults | Minimal filtering |

**Mixed-Mode Handling:**
- **Mode transitions:** Re-classify on each turn
- **Ambiguous inputs:** Use GENERAL with full context
- **Confidence thresholds:** If <70% confidence, use GENERAL mode

---

## Part 3: Application to Memory Systems

### 3.1 Current System (agent_memory_v2)

**Architecture:**
```
Session → Events → Chunks (DB)
                  ↓
         Consolidation (long-term: 30/90/180 days)
                  ↓
         buildACB → Active Context Bundle
                  ↓
         API call with context
```

**Current consolidation:**
- ✅ Long-term (days/weeks/months)
- ✅ Progressive compression (full → summary → quick_ref → integrated)
- ✅ **Per-call filtering exists** (sensitivity, query match, subject/channel, token budgets)
- ❌ No **mode-aware** per-call filtering

**buildACB section composition:**
```typescript
// From src/core/orchestrator.ts:454-461
const budgets = {
  rules: 6000,
  task_state: 3000,
  recent_window: 8000,
  capsules: include_capsules ? 4000 : 0,  // ← CONDITIONAL
  retrieved_evidence: 28000,
  relevant_decisions: 4000,
};

// Current filtering (implemented in orchestrator.ts):
// - Sensitivity filtering by channel (getAllowedSensitivity)
// - Text-search matching (tsquery on text fields)
// - Subject type filtering (subject_type parameter)
// - Token budget limits (section-level budget enforcement)
// - Capsule conditional inclusion (include_capsules flag)
//
// Note: project_id is defined on ACBRequest but not currently used
// in retrieval queries. Future work: add project-based filtering.
```

**Gap:** No mode-aware section selection or content filtering.

### 3.2 Proposed Enhancement

#### Enhancement 1: Bootstrap from Existing Intent Field

**[EXISTING CODE]** `ACBRequest.intent` field already exists:

```typescript
// From src/core/orchestrator.ts:11
interface ACBRequest {
  intent: string;  // ← Already available
  // ... other fields
}
```

**Proposed mapping (staged implementation):**

```typescript
// Stage 1: Direct intent mapping (no classifier needed)
function detectModeFromIntent(intent: string): InteractionMode {
  const modeMap: Record<string, InteractionMode> = {
    'task': TASK,
    'debug': DEBUGGING,
    'explore': EXPLORATION,
    'learn': LEARNING,
    'general': GENERAL,
    // ... extend based on observed intents
  };

  return modeMap[intent] || GENERAL;
}

// Stage 2: Add classifier for unclassified intents
function detectMode(request: ACBRequest): InteractionMode {
  // Try intent mapping first
  const fromIntent = detectModeFromIntent(request.intent);
  if (fromIntent !== GENERAL) return fromIntent;

  // Fall back to classifier (future work)
  return classifyMode(request);
}
```

#### Enhancement 2: Mode-Aware Budget Allocation

```typescript
// Current: Fixed budgets for all requests
const budgets = {
  rules: 6000,
  task_state: 3000,
  recent_window: 8000,
  // ...
};

// Proposed: Mode-aware budgets
function getBudgets(mode: InteractionMode) {
  switch(mode) {
    case TASK:
      return {
        rules: 10000,           // High: constraints critical
        task_state: 5000,        // High: current state
        recent_window: 2000,     // Low: minimal history
        retrieved_evidence: 28000, // High: need specifics
        relevant_decisions: 4000,  // Medium
        capsules: 4000,
      };

    case EXPLORATION:
      return {
        rules: 3000,            // Low: not constrained
        task_state: 1000,        // Low: no active task
        recent_window: 15000,    // High: maintain thread
        retrieved_evidence: 35000, // High: gather info
        relevant_decisions: 6000,  // High: what we decided
        capsules: 2000,
      };

    case DEBUGGING:
      return {
        rules: 5000,
        task_state: 4000,        // Medium: what we were doing
        recent_window: 12000,    // High: what just happened
        retrieved_evidence: 25000, // High: error context
        relevant_decisions: 3000,
        capsules: 0,
      };

    case LEARNING:
      return {
        rules: 8000,            // Medium: principles
        task_state: 0,           // None: not doing
        recent_window: 2000,     // Low: don't clutter
        retrieved_evidence: 40000, // Very high: examples
        relevant_decisions: 8000, // High: principles
        capsules: 2000,
      };

    case GENERAL:  // Fallback
      return {
        rules: 6000,
        task_state: 3000,
        recent_window: 8000,
        retrieved_evidence: 28000,
        relevant_decisions: 4000,
        capsules: 4000,
      };
  }
}
```

#### Enhancement 3: Sticky Invariants (Never-Drop Rules)

**Problem:** Aggressive filtering can drop critical information.

**Solution:** Define sticky invariants that are NEVER dropped:

```typescript
interface StickyInvariant {
  type: string;
  rule: string;
  priority: number;  // Higher = more sticky
}

const STICKY_INVARIANTS: StickyInvariant[] = [
  {
    type: 'safety_requirement',
    rule: 'Never drop safety-critical constraints',
    priority: 1000,
  },
  {
    type: 'user_correction',
    rule: 'Latest user correction always included',
    priority: 900,
  },
  {
    type: 'hard_constraint',
    rule: 'Explicit "must" or "must not" requirements',
    priority: 800,
  },
  {
    type: 'blocking_error',
    rule: 'Current blocking errors',
    priority: 700,
  },
];

function applyStickyInvariants(
  context: ContextBundle,
  mode: InteractionMode
): ContextBundle {
  // Ensure invariants are present regardless of mode filtering
  for (const invariant of STICKY_INVARIANTS) {
    if (!context.has(invariant.type)) {
      context.add(invariant);
    }
  }
  return context;
}
```

**Implementation inside existing buildACB:**

```typescript
export async function buildACB(
  pool: Pool,
  request: ACBRequest
): Promise<ACBResponse> {
  // NEW: Detect mode from intent
  const mode = detectModeFromIntent(request.intent);

  // NEW: Get mode-aware budgets
  const budgets = getBudgets(mode);

  // NEW: Build sections with mode awareness
  // (existing section builders now receive mode parameter)
  const sections: ACBSection[] = [];

  // Section builders filter content based on mode
  if (mode === TASK) {
    // Task mode: minimal history, focus on current
    sections.push(await buildRulesSection(..., budgets.rules));
    sections.push(await buildTaskStateSection(..., budgets.task_state));
    sections.push(await buildMinimalRecentWindow(..., budgets.recent_window));
    // ...
  } else if (mode === EXPLORATION) {
    // Exploration mode: rich history, insights
    sections.push(await buildRulesSection(..., budgets.rules));
    sections.push(await buildRichRecentWindow(..., budgets.recent_window));
    sections.push(await buildDecisionsSection(..., budgets.relevant_decisions));
    // ...
  }

  // NEW: Apply sticky invariants
  const context = applyStickyInvariants({ sections }, mode);

  return {
    acb_id,
    budget_tokens: sumBudgets(budgets),
    token_used_est: calculateTotal(sections),
    sections: context.sections,
    mode,  // NEW: Track mode in response
    // ... other fields
  };
}
```

---

## Part 4: Experiment Design

### 4.1 Falsifiable Hypothesis

**Primary Hypothesis (H1):**
> Mode-aware context filtering reduces multi-turn reliability collapse compared to baseline (current buildACB).

**Predictions:**
1. Multi-turn task completion rate with mode-aware filtering ≥ multi-turn baseline + 10%
2. Multi-turn error rate with mode-aware filtering ≤ multi-turn baseline - 15%
3. Improvement is NOT explained by context length reduction alone

**Decision Rule:**
- **Success:** (1) AND (2) AND (3) with 95% confidence
- **What "95% confidence" means:** If we ran this experiment 100 times, we'd expect the true effect to be in our confidence interval in 95 of them. We use a two-proportion z-test with α=0.05.
- **Failure:** Any prediction fails with statistical significance (p < 0.05)
- **Inconclusive:** Insufficient power or conflicting results

### 4.2 A/B Test Design

**Randomization:**
- **Unit:** Conversation (session_id)
- **Stratification:** Mode (observed from baseline), task difficulty (easy/medium/hard)
- **Blocking:** Model version, tenant_id
- **Ratio:** 50% treatment (mode-aware), 50% control (baseline)

**Contamination Prevention:**
- Each session assigned to treatment or control at first turn
- No mid-experiment switching
- Separate evaluation pools to prevent rater bias

**Power Analysis (Recomputed with Stratification):**

**Analysis Model:** Stratified two-sample test of proportions (accounting for mode and difficulty strata, tenant clustering)

**Parameters:**
- **Effect size:** 10% relative improvement (conservative)
- **Baseline completion:** 65% (from paper)
- **Target completion:** 71.5%
- **Alpha:** 0.05 (two-sided)
- **Power:** 0.80
- **Stratification adjustment:** +15% sample size for variance inflation
- **Clustering adjustment (ICC=0.05, avg cluster size=5):** +20% sample size
- **Required samples:** ~1,400 conversations per arm (2,800 total)

**Note:** This is larger than the v0.2 estimate due to stratification and clustering effects.

### 4.3 Metrics Operationalization

| Metric | Definition | Numerator | Denominator | Type | Adjudication |
|--------|------------|-----------|------------|------|--------------|
| Task completion | Task fully completed without intervention | Completed tasks | Total tasks | Primary | Auto test → Human tie-break → Human panel |
| Error rate | Responses containing hallucinations, logic errors, or broken code | Error responses | Total responses | Primary | LLM-judge → Human validate 10% |
| Context size | Token count of injected context | Sum of context tokens | Total API calls | Secondary | Auto counter |
| Focus maintenance | Human-rated focus quality (1-5 scale) | Sum of ratings | Number rated | Secondary | 3 raters, take median |

**Adjudication Hierarchy (Pre-registered):**

**Task Completion:**
1. **Level 1:** Automated test (if task has testable output)
2. **Level 2:** Single human rater (if auto test fails)
3. **Level 3:** Panel of 3 human raters (if Level 2 disagree with expected outcome)
4. **Tie-break:** Mean of panel scores, round to nearest integer

**Error Rate:**
1. **Level 1:** LLM-as-judge classification (GPT-4 with prompt)
2. **Level 2:** Human validation on 10% random sample
3. **Quality gate:** If human validation disagrees with LLM-judge by >10%, pause labeling and investigate
4. **Final metric:** LLM-judge rate, validated by human sample

**Annotation Quality Controls:**
- **Inter-rater agreement target:** Cohen's κ ≥ 0.70 for human raters
- **Calibration check:** Weekly review of 20 random samples by lead rater
- **Pause criteria:** If κ < 0.60 for 2 consecutive weeks, stop labeling and recalibrate

**Primary vs Secondary:**
- **Primary:** Used for decision rule, pre-registered
- **Secondary:** Exploratory, not for go/no-go decision

### 4.4 Token Budget Confounding

**Problem:** Smaller contexts might appear better regardless of filtering quality.

**Solution:** Two analyses, ONE pre-registered as confirmatory

**Analysis 1: Matched Budget [CONIRMATORY]**
- Control: Current buildACB (average token count T_control)
- Treatment: Mode-aware buildACB with same budget T_control
- **Question:** Does mode-aware filtering help at same token count?
- **Decision rule:** This analysis MUST show improvement for success

**Analysis 2: Free Budget [SUPPORTIVE]**
- Control: Current buildACB
- Treatment: Mode-aware buildACB (optimized budgets, possibly smaller)
- **Question:** Does mode-aware filtering reduce token use while maintaining quality?
- **Purpose:** Exploratory, used for cost-benefit analysis only

**Success requires:** Analysis 1 (confirmatory) shows improvement. Analysis 2 is supportive but not required for success.

### 4.5 Classifier Quality Evaluation

**Risk:** Mode misclassification could erase gains.

**Mitigation:** Separate classifier evaluation before main experiment

**Classifier Test Protocol:**
1. **Dataset:** 500 labeled examples (100 per mode)
2. **Split:** 400 train, 100 test
3. **Metrics:** Precision, recall, F1 per mode
4. **Thresholds:**
   - Minimum precision: 85%
   - Minimum recall: 80%
   - Minimum F1: 82%
5. **Failure mode:** If thresholds not met, use GENERAL fallback (no filtering)

**Safe Fallback Policy:**
```typescript
function detectModeSafe(request: ACBRequest): InteractionMode {
  const mode = classifyMode(request);
  const confidence = getConfidence(mode);

  // If uncertain, use GENERAL (minimal filtering)
  if (confidence < 0.70) {
    return GENERAL;
  }

  return mode;
}
```

### 4.6 Runtime Guardrails (Production-Grade)

**Mode Routing Safety:**

**Telemetry (logged per request):**
- Assigned mode
- Classifier confidence
- Intent source (mapped vs classified)
- Context token count by section
- Sticky invariants applied

**Drift Detection:**
- **Metric:** Mode distribution shift (KL divergence from baseline)
- **Alert threshold:** KL > 0.1 for 1 hour
- **Action:** Auto-fallback to GENERAL, alert on-call

**Misclassification Monitoring:**
- **Metric:** Low-confidence rate (<70% confidence)
- **Alert threshold:** >30% low-confidence for 30 minutes
- **Action:** Investigate classifier, consider retraining

**Auto-Fallback Triggers:**
```typescript
function detectModeWithGuardrails(request: ACBRequest): InteractionMode {
  const mode = classifyMode(request);
  const confidence = getConfidence(mode);

  // Trigger 1: Low confidence
  if (confidence < 0.70) {
    logTelemetry('fallback_low_confidence', { mode, confidence });
    return GENERAL;
  }

  // Trigger 2: Drift detected
  if (detectDrift(mode)) {
    logTelemetry('fallback_drift', { mode });
    return GENERAL;
  }

  // Trigger 3: High error rate for this mode
  if (getModeErrorRate(mode) > 2 * getBaselineErrorRate()) {
    logTelemetry('fallback_errors', { mode });
    return GENERAL;
  }

  return mode;
}
```

### 4.7 Rollout Safety Gates

**Phased Rollout:**

| Phase | Traffic | Duration | Exit Criteria | Stop Conditions |
|-------|---------|----------|---------------|-----------------|
| Canary | 1% | 24h | No errors, latency <1.5x baseline, mode agreement ≥95% | Error rate >2x baseline OR invariant breach detected |
| Pilot | 10% | 1 week | Task completion ≥ baseline, no invariant breaches | Any safety-critical errors OR mode misclassification >10% |
| Gradual | 50% | 2 weeks | All metrics green, stable mode distribution | Rollback to pilot |
| Full | 100% | - | - | - |

**Rollback Triggers:**
- Error rate >2x baseline for 1 hour
- Task completion <0.9x baseline for 24 hours
- Latency >2x baseline for 6 hours
- **Safety-critical failure:** Invariant breach detected (see below)

**Invariant Breach Detection (Machine-Detectable):**

**Definition:** An invariant breach occurs when:
1. Context is constructed WITHOUT a sticky invariant that SHOULD be present
2. Specifically: safety_requirement, user_correction, hard_constraint, or blocking_error

**Detection Logic:**
```typescript
function detectInvariantBreach(context: ContextBundle): boolean {
  const requiredInvariants = STICKY_INVARIANTS.filter(i => i.priority >= 800);

  for (const invariant of requiredInvariants) {
    // Check if invariant type is marked as present
    if (!context.has(invariant.type)) {
      // Log breach
      logBreach({
        type: 'invariant_breach',
        missing: invariant.type,
        context_id: context.id,
        timestamp: Date.now(),
      });

      return true;  // Breach detected
    }
  }

  return false;  // No breach
}
```

**Rollback Automation:**
```typescript
// Run after each buildACB call in production
if (detectInvariantBreach(context)) {
  // Immediate rollback to baseline
  triggerRollback('invariant_breach');

  // Alert on-call
  sendAlert({
    severity: 'CRITICAL',
    message: 'Invariant breach detected - rolling back',
    context_id: context.id,
  });

  // Fallback to baseline for this session
  return buildACBBaseline(request);
}
```

**Rollback Owners:**
- **Technical:** Callin (system owner)
- **Decision:** Product (if user-facing)
- **Escalation:** CTO (if safety-critical)

### 4.8 Ablation Tests

**Test H1 (Context Accumulation) specifically:**

**Ablation 1: Number of Previous Turns**
- Control: All previous turns included
- Treatment 1: Only last 3 turns
- Treatment 2: Only last 1 turn
- Treatment 3: No previous turns (single-turn baseline)
- **Prediction:** Performance improves with fewer turns (if H1 true)

**Ablation 2: Content vs Length**
- Control: All context (N tokens)
- Treatment 1: Random subset of context (N tokens, same length)
- Treatment 2: Mode-filtered context (M tokens, M < N)
- Treatment 3: Mode-filtered context (N tokens, same length)
- **Prediction:** Treatment 3 > Treatment 1 (content matters, not just length)

---

## Part 5: Open Questions (Revised)

1. **Mode detection implementation:**
   - **[RESOLVED - Stage 1]** Use existing intent field with mapping
   - **[OPEN - Stage 2]** Build classifier for unmapped intents
   - **[OPEN]** Optimize confidence thresholds

2. **Signal extraction rules:**
   - **[OPEN]** Define what "signal" means per mode (need domain study)
   - **[OPEN]** Validate sticky invariants list (are we missing anything?)

3. **Mode transition handling:**
   - **[OPEN]** What to do when mode changes mid-conversation?
   - **[PROPOSED]** Re-classify each turn, use recent mode history for smoothing

4. **Evaluation infrastructure:**
   - **[OPEN]** Build benchmark dataset or instrument real usage
   - **[OPEN]** Set up LLM-as-judge pipeline for error rate measurement

5. **Production monitoring:**
   - **[OPEN]** Implement telemetry dashboard for mode routing
   - **[OPEN]** Set up alerting for drift and misclassification

---

## Part 6: Implementation Roadmap

### Stage Ownership and Ready-to-Ship Gates

| Phase | Owner | Ready-to-Ship Gate | Duration |
|-------|-------|-------------------|----------|
| 0: Preparation | ML Lead | Mode taxonomy doc + intent mapping table approved | Week 1 |
| 1: Bootstrap | Backend Lead | Unit tests pass + mode tracking in ACBResponse | Week 2 |
| 2: Classifier | ML Lead | Precision ≥85%, recall ≥80% on test set | Weeks 3-4 |
| 3: Integration | QA Lead | All integration tests pass + sticky invariants verified | Week 5 |
| 4: Experiment Setup | Data Lead | A/B infrastructure deployed + metrics pipeline validated | Week 6 |
| 5: Canary | DevOps + Backend Lead | 24h stable + exit criteria met + no breaches | Week 7 |
| 6: Full Experiment | Product + ML Lead | 2,800 conversations + decision rule evaluated | Weeks 8-10 |

### Phase 0: Preparation (Week 1)
- [ ] Create mode taxonomy document
- [ ] Build intent→mode mapping table
- [ ] Define sticky invariants
- [ ] Design classifier evaluation protocol
- **Owner:** ML Lead
- **Gate:** Document approved by stakeholders

### Phase 1: Bootstrap Implementation (Week 2)
- [ ] Implement `detectModeFromIntent()`
- [ ] Implement `getBudgets(mode)`
- [ ] Add sticky invariant checks to `buildACB()`
- [ ] Add mode tracking to ACBResponse
- **Owner:** Backend Lead
- **Gate:** Unit tests pass + mode tracking verified in logs

### Phase 2: Classifier Development (Weeks 3-4)
- [ ] Collect 500 labeled examples
- [ ] Train mode classifier
- [ ] Evaluate against thresholds (≥85% precision, ≥80% recall)
- [ ] Implement safe fallback (GENERAL if low confidence)
- **Owner:** ML Lead
- **Gate:** Classifier meets precision/recall thresholds

### Phase 3: Integration Testing (Week 5)
- [ ] Unit tests for mode detection
- [ ] Unit tests for budget allocation
- [ ] Integration tests for full buildACB flow
- [ ] Verify sticky invariants are never dropped (invariant breach detection)
- **Owner:** QA Lead
- **Gate:** All tests pass + invariant detection working

### Phase 4: Experiment Setup (Week 6)
- [ ] Set up A/B infrastructure
- [ ] Implement metrics collection (task completion, error rate, context size)
- [ ] Create annotation protocol (adjudication hierarchy)
- [ ] Run power analysis to confirm sample size (2,800 conversations)
- [ ] Set up telemetry dashboard
- **Owner:** Data Lead
- **Gate:** A/B system deployed + metrics pipeline validated

### Phase 5: Canary Launch (Week 7)
- [ ] Deploy to 1% traffic
- [ ] Monitor for 24 hours (telemetry dashboard active)
- [ ] Check exit criteria (no errors, latency, mode agreement)
- [ ] Check for invariant breaches
- **Owner:** DevOps + Backend Lead
- **Gate:** 24h stable + exit criteria met + no invariant breaches

### Phase 6: Full Experiment (Weeks 8-10)
- [ ] Run A/B test (target: 2,800 conversations)
- [ ] Collect metrics (primary: task completion, error rate)
- [ ] Monitor runtime guardrails (drift, misclassification, breaches)
- [ ] Analyze results against decision rules
- [ ] Document findings
- **Owner:** Product + ML Lead
- **Gate:** Decision rule evaluation complete + report delivered

---

## References

**[PAPER-REPORTED]**
- Microsoft Research & Salesforce: "Lost in Multi-Turn: Investigating Performance Degradation" (arXiv:2505.06120, Table 2, Figure 3)

**[USER-PERCEPTION]**
- Korean blogger analysis (private source, translated) - presented as user experience context, not causal evidence

**[CODE]**
- agent_memory_v2:
  - `src/services/consolidation.ts` - Long-term consolidation
  - `src/core/orchestrator.ts:442` - buildACB function
  - `src/core/orchestrator.ts:454` - Budget allocation
  - `src/core/orchestrator.ts:11` - ACBRequest.intent field

**[REVIEW]**
- Round 1 expert review: Initial findings
- Round 2 expert review: `docs/MULTI_TURN_FOCUS_PROBLEM_REVIEW.md` - Five expert perspectives

---

## Appendix: Example Scenarios

### Scenario 1: Task Mode with Sticky Invariants

```
User: "Implement user authentication with JWT"
[Mode: TASK (intent="task")]
[Context: rules (JWT constraint), task_state, sticky invariants]

User: "Actually, it must work with LDAP"  // ← Hard constraint
[Mode: TASK]
[Context: rules (JWT + LDAP - STICKY), task_state]
[Invariant check: LDAP requirement marked as sticky, will persist]
[Previous JWT discussion NOT included - noise]

User: "Add refresh tokens"
[Mode: TASK]
[Context: rules (JWT + LDAP - still STICKY), task_state (updated)]
[Invariant check: All sticky invariants present]
[Clean focus on current requirements, all hard constraints preserved]
```

### Scenario 2: Exploration to Task Transition

```
User: "I'm thinking about memory systems"
[Mode: EXPLORATION (intent="explore")]
[Context: recent_window, retrieved_evidence, decisions]

User: "The problem is context accumulation"
[Mode: EXPLORATION]
[Context: Discussion history, insights found]

User: "Let's implement mode detection"  // ← Mode shift
[Mode: TASK (intent changes)]
[Context: rules, task_state (new task)]
[Exploration history MINIMIZED but not lost (some insights preserved as decisions)]

[Note: Mode transition handled gracefully via re-classification]
```

### Scenario 3: Debugging Mode

```
User: "I'm getting an error in auth"
[Mode: DEBUGGING (intent="debug")]
[Context: recent_error_events, task_state (what we were doing), rules]

[Context includes: Stack traces, recent code changes, known constraints]
[Context excludes: Successful task history, exploration discussions]

User: "Here's the stack trace: [paste]"
[Mode: DEBUGGING]
[Context: Error details, recent changes, safety requirements (STICKY)]
[High-signal debugging context, minimal irrelevant history]
```

### Scenario 4: Runtime Guardrail Action

```
[System monitoring: Mode distribution shift detected]
[KL divergence: 0.15 > threshold 0.1]
[Action: Auto-fallback to GENERAL triggered]

User: "Continue with the task"
[Mode: GENERAL (fallback due to drift)]
[Context: Conservative defaults, full context]
[Alert sent: "Mode drift detected, using GENERAL fallback"]

[Later: Drift resolved, back to normal mode classification]
```

---

**Document Version:** 0.3
**Last Updated:** 2026-02-19
**Changes from v0.2:** See Changelog
**Reviewers:** [Pending Round 3]
