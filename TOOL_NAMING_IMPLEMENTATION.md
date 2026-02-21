# Tool Naming Convention - Implementation Complete

**Date:** 2026-02-20
**Status:** ✅ Implemented
**Breaking Change:** Yes - Tool names changed for clarity

---

## What Changed

### Renamed Tools (5 introspective tools)

| Old Name | New Name | Rationale |
|----------|----------|-----------|
| `get_quick_reference` | `quick_reference` | It's a reference guide, not "getting" stored data |
| `get_system_health` | `system_health` | System status check, not data retrieval |
| `get_compression_stats` | `compression_stats` | System metrics, not user data |
| `list_available_tools` | `list_tools` | Simpler, clearly meta |
| `get_next_actions` | `next_actions` | Roadmap, not stored data |

### Unchanged Tools (Data retrieval tools)

All `get_*` tools that retrieve **your stored data** keep the prefix:
- `get_knowledge_notes` ✅
- `get_agent_feedback` ✅
- `get_last_handoff` ✅
- `get_identity_thread` ✅
- `get_capsules` ✅

---

## New Naming Convention

### Pattern: `get_*` = Your Data, No Prefix = System Info

**Data Tools (get_* prefix):**
```typescript
get_knowledge_notes    // Retrieves YOUR stored notes
get_agent_feedback     // Retrieves YOUR feedback data
get_last_handoff        // Retrieves YOUR handoff data
```

**System Tools (no prefix):**
```typescript
quick_reference         // System documentation
system_health          // System status
compression_stats      // System metrics
list_tools            // Tool metadata
next_actions          // System roadmap
```

### Clear Category Descriptions

**System tools now include:** "SYSTEM INFORMATION - not your stored data"

**Example:**
```typescript
{
  name: "system_health",
  description: "Overall system status check. SYSTEM INFORMATION - monitors the memory system itself, not your stored data..."
}
```

---

## Benefits

### 1. Clear Distinction

**Before:**
```
Agent: "Get my system health"
→ Calls get_system_health
→ Confusing: Is this my data or system info?
```

**After:**
```
Agent: "Check system health"
→ Calls system_health
→ Clear: This is about the system, not my data
```

### 2. Mental Model

**Data tools:** "I'm getting something I stored"
- `get_knowledge_notes` → Get my notes
- `get_last_handoff` → Get my handoff

**System tools:** "I'm checking system status"
- `system_health` → Check how system is doing
- `compression_stats` → See system performance

### 3. Tool Discovery

**When browsing tools:**
```
Data Tools (get_* prefix):
- get_knowledge_notes
- get_agent_feedback
- get_last_handoff

System Tools (no prefix):
- quick_reference
- system_health
- compression_stats
- list_tools
- next_actions
```

**Instant clarity!**

---

## Migration Guide for Clients

### If You Used Old Names

**Update your calls:**

| Old Call | New Call |
|----------|----------|
| `get_quick_reference(topic)` | `quick_reference(topic)` |
| `get_system_health()` | `system_health()` |
| `get_compression_stats()` | `compression_stats()` |
| `list_available_tools()` | `list_tools()` |
| `get_next_actions()` | `next_actions()` |

### Example Updates

**Before:**
```json
{
  "tool": "get_quick_reference",
  "arguments": { "topic": "client_quick_start" }
}
```

**After:**
```json
{
  "tool": "quick_reference",
  "arguments": { "topic": "client_quick_start" }
}
```

---

## Documentation Updates

### Files to Update

1. **TOOLS.md** - Update all tool references
2. **CLIENT_QUICK_START.md** - Update examples
3. **PROJECT_TRACKING.md** - Update if mentioned
4. **Any session summaries** - Update tool names

### Update Pattern

**Search and replace:**
```
get_quick_reference → quick_reference
get_system_health → system_health
get_compression_stats → compression_stats
list_available_tools → list_tools
get_next_actions → next_actions
```

---

## Testing

### Verify Renamed Tools Work

```bash
# All tools should be available
curl http://localhost:4000/tools | jq '.total'
# Output: 22

# System tools should have new names
curl http://localhost:4000/tools | jq '.tools[] | select(.category == "system") | .name'
# Output:
# - compression_stats
# - quick_reference
# - next_actions
# - system_health
# - list_tools
```

### Test via MCP (After Client Reload)

```
Show me the system health
→ Calls system_health (was get_system_health)

Show me quick reference for clients
→ Calls quick_reference (was get_quick_reference)

List all available tools
→ Calls list_tools (was list_available_tools)
```

---

## Category Organization

### Updated Categories

```javascript
categories: {
  memory: "Store and retrieve your memories, handoffs, knowledge notes",
  search: "Search your memories using semantic and hybrid search",
  feedback: "Submit and retrieve agent feedback about the system",
  system: "System information and diagnostics (not your stored data)"
}
```

**Key distinction:** "your memories" vs "system information"

---

## Backward Compatibility

### Not Maintained

This is a **breaking change**. Old tool names will not work.

### Rationale

1. **Clarity more important than compatibility**
2. **Only 5 tools affected** (out of 22)
3. **Simple find/replace migration**
4. **Prevents ongoing confusion**

### Transition Support

**Documentation clearly indicates:**
- SYSTEM INFORMATION tools vs data retrieval
- New names are more intuitive
- Migration guide provided

---

## Impact Assessment

### Short Term

**Pros:**
- ✅ Clear distinction between data and system
- ✅ Better mental model for users
- ✅ Self-documenting tool names

**Cons:**
- ⚠️ Breaking change for existing clients
- ⚠️ Documentation needs updates
- ⚠️ AI agents may reference old names initially

### Long Term

**Benefits:**
- ✅ Reduced confusion for new users
- ✅ Clearer onboarding
- ✅ Better discoverability
- ✅ Self-explanatory tool names

---

## Summary

**Problem:** Introspective tools looked like data retrieval tools
**Solution:** Remove `get_` prefix from system information tools
**Result:** Clear distinction between "my data" and "system info"

**Status:** ✅ Implemented and deployed
**Testing:** ⏳ Awaiting client reload and usage feedback
**Documentation:** ⏳ Updates needed

---

**Next Steps:**
1. Update TOOLS.md with new tool names
2. Update CLIENT_QUICK_START.md with new examples
3. Create migration guide for existing users
4. Monitor feedback for any confusion
