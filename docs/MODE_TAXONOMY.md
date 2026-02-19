# Mode Taxonomy for Context Filtering

**Version:** 1.0
**Date:** 2026-02-19
**Status:** Approved for Implementation
**Related:** docs/MULTI_TURN_FOCUS_PROBLEM.md v0.3

---

## Overview

This document defines the interaction modes used for mode-aware context filtering in the agent memory system. Modes determine what context is kept vs dropped in each API call to maintain focus in multi-turn conversations.

---

## Mode Definitions

### TASK
**Purpose:** Execute specific tasks with clear objectives
**User Intent:** "Implement X", "Fix bug Y", "Add feature Z"

**What to Keep:**
- Goal (what we're trying to accomplish)
- Constraints (requirements, limitations)
- Current state (what's done, what's pending)
- Safety requirements (critical constraints)

**What to Drop:**
- Exploration history (previous discussions not relevant to current task)
- Speculative options (ideas not yet chosen)
- Implementation noise (irrelevant technical details)

**Budget Allocation (tokens):**
```typescript
{
  rules: 10000,           // High: constraints critical
  task_state: 5000,        // High: current state
  recent_window: 2000,     // Low: minimal history
  retrieved_evidence: 28000, // High: need specifics
  relevant_decisions: 4000,  // Medium
  capsules: 4000,
}
```

**Examples:**
- "Implement user authentication with JWT"
- "Fix the login bug"
- "Add pagination to the user list"

---

### EXPLORATION
**Purpose:** Explore ideas, discover insights, understand problems
**User Intent:** "Thinking about X", "What if Y", "Let's explore"

**What to Keep:**
- Recent window (what we discussed)
- Insights found (discoveries made)
- Decisions made (choices taken)
- Open questions (what remains unknown)

**What to Drop:**
- Task details (implementation specifics)
- Implementation noise (code-level details)

**Budget Allocation (tokens):**
```typescript
{
  rules: 3000,            // Low: not constrained
  task_state: 1000,        // Low: no active task
  recent_window: 15000,    // High: maintain thread
  retrieved_evidence: 35000, // High: gather info
  relevant_decisions: 6000,  // High: what we decided
  capsules: 2000,
}
```

**Examples:**
- "I'm thinking about memory systems for AI"
- "The problem is context accumulation"
- "What if we tried mode detection?"

---

### DEBUGGING
**Purpose:** Diagnose and fix errors
**User Intent:** "Error in X", "Why does Y fail", "Stack trace Z"

**What to Keep:**
- Error events (what failed, when, how)
- Recent changes (what just happened)
- Known constraints (what should be true)

**What to Drop:**
- Successful task history (irrelevant past successes)
- Exploration discussions (not relevant to current error)

**Budget Allocation (tokens):**
```typescript
{
  rules: 5000,
  task_state: 4000,        // Medium: what we were doing
  recent_window: 12000,    // High: what just happened
  retrieved_evidence: 25000, // High: error context
  relevant_decisions: 3000,
  capsules: 0,             // None: don't distract with capsules
}
```

**Examples:**
- "I'm getting an error in auth"
- "Why does the login fail after 5 minutes?"
- "Stack trace: TypeError at line 42"

---

### LEARNING
**Purpose:** Learn principles, understand concepts, get explanations
**User Intent:** "Teach me X", "How does Y work", "Explain Z"

**What to Keep:**
- Principles (fundamental concepts)
- Examples (concrete illustrations)
- Patterns (reusable structures)

**What to Drop:**
- Recent conversation (clutter from wrong turns)
- Implementation details (not relevant for learning)

**Budget Allocation (tokens):**
```typescript
{
  rules: 8000,            // Medium: principles
  task_state: 0,           // None: not doing
  recent_window: 2000,     // Low: don't clutter
  retrieved_evidence: 40000, // Very high: examples
  relevant_decisions: 8000, // High: principles
  capsules: 2000,
}
```

**Examples:**
- "Teach me about Redux middleware"
- "How does PostgreSQL indexing work?"
- "Explain the difference between TCP and UDP"

---

### GENERAL
**Purpose:** Fallback mode when interaction type is unclear
**User Intent:** (fallback)

**What to Keep:**
- Conservative defaults (balanced approach)

**What to Drop:**
- Minimal filtering (keep most things)

**Budget Allocation (tokens):**
```typescript
{
  rules: 6000,
  task_state: 3000,
  recent_window: 8000,
  retrieved_evidence: 28000,
  relevant_decisions: 4000,
  capsules: 4000,
}
```

**Usage:**
- Low confidence in mode classification
- Ambiguous user intent
- Mode transitions (brief period)
- Fallback from other modes due to errors

---

## Intent to Mode Mapping

### Direct Mappings
| Intent | Mode |
|--------|------|
| task | TASK |
| debug | DEBUGGING |
| explore | EXPLORATION |
| learn | LEARNING |
| general | GENERAL |

### Common Variations
| Intent | Mode |
|--------|------|
| implement | TASK |
| fix | DEBUGGING |
| error | DEBUGGING |
| investigate | EXPLORATION |
| explain | LEARNING |
| teach | LEARNING |

### Default Fallback
| Intent | Mode |
|--------|------|
| (empty) | GENERAL |
| default | GENERAL |
| (unknown) | GENERAL |

---

## Mode Transitions

### Detection Frequency
- **Re-classify on each turn** - Don't assume mode persists
- User can switch from exploration to task mid-conversation
- System adapts automatically

### Transition Examples
```
Exploration → Task: "Let's explore... → Let's implement mode detection"
Task → Debugging: "Implement X → Error: X fails"
Learning → Task: "Teach me... → Now I'll use it"
```

### Smoothing
- Use recent mode history (last 3 turns) for confidence
- If mode changes frequently, use GENERAL
- Confidence threshold: 70%

---

## Label Policy

### Classification Targets
- **Precision:** ≥85% (when we say TASK, it should be TASK)
- **Recall:** ≥80% (we should correctly identify most TASK instances)
- **F1 Score:** ≥82% (balance of precision and recall)

### Fallback Rules
- **Confidence < 70%:** Use GENERAL
- **Drift detected:** Use GENERAL (KL divergence > 0.1)
- **High error rate:** Use GENERAL (mode error rate > 2x baseline)

---

## Sticky Invariants

Regardless of mode, NEVER drop these:

### Priority 1000: Safety Requirements
- Never drop safety-critical constraints
- Example: "Must validate all user input"

### Priority 900: User Corrections
- Latest user correction always included
- Example: "No, use LDAP not OAuth"

### Priority 800: Hard Constraints
- Explicit "must" or "must not" requirements
- Example: "Must support 10,000 concurrent users"

### Priority 700: Blocking Errors
- Current blocking errors
- Example: "Stack trace: Authentication failing"

---

## Implementation Reference

**Code:** `src/core/mode-detection.ts`
- `detectModeFromIntent()` - Stage 1: Intent mapping
- `getBudgets()` - Mode-aware budget allocation
- `STICKY_INVARIANTS` - Never-drop rules
- `detectInvariantBreach()` - Runtime safety check

**Integration:** `src/core/orchestrator.ts`
- Mode detection in `buildACB()`
- Mode tracking in `ACBResponse`

---

## Future Work

### Stage 2: Classifier-Based Detection
- Collect 500 labeled examples
- Train mode classifier
- Achieve ≥85% precision, ≥80% recall
- Fall back to intent mapping if classifier unavailable

### Signal Extraction Rules
- Define what "signal" means per mode
- Study successful interactions empirically
- May be domain-specific

### Mode History Smoothing
- Track last 3 modes
- Detect frequent switching
- Use GENERAL for unstable patterns
