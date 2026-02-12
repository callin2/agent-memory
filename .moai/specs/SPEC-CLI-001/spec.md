# SPEC-CLI-001: CLI Chat Agent

**SPEC ID:** SPEC-CLI-001
**Title:** CLI Chat Agent with Memory Integration
**Status:** Planned
**Priority:** High
**Created:** 2026-02-10
**Updated:** 2026-02-10
**Assigned:** Backend Team
**Lifecycle Level:** spec-first

---

## TAG BLOCK

**Tags:** cli, chat-agent, interactive, memory-integration, session-management
**Related SPECs:** SPEC-MEMORY-002
**Epic:** User Interface & Interaction

---

## Environment

### Current State
The Agent Memory System v2.0 currently provides:

- **RESTful API**: Comprehensive HTTP endpoints for events, chunks, ACB, capsules, decisions
- **Authentication**: JWT-based auth with tenant isolation
- **Memory Operations**: Full event recording, chunk retrieval, ACB building
- **No CLI Interface**: All interactions require HTTP client or API calls
- **No Interactive Mode**: Cannot chat with agents directly in terminal
- **No Session Persistence**: CLI sessions cannot be resumed

### Deployment Context
- **Development**: Local Node.js environment with PostgreSQL 15+
- **Production**: Server-side CLI tool for agent interaction
- **Scale**: Single-user sessions per CLI instance
- **Operational Context**: Development tool, debugging interface, quick interaction mode

### Problem Statement
The current memory system creates several constraints for CLI users:

1. **No Direct Terminal Access**: Must write HTTP client code or use curl/postman
2. **No Interactive Chat Loop**: Cannot maintain conversation flow in terminal
3. **No Context Awareness**: Each CLI call is independent, no session state
4. **No Quick Memory Search**: Cannot quickly query memory from terminal
5. **No Export Capability**: Cannot save conversation history to files
6. **No Session Management**: Cannot resume previous CLI sessions

---

## Assumptions

### Technical Assumptions
- **Confidence: HIGH** - Node.js readline API supports interactive prompts and history
- **Confidence: HIGH** - Existing API endpoints can be consumed via fetch/axios
- **Confidence: HIGH** - File system operations available for export and config
- **Confidence: HIGH** - JWT tokens can be stored in local config or environment
- **Confidence: MEDIUM** - Terminal color formatting works across platforms

### Business Assumptions
- **Confidence: HIGH** - Developers need quick terminal-based memory access
- **Confidence: HIGH** - Interactive chat improves development workflow
- **Confidence: MEDIUM** - Session persistence improves productivity
- **Confidence: HIGH** - Export functionality enables documentation and debugging

### Integration Assumptions
- **Confidence: HIGH** - API endpoints remain stable during CLI development
- **Confidence: HIGH** - JWT auth flow works for CLI authentication
- **Confidence: HIGH** - ACB API provides relevant context for chat sessions
- **Confidence: MEDIUM** - Future MCP integration may extend CLI capabilities

### Risk if Wrong
- **Terminal compatibility**: readline may behave differently on Windows vs Unix
- **API rate limiting**: CLI could trigger rate limits with frequent requests
- **Token expiry**: JWT refresh may interrupt long-running CLI sessions
- **Config complexity**: Too many config options may confuse users

---

## Requirements (EARS Format)

### Ubiquitous Requirements (System-Wide)

**WHEN** the CLI agent starts, the system **shall** validate API connectivity and authentication status.

**WHEN** any CLI command executes, the system **shall** enforce tenant_id isolation.

**WHEN** any error occurs, the system **shall** display clear error messages with recovery suggestions.

**WHEN** CLI exits, the system **shall** gracefully save session state and close connections.

**WHEN** user input is received, the system **shall** validate input format and length limits.

### Event-Driven Requirements (Trigger-Based)

**WHEN** user enters a message, the system **shall** record event and chunks via API.

**WHEN** user types /memory command, the system **shall** search memory chunks and display results.

**WHEN** user types /export command, the system **shall** generate export file in specified format.

**WHEN** user types /session new, the system **shall** create new session with unique session_id.

**WHEN** user types /session resume, the system **shall** load previous session state and context.

**WHEN** user types /help, the system **shall** display available commands and usage syntax.

**WHEN** user types /clear, the system **shall** clear terminal screen.

**WHEN** user types /exit, the system **shall** save session state and exit cleanly.

**WHEN** JWT token expires, the system **shall** prompt for re-authentication or refresh token.

**WHEN** API request fails, the system **shall** retry with exponential backoff up to 3 attempts.

### State-Driven Requirements (Conditional)

**IF** API endpoint not configured, **THEN** the system **shall** prompt for endpoint URL on startup.

**IF** JWT token not found, **THEN** the system **shall** prompt for credentials or API key.

**IF** session state file exists, **THEN** the system **shall** offer to resume previous session.

**IF** export format is json, **THEN** the system **shall** export structured JSON with all event data.

**IF** export format is markdown, **THEN** the system **shall** export human-readable conversation log.

**IF** memory search returns no results, **THEN** the system **shall** display helpful message with search tips.

**IF** message exceeds character limit, **THEN** the system **shall** truncate and warn user.

**IF** terminal width unknown, **THEN** the system **shall** assume default 80 columns for formatting.

### Unwanted Requirements (Prohibited Behaviors)

The system **shall not** store passwords or API keys in plain text configuration files.

The system **shall not** expose raw JWT tokens in error messages or logs.

The system **shall not** allow cross-tenant data access via CLI commands.

The system **shall not** modify memory without explicit user command or confirmation.

The system **shall not** hang indefinitely on network timeouts.

The system **shall not** lose unsaved conversation data on graceful exit.

### Optional Requirements (Nice-to-Have)

**WHERE** feasible, the system **should** support syntax highlighting for code blocks in responses.

**WHERE** feasible, the system **should** support auto-completion for commands and session IDs.

**WHERE** feasible, the system **should** display typing indicators for long-running operations.

**WHERE** feasible, the system **should** support multi-line input for complex queries.

**WHERE** feasible, the system **should** provide fuzzy search for memory chunks.

---

## Specifications

### Functional Specifications

#### 1. Chat Interface

**Purpose**: Interactive REPL-style chat loop with continuous conversation support.

**Terminal Interface**:

```
Agent Memory CLI v2.0.0
Connected: http://localhost:3000
Tenant: tenant_abc123
Session: sess_xyz789
Type /help for commands | /exit to quit

[You] hello, I need help with my project
[Agent] Recording event and building context...

[You] what did I work on yesterday?
[Agent] Searching memory...
Found 3 relevant chunks from yesterday:
- Discussed API authentication design
- Reviewed database migration 007
- Updated TypeScript types for user model

[You] /memory authentication
[Agent] Searching memory for "authentication"...
5 chunks found:
1. JWT token refresh implementation (importance: 0.9)
2. OAuth provider configuration (importance: 0.8)
...

[You] /export markdown
[Agent] Exporting session to: session_sess_xyz789_20260210.md
Export complete: 47 events, 12 chunks
```

**Core Features**:

- **Prompt Format**: `[User]` for user input, `[Agent]` for system responses
- **Message History**: Display last N messages (configurable, default 10)
- **Auto-Save**: Every user message recorded as event with chunks
- **Context Loading**: Fetch ACB on each message for relevant context
- **Error Display**: Clear error messages with suggestions

#### 2. Session Management

**Purpose**: Create, resume, and manage chat sessions with persistent state.

**Session State Storage**:

```typescript
interface SessionState {
  session_id: string;
  tenant_id: string;
  user_id: string;
  agent_id: string;
  created_at: Date;
  last_activity: Date;
  message_count: number;
  config: {
    api_endpoint: string;
    history_count: number;
    auto_save: boolean;
  };
}

// Stored in: ~/.agent-memory/sessions/{session_id}.json
```

**Session Commands**:

```bash
/session new              # Create new session
/session resume [id]      # Resume specific session
/session list             # List all sessions
/session status           # Show current session info
/session export           # Export current session
```

**Session Persistence**:

- Auto-save on each message
- Manual save with /save command
- Resume loads last 20 messages
- Export to JSON or Markdown

#### 3. Memory Operations

**Purpose**: Integrate with existing memory APIs for search and retrieval.

**Memory Search Command**:

```bash
/memory [query] [options]

Options:
  --scope <session|user|project|global>  # Filter by scope
  --subject <type> <id>                  # Filter by subject
  --limit <number>                       # Max results (default 10)
  --format <json|text>                   # Output format
```

**Examples**:

```bash
/memory authentication                          # Simple search
/memory "database migration" --limit 5          # Limited results
/memory "API design" --scope project --format json  # Scoped + JSON
/memory --subject user jack-user-id             # Subject filter
```

**Memory Edit Commands** (future extension):

```bash
/memory/edit retract <chunk_id>    # Retract chunk
/memory/edit amend <chunk_id>      # Amend chunk text
/memory/edit quarantine <chunk_id> # Quarantine from auto-retrieval
```

#### 4. User Commands Reference

**Command Registry**:

| Command | Aliases | Description | Arguments |
|---------|---------|-------------|------------|
| /help | /? | Show command help | [command] |
| /clear | cls | Clear terminal screen | - |
| /exit | quit, exit | Save and exit | - |
| /memory | /mem, /m | Search memory | [query] [options] |
| /export | /exp | Export session | [format] |
| /session | /sess | Session management | [action] [args] |
| /config | /cfg | Configure settings | [key] [value] |
| /status | /stat | Show system status | - |
| /save | - | Force save session | - |

**Command Help System**:

```bash
/help                    # Show all commands
/help memory             # Show memory command help
/help export             # Show export command help
```

#### 5. Context Awareness

**Purpose**: Maintain conversation context and retrieve relevant memory automatically.

**ACB Integration**:

On each user message, CLI agent:

1. **Build ACB**: Call `/api/v1/acb/build` with current session context
2. **Include Context**: Pass relevant chunks/chats to AI model (if integrated)
3. **Display Summaries**: Show relevant context from previous sessions

**ACB Request**:

```typescript
const acbRequest = {
  session_id: currentSession.session_id,
  agent_id: 'cli-agent',
  channel: 'private',
  intent: detectIntent(userMessage),
  query_text: userMessage,
  max_tokens: 8000,
};
```

**Context Display**:

```
[Agent] Context loaded:
- Last session: 2026-02-09 "Database schema design"
- Related chunks: 5 (authentication, migrations, types)
- Active decisions: 2 (PostgreSQL 15+, TypeScript 5.3+)

[You] continue from where we left off
```

#### 6. Configuration Management

**Purpose**: Manage API endpoints, auth tokens, and user preferences.

**Config File**: `~/.agent-memory/config.json`

```json
{
  "api_endpoint": "http://localhost:3000",
  "tenant_id": "tenant_abc123",
  "auth": {
    "jwt_token": "${AGENT_MEMORY_TOKEN}",
    "api_key": "${AGENT_MEMORY_API_KEY}"
  },
  "session": {
    "history_count": 10,
    "auto_save": true,
    "resume_last": false
  },
  "display": {
    "color_output": true,
    "timestamps": true,
    "show_agent": true
  },
  "export": {
    "default_format": "markdown",
    "output_dir": "./exports"
  }
}
```

**Config Priority** (highest to lowest):

1. Command-line flags
2. Environment variables
3. Config file
4. Interactive prompts
5. Default values

**Environment Variables**:

```bash
AGENT_MEMORY_ENDPOINT="http://localhost:3000"
AGENT_MEMORY_TOKEN="eyJhbGciOiJIUzI1NiIs..."
AGENT_MEMORY_API_KEY="ak_live_abc123..."
AGENT_MEMORY_TENANT="tenant_abc123"
```

#### 7. Export Functionality

**Purpose**: Export conversation history for documentation and debugging.

**Export Formats**:

**Markdown Export**:

```markdown
# Agent Memory Session: sess_xyz789

**Date**: 2026-02-10 14:30:00
**Tenant**: tenant_abc123
**User**: user_123
**Message Count**: 47

## Conversation

### [14:30:15] User
hello, I need help with my project

### [14:30:16] Agent
Event recorded: evt_abc123
Chunks created: 2

### [14:30:45] User
what did I work on yesterday?

### [14:30:46] Agent
Found 3 relevant chunks:
- Discussed API authentication design
- Reviewed database migration 007
...

## Summary
- Events: 47
- Chunks: 89
- Decisions referenced: 2
```

**JSON Export**:

```json
{
  "session_id": "sess_xyz789",
  "tenant_id": "tenant_abc123",
  "created_at": "2026-02-10T14:30:00Z",
  "exported_at": "2026-02-10T15:45:00Z",
  "messages": [
    {
      "timestamp": "2026-02-10T14:30:15Z",
      "role": "user",
      "content": "hello, I need help with my project"
    },
    {
      "timestamp": "2026-02-10T14:30:16Z",
      "role": "agent",
      "content": "Event recorded: evt_abc123",
      "event_id": "evt_abc123",
      "chunks_created": 2
    }
  ],
  "stats": {
    "events": 47,
    "chunks": 89,
    "decisions_referenced": 2
  }
}
```

### Non-Functional Specifications

#### Performance

- **Startup time**: ≤ 1 second to ready state
- **Command response**: ≤ 2 seconds for local API
- **Memory search**: ≤ 3 seconds for top 10 results
- **Export generation**: ≤ 1 second for 100 messages
- **Session resume**: ≤ 2 seconds to load last session

#### Usability

- **Command discovery**: /help shows all available commands
- **Error recovery**: Clear error messages with actionable suggestions
- **Progress feedback**: Indicators for long-running operations
- **History navigation**: Up/down arrow for message history
- **Tab completion**: Auto-complete commands and file paths

#### Reliability

- **Graceful degradation**: Continue with partial functionality if API unavailable
- **State persistence**: Auto-save prevents data loss on crash
- **Network resilience**: Retry with exponential backoff
- **Token refresh**: Automatic JWT refresh before expiry

#### Security

- **Credential storage**: Never store passwords in plain text
- **Token protection**: JWT tokens stored with restricted permissions
- **Tenant isolation**: All operations respect tenant_id
- **Input validation**: Sanitize all user inputs before API calls
- **Audit logging**: Log all CLI operations for debugging

#### Maintainability

- **Modular architecture**: Separate command handlers, API client, UI layer
- **Clear error handling**: Specific error types with recovery strategies
- **Configuration validation**: Validate config on load
- **Comprehensive logging**: Structured logs for debugging

---

## Data Architecture

### CLI Configuration Schema

```typescript
interface CLIConfig {
  api_endpoint: string;
  tenant_id?: string;
  auth: {
    jwt_token?: string;
    api_key?: string;
    username?: string;
    password?: string; // Only in memory, never stored
  };
  session: {
    history_count: number;
    auto_save: boolean;
    resume_last: boolean;
    session_dir: string;
  };
  display: {
    color_output: boolean;
    timestamps: boolean;
    show_agent: boolean;
    prompt_format: string; // "[User] ", "> ", etc.
  };
  export: {
    default_format: 'json' | 'markdown';
    output_dir: string;
  };
  api: {
    timeout_ms: number;
    retry_attempts: number;
    retry_delay_ms: number;
  };
}
```

### Session State Schema

```typescript
interface CLISession {
  session_id: string;
  tenant_id: string;
  user_id: string;
  agent_id: string;
  created_at: Date;
  last_activity: Date;
  message_count: number;
  messages: CLIMessage[];
  state: 'active' | 'paused' | 'closed';
}

interface CLIMessage {
  id: string;
  timestamp: Date;
  role: 'user' | 'agent' | 'system';
  content: string;
  event_id?: string;
  chunks_created?: number;
  metadata?: Record<string, unknown>;
}
```

### API Integration Points

**Authentication**:

```bash
POST /auth/login
POST /auth/token/refresh
POST /auth/validate
```

**Memory Operations**:

```bash
POST /api/v1/events          # Record user message
GET  /api/v1/events           # Query session history
POST /api/v1/acb/build        # Get context bundle
POST /api/v1/chunks/search    # Search memory (if implemented)
```

**Session Management**:

```bash
GET /api/v1/events?session_id={id}  # Get session history
GET /auth/sessions                   # List active sessions
```

---

## Traceability

**TAG**: SPEC-CLI-001

**Requirements Traceability**:
- Chat Interface → Acceptance Criteria A1-A5
- Session Management → Acceptance Criteria A6-A10
- Memory Operations → Acceptance Criteria A11-A15
- User Commands → Acceptance Criteria A16-A20
- Context Awareness → Acceptance Criteria A21-A25
- Configuration Management → Acceptance Criteria A26-A30
- Export Functionality → Acceptance Criteria A31-A35

**Implementation Traceability**:
- Phase 1 (Core CLI framework) → Plan.md Milestone M1
- Phase 2 (Chat interface) → Plan.md Milestone M2
- Phase 3 (Memory integration) → Plan.md Milestone M3
- Phase 4 (Session management) → Plan.md Milestone M4
- Phase 5 (Export and config) → Plan.md Milestone M5
- Phase 6 (Testing) → Plan.md Milestone M6

**Test Coverage**:
- All EARS requirements mapped to acceptance test scenarios
- Performance requirements validated via timing tests
- Security requirements validated via auth tests
- Integration requirements validated via API tests

---

## Success Criteria

The CLI Chat Agent is considered successful when:

1. User can start CLI with valid authentication
2. Interactive chat loop accepts and records user messages
3. Memory search returns relevant chunks from user's tenant
4. Sessions can be created, listed, resumed, and exported
5. Export generates valid JSON and Markdown files
6. Configuration is loaded from file, environment, and prompts
7. All commands listed in /help are functional
8. Errors display clear messages with recovery suggestions
9. Session state persists between runs
10. Context is retrieved via ACB for each message
11. Exit saves session state cleanly
12. Performance targets met for all operations
13. All acceptance criteria satisfied

---

**Document Owner**: Backend Team
**Review Cycle**: Weekly during implementation phase
**Next Review**: After Phase 2 completion (Chat interface)
