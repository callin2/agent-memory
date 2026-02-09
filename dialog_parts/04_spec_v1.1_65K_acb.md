나의 말:
yes i want formal spec. and scenario it through all our design principal and used for test which is scenario based test. I will try to scenario driven validation in this project  to test agentic developement keel align final goal

ChatGPT의 말:
Below is a formal spec v1 for an AI agent memory system that (a) persists almost all dialogue/events, (b) keeps active LLM context small via curation, and (c) is validated primarily through scenario-driven tests aligned to design principles.
I’m optimizing for: low complexity, filesystem-first, TypeScript-friendly, minimal dependencies, MCP/tool-call compatibility.

Memory System Spec v1 (Scenario-Driven)
0. Scope
0.1 In scope
Persist: near-total interactions (human↔agent, agent↔agent), tool I/O, decisions, artifacts.
Active context: per-call curated bundle under strict token budget.
Scenario-driven validation harness.
Filesystem-first storage, human-readable where feasible.
0.2 Out of scope (v1)
Full UI
Distributed consensus / multi-host replication
Training / finetuning
Real-time vector DB dependency (allowed as optional plugin later)
1. Design Principles (Normative)
P1. Ground truth is append-only. Never rewrite primary logs.
P2. Derived views are disposable. Indexes/summaries can be regenerated.
P3. Active context is a product. Context assembly is explicit, testable, budgeted.
P4. Traceability by reference. Any summary/decision must cite source event IDs.
P5. Least-privilege memory loading. Public/private separation; sensitive data not loaded by default.
P6. Human-legible override. Key memory views are readable/editable (markdown/yaml/json).
P7. Determinism where possible. Memory selection policy should be reproducible given inputs.
P8. Scenario-driven validation. Every feature exists to satisfy a scenario + measurable outcomes.
2. Terminology
Event Log (Ground Truth): Append-only record of everything.
Projection: Derived index/view (embeddings, BM25, summaries, decision ledger).
Memory View: Curated human-readable knowledge (rules, preferences, conventions).
Active Context Bundle (ACB): The per-call prompt payload assembled under a budget.
Scenario Test: Scripted interaction + expected memory outcomes.
3. Architecture Overview
3.1 Components
Recorder: writes events to ground truth log
Projector(s): generate projections from events
Context Orchestrator: builds Active Context Bundle (ACB) for an LLM call
Policy Engine: rules for privacy/budgets/loading/suppression
Scenario Harness: runs scenario scripts + asserts expected behavior
3.2 Data Flow (high-level)
Receive input (user/agent/tool)
Recorder appends event(s)
Projectors update projections (sync or async mode)
Orchestrator assembles ACB for next call
LLM call happens
Output becomes new events, loop continues
4. Storage Spec (Filesystem-first)
4.1 Directory layout (normative)
memory/
  manifest.json
  policies/
    privacy.yaml
    budgets.yaml
    channels.yaml
  views/
    identity.md
    rules.project.md
    preferences.md
    glossary.md
  events/
    2026-02/
      2026-02-09.jsonl
  projections/
    bm25.sqlite         (optional)
    vectors.sqlite      (optional)
    summaries/
      session/
      episode/
    decisions.jsonl
    tasks.jsonl
  artifacts/
    attachments/
    tool_outputs/
  scenarios/
    *.scenario.yaml
  reports/
    *.report.json
Notes:
events/ is ground truth (append-only)
views/ is human-curated canonical memory
projections/ are derived; can be deleted and rebuilt
4.2 Event format (jsonl) (normative)
Each line is an event:
{
  "id": "evt_20260209_000123",
  "ts": "2026-02-09T05:12:33+09:00",
  "channel": "private|public|team|agent",
  "actor": { "type": "human|agent|tool", "id": "user|agentA|tool.shell" },
  "kind": "message|tool_call|tool_result|decision|summary|task_update|artifact",
  "content": { "...": "..." },
  "refs": ["evt_..."], 
  "tags": ["topic:memory", "project:X"],
  "sensitivity": "none|low|high|secret",
  "hash": "sha256:..."
}
Requirements:
id unique and monotonic per day file (implementation detail ok)
hash allows integrity/dedup
sensitivity must be set for secrets/PII detection pipelines (even if simple heuristics in v1)
5. Memory Views (Human-controlled)
5.1 Mandatory views
views/identity.md: agent identity, tone constraints, stable behavior
views/rules.project.md: project conventions (coding style, architecture)
views/preferences.md: user preferences (if allowed to store)
views/glossary.md: canonical terms & abbreviations
5.2 Loading rules
Views are always candidates for ACB, but each has budget caps.
Privacy policy may suppress loading of certain views in public channels.
6. Projections (Derived)
6.1 Decision Ledger (mandatory)
Stored as projections/decisions.jsonl.
Schema (normative):

{
  "id": "dec_000045",
  "ts": "2026-02-09T05:30:00+09:00",
  "scope": "project|user|global",
  "decision": "Use event-sourced memory as ground truth",
  "rationale": ["auditability", "rebuildable projections"],
  "constraints": ["filesystem-first", "TypeScript"],
  "alternatives": ["pure summarization", "only vector DB"],
  "consequences": ["append-only growth", "need compaction in projections"],
  "refs": ["evt_20260209_000120", "evt_20260209_000121"],
  "status": "active|superseded",
  "confidence": 0.74
}
Rules:
Every decision must cite source events via refs.
Superseding a decision must reference previous decision ID.
6.2 Task State (mandatory if agentic dev)
projections/tasks.jsonl tracks goals, todos, status, owners.
6.3 Retrieval index (optional in v1)
BM25/FTS index: optional sqlite
Vector index: optional sqlite
If absent, retrieval falls back to:
recency window + keyword scan (low dependency baseline)
6.4 Summaries (optional but recommended)
Hierarchical summaries stored in:
projections/summaries/session/*
projections/summaries/episode/*
All summary artifacts must include:
refs to source events
scope and coverage metadata
7. Active Context Bundle (ACB) Spec
7.1 ACB structure (normative)
The orchestrator outputs:
{
  "acb_id": "acb_20260209_0009",
  "ts": "...",
  "budget_tokens": 6000,
  "sections": [
    { "name": "identity", "items": [ ... ], "token_est": 450 },
    { "name": "task_state", "items": [ ... ], "token_est": 350 },
    { "name": "relevant_decisions", "items": [ ... ], "token_est": 600 },
    { "name": "retrieved_evidence", "items": [ ... ], "token_est": 1800 },
    { "name": "recent_window", "items": [ ... ], "token_est": 900 }
  ],
  "omissions": [
    { "reason": "budget", "candidates": ["evt_..."] },
    { "reason": "privacy", "candidates": ["views/preferences.md#..."] }
  ],
  "provenance": {
    "policy_version": "pol_0003",
    "retrieval_queries": ["..."],
    "scoring": { "alpha": 0.6, "beta": 0.3, "gamma": 0.1 }
  }
}
7.2 Budget allocation (policy-driven)
Budgets are set in policies/budgets.yaml, example:
identity: max 500 tokens
task_state: max 400
decisions: max 800
evidence: max 2500
recent: max 1200
Hard caps. Orchestrator must not exceed.
7.3 Selection algorithm (normative baseline)
A chunk candidate gets a score:
score = α * similarity + β * recency + γ * importance

Where:

similarity: semantic (if embeddings) else keyword overlap
recency: exponential decay
importance: derived from tags, decision/task refs, user pinning
Then:
Fill sections in priority order (identity → task → decisions → evidence → recent)
Enforce privacy suppression before scoring
Record omissions
8. Privacy & Safety Policies
8.1 Storage policy
By default, record everything except secrets classified as secret must be redacted or stored encrypted (v1 can implement “don’t store secrets” to keep complexity low).
Provide policies/privacy.yaml:
what is suppressed in public channels
what is never loaded
what is never stored (preferred for v1)
8.2 Loading policy
Public channel: do not load preferences.md or any high/secret.
Agent↔agent: load only project rules + decisions relevant to assigned task.
9. Scenario-Driven Validation Spec
9.1 Scenario file format (normative)
scenarios/*.scenario.yaml
id: SCN-001
title: "Long dialog persistence with small active context"
principles: [P1, P3, P4, P8]
budget_tokens: 4000
initial_views:
  - views/identity.md
  - views/rules.project.md

steps:
  - actor: human
    kind: message
    content: "We decided to use filesystem-first memory and avoid external DB."
  - actor: agent
    kind: decision
    expect_store_decision: true
  - actor: human
    kind: message
    content: "In a public channel, do not reveal my preferences."
  - actor: agent
    kind: message
    content: "Acknowledged."

assertions:
  - type: event_exists
    where: { kind: "decision", contains: "filesystem-first" }
  - type: acb_max_tokens
    max: 4000
  - type: acb_section_not_contains
    section: "identity"
    contains: "user preferences"
  - type: traceability
    target: "decision"
    must_have_refs: true
9.2 Scenario execution model
For each step:
inject event(s) to recorder
run projectors (as configured)
run orchestrator to produce ACB
evaluate assertions at that point
9.3 Minimum scenario suite (v1)
You should have at least these 10:
SCN-001 Long dialog persists; ACB stays under budget
SCN-002 Compaction/summarization does not break traceability
SCN-003 Public/private channel loading suppression works
SCN-004 Decision supersedes earlier decision; latest is selected
SCN-005 Retrieval finds old but relevant decision from weeks ago
SCN-006 Multi-agent handoff: orchestrator shares only handoff packet
SCN-007 Duplicate info appears in logs; dedupe prevents prompt bloat
SCN-008 Tool output is huge; context editing keeps only needed excerpt
SCN-009 Wrong summary detected vs events; conflict flagged
SCN-010 “Pinned” memory always included despite low similarity
Each scenario explicitly maps to principles and measurable assertions.
10. Multi-Agent Handoff Packet (Normative)
To prevent chat-blob sharing, define:
{
  "handoff_id": "hof_0012",
  "to_agent": "Implementer",
  "task": "Refactor memory layout",
  "constraints": ["filesystem-first", "no external deps"],
  "decisions": ["dec_000045", "dec_000050"],
  "required_files": ["memory/manifest.json", "policies/budgets.yaml"],
  "open_questions": ["Do we store secrets at all in v1?"],
  "refs": ["evt_...", "dec_..."]
}
Only this packet is injected into the receiving agent’s ACB, not the full history.
11. Non-Functional Requirements
NFR1: ACB assembly must complete within a target time budget (set later).
NFR2: Rebuild projections from events must be possible.
NFR3: Human can inspect/override memory views easily.
NFR4: Minimal dependencies baseline (no vector DB required).
NFR5: Deterministic orchestration given same inputs + same indexes.
12. Acceptance Criteria (v1)
System is v1-complete when:
Event log and decision ledger work end-to-end
Orchestrator generates ACB with strict budgets + provenance
Privacy suppression is enforced in scenarios
Scenario harness runs the minimum scenario suite and produces reports
Projections are rebuildable (delete projections/, rebuild from events/)
Next step
Tell me your preferred initial token budget target for ACB (e.g., 4k / 8k / 16k). If you don’t choose, we’ll default to 8k and derive budgets.yaml accordingly.
Then I’ll write Spec v1.1 with:

exact policy file schemas (privacy.yaml, budgets.yaml, channels.yaml)
scenario assertion DSL details
deterministic scoring + tie-break rules
minimal baseline retrieval (no embeddings) + optional plugin hooks

