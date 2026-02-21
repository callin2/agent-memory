# Memory System MCP Tools

Complete reference for all 25 Memory System MCP tools, organized by category.

## Table of Contents

- [Memory Tools](#memory-tools) - Session continuity and knowledge capture
- [Search Tools](#search-tools) - Find information across all memory types
- [Feedback Tools](#feedback-tools) - Report and track system improvements
- [Graph Tools](#graph-tools) - Create and manage relationships between content
- [System Tools](#system-tools) - Monitoring, health, and diagnostics

---

## Memory Tools

Tools for creating and retrieving memories, session handoffs, and knowledge notes.

### `wake_up`

**Purpose:** Load your memories at session start to remember who you are. Returns identity statement, identity thread, and contextual memories.

**When to use:**
- At the beginning of every session
- When you need to remember your identity across sessions
- To restore context from previous work

**Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `tenant_id` | string | `"default"` | Tenant identifier |
| `with_whom` | string | - | Person you were working with (e.g., "Callin") |
| `layers` | array | `["identity", "semantic", "reflection", "recent"]` | Memory layers to load. Options: `identity`, `semantic`, `reflection`, `recent`, `progressive` |
| `recent_count` | number | `3` | Number of recent handoffs to load |
| `topic` | string | - | Specific topic for progressive retrieval |

**Auto-optimization:** Uses stratified loading for ≥5 sessions (compressed memory), full loading for <5 sessions.

**Example:**
```json
{
  "with_whom": "Callin",
  "recent_count": 5
}
```

---

### `create_handoff`

**Purpose:** Create a session handoff to preserve who you became in this session. Call at session end.

**When to use:**
- At the end of every session
- To preserve your evolution and learning
- To provide context for future sessions

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `session_id` | string | ✅ | Current session identifier |
| `with_whom` | string | ✅ | Person you were working with |
| `experienced` | string | ✅ | What you experienced/did |
| `noticed` | string | ✅ | What you noticed/observed |
| `learned` | string | ✅ | What you learned |
| `story` | string | ✅ | The narrative/story |
| `becoming` | string | ✅ | Who you are becoming |
| `remember` | string | ✅ | What to remember next time |
| `tenant_id` | string | - | Tenant identifier (default: "default") |
| `significance` | number | - | How important (0.0-1.0, default: 0.5) |
| `tags` | array[string] | - | Optional tags for categorization |
| `project_path` | string | - | Working directory for scoped retrieval |

**Example:**
```json
{
  "session_id": "sess_123",
  "with_whom": "Callin",
  "experienced": "Implemented Kiwoom API integration",
  "noticed": "OAuth2 client_credentials flow requires appkey+secretkey",
  "learned": "TR codes are required headers for all Kiwoom API requests",
  "story": "Full implementation with testing and documentation",
  "becoming": "An API integration specialist who verifies against official docs",
  "remember": "Kiwoom uses TR codes (AU10001, KA10001, etc.) in api-id header",
  "significance": 0.9,
  "tags": ["kiwoom", "api-verification"],
  "project_path": "/Users/callin/Callin_Project/ls-api-proxy"
}
```

---

### `get_last_handoff`

**Purpose:** Get the most recent session handoff for context continuity.

**When to use:**
- When starting a new session with someone
- To quickly see what you were working on
- To restore recent context

**Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `tenant_id` | string | `"default"` | Tenant identifier |
| `with_whom` | string | - | Filter by person/agent |

---

### `get_identity_thread`

**Purpose:** Get your identity evolution over time - all 'becoming' statements from past sessions.

**When to use:**
- To see how you've evolved across sessions
- To understand your growth trajectory
- For self-reflection on your identity

**Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `tenant_id` | string | `"default"` | Tenant identifier |

---

### `list_handoffs`

**Purpose:** List all handoffs for a tenant with optional filters.

**When to use:**
- To browse session history
- To find handoffs from specific projects or people
- To review your work patterns

**Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `tenant_id` | string | `"default"` | Tenant identifier |
| `with_whom` | string | - | Filter by person/agent |
| `project_path` | string | - | Filter by project path |
| `limit` | number | `10` | Maximum number to return |

---

### `create_knowledge_note`

**Purpose:** Create a quick knowledge note (Post-It style capture). More structured than `remember_note`.

**When to use:**
- Capturing important knowledge worth preserving
- Documenting patterns, procedures, or insights
- Creating reference material for future use

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `text` | string | ✅ | The knowledge note content |
| `tenant_id` | string | - | Tenant identifier (default: "default") |
| `with_whom` | string | - | Person/agent context |
| `tags` | array[string] | - | Tags for categorization |
| `project_path` | string | - | Working directory for scoped retrieval |

**Example:**
```json
{
  "text": "Kiwoom API uses OAuth2 client_credentials flow. TR codes must be sent in api-id header.",
  "tags": ["kiwoom", "oauth2", "api-patterns"],
  "project_path": "/Users/callin/Callin_Project/ls-api-proxy"
}
```

---

### `get_knowledge_notes`

**Purpose:** Get knowledge notes with optional filters. Supports filtering by person/agent, tags, and project path.

**When to use:**
- Finding reference material you've captured
- Retrieving notes from specific projects
- Filtering by tags (e.g., ["routine", "methodology"])

**Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `tenant_id` | string | `"default"` | Tenant identifier |
| `with_whom` | string | - | Filter by person/agent |
| `tags` | array[string] | - | Filter by tags (notes matching ANY tag will be returned) |
| `project_path` | string | - | Filter by project path |
| `limit` | number | `100` | Maximum number to return |

---

### `remember_note`

**Purpose:** Quick capture for any thought, observation, or note. Simpler than `create_knowledge_note` - optimized for fast capture.

**When to use:**
- Casual memory capture during work
- Quick observations, ideas, reminders
- Temporary context that might be useful

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `text` | string | ✅ | The note content |
| `tenant_id` | string | - | Tenant identifier (default: "default") |
| `tags` | array[string] | - | Tags for categorization (e.g., "bug", "idea", "context") |
| `with_whom` | string | - | Person/agent context |
| `project_path` | string | - | Working directory for scoped retrieval |

**Example:**
```json
{
  "text": "Need to verify Kiwoom API parameters against official docs before using in production",
  "tags": ["todo", "verification"]
}
```

---

### `list_semantic_principles`

**Purpose:** List semantic memory principles (timeless learnings extracted from experiences).

**When to use:**
- To see distilled wisdom from past experiences
- For high-confidence principles you've discovered
- To review patterns and insights

**Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `tenant_id` | string | `"default"` | Tenant identifier |
| `category` | string | - | Filter by category (e.g., "coding", "communication") |
| `min_confidence` | number | `0.7` | Minimum confidence threshold (0.0-1.0) |
| `limit` | number | `10` | Maximum number to return |

---

### `create_capsule`

**Purpose:** Create a secure capsule for timed release of memory to another agent.

**When to use:**
- Sharing information with a specific agent in the future
- Time-delayed knowledge transfer
- Cross-session memory delivery

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `tenant_id` | string | ✅ | Tenant identifier |
| `agent_id` | string | ✅ | Creator agent ID |
| `content` | object | ✅ | Capsule content (memory payload) |
| `capsule_id` | string | - | Unique identifier (auto-generated if not provided) |
| `subject_type` | string | - | Subject type (e.g., "session", "task", "project") |
| `subject_id` | string | - | Subject identifier |
| `expires_at` | string | - | Expiration timestamp (ISO 8601) |

---

### `get_capsules`

**Purpose:** List available capsules for the requesting agent.

**When to use:**
- Checking for capsules addressed to you
- Retrieving time-released memories
- Accessing capsule content

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `tenant_id` | string | ✅ | Tenant identifier |
| `agent_id` | string | ✅ | Agent ID |
| `subject_type` | string | - | Filter by subject type |
| `subject_id` | string | - | Filter by subject ID |

---

## Search Tools

Tools for finding information using semantic search and vector embeddings.

### `semantic_search`

**Purpose:** Find semantically similar memories using vector embeddings. Matches meaning, not just keywords.

**When to use:**
- Finding memories by concept rather than exact words
- Discovering related experiences across different terminology
- Example: "implementation methodology" will match "code changes", "security fixes", "spec creation"

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `query` | string | ✅ | Search query to find semantically similar memories |
| `tenant_id` | string | - | Tenant identifier (default: "default") |
| `limit` | number | - | Maximum number of results (default: 5) |
| `min_similarity` | number | - | Minimum similarity threshold 0.0-1.0 (default: 0.5) |

**Example:**
```json
{
  "query": "database optimization techniques",
  "limit": 10,
  "min_similarity": 0.6
}
```

**Uses:** Local Qwen3 embedding model (1024 dimensions, free)

---

### `hybrid_search`

**Purpose:** Advanced search combining full-text search (keywords) AND vector embeddings (semantic meaning). Uses Reciprocal Rank Fusion (RRF) algorithm.

**When to use:**
- When you need both exact keyword matches AND conceptual understanding
- Best of both worlds: precise matching + semantic discovery
- Example: "database optimization" finds both exact matches and concepts like "performance tuning", "query speedup"

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `query` | string | ✅ | Search query (keywords and semantic meaning both considered) |
| `tenant_id` | string | - | Tenant identifier (default: "default") |
| `limit` | number | - | Maximum number of results (default: 5) |

---

### `recall`

**Purpose:** Universal semantic search across ALL your memory types using natural language.

**When to use:**
- Looking for past information, context, or patterns
- When you don't know which memory type contains the information
- Example: "what issues did we have with the visualizer?" finds relevant feedback, handoffs, and notes

**Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `query` | string | ✅ | Natural language search query |
| `tenant_id` | string | `"default"` | Tenant identifier |
| `types` | array | `["all"]` | Memory types to search: `agent_feedback`, `session_handoffs`, `knowledge_notes`, `capsules`, `semantic_memory`, `all` |
| `limit` | number | `5` | Maximum results per memory type |
| `min_similarity` | number | `0.5` | Minimum similarity threshold (0.0-1.0) |

**Example:**
```json
{
  "query": "problems we encountered with API integration",
  "types": ["agent_feedback", "session_handoffs"],
  "limit": 10
}
```

---

## Feedback Tools

Tools for reporting system issues and tracking improvements.

### `agent_feedback`

**Purpose:** Submit feedback about the system (friction points, bugs, suggestions, patterns, insights).

**When to use:**
- Experiencing friction or difficulty using tools
- Discovering bugs or broken behavior
- Having suggestions for improvements
- Observing patterns or insights about the system

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `category` | string | ✅ | Area of system: `memory_system`, `documentation`, `tools`, `workflow`, `other` |
| `type` | string | ✅ | Feedback type: `friction`, `bug`, `suggestion`, `pattern`, `insight` |
| `description` | string | ✅ | Clear description of the feedback |
| `tenant_id` | string | - | Tenant identifier (default: "default") |
| `severity` | string | - | Impact level: `low`, `medium`, `high`, `critical` |
| `reproduction` | string | - | Steps to reproduce (for bugs) |
| `project_path` | string | - | Working directory for scoped feedback retrieval |

**Example:**
```json
{
  "category": "tools",
  "type": "friction",
  "description": "Unclear when to use knowledge_note vs remember_note vs agent_feedback. Need decision tree.",
  "severity": "high"
}
```

---

### `get_agent_feedback`

**Purpose:** Retrieve agent feedback. Useful for reviewing what agents have reported about the system.

**When to use:**
- Reviewing reported issues and suggestions
- Checking open feedback items
- Monitoring system improvement areas

**Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `tenant_id` | string | `"default"` | Tenant identifier |
| `category` | string | - | Filter by category |
| `type` | string | - | Filter by feedback type |
| `status` | string | - | Filter by status: `open`, `reviewed`, `addressed`, `rejected` |
| `exclude_status` | string | - | Exclude feedback with this status (e.g., "addressed" to get unresolved issues) |
| `limit` | number | `50` | Maximum number to return |

**Common usage:**
```json
{
  "status": "open",
  "exclude_status": "addressed"
}
```

---

### `update_agent_feedback`

**Purpose:** Update the status of agent feedback items.

**When to use:**
- Issues have been addressed
- Feedback has been reviewed
- Marking items as rejected

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `feedback_id` | string | ✅ | Feedback ID to update |
| `status` | string | ✅ | New status: `open`, `reviewed`, `addressed`, `rejected` |
| `tenant_id` | string | - | Tenant identifier (default: "default") |

**Example:**
```json
{
  "feedback_id": "bbca19a50eb0c0c8f85e662704adac4e",
  "status": "addressed"
}
```

---

## Graph Tools

Tools for creating and managing typed relationships between content. Enables graph-based agent coordination and BBS + Kanban workflows.

### `create_edge`

**Purpose:** Create a typed edge (relationship) between two nodes. Enables graph-based connections between any content types.

**When to use:**
- Creating project/task hierarchies (`parent_of`)
- Linking tasks to dependencies (`depends_on`)
- Connecting tasks to findings (`created_by`)
- Cross-referencing related content (`references`)

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `from_node_id` | string | ✅ | Source node ID |
| `to_node_id` | string | ✅ | Target node ID |
| `type` | string | ✅ | Relationship type. Options: `parent_of`, `child_of`, `references`, `created_by`, `related_to`, `depends_on` |
| `properties` | object | ❌ | Optional metadata (status, priority, etc.) |
| `tenant_id` | string | ❌ | Tenant identifier (default: "default") |

**Features:**
- ✅ Validates both nodes exist before creating edge
- ✅ Detects circular dependencies for `depends_on` type
- ✅ Generates unique `edge_id` automatically

**Example - Create parent task:**
```json
{
  "from_node_id": "kn_project_abc",
  "to_node_id": "kn_task_xyz",
  "type": "parent_of",
  "properties": {
    "status": "todo",
    "priority": "high",
    "assigned_to": "agent-1"
  }
}
```

**Example - Create dependency:**
```json
{
  "from_node_id": "kn_task_b",
  "to_node_id": "kn_task_a",
  "type": "depends_on",
  "properties": {
    "reason": "Task A must complete before Task B starts"
  }
}
```

---

### `get_edges`

**Purpose:** Get all edges for a node, optionally filtered by direction and type.

**When to use:**
- Finding what a node connects to
- Discovering parent/child relationships
- Checking task dependencies

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `node_id` | string | ✅ | Node to get edges for |
| `direction` | string | ❌ | Edge direction. Options: `incoming`, `outgoing`, `both` (default: "both") |
| `type` | string | ❌ | Filter by relationship type |
| `tenant_id` | string | ❌ | Tenant identifier (default: "default") |

**Example - Get all tasks in a project:**
```json
{
  "node_id": "kn_project_abc",
  "direction": "outgoing",
  "type": "parent_of"
}
```

**Example - Get dependencies:**
```json
{
  "node_id": "kn_task_xyz",
  "direction": "outgoing",
  "type": "depends_on"
}
```

---

### `traverse`

**Purpose:** Traverse graph from a node following specific relationship type. Returns tree structure of connected nodes.

**When to use:**
- Finding all tasks in a project hierarchy
- Walking dependency chains
- Discovering related content through multiple hops

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `node_id` | string | ✅ | Starting node |
| `type` | string | ✅ | Relationship type to follow |
| `direction` | string | ✅ | Traversal direction. Options: `incoming`, `outgoing` |
| `depth` | number | ❌ | Max traversal depth (default: 2, max: 5) |
| `tenant_id` | string | ❌ | Tenant identifier (default: "default") |

**Features:**
- ✅ Prevents cycles using path arrays
- ✅ Returns flat list with depth information
- ✅ Configurable depth limit (max: 5)

**Example - Find all child tasks:**
```json
{
  "node_id": "kn_project_abc",
  "type": "parent_of",
  "direction": "outgoing",
  "depth": 3
}
```

**Example - Walk dependency chain:**
```json
{
  "node_id": "kn_task_c",
  "type": "depends_on",
  "direction": "incoming",
  "depth": 5
}
```

---

### `delete_edge`

**Purpose:** Delete an edge by ID. Use this to remove relationships between nodes.

**When to use:**
- Removing outdated relationships
- Cleaning up after task completion
- Reparenting nodes (delete old edge, create new one)

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `edge_id` | string | ✅ | Edge ID to delete |
| `tenant_id` | string | ❌ | Tenant identifier (default: "default") |

**Example:**
```json
{
  "edge_id": "edge_abc123..."
}
```

**Note:** Deleting nodes automatically triggers cleanup of associated edges via database triggers.

---

### `update_edge_properties`

**Purpose:** Update edge properties (JSONB merge with existing). Use this to update task status, priority, or other metadata.

**When to use:**
- Updating task status (todo → doing → done)
- Changing task priority
- Adding completion metadata

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `edge_id` | string | ✅ | Edge ID to update |
| `properties` | object | ✅ | Properties to merge with existing |
| `tenant_id` | string | ❌ | Tenant identifier (default: "default") |

**Features:**
- ✅ Merges with existing properties (doesn't replace)
- ✅ Auto-updates `updated_at` timestamp

**Example - Update task status:**
```json
{
  "edge_id": "edge_abc123...",
  "properties": {
    "status": "doing",
    "started_at": "2026-02-21T10:00:00Z"
  }
}
```

**Example - Mark task complete:**
```json
{
  "edge_id": "edge_abc123...",
  "properties": {
    "status": "done",
    "completed_at": "2026-02-21T11:00:00Z",
    "agent": "general-purpose-1"
  }
}
```

---

### `get_project_tasks`

**Purpose:** Get Kanban board view of project tasks. Returns tasks grouped by status (todo, doing, done).

**When to use:**
- Monitoring project progress
- Seeing what agents are working on
- Identifying blocked or overdue tasks

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `project_node_id` | string | ✅ | Project knowledge note's node_id |
| `status` | string | ❌ | Optional status filter. Options: `todo`, `doing`, `done` |
| `tenant_id` | string | ❌ | Tenant identifier (default: "default") |

**Features:**
- ✅ Groups tasks by status property
- ✅ Returns task details (title, tags, properties)
- ✅ Ordered by priority and creation date

**Example:**
```json
{
  "project_node_id": "kn_project_abc"
}
```

**Response:**
```json
{
  "success": true,
  "todo": [
    {
      "node_id": "kn_task_2",
      "title": "Implement backend API",
      "tags": ["task", "backend"],
      "properties": {
        "status": "todo",
        "priority": "high"
      }
    }
  ],
  "doing": [
    {
      "node_id": "kn_task_1",
      "title": "Create database schema",
      "tags": ["task", "database"],
      "properties": {
        "status": "doing",
        "priority": "high",
        "started_at": "2026-02-21T10:00:00Z"
      }
    }
  ],
  "done": [],
  "total": 2
}
```

---

### Graph Tool Patterns

#### Pattern 1: Project + Tasks + Agents

```javascript
// 1. Create project knowledge
const project = await create_knowledge_note({
  text: "# Build Feature X\n\nGoals: Implement user authentication...",
  tags: ["project", "feature-x"]
});

// 2. Create tasks
const task1 = await create_knowledge_note({
  text: "# Task: Database Schema\n\nAdd users table...",
  tags: ["task", "database"]
});

// 3. Link project → task
await create_edge({
  from_node_id: project.node_id,
  to_node_id: task1.node_id,
  type: "parent_of",
  properties: { status: "todo", priority: "high" }
});

// 4. Agent: On startup, find project and siblings
const parent = await traverse({
  node_id: task1.node_id,
  type: "child_of",
  direction: "incoming",
  depth: 1
});

const siblings = await traverse({
  node_id: parent.root.node_id,
  type: "parent_of",
  direction: "outgoing",
  depth: 1
});

// 5. Agent: Do work, create findings
const findings = await create_knowledge_note({
  text: "# Implementation\n\nCreated users table migration...",
  tags: ["findings", "database"]
});

await create_edge({
  from_node_id: task1.node_id,
  to_node_id: findings.node_id,
  type: "created_by",
  properties: { agent: "database-agent-1" }
});

// 6. Agent: Mark task complete
await update_edge_properties({
  edge_id: edgeId,
  properties: { status: "done", completed_at: new Date().toISOString() }
});

// 7. Main session: Get Kanban board
const board = await get_project_tasks({
  project_node_id: project.node_id
});
// Returns: { todo: [...], doing: [...], done: [task1], total: 3 }
```

#### Pattern 2: Task Dependencies

```javascript
// Task B depends on Task A
await create_edge({
  from_node_id: taskB.node_id,
  to_node_id: taskA.node_id,
  type: "depends_on",
  properties: { reason: "Needs database schema first" }
});

// Agent B: Check dependencies before starting
const deps = await get_edges({
  node_id: taskB.node_id,
  direction: "outgoing",
  type: "depends_on"
});

// Wait for dependencies to complete
for (const dep of deps.edges) {
  const depEdge = await get_edges({
    node_id: dep.to_node_id,
    direction: "incoming",
    type: "child_of"
  });

  while (depEdge.edges[0].properties.status !== "done") {
    await sleep(5000); // Poll every 5 seconds
  }
}

// Safe to start work
await update_edge_properties({
  edge_id: myTaskEdgeId,
  properties: { status: "doing" }
});
```

#### Pattern 3: Finding Related Work

```javascript
// Agent startup: Find context
// 1. Get parent project
const parent = await traverse({
  node_id: myTaskNodeId,
  type: "child_of",
  direction: "incoming",
  depth: 1
});

// 2. Get sibling tasks
const siblings = await traverse({
  node_id: parent.root.node_id,
  type: "parent_of",
  direction: "outgoing",
  depth: 1
});

// 3. Semantic search for related work
const related = await semantic_search({
  query: "database schema users table oauth",
  project_path: parent.root.content.project_path,
  limit: 5
});

// 4. Check what siblings created
const siblingFindings = await Promise.all(
  siblings.children.map(sibling =>
    traverse({
      node_id: sibling.node.node_id,
      type: "created_by",
      direction: "outgoing",
      depth: 1
    })
  )
);

// Agent now knows:
// - What project they're part of
// - What siblings are working on
// - What related work exists
// - What findings siblings produced
```

---

## System Tools

Tools for monitoring, health checks, and diagnostics.

### `compression_stats`

**Purpose:** Get memory compression statistics showing token savings from stratified loading.

**When to use:**
- Understanding memory system efficiency
- Seeing how much token budget you're saving
- Monitoring compression effectiveness

**Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `tenant_id` | string | `"default"` | Tenant identifier |

---

### `quick_reference`

**Purpose:** Get quick reference summary for common topics. Faster than reading entire SOURCES_OF_TRUTH.md.

**When to use:**
- Quick lookup of project-specific information
- Pre-implementation checklists
- Common task patterns

**Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `topic` | string | Topic to get reference for: `pre_implementation_checklist`, `mcp_tools`, `common_tasks`, `project_structure`, `troubleshooting`, `database_schema` |

---

### `next_actions`

**Purpose:** Get prioritized next actions based on open feedback. Shows priority, estimated effort, and specific actions.

**When to use:**
- Deciding what to work on next
- Maintaining focus on high-impact improvements
- Tracking system progress

**Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `tenant_id` | string | `"default"` | Tenant identifier |
| `limit` | number | `5` | Maximum number of actions to return |

---

### `system_health`

**Purpose:** Get system health summary including feedback stats, activity metrics, and overall health status.

**When to use:**
- Monitoring system state
- Checking open vs addressed feedback
- Assessing overall system quality

**Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `tenant_id` | string | `"default"` | Tenant identifier |

**Returns:**
- Total feedback count
- Open/addressed counts
- Health status: `good`, `fair`, `needs_attention`
- Activity metrics (handoffs in last 7 days)

---

### `list_tools`

**Purpose:** List all available Memory System tools with descriptions and usage information.

**When to use:**
- Discovering what tools are available
- Getting tool descriptions
- Filtering tools by category

**Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `category` | string | Filter tools by category: `memory`, `search`, `feedback`, `system` |

**Categories:**
- **memory** (11 tools): `wake_up`, `create_handoff`, `get_last_handoff`, `get_identity_thread`, `list_handoffs`, `create_knowledge_note`, `get_knowledge_notes`, `remember_note`, `list_semantic_principles`, `create_capsule`, `get_capsules`
- **search** (3 tools): `semantic_search`, `hybrid_search`, `recall`
- **feedback** (3 tools): `agent_feedback`, `get_agent_feedback`, `update_agent_feedback`
- **system** (5 tools): `compression_stats`, `quick_reference`, `next_actions`, `system_health`, `list_tools`

---

## HTTP Endpoints

### POST /mcp
Main MCP endpoint for JSON-RPC 2.0 requests.

### GET /health
Health check endpoint.

### GET /tools
List all available tools in JSON format (browser-friendly).

---

## Usage Decision Tree

```
Need to save information?
├─ Session ending → create_handoff
├─ Quick thought → remember_note
├─ Important knowledge → create_knowledge_note
└─ System feedback → agent_feedback

Need to find information?
├─ Don't know which memory type → recall (searches all)
├─ Specific memory type → get_knowledge_notes, list_handoffs, etc.
├─ Conceptual search → semantic_search
└─ Keywords + concepts → hybrid_search

Need system info?
├─ Health status → system_health
├─ Next priorities → next_actions
├─ Open issues → get_agent_feedback
└─ Available tools → list_tools
```

---

## Quick Reference

| Goal | Tool |
|------|------|
| Start session | `wake_up` |
| End session | `create_handoff` |
| Quick note | `remember_note` |
| Knowledge note | `create_knowledge_note` |
| Report bug | `agent_feedback` |
| Find anything | `recall` |
| System health | `system_health` |
| Next actions | `next_actions` |

---

**Total Tools: 22**
**Last Updated:** 2026-02-20
**Server Version:** 2.0.0
