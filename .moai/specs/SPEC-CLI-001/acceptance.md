# Acceptance Criteria: SPEC-CLI-001

**SPEC ID**: SPEC-CLI-001
**Title**: CLI Chat Agent with Memory Integration
**Status**: Planned
**Priority**: High

---

## TAG BLOCK

**Tags**: acceptance-criteria, test-scenarios, gherkin
**Related SPECs**: SPEC-CLI-001
**Traceability**: SPEC-CLI-001/spec.md, SPEC-CLI-001/plan.md

---

## Test Scenarios (Given-When-Then Format)

### A1: CLI Startup and Authentication

**Scenario**: User starts CLI with valid credentials

```
GIVEN the API server is running at http://localhost:3000
  AND the user has valid credentials
  AND the config file contains api_endpoint
WHEN the user runs `cli` command
THEN the CLI starts successfully
  AND displays welcome message with session info
  AND shows connection status as "connected"
  AND prompts for input with "[User] " prefix
```

**Scenario**: User starts CLI without config

```
GIVEN no config file exists
  AND API server is running at default localhost:3000
WHEN the user runs `cli` command
THEN the CLI prompts for API endpoint
  AND prompts for credentials (username/password or API key)
  AND creates config file at ~/.agent-memory/config.json
  AND proceeds to chat interface
```

**Scenario**: API server is unavailable

```
GIVEN the API server is not running
  AND config file points to http://localhost:3000
WHEN the user runs `cli` command
THEN the CLI displays error message
  AND shows possible fixes (start server, check endpoint)
  AND exits with non-zero status code
```

---

### A2: Interactive Chat Loop

**Scenario**: User sends message in chat

```
GIVEN the CLI is running and authenticated
  AND the user is at the chat prompt
WHEN the user types "hello, I need help with my project"
THEN the message is recorded as an event via POST /api/v1/events
  AND the CLI displays confirmation with event_id
  AND the CLI displays chunks_created count
  AND the CLI returns to prompt for next input
```

**Scenario**: User views message history

```
GIVEN the CLI has recorded 5 messages in current session
  AND history_count is set to 10
WHEN the user sends any message
THEN the CLI displays last 5 messages above current prompt
  AND each message shows timestamp and role
  AND the format is "[HH:MM:SS] User/Agent: message"
```

**Scenario**: Message exceeds character limit

```
GIVEN the CLI is running
  AND message limit is 10,000 characters
WHEN the user types a message of 12,000 characters
THEN the CLI truncates the message to 10,000 characters
  AND displays warning: "Message truncated to 10,000 characters"
  AND records the truncated message
```

---

### A3: Memory Search Command

**Scenario**: User searches memory with simple query

```
GIVEN the CLI is running and authenticated
  AND the tenant has 50 chunks in memory
WHEN the user types "/memory authentication"
THEN the CLI searches memory via API
  AND displays results with chunk count
  AND shows top 10 chunks with importance scores
  AND formats output as:
    "1. [importance: 0.9] JWT token refresh implementation"
    "2. [importance: 0.8] OAuth provider configuration"
```

**Scenario**: User searches with filters

```
GIVEN the CLI is running
  AND the tenant has chunks across multiple scopes
WHEN the user types "/memory 'API design' --scope project --limit 5"
THEN the CLI filters by scope=project
  AND limits results to 5 chunks
  AND displays only project-scoped chunks
```

**Scenario**: Memory search returns no results

```
GIVEN the CLI is running
  AND the tenant has no chunks matching query
WHEN the user types "/memory quantum computing"
THEN the CLI displays "No results found"
  AND shows search tips: "Try broader query, check spelling, use different keywords"
```

**Scenario**: User searches with subject filter

```
GIVEN the CLI is running
  AND the tenant has chunks for subject "jack-user-id"
WHEN the user types "/memory --subject user jack-user-id"
THEN the CLI filters by subject_type=user and subject_id=jack-user-id
  AND displays only chunks about that subject
```

---

### A4: Session Management

**Scenario**: User creates new session

```
GIVEN the CLI is running
  AND current session is "sess_abc123"
WHEN the user types "/session new"
THEN the CLI generates new session_id "sess_xyz789"
  AND saves session state to ~/.agent-memory/sessions/sess_xyz789.json
  AND displays "Created new session: sess_xyz789"
  AND switches to new session context
```

**Scenario**: User lists all sessions

```
GIVEN the user has 3 previous sessions
  AND session files exist in ~/.agent-memory/sessions/
WHEN the user types "/session list"
THEN the CLI displays table with columns:
    "Session ID | Created | Messages | Status"
  AND shows all 3 sessions with metadata
  AND sorts by creation date (newest first)
```

**Scenario**: User resumes previous session

```
GIVEN the user has previous session "sess_old456"
  AND session file exists with 20 messages
WHEN the user types "/session resume sess_old456"
THEN the CLI loads session state from file
  AND displays last 10 messages from session
  AND sets session_id to "sess_old456"
  AND shows "Resumed session: sess_old456 (20 messages)"
```

**Scenario**: User views session status

```
GIVEN the CLI is running
  AND current session has 15 messages
WHEN the user types "/session status"
THEN the CLI displays:
    "Session ID: sess_xyz789"
    "Tenant: tenant_abc123"
    "Created: 2026-02-10 14:30:00"
    "Messages: 15"
    "Status: active"
```

---

### A5: Export Functionality

**Scenario**: User exports session to JSON

```
GIVEN the CLI is running
  AND current session has 10 messages
WHEN the user types "/export json"
THEN the CLI generates file: session_sess_xyz789_20260210.json
  AND file contains valid JSON with all messages
  AND file includes metadata: session_id, tenant_id, message_count
  AND displays "Exported to: session_sess_xyz789_20260210.json"
```

**Scenario**: User exports session to Markdown

```
GIVEN the CLI is running
  AND current session has 10 messages
WHEN the user types "/export markdown"
THEN the CLI generates file: session_sess_xyz789_20260210.md
  AND file contains formatted Markdown with headers
  AND messages formatted as "### [HH:MM:SS] User/Agent"
  AND displays summary at end: events, chunks, decisions
```

**Scenario**: User exports to custom directory

```
GIVEN the CLI is running
  AND export directory is configured as "./exports"
WHEN the user types "/export json"
THEN the CLI creates ./exports directory if not exists
  AND saves file to ./exports/session_sess_xyz789_20260210.json
  AND displays full file path
```

---

### A6: Help and Information Commands

**Scenario**: User views general help

```
GIVEN the CLI is running
WHEN the user types "/help"
THEN the CLI displays all commands with descriptions:
    "/help [command]    - Show command help"
    "/clear             - Clear terminal screen"
    "/exit              - Save and exit"
    "/memory [query]    - Search memory"
    "/export [format]   - Export session"
    "/session [action]  - Session management"
```

**Scenario**: User views specific command help

```
GIVEN the CLI is running
WHEN the user types "/help memory"
THEN the CLI displays detailed help for /memory command:
    "Description: Search memory chunks"
    "Usage: /memory [query] [options]"
    "Options:"
    "  --scope <session|user|project|global>"
    "  --subject <type> <id>"
    "  --limit <number>"
    "  --format <json|text>"
    "Examples:"
    "  /memory authentication"
    "  /memory 'API design' --scope project"
```

**Scenario**: User views system status

```
GIVEN the CLI is running
  AND API is connected
  AND current session is active
WHEN the user types "/status"
THEN the CLI displays:
    "API Status: connected (http://localhost:3000)"
    "Tenant: tenant_abc123"
    "Session: sess_xyz789 (15 messages)"
    "Auth: JWT token valid (expires in 55 minutes)"
```

---

### A7: Configuration Management

**Scenario**: User views current config

```
GIVEN the CLI is running
  AND config file exists at ~/.agent-memory/config.json
WHEN the user types "/config"
THEN the CLI displays current config:
    "api_endpoint: http://localhost:3000"
    "tenant_id: tenant_abc123"
    "session.history_count: 10"
    "session.auto_save: true"
    "display.color_output: true"
```

**Scenario**: User edits config via command

```
GIVEN the CLI is running
WHEN the user types "/config --edit"
THEN the CLI opens config file in default editor
  AND waits for editor to close
  AND reloads config on editor exit
  AND displays "Config reloaded"
```

**Scenario**: User sets config value via command

```
GIVEN the CLI is running
  AND history_count is currently 10
WHEN the user types "/config session.history_count 20"
THEN the CLI updates config file
  AND validates the new value
  AND displays "Set session.history_count = 20"
  AND applies change immediately
```

**Scenario**: Config validation fails

```
GIVEN the CLI is running
WHEN the user types "/config session.history_count 200"
THEN the CLI displays validation error:
    "Invalid value: 200 (must be between 1 and 100)"
  AND does not update config
  AND keeps current value
```

---

### A8: Error Handling and Recovery

**Scenario**: Network timeout during API call

```
GIVEN the CLI is running
  AND API server responds slowly
WHEN the user types a message
AND the API call times out
THEN the CLI displays "Timeout: API request took too long"
  AND shows "Retrying... (1/3)"
  AND retries with exponential backoff
  AND succeeds on retry or displays error after 3 attempts
```

**Scenario**: JWT token expires during session

```
GIVEN the CLI is running
  AND JWT token expires in 1 minute
WHEN the user types a message
AND the API returns 401 Unauthorized
THEN the CLI displays "Session expired"
  AND prompts for credentials or API key
  AND refreshes JWT token
  AND retries the original request automatically
```

**Scenario**: Invalid command entered

```
GIVEN the CLI is running
WHEN the user types "/unknown-command"
THEN the CLI displays "Unknown command: /unknown-command"
  AND shows "Type /help for available commands"
  AND returns to prompt
```

**Scenario**: API returns 500 error

```
GIVEN the CLI is running
WHEN the user types a message
AND the API returns 500 Internal Server Error
THEN the CLI displays "API Error: Internal server error"
  AND shows "The server encountered an error"
  AND suggests "Try again later or contact support"
  AND does not exit
```

---

### A9: Context Awareness (ACB Integration)

**Scenario**: Context displayed on message

```
GIVEN the CLI is running
  AND user has previous sessions with relevant context
WHEN the user types "continue from where we left off"
THEN the CLI builds ACB via POST /api/v1/acb/build
  AND displays context summary:
    "[Agent] Context loaded:"
    "- Last session: 2026-02-09 'Database schema design'"
    "- Related chunks: 5 (authentication, migrations, types)"
    "- Active decisions: 2 (PostgreSQL 15+, TypeScript 5.3+)"
```

**Scenario**: Context with no relevant memory

```
GIVEN the CLI is running
  AND user has no previous sessions
WHEN the user types a message
THEN the CLI builds ACB
  AND displays "No previous context found"
  AND continues with empty context
```

---

### A10: Session Persistence

**Scenario**: Session auto-saves on each message

```
GIVEN the CLI is running
  AND auto_save is true
  AND session has 5 messages
WHEN the user types a 6th message
THEN the CLI records the event via API
  AND updates session state file with new message
  AND increments message_count to 6
  AND updates last_activity timestamp
```

**Scenario**: Session resumes after restart

```
GIVEN the CLI was running with session "sess_xyz789"
  AND session had 10 messages
  AND user exited CLI with /exit
WHEN the user starts CLI again
  AND session file exists
THEN the CLI offers to resume session
  AND user accepts resume
  AND CLI loads last 10 messages
  AND displays "Resumed session: sess_xyz789 (10 messages)"
```

**Scenario**: Session file corrupted

```
GIVEN the CLI is starting
  AND session file exists but is corrupted
WHEN the CLI attempts to load session
THEN the CLI displays "Session file corrupted"
  AND shows "Creating new session"
  AND creates new session with new ID
  AND does not crash
```

---

### A11: Terminal Display

**Scenario**: Colored output enabled

```
GIVEN the CLI is running
  AND color_output is true
  AND terminal supports colors
WHEN the user types /help
THEN the CLI displays commands with colors:
    - Command names in cyan
    - Descriptions in white
    - Examples in gray
```

**Scenario**: Colored output disabled

```
GIVEN the CLI is running
  AND color_output is false
WHEN the user types /help
THEN the CLI displays commands in plain text
  AND no ANSI color codes in output
```

**Scenario**: Terminal clears on command

```
GIVEN the CLI is running
  AND terminal has 50 lines of output
WHEN the user types /clear
THEN the CLI clears all output
  AND shows only welcome message and prompt
  AND terminal is clean
```

---

### A12: Exit and Cleanup

**Scenario**: User exits with /exit command

```
GIVEN the CLI is running
  AND current session has 10 messages
WHEN the user types /exit
THEN the CLI saves session state to file
  AND closes all connections
  AND displays "Goodbye!"
  AND exits with status code 0
```

**Scenario**: User exits with Ctrl+C

```
GIVEN the CLI is running
  AND current session has 10 messages
WHEN the user presses Ctrl+C
THEN the CLI catches interrupt signal
  AND saves session state to file
  AND displays "Session saved. Goodbye!"
  AND exits gracefully
```

**Scenario**: Session not saved on crash

```
GIVEN the CLI is running
  AND auto_save is false
  AND user has not saved manually
WHEN the CLI crashes (simulate with SIGKILL)
THEN the CLI may not save session state
  AND displays warning on next start:
    "Previous session may not have been saved"
  AND offers recovery options
```

---

### A13: Performance Requirements

**Scenario**: Startup time within limit

```
GIVEN the API server is running
  AND config file exists
WHEN the user runs `cli` command
THEN the CLI starts within 1 second
  AND displays prompt ready for input
```

**Scenario**: Command response within limit

```
GIVEN the CLI is running
  AND API is responsive
WHEN the user types "/memory test"
THEN the CLI displays results within 3 seconds
  AND shows search results
```

**Scenario**: Export generation within limit

```
GIVEN the CLI is running
  AND current session has 100 messages
WHEN the user types "/export json"
THEN the CLI generates file within 1 second
  AND displays export confirmation
```

---

### A14: Security Requirements

**Scenario**: Password not stored in config

```
GIVEN the user authenticates with username/password
WHEN the CLI saves config
THEN the config file contains JWT token
  AND does NOT contain password in plain text
  AND token is stored with restricted file permissions (600)
```

**Scenario**: Tenant isolation enforced

```
GIVEN the CLI is authenticated with tenant A
  AND tenant B has different data
WHEN the user runs "/memory test"
THEN the CLI searches only tenant A's data
  AND does NOT return chunks from tenant B
```

**Scenario**: Token not exposed in logs

```
GIVEN the CLI is running with debug logging enabled
WHEN the CLI makes API request with JWT token
THEN the logs show "Authorization: Bearer [REDACTED]"
  AND do NOT show actual token value
```

---

### A15: Integration Requirements

**Scenario**: API endpoints available

```
GIVEN the API server is running
WHEN the CLI queries /health endpoint
THEN the API returns 200 OK
  AND CLI displays "API Status: connected"
```

**Scenario**: ACB endpoint functional

```
GIVEN the CLI is running
  AND user sends a message
WHEN the CLI calls POST /api/v1/acb/build
THEN the API returns valid ACB with chunks and decisions
  AND CLI displays context summary
```

**Scenario**: Event recording functional

```
GIVEN the CLI is running
  AND user sends a message
WHEN the CLI calls POST /api/v1/events
THEN the API returns 201 Created
  AND response includes event_id
  AND CLI displays confirmation
```

---

## Quality Gates

### Functional Completeness

- [ ] All commands in /help are functional
- [ ] All command options work as documented
- [ ] All error scenarios handled gracefully
- [ ] All export formats generate valid output

### Performance Standards

- [ ] Startup time ≤ 1 second
- [ ] Command response time ≤ 3 seconds
- [ ] Export generation ≤ 1 second (100 messages)
- [ ] Memory search ≤ 3 seconds (top 10 results)

### Security Compliance

- [ ] No passwords stored in plain text
- [ ] JWT tokens stored with restricted permissions
- [ ] Tenant isolation enforced in all operations
- [ ] Tokens not exposed in logs or errors

### User Experience

- [ ] Error messages include actionable suggestions
- [ ] Help documentation is complete and clear
- [ ] Terminal output is readable and formatted
- [ ] Auto-save prevents data loss

### Integration Testing

- [ ] All API endpoints called successfully
- [ ] Auth flow works end-to-end
- [ ] Session persistence works across restarts
- [ ] Export files are valid and readable

---

## Definition of Done

A feature is considered **done** when:

1. All acceptance criteria scenarios pass
2. Unit tests written and passing (≥ 80% coverage)
3. Integration tests written and passing
4. Documentation updated (CLI usage guide)
5. Performance requirements met
6. Security requirements verified
7. Code reviewed and approved
8. No critical or high-priority bugs

---

**Document Owner**: Backend Team
**Last Updated**: 2026-02-10
**Status**: Ready for Implementation
