나의 말:
initial token budget is 65K.  and i have one more non-functional requirement. it is active context curation speed must as quick as possible.

ChatGPT의 말:
Understood: ACB budget = 65K tokens, and you add a key NFR: active context curation must be as fast as possible.
Below is Spec v1.1 updates: (1) budgets at 65K, (2) explicit performance requirements + architecture choices to minimize latency, (3) concrete policy file schemas and deterministic selection rules that remain fast.

Memory System Spec v1.1 (65K ACB + Fast Curation)
1) Update: Active Context Budget Policy (65K)
1.1 Budget philosophy
Even with 65K, you still need strict allocation to prevent “context bloat” and preserve signal. The goal is not “use all 65K,” but “never exceed 65K, and usually use much less unless needed.”
1.2 policies/budgets.yaml (normative schema + example)
Schema:
acb_total_max_tokens: integer
sections: map of section → {max_tokens, priority}
reserve_tokens: headroom for user message/tool inserts
Example for 65K:
version: 1
acb_total_max_tokens: 65000
reserve_tokens: 5000   # always keep headroom for user/tool payloads

sections:
  identity:
    max_tokens: 1200
    priority: 10
  rules:
    max_tokens: 6000
    priority: 9
  task_state:
    max_tokens: 3000
    priority: 9
  relevant_decisions:
    max_tokens: 8000
    priority: 8
  retrieved_evidence:
    max_tokens: 28000
    priority: 7
  recent_window:
    max_tokens: 12000
    priority: 6
  tool_state:
    max_tokens: 2000
    priority: 6
Notes:
Evidence gets the largest share because it’s the only section that really benefits from scale.
Identity stays small by design (stability + speed).
2) New NFR: Active Context Curation Speed (Critical)
2.1 Performance NFRs (normative)
NFR-S1. Fast-path assembly: For typical turns, ACB must assemble using only:
last-N events
cached projections
O(1) file reads of small views
(no full-history scans)
NFR-S2. P95 latency target (local workstation baseline):
≤ 150ms for fast-path assembly (no embeddings query)
≤ 500ms when doing retrieval (BM25 and/or vectors)
≤ 1500ms worst-case fallback (cold cache, large evidence retrieval)
(Exact numbers can be adjusted later, but you need explicit targets to guide design.)
NFR-S3. Deterministic and bounded:

Every step must have hard limits: max candidates scanned, max chunks retrieved, max bytes read.
NFR-S4. Incremental updates:
Projectors update indices incrementally per event append; no batch rebuild during normal operation.
2.2 Architectural consequences for speed
A) Separate “event recording” from “projection updates”
Recorder is synchronous (append-only write).
Projectors are incremental and can be async, but must keep a small “hot index” up to date.
B) “Hot set” cache (mandatory)
Maintain a memory-hotset in projections/hotset.json (or in-memory if daemon):
Hot set includes:

last N turns (e.g., last 200 events)
latest active tasks
active decisions
top topics for current session
The orchestrator assembles most ACBs from the hot set + small views without touching large stores.
C) Two-stage retrieval for speed (mandatory)
Cheap candidate generation
keyword / tag / recency filters
limit to a bounded candidate pool (e.g., 2k chunks)
Expensive re-ranking
only applied to the candidate pool (BM25/embedding score)
This avoids slow “search everything.”
D) Precomputed token estimates (mandatory)
Every stored chunk/summary/decision should have:
token_est computed at write time (or projector time)
Then orchestration becomes arithmetic, not repeated tokenization.
3) Deterministic, Fast Context Assembly Rules (v1.1)
3.1 Orchestrator algorithm (normative)
Inputs:
intent (cheap classifier: rule-based + small prompt optional)
channel (public/private/team/agent)
budget.yaml
hotset
indices (optional)
Procedure:
Load mandatory small views: identity, rules, task_state (bounded file reads)
Apply privacy suppression (drop blocked views/chunks before scoring)
Add “active decisions” from decision ledger (bounded top-M, e.g., 100)
Candidate retrieval:
If intent requires deep recall → run retrieval
Else skip retrieval, rely on hotset + recent_window
Add evidence chunks until section caps reached
Add recent_window until cap reached
Emit ACB + provenance + omissions
3.2 Tie-break rules (deterministic)
When scores tie:
prefer higher importance
prefer more recent
prefer smaller token_est (pack more items)
stable sort by id
This avoids nondeterministic “random” ACBs.
4) Policy Schemas (explicit)
4.1 policies/privacy.yaml (schema + example)
version: 1

store:
  never_store_kinds:
    - secret
  redact_patterns:
    - "(?i)api_key\\s*[:=]\\s*\\S+"
    - "(?i)password\\s*[:=]\\s*\\S+"

load:
  channel_rules:
    public:
      suppress_sensitivity: [high, secret]
      suppress_views:
        - views/preferences.md
    private:
      suppress_sensitivity: [secret]
    agent:
      suppress_sensitivity: [high, secret]
v1 recommendation for speed + simplicity: “never_store secrets” rather than encrypting.
4.2 policies/channels.yaml
version: 1
channels:
  - name: private
    default_load_views: [views/identity.md, views/rules.project.md, views/preferences.md]
  - name: public
    default_load_views: [views/identity.md, views/rules.project.md]
  - name: agent
    default_load_views: [views/identity.md, views/rules.project.md]
5) Scenario-Driven Validation updates (65K + speed)
5.1 Add performance assertions to scenario DSL
New assertion types:
acb_build_latency_p95_ms: <int>
acb_candidate_scan_max: <int>
acb_file_reads_max: <int>
acb_bytes_read_max: <int>
Example:
assertions:
  - type: acb_max_tokens
    max: 65000
  - type: acb_build_latency_p95_ms
    max: 500
  - type: acb_candidate_scan_max
    max: 2000
  - type: traceability
    target: "decision"
    must_have_refs: true
5.2 Minimum performance scenarios (add 3)
SCN-P1 Fast path: no retrieval, hotset only, verify latency and file read counts
SCN-P2 Retrieval path: intent requires deep recall, verify candidate bounds + latency
SCN-P3 Cold cache: delete hotset/projections, rebuild minimal, verify worst-case stays bounded
6) Acceptance Criteria additions (speed)
Add to v1 acceptance:
P95 ACB assembly meets target under:
fast path
retrieval path
cold cache path
Orchestrator emits instrumentation in reports/*.report.json:
timing breakdown
candidate pool size
sections packed
bytes read
This is needed to iterate toward “as quick as possible” without guessing.
7) Practical speed defaults (recommended)
These are “knobs” you’ll tune, but define them now:
hotset max events: 200
candidate pool max: 2000 chunks
retrieved chunks max: 200
per-chunk max tokens: 400–800 (chunk size)
per-call file reads max: 20
per-call bytes read max: e.g., 2–8 MB (tunable)
Next output I can generate immediately
If you want to proceed, the next deliverable should be Spec v1.2: “Exact file formats + scenario suite skeleton”, including:
exact JSON schemas for hotset, acb, report
scenario templates for SCN-001..010 + SCN-P1..P3
deterministic scoring function definition (including recency decay function)
minimal baseline retrieval (keyword/tag/recency) that requires no sqlite at all
If you have a preference: do you want the baseline retrieval index to be (A) zero-dependency file scan, or (B) sqlite FTS5 as the first optional dependency?

