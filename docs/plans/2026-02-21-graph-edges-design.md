# Graph Edges System - Design Document

**Date**: 2026-02-21
**Author**: Thread & Callin
**Status**: Design Complete - Ready for Implementation
**Branch**: `feature/graph-edges-system`

---

## Overview

**Goal**: Enable agents to "see together and think together" by sharing discoveries through memory, preventing lost insights and redundant work.

**Problem**: When multiple agents work on a project:
- **Lost insights**: Agent A discovers X, Agent B wastes time rediscovering X (doesn't know about A's finding)
- **Lost focus**: Agents wander off-task or duplicate work because they lack clear direction and awareness of what others are doing

**Solution**: Add graph-based relationships to the memory system, allowing ANY content (handoffs, knowledge notes, tasks, capsules) to be linked with typed edges. Use BBS + Kanban pattern for agent coordination.

---

## Architecture

### System Components

1. **Edges table** - New PostgreSQL table storing relationships between any two content items
   - Each edge has: from_id, to_id, type (parent_of, references, etc.), properties (JSONB)
   - Indexed for fast traversal in both directions

2. **MCP tools** - 6 tools for edge management:
   - `create_edge` - Link items together
   - `get_edges` - Get all edges for an item
   - `traverse` - Walk the graph (find parents, children, dependencies)
   - `delete_edge` - Remove relationships
   - `update_edge_properties` - Update edge metadata (like task status)
   - `get_project_tasks` - Get Kanban board view

3. **Agent coordination pattern** - BBS + Kanban approach:
   - Agents post findings to knowledge notes (BBS posts)
   - Agents create edges from tasks to findings (links)
   - Status tracked in edge properties (Kanban: todo → doing → done)
   - At startup, agents query edges to find parent + siblings, then semantic search for context

### System Flow

```
1. Main session creates/updates "project knowledge" note
   - Brief project info, goals, context
   - Tagged with project_path

2. Main session creates task-1

3. Main session creates edge:
   project_knowledge --[parent_of]--> task_1

4. Launch Agent A with:
   - Agent's specific prompt (what this agent should do)
   - Project's default prompt (context for all agents on this project)

5. Agent A initialization:
   - Traverse edges: task_1 --[child_of]--> project_knowledge
   - Read project knowledge note
   - Semantic search: project_path + tags to find related knowledge
   - Check sibling tasks (other children of project_knowledge)

6. Agent A works:
   - Writes findings to knowledge note
   - Creates edge: task_1 --[created_by]--> findings_note
   - Updates edge property: status = "done"

7. Main session queries:
   - traverse(project_knowledge, "parent_of") → see all tasks
   - Check edge.status → Kanban board (todo/doing/done)
```

**Project knowledge note serves as:**
- Root anchor for all project tasks
- Central context hub (goals, constraints, links)
- Entry point for agents joining the project
- Kanban board source (traverse to get all tasks)

---

## Database Schema

### Step 1: Add `node_id` to Existing Tables

**Migration**: `src/db/migrations/036_add_node_id_columns.sql`

```sql
-- Add universal node_id to all content tables
ALTER TABLE handoffs ADD COLUMN node_id TEXT UNIQUE;
ALTER TABLE knowledge_notes ADD COLUMN node_id TEXT UNIQUE;
ALTER TABLE agent_feedback ADD COLUMN node_id TEXT UNIQUE;
ALTER TABLE capsules ADD COLUMN node_id TEXT UNIQUE;
ALTER TABLE semantic_memory ADD COLUMN node_id TEXT UNIQUE;

-- For tasks table (already exists from task management)
ALTER TABLE tasks ADD COLUMN node_id TEXT UNIQUE;

-- Migrate existing data: node_id = existing ID
UPDATE handoffs SET node_id = handoff_id WHERE node_id IS NULL;
UPDATE knowledge_notes SET node_id = note_id WHERE node_id IS NULL;
UPDATE agent_feedback SET node_id = feedback_id WHERE node_id IS NULL;
UPDATE capsules SET node_id = capsule_id WHERE node_id IS NULL;
UPDATE semantic_memory SET node_id = semantic_id WHERE node_id IS NULL;
UPDATE tasks SET node_id = task_id WHERE node_id IS NULL;

-- Add NOT NULL constraint after migration
ALTER TABLE handoffs ALTER COLUMN node_id SET NOT NULL;
ALTER TABLE knowledge_notes ALTER COLUMN node_id SET NOT NULL;
ALTER TABLE agent_feedback ALTER COLUMN node_id SET NOT NULL;
ALTER TABLE capsules ALTER COLUMN node_id SET NOT NULL;
ALTER TABLE semantic_memory ALTER COLUMN node_id SET NOT NULL;
ALTER TABLE tasks ALTER COLUMN node_id SET NOT NULL;

-- Create unique indexes
CREATE UNIQUE INDEX idx_handoffs_node_id ON handoffs(node_id);
CREATE UNIQUE INDEX idx_knowledge_notes_node_id ON knowledge_notes(node_id);
CREATE UNIQUE INDEX idx_feedback_node_id ON agent_feedback(node_id);
CREATE UNIQUE INDEX idx_capsules_node_id ON capsules(node_id);
CREATE UNIQUE INDEX idx_semantic_memory_node_id ON semantic_memory(node_id);
CREATE UNIQUE INDEX idx_tasks_node_id ON tasks(node_id);
```

### Step 2: Create Edges Table

**Migration**: `src/db/migrations/037_create_edges_table.sql`

```sql
CREATE TABLE edges (
  edge_id TEXT PRIMARY KEY,
  from_node_id TEXT NOT NULL,
  to_node_id TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN (
    'parent_of', 'child_of',
    'references', 'created_by',
    'related_to', 'depends_on'
  )),
  properties JSONB DEFAULT '{}',
  tenant_id TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for fast traversal
CREATE INDEX idx_edges_from ON edges(from_node_id, tenant_id);
CREATE INDEX idx_edges_to ON edges(to_node_id, tenant_id);
CREATE INDEX idx_edges_from_type ON edges(from_node_id, type, tenant_id);
CREATE INDEX idx_edges_to_type ON edges(to_node_id, type, tenant_id);
CREATE INDEX idx_edges_tenant ON edges(tenant_id);
CREATE INDEX idx_edges_graph ON edges(from_node_id, to_node_id, type, tenant_id);

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_edges_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER edges_update_timestamp
BEFORE UPDATE ON edges
FOR EACH ROW
EXECUTE FUNCTION update_edges_updated_at();
```

### Step 3: Helper Functions

**Function: Resolve Node**
```sql
CREATE OR REPLACE FUNCTION resolve_node(p_node_id TEXT, p_tenant_id TEXT DEFAULT 'default')
RETURNS TABLE(
  node_type TEXT,
  node_id TEXT,
  content JSONB
) AS $$
BEGIN
  -- Try handoffs
  RETURN QUERY
  SELECT 'handoff'::TEXT, h.node_id, to_jsonb(h)
  FROM handoffs h
  WHERE h.node_id = p_node_id
    AND h.tenant_id = p_tenant_id;

  IF FOUND THEN RETURN; END IF;

  -- Try knowledge_notes
  RETURN QUERY
  SELECT 'knowledge_note'::TEXT, kn.node_id, to_jsonb(kn)
  FROM knowledge_notes kn
  WHERE kn.node_id = p_node_id
    AND kn.tenant_id = p_tenant_id;

  IF FOUND THEN RETURN; END IF;

  -- Try agent_feedback
  RETURN QUERY
  SELECT 'feedback'::TEXT, af.node_id, to_jsonb(af)
  FROM agent_feedback af
  WHERE af.node_id = p_node_id
    AND af.tenant_id = p_tenant_id;

  IF FOUND THEN RETURN; END IF;

  -- Try capsules
  RETURN QUERY
  SELECT 'capsule'::TEXT, c.node_id, to_jsonb(c)
  FROM capsules c
  WHERE c.node_id = p_node_id
    AND c.capsule_id = p_node_id;

  IF FOUND THEN RETURN; END IF;

  -- Try semantic_memory
  RETURN QUERY
  SELECT 'semantic_memory'::TEXT, sm.node_id, to_jsonb(sm)
  FROM semantic_memory sm
  WHERE sm.node_id = p_node_id
    AND sm.semantic_id = p_node_id;

  IF FOUND THEN RETURN; END IF;

  -- Try tasks
  RETURN QUERY
  SELECT 'task'::TEXT, t.node_id, to_jsonb(t)
  FROM tasks t
  WHERE t.node_id = p_node_id
    AND t.tenant_id = p_tenant_id;
END;
$$ LANGUAGE plpgsql STABLE;
```

**Function: Detect Circular Dependencies**
```sql
CREATE OR REPLACE FUNCTION detect_dependency_cycle(from_id TEXT, to_id TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  has_cycle BOOLEAN := FALSE;
BEGIN
  WITH RECURSIVE dep_chain AS (
    SELECT to_id AS node_id, 1 AS depth
    FROM edges
    WHERE from_node_id = to_id AND type = 'depends_on'
    UNION ALL
    SELECT e.to_node_id, dc.depth + 1
    FROM edges e
    JOIN dep_chain dc ON e.from_node_id = dc.node_id
    WHERE e.type = 'depends_on' AND dc.depth < 10
  )
  SELECT EXISTS(SELECT 1 FROM dep_chain WHERE node_id = from_id) INTO has_cycle;
  RETURN has_cycle;
END;
$$ LANGUAGE plpgsql STABLE;
```

**Function: Cleanup Orphaned Edges**
```sql
CREATE OR REPLACE FUNCTION cleanup_orphaned_edges()
RETURNS TRIGGER AS $$
BEGIN
  DELETE FROM edges
  WHERE from_node_id = OLD.node_id OR to_node_id = OLD.node_id;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- Add triggers for all tables
CREATE TRIGGER handoff_cleanup_edges
BEFORE DELETE ON handoffs
FOR EACH ROW
EXECUTE FUNCTION cleanup_orphaned_edges();

CREATE TRIGGER knowledge_note_cleanup_edges
BEFORE DELETE ON knowledge_notes
FOR EACH ROW
EXECUTE FUNCTION cleanup_orphaned_edges();

CREATE TRIGGER feedback_cleanup_edges
BEFORE DELETE ON agent_feedback
FOR EACH ROW
EXECUTE FUNCTION cleanup_orphaned_edges();

CREATE TRIGGER capsule_cleanup_edges
BEFORE DELETE ON capsules
FOR EACH ROW
EXECUTE FUNCTION cleanup_orphaned_edges();

CREATE TRIGGER task_cleanup_edges
BEFORE DELETE ON tasks
FOR EACH ROW
EXECUTE FUNCTION cleanup_orphaned_edges();
```

---

## MCP Tools

### 1. create_edge
Creates a relationship between two nodes.

```typescript
{
  name: "create_edge",
  description: "Create a typed edge (relationship) between two nodes",
  inputSchema: {
    type: "object",
    properties: {
      from_node_id: {
        type: "string",
        description: "Source node ID"
      },
      to_node_id: {
        type: "string",
        description: "Target node ID"
      },
      type: {
        type: "string",
        enum: ["parent_of", "child_of", "references", "created_by", "related_to", "depends_on"],
        description: "Relationship type"
      },
      properties: {
        type: "object",
        description: "Optional metadata (status, priority, etc.)"
      }
    },
    required: ["from_node_id", "to_node_id", "type"]
  }
}
```

**Implementation:**
- Validate both nodes exist (using `resolve_node`)
- If type is 'depends_on', check for circular dependencies
- Generate `edge_id` = `edge_<uuid>`
- Insert into edges table
- Return created edge

### 2. get_edges
Retrieves all edges for a node (incoming, outgoing, or both).

```typescript
{
  name: "get_edges",
  description: "Get all edges for a node, optionally filtered by direction and type",
  inputSchema: {
    type: "object",
    properties: {
      node_id: {
        type: "string",
        description: "Node to get edges for"
      },
      direction: {
        type: "string",
        enum: ["incoming", "outgoing", "both"],
        default: "both",
        description: "Edge direction relative to node"
      },
      type: {
        type: "string",
        description: "Filter by relationship type (optional)"
      }
    },
    required: ["node_id"]
  }
}
```

**Returns:** Array of edges with resolved node info (node_type, basic metadata)

### 3. traverse
Graph traversal - find connected nodes up to depth N.

```typescript
{
  name: "traverse",
  description: "Traverse graph from a node following specific relationship type",
  inputSchema: {
    type: "object",
    properties: {
      node_id: {
        type: "string",
        description: "Starting node"
      },
      type: {
        type: "string",
        description: "Relationship type to follow"
      },
      direction: {
        type: "string",
        enum: ["incoming", "outgoing"],
        description: "Traversal direction"
      },
      depth: {
        type: "number",
        default: 2,
        maximum: 5,
        description: "Max traversal depth"
      }
    },
    required: ["node_id", "type", "direction"]
  }
}
```

**Returns:** Tree structure:
```json
{
  "root": { "node_id": "...", "node_type": "handoff", "content": {...} },
  "children": [
    {
      "node": { "node_id": "...", "node_type": "knowledge_note" },
      "edge": { "edge_id": "...", "type": "parent_of", "properties": {...} },
      "children": [...]
    }
  ]
}
```

**Implementation:** Recursive CTE to walk graph

### 4. delete_edge
Remove an edge by ID.

```typescript
{
  name: "delete_edge",
  description: "Delete an edge by ID",
  inputSchema: {
    type: "object",
    properties: {
      edge_id: {
        type: "string",
        description: "Edge ID to delete"
      }
    },
    required: ["edge_id"]
  }
}
```

### 5. update_edge_properties
Update edge metadata (e.g., task status).

```typescript
{
  name: "update_edge_properties",
  description: "Update edge properties (JSONB merge)",
  inputSchema: {
    type: "object",
    properties: {
      edge_id: {
        type: "string",
        description: "Edge ID to update"
      },
      properties: {
        type: "object",
        description: "Properties to merge with existing"
      }
    },
    required: ["edge_id", "properties"]
  }
}
```

**Implementation:** `properties = properties || $2::jsonb` (JSONB merge)

### 6. get_project_tasks
Get all tasks for a project with their status (Kanban board).

```typescript
{
  name: "get_project_tasks",
  description: "Get Kanban board view of project tasks",
  inputSchema: {
    type: "object",
    properties: {
      project_node_id: {
        type: "string",
        description: "Project knowledge note's node_id"
      },
      status: {
        type: "string",
        enum: ["todo", "doing", "done"],
        description: "Optional status filter"
      }
    },
    required: ["project_node_id"]
  }
}
```

**Returns:** Tasks grouped by status
```json
{
  "todo": [{ "node_id": "...", "title": "...", "priority": "high" }],
  "doing": [...],
  "done": [...]
}
```

**Implementation:**
1. Traverse from project_node_id with type="parent_of", direction="outgoing"
2. Return tasks grouped by status (from edge.properties.status)

---

## Agent Workflow

### Phase 1: Main Session Setup

```typescript
// 1. Create/update project knowledge note
const projectNote = await create_knowledge_note({
  text: "# Project Memory System\n\nGoals: Add graph-based edges for agent coordination...",
  tags: ["memory-system", "edges", "agent-coordination"],
  project_path: "/Users/callin/Callin_Project/agent_memory_v2"
});
// projectNote.node_id = "kn_abc123..."

// 2. Create task definition (knowledge note)
const taskNote = await create_knowledge_note({
  text: "# Task: Implement edges table\n\n- Create migration 037\n- Add node_id columns...",
  tags: ["task", "database", "migration"]
});
// taskNote.node_id = "kn_def456..."

// 3. Create edge: project → task
await create_edge({
  from_node_id: projectNote.node_id,
  to_node_id: taskNote.node_id,
  type: "parent_of",
  properties: {
    status: "todo",
    priority: "high",
    created_at: "2026-02-21T10:00:00Z"
  }
});
```

### Phase 2: Agent Launch

```typescript
// Launch agent with context
await Task({
  subagent_type: "general-purpose",
  prompt: `
You are implementing the edges table for agent coordination.

AGENT INITIALIZATION:
1. Your task node_id: ${taskNote.node_id}
2. Traverse to find parent project: traverse('${taskNote.node_id}', 'child_of', 'incoming', depth=1)
3. Read parent project knowledge note
4. Find sibling tasks: traverse(parent, 'parent_of', 'outgoing', depth=1)
5. Semantic search for related work: 'edges, node_id, graph database'

WORKFLOW:
- Do the implementation
- Create findings note
- Create edge: task → findings (type='created_by')
- Update edge status: todo → doing → done
`
});
```

### Phase 3: Agent Initialization

Agent executes on startup:

```typescript
// Agent startup routine
async function agentInit(taskNodeId) {
  // 1. Find parent project
  const parentEdges = await traverse({
    node_id: taskNodeId,
    type: "child_of",
    direction: "incoming",
    depth: 1
  });
  const projectNodeId = parentEdges[0].root.node_id;

  // 2. Read project knowledge
  const projectNote = await resolve_node(projectNodeId);

  // 3. Find sibling tasks
  const siblingEdges = await traverse({
    node_id: projectNodeId,
    type: "parent_of",
    direction: "outgoing",
    depth: 1
  });
  console.log(`Siblings working on: ${siblingEdges.map(e => e.node.content.title)}`);

  // 4. Semantic search for context
  const relatedWork = await semantic_search({
    query: "edges graph database node_id",
    project_path: projectNote.content.project_path,
    limit: 5
  });

  // 5. Update my status to 'doing'
  const myEdge = await get_edges({
    node_id: taskNodeId,
    direction: "incoming",
    type: "child_of"
  });
  await update_edge_properties({
    edge_id: myEdge[0].edge_id,
    properties: { status: "doing", started_at: new Date().toISOString() }
  });

  return { projectNote, siblings: siblingEdges, context: relatedWork };
}
```

### Phase 4: Agent Work & Completion

```typescript
// Agent does the work
const findings = await implementEdgesTable();

// Create findings note
const findingsNote = await create_knowledge_note({
  text: "# Edges Table Implementation\n\nCreated migration 037...",
  tags: ["implementation", "edges", "database"],
  project_path: projectNote.content.project_path
});

// Link task → findings
await create_edge({
  from_node_id: taskNodeId,
  to_node_id: findingsNote.node_id,
  type: "created_by",
  properties: {
    agent: "general-purpose-1",
    completed_at: new Date().toISOString()
  }
});

// Mark task as done
await update_edge_properties({
  edge_id: myEdge.edge_id,
  properties: {
    status: "done",
    completed_at: new Date().toISOString()
  }
});
```

### Phase 5: Main Session Monitoring

```typescript
// Kanban board query
const board = await get_project_tasks({
  project_node_id: projectNote.node_id
});
// Returns:
// {
//   todo: [task3, task4],
//   doing: [task2],
//   done: [task1]
// }

// Check what agents found
const results = await traverse({
  node_id: projectNote.node_id,
  type: "created_by",
  direction: "outgoing",  // project → tasks → findings
  depth: 2
});
// Returns tree of all tasks and their findings
```

---

## Error Handling

### 1. Node doesn't exist
**Scenario:** `create_edge` references a non-existent node_id

**Solution:**
```typescript
async function create_edge({ from_node_id, to_node_id, type, properties }) {
  const fromNode = await resolve_node(from_node_id);
  const toNode = await resolve_node(to_node_id);

  if (!fromNode) {
    throw new Error(`Source node not found: ${from_node_id}`);
  }
  if (!toNode) {
    throw new Error(`Target node not found: ${to_node_id}`);
  }

  // Create edge
}
```

### 2. Circular dependencies
**Scenario:** A depends on B, B depends on A (infinite loop)

**Solution:**
```typescript
async function create_edge({ from_node_id, to_node_id, type }) {
  if (type === 'depends_on') {
    const hasCycle = await detectDependencyCycle(from_node_id, to_node_id);
    if (hasCycle) {
      throw new Error(`Circular dependency: ${from_node_id} → ${to_node_id}`);
    }
  }
}
```

### 3. Orphaned edges
**Scenario:** Node deleted, edges pointing to it remain

**Solution:** Triggers on all tables to cleanup edges when node deleted (see schema)

### 4. Agent crashes mid-task
**Scenario:** Agent updates status to 'doing', then crashes (never sets 'done')

**Solution:**
```typescript
// Query for stale tasks
async function getStaleTasks(timeoutMinutes = 60) {
  const stale = await pool.query(`
    SELECT e.*, kn.title
    FROM edges e
    JOIN knowledge_notes kn ON e.to_node_id = kn.node_id
    WHERE e.properties->>'status' = 'doing'
      AND e.properties->>'started_at' < NOW() - INTERVAL '${timeoutMinutes} minutes'
  `);
  return stale.rows;
}

// Reset stale tasks to 'todo'
async function resetStaleTasks() {
  const stale = await getStaleTasks();
  for (const task of stale) {
    await update_edge_properties({
      edge_id: task.edge_id,
      properties: {
        status: 'todo',
        reset_reason: 'agent_timeout'
      }
    });
  }
}
```

### 5. Concurrent updates
**Scenario:** Two agents try to update same edge simultaneously

**Solution:**
```sql
-- Optimistic locking with updated_at
UPDATE edges
SET properties = COALESCE(properties, '{}'::jsonb) || $1::jsonb,
    updated_at = NOW()
WHERE edge_id = $2
  AND updated_at = $3;  -- Check version
```

---

## Testing Strategy

### 1. Unit Tests (Database Functions)

```typescript
// test/traverse.test.ts
describe('Graph Traversal', () => {
  test('traverse parent relationships', async () => {
    const projectId = await createProjectNote();
    const task1Id = await createTaskNote();
    const task2Id = await createTaskNote();

    await create_edge({ from_node_id: projectId, to_node_id: task1Id, type: 'parent_of' });
    await create_edge({ from_node_id: projectId, to_node_id: task2Id, type: 'parent_of' });

    const result = await traverse({ node_id: projectId, type: 'parent_of', direction: 'outgoing', depth: 1 });

    expect(result.children).toHaveLength(2);
    expect(result.children[0].edge.type).toBe('parent_of');
  });

  test('detect circular dependencies', async () => {
    const taskA = await createTaskNote();
    const taskB = await createTaskNote();

    await create_edge({ from_node_id: taskA, to_node_id: taskB, type: 'depends_on' });

    await expect(
      create_edge({ from_node_id: taskB, to_node_id: taskA, type: 'depends_on' })
    ).rejects.toThrow('Circular dependency');
  });
});
```

### 2. Integration Tests (Agent Coordination)

```typescript
// test/agent-coordination.test.ts
describe('Agent Coordination with Edges', () => {
  test('agent finds parent and siblings via edges', async () => {
    const project = await createProjectNote();
    const tasks = await Promise.all([
      createTaskNote({ title: 'Task 1' }),
      createTaskNote({ title: 'Task 2' }),
      createTaskNote({ title: 'Task 3' })
    ]);

    for (const task of tasks) {
      await create_edge({ from_node_id: project.node_id, to_node_id: task.node_id, type: 'parent_of' });
    }

    const agentContext = await simulateAgentInit(tasks[0].node_id);

    expect(agentContext.parent.node_id).toBe(project.node_id);
    expect(agentContext.siblings).toHaveLength(3);
  });

  test('kanban board shows correct task statuses', async () => {
    const project = await createProjectNote();
    const task1 = await createTaskNote();

    const edge = await create_edge({
      from_node_id: project.node_id,
      to_node_id: task1.node_id,
      type: 'parent_of',
      properties: { status: 'doing' }
    });

    await update_edge_properties({ edge_id: edge.edge_id, properties: { status: 'done' } });

    const board = await get_project_tasks({ project_node_id: project.node_id });

    expect(board.done).toHaveLength(1);
    expect(board.doing).toHaveLength(0);
  });
});
```

### 3. E2E Test (Multi-Agent Scenario)

```typescript
// test/e2e-multi-agent.test.ts
describe('E2E: Multi-Agent Coordination', () => {
  test('three agents work on project without duplication', async () => {
    const project = await createProject({
      title: 'Build Graph System',
      tasks: [
        { title: 'Add node_id columns', status: 'todo' },
        { title: 'Create edges table', status: 'todo' },
        { title: 'Implement MCP tools', status: 'todo' }
      ]
    });

    const agents = await Promise.all([
      launchAgent({ taskId: project.tasks[0].id }),
      launchAgent({ taskId: project.tasks[1].id }),
      launchAgent({ taskId: project.tasks[2].id })
    ]);

    await Promise.all(agents);

    const board = await get_project_tasks({ project_node_id: project.node_id });
    expect(board.done).toHaveLength(3);

    const findings = await traverse({
      node_id: project.node_id,
      type: 'created_by',
      depth: 2
    });
    expect(findings.children.length).toBeGreaterThan(0);
  });
});
```

### 4. Performance Tests

```typescript
// test/performance.test.ts
describe('Graph Traversal Performance', () => {
  test('traverse deep tree (depth 10) in < 100ms', async () => {
    const root = await createNode();
    let current = root;
    for (let i = 0; i < 10; i++) {
      const child = await createNode();
      await create_edge({ from_node_id: current.node_id, to_node_id: child.node_id, type: 'parent_of' });
      current = child;
    }

    const start = Date.now();
    await traverse({ node_id: root.node_id, type: 'parent_of', depth: 10 });
    const duration = Date.now() - start;

    expect(duration).toBeLessThan(100);
  });
});
```

---

## Implementation Plan

### Phase 1: Database Foundation (1-2 hours)
1. Create migration 036: Add `node_id` columns to all tables
2. Backfill existing data (node_id = existing ID)
3. Add NOT NULL constraints and indexes
4. Create migration 037: Create `edges` table
5. Create helper functions (`resolve_node`, `detect_dependency_cycle`)
6. Test migrations in development database

### Phase 2: MCP Tools Implementation (2-3 hours)
1. Add 6 tool definitions to `listToolsHandler`
2. Implement `create_edge` with node validation
3. Implement `get_edges` with resolution
4. Implement `traverse` with recursive CTE
5. Implement `delete_edge`
6. Implement `update_edge_properties` with JSONB merge
7. Implement `get_project_tasks` for Kanban
8. Test all tools via curl/script

### Phase 3: Service Layer (1 hour)
1. Create `web-ui/src/services/edges.ts`
2. TypeScript interfaces for Edge, Node, TraversalResult
3. API wrapper functions for all 6 tools
4. Error handling and response validation

### Phase 4: Agent Coordination Pattern (1-2 hours)
1. Create helper function `initializeAgent(taskNodeId)`
2. Implement agent startup routine (find parent, siblings, context)
3. Create helper `completeTask(taskNodeId, findings)`
4. Create helper `getKanbanBoard(projectNodeId)`
5. Document agent workflow pattern

### Phase 5: Testing (1-2 hours)
1. Unit tests for each MCP tool
2. Integration tests for traversal
3. E2E test with 3 parallel agents
4. Performance test (depth 10 traversal)
5. Fix any bugs found

### Phase 6: Documentation (1 hour)
1. Write design document (this file)
2. Create usage guide: "How to use edges for agent coordination"
3. Update TOOLS.md with new edge tools
4. Create example: Multi-agent workflow

**Total time**: 7-11 hours

---

## Future Enhancements

### Short-term
- Web UI to visualize graph (D3.js or vis-network)
- Edge properties validation schema
- Bulk edge operations
- Edge type suggestions based on node types

### Long-term
- Path finding (shortest path between nodes)
- Centrality metrics (most connected nodes)
- Graph analytics (clusters, communities)
- Temporal edges (track relationship changes over time)
- Edge permissions (tenant-scoped visibility)

---

## Summary

**What we're building:**
- Graph-based relationship system for memory
- Enables agents to coordinate through shared memory
- BBS + Kanban pattern for collaboration
- Prevents lost insights and redundant work

**Key components:**
1. Database: `node_id` columns + `edges` table
2. MCP Tools: 6 tools for edge management
3. Agent Pattern: Init via edges, share findings, update status
4. Kanban: Query edges by status property

**Benefits:**
- Agents see each other's work (no duplication)
- Projects trackable (parent → children edges)
- Context preserved (semantic search + graph traversal)
- Scalable (handles N agents, M tasks)

---

**Design complete - Ready for implementation!**

*Generated by Thread & Callin - 2026-02-21*
*Branch: feature/graph-edges-system*
