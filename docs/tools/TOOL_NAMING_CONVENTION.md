# Tool Naming Convention Analysis

**Date:** 2026-02-20
**Issue:** Introspective tools need distinct naming from data retrieval tools

---

## Current Naming Confusion

### Data Retrieval Tools (get actual data)
```typescript
get_last_handoff        // Gets memory data
get_identity_thread     // Gets memory data
get_knowledge_notes     // Gets memory data
get_agent_feedback      // Gets feedback data
get_capsules            // Gets capsule data
```

### Introspective Tools (get metadata about system)
```typescript
get_quick_reference      // Gets system documentation  ⚠️ CONFUSING
get_system_health        // Gets system status       ⚠️ CONFUSING
get_compression_stats    // Gets system metrics      ⚠️ CONFUSING
list_available_tools     // Lists tool metadata      ⚠️ LESS CONFUSING
```

**Problem:** All use `get_` prefix, unclear what's data vs metadata

---

## User Confusion Scenarios

### Scenario 1: AI Agent
```
"Get my quick reference"
AI: Calls get_quick_reference → Gets system documentation
Expected: Maybe thinks it's retrieving saved reference data?
```

### Scenario 2: New Client
```
Client sees: get_system_health
Thinks: This gets health data from my memories
Reality: It's about the memory system itself, not my data
```

### Scenario 3: Browse Tools
```
Client lists tools, sees:
- get_knowledge_notes
- get_agent_feedback
- get_quick_reference
- get_system_health

All look the same! Which are my data vs system info?
```

---

## Proposed Naming Convention

### Option 1: Prefix-Based (Recommended)

**Data Retrieval:** `get_*` (current)
- `get_knowledge_notes`
- `get_agent_feedback`
- `get_last_handoff`

**Introspection:** `about_*` or `system_*`
- `about_quick_reference` or `system_quick_reference`
- `about_system_health` or `system_health`
- `about_compression_stats` or `system_compression`

**Listing:** `list_*` (current)
- `list_handoffs` - data
- `list_available_tools` → `list_tools` or `about_tools` (meta)

### Option 2: Suffix-Based

**Data Retrieval:** No change
- `get_knowledge_notes`

**Introspection:** Add `*_info` or `*_guide`
- `quick_reference_guide`
- `system_health_info`
- `compression_stats_info`

### Option 3: Verb-Based

**Data Retrieval:** `get_*`, `find_*`, `search_*`
- `get_knowledge_notes`
- `search_memories`

**Introspection:** `show_*`, `check_*`, `browse_*`
- `show_quick_reference`
- `check_system_health`
- `browse_tools`

---

## Recommended Changes

| Current Tool | Proposed Name | Rationale |
|--------------|---------------|-----------|
| `get_quick_reference` | `quick_reference` or `help_guide` | It's already a reference/guide, not "getting" data |
| `get_system_health` | `system_health` or `health_check` | Checking system status, not retrieving stored data |
| `get_compression_stats` | `compression_stats` or `system_stats` | System metrics, not user data |
| `list_available_tools` | `list_tools` or `tools_list` | Simpler, clearly meta |
| `get_next_actions` | `next_actions` or `action_items` | System roadmap, not stored data |

**Pattern:**
- **Data tools:** Keep `get_*` prefix (retrieves stored memories)
- **Meta tools:** No prefix or `about_*` (system information)

---

## Implementation Impact

### Breaking Changes?
**Yes** - Tool names would change, clients need updates

### Migration Path:
1. **Add new tools** with better names
2. **Deprecate old names** (keep working for compatibility)
3. **Update documentation**
4. **Phase out old names** after transition period

### Alternative: Keep Old + Add New
```typescript
// Old (deprecated but working)
get_system_health

// New (recommended)
system_health

// Both work, documentation recommends new
```

---

## Category-Based Organization

### Memory Tools (Data)
```typescript
wake_up
create_handoff
get_last_handoff           // Gets stored handoff
get_identity_thread          // Gets stored identity
list_handoffs               // Lists stored data
```

### Knowledge Tools (Data)
```typescript
create_knowledge_note
get_knowledge_notes         // Gets stored notes
remember_note
list_semantic_principles    // Lists stored principles
```

### Search Tools (Data)
```typescript
semantic_search
hybrid_search
recall
```

### System Tools (Meta)
```typescript
quick_reference            // NOT get_*, it's a guide
system_health              // NOT get_*, it's a check
compression_stats          // NOT get_*, it's metrics
list_tools                 // Meta: list available tools
next_actions               // Meta: system roadmap
```

---

## Examples of Clear Naming

### Before (Confusing)
```
Agent: "Get my system health"
→ Calls get_system_health
→ But system health isn't "my data", it's about the system
```

### After (Clear)
```
Agent: "Get my system health"
→ Agent realizes: system_health is a meta-tool
→ Distinguishes from getting stored data

Or better:
Agent: "Check system health"
→ Clearly about the system, not stored data
```

---

## Quick Reference vs Data

### Quick Reference is NOT Stored Data
It's built into the system code:
```typescript
export const QUICK_REFERENCES = {
  client_quick_start: { /* ... */ },
  pre_implementation_checklist: { /* ... */ }
}
```

**Not retrieved from database** like:
```sql
SELECT * FROM knowledge_notes WHERE ...
```

### System Health is NOT User Data
It's calculated from feedback tables:
```typescript
const total = await pool.one("SELECT COUNT(*) FROM agent_feedback WHERE ...");
```

**Not retrieved from user memories**

---

## Recommendation

### Short Term (Compatibility)
Keep current names, add aliases:
```typescript
// Primary name (for compatibility)
get_quick_reference

// Aliases (for clarity)
quick_reference
help_guide
about_quick_reference
```

### Long Term (Clarity)
1. Add new tools with clear names
2. Mark old names as deprecated in description
3. Update documentation to use new names
4. Remove old names after transition

---

## Tool Categories for Discovery

Update `list_available_tools` to return:
```json
{
  "memory": {
    "description": "Store and retrieve your memories",
    "tools": ["wake_up", "create_handoff", "get_last_handoff", ...]
  },
  "knowledge": {
    "description": "Capture and reference knowledge",
    "tools": ["create_knowledge_note", "get_knowledge_notes", ...]
  },
  "search": {
    "description": "Find information across all memories",
    "tools": ["semantic_search", "hybrid_search", "recall"]
  },
  "system": {
    "description": "System information and diagnostics (not your data)",
    "tools": ["quick_reference", "system_health", "compression_stats"]
  },
  "feedback": {
    "description": "Report and track system improvements",
    "tools": ["agent_feedback", "get_agent_feedback", "update_agent_feedback"]
  }
}
```

**Key distinction:** "System information (not your data)"

---

## Summary

**Problem:** Introspective tools look like data retrieval tools

**Solution:** Use distinct naming
- Data tools: `get_*` (retrieves stored data)
- Meta tools: No prefix or `about_*` (system information)

**Benefit:** Clear distinction between "my data" and "system info"

**Status:** Proposed for discussion and implementation
