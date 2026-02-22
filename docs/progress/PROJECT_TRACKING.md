# Project Path Tracking - Configuration Guide

**Status:** ✅ Implemented
**Migration:** 032_project_tracking.sql (database schema complete)
**Auto-injection:** 2026-02-20 (automatic capture added)

---

## Problem Solved

When working across multiple projects in the same parent directory (e.g., `ls-stock-mcp-server`, `ls-api-proxy`, `ls-api`), memories lost project context. Couldn't distinguish which project a memory referred to.

**Example Confusion:**
- "Kiwoom API verification" - was this in `ls-api-proxy` or `ls-stock-mcp-server`?
- Recent handoff described work without specifying project directory

---

## Solution

Automatic `project_path` capture and injection for all memory types:
- `session_handoffs`
- `knowledge_notes`
- `agent_feedback`

**How it works:**
1. Server detects project path from HTTP header or environment variable
2. Automatically injects into memory creation calls
3. Stored in database for retrieval and filtering

---

## Configuration Options

### Option 1: Environment Variable (Recommended for Development)

Set `MEMORY_PROJECT_PATH` environment variable before starting the memory server:

```bash
# In agent_memory_v2 directory
export MEMORY_PROJECT_PATH=/Users/callin/Callin_Project/ls-api-proxy
pm2 restart memory-mcp-server
```

**Or update PM2 ecosystem file:**

```javascript
module.exports = {
  apps: [{
    name: "memory-mcp-server",
    env: {
      MEMORY_PROJECT_PATH: "/Users/callin/Callin_Project/ls-api-proxy"
    }
  }]
}
```

### Option 2: HTTP Header (For Multi-Project Setups)

Add `X-Project-Path` header to MCP client configuration.

**Update .mcp.json:**

```json
{
  "mcpServers": {
    "memory-system": {
      "type": "http",
      "url": "http://localhost:4000/mcp",
      "headers": {
        "Authorization": "Bearer test-mcp-token",
        "X-Project-Path": "/Users/callin/Callin_Project/ls-api-proxy"
      }
    }
  }
}
```

**Priority:** Header > Environment Variable > undefined

---

## Affected Tools

### Auto-injection enabled for:
- `create_handoff` - Session handoffs include project context
- `create_knowledge_note` - Knowledge notes scoped to project
- `remember_note` - Quick notes tagged with project
- `agent_feedback` - Feedback tracked by project

### Filtering supported for:
- `list_handoffs(project_path)` - Get handoffs from specific project
- `get_knowledge_notes(project_path)` - Get notes from specific project
- `get_agent_feedback(project_path)` - Get feedback from specific project
- `recall(project_path)` - Universal search across project-scoped memories

---

## Testing

### 1. Verify Configuration

```bash
# Check environment variable
echo $MEMORY_PROJECT_PATH

# Or check PM2 logs for auto-injection
pm2 logs memory-mcp-server --lines 20 | grep "Project path"
```

**Expected output:**
```
[2026-02-20T...] Project path from env: /Users/callin/Callin_Project/ls-api-proxy
[2026-02-20T...] Auto-injected project_path for create_knowledge_note: /Users/callin/Callin_Project/ls-api-proxy
```

### 2. Create a Memory and Verify project_path

```bash
# Via MCP
curl -X POST http://localhost:4000/mcp \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer test-mcp-token" \
  -H "X-Project-Path: /Users/callin/Callin_Project/test-project" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/call",
    "params": {
      "name": "remember_note",
      "arguments": {
        "text": "Test note for project tracking"
      }
    }
  }'
```

### 3. Query by project_path

```sql
-- Direct database query
SELECT id, text, project_path, created_at
FROM knowledge_notes
WHERE project_path = '/Users/callin/Callin_Project/ls-api-proxy'
ORDER BY created_at DESC
LIMIT 10;
```

### 4. Test Filtering via MCP

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "get_knowledge_notes",
    "arguments": {
      "project_path": "/Users/callin/Callin_Project/ls-api-proxy"
    }
  }
}
```

---

## Multi-Project Workflow

### Scenario 1: Single Memory Server, Multiple Projects

**Architecture:**
- One `memory-mcp-server` instance running
- Multiple projects connect via HTTP
- Each project sends its `X-Project-Path` header

**Configuration per project:**

**ls-api-proxy/.mcp.json:**
```json
{
  "mcpServers": {
    "memory-system": {
      "type": "http",
      "url": "http://localhost:4000/mcp",
      "headers": {
        "Authorization": "Bearer test-mcp-token",
        "X-Project-Path": "/Users/callin/Callin_Project/ls-api-proxy"
      }
    }
  }
}
```

**ls-stock-mcp-server/.mcp.json:**
```json
{
  "mcpServers": {
    "memory-system": {
      "type": "http",
      "url": "http://localhost:4000/mcp",
      "headers": {
        "Authorization": "Bearer test-mcp-token",
        "X-Project-Path": "/Users/callin/Callin_Project/ls-stock-mcp-server"
      }
    }
  }
}
```

**Benefits:**
- Shared memory database across projects
- Project-scoped retrieval via `project_path`
- Cross-project search possible (omit `project_path` filter)

### Scenario 2: Environment Variable Per Deployment

**Use case:** Development environment switching

```bash
# Working on ls-api-proxy
export MEMORY_PROJECT_PATH=/Users/callin/Callin_Project/ls-api-proxy
pm2 restart memory-mcp-server

# ... work on ls-api-proxy ...

# Switch to ls-stock-mcp-server
export MEMORY_PROJECT_PATH=/Users/callin/Callin_Project/ls-stock-mcp-server
pm2 restart memory-mcp-server

# ... work on ls-stock-mcp-server ...
```

---

## Database Schema

**Tables with project_path:**
- `session_handoffs.project_path` TEXT
- `knowledge_notes.project_path` TEXT
- `agent_feedback.project_path` TEXT

**Indexes for performance:**
- `idx_session_handoffs_project_path` on (tenant_id, project_path)
- `idx_knowledge_notes_project_path` on (tenant_id, project_path)
- `idx_agent_feedback_project_path` on (tenant_id, project_path)

**Example query:**
```sql
-- Get all memories from a specific project
SELECT 'handoff' as type, id, becoming, created_at
FROM session_handoffs
WHERE project_path = '/Users/callin/Callin_Project/ls-api-proxy'
UNION ALL
SELECT 'knowledge' as type, id, text, created_at
FROM knowledge_notes
WHERE project_path = '/Users/callin/Callin_Project/ls-api-proxy'
UNION ALL
SELECT 'feedback' as type, id, description, created_at
FROM agent_feedback
WHERE project_path = '/Users/callin/Callin_Project/ls-api-proxy'
ORDER BY created_at DESC;
```

---

## Troubleshooting

### Issue: project_path not being captured

**Check:**
1. Server logs for "Project path from..." messages
2. HTTP header is being sent (check .mcp.json)
3. Environment variable is set (`echo $MEMORY_PROJECT_PATH`)
4. Server restarted after configuration change

**Debug:**
```bash
# View server logs
pm2 logs memory-mcp-server --lines 50

# Check for auto-injection messages
pm2 logs memory-mcp-server | grep "Auto-injected"
```

### Issue: Old memories don't have project_path

**Solution:** Old memories created before this feature will have `NULL` project_path. This is expected. Only new memories will have project_path automatically captured.

**Backfill (if needed):**
```sql
-- Update existing handoffs with default project path
UPDATE session_handoffs
SET project_path = '/Users/callin/Callin_Project/agent_memory_v2'
WHERE project_path IS NULL;
```

### Issue: project_path filtering not working

**Check:**
1. Tool supports `project_path` parameter (all retrieval tools do)
2. Exact path match (no trailing slashes unless present in data)
3. Indexes exist (`idx_*_project_path`)

**Test:**
```bash
# Direct SQL test
psql -d agent_memory -c "
SELECT COUNT(*)
FROM knowledge_notes
WHERE project_path = '/Users/callin/Callin_Project/ls-api-proxy';
"
```

---

## Migration Notes

**From migration 032_project_tracking.sql:**
- Columns added with `ADD COLUMN IF NOT EXISTS` (safe to re-run)
- Indexes created for performance
- Comments added for documentation

**Rollback (if needed):**
```sql
DROP INDEX IF EXISTS idx_session_handoffs_project_path;
DROP INDEX IF EXISTS idx_knowledge_notes_project_path;
DROP INDEX IF EXISTS idx_agent_feedback_project_path;

ALTER TABLE session_handoffs DROP COLUMN IF EXISTS project_path;
ALTER TABLE knowledge_notes DROP COLUMN IF EXISTS project_path;
ALTER TABLE agent_feedback DROP COLUMN IF EXISTS project_path;
```

---

**Implementation Status:** ✅ Complete
**Auto-injection:** ✅ Deployed
**Documentation:** ✅ Complete
**Testing:** ⏭️ Required
