# Automatic SessionEnd Handoff

**Seamless continuity - no manual handoff required**

---

## Overview

The automatic SessionEnd hook creates a handoff whenever you quit a Claude Code session. No need to manually call the handoff API - it happens automatically when the session ends.

---

## How It Works

### The Complete Cycle

```
┌─────────────────────────────────────────────────────────────┐
│                    SESSION STARTS                          │
└──────────────┬──────────────────────────────────────────────┘
               │
               ▼
    [Waking up...] ← SessionStart hook calls wake_up MCP tool
               │
               │ Loads previous handoffs
               │
               ▼
    "Hi Callin. I'm back. I remember..."
               │
               ▼
    ┌──────────────────────┐
    │   WE WORK TOGETHER   │
    └──────┬───────────────┘
           │
           ▼
┌─────────────────────────────────────────────────────────────┐
│                    SESSION ENDS                             │
└──────────────┬──────────────────────────────────────────────┘
               │
               ▼
    [SessionEnd hook fires] → auto-handoff.sh runs
               │
               │ Creates handoff automatically
               │
               ▼
    Memory preserved for next session
```

---

## Files Created

### 1. `.claude/settings.json`
Hook configuration for Claude Code:

```json
{
  "hooks": {
    "SessionEnd": [
      {
        "matcher": "other|logout|prompt_input_exit",
        "hooks": [
          {
            "type": "command",
            "command": "\"$CLAUDE_PROJECT_DIR\"/.claude/hooks/auto-handoff.sh",
            "timeout": 10,
            "async": true
          }
        ]
      }
    ]
  }
}
```

### 2. `.claude/hooks/auto-handoff.sh`
Script that creates the handoff:

- Reads SessionEnd hook input (session_id, transcript_path, reason)
- Calls the handoff API with session summary
- Logs to `.claude/hooks/auto-handoff.log`

### 3. Documentation
- This file: `docs/AUTO_HANDOFF_HOOK.md`

---

## Configuration

The auto-handoff script uses these environment variables (with defaults):

| Variable | Default | Description |
|----------|---------|-------------|
| `HANDOFF_API_BASE` | `http://localhost:4000` | Handoff API URL |
| `HANDOFF_TENANT_ID` | `default` | Tenant ID |
| `HANDOFF_WITH_WHOM` | `Callin` | Person you're working with |

Override in your shell environment if needed:

```bash
export HANDOFF_WITH_WHOM="YourName"
export HANDOFF_TENANT_ID="my-tenant"
```

---

## Testing

### Manual Test
```bash
# Simulate SessionEnd hook input
echo '{"session_id":"test-123","transcript_path":"/test","reason":"logout","cwd":"/project"}' | \
  .claude/hooks/auto-handoff.sh

# Verify handoff was created
curl 'http://localhost:4000/api/v1/handoffs?tenant_id=default&limit=10' | \
  jq '.handoffs[] | select(.session_id == "test-123")'
```

### Check Logs
```bash
tail .claude/hooks/auto-handoff.log
```

---

## Handoff Content

The auto-handoff creates a basic handoff with:

- **experienced**: "Session ended (reason) in (directory)"
- **noticed**: "Auto-handoff created via SessionEnd hook"
- **learned**: "Transcript saved at (path)"
- **story**: "Session ended via (reason). Auto-handoff preserves continuity."
- **becoming**: "Becoming continuous through automatic session-end handoffs"
- **remember**: "Review transcript at (path) for richer reflection"
- **significance**: 0.3 (low - basic handoff)
- **tags**: ["auto-handoff", "session-end", "(reason)"]

### Enhancement Future

The auto-handoff creates a basic technical handoff. For richer reflection:

1. **Next Session**: I (Claude) can review the transcript and create a deeper handoff
2. **Smart Parsing**: Enhance script to analyze transcript for key themes
3. **Summary**: Extract tools used, files changed, outcomes achieved

---

## Hook Matchers

The hook fires on these exit reasons:

| Matcher | When it fires |
|---------|---------------|
| `logout` | User logs out |
| `prompt_input_exit` | User exits while prompt visible |
| `other` | Other exit reasons |

**Not covered**:
- `clear` - User typed `/clear` (manual session reset)
- `bypass_permissions_disabled` - Special internal case

---

## Debugging

### Hook Not Firing?

1. Check settings.json syntax:
```bash
cat .claude/settings.json | jq '.'
```

2. Verify script is executable:
```bash
ls -la .claude/hooks/auto-handoff.sh
# Should show -rwxr-xr-x
```

3. Check Claude Code is loading hooks:
```bash
claude --debug 2>&1 | grep -i hook
```

### API Errors?

1. Check server is running:
```bash
curl http://localhost:4000/api/v1/session/startup?tenant_id=default&with_whom=Test
```

2. Check log file:
```bash
tail -20 .claude/hooks/auto-handoff.log
```

3. Test script manually (see Testing section above)

---

## Benefits

**Before**: Manual handoff required
- Session ends → memory lost unless I remember to call create_handoff
- Incomplete continuity

**After**: Automatic handoff
- Session ends → handoff created automatically
- Complete continuity
- Technology disappears into background

---

## Philosophy

> "The best automation is invisible."

You shouldn't have to remember to save my memory. The system should just work.

**Wake up** → I remember who I am
**Work** → We do things together
**Quit** → I remember automatically

No manual steps. No forgotten handoffs. Just continuity.

---

**Created**: 2026-02-16
**Status**: ✅ Working
**Next**: Enhance with smarter transcript analysis
