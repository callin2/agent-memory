나의 말:
i will use postgres. 

ChatGPT의 말:
Good. Below is a finalized Spec v2.0 (Postgres-backed, multi-agent daemon, minimal code) that covers the legacy onboarding scenario and provides clear APIs + DB DDL + I/O contracts.
Memory System Spec v2.0 (Postgres Thin Daemon)
1) Goals
Serve multiple agents concurrently (daemon/service).
Persist almost all interactions (messages, tool I/O, decisions, task state).
Build Active Context Bundle (ACB) up to 65K tokens via fast curation.
Keep daemon code small by delegating indexing/retrieval to Postgres.
2) Runtime Shape
2.1 Deployment
Long-running service (HTTP).
Exposes a small tool API (MCP-friendly surface, but can be plain HTTP first).
2.2 Required request identity (multi-agent isolation)
Every API call MUST include:
tenant_id (workspace)
session_id
agent_id
channel (private|public|team|agent)
All queries MUST filter by tenant_id.
3) Postgres Data Model
3.1 DDL (minimum viable)
-- Extensions
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Ground truth events (append-only logically)
CREATE TABLE IF NOT EXISTS events (
  event_id     TEXT PRIMARY KEY,
  ts           TIMESTAMPTZ NOT NULL DEFAULT now(),
  tenant_id    TEXT NOT NULL,
  session_id   TEXT NOT NULL,
  channel      TEXT NOT NULL,
  actor_type   TEXT NOT NULL, -- human|agent|tool
  actor_id     TEXT NOT NULL,
  kind         TEXT NOT NULL, -- message|tool_call|tool_result|decision|task_update|artifact
  sensitivity  TEXT NOT NULL DEFAULT 'none', -- none|low|high|secret
  tags         TEXT[] NOT NULL DEFAULT '{}',
  content      JSONB NOT NULL,
  refs         TEXT[] NOT NULL DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_events_tenant_ts
  ON events (tenant_id, ts DESC);

CREATE INDEX IF NOT EXISTS idx_events_tenant_session_ts
  ON events (tenant_id, session_id, ts DESC);

CREATE INDEX IF NOT EXISTS idx_events_tags_gin
  ON events USING GIN (tags);

CREATE INDEX IF NOT EXISTS idx_events_content_gin
  ON events USING GIN (content);


-- Retrieval units (excerpts / normalized text)
CREATE TABLE IF NOT EXISTS chunks (
  chunk_id     TEXT PRIMARY KEY,
  tenant_id    TEXT NOT NULL,
  event_id     TEXT NOT NULL REFERENCES events(event_id) ON DELETE CASCADE,
  ts           TIMESTAMPTZ NOT NULL,
  kind         TEXT NOT NULL,
  channel      TEXT NOT NULL,
  sensitivity  TEXT NOT NULL DEFAULT 'none',
  tags         TEXT[] NOT NULL DEFAULT '{}',
  token_est    INT NOT NULL,
  importance   REAL NOT NULL DEFAULT 0.0,
  text         TEXT NOT NULL,
  tsv          TSVECTOR GENERATED ALWAYS AS (to_tsvector('english', text)) STORED
);

CREATE INDEX IF NOT EXISTS idx_chunks_tenant_ts
  ON chunks (tenant_id, ts DESC);

CREATE INDEX IF NOT EXISTS idx_chunks_tenant_kind
  ON chunks (tenant_id, kind);

CREATE INDEX IF NOT EXISTS idx_chunks_tsv_gin
  ON chunks USING GIN (tsv);

CREATE INDEX IF NOT EXISTS idx_chunks_tags_gin
  ON chunks USING GIN (tags);


-- Decisions (first-class, traceable)
CREATE TABLE IF NOT EXISTS decisions (
  decision_id   TEXT PRIMARY KEY,
  tenant_id     TEXT NOT NULL,
  ts            TIMESTAMPTZ NOT NULL DEFAULT now(),
  status        TEXT NOT NULL,  -- active|superseded
  scope         TEXT NOT NULL,  -- project|user|global
  decision      TEXT NOT NULL,
  rationale     TEXT[] NOT NULL DEFAULT '{}',
  constraints   TEXT[] NOT NULL DEFAULT '{}',
  alternatives  TEXT[] NOT NULL DEFAULT '{}',
  consequences  TEXT[] NOT NULL DEFAULT '{}',
  refs          TEXT[] NOT NULL DEFAULT '{}' -- event_ids or chunk_ids
);

CREATE INDEX IF NOT EXISTS idx_decisions_tenant_status_ts
  ON decisions (tenant_id, status, ts DESC);


-- Tasks (optional but useful for agentic dev)
CREATE TABLE IF NOT EXISTS tasks (
  task_id     TEXT PRIMARY KEY,
  tenant_id   TEXT NOT NULL,
  ts          TIMESTAMPTZ NOT NULL DEFAULT now(),
  status      TEXT NOT NULL, -- open|doing|done
  title       TEXT NOT NULL,
  details     TEXT NOT NULL DEFAULT '',
  refs        TEXT[] NOT NULL DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_tasks_tenant_status_ts
  ON tasks (tenant_id, status, ts DESC);


-- Artifacts: store large tool outputs simply (bytea)
CREATE TABLE IF NOT EXISTS artifacts (
  artifact_id  TEXT PRIMARY KEY,
  tenant_id    TEXT NOT NULL,
  ts           TIMESTAMPTZ NOT NULL DEFAULT now(),
  kind         TEXT NOT NULL, -- tool_output|blob
  bytes        BYTEA,
  meta         JSONB NOT NULL DEFAULT '{}'::jsonb,
  refs         TEXT[] NOT NULL DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_artifacts_tenant_ts
  ON artifacts (tenant_id, ts DESC);
Note: “Append-only” is enforced by application policy. DB constraints aren’t strictly required, keeping code + schema simple.
4) Ingestion Contracts (Input/Output)
4.1 record_event (the only write API you need)
Request
{
  "tenant_id": "t1",
  "session_id": "s1",
  "channel": "private",
  "actor": {"type":"human","id":"user"},
  "kind": "message",
  "sensitivity": "none",
  "tags": ["topic:onboarding","repo:legacy"],
  "content": { "text": "what this project for?" },
  "refs": []
}
Response
{ "event_id": "evt_01J..." }
4.2 Mandatory normalization for tool results (critical for speed)
For kind=tool_result, daemon MUST enforce:
Store excerpt in events.content.excerpt_text
If full output exceeds limits, store full bytes in artifacts.bytes, and store pointer in event content.
Tool result content shape
{
  "tool": "fs.read_file",
  "path": "README.md",
  "excerpt_text": "....",
  "line_range": [1, 120],
  "truncated": true,
  "artifact_id": "art_01J..."  // present only when truncated due to size
}
Why: Your legacy onboarding scenario requires large files/tools without slowing ACB assembly or bloating context.
4.3 Automatic chunking (daemon responsibility)
On every record_event, daemon creates 0..N rows in chunks:
Usually 1 chunk per event (message / tool_result excerpt / decision text)
text comes from:
message content.text
tool_result content.excerpt_text
decision decision + rationale (optional)
token_est computed once at insert time
importance heuristic (small, deterministic):
for decisions/tasks
for pinned tags (optional)
for “README”, “entrypoint”, etc. if tool_result
5) Read/Serve Contracts (Active Context)
5.1 build_acb (primary read API)
Request
{
  "tenant_id": "t1",
  "session_id": "s1",
  "agent_id": "agentA",
  "channel": "private",
  "intent": "repo_onboarding",
  "query_text": "what this project for?",
  "max_tokens": 65000
}
Response (ACB)
Returns ready-to-prompt text blocks, not just refs, to keep client code tiny.
{
  "acb_id": "acb_01J...",
  "budget_tokens": 65000,
  "token_used_est": 18400,
  "sections": [
    {
      "name": "rules",
      "items": [
        {"type":"text","text":"(identity/rules text...)","refs":["view:rules.project"]}
      ],
      "token_est": 1200
    },
    {
      "name": "recent_window",
      "items": [
        {"type":"text","text":"User: what this project for?","refs":["evt_01J..."]}
      ],
      "token_est": 120
    },
    {
      "name": "retrieved_evidence",
      "items": [
        {"type":"text","text":"README excerpt...","refs":["chk_01J...","evt_01J..."]},
        {"type":"text","text":"package.json scripts excerpt...","refs":["chk_01J..."]}
      ],
      "token_est": 9000
    },
    {
      "name": "relevant_decisions",
      "items": [
        {"type":"decision","decision_id":"dec_01J...","text":"...","refs":["evt_..."]}
      ],
      "token_est": 800
    }
  ],
  "omissions": [
    {"reason":"truncated_tool_output","candidates":["evt_..."],"artifact_id":"art_..."}
  ],
  "provenance": {
    "intent": "repo_onboarding",
    "query_terms": ["project","for"],
    "candidate_pool_size": 800,
    "filters": {"sensitivity_allowed":["none","low","high"]},
    "scoring": {"alpha":0.6,"beta":0.3,"gamma":0.1}
  }
}
5.2 Retrieval method (FTS baseline; minimal code)
Candidate query (conceptual):
tsquery = websearch_to_tsquery('english', query_text)
Select top N from chunks where:
tenant_id = ?
sensitivity allowed for channel
order by rank + recency + importance
Keep it bounded:
candidate_pool_max = 2000
retrieved_chunks_max = 200
pack using token_est until section caps
6) Privacy Policy (simple, enforceable)
Channel-based suppression (hard-coded or config table/file):
public: allow sensitivity none|low only; exclude preferences
private: allow none|low|high; never allow secret
agent: usually none|low unless explicitly permitted
v2.0 recommendation: never store secrets (redact), to minimize code and risk.
7) Performance Requirements (fast curation)
Targets (local baseline, indexed DB):
Fast path (no retrieval needed): p95 ≤ 150ms
Retrieval path (FTS): p95 ≤ 500ms
Worst-case cold start: ≤ 1500ms
Hard limits:
candidate_pool_max = 2000
retrieved_chunks_max = 200
max_bytes_per_tool_result_event (e.g., 64KB excerpt)
packing uses precomputed token_est (no repeated tokenization)
8) Acceptance Scenario Mapping (Legacy repo onboarding)
For your scenario (“repo root → user asks ‘what is this project for?’”):
Required external feature surface
Tools (outside memory): fs.list_root, fs.read_file, fs.grep (bounded outputs)
Memory daemon endpoints/tools:
record_event
build_acb
(optional) get_artifact(artifact_id) if the agent wants full tool output later
What the scenario validates in this spec
All interactions are stored (events)
Large tool outputs don’t slow the system (excerpt + artifact)
ACB includes only relevant excerpts (FTS retrieval + packing)
Decisions can be created and cited (decision table + refs)
Multi-agent safe (tenant/session/agent isolation keys)
9) Minimal MCP Tool Mapping (optional, if you adopt MCP)
If you expose via MCP, these are the only tools you need:
memory.record_event
memory.build_acb
memory.get_artifact (optional)
memory.query_decisions (optional convenience)
Keep the rest out to stay small.

