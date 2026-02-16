# Collaboration Patterns → Implementation Mapping

**Quick Reference:** How human-AI collaboration research maps to Agent Memory System v2.0 implementation

---

## Research Finding → Implementation

### 1. Transactive Memory System

**Research:** Teams need "who knows what" directory for efficient coordination

**Implementation:**
- `events` table: All knowledge stored with refs
- `chunks` table: Searchable knowledge units
- `decisions` table: Explicit decision catalog
- Tags system: Expertise area labeling

**API Usage:**
```typescript
// Agent retrieves from transactive memory
POST /api/v1/acb/build
{
  "intent": "repo_onboarding",
  "query_text": "what did we decide about X?"
}

// Response includes refs to sources
{
  "sections": [{
    "name": "relevant_decisions",
    "items": [{
      "decision_id": "dec_001",
      "refs": ["evt_abc123", "chk_def456"]  // ← provenance
    }]
  }]
}
```

---

### 2. Shared Mental Models (SMM)

**Research:** Aligned understanding of tasks (taskwork SMM) and collaboration (teamwork SMM)

**Implementation:**

**Taskwork SMM** (maintained in `decisions` table):
```sql
CREATE TABLE decisions (
  decision_id TEXT PRIMARY KEY,
  decision TEXT NOT NULL,
  rationale TEXT[] NOT NULL,
  constraints TEXT[] NOT NULL,
  alternatives TEXT[] NOT NULL,
  consequences TEXT[] NOT NULL,
  refs TEXT[] NOT NULL  -- Traceability
);
```

**Teamwork SMM** (maintained in ACB `identity/rules` section):
```typescript
// From PRD Section 8.1
{
  name: "identity",
  items: [{
    type: "text",
    text: "You are an architect agent for Acme Corp...",
    refs: ["view:identity.project"]
  }]
}
```

**Validation:** Scenario A3 (Decision Supersession) tests SMM maintenance

---

### 3. Team Situation Awareness (SA)

**Research:** Four levels of SA for human-AI teams

**Implementation:**

| SA Level | Description | ACB Section |
|----------|-------------|-------------|
| Level 1: Perception | What's happening? | `recent_window` |
| Level 2: Comprehension | What does it mean? | `task_state` |
| Level 3: Projection | What will happen? | `decision_ledger` |
| Level 4: Team Capabilities | What can we do? | `identity/rules` |

**Source:** PRD Section 8.1 (ACB Structure)

---

### 4. Agency Distribution

**Research:** Dynamic control allocation (passive → co-operative)

**Implementation:**

**Agency Levels in System:**
```typescript
// Implicit via sensitivity and channel rules
const agencyLevels = {
  passive: {
    description: "Wait for instructions",
    channel: "public",  // Limited access
    sensitivity: ["none"]
  },
  reactive: {
    description: "Respond to queries",
    channel: "team",  // More access
    sensitivity: ["none", "low"]
  },
  semiActive: {
    description: "Suggest options",
    channel: "private",  // Full access
    sensitivity: ["none", "low", "high"]
  }
};
```

**Progression:** Not explicitly implemented (could be Phase 3+)

---

### 5. Provenance & Transparency

**Research:** Trust emerges from traceability

**Implementation:**

**Every ACB item includes refs:**
```typescript
interface ACBItem {
  type: "text" | "decision" | "evidence";
  text: string;
  refs: string[];  // ← Provenance (event_ids, chunk_ids, decision_ids)
}
```

**Provenance metadata:**
```typescript
interface Provenance {
  intent: string;
  query_terms: string[];
  candidate_pool_size: number;
  filters: {
    sensitivity_allowed: string[];
  };
  scoring: {
    alpha: number;  // semantic similarity
    beta: number;   // recency
    gamma: number;  // importance
  };
}
```

**Source:** PRD Section 7.2 (build_acb API)

---

### 6. Speaking Up Behavior

**Research:** Team members should share dissenting information

**Implementation:**

**Not explicitly implemented** (could be Phase 3+):

**Proposed pattern:**
```typescript
interface ACBResponse {
  sections: ACBSection[];
  concerns?: Concern[];  // ← "Speaking up"
}

interface Concern {
  type: "contradiction" | "low_confidence" | "risk";
  message: string;
  refs: string[];
}
```

**Example:**
```json
{
  "concerns": [{
    "type": "contradiction",
    "message": "This query contradicts Decision D-001 (use TypeScript)",
    "refs": ["dec_001"]
  }]
}
```

---

### 7. Role Specification + Fluidity

**Research:** Clear baseline roles with adaptive flexibility

**Implementation:**

**Role Specification** (static):
```typescript
// In ACB identity section
const agentRole = `
You are a memory and context assistant. Your role is to:
- Remember everything we've discussed
- Track decisions with rationale and evidence
- Retrieve relevant context on demand
- Suggest options based on patterns
- NEVER make decisions without human approval
`;
```

**Role Fluidity** (implicit via channels):
```typescript
// Channel-based access control
const channelRoles = {
  public: { readOnly: true, noSuggestions: true },
  team: { readOnly: false, suggestions: true },
  private: { readOnly: false, proactive: true }
};
```

---

## Design Principles → Research Validation

### P1: Ground truth is append-only

**Research Support:** Transactive memory requires reliable source

**Implementation:**
```sql
-- Events table is append-only (logically)
CREATE TABLE events (
  event_id TEXT PRIMARY KEY,
  ts TIMESTAMPTZ NOT NULL,
  content JSONB NOT NULL,
  -- No UPDATEs, only INSERTs
);
```

**Validation:** Scenario A4 (Summary Drift Guard) tests P1

---

### P2: Derived views are disposable

**Research Support:** Shared mental models need to be updateable

**Implementation:**
```sql
-- Chunks are derived from events
CREATE TABLE chunks (
  chunk_id TEXT PRIMARY KEY,
  event_id TEXT REFERENCES events(event_id),
  -- Can be dropped and regenerated
);
```

**Validation:** Scenario A11 (Cold Cache Recovery) tests P2

---

### P4: Traceability by reference

**Research Support:** Transparency enables trust

**Implementation:**
```typescript
// Every item includes refs
interface Decision {
  decision_id: string;
  refs: string[];  // event_ids or chunk_ids
}
```

**Validation:** All scenarios verify refs present

---

### P5: Least-privilege memory loading

**Research Support:** Channel-based privacy

**Implementation:**
```typescript
// Channel-based sensitivity rules
const privacyRules = {
  public: ["none", "low"],
  team: ["none", "low", "high"],
  private: ["none", "low", "high"],
  agent: ["none", "low"]
};
```

**Validation:** Scenario A7 (Public Channel Suppression) tests P5

---

## Scenarios → Research Concepts

| Scenario | Research Concept | Tests |
|----------|------------------|-------|
| A1: Legacy Onboarding | Transactive memory + SMM | Full workflow |
| A2: Old Decision Recall | Taskwork SMM | Long-term retrieval |
| A3: Decision Supersession | SMM maintenance | Traceability |
| A4: Summary Drift | P1 (append-only) | Ground truth priority |
| A5: Task Continuity | SA Level 2 (comprehension) | Task state persistence |
| A6: Multi-Agent Handoff | Teamwork SMM | Context transfer |
| A7: Public Channel | Least privilege | Privacy filtering |
| A8: Secret Handling | Trust mechanisms | Security |
| A9: Fast Path | Efficiency | Performance |
| A10: Retrieval Path | Transactive memory | FTS + scoring |
| A11: Cold Cache | P2 (disposable views) | Rebuildability |
| A12: Dedupe | Consistency | Token stability |

---

## Open Questions → Future Work

### Research: Dynamic Agency Negotiation

**Current:** Static channel-based roles

**Future:**
```typescript
interface AgencyNegotiation {
  currentLevel: "reactive" | "semi_active" | "proactive";
  proposedLevel: string;
  reason: string;
  requiresApproval: boolean;
}

POST /api/v1/agency/request
{
  "current_level": "reactive",
  "proposed_level": "semi_active",
  "reason": "I've learned 20 decisions about this domain",
  "requires_approval": true
}
```

---

### Research: Collective Intelligence Metrics

**Current:** Basic metrics (latency, token count)

**Future:**
```typescript
interface COLLABMetrics {
  transactiveMemoryHits: number;  // Memory serving
  sharedModelAlignment: number;   // SMM convergence
  agencyLevelProgression: string; // Role adaptation
  speakingUpEvents: number;       // Voice behavior
  trustScore: number;             // Verification requests
}
```

---

### Research: Multi-Agent Theory of Mind

**Current:** Basic multi-agent support

**Future:**
```typescript
// Agent models what other agents know
interface AgentModel {
  agent_id: string;
  expertise_areas: string[];
  confidence_by_domain: Record<string, number>;
  current_task: string;
}

// Handoff includes ToM
interface HandoffPacket {
  from_agent: string;
  to_agent: string;
  what_from_knows: string[];
  what_to_should_know: string[];
  context: ACB;
}
```

---

## Quick Validation Checklist

Based on research findings, validate:

- [ ] **Transactive Memory:**
  - [ ] Decision ledger accessible
  - [ ] All knowledge cites sources (refs)
  - [ ] Efficient retrieval (FTS)

- [ ] **Shared Mental Models:**
  - [ ] Taskwork SMM (decision ledger)
  - [ ] Teamwork SMM (identity/rules)
  - [ ] SA framework mapping (ACB structure)

- [ ] **Transparency:**
  - [ ] Every item has refs
  - [ ] Provenance metadata available
  - [ ] Scoring explicit

- [ ] **Role Clarity:**
  - [ ] Agent role defined
  - [ ] Coordination protocols documented
  - [ ] Agency levels clear

- [ ] **Privacy:**
  - [ ] Channel-based filtering
  - [ ] Sensitivity levels enforced
  - [ ] Least privilege loading

---

**Usage:** Use this document to validate that implementation aligns with research findings.

**Last Updated:** 2025-02-16
