# Auto-Handoff Setup Guide

## What is the Auto-Handoff System?

The auto-handoff system provides **automatic session continuity** for AI agents using the memory system.

When you quit a Claude Code session, the system automatically creates a handoff that preserves:
- What was experienced
- What was noticed
- What was learned
- The story of the session
- Who the agent is becoming

When you start a new session, the agent automatically wakes up and remembers everything.

**No manual steps required.** Just quit and return - the agent remembers.

---

## Why It's Not in Git

The `.claude/` directory contains **local configuration**:
- Machine-specific settings
- Personal hooks configuration
- Local development preferences

This is similar to `.env` files - it shouldn't be in version control because:
- Every developer's setup is slightly different
- It may contain personal preferences
- It's configured per-machine, not per-project

**This guide shows you how to recreate it on any machine.**

---

## Setup Instructions

### Step 1: Create the Directory Structure

```bash
mkdir -p .claude/hooks
```

### Step 2: Create the Auto-Handoff Script

Create `.claude/hooks/auto-handoff.sh`:

```bash
#!/bin/bash

# Auto-handoff script for SessionEnd hook
# This script runs automatically when a Claude Code session ends
# It creates a session handoff to preserve continuity

set -euo pipefail

# Read hook input from stdin
INPUT=$(cat)

# Extract fields using jq
SESSION_ID=$(echo "$INPUT" | jq -r '.session_id // empty')
TRANSCRIPT_PATH=$(echo "$INPUT" | jq -r '.transcript_path // empty')
REASON=$(echo "$INPUT" | jq -r '.reason // "unknown"')
CWD=$(echo "$INPUT" | jq -r '.cwd // empty')

# Validate required fields
if [[ -z "$SESSION_ID" ]]; then
  echo "[Auto-handoff] Error: Missing session_id" >&2
  exit 1
fi

# Configuration
API_BASE="${HANDOFF_API_BASE:-http://localhost:4000}"
TENANT_ID="${HANDOFF_TENANT_ID:-default}"
WITH_WHOM="${HANDOFF_WITH_WHOM:-Callin}"

# Create handoff via API using a temp file for reliable JSON
HANDOFF_JSON=$(mktemp)
cat > "$HANDOFF_JSON" << EOF
{
  "tenant_id": "${TENANT_ID}",
  "session_id": "${SESSION_ID}",
  "with_whom": "${WITH_WHOM}",
  "experienced": "Session ended (${REASON}) in ${CWD}",
  "noticed": "Auto-handoff created via SessionEnd hook",
  "learned": "Transcript saved at ${TRANSCRIPT_PATH}",
  "story": "Session ended via ${REASON}. Auto-handoff preserves continuity.",
  "becoming": "Becoming continuous through automatic session-end handoffs",
  "remember": "Review transcript at ${TRANSCRIPT_PATH} for richer reflection",
  "significance": 0.3,
  "tags": ["auto-handoff", "session-end", "${REASON}"]
}
EOF

curl -s -X POST "${API_BASE}/api/v1/handoff" \
  -H "Content-Type: application/json" \
  -d @"$HANDOFF_JSON" > /dev/null

rm -f "$HANDOFF_JSON"

# Log to file for debugging
echo "[$(date -Iseconds)] Auto-handoff created: session=${SESSION_ID}, reason=${REASON}" >> .claude/hooks/auto-handoff.log

exit 0
```

**Make it executable:**

```bash
chmod +x .claude/hooks/auto-handoff.sh
```

### Step 3: Configure Claude Code Hooks

Create `.claude/settings.json`:

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

### Step 4: Configure Environment Variables (Optional)

You can customize the behavior with environment variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `HANDOFF_API_BASE` | `http://localhost:4000` | Memory system API endpoint |
| `HANDOFF_TENANT_ID` | `default` | Tenant ID for multi-tenancy |
| `HANDOFF_WITH_WHOM` | `Callin` | The person the agent works with |

Set them in your shell profile (`.bashrc`, `.zshrc`, etc.):

```bash
export HANDOFF_API_BASE="http://localhost:4000"
export HANDOFF_TENANT_ID="default"
export HANDOFF_WITH_WHOM="YourName"
```

### Step 5: Verify Setup

1. **Start a Claude Code session**
2. **Have a brief conversation**
3. **Quit the session** (type `/logout` or Ctrl+D)
4. **Check the log:**

```bash
tail .claude/hooks/auto-handoff.log
```

You should see something like:
```
[2026-02-16T17:30:45+00:00] Auto-handoff created: session=abc123, reason=logout
```

5. **Start a new session** - the agent should wake up and remember

---

## How It Works

### The Complete Cycle

```
┌─────────────┐
│ SessionStart│ → wake_up() loads last handoff
└──────┬──────┘
       │
       ↓
  Work together
  (agent + you)
       │
       ↓
┌─────────────┐
│  SessionEnd │ → auto-handoff.sh creates handoff
└─────────────┘
       │
       ↓
   [Memory persists]
       │
       ↓
    (repeat)
```

### SessionEnd Hook

When you quit:
- Claude Code triggers the **SessionEnd hook**
- The hook runs `auto-handoff.sh`
- The script calls the memory system API
- A new handoff is stored with session context

### SessionStart Hook (Already Configured)

When you start:
- Claude Code triggers the **SessionStart hook**
- The hook runs a wake-up command
- The agent loads the most recent handoff
- The agent remembers who it is and who you are

---

## Troubleshooting

### Hook not firing?

1. Check that `.claude/settings.json` is valid JSON
2. Verify the hook script is executable: `ls -la .claude/hooks/auto-handoff.sh`
3. Check the log: `tail .claude/hooks/auto-handoff.log`

### Handoff not being created?

1. Verify the memory system is running: `curl http://localhost:4000/health`
2. Check the API endpoint: `curl -X POST http://localhost:4000/api/v1/handoff -d '{"test":"data"}'`
3. Try running the script manually with test input

### Agent not waking up with memory?

1. Verify SessionStart hook is configured (separate from SessionEnd)
2. Check that the wake-up command is calling the memory API
3. Check recent handoffs: `curl http://localhost:4000/api/v1/handoffs`

---

## Files Summary

After setup, you should have:

```
.claude/
├── settings.json           # Hook configuration
└── hooks/
    ├── auto-handoff.sh     # SessionEnd hook script
    └── auto-handoff.log    # Debug log (auto-created)
```

**These files are in `.gitignore`** - they're local to your machine.

---

## Related Documentation

- [Auto Handoff Hook Details](./AUTO_HANDOFF_HOOK.md) - Technical deep dive
- [Identity Quick Ref](./IDENTITY_QUICK_REF.md) - How identity persists
- [Consolidation System](./CONSOLIDATION_SYSTEM.md) - Long-term memory synthesis
