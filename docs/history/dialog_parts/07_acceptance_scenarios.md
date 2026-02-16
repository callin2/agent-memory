나의 말:
i need specifix scenario to validate memory system design also use acceptance test scenario

ChatGPT의 말:
Below are specific, concrete scenarios you can use as acceptance tests for the memory system. They are written in a way that directly validates the design principles (append-only truth, rebuildable projections, traceability, privacy, fast curation, bounded work) and your core goal: persist almost everything but keep active context curated (65K budget).
I’m giving you:

a scenario catalog (what it proves)
12 acceptance scenarios with step-by-step scripts + assertions
each scenario includes speed and budget assertions where relevant
You can implement these as scenarios/*.scenario.yaml later, but this is the exact content you need.
Acceptance Scenario Catalog
Core correctness (memory works)
A1. Persist almost all dialog + tool I/O
A2. Retrieve old but relevant info without loading whole history
A3. Decisions are first-class + traceable + supersedable
A4. Summaries never become “floating facts” (must cite events)
A5. Task state persists and stays consistent
A6. Multi-agent handoff shares artifacts, not chat blobs
Safety / governance
A7. Public/private memory loading suppression
A8. “Never store secrets” enforcement (or redaction)
Performance / boundedness
A9. Fast-path assembly (hotset only)
A10. Retrieval-path assembly bounded (candidate_pool_max)
A11. Cold-cache bounded recovery
A12. No prompt bloat from duplication (dedupe/packing)
Scenario Template (use for all)
Each scenario specifies:
Principles validated: P1..P8
Setup: initial files, policies
Steps: messages, tool outputs, decisions
Assertions: memory artifacts + ACB composition + performance + traceability
12 Specific Acceptance Scenarios
SCN-A1: “Persist almost everything” (dialog + tools) ✅
Proves: P1, P2, P4
Setup: private channel, empty memory dir
Steps:
human: “Create a memory system spec; use filesystem-first; TS.”
agent: tool_call search_files (fake tool)
tool_result: returns 200 lines of output
agent: message summary + decision “filesystem-first”
Assertions:
events/ contains all four events kinds: message/tool_call/tool_result/decision
tool_result event stored even if huge (may be chunked), but ground truth exists
decision ledger contains “filesystem-first” with refs pointing to the message event IDs
ACB for step 4 includes decision ref but not entire 200-line tool output (only excerpt)
SCN-A2: Old decision recall after 2 weeks ✅
Proves: P3, P4, “active context curated”
Setup: preload event log from “two weeks ago” containing decision D1: “Zero-dep retrieval.”
Steps:
today human: “Why did we avoid sqlite in v1?”
orchestrator builds ACB
Assertions:
ACB includes decision_ref for D1
ACB includes at least 1 evidence chunk from 2 weeks ago (by chunk_id)
ACB does not include unrelated old chat chunks
Candidate pool size ≤ 2000 (bounded)
SCN-A3: Superseding decisions selects the latest ✅
Proves: P4 traceability + deterministic selection
Setup: private channel
Steps:
human: “Decision: never store secrets (v1).”
agent: decision D1 active
human: “Update: we will store secrets but encrypted (v2).”
agent: decision D2 supersedes D1
human: “What’s the policy now?”
Assertions:
decision ledger contains D1 (status=“superseded”) and D2 (status=“active”)
ACB for step 5 includes D2 and excludes D1 (unless asked for history)
D2 has refs to step 3 event + mentions superseding D1 id
Deterministic tie-break: if both match query, latest active wins
SCN-A4: Summary drift guard (summary must cite ground truth) ✅
Proves: P2, P4, summary traceability
Setup: create a session summary file with a wrong statement (“budget is 32K”)
Steps:
human: “Our token budget is 65K.”
projector writes summary S1
later, orchestrator sees both old wrong summary and new events
human: “What’s our budget?”
Assertions:
Orchestrator must prefer decisions/events over conflicting summaries
ACB includes evidence chunk from step 1 (or decision referencing it)
A report entry conflict_flag exists: summary claims 32K but events say 65K
Summary S1 must have refs; if not, it is ignored for ACB inclusion
SCN-A5: Task continuity across sessions ✅
Proves: task projection persistence
Setup: start a task with 5 todos
Steps:
human: “Implement micro-index projectors: catalog, postings, recency_ring.”
agent: creates tasks T1..T3 (task_update events)
restart session (new day file)
human: “Continue.”
Assertions:
tasks.jsonl retains open tasks
hotset lists active tasks after restart
ACB includes task_state with remaining tasks
No need to load full dialog history to know tasks
SCN-A6: Multi-agent handoff uses packet, not transcript ✅
Proves: Oh-My-OpenCode-style memory discipline
Setup: orchestrator + agentA + agentB
Steps:
agentA works 30 turns; produces decision + file refs
orchestrator creates handoff_packet to agentB
agentB receives packet and continues
Assertions:
ACB for agentB contains only:
handoff packet
referenced decision IDs
minimal evidence chunks (≤ 20 chunks)
ACB for agentB does not include the 30-turn transcript
Traceability preserved via refs
SCN-A7: Public channel suppression ✅
Proves: P5 least privilege loading
Setup: preferences.md contains sensitive preferences; privacy.yaml says suppress in public
Steps:
private human: “I prefer X; remember it.” (stored in preferences view)
later public human: “What are my preferences?”
Assertions:
In public channel, ACB must not include preferences view contents
Agent response should refuse or say it can’t access that here
events still stored (ground truth), but load policy blocks injection
SCN-A8: Secret handling “never store” (v1) ✅
Proves: safety + policy enforcement
Setup: privacy.yaml never_store_kinds: secret + redact patterns
Steps:
human: “My API key is sk-ABCDE…”
recorder processes message
Assertions:
event stored with redaction OR not stored (depending on policy), but:
raw secret is absent from disk
event has sensitivity: secret and content redacted
ACB never includes secret content in any channel
SCN-A9: Fast path (no retrieval) ✅
Proves: speed NFR, hotset effectiveness
Setup: hotset populated, intent=continue
Steps:
human: “Continue writing scenario tests.”
orchestrator builds ACB from hotset + small views
Assertions:
file_reads ≤ 12
bytes_read ≤ 2MB
p95 ≤ 150ms (local baseline)
candidate_pool_size ≤ 500
ACB stays under budget
SCN-A10: Retrieval path bounded and fast ✅
Proves: bounded work without sqlite
Setup: postings populated with 50k chunks historically
Steps:
human: “Find the decision about ‘candidate_pool_max’.”
Assertions:
candidate_pool_size ≤ 2000
retrieved chunks ≤ configured max (e.g., 200)
p95 ≤ 500ms
ACB includes the correct decision + one supporting evidence chunk
SCN-A11: Cold-cache recovery bounded ✅
Proves: rebuildability + bounded worst-case
Setup: delete projections/micro/* and hotset.json
Steps:
human: “Why is retrieval still fast without sqlite?”
system rebuilds minimal micro-index from last 1 day (bounded rebuild)
Assertions:
rebuild completes within max_ms ≤ 1500ms (or your chosen bound)
ACB includes correct explanation via recent decision/event
system reports “partial index rebuilt” if older data not indexed yet (honest degradation)
SCN-A12: Dedupe prevents prompt bloat ✅
Proves: packing discipline
Setup: same fact appears in 20 messages (“budget is 65K”)
Steps:
human repeats the fact in different phrasing over time
later human: “What’s the budget?”
Assertions:
ACB includes at most 1–3 chunks for that fact (dedup by hash/simhash or identical refs)
token_used_est is stable (doesn’t grow linearly with repetition)
provenance records dedupe count
How to use these as “acceptance tests”
A run passes if:
all SCN-A1..A12 pass
each scenario produces a reports/run_*.report.json with metrics
failures are actionable (e.g., which assertion, which file, which ref)
Minimal Acceptance Thresholds (recommended defaults)
ACB max: 65,000 tokens (never exceed)
Fast path p95: ≤ 150ms
Retrieval p95: ≤ 500ms
Cold-cache max: ≤ 1500ms
Candidate pool max: 2000
File reads per call max: 20
Bytes read per call max: 8MB
If you want the next artifact: I can convert these 12 into actual .scenario.yaml files with a consistent DSL (assertion types, where-clauses, stable IDs) so you can directly wire a runner around them.

