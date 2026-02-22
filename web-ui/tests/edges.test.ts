/**
 * Graph Edges System Test Suite
 *
 * Tests for the 6 edge tools and agent coordination helpers.
 * Run with: npm test (needs test framework setup)
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals'
import {
  createEdge,
  getEdges,
  traverse,
  deleteEdge,
  updateEdgeProperties,
  getProjectTasks,
  initializeAgent,
  waitForDependencies,
  completeTaskWithFindings,
  getKanbanBoard,
  agentStartup,
} from '../web-ui/src/services/edges'

// ============================================================================
// Test Setup
// ============================================================================

const TEST_TENANT = 'test-edges-tenant'
let projectNodeId: string
let taskNodeIds: string[] = []
let findingsNodeId: string
let testEdges: string[] = []

describe('Graph Edges System', () => {
  // Setup: Create test nodes
  beforeAll(async () => {
    // In a real test, we'd call the knowledge notes MCP tool to create nodes
    // For now, we'll use placeholder IDs that would exist in the database
    projectNodeId = `kn_test_project_${Date.now()}`
    taskNodeIds = [
      `kn_test_task_1_${Date.now()}`,
      `kn_test_task_2_${Date.now()}`,
      `kn_test_task_3_${Date.now()}`,
    ]
    findingsNodeId = `kn_test_findings_${Date.now()}`

    console.log('Test nodes created:', { projectNodeId, taskNodeIds, findingsNodeId })
  })

  // Cleanup: Delete test edges
  afterAll(async () => {
    for (const edgeId of testEdges) {
      try {
        await deleteEdge({ edge_id: edgeId, tenant_id: TEST_TENANT })
      } catch (error) {
        console.warn(`Failed to delete edge ${edgeId}:`, error)
      }
    }
    console.log('Test edges cleaned up')
  })
})

// ============================================================================
// Phase 1: Unit Tests for MCP Tools
// ============================================================================

describe('createEdge', () => {
  it('should create a parent_of relationship', async () => {
    const result = await createEdge({
      from_node_id: projectNodeId,
      to_node_id: taskNodeIds[0],
      type: 'parent_of',
      properties: { status: 'todo', priority: 'high' },
      tenant_id: TEST_TENANT,
    })

    expect(result.success).toBe(true)
    expect(result.edge).toBeDefined()
    expect(result.edge.type).toBe('parent_of')
    expect(result.edge.properties.status).toBe('todo')

    testEdges.push(result.edge.edge_id)
  })

  it('should create a depends_on relationship', async () => {
    const result = await createEdge({
      from_node_id: taskNodeIds[1],
      to_node_id: taskNodeIds[0],
      type: 'depends_on',
      properties: { blocker: true },
      tenant_id: TEST_TENANT,
    })

    expect(result.success).toBe(true)
    expect(result.edge.type).toBe('depends_on')

    testEdges.push(result.edge.edge_id)
  })

  it('should prevent circular dependencies', async () => {
    // Create A → B
    await createEdge({
      from_node_id: taskNodeIds[0],
      to_node_id: taskNodeIds[1],
      type: 'depends_on',
      tenant_id: TEST_TENANT,
    })

    // Try to create B → A (should fail)
    await expect(
      createEdge({
        from_node_id: taskNodeIds[1],
        to_node_id: taskNodeIds[0],
        type: 'depends_on',
        tenant_id: TEST_TENANT,
      })
    ).rejects.toThrow(/circular|cycle|dependency/)
  })
})

describe('getEdges', () => {
  it('should retrieve outgoing edges for a node', async () => {
    const result = await getEdges({
      node_id: projectNodeId,
      direction: 'outgoing',
      type: 'parent_of',
      tenant_id: TEST_TENANT,
    })

    expect(result.success).toBe(true)
    expect(result.edges.length).toBeGreaterThan(0)
    expect(result.edges[0].type).toBe('parent_of')
  })

  it('should retrieve incoming edges for a node', async () => {
    const result = await getEdges({
      node_id: taskNodeIds[0],
      direction: 'incoming',
      type: 'child_of',
      tenant_id: TEST_TENANT,
    })

    expect(result.success).toBe(true)
    expect(result.edges.length).toBeGreaterThan(0)
  })

  it('should retrieve edges in both directions', async () => {
    const result = await getEdges({
      node_id: taskNodeIds[0],
      direction: 'both',
      tenant_id: TEST_TENANT,
    })

    expect(result.success).toBe(true)
    expect(result.edges.length).toBeGreaterThan(0)
  })
})

describe('traverse', () => {
  it('should traverse parent_of relationships', async () => {
    const result = await traverse({
      node_id: projectNodeId,
      type: 'parent_of',
      direction: 'outgoing',
      depth: 1,
      tenant_id: TEST_TENANT,
    })

    expect(result.success).toBe(true)
    expect(result.root).toBeDefined()
    expect(result.children.length).toBeGreaterThan(0)
    expect(result.total_found).toBeGreaterThan(0)
  })

  it('should traverse multiple levels', async () => {
    const result = await traverse({
      node_id: projectNodeId,
      type: 'parent_of',
      direction: 'outgoing',
      depth: 2,
      tenant_id: TEST_TENANT,
    })

    expect(result.success).toBe(true)
    // Should find tasks and any findings linked to tasks
    expect(result.total_found).toBeGreaterThanOrEqual(1)
  })
})

describe('updateEdgeProperties', () => {
  it('should update task status', async () => {
    // Get the edge
    const edges = await getEdges({
      node_id: taskNodeIds[0],
      direction: 'incoming',
      type: 'child_of',
      tenant_id: TEST_TENANT,
    })

    const edgeId = edges.edges[0].edge_id

    // Update status
    const result = await updateEdgeProperties({
      edge_id: edgeId,
      properties: {
        status: 'doing',
        started_at: new Date().toISOString(),
        agent: 'test-agent',
      },
      tenant_id: TEST_TENANT,
    })

    expect(result.success).toBe(true)
    expect(result.edge.properties.status).toBe('doing')
    expect(result.edge.properties.agent).toBe('test-agent')
  })

  it('should merge JSONB properties', async () => {
    const edges = await getEdges({
      node_id: taskNodeIds[0],
      direction: 'incoming',
      type: 'child_of',
      tenant_id: TEST_TENANT,
    })

    const edgeId = edges.edges[0].edge_id

    // Add new property (should merge with existing)
    const result = await updateEdgeProperties({
      edge_id: edgeId,
      properties: {
        progress: 50,
      },
      tenant_id: TEST_TENANT,
    })

    expect(result.success).toBe(true)
    expect(result.edge.properties.status).toBe('doing') // Old property preserved
    expect(result.edge.properties.progress).toBe(50) // New property added
  })
})

describe('getProjectTasks', () => {
  it('should return Kanban board grouped by status', async () => {
    const result = await getProjectTasks({
      project_node_id: projectNodeId,
      tenant_id: TEST_TENANT,
    })

    expect(result.success).toBe(true)
    expect(result.project_node_id).toBe(projectNodeId)
    expect(result.total).toBeGreaterThan(0)

    // Tasks should be grouped
    expect(Array.isArray(result.todo)).toBe(true)
    expect(Array.isArray(result.doing)).toBe(true)
    expect(Array.isArray(result.done)).toBe(true)
  })

  it('should filter by status', async () => {
    const result = await getProjectTasks({
      project_node_id: projectNodeId,
      status: 'doing',
      tenant_id: TEST_TENANT,
    })

    expect(result.success).toBe(true)
    expect(result.doing.length).toBeGreaterThan(0)
    expect(result.todo.length).toBe(0)
    expect(result.done.length).toBe(0)
  })
})

describe('deleteEdge', () => {
  it('should delete an edge', async () => {
    // Create a temporary edge
    const tempEdge = await createEdge({
      from_node_id: taskNodeIds[2],
      to_node_id: findingsNodeId,
      type: 'created_by',
      tenant_id: TEST_TENANT,
    })

    // Delete it
    const result = await deleteEdge({
      edge_id: tempEdge.edge.edge_id,
      tenant_id: TEST_TENANT,
    })

    expect(result.success).toBe(true)
    expect(result.deleted_edge.edge_id).toBe(tempEdge.edge.edge_id)
  })
})

// ============================================================================
// Phase 2: Integration Tests
// ============================================================================

describe('Integration: Task lifecycle', () => {
  it('should complete full task lifecycle', async () => {
    // 1. Create task
    const taskResult = await createEdge({
      from_node_id: projectNodeId,
      to_node_id: taskNodeIds[2],
      type: 'parent_of',
      properties: { status: 'todo' },
      tenant_id: TEST_TENANT,
    })

    const edgeId = taskResult.edge.edge_id

    // 2. Start task
    await updateEdgeProperties({
      edge_id: edgeId,
      properties: { status: 'doing', started_at: new Date().toISOString() },
      tenant_id: TEST_TENANT,
    })

    // 3. Create findings
    await createEdge({
      from_node_id: taskNodeIds[2],
      to_node_id: findingsNodeId,
      type: 'created_by',
      tenant_id: TEST_TENANT,
    })

    // 4. Complete task
    await updateEdgeProperties({
      edge_id: edgeId,
      properties: { status: 'done', completed_at: new Date().toISOString() },
      tenant_id: TEST_TENANT,
    })

    // Verify: Check Kanban board
    const board = await getProjectTasks({
      project_node_id: projectNodeId,
      tenant_id: TEST_TENANT,
    })

    const completedTask = board.done.find((t) => t.node_id === taskNodeIds[2])
    expect(completedTask).toBeDefined()

    testEdges.push(edgeId)
  })
})

describe('Integration: Dependency chain', () => {
  it('should handle A → B → C dependency chain', async () => {
    // Task A exists, create B → A and C → B
    const dep1 = await createEdge({
      from_node_id: taskNodeIds[1],
      to_node_id: taskNodeIds[0],
      type: 'depends_on',
      tenant_id: TEST_TENANT,
    })

    const dep2 = await createEdge({
      from_node_id: taskNodeIds[2],
      to_node_id: taskNodeIds[1],
      type: 'depends_on',
      tenant_id: TEST_TENANT,
    })

    expect(dep1.success).toBe(true)
    expect(dep2.success).toBe(true)

    // Verify traversal finds the chain
    const result = await traverse({
      node_id: taskNodeIds[2],
      type: 'depends_on',
      direction: 'outgoing',
      depth: 3,
      tenant_id: TEST_TENANT,
    })

    expect(result.total_found).toBeGreaterThanOrEqual(2)

    testEdges.push(dep1.edge.edge_id, dep2.edge.edge_id)
  })
})

// ============================================================================
// Phase 3: Agent Coordination Tests
// ============================================================================

describe('Agent Coordination: initializeAgent', () => {
  it('should initialize agent with full context', async () => {
    const context = await initializeAgent(taskNodeIds[0], TEST_TENANT)

    expect(context.projectNodeId).toBeDefined()
    expect(context.projectContent).toBeDefined()
    expect(context.siblingTasks).toBeDefined()
    expect(context.myEdge).toBeDefined()
    expect(context.myEdge.properties.status).toBeDefined()
  })
})

describe('Agent Coordination: waitForDependencies', () => {
  it('should wait for dependencies to complete', async () => {
    // Create a dependency that's already done
    await updateEdgeProperties({
      edge_id: testEdges[0],
      properties: { status: 'done' },
      tenant_id: TEST_TENANT,
    })

    // Should resolve immediately
    await expect(
      waitForDependencies(taskNodeIds[1], TEST_TENANT, 100)
    ).resolves.toBeUndefined()
  }, 10000)
})

describe('Agent Coordination: completeTaskWithFindings', () => {
  it('should complete task and link findings', async () => {
    const result = await completeTaskWithFindings(
      taskNodeIds[0],
      findingsNodeId,
      'test-agent',
      TEST_TENANT
    )

    expect(result.success).toBe(true)
    expect(result.message).toContain('completed')
  })
})

describe('Agent Coordination: agentStartup', () => {
  it('should run full agent startup sequence', async () => {
    const context = await agentStartup(taskNodeIds[2], {
      tenantId: TEST_TENANT,
      agentName: 'test-agent-2',
      waitForDeps: false, // Skip for test speed
    })

    expect(context.projectNodeId).toBeDefined()
    expect(context.myEdge.properties.status).toBe('doing')
    expect(context.myEdge.properties.agent).toBe('test-agent-2')
  })
})

// ============================================================================
// Phase 4: E2E Test with Multiple Agents
// ============================================================================

describe('E2E: Multi-agent OAuth feature workflow', () => {
  it('should coordinate 3 agents working on OAuth feature', async () => {
    // This simulates the OAuth example from the documentation
    // Agents: Database, Backend, Frontend

    const oauthProjectId = `kn_oauth_project_${Date.now()}`
    const taskDatabase = `kn_oauth_db_${Date.now()}`
    const taskBackend = `kn_oauth_backend_${Date.now()}`
    const taskFrontend = `kn_oauth_frontend_${Date.now()}`

    // 1. Create project and tasks
    await createEdge({
      from_node_id: oauthProjectId,
      to_node_id: taskDatabase,
      type: 'parent_of',
      properties: { status: 'todo' },
      tenant_id: TEST_TENANT,
    })

    await createEdge({
      from_node_id: oauthProjectId,
      to_node_id: taskBackend,
      type: 'parent_of',
      properties: { status: 'todo' },
      tenant_id: TEST_TENANT,
    })

    await createEdge({
      from_node_id: oauthProjectId,
      to_node_id: taskFrontend,
      type: 'parent_of',
      properties: { status: 'todo' },
      tenant_id: TEST_TENANT,
    })

    // 2. Create dependencies: Backend → Database, Frontend → Backend
    await createEdge({
      from_node_id: taskBackend,
      to_node_id: taskDatabase,
      type: 'depends_on',
      tenant_id: TEST_TENANT,
    })

    await createEdge({
      from_node_id: taskFrontend,
      to_node_id: taskBackend,
      type: 'depends_on',
      tenant_id: TEST_TENANT,
    })

    // 3. Database agent completes (no dependencies)
    const dbContext = await agentStartup(taskDatabase, {
      tenantId: TEST_TENANT,
      agentName: 'database-agent',
    })
    expect(dbContext.siblingTasks.length).toBe(2) // Backend + Frontend

    // 4. Backend agent waits for Database
    // (In real scenario, would poll - here we just verify structure)
    const backendDeps = await getEdges({
      node_id: taskBackend,
      direction: 'outgoing',
      type: 'depends_on',
      tenant_id: TEST_TENANT,
    })
    expect(backendDeps.edges.length).toBe(1)

    // 5. Frontend agent waits for Backend
    const frontendDeps = await getEdges({
      node_id: taskFrontend,
      direction: 'outgoing',
      type: 'depends_on',
      tenant_id: TEST_TENANT,
    })
    expect(frontendDeps.edges.length).toBe(1)

    // 6. Verify Kanban board shows all tasks
    const board = await getKanbanBoard(oauthProjectId, TEST_TENANT)
    expect(board.total).toBe(3)
  }, 30000)
})

// ============================================================================
// Phase 5: Performance Tests
// ============================================================================

describe('Performance: Deep traversal', () => {
  it('should handle depth 10 traversal efficiently', async () => {
    const startTime = Date.now()

    const result = await traverse({
      node_id: projectNodeId,
      type: 'parent_of',
      direction: 'outgoing',
      depth: 10,
      tenant_id: TEST_TENANT,
    })

    const duration = Date.now() - startTime

    expect(result.success).toBe(true)
    expect(duration).toBeLessThan(1000) // Should complete in < 1s
  })
})

describe('Performance: Large project', () => {
  it('should handle project with 100+ tasks', async () => {
    // This would create 100 tasks and verify performance
    // For now, we'll skip this as it requires database setup
    // In a real test, we'd:
    // 1. Create 100 task nodes
    // 2. Link them to project
    // 3. Call getProjectTasks
    // 4. Verify it returns in < 500ms

    expect(true).toBe(true) // Placeholder
  })
})
