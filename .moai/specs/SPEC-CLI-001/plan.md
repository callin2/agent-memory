# Implementation Plan: SPEC-CLI-001

**SPEC ID**: SPEC-CLI-001
**Title**: CLI Chat Agent with Memory Integration
**Status**: Planned
**Priority**: High

---

## TAG BLOCK

**Tags**: cli, chat-agent, implementation-plan, milestones
**Related SPECs**: SPEC-CLI-001, SPEC-MEMORY-002
**Traceability**: SPEC-CLI-001/spec.md

---

## Milestones

### Milestone M1: Core CLI Framework (Priority: High)

**Description**: Establish project structure, dependencies, and basic CLI entry point.

**Deliverables**:

1. **Project Setup**
   - Create `src/cli/` directory structure
   - Install dependencies: `commander`, `inquirer`, `chalk`, `ora`
   - Configure TypeScript for CLI target

2. **Entry Point**
   - `src/cli/index.ts` - Main CLI entry point with argument parsing
   - `src/cli/commands.ts` - Command registry and dispatcher
   - Package.json scripts: `cli`, `cli:dev`

3. **Configuration System**
   - `src/cli/config.ts` - Config loading and validation
   - Config file: `~/.agent-memory/config.json`
   - Environment variable support

4. **API Client**
   - `src/cli/api-client.ts` - HTTP client with auth handling
   - JWT token management (load, refresh, validate)
   - Retry logic with exponential backoff

**Success Criteria**:

- [ ] CLI entry point executes without errors
- [ ] Config loads from file and environment variables
- [ ] API client successfully authenticates with JWT
- [ ] Health check command (`cli status`) connects to API

**Dependencies**: None

**Estimated Effort**: Primary Goal

---

### Milestone M2: Interactive Chat Interface (Priority: High)

**Description**: Implement REPL-style chat loop with message recording.

**Deliverables**:

1. **REPL Loop**
   - `src/cli/repl.ts` - Read-Eval-Print Loop implementation
   - Message history with up/down arrow navigation
   - Auto-save on each message

2. **Message Recording**
   - Integration with `/api/v1/events` endpoint
   - Auto-generate chunks from user messages
   - Display confirmation with event_id and chunk count

3. **Terminal UI**
   - Colored output with chalk
   - Prompt format: `[User]` for input, `[Agent]` for responses
   - Message history display (last N messages)

4. **Basic Commands**
   - `/help` - Display command list
   - `/clear` - Clear terminal screen
   - `/exit` - Save and exit cleanly
   - `/status` - Show connection status

**Success Criteria**:

- [ ] Chat loop accepts and displays messages
- [ ] User messages recorded as events via API
- [ ] Message history displays last N messages
- [ ] `/help`, `/clear`, `/exit`, `/status` commands work
- [ ] Terminal colors render correctly

**Dependencies**: M1 completed

**Estimated Effort**: Primary Goal

---

### Milestone M3: Memory Integration (Priority: High)

**Description**: Integrate memory search and ACB building for context awareness.

**Deliverables**:

1. **Memory Search**
   - `/memory [query]` command implementation
   - Integration with memory search API or full-text query
   - Result formatting with chunk previews
   - Filters: scope, subject, limit

2. **Context Building**
   - ACB integration via `/api/v1/acb/build`
   - Display relevant context on each message
   - Intent detection for better context retrieval

3. **Enhanced Commands**
   - `/memory` with options: `--scope`, `--subject`, `--limit`, `--format`
   - `/session list` - List recent sessions
   - `/session new` - Create new session with unique ID

**Success Criteria**:

- [ ] `/memory` command returns relevant chunks
- [ ] Search results display with chunk text and metadata
- [ ] ACB context displayed before AI response
- [ ] `/memory` options work correctly

**Dependencies**: M2 completed

**Estimated Effort**: Primary Goal

---

### Milestone M4: Session Management (Priority: Medium)

**Description**: Implement session creation, resume, and state persistence.

**Deliverables**:

1. **Session Storage**
   - Session state file: `~/.agent-memory/sessions/{session_id}.json`
   - Auto-save on each message
   - Session metadata: created_at, last_activity, message_count

2. **Session Commands**
   - `/session new` - Create new session
   - `/session resume [id]` - Resume specific session
   - `/session list` - List all sessions
   - `/session status` - Show current session info

3. **Session Resume**
   - Load last 20 messages from session state
   - Restore session_id and tenant_id
   - Query API for session history

**Success Criteria**:

- [ ] Sessions saved to file system
- [ ] `/session new` creates new session with unique ID
- [ ] `/session resume` loads previous session context
- [ ] `/session list` displays all sessions
- [ ] Session state persists across CLI restarts

**Dependencies**: M3 completed

**Estimated Effort**: Secondary Goal

---

### Milestone M5: Export and Configuration (Priority: Medium)

**Description**: Implement export functionality and advanced configuration.

**Deliverables**:

1. **Export Commands**
   - `/export [format]` - Export current session
   - JSON export with full event data
   - Markdown export with formatted conversation log

2. **Advanced Configuration**
   - Config validation on load
   - `/config` command to view and edit settings
   - Config file migration between versions

3. **Display Options**
   - Toggle timestamps, colors, agent messages
   - Configurable history count
   - Custom prompt formats

**Success Criteria**:

- [ ] `/export json` generates valid JSON file
- [ ] `/export markdown` generates readable Markdown file
- [ ] `/config` command displays and edits settings
- [ ] Display options respected in terminal output

**Dependencies**: M4 completed

**Estimated Effort**: Secondary Goal

---

### Milestone M6: Testing and Polish (Priority: Medium)

**Description**: Comprehensive testing, documentation, and performance optimization.

**Deliverables**:

1. **Unit Tests**
   - Config loading and validation
   - API client with retry logic
   - Command parsing and execution
   - Session persistence

2. **Integration Tests**
   - End-to-end CLI workflows
   - API integration with mock server
   - Session management scenarios

3. **Documentation**
   - CLI usage guide (`docs/CLI.md`)
   - Command reference with examples
   - Setup and installation instructions

4. **Performance Optimization**
   - Measure startup time and command response
   - Optimize ACB fetching and caching
   - Reduce unnecessary API calls

**Success Criteria**:

- [ ] Unit test coverage ≥ 80%
- [ ] All integration test scenarios pass
- [ ] Documentation complete with examples
- [ ] Performance targets met (startup ≤ 1s, commands ≤ 2s)

**Dependencies**: M5 completed

**Estimated Effort**: Final Goal

---

## Technical Approach

### Architecture Overview

```
src/cli/
├── index.ts              # Entry point, argument parsing
├── commands/
│   ├── index.ts          # Command registry
│   ├── chat.ts           # Chat REPL loop
│   ├── memory.ts         # Memory search command
│   ├── session.ts        # Session management
│   ├── export.ts         # Export functionality
│   └── config.ts         # Configuration commands
├── api-client.ts         # HTTP client with auth
├── config.ts             # Config loading and validation
├── session.ts            # Session state management
├── ui/
│   ├── prompts.ts        # Inquirer prompts
│   ├── formatting.ts     # Terminal formatting
│   └── tables.ts         # Table display utilities
└── utils/
    ├── logger.ts         # Structured logging
    └── retry.ts          # Retry logic with backoff
```

### Technology Stack

**Core Dependencies**:

- `commander` ^12.0 - CLI argument parsing
- `inquirer` ^9.2 - Interactive prompts
- `chalk` ^5.3 - Terminal colors
- `ora` ^8.0 - Spinner for long operations
- `axios` ^1.6 - HTTP client (existing dependency)
- `zod` ^3.22 - Schema validation (optional)

**Dev Dependencies**:

- `@types/inquirer` - TypeScript types for inquirer

### API Integration

**Authentication Flow**:

```
1. CLI starts → Load config
2. Check JWT token in config or env var
3. If no token → Prompt for credentials
4. Call POST /auth/login → Store JWT
5. On each API call → Attach Authorization header
6. On 401 → Refresh token or prompt for re-auth
```

**Memory Recording Flow**:

```
1. User enters message in chat
2. Extract session_id, tenant_id from state
3. Build event payload:
   - session_id: current session
   - kind: "message"
   - actor_type: "human"
   - actor_id: user_id
   - channel: "private"
   - content.text: user message
4. Call POST /api/v1/events
5. Receive event_id confirmation
6. Display confirmation to user
```

**Context Building Flow**:

```
1. User enters message
2. Detect intent from message text
3. Build ACB request:
   - session_id: current session
   - agent_id: "cli-agent"
   - channel: "private"
   - intent: detected intent
   - query_text: user message
   - max_tokens: 8000
4. Call POST /api/v1/acb/build
5. Display context summary:
   - Related chunks count
   - Active decisions
   - Recent sessions
```

### Configuration Strategy

**Config Hierarchy** (highest to lowest priority):

1. **Command-line flags**: `cli --endpoint http://localhost:3000`
2. **Environment variables**: `AGENT_MEMORY_ENDPOINT`
3. **Config file**: `~/.agent-memory/config.json`
4. **Interactive prompts**: User input during setup
5. **Default values**: Fallback in code

**Config Validation**:

```typescript
import { z } from 'zod';

const CLIConfigSchema = z.object({
  api_endpoint: z.string().url(),
  tenant_id: z.string().optional(),
  auth: z.object({
    jwt_token: z.string().optional(),
    api_key: z.string().optional(),
  }),
  session: z.object({
    history_count: z.number().min(1).max(100).default(10),
    auto_save: z.boolean().default(true),
    resume_last: z.boolean().default(false),
  }),
  display: z.object({
    color_output: z.boolean().default(true),
    timestamps: z.boolean().default(true),
  }),
});
```

### Error Handling Strategy

**Error Categories**:

1. **Network Errors**: Retry with exponential backoff
2. **Auth Errors**: Prompt for re-authentication
3. **Validation Errors**: Display clear message with fix
4. **API Errors**: Show error code and message
5. **File System Errors**: Show path and permission fix

**Error Display Format**:

```
[Error] Failed to connect to API

  Endpoint: http://localhost:3000
  Status: Connection refused

  Possible fixes:
  1. Check if API server is running: npm run dev
  2. Verify endpoint in config: cli config --edit
  3. Test connectivity: cli status --verbose

  Retrying... (1/3)
```

### Testing Strategy

**Unit Tests** (`tests/unit/cli/`):

- Config loading and validation
- API client methods (auth, events, ACB)
- Command parsing and execution
- Session state persistence

**Integration Tests** (`tests/integration/cli/`):

- Complete chat workflow
- Session management scenarios
- Export functionality
- Configuration scenarios

**E2E Tests** (`tests/scenarios/cli/`):

- User journey: Start CLI → Chat → Export → Exit
- Memory search: Search chunks → View results → Export
- Session resume: Create session → Exit → Resume → Verify state

---

## Risks and Mitigation

### Risk 1: API Rate Limiting

**Description**: CLI may trigger rate limits with frequent API calls.

**Impact**: Medium - Could interrupt user workflow

**Mitigation**:

- Implement exponential backoff (100ms → 200ms → 400ms → 800ms)
- Cache ACB results for 60 seconds
- Batch operations where possible

### Risk 2: JWT Token Expiry

**Description**: Long-running CLI sessions may exceed JWT token lifetime.

**Impact**: High - Forces re-authentication mid-session

**Mitigation**:

- Check token expiry before each API call
- Refresh token 5 minutes before expiry
- Store refresh token securely
- Graceful re-auth prompt on token expiry

### Risk 3: Terminal Compatibility

**Description**: readline and colors may behave differently across platforms.

**Impact**: Medium - Poor UX on some terminals

**Mitigation**:

- Test on Windows, macOS, Linux
- Provide fallback to basic output if colors fail
- Detect terminal capabilities on startup
- Document supported terminals

### Risk 4: Session State Corruption

**Description**: Concurrent CLI instances may corrupt session state file.

**Impact**: Low - Rare use case

**Mitigation**:

- File locking for write operations
- Atomic write pattern (write to temp, then rename)
- Validate session state on load
- Backup previous session state

### Risk 5: Large Message History

**Description**: Sessions with thousands of messages may slow down CLI.

**Impact**: Low - Affects only long-running sessions

**Mitigation**:

- Limit in-memory history to last 100 messages
- Load full history from API on resume
- Implement pagination for history viewing
- Archive old sessions automatically

---

## Implementation Order

**Phase 1** (M1): Core Framework
1. Project structure and dependencies
2. Config system
3. API client with auth
4. Basic commands (`/help`, `/status`, `/exit`)

**Phase 2** (M2): Chat Interface
1. REPL loop with readline
2. Message recording to API
3. Terminal UI with colors
4. Message history display

**Phase 3** (M3): Memory Integration
1. Memory search command
2. ACB integration
3. Context display
4. Enhanced command options

**Phase 4** (M4): Session Management
1. Session state persistence
2. Session commands
3. Resume functionality

**Phase 5** (M5): Export and Config
1. Export to JSON and Markdown
2. Advanced config options
3. Display customization

**Phase 6** (M6): Testing and Polish
1. Unit and integration tests
2. Documentation
3. Performance optimization
4. Bug fixes and refinement

---

## Dependencies

**Internal Dependencies**:

- SPEC-MEMORY-002: Memory search API (if search endpoint not yet available)

**External Dependencies**:

- API server must be running for CLI testing
- PostgreSQL database with migrations applied
- Valid user account for authentication

**Blocking Issues**:

- None identified

---

## Notes

**Future Enhancements** (Post-MVP):

- Multi-line input mode for complex queries
- Syntax highlighting for code blocks
- Auto-completion for commands and session IDs
- Fuzzy search for memory chunks
- Integrated AI chat (connect to LLM API)
- Memory edit commands (`/memory/edit`)
- Session sharing (export/import session state)

**Known Limitations**:

- Single-user sessions per CLI instance
- No multi-user collaboration
- Limited to terminal-based interaction
- No graphical UI

---

**Document Owner**: Backend Team
**Last Updated**: 2026-02-10
**Status**: Ready for Implementation
