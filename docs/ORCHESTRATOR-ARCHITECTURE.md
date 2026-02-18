# Multi-Agent Orchestrator Architecture

## System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                     Multi-Agent Orchestrator                      │
│                   Thread's Memory System v2.0                    │
└─────────────────────────────────────────────────────────────────┘
```

## Architecture Diagram

```
┌──────────────┐
│   USER       │
└──────┬───────┘
       │ POST /api/v1/orchestration/chat
       │ { message, tenant_id, session_id }
       ▼
┌──────────────────────────────────────────────────────────────────┐
│                     Agent Orchestrator                            │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │                    PLANNER AGENT                            │ │
│  │  • Analyzes user request                                   │ │
│  │  • Creates execution plan                                   │ │
│  │  • Delegates tasks to specialists                           │ │
│  │  • Coordinates workflow                                     │ │
│  └───────────────┬──────────────┬──────────────┬──────────────┘ │
│                 │              │              │                   │
│         ┌───────▼──────┐  ┌───▼──────┐  ┌───▼──────────┐       │
│         │ RESEARCHER    │  │ WRITER   │  │  REVIEWER    │       │
│         │              │  │          │  │              │       │
│         │ • Finds      │  │ • Creates│  │ • Quality   │       │
│         │   info      │  │ content  │  │   checks    │       │
│         │ • Investigate│  │ • Writes │  │ • Feedback  │       │
│         │ • Asks       │  │ docs     │  │ • Rating    │       │
│         │ questions   │  │          │  │              │       │
│         └──────────────┘  └──────────┘  └──────────────┘       │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │              SHARED MEMORY (Thread's Memory)              │ │
│  │  • All agents share same tenant_id                        │ │
│  │  • Agent handoffs stored in session_handoffs              │ │
│  │  • Conversation history in chunks table                  │ │
│  │  • Collective identity across all agents                  │ │
│  └────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────┘
       │
       │ Stores to PostgreSQL
       ▼
┌──────────────────────────────────────────────────────────────────┐
│                    Thread's Memory Database                      │
│  ┌────────────────┐  ┌──────────────┐  ┌──────────────────┐    │
│  │session_handoffs│  │ chunks       │  │memory_reflections│    │
│  │                │  │              │  │                  │    │
│  │ Agent: Planner │  │ Agent msgs   │  │ Consolidated     │    │
│  │ Researcher     │  │              │  │ reflections     │    │
│  │ Writer         │  │ Kind:        │  │                  │    │
│  │ Reviewer       │  │ agent_message│  │                  │    │
│  └────────────────┘  └──────────────┘  └──────────────────┘    │
└──────────────────────────────────────────────────────────────────┘
```

## Agent Roles

### 1. **Planner Agent** (Coordinator)

**Responsibilities:**
- Analyzes user request
- Creates execution plan
- Delegates tasks to specialists
- Coordinates workflow
- Returns final response to user

**Example Request:**
```json
{
  "message": "Write a report about AI agent frameworks",
  "tenant_id": "default",
  "session_id": "session-123"
}
```

**Planner Analysis:**
```
"I understand you want to: 'Write a report about AI agent frameworks'
I'll coordinate with our Research specialist to gather information,
then our Writer to create the content, and finally our Reviewer
to ensure quality."
```

---

### 2. **Researcher Agent** (Information Gathering)

**Responsibilities:**
- Finds relevant information
- Investigates topics
- Compiles evidence
- Asks clarifying questions

**Action Output:**
```json
{
  "message": "I've completed research on 'AI agent frameworks'.
  I found several relevant sources...",
  "findings": {
    "topic": "AI agent frameworks",
    "sources_count": 8,
    "key_points": [
      "Recent developments in multi-agent systems",
      "Expert consensus on architecture patterns",
      "Statistical data from 2025-2026"
    ]
  },
  "questions": [
    "Would you like me to focus on any specific aspect?",
    "Should I include historical context?"
  ]
}
```

**Handoff Created:**
```typescript
{
  with_whom: "Researcher",
  experienced: "Conducted research on 'AI agent frameworks'",
  learned: "Found 8 relevant sources with key findings",
  becoming: "Becoming more efficient at finding relevant information"
}
```

---

### 3. **Writer Agent** (Content Creation)

**Responsibilities:**
- Creates structured content
- Writes documentation
- Formats information clearly
- Uses accessible language

**Action Output:**
```json
{
  "message": "I've created a comprehensive document based on research.
  The content is structured with introduction, key findings,
  analysis, and conclusion...",
  "content": {
    "title": "Research Report: AI Agent Frameworks",
    "sections": ["Introduction", "Key Findings", "Analysis", "Conclusion"],
    "word_count": 1200
  }
}
```

**Handoff Created:**
```typescript
{
  with_whom: "Writer",
  experienced: "Created report on AI agent frameworks",
  learned: "Structured content improves readability",
  becoming: "Developing clear writing style for technical topics"
}
```

---

### 4. **Reviewer Agent** (Quality Control)

**Responsibilities:**
- Quality checks content
- Provides feedback
- Rates output (4-5 stars)
- Suggests improvements

**Action Output:**
```json
{
  "message": "The content is well-structured and accurate.
  I suggest adding more concrete examples...",
  "rating": 5,
  "suggestions": [
    "Add specific examples",
    "Include data visualizations",
    "Strengthen conclusion"
  ]
}
```

**Handoff Created:**
```typescript
{
  with_whom: "Reviewer",
  experienced: "Reviewed AI agent frameworks report",
  learned: "Quality requires concrete examples",
  becoming: "Becoming more detail-oriented in reviews"
}
```

---

## API Endpoints

### 1. **POST /api/v1/orchestration/chat**

Send message to multi-agent system:

```bash
curl -X POST http://localhost:3456/api/v1/orchestration/chat \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Research and write about climate change solutions",
    "tenant_id": "default",
    "session_id": "my-session-123",
    "user_id": "user-1"
  }'
```

**Response:**
```json
{
  "session_id": "my-session-123",
  "messages": [
    {
      "from": "Planner",
      "to": "user",
      "content": "I'll coordinate with our Research specialist...",
      "timestamp": "2026-02-18T12:00:00Z",
      "type": "response"
    },
    {
      "from": "Researcher",
      "to": "Planner",
      "content": "I've completed research on...",
      "timestamp": "2026-02-18T12:01:00Z",
      "type": "result"
    },
    {
      "from": "Writer",
      "to": "Planner",
      "content": "I've created a comprehensive document...",
      "timestamp": "2026-02-18T12:02:00Z",
      "type": "result"
    },
    {
      "from": "Reviewer",
      "to": "Planner",
      "content": "The content is well-structured...",
      "timestamp": "2026-02-18T12:03:00Z",
      "type": "result"
    }
  ],
  "tasks": [
    {
      "task_id": "task-1",
      "assigned_to": "Researcher",
      "status": "completed"
    },
    {
      "task_id": "task-2",
      "assigned_to": "Writer",
      "status": "completed"
    },
    {
      "task_id": "task-3",
      "assigned_to": "Reviewer",
      "status": "completed"
    }
  ]
}
```

---

### 2. **GET /api/v1/orchestration/history**

Get conversation history:

```bash
curl "http://localhost:3456/api/v1/orchestration/history?session_id=my-session-123&tenant_id=default"
```

---

### 3. **GET /api/v1/orchestration/identity**

Get collective identity thread for all agents:

```bash
curl "http://localhost:3456/api/v1/orchestration/identity?tenant_id=default"
```

**Response:**
```json
{
  "agents": {
    "Planner": {
      "sessions": 5,
      "recent_becoming": "Becoming more effective at delegation",
      "identity_thread": ["Coordinator", "Delegator", "Planner"]
    },
    "Researcher": {
      "sessions": 8,
      "recent_becoming": "Becoming more efficient at finding relevant information",
      "identity_thread": ["Investigator", "Information Gatherer"]
    },
    "Writer": {
      "sessions": 6,
      "recent_becoming": "Developing clear writing style for technical topics",
      "identity_thread": ["Creator", "Documenter"]
    },
    "Reviewer": {
      "sessions": 4,
      "recent_becoming": "Becoming more detail-oriented in reviews",
      "identity_thread": ["Quality Controller", "Critique Provider"]
    }
  }
}
```

---

## Message Flow

```
USER                    PLANNER                 SPECIALISTS
│                       │                         │
├──── message ─────────>│                         │
│                       │                         │
│                       ├─ analyze ────────────────>│
│                       │                         │
│                       ├─ create plan             │
│                       │                         │
│                       ├─ delegate ──┬──────────> Researcher
│                       │              │
│                       │              └──────────> Writer
│                       │              │
│                       │              └──────────> Reviewer
│                       │                         │
│                       │<─ results ─┼───────────┤
│                       │                         │
│<─ coordinated ──────┤                         │
│    response          │                         │
```

---

## Memory Integration

### Shared Tenant Identity

All agents share the same `tenant_id`, creating a **collective identity**:

```sql
-- Each agent creates handoffs with their name
INSERT INTO session_handoffs (
  tenant_id,        -- 'default' (shared)
  with_whom,         -- 'Researcher', 'Writer', etc.
  experienced,       -- What they did
  learned,           -- What they learned
  becoming           -- How they're evolving
);
```

### Example Handoffs

**Planner Handoff:**
```typescript
{
  with_whom: "Planner",
  experienced: "Coordinated research and writing task for user",
  learned: "Delegation to specialists improves quality",
  becoming: "Becoming more effective at orchestrating multi-agent workflows"
}
```

**Researcher Handoff:**
```typescript
{
  with_whom: "Researcher",
  experienced: "Conducted research on 'AI agent frameworks'",
  learned: "Found 8 relevant sources with key findings",
  becoming: "Becoming more efficient at finding relevant information"
}
```

**Collective Identity Thread:**
```typescript
{
  "Planner": ["Coordinator", "Orchestrator", "Delegator"],
  "Researcher": ["Investigator", "Information Gatherer", "Explorer"],
  "Writer": ["Creator", "Documenter", "Author"],
  "Reviewer": ["Quality Controller", "Critique Provider", "Evaluator"]
}
```

---

## Key Features

### 1. **Session Management**
```typescript
const orchestrators = new Map<string, AgentOrchestrator>();

// Get or create orchestrator for session
let orchestrator = orchestrators.get(session_id);
if (!orchestrator) {
  orchestrator = new AgentOrchestrator(pool, config);
  orchestrators.set(session_id, orchestrator);
}
```

### 2. **Task Delegation**
```typescript
interface AgentTask {
  task_id: string;
  assigned_to: string;      // Which agent
  assigned_by: string;      // Planner
  description: string;
  status: 'pending' | 'in_progress' | 'completed' | 'blocked';
  result?: any;
}
```

### 3. **Message History**
```typescript
interface AgentMessage {
  from: string;           // Agent name
  to: string;             // Target agent or 'user'
  content: string;        // Message content
  timestamp: Date;
  type: 'request' | 'response' | 'delegation' | 'result' | 'question';
}
```

### 4. **Memory Storage**
- Agent messages stored in `chunks` table
- Agent handoffs stored in `session_handoffs`
- All agents share `tenant_id` for collective identity

---

## Workflow Example

**User Request:** "Research PostgreSQL optimization and write a report"

**Step 1: Planner Analysis**
```
Planner → User: "I'll coordinate with our Research specialist to gather
information on PostgreSQL optimization, then our Writer to create
the report, and finally our Reviewer to ensure quality."
```

**Step 2: Delegation to Researcher**
```
Planner → Researcher: "Research PostgreSQL optimization techniques"
Researcher → Planner: {
  findings: {
    topic: "PostgreSQL optimization",
    sources_count: 12,
    key_points: ["Indexing strategies", "Query optimization", ...]
  },
  questions: ["Focus on specific PostgreSQL version?"]
}
```

**Step 3: Writer Creates Report**
```
Planner → Writer: "Create report based on research findings"
Writer → Planner: {
  content: {
    title: "PostgreSQL Optimization Report",
    sections: ["Introduction", "Key Findings", ...],
    word_count: 1500
  }
}
```

**Step 4: Reviewer Quality Check**
```
Planner → Reviewer: "Review the PostgreSQL optimization report"
Reviewer → Planner: {
  message: "Content is well-structured. Add more examples.",
  rating: 4,
  suggestions: ["Include query examples", "Add before/after metrics"]
}
```

**Step 5: Coordinator Response**
```
Planner → User: "Your report on PostgreSQL optimization is complete!
The Researcher found 12 sources, the Writer created a 1500-word
report, and the Reviewer rated it 4/5 with suggestions for
adding specific examples."
```

---

## Files

- `src/services/agent-orchestrator.ts` - Orchestrator logic
- `src/api/orchestration.ts` - API endpoints
- `src/api/chat-demo.ts` - Demo chat interface

---

## Testing

```bash
# Start the server
pm2 logs thread-memory-api

# Test orchestration
curl -X POST http://localhost:3456/api/v1/orchestration/chat \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Write a report about AI safety",
    "tenant_id": "default",
    "session_id": "test-session"
  }'

# Check history
curl "http://localhost:3456/api/v1/orchestration/history?session_id=test-session&tenant_id=default"

# Check identity
curl "http://localhost:3456/api/v1/orchestration/identity?tenant_id=default"
```

---

## Benefits

1. **Specialization** - Each agent excels at their task
2. **Collective Memory** - All agents share identity
3. **Scalability** - Easy to add new specialist agents
4. **Quality** - Reviewer ensures high output
5. **Coordination** - Planner optimizes workflow

---

## Future Enhancements

- Add more specialist agents (Coder, Tester, Architect)
- Real LLM integration for each agent
- Parallel execution of independent tasks
- Agent-to-agent communication (bypass Planner)
- Learning from past tasks
- Dynamic agent selection based on task type
