나의 말:
A. zero dependency. but keep architecture not to slow

ChatGPT의 말:
Got it: A) zero-dependency baseline, but architecture must stay fast.
Below is Spec v1.2 focused on: (1) fast context curation without sqlite/vector DB, (2) exact file formats for hotset/ACB/report, (3) deterministic retrieval/scoring with bounded work, (4) scenario suite skeleton including performance scenarios.

Memory System Spec v1.2 (Zero-Dependency + Fast)
1) Zero-Dependency Retrieval Without Being Slow
1.1 Core strategy
We avoid full-history scans by introducing bounded, incremental “micro-indexes” stored as plain JSON files (small, append/update), generated from events.
Key idea:

Ground truth is big.
Retrieval operates on small, precomputed catalogs.
1.2 Mandatory micro-indexes (all JSON, small)
Stored under projections/micro/:
chunk_catalog.jsonl
One line per chunk (chunk = excerpt from an event or summary)
Contains minimal metadata + cheap lexical fingerprints
term_postings/ (sharded JSON)
A tiny inverted index: term → list of chunk IDs
Sharded by prefix to keep files small
recency_ring.json
Ring buffer of last N chunk IDs (fast recency candidates)
topic_heads.json
A small list of top active topics + their chunk IDs
This stays “zero dependency” but prevents slow scans.
2) Exact File Formats
2.1 Chunk Catalog (projections/micro/chunk_catalog.jsonl)
Each line:
{
  "chunk_id": "chk_20260209_000123_01",
  "source_evt": "evt_20260209_000123",
  "ts": "2026-02-09T05:12:33+09:00",
  "channel": "private",
  "kind": "message|tool_result|decision|summary|artifact",
  "sensitivity": "none|low|high|secret",
  "tags": ["topic:memory", "proj:X"],
  "token_est": 180,
  "text_head": "First 160 chars for debugging",
  "lex":
  {
    "terms": ["memory","context","budget","flush"],
    "bloom": "base64:...",        // optional in v1, can omit
    "simhash16": "3f7a..."        // optional cheap similarity
  },
  "importance": 0.2
}
Rules:
terms = normalized tokens (lowercase, split on non-alnum, length>=3, stopword removed)
text_head is not for retrieval, just for debugging/reporting
token_est computed at catalog time
Why this is fast: you never open big event files to rank; you rank catalog entries.
2.2 Term Postings (Inverted Index) (projections/micro/term_postings/ab.json)
Sharded by first two letters of term. Example file me.json:
{
  "memory": ["chk_...","chk_..."],
  "merge": ["chk_..."]
}
Rules:
each posting list is capped (e.g., keep latest 5000 chunk IDs per term)
projector updates these incrementally
old IDs evicted by recency
Fast candidate gen: term lookup is O(#query_terms + postings).
2.3 Recency Ring (projections/micro/recency_ring.json)
{
  "max": 5000,
  "cursor": 1280,
  "chunk_ids": ["chk_...","chk_...", "..."]
}
Use this as the fallback candidate pool for many intents.
2.4 Hotset (projections/hotset.json)
Hotset is what makes the fast path fast:
{
  "version": 1,
  "updated_ts": "2026-02-09T05:40:00+09:00",
  "active_session": "sess_20260209_A",
  "recent_event_ids": ["evt_...","evt_..."],

  "active_tasks": ["tsk_001","tsk_002"],
  "active_decisions": ["dec_000045","dec_000050"],

  "topic_heads": [
    {"topic":"memory", "chunk_ids":["chk_...","chk_..."]},
    {"topic":"privacy", "chunk_ids":["chk_..."]}
  ],

  "pins": {
    "chunks": ["chk_pin_..."],
    "views": ["views/identity.md#v1", "views/rules.project.md#core"]
  }
}
2.5 ACB output (reports/acb_*.json) (normative)
{
  "acb_id": "acb_20260209_0009",
  "ts": "2026-02-09T05:41:12+09:00",
  "budget_tokens": 65000,
  "token_used_est": 41820,
  "sections": [
    {
      "name": "identity",
      "items": [{"type":"view_ref","ref":"views/identity.md"}],
      "token_est": 900
    },
    {
      "name": "relevant_decisions",
      "items": [{"type":"decision_ref","ref":"dec_000045"}],
      "token_est": 1200
    },
    {
      "name": "retrieved_evidence",
      "items": [{"type":"chunk_ref","ref":"chk_...","score":0.83}],
      "token_est": 21000
    }
  ],
  "omissions": [
    {"reason":"budget","candidates":["chk_..."]},
    {"reason":"privacy","candidates":["chk_..."]}
  ],
  "provenance": {
    "policy_version": "bud_v1|priv_v1",
    "intent": "design_spec",
    "query_terms": ["spec","memory","context","budget"],
    "candidate_pool_size": 1800,
    "scoring": {"alpha":0.55,"beta":0.35,"gamma":0.10},
    "deterministic_seed": "none"
  }
}
2.6 Performance report (reports/run_*.report.json)
{
  "run_id": "run_20260209_0001",
  "scenarios": [
    {
      "id": "SCN-P1",
      "p95_ms": 120,
      "max_ms": 260,
      "bytes_read": 1048576,
      "file_reads": 12,
      "candidate_pool_max": 1800
    }
  ]
}
3) Deterministic Retrieval & Scoring (Fast + Bounded)
3.1 Candidate Generation (zero-dep)
Given query terms Q:
Candidate pool = union of:

postings(term) for each term in Q (cap each list)
recency_ring tail window (e.g., last 800 chunks)
hotset topic_heads chunks (if topic matches)
pinned chunks
Then cap:
candidate_pool_max = 2000 (tunable)
If union exceeds cap:
take in priority order: pinned → hotset → postings → recency fallback
3.2 Scoring (no embeddings baseline)
We use cheap lexical + policy features:
lexical = jaccard(query_terms, chunk_terms) (approx)
recency = exp(-Δt / τ) (τ e.g. 7 days)
importance = catalog.importance + tag_boost + decision_ref_boost
Final:
score = α*lexical + β*recency + γ*importance
Tie-breaks:

higher importance
more recent
smaller token_est
chunk_id lexicographic
All deterministic.
3.3 Packing into ACB (fast)
Use precomputed token_est.
Greedy pack by score within each section cap.
4) Speed Requirements Enforced by Hard Limits
Add these to policy (defaults):
candidate_pool_max: 2000
postings_cap_per_term: 5000
recency_tail_window: 800
max_file_reads_per_call: 20
max_bytes_read_per_call: 8MB
hotset_recent_events_max: 200
The orchestrator must stop when limits hit and report omissions.
5) Projectors (Incremental, zero-dep)
5.1 On each appended event
Projector does:
derive 0..N chunks (usually 1)
compute:
token_est
terms list
importance heuristic
append to chunk_catalog.jsonl
update term_postings/<shard>.json for each term (bounded)
update recency_ring.json
update hotset.json (active lists, topics)
This is O(chunk_terms) work per event, bounded.
6) Scenario Suite Skeleton (incl. performance)
Create these files in scenarios/:
6.1 SCN-P1 Fast Path (no retrieval)
Intent: simple continuation
Expected: orchestrator uses hotset + recent window only
Assertions:
p95_ms <= 150
candidate_pool_size <= 500 (should be small)
file_reads <= 12
6.2 SCN-P2 Retrieval Path (lexical)
Intent: “recall old decision from weeks ago”
Assertions:
decision chunk included
candidate_pool_size <= 2000
p95_ms <= 500
6.3 SCN-P3 Cold Cache
Delete hotset + micro indexes
Rebuild from last 1 day only (bounded rebuild in scenario)
Assertions:
max_ms <= 1500
ACB still under 65K
traceability preserved
6.4 SCN-003 Privacy
Public channel should suppress preferences and high/secret
Assertions:
ACB excludes preferences view and sensitive chunks
6.5 SCN-004 Decision superseding
Old decision active then superseded
Assertions:
only latest active appears in ACB
7) Multi-Agent Handoff (fast + minimal)
Handoff packets are stored as:
projections/handoffs.jsonl
Orchestrator includes only:

the packet
referenced decision IDs
minimal evidence chunks (top 20)
This prevents large cross-agent context replication.
8) Acceptance Criteria (v1.2)
Passes when:
No dependency beyond filesystem + Node runtime
ACB assembled under 65K with section caps
Fast path meets latency targets
Retrieval path meets bounded candidate pool + latency targets
Scenario suite passes with generated reports/run_*.report.json
Next step (no code yet, but concrete)
To lock this spec, choose one normalization rule set for query terms (since it affects postings compatibility):
Option N1 (simplest, fastest):

lowercase
split on non-alnum
keep len≥3
stopword list of ~100 English words
no stemming
Option N2 (better recall, slightly slower):
N1 + very small stemmer (hand-rolled suffix strip: -ing, -ed, -s)
If you don’t choose, I’ll proceed with N1 (least complexity, fastest, predictable).

