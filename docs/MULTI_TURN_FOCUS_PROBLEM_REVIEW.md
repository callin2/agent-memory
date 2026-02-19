# Review: MULTI_TURN_FOCUS_PROBLEM.md

**Date:** 2026-02-19  
**Target:** `docs/MULTI_TURN_FOCUS_PROBLEM.md`  
**Review style:** Findings-first, five expert perspectives

## Expert 1: LLM Systems Researcher

### Findings (ordered by severity)

1. **High**: Causal claim still overreaches evidence in the executive summary.  
References: `docs/MULTI_TURN_FOCUS_PROBLEM.md:25`, `docs/MULTI_TURN_FOCUS_PROBLEM.md:29`, `docs/MULTI_TURN_FOCUS_PROBLEM.md:33`  
Issue: The draft moves from observed degradation to “reliability collapse due to signal-to-noise degradation” without direct measurement of signal-to-noise or causal isolation.  
Recommendation: Keep this as a hypothesis in summary language unless supported by direct instrumentation evidence.

2. **Medium**: H1 mechanism description needs stronger validation linkage.  
References: `docs/MULTI_TURN_FOCUS_PROBLEM.md:76`, `docs/MULTI_TURN_FOCUS_PROBLEM.md:98`, `docs/MULTI_TURN_FOCUS_PROBLEM.md:107`  
Issue: Self-contamination is plausible but currently framed with stronger confidence than measured evidence.  
Recommendation: Add explicit planned instrumentation for error propagation and model-self-attention effects, or weaken certainty language.

3. **Low**: Anecdotal source is still close to core argumentation path.  
References: `docs/MULTI_TURN_FOCUS_PROBLEM.md:31`, `docs/MULTI_TURN_FOCUS_PROBLEM.md:49`  
Issue: Even labeled anecdotal, it may be interpreted as corroborative evidence for causal claims.  
Recommendation: Position it strictly as user-perception context, not causal support.

## Expert 2: Backend Architecture Reviewer (agent_memory_v2)

### Findings (ordered by severity)

1. **Medium**: Baseline filtering description overstates scope/project support.  
References: `docs/MULTI_TURN_FOCUS_PROBLEM.md:200`, `src/core/orchestrator.ts:6`, `src/core/orchestrator.ts:200`, `src/core/orchestrator.ts:221`  
Issue: Doc claims per-call filtering includes scope/project, but current retrieval path consumes subject/channel/sensitivity/token limits; `project_id` is defined on request and not used in retrieval query path.  
Recommendation: Update wording to match implemented filters, or implement and reference explicit scope/project filtering.

## Expert 3: Evaluation & Experimentation Lead

### Findings (ordered by severity)

1. **High**: Primary metric definitions are still too loose for strict decision-rule enforcement.  
References: `docs/MULTI_TURN_FOCUS_PROBLEM.md:439`, `docs/MULTI_TURN_FOCUS_PROBLEM.md:474`, `docs/MULTI_TURN_FOCUS_PROBLEM.md:484`  
Issue: “Automated test OR human judgment” leaves adjudication ambiguity for pass/fail under 95% confidence criteria.  
Recommendation: Pre-register exact adjudication hierarchy, rubric, and tie-break policy.

2. **High**: Power plan does not address likely clustering/stratification effects in analysis.  
References: `docs/MULTI_TURN_FOCUS_PROBLEM.md:454`, `docs/MULTI_TURN_FOCUS_PROBLEM.md:468`  
Issue: Sample-size estimate is presented as scalar while design is stratified and blocked; variance inflation may be underestimated.  
Recommendation: Recompute power with the intended model (stratified/blocked, tenant clustering assumptions).

3. **Medium**: Token-budget analyses need a clearly designated confirmatory primary analysis.  
References: `docs/MULTI_TURN_FOCUS_PROBLEM.md:491`, `docs/MULTI_TURN_FOCUS_PROBLEM.md:507`  
Issue: Current success logic can invite post-hoc interpretation across two analyses.  
Recommendation: Pre-declare matched-budget analysis as confirmatory and free-budget as supportive.

## Expert 4: Product & UX Documentation Reviewer

### Findings (ordered by severity)

1. **High**: Executive metrics need operational definitions inline for cross-functional readers.  
References: `docs/MULTI_TURN_FOCUS_PROBLEM.md:25`, `docs/MULTI_TURN_FOCUS_PROBLEM.md:28`  
Issue: “Intelligence decrease 15%” and “error variability +112%” are high-impact claims without short definitions where first introduced.  
Recommendation: Add one-line metric definitions and exact table/figure anchoring at first mention.

2. **Medium**: Statistical confidence phrasing is ambiguous for non-experiment owners.  
References: `docs/MULTI_TURN_FOCUS_PROBLEM.md:450`  
Issue: “95% confidence” lacks explicit test semantics in this section.  
Recommendation: Add plain-language interpretation and pointer to exact test method in the same section.

3. **Medium**: Stage ownership and activation criteria are under-specified in classifier transition text.  
References: `docs/MULTI_TURN_FOCUS_PROBLEM.md:242`, `docs/MULTI_TURN_FOCUS_PROBLEM.md:259`  
Issue: Stage 1/2 logic is clear technically, but operational owners and “ready-to-ship” gate conditions are distributed across sections.  
Recommendation: Add a compact owner-and-gate table in the roadmap section.

## Expert 5: Reliability & Safety Engineer

### Findings (ordered by severity)

1. **High**: Runtime guardrails for misclassification are not explicit enough before routing context by mode.  
References: `docs/MULTI_TURN_FOCUS_PROBLEM.md:395`, `docs/MULTI_TURN_FOCUS_PROBLEM.md:511`, `docs/MULTI_TURN_FOCUS_PROBLEM.md:540`  
Issue: Offline classifier thresholds are defined, but live drift/misclassification monitoring and automatic fallback triggers are not fully specified.  
Recommendation: Add runtime mode-agreement telemetry, alert thresholds, and auto-fallback to `GENERAL` when confidence or drift breaches bounds.

2. **Medium**: Annotation quality controls need explicit reliability gates.  
References: `docs/MULTI_TURN_FOCUS_PROBLEM.md:484`  
Issue: Human + LLM-as-judge pipeline is defined, but inter-rater reliability and calibration stop conditions are missing.  
Recommendation: Add agreement thresholds and pause criteria when labeling quality drops.

3. **Medium**: “Safety-critical failure” needs machine-detectable definition.  
References: `docs/MULTI_TURN_FOCUS_PROBLEM.md:551`, `docs/MULTI_TURN_FOCUS_PROBLEM.md:555`  
Issue: Rollback trigger exists, but no concrete detector is specified for sticky invariant violations.  
Recommendation: Define exact invariant breach events and monitoring checks tied to rollback automation.

## Consolidated Top Priorities

1. Tighten causal language in the summary to match current evidence strength.  
2. Correct the baseline filtering description to match implemented retrieval filters.  
3. Lock experiment adjudication details (metric definitions, analysis model, confirmatory test).  
4. Add production-grade runtime guardrails for mode routing, annotation quality, and invariant-breach rollback.

## Residual Risk If Unchanged

The v0.2 draft is substantially improved and near implementation-ready, but evidence wording, baseline architecture precision, and live safety telemetry remain the main risks to decision quality and rollout safety.
