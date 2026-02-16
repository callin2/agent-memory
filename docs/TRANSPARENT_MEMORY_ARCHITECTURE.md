# Transparent Memory Architecture

## Executive Summary

The Agent Memory System now implements **TRUE TRANSPARENCY** where agent modules are completely unaware of the memory system. The backend automatically captures all agent activity and injects context when needed.

## What Changed

### Before (NOT Transparent)

Frontend explicitly called memory APIs:
```typescript
// Frontend knows about memory system - VIOLATES transparency
await memoryService.recordEvent({
  session_id: 'session_123',
  channel: 'private',
  actor: { type: 'human', id: 'user1' },
  kind: 'message',
  content: { text: 'Hello' },
  sensitivity: 'none',
  tags: ['greeting']
});

await memoryService.buildACB({
  tenant_id: 'default',
  session_id: 'session_123',
  agent_id: 'agent_1',
  channel: 'private',
  intent: 'general',
  query_text: 'Previous context'
});
```

**Problem:** Agent modules know about memory capsules, chunks, ACB - violates transparency!

### After (TRULY Transparent)

Frontend sends normal messages:
```typescript
// Frontend just sends message - no memory API calls
const response = await fetch('/api/v1/chat', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    // Context headers (optional, for context injection)
    'x-session-id': 'session_123',
    'x-agent-id': 'agent_1',
    'x-channel': 'private',
  },
  body: JSON.stringify({
    text: 'Hello'
  })
});
```

Backend automatically:
1. ✅ Captures message to memory capsule (transparently)
2. ✅ Builds ACB if context needed (transparently)
3. ✅ Agent module never sees memory system

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    Agent Module (Frontend)                     │
│                                                               │
│  Sends messages, makes decisions, creates artifacts             │
│  (Does NOT call memory APIs like recordEvent, buildACB)        │
└───────────────────────────┬───────────────────────────────────┘
                            │
                            │ Normal HTTP Request
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│              Backend Transparent Layer                           │
│                                                               │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ Transparency Middleware                                  │  │
│  │  - Auto-captures all agent activity                      │  │
│  │  - Records events to memory capsules                      │  │
│  │  - Agent module never sees this happen                    │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                               │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ Context Injector                                        │  │
│  │  - Auto-builds ACB when context needed                  │  │
│  │  - Injects ACB into agent requests                      │  │
│  │  - Agent module just receives enhanced response             │  │
│  └───────────────────────────────────────────────────────────┘  │
└───────────────────────────┬───────────────────────────────────┘
                            │
                            │ Transparent Recording
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Memory Capsules                            │
│  - Events (messages, decisions, tool calls)                      │
│  - Chunks (embedded memories)                                  │
│  - Decisions (agent reasoning)                                  │
│  - Artifacts (generated content)                                 │
└─────────────────────────────────────────────────────────────────┘
```

## How It Works

### 1. Automatic Event Capture

The `transparency-middleware.ts` intercepts ALL agent requests/responses:

```typescript
// Any POST request to agent endpoints gets auto-captured
app.post('/api/v1/chat', async (req, res) => {
  // Normal handler - does NOT call memory APIs
  const response = await agentService.chat(req.body);

  // Middleware transparently captures this event
  return res.json(response);
});

// Backend records to memory capsule AUTOMATICALLY:
// {
//   event_id: 'evt_abc123',
//   kind: 'message',
//   content: { text: 'Hello' },
//   session_id: 'session_123',
//   timestamp: '2026-02-14T10:30:00Z'
// }
```

**What gets auto-captured:**
- ✅ Messages (user/agent)
- ✅ Decisions (agent reasoning)
- ✅ Tool calls (function execution)
- ✅ Artifacts (generated content)
- ✅ Task updates (status changes)

### 2. Automatic Context Injection

The `context-injector.ts` auto-builds ACB when agent needs context:

```typescript
// Agent requests with x-session-id header
app.post('/api/v1/chat', async (req, res) => {
  // Context injector ALREADY built ACB and attached to req
  const acb = (req as any).injectedContext;

  // Agent handler can use injected context
  const response = await agentService.chat(
    req.body,
    acb  // Pre-built context, no API call needed!
  );

  return res.json(response);
});
```

**Context injection triggers:**
- Request includes `x-session-id` header
- Request path matches configured patterns (`/api/v1/chat`, `/api/v1/message`, `/api/v1/agent`)
- Context injector auto-builds ACB and attaches to `req.injectedContext`

### 3. Test Harness Still Works

GET endpoints remain for test harness visualization:

```typescript
// Test harness can query what happened
GET /api/v1/events?session_id=session_123
GET /api/v1/events/:event_id
GET /api/v1/chunks/:chunk_id
GET /api/v1/artifacts/:artifact_id

// But frontend never calls POST /api/v1/events anymore
// Backend auto-captures everything transparently!
```

## Frontend Changes Required

### Remove Explicit Memory API Calls

**Before:**
```typescript
// web-ui/src/pages/index.ts (OLD)
import { memoryService } from '@/services/memory';

async function sendMessage(text: string) {
  // WRONG: Explicitly records event
  await memoryService.recordEvent({
    session_id: sessionId,
    channel: 'private',
    actor: { kind: 'user', name: 'User' },
    kind: 'message',
    content: { text },
    sensitivity: 'none',
    tags: []
  });

  // WRONG: Explicitly builds ACB
  const acb = await memoryService.buildACB({
    tenant_id: 'default',
    session_id: sessionId,
    agent_id: 'chat-agent',
    channel: 'private',
    intent: 'chat',
    query_text: text
  });

  const response = await fetch('/api/v1/chat', {
    method: 'POST',
    body: JSON.stringify({
      text,
      context: acb  // Manually passing ACB
    })
  });
}
```

**After:**
```typescript
// web-ui/src/pages/index.ts (NEW)
async function sendMessage(text: string) {
  // CORRECT: Just send message, backend handles memory transparently
  const response = await fetch('/api/v1/chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      // Context headers (optional, enables auto-ACB)
      'x-session-id': sessionId,
      'x-agent-id': 'chat-agent',
      'x-channel': 'private',
      'x-intent': 'chat',  // Optional: helps ACB building
    },
    body: JSON.stringify({
      text  // Backend auto-captures this to memory capsule
    })
  });

  const data = await response.json();

  // Backend may include injected context metadata in response
  console.log('Context tokens used:', data._context?.token_count);
}
```

### Update Memory Service (Keep for Test Harness Only)

```typescript
// web-ui/src/services/memory.ts (UPDATED)

// Keep GET methods for test harness visualization
export const memoryService = {
  // REMOVE: recordEvent() - Backend auto-captures
  // REMOVE: buildACB() - Backend auto-injects

  // KEEP: For test harness visualization only
  async getEvents(session_id: string): Promise<MemoryEvent[]> {
    const response = await api.get<MemoryEvent[]>(`/v1/events`, {
      params: { session_id }
    });
    return response.data;
  },

  async getEvent(event_id: string): Promise<MemoryEvent> {
    const response = await api.get<MemoryEvent>(`/v1/events/${event_id}`);
    return response.data;
  },

  async getChunk(chunkId: string): Promise<Chunk> {
    const response = await api.get<Chunk>(`/v1/chunks/${chunkId}`);
    return response.data;
  },

  // ... other GET methods for visualization
};
```

## Configuration

### Environment Variables

```bash
# .env

# Enable/disable transparent memory (default: true)
TRANSPARENT_MEMORY=true

# Enable/disable context injection (default: true)
CONTEXT_INJECTION=true

# Paths where context should be auto-injected
CONTEXT_INJECT_PATHS=/api/v1/chat,/api/v1/message,/api/v1/agent

# Default ACB size for auto-injection
DEFAULT_ACB_MAX_TOKENS=65000
```

### TypeScript Configuration

```typescript
// src/server.ts

const transparencyConfig = {
  enabled: process.env.TRANSPARENT_MEMORY !== "false", // Default enabled
  captureMessages: true,
  captureDecisions: true,
  captureToolCalls: true,
  captureArtifacts: true,
  captureTaskUpdates: true,
};

const contextInjectorConfig = {
  enabled: process.env.CONTEXT_INJECTION !== "false", // Default enabled
  defaultMaxTokens: 65000,
  injectOnPaths: ["/api/v1/chat", "/api/v1/message", "/api/v1/agent"],
  requireIntent: false, // Auto-detect intent from request
};
```

## Benefits of True Transparency

### 1. Agent Modules Focus on Domain Logic

```typescript
// Agent module just handles chat logic
class ChatAgent {
  async chat(message: string) {
    // Business logic only
    const response = await this.llm.generate(message);

    // Backend transparently:
    // - Recorded message event to memory
    // - Recorded agent response event to memory
    // - Injected relevant ACB for next request

    return response;
  }
}
```

### 2. Memory System Can Evolve Independently

```typescript
// Backend can change memory implementation without breaking frontend
// - Switch from capsules to neural memory
// - Change ACB algorithm
// - Add new event types
// Frontend continues working because it never called memory APIs!
```

### 3. Test Harness Visualization Still Works

```typescript
// Test harness can query what happened
const events = await memoryService.getEvents(session_id);
console.log('Captured events:', events);

// But agent modules never recorded these explicitly
// Backend transparent middleware captured everything
```

## Migration Checklist

### Backend ✅ (Already Done)

- [x] Created `transparency-middleware.ts`
- [x] Created `context-injector.ts`
- [x] Integrated middleware into `server.ts`
- [x] Kept GET endpoints for test harness

### Frontend (Needs Changes)

- [ ] Remove `memoryService.recordEvent()` calls
- [ ] Remove `memoryService.buildACB()` calls
- [ ] Add context headers to agent requests (`x-session-id`, `x-agent-id`)
- [ ] Update `memoryService` to keep only GET methods for visualization
- [ ] Remove explicit ACB passing to agent requests
- [ ] Remove event recording from frontend business logic

## Testing

### Verify Transparency Works

```bash
# Start backend with transparent middleware enabled
npm start

# Send agent request (no memory API calls)
curl -X POST http://localhost:3456/api/v1/chat \
  -H "Content-Type: application/json" \
  -H "x-session-id: test-session-123" \
  -H "x-agent-id: test-agent" \
  -d '{"text": "Hello, transparent memory!"}'

# Check event was auto-captured
curl http://localhost:3456/api/v1/events?session_id=test-session-123

# Response should include the "Hello, transparent memory!" event
# Even though frontend never called recordEvent()!
```

### Verify Context Injection Works

```bash
# Send second message (should get context from first)
curl -X POST http://localhost:3456/api/v1/chat \
  -H "Content-Type: application/json" \
  -H "x-session-id: test-session-123" \
  -H "x-agent-id: test-agent" \
  -d '{"text": "What did I just say?"}'

# Check response includes context metadata
curl http://localhost:3456/api/v1/events?session_id=test-session-123 | jq '.[-1]._context'

# Should show ACB was auto-injected:
# {
#   "bundle_id": "acb_xxx",
#   "token_count": 1234,
#   "chunk_count": 1
# }
```

## Summary

**True Transparency Achieved:**

✅ Agent modules never call memory APIs
✅ Backend auto-captures all events transparently
✅ Backend auto-injects context when needed
✅ Test harness can still visualize what happened
✅ Memory system can evolve without breaking frontend
✅ Frontend focuses on domain logic only

The Agent Memory System is now **TRULY TRANSPARENT**!
