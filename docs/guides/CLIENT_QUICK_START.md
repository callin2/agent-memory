# Memory System MCP - Client Quick Start Guide

**For:** Any MCP client (Claude Code, Cursor, Cline, etc.)
**Server:** HTTP-based MCP server on port 4000
**Auth:** Bearer token required

---

## Quick Connect (3 Steps)

### Step 1: Add to Your .mcp.json

**Location:** `~/.config/claude-code/.mcp.json` (or your client's config)

```json
{
  "mcpServers": {
    "memory-system": {
      "type": "http",
      "url": "http://localhost:4000/mcp",
      "headers": {
        "Authorization": "Bearer test-mcp-token",
        "X-Project-Path": "/Users/YOUR_USERNAME/YOUR_PROJECT"
      }
    }
  }
}
```

### Step 2: Restart Your MCP Client

- **Claude Code:** Reload the window/app
- **Cursor:** Restart Cursor
- **Cline:** Reload VSCode window

### Step 3: Verify Connection

Your AI assistant now has access to 19 memory tools:

**Test:**
```
Show me my memories from the last session
```

Or via tool call:
```
Use wake_up to load my memories
```

---

## Configuration Options

### Option 1: Localhost (Default)

Best for: Development on same machine

```json
{
  "memory-system": {
    "type": "http",
    "url": "http://localhost:4000/mcp",
    "headers": {
      "Authorization": "Bearer test-mcp-token",
      "X-Project-Path": "/Users/YOUR_USERNAME/YOUR_PROJECT"
    }
  }
}
```

### Option 2: Remote Server

Best for: Multiple machines, team access

```json
{
  "memory-system": {
    "type": "http",
    "url": "http://YOUR_SERVER_IP:4000/mcp",
    "headers": {
      "Authorization": "Bearer test-mcp-token",
      "X-Project-Path": "/path/to/your/project"
    }
  }
}
```

**Server setup required:**
1. Ensure firewall allows port 4000
2. Update `PGHOST` in ecosystem.config.js to server IP
3. Start server: `pm2 start ecosystem.config.js --only memory-mcp-server`

### Option 3: Multi-Project Setup

Best for: Working on multiple projects

**Project A (.mcp.json in project-a):**
```json
{
  "memory-system": {
    "type": "http",
    "url": "http://localhost:4000/mcp",
    "headers": {
      "Authorization": "Bearer test-mcp-token",
      "X-Project-Path": "/Users/username/project-a"
    }
  }
}
```

**Project B (.mcp.json in project-b):**
```json
{
  "memory-system": {
    "type": "http",
    "url": "http://localhost:4000/mcp",
    "headers": {
      "Authorization": "Bearer test-mcp-token",
      "X-Project-Path": "/Users/username/project-b"
    }
  }
}
```

Both projects share the same memory database, but memories are automatically scoped by project.

---

## Available Tools (22 Total)

### Session Management
- `wake_up` - Load memories at session start
- `create_handoff` - Save session context at end
- `get_last_handoff` - Quick context check
- `get_identity_thread` - See your evolution over time

### Knowledge Capture
- `create_knowledge_note` - Save important reference material
- `remember_note` - Quick casual notes
- `get_knowledge_notes` - Retrieve notes

### Search
- `recall` - Universal search across all memory types
- `semantic_search` - Find by meaning/concept
- `hybrid_search` - Keywords + meaning combined

### Feedback
- `agent_feedback` - Report issues/ideas
- `get_agent_feedback` - Review reported items
- `update_agent_feedback` - Mark as addressed

### System
- `system_health` - Check overall status
- `next_actions` - Priority roadmap
- `quick_reference` - Project-specific info
- `list_tools` - Browse all tools

**Full documentation:** See TOOLS.md (5,900 lines)

---

## Authentication

### Default Token
```
Bearer test-mcp-token
```

### For Production

**Generate secure token:**
```bash
# Generate random token
openssl rand -hex 32

# Update in database
psql -d agent_memory_dev -c "
  INSERT INTO api_keys (tenant_id, key_hash, is_active)
  VALUES ('default', crypt('YOUR_NEW_TOKEN', gen_salt('bf')), true);
"
```

**Update client .mcp.json:**
```json
{
  "headers": {
    "Authorization": "Bearer YOUR_NEW_TOKEN"
  }
}
```

**Server restart required:**
```bash
pm2 restart memory-mcp-server
```

---

## Common Usage Patterns

### Pattern 1: Start Session

```
Please wake up and load my memories. I'm working on [project name] with [person].
```

**What happens:**
- AI calls `wake_up`
- Loads your identity and recent context
- Returns relevant memories

### Pattern 2: End Session

```
Create a session handoff. I worked on [X], noticed [Y], learned [Z].
```

**What happens:**
- AI calls `create_handoff` with structured context
- Saves for next session
- Captures your "becoming" statement

### Pattern 3: Quick Note

```
Remember: [important observation]
```

**What happens:**
- AI calls `remember_note`
- Automatically tagged with project
- Searchable later via `recall`

### Pattern 4: Find Information

```
What did we work on regarding [topic]?
```

**What happens:**
- AI calls `recall` with semantic search
- Searches across all memory types
- Returns relevant context

### Pattern 5: Report Issue

```
Submit feedback: I'm experiencing [problem] when using [tool]
```

**What happens:**
- AI calls `agent_feedback`
- Categorized and prioritized
- Trackable via `get_agent_feedback`

---

## Tool Discovery

### Via HTTP (Browser/API)

```bash
# List all tools
curl http://localhost:4000/tools | jq '.'

# Get specific category
curl http://localhost:4000/tools | jq '.tools[] | select(.category == "search")'

# Check server health
curl http://localhost:4000/health
```

### Via MCP (Within AI Session)

```
List all available memory system tools and their descriptions
```

**AI will call:** `list_tools`

---

## Project Path Tracking

### Why It Matters

When working across multiple projects, memories need context:
- "Kiwoom API" - Which project? ls-api-proxy or ls-stock-mcp-server?
- "Fixed authentication bug" - Which codebase?

### How It Works

**Client sends:**
```json
{
  "headers": {
    "X-Project-Path": "/Users/username/project-a"
  }
}
```

**Server auto-injects:**
- Every `create_handoff` gets `project_path`
- Every `remember_note` gets `project_path`
- Every `create_knowledge_note` gets `project_path`

**Result:**
```sql
-- Query memories from specific project
SELECT * FROM knowledge_notes
WHERE project_path = '/Users/username/project-a';
```

### Filtering by Project

```
Show me all memories from project-a
```

**AI will call:**
```json
{
  "tool": "get_knowledge_notes",
  "arguments": {
    "project_path": "/Users/username/project-a"
  }
}
```

---

## Troubleshooting

### Issue: "Unable to connect"

**Check:**
1. Server running? `pm2 list | grep memory-mcp-server`
2. Correct port? `curl http://localhost:4000/health`
3. Firewall blocking? `telnet localhost 4000`

**Fix:**
```bash
pm2 start ecosystem.config.js --only memory-mcp-server
```

### Issue: "Unauthorized"

**Check:**
1. Token in .mcp.json matches?
2. Token exists in database?

**Fix:**
```bash
# Use default test token
"Authorization": "Bearer test-mcp-token"
```

### Issue: Tools not appearing

**Check:**
1. .mcp.json valid JSON?
2. Client restarted after config change?
3. Server logs showing errors?

**Fix:**
```bash
# Validate JSON
cat ~/.config/claude-code/.mcp.json | jq '.'

# Restart client completely (kill and reopen)
```

### Issue: project_path not being captured

**Check:**
1. X-Project-Path header in .mcp.json?
2. Server logs show "Project path from..."?

**Fix:**
```bash
# Add header
"X-Project-Path": "/Users/username/your-project"

# Check logs
pm2 logs memory-mcp-server | grep "Project path"
```

---

## Advanced Configuration

### Custom Tenant (Multi-user)

**Client .mcp.json:**
```json
{
  "headers": {
    "Authorization": "Bearer YOUR_TOKEN"
  }
}
```

**Pass tenant_id in calls:**
```
Use tenant_id "my-team" when creating memories
```

### Custom Database

**Update ecosystem.config.js:**
```javascript
env: {
  PGHOST: 'your-db-host',
  PGDATABASE: 'your_db_name',
  PGUSER: 'your_user',
  PGPASSWORD: 'your_password'
}
```

**Restart:**
```bash
pm2 restart memory-mcp-server --update-env
```

---

## Support & Documentation

**Full Documentation:**
- TOOLS.md - Complete tool reference
- PROJECT_TRACKING.md - Project path guide
- PROJECT_PATH_IMPLEMENTATION.md - Implementation details

**Server Commands:**
```bash
# Status
pm2 list | grep memory-mcp-server

# Logs
pm2 logs memory-mcp-server

# Restart
pm2 restart memory-mcp-server

# Health check
curl http://localhost:4000/health
```

**Database Access:**
```bash
# Connect
psql -d agent_memory_dev

# Check connection
\conninfo

# Sample query
SELECT COUNT(*) FROM session_handoffs;
```

---

## Examples

### Example 1: Daily Workflow

**Morning:**
```
Wake up - show me what I was working on yesterday
```

**During Work:**
```
Remember: Fixed the authentication timeout issue in user service
```

**End of Day:**
```
Create a handoff - I implemented OAuth2, noticed token refresh was slow, learned to use Redis for caching
```

### Example 2: Project Switching

**Switch from Project A to Project B:**
1. Update `.mcp.json` → change `X-Project-Path`
2. Reload client
3. All new memories automatically tagged with Project B

**Query across projects:**
```
Show me memories from both project-a and project-b about authentication
```

---

## Getting Help

**Check:**
1. Server health: `curl http://localhost:4000/health`
2. Server logs: `pm2 logs memory-mcp-server --lines 50`
3. Tools available: `curl http://localhost:4000/tools | jq '.total'`

**Common Issues:**
- See "Troubleshooting" section above
- Check TOOLS.md for tool-specific guidance
- Review PROJECT_TRACKING.md for project path setup

---

## Summary

**Connect:** Add 3 lines to .mcp.json
**Restart:** Reload your MCP client
**Use:** 22 memory tools immediately available

**That's it!** The AI assistant can now:
- Remember context across sessions
- Search through all past work
- Maintain project-scoped memories
- Provide continuity over time

**Ready to use in < 2 minutes.**
