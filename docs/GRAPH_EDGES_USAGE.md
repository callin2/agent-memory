# Graph Edges System - Usage Guide

**Version**: 1.0
**Date**: 2026-02-21
**Status**: Production Ready

---

## Overview

The Graph Edges System enables agents to "see together and think together" by creating typed relationships between any content in memory. This prevents lost insights, redundant work, and enables coordinated multi-agent workflows.

**Key Concepts:**
- **Nodes**: Any content (knowledge notes, tasks, feedback, capsules) with a `node_id`
- **Edges**: Typed relationships between nodes (parent_of, references, created_by, etc.)
- **Properties**: Metadata attached to edges (status, priority, etc.)
- **Traversal**: Walking the graph to find connected nodes

---

## Edge Types

### 1. `parent_of` / `child_of`
**Purpose**: Hierarchical relationships (project → tasks, task → subtasks)

**When to use:**
- Creating project/task hierarchies
- Organizing work breakdowns
- Defining containment relationships

**Example:**
```json
{
  "from_node_id": "kn_project_abc",
  "to_node_id": "kn_task_xyz",
  "type": "parent_of",
  "properties": {
    "status": "todo",
    "priority": "high"
  }
}
```

### 2. `references`
**Purpose**: Cross-references between related items

**When to use:**
- A task references a knowledge note for context
- A finding cites another finding
- Loose associations between related content

**Example:**
```json
{
  "from_node_id": "kn_task_implementation",
  "to_node_id": "kn_design_doc",
  "type": "references",
  "properties": {
    "strength": 0.9,
    "context": "builds on this design"
  }
}
```

### 3. `created_by`
**Purpose**: Attribution (agent creates findings, tasks produce results)

**When to use:**
- Agent completes a task and produces findings
- Task generates output
- Tracking who/what created what

**Example:**
```json
{
  "from_node_id": "kn_task_123",
  "to_node_id": "kn_findings_456",
  "type": "created_by",
  "properties": {
    "agent": "general-purpose-1",
    "completed_at": "2026-02-21T10:00:00Z"
  }
}
```

### 4. `related_to`
**Purpose**: Loose associations

**When to use:**
- Items are thematically related but no hierarchy
- Cross-linking similar concepts
- Optional: Use for "see also" relationships

### 5. `depends_on`
**Purpose**: Task dependencies

**When to use:**
- Task B cannot start until Task A completes
- Prerequisite relationships
- **Automatically detects circular dependencies**

**Example:**
```json
{
  "from_node_id": "kn_task_b",
  "to_node_id": "kn_task_a",
  "type": "depends_on",
  "properties": {}
}
```

---

## MCP Tools

### create_edge
Create a relationship between two nodes.

**Usage:**
```bash
curl -X POST http://localhost:4000/mcp \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer test-mcp-token" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/call",
    "params": {
      "name": "create_edge",
      "arguments": {
        "from_node_id": "kn_project_abc",
        "to_node_id": "kn_task_xyz",
        "type": "parent_of",
        "properties": {"status": "todo", "priority": "high"}
      }
    }
  }'
```

**Response:**
```json
{
  "success": true,
  "edge": {
    "edge_id": "edge_abc123...",
    "from_node_id": "kn_project_abc",
    "to_node_id": "kn_task_xyz",
    "type": "parent_of",
    "properties": {"status": "todo", "priority": "high"},
    "tenant_id": "default",
    "created_at": "2026-02-21T10:00:00Z"
  }
}
```

**Features:**
- ✅ Validates both nodes exist
- ✅ Detects circular dependencies for 'depends_on' edges
- ✅ Generates unique edge_id automatically

### get_edges
Retrieve edges for a node.

**Usage:**
```bash
curl -X POST http://localhost:4000/mcp \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer test-mcp-token" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/call",
    "params": {
      "name": "get_edges",
      "arguments": {
        "node_id": "kn_project_abc",
        "direction": "outgoing",
        "type": "parent_of"
      }
    }
  }'
```

**Parameters:**
- `node_id`: Node to query
- `direction`: "incoming" | "outgoing" | "both" (default: "both")
- `type`: Optional edge type filter

### traverse
Walk the graph from a node.

**Usage:**
```bash
curl -X POST http://localhost:4000/mcp \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer test-mcp-token" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/call",
    "params": {
      "name": "traverse",
      "arguments": {
        "node_id": "kn_project_abc",
        "type": "parent_of",
        "direction": "outgoing",
        "depth": 2
      }
    }
  }'
```

**Response:**
```json
{
  "success": true,
  "root": {"node_type": "knowledge_note", "node_id": "kn_project_abc"},
  "children": [
    {
      "node": {"node_id": "kn_task_1"},
      "edge": {"type": "parent_of", "properties": {"status": "doing"}},
      "depth": 1
    }
  ],
  "total_found": 1
}
```

**Features:**
- ✅ Prevents cycles using path arrays
- ✅ Configurable depth (max: 5)
- ✅ Returns flat list with depth info

### delete_edge
Remove an edge.

**Usage:**
```bash
curl -X POST http://localhost:4000/mcp \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer test-mcp-token" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/call",
    "params": {
      "name": "delete_edge",
      "arguments": {
        "edge_id": "edge_abc123..."
      }
    }
  }'
```

### update_edge_properties
Update edge metadata (JSONB merge).

**Usage:**
```bash
curl -X POST http://localhost:4000/mcp \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer test-mcp-token" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/call",
    "params": {
      "name": "update_edge_properties",
      "arguments": {
        "edge_id": "edge_abc123...",
        "properties": {
          "status": "done",
          "completed_at": "2026-02-21T11:00:00Z"
        }
      }
    }
  }'
```

**Features:**
- ✅ Merges with existing properties (doesn't replace)
- ✅ Auto-updates `updated_at` timestamp

### get_project_tasks
Kanban board view (tasks grouped by status).

**Usage:**
```bash
curl -X POST http://localhost:4000/mcp \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer test-mcp-token" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/call",
    "params": {
      "name": "get_project_tasks",
      "arguments": {
        "project_node_id": "kn_project_abc"
      }
    }
  }'
```

**Response:**
```json
{
  "success": true,
  "todo": [
    {"node_id": "kn_task_2", "title": "Task 2", "properties": {"status": "todo"}}
  ],
  "doing": [
    {"node_id": "kn_task_1", "title": "Task 1", "properties": {"status": "doing"}}
  ],
  "done": [],
  "total": 2
}
```

---

## Agent Coordination Pattern

### BBS + Kanban Approach

The graph edges system enables agents to coordinate like teammates using a shared workspace:

**BBS (Bulletin Board System)**: Agents post findings to knowledge notes
**Kanban**: Task status tracked in edge properties

### Agent Workflow

#### 1. Main Session Setup
```typescript
// Create project knowledge note
const project = await create_knowledge_note({
  text: "# Build Graph System\n\nGoals: Add edges for agent coordination...",
  tags: ["graph-system", "edges"],
  project_path: "/path/to/project"
});

// Create task definition
const task1 = await create_knowledge_note({
  text: "# Task: Implement edges table",
  tags: ["task", "database"]
});

// Link: project → task
await create_edge({
  from_node_id: project.node_id,
  to_node_id: task1.node_id,
  type: "parent_of",
  properties: { status: "todo", priority: "high" }
});
```

#### 2. Agent Launch
```typescript
await Task({
  subagent_type: "general-purpose",
  prompt: `
You are implementing the edges table.

AGENT INITIALIZATION:
1. Your task node_id: ${task1.node_id}
2. Traverse to find parent: traverse('${task1.node_id}', 'child_of', 'incoming', depth=1)
3. Read parent project knowledge
4. Find sibling tasks: traverse(parent, 'parent_of', 'outgoing', depth=1)
5. Semantic search for context: 'edges, node_id, graph database'

WORKFLOW:
- Do the work
- Create findings note
- Create edge: task → findings (type='created_by')
- Update edge status: todo → doing → done
`
});
```

#### 3. Agent Initialization (on startup)
```typescript
async function agentInit(taskNodeId) {
  // Find parent project
  const parentResult = await traverse({
    node_id: taskNodeId,
    type: "child_of",
    direction: "incoming",
    depth: 1
  });
  const projectId = parentResult.root.node_id;

  // Read project knowledge
  const project = await resolve_node(projectId);

  // Find sibling tasks
  const siblings = await traverse({
    node_id: projectId,
    type: "parent_of",
    direction: "outgoing",
    depth: 1
  });

  // Semantic search for related work
  const related = await semantic_search({
    query: "edges graph database",
    project_path: project.project_path
  });

  // Update my status to 'doing'
  const myEdges = await get_edges({
    node_id: taskNodeId,
    direction: "incoming",
    type: "child_of"
  });
  await update_edge_properties({
    edge_id: myEdges.edges[0].edge_id,
    properties: { status: "doing", started_at: new Date().toISOString() }
  });

  return { project, siblings, related };
}
```

#### 4. Agent Work & Completion
```typescript
// Do the work
const findings = await implementEdgesTable();

// Create findings note
const findingsNote = await create_knowledge_note({
  text: "# Edges Table Implementation\n\nCreated migration 037...",
  tags: ["implementation", "edges"]
});

// Link: task → findings
await create_edge({
  from_node_id: taskNodeId,
  to_node_id: findingsNote.node_id,
  type: "created_by",
  properties: { agent: "general-purpose-1" }
});

// Mark task as done
await update_edge_properties({
  edge_id: myEdge.edge_id,
  properties: { status: "done", completed_at: new Date().toISOString() }
});
```

#### 5. Main Session Monitoring
```typescript
// Get Kanban board
const board = await get_project_tasks({
  project_node_id: project.node_id
});
// Returns: { todo: [...], doing: [...], done: [...], total: 3 }

// Get all findings
const results = await traverse({
  node_id: project.node_id,
  type: "created_by",
  direction: "outgoing",
  depth: 2
});
// Returns tree of all tasks and their findings
```

---

## Example: Multi-Agent Project Workflow

### Scenario: Build a feature with 3 agents

```typescript
// ===== MAIN SESSION =====

// 1. Create project knowledge
const project = await create_knowledge_note({
  text: "# Feature: User Authentication\n\nImplement OAuth2 login with Google and GitHub",
  tags: ["feature", "auth", "oauth2"],
  project_path: "/path/to/project"
});

// 2. Create 3 tasks
const taskDatabase = await create_knowledge_note({
  text: "# Task: Database Schema\n\nAdd users table with OAuth credentials",
  tags: ["task", "database"]
});

const taskBackend = await create_knowledge_note({
  text: "# Task: Backend API\n\nImplement OAuth endpoints",
  tags: ["task", "backend"]
});

const taskFrontend = await create_knowledge_note({
  text: "# Task: Frontend UI\n\nCreate login form and callback handlers",
  tags: ["task", "frontend"]
});

// 3. Link tasks to project
for (const task of [taskDatabase, taskBackend, taskFrontend]) {
  await create_edge({
    from_node_id: project.node_id,
    to_node_id: task.node_id,
    type: "parent_of",
    properties: { status: "todo", priority: "high" }
  });
}

// 4. Create dependency: backend → database
await create_edge({
  from_node_id: taskBackend.node_id,
  to_node_id: taskDatabase.node_id,
  type: "depends_on",
  properties: { reason: "Needs users table first" }
});

// 5. Launch 3 agents in parallel
const agents = await Promise.all([
  launchAgent({ taskNodeId: taskDatabase.node_id, projectName: "OAuth Database" }),
  launchAgent({ taskNodeId: taskBackend.node_id, projectName: "OAuth Backend" }),
  launchAgent({ taskNodeId: taskFrontend.node_id, projectName: "OAuth Frontend" })
]);

// 6. Wait for completion
await Promise.all(agents);

// 7. Check results
const board = await get_project_tasks({
  project_node_id: project.node_id
});
// All 3 tasks should be in "done" status

const findings = await traverse({
  node_id: project.node_id,
  type: "created_by",
  direction: "outgoing",
  depth: 2
});
// See all 3 tasks and their implementation findings
```

### What Each Agent Does

**Agent 1 (Database)**:
1. On startup: Finds project, sees 2 sibling tasks (backend, frontend)
2. Semantic search: Finds existing database schema patterns
3. Creates users table migration
4. Creates findings note with migration SQL
5. Creates edge: task → findings (created_by)
6. Updates status: todo → doing → done

**Agent 2 (Backend)**:
1. On startup: Finds project, sees dependency on database task
2. Waits for database task status = "done"
3. Semantic search: Finds OAuth implementation patterns
4. Implements /auth/google, /auth/github endpoints
5. Creates findings note with API code
6. Creates edge: task → findings (created_by)
7. Updates status: todo → doing → done

**Agent 3 (Frontend)**:
1. On startup: Finds project, sees sibling tasks
2. Semantic search: Finds UI component patterns
3. Creates login form component
4. Creates findings note with React code
5. Creates edge: task → findings (created_by)
6. Updates status: todo → doing → done

**Result**: 3 agents work independently, see each other's progress, avoid duplication, produce coordinated output.

---

## Best Practices

### 1. Always Create Project Knowledge First
```typescript
// ✅ Good: Create project root
const project = await create_knowledge_note({ text: "# Project\n..." });
const task = await create_knowledge_note({ text: "# Task\n..." });
await create_edge({ from_node_id: project.node_id, to_node_id: task.node_id, type: "parent_of" });

// ❌ Bad: Floating task with no parent
const task = await create_knowledge_note({ text: "# Task\n..." });
// No way to find this task in a multi-project context
```

### 2. Use Status Properties for Kanban
```typescript
// ✅ Good: Track status in edge properties
await create_edge({
  from_node_id: project.node_id,
  to_node_id: task.node_id,
  type: "parent_of",
  properties: {
    status: "doing",  // todo | doing | done
    priority: "high",  // high | medium | low
    started_at: "2026-02-21T10:00:00Z"
  }
});

// Then query with get_project_tasks() for Kanban view
```

### 3. Create Findings Notes
```typescript
// ✅ Good: Agent produces findings
const findings = await create_knowledge_note({
  text: "# Implementation Results\n\n- Created migration\n- Added indexes...",
  tags: ["findings", "database"]
});

await create_edge({
  from_node_id: task.node_id,
  to_node_id: findings.node_id,
  type: "created_by",
  properties: { agent: "database-agent-1" }
});
```

### 4. Prevent Circular Dependencies
```typescript
// The system prevents this automatically:
await create_edge({ from: A, to: B, type: "depends_on" });  // ✅ OK
await create_edge({ from: B, to: A, type: "depends_on" });  // ❌ Error: Circular dependency!
```

### 5. Use Semantic Search + Edges Together
```typescript
// Agent startup pattern:
const siblings = await traverse({ node_id: parent, type: "parent_of", depth: 1 });
const relatedWork = await semantic_search({ query: "edges graph database" });
// Agent now knows: what siblings are working on + what related work exists
```

---

## Troubleshooting

### Error: "Source node not found"
**Cause**: `from_node_id` doesn't exist in any table

**Solution**:
```bash
# Check if node exists
SELECT * FROM resolve_node('kn_abc123...', 'default');

# If not found, create the node first or check the ID
```

### Error: "Circular dependency detected"
**Cause**: Creating `depends_on` edge that would create a cycle

**Solution**:
```bash
# Check existing dependencies
SELECT * FROM edges WHERE type = 'depends_on';

# Remove the conflicting edge
DELETE FROM edges WHERE edge_id = 'edge_xyz';
```

### Edge not found in delete_edge
**Cause**: Wrong edge_id or already deleted

**Solution**:
```bash
# Find correct edge_id
SELECT * FROM edges
WHERE from_node_id = 'kn_abc' AND to_node_id = 'kn_xyz' AND type = 'parent_of';
```

---

## Performance

### Indexes
The edges table has 7 indexes for fast queries:
- `idx_edges_from`: Outgoing edges lookup
- `idx_edges_to`: Incoming edges lookup
- `idx_edges_from_type`: Outgoing by type
- `idx_edges_to_type`: Incoming by type
- `idx_edges_properties`: GIN index for JSONB queries
- `idx_edges_graph`: Composite for full graph queries
- `idx_edges_tenant`: Tenant-scoped queries

### Query Performance
- `create_edge`: ~5-10ms (includes node validation)
- `get_edges`: ~5ms (indexed lookup)
- `traverse`: ~10-50ms depending on depth (recursive CTE)
- `delete_edge`: ~5ms
- `update_edge_properties`: ~5ms
- `get_project_tasks`: ~10-20ms

---

## See Also

- **Design Document**: `docs/plans/2026-02-21-graph-edges-design.md`
- **Database Schema**: `src/db/migrations/036_add_node_id_columns.sql`, `src/db/migrations/037_create_edges_table.sql`
- **MCP Tools**: `src/mcp/memory-server-http.ts` (search for "create_edge")
- **Test Script**: `test-edge-tools.sh`

---

**Generated for**: Memory System v2.0
**Authors**: Thread & Callin
**Date**: 2026-02-21
