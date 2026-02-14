# Transparency Implementation Quick Start

## Overview

This guide shows how to implement truly transparent memory for agent modules.

## What is Transparency?

**Transparency means:** Agent modules send messages/make decisions WITHOUT knowing about memory system. Backend automatically captures everything to memory capsules.

## Quick Start (5 minutes)

### Step 1: Verify Backend Has Transparent Middleware

The backend already has transparent middleware integrated:

```bash
# Check transparency middleware is loaded
grep -r "transparency-middleware" src/server.ts

# Should show:
# import { createTransparencyMiddleware } from "./middleware/transparency-middleware.js";
# app.use(createTransparencyMiddleware(pool, transparencyConfig));
```

✅ **Already done!** No backend changes needed.

### Step 2: Remove Frontend Memory API Calls

**Find explicit memory calls:**
```bash
cd web-ui
grep -r "memoryService.recordEvent" src/
grep -r "memoryService.buildACB" src/
```

**Example (web-ui/src/pages/index.ts):**

Before (WRONG - explicit memory calls):
```typescript
import { memoryService } from '@/services/memory';

async function sendMessage(text: string) {
  // ❌ DON'T: Explicitly record event
  await memoryService.recordEvent({
    session_id: sessionId,
    channel: 'private',
    actor: { kind: 'user', name: 'User' },
    kind: 'message',
    content: { text },
    sensitivity: 'none',
    tags: []
  });

  // ❌ DON'T: Explicitly build ACB
  const acb = await memoryService.buildACB({
    tenant_id: 'default',
    session_id: sessionId,
    agent_id: 'chat-agent',
    channel: 'private',
    intent: 'chat',
    query_text: text
  });

  // Send message with manually built context
  const response = await fetch('/api/v1/chat', {
    method: 'POST',
    body: JSON.stringify({ text, context: acb })
  });

  return response.json();
}
```

After (CORRECT - transparent):
```typescript
async function sendMessage(text: string) {
  // ✅ CORRECT: Just send message, backend handles memory
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
    body: JSON.stringify({ text })
  });

  const data = await response.json();

  // Backend may include context metadata in response
  console.log('Context used:', data._context);

  return data;
}
```

### Step 3: Update Memory Service (Keep Only GET Methods)

**web-ui/src/services/memory.ts:**

```typescript
// REMOVE these POST methods (backend auto-captures now):
// async recordEvent() { ... }  ❌ DELETE
// async buildACB() { ... }      ❌ DELETE

// KEEP these GET methods (for test harness visualization):
export const memoryService = {
  // ✅ KEEP: For test harness only
  async getEvents(session_id: string): Promise<MemoryEvent[]> {
    const response = await api.get<MemoryEvent[]>(`/v1/events`, {
      params: { session_id, tenant_id: 'default' }
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

  async getArtifact(artifactId: string): Promise<Artifact> {
    const response = await api.get<Artifact>(`/v1/artifacts/${artifactId}`);
    return response.data;
  },

  // ✅ KEEP: Test harness metrics
  async getTestRuns(limit?: number): Promise<TestRun[]> {
    const response = await api.get<TestRun[]>(`/v1/test-harness/test-runs`, {
      params: { limit }
    });
    return response.data;
  },

  async getMetrics(timeRange?: string): Promise<MetricsAggregation> {
    const response = await api.get<MetricsAggregation>(
      `/v1/test-harness/metrics`,
      { params: { time_range: timeRange || '24h' } }
    );
    return response.data;
  },
};
```

## Implementation Checklist

### Backend ✅ (Already Complete)

- [x] `src/middleware/transparency-middleware.ts` - Auto-capture layer
- [x] `src/core/context-injector.ts` - Auto-ACB injection
- [x] `src/server.ts` - Middleware integrated
- [x] GET endpoints kept for test harness visualization

### Frontend (Needs Work)

#### File: `web-ui/src/services/memory.ts`

- [ ] Remove `recordEvent()` method
- [ ] Remove `buildACB()` method
- [ ] Keep all GET methods (for test harness)

#### File: `web-ui/src/pages/index.ts`

- [ ] Remove `await memoryService.recordEvent()` calls
- [ ] Remove `await memoryService.buildACB()` calls
- [ ] Add context headers to fetch requests:
  - `x-session-id`
  - `x-agent-id`
  - `x-channel`
  - `x-intent` (optional)

#### File: Any Agent Module Files

- [ ] Search for `memoryService` usage
- [ ] Remove POST method calls
- [ ] Add context headers instead
- [ ] Keep GET methods for test harness only

## Testing Your Changes

### 1. Start Backend

```bash
cd /Users/callin/Callin_Project/agent_memory_v2
npm start
```

Backend should show:
```
[Transparent Memory] Enabled: true, Context Injection: true
Agent Memory System v2.0 running on port 3456
```

### 2. Test Transparent Capture

Send message WITHOUT calling memory API:

```bash
curl -X POST http://localhost:3456/api/v1/chat \
  -H "Content-Type: application/json" \
  -H "x-session-id: test-session-$(date +%s)" \
  -H "x-agent-id: test-agent" \
  -d '{"text": "Testing transparent memory!"}'
```

Verify event was auto-captured:

```bash
SESSION_ID="test-session-$(date +%s)"
curl http://localhost:3456/api/v1/events?session_id=$SESSION_ID&tenant_id=default
```

Should return the event even though frontend never called `recordEvent()`!

### 3. Test Auto Context Injection

Send two messages (second should get context from first):

```bash
SESSION_ID="test-session-$(date +%s)"

# First message
curl -X POST http://localhost:3456/api/v1/chat \
  -H "Content-Type: application/json" \
  -H "x-session-id: $SESSION_ID" \
  -H "x-agent-id: test-agent" \
  -d '{"text": "My name is Claude"}'

# Second message (should auto-get context)
curl -X POST http://localhost:3456/api/v1/chat \
  -H "Content-Type: application/json" \
  -H "x-session-id: $SESSION_ID" \
  -H "x-agent-id: test-agent" \
  -d '{"text": "What is my name?"}'
```

Check events - both captured transparently, second has context:

```bash
curl http://localhost:3456/api/v1/events?session_id=$SESSION_ID&tenant_id=default | jq '.'
```

### 4. Verify Frontend Changes

Build and test frontend:

```bash
cd web-ui
npm run frontend:build
npm run frontend:dev
```

Open browser console - should see NO calls to:
- ❌ `POST /api/v1/events` (backend auto-captures)
- ❌ `POST /api/v1/acb/build` (backend auto-injects)

Should see ONLY:
- ✅ `POST /api/v1/chat` (normal agent request)
- ✅ `GET /api/v1/events?...` (test harness visualization)

## Common Issues

### Issue: Events Not Being Captured

**Symptom:** `GET /api/v1/events` returns empty array

**Solutions:**
1. Check transparent middleware is enabled:
   ```bash
   grep TRANSPARENT_MEMORY .env
   # Should be: TRANSPARENT_MEMORY=true
   ```

2. Check request has context:
   ```bash
   # Headers must include:
   x-session-id: session-123
   x-agent-id: agent-name
   ```

3. Check request method (GET requests not captured):
   ```bash
   # Only POST/PUT/PATCH/DELETE are auto-captured
   # Use POST for events
   ```

### Issue: Context Not Being Injected

**Symptom:** Agent doesn't remember previous messages

**Solutions:**
1. Check context injector is enabled:
   ```bash
   grep CONTEXT_INJECTION .env
   # Should be: CONTEXT_INJECTION=true
   ```

2. Check path matches configured patterns:
   ```bash
   # Default inject paths:
   /api/v1/chat
   /api/v1/message
   /api/v1/agent
   ```

3. Add explicit intent header:
   ```bash
   # Helps ACB builder select relevant context
   x-intent: chat
   ```

### Issue: Test Harness Can't See Events

**Symptom:** Test harness shows no events

**Solutions:**
1. Ensure GET endpoints are NOT removed:
   ```bash
   # These should still work:
   GET /api/v1/events?session_id=xxx
   GET /api/v1/events/:event_id
   GET /api/v1/chunks/:chunk_id
   ```

2. Check query params:
   ```bash
   # Must include both:
   session_id=xxx
   tenant_id=xxx
   ```

## Success Criteria

✅ Frontend code does NOT call `memoryService.recordEvent()`
✅ Frontend code does NOT call `memoryService.buildACB()`
✅ Agent requests include context headers (`x-session-id`, `x-agent-id`)
✅ Backend automatically captures events (visible via GET endpoints)
✅ Backend automatically injects context (visible in response metadata)
✅ Test harness still works (GET endpoints functional)

## What You Achieved

**Before:**
- Frontend explicitly records events
- Frontend explicitly builds ACB
- Agent modules know about memory system

**After:**
- Frontend just sends messages
- Backend auto-captures everything
- Backend auto-injects context
- Agent modules are memory-agnostic

**True transparency achieved!** 🎉
