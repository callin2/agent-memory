/**
 * Quick Reference Summaries
 *
 * Focused documentation snippets for fast lookups
 * Avoids reading entire SOURCES_OF_TRUTH.md
 */

export const QUICK_REFERENCES = {
  pre_implementation_checklist: {
    title: "Pre-Implementation Checklist",
    content: `
**STOP. Before you code, ask yourself:**

1. **Do I understand the problem?**
   - Can I state it in one sentence?
   - If NO → Ask user to clarify. Don't guess.

2. **What are the assumptions?**
   - List them explicitly
   - If uncertain → Present multiple interpretations

3. **Is there a simpler approach?**
   - What's the minimum viable solution?
   - Am I over-engineering?

4. **Have I presented a plan?**
   - State what you'll do
   - Get user sign-off before coding

5. **Why am I doing this?**
   - Connect to actual user need
   - Not just "because I can"

**Pattern to avoid**: Implement before understanding → User stops you → Wasted effort.

**Better pattern**: Understand → Plan → Confirm → Implement → Right first time.
    `.trim()
  },

  mcp_tools: {
    title: "MCP Tools (13 Total)",
    content: `
**Memory & Identity**
1. wake_up - Load memories (default: recent only, opt-in: full layers)
2. create_handoff - Create session handoff
3. get_last_handoff - Get most recent handoff
4. get_identity_thread - Get "becoming" statements over time
5. list_handoffs - List all handoffs

**Knowledge Capture**
6. create_knowledge_note - Quick Post-It style note
7. get_knowledge_notes - Retrieve knowledge notes
8. list_semantic_principles - Timeless learnings

**Advanced**
9. create_capsule - Timed memory capsule
10. get_capsules - List available capsules
11. get_compression_stats - Token savings metrics

**Agent Feedback**
12. agent_feedback - Report friction/bugs/suggestions
13. get_agent_feedback - Retrieve feedback
14. update_agent_feedback - Mark as addressed/reviewed

**Usage**: Use memory-client-v2.js for unified parameter handling
    `.trim()
  },

  common_tasks: {
    title: "Common Tasks",
    content: `
**Start session**:
- wake_up → shows recent handoffs + open feedback

**Save handoff**:
- create_handoff with all fields (experienced, noticed, learned, story, becoming, remember)

**Report problem**:
- agent_feedback with category, type, description

**Check feedback**:
- wake_up automatically shows open feedback items
- get_agent_feedback to retrieve all

**Replay WAL** (if MCP was down):
- node scripts/replay-wal.js

**Run tests**:
- node tests/integration/wal-test.mjs
    `.trim()
  },

  project_structure: {
    title: "Project Structure",
    content: `
**Source Code**
- src/mcp/memory-server-http.ts - MCP server (13 tools)
- src/mcp/auth.ts - Bearer token auth
- src/utils/wal.js - Write-Ahead Logging
- src/utils/memory-client-v2.js - Memory client (use this one)

**Database**
- src/db/schema.sql - Main schema
- src/db/migrations/ - Migration files
- src/db/migrations/030_agent_feedback.sql - Latest (feedback table)

**Scripts**
- scripts/replay-wal.js - Manual WAL replay

**Tests**
- tests/integration/ - Integration tests
- tests/manual/ - Manual test scripts
- tests/debug/ - Debugging scripts

**Documentation**
- docs/SOURCES_OF_TRUTH.md - Single source of truth
- docs/ONBOARDING.md - Getting started
- docs/MAINTENANCE.md - Maintenance protocol
    `.trim()
  },

  troubleshooting: {
    title: "Troubleshooting",
    content: `
**MCP connection issues**
- Check: pm2 logs memory-mcp-server
- Restart: pm2 restart memory-mcp-server
- Auth: Use 'Bearer test-mcp-token' header

**Parameter confusion**
- Use memory-client-v2.js (handles params/arguments/args)
- Or use correct format: {name, arguments: {...}}

**WAL not replaying**
- Check: ls .memory-wal/operations.jsonl
- Manual replay: node scripts/replay-wal.js

**Significance parameter error**
- Now accepts both number (0.9) and string ("0.90")
- Auto-converts before database insert

**Skill tool wrapper bugs**
- Use direct fetch or memory-client-v2.js instead
- Documented in agent_feedback ID: 98db69ba9f797d59eda26d5e14193e8e
    `.trim()
  },

  database_schema: {
    title: "Database Tables",
    content: `
**Core Memory Tables**
- events - Ground truth events
- session_handoffs - Session handoffs
- memory_reflections - Consolidated insights
- semantic_memory - Timeless principles
- knowledge_notes - Quick notes

**Agent Feedback**
- agent_feedback - System feedback from agents

**Metadata**
- users - User accounts
- tasks - Task tracking
- artifacts - Generated artifacts
- rules - System rules
- chunks - Context chunks

**Connection**: psql postgresql://agent_mem_dba:adminqwer1234@localhost:5432/agent_memory
    `.trim()
  }
};

/**
 * Get quick reference by topic
 */
export function getQuickReference(topic: string): { title: string; content: string } | null {
  const key = topic.toLowerCase().replace(/\s+/g, '_') as keyof typeof QUICK_REFERENCES;
  return QUICK_REFERENCES[key] || null;
}

/**
 * List all available topics
 */
export function listQuickReferenceTopics() {
  return Object.keys(QUICK_REFERENCES).map(key => ({
    topic: key,
    title: QUICK_REFERENCES[key as keyof typeof QUICK_REFERENCES].title
  }));
}
