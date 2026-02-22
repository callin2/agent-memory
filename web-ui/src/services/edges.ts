import axios from 'axios'

const MCP_URL = import.meta.env.VITE_MCP_URL || 'http://localhost:4000/mcp'
const MCP_AUTH = import.meta.env.VITE_MCP_AUTH || 'test-mcp-token'

// ============================================================================
// TypeScript Interfaces
// ============================================================================

export type EdgeType = 'parent_of' | 'child_of' | 'references' | 'created_by' | 'related_to' | 'depends_on'
export type EdgeDirection = 'incoming' | 'outgoing' | 'both'
export type TaskStatus = 'todo' | 'doing' | 'done'

export interface Edge {
  edge_id: string
  from_node_id: string
  to_node_id: string
  type: EdgeType
  properties: Record<string, unknown>
  tenant_id: string
  created_at: string
  updated_at: string
}

export interface Node {
  node_type: 'handoff' | 'knowledge_note' | 'feedback' | 'capsule' | 'semantic_memory' | 'task'
  node_id: string
  tenant_id: string
  content: Record<string, unknown>
}

export interface TraversalChild {
  node: {
    node_type: string
    node_id: string
    content: Record<string, unknown>
  }
  edge: {
    edge_id: string
    type: EdgeType
    properties: Record<string, unknown>
  }
  depth: number
}

export interface TraversalResult {
  success: boolean
  root: {
    node_type: string
    node_id: string
    content: Record<string, unknown>
  } | null
  children: TraversalChild[]
  total_found: number
}

export interface CreateEdgeInput {
  from_node_id: string
  to_node_id: string
  type: EdgeType
  properties?: Record<string, unknown>
  tenant_id?: string
}

export interface GetEdgesInput {
  node_id: string
  direction?: EdgeDirection
  type?: EdgeType
  tenant_id?: string
}

export interface TraverseInput {
  node_id: string
  type: EdgeType
  direction: 'incoming' | 'outgoing'
  depth?: number
  tenant_id?: string
}

export interface UpdateEdgePropertiesInput {
  edge_id: string
  properties: Record<string, unknown>
  tenant_id?: string
}

export interface DeleteEdgeInput {
  edge_id: string
  tenant_id?: string
}

export interface GetProjectTasksInput {
  project_node_id: string
  status?: TaskStatus
  tenant_id?: string
}

export interface TaskCard {
  node_id: string
  title: string
  tags: string[]
  properties: {
    status: TaskStatus
    priority?: string
    started_at?: string
    completed_at?: string
    agent?: string
  }
  created_at: string
}

export interface KanbanBoard {
  success: boolean
  project_node_id: string
  todo: TaskCard[]
  doing: TaskCard[]
  done: TaskCard[]
  total: number
}

// ============================================================================
// MCP HTTP Client Helper
// ============================================================================

interface MCPResponse {
  jsonrpc: string
  id: number
  result?: {
    content: Array<{ text: string }>
  }
  error?: {
    code: number
    message: string
  }
}

interface MCPSuccess<T> {
  success: true
  [key: string]: T | string | boolean | number
}

interface MCPError {
  success: false
  error: string
}

async function callMCPTool<T>(name: string, args: Record<string, unknown>): Promise<T> {
  try {
    const response = await axios.post<MCPResponse>(
      MCP_URL,
      {
        jsonrpc: '2.0',
        id: Date.now(),
        method: 'tools/call',
        params: { name, arguments: args },
      },
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${MCP_AUTH}`,
        },
        timeout: 30000,
      }
    )

    // Validate JSON-RPC response structure
    if (!response.data.jsonrpc || response.data.jsonrpc !== '2.0') {
      throw new Error(`Invalid JSON-RPC response for ${name}`)
    }

    if (response.data.error) {
      throw new Error(`MCP error (${name}): ${response.data.error.message}`)
    }

    // Parse and validate success
    const resultText = response.data.result?.content?.[0]?.text
    if (!resultText) {
      throw new Error(`Empty response from ${name}`)
    }

    const parsed = JSON.parse(resultText) as MCPSuccess<T> | MCPError

    if (!parsed.success) {
      throw new Error(`Tool ${name} failed: ${parsed.error}`)
    }

    return parsed as T
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const status = error.response?.status
      const message = error.response?.data?.message || error.message
      throw new Error(`MCP API Error (${name}): ${message} (${status})`)
    }
    throw error
  }
}

// ============================================================================
// Edge API Functions
// ============================================================================

/**
 * Create a typed edge (relationship) between two nodes.
 * Validates both nodes exist and detects circular dependencies for 'depends_on' type.
 */
export async function createEdge(input: CreateEdgeInput): Promise<{
  success: boolean
  edge: Edge
  message: string
}> {
  return callMCPTool<{
    success: boolean
    edge: Edge
    message: string
  }>('create_edge', {
    from_node_id: input.from_node_id,
    to_node_id: input.to_node_id,
    type: input.type,
    properties: input.properties || {},
    tenant_id: input.tenant_id || 'default',
  })
}

/**
 * Get all edges for a node, optionally filtered by direction and type.
 */
export async function getEdges(input: GetEdgesInput): Promise<{
  success: boolean
  edges: Edge[]
  count: number
}> {
  return callMCPTool<{
    success: boolean
    edges: Edge[]
    count: number
  }>('get_edges', {
    node_id: input.node_id,
    direction: input.direction || 'both',
    type: input.type,
    tenant_id: input.tenant_id || 'default',
  })
}

/**
 * Traverse graph from a node following specific relationship type.
 * Returns tree structure with connected nodes up to specified depth.
 */
export async function traverse(input: TraverseInput): Promise<TraversalResult> {
  return callMCPTool<TraversalResult>('traverse', {
    node_id: input.node_id,
    type: input.type,
    direction: input.direction,
    depth: input.depth || 2,
    tenant_id: input.tenant_id || 'default',
  })
}

/**
 * Delete an edge by ID.
 */
export async function deleteEdge(input: DeleteEdgeInput): Promise<{
  success: boolean
  deleted_edge: Edge
  message: string
}> {
  return callMCPTool<{
    success: boolean
    deleted_edge: Edge
    message: string
  }>('delete_edge', {
    edge_id: input.edge_id,
    tenant_id: input.tenant_id || 'default',
  })
}

/**
 * Update edge properties (JSONB merge with existing).
 * Use this to update task status, priority, or other metadata.
 */
export async function updateEdgeProperties(input: UpdateEdgePropertiesInput): Promise<{
  success: boolean
  edge: Edge
  message: string
}> {
  return callMCPTool<{
    success: boolean
    edge: Edge
    message: string
  }>('update_edge_properties', {
    edge_id: input.edge_id,
    properties: input.properties,
    tenant_id: input.tenant_id || 'default',
  })
}

/**
 * Get Kanban board view of project tasks.
 * Returns tasks grouped by status (todo, doing, done).
 */
export async function getProjectTasks(input: GetProjectTasksInput): Promise<KanbanBoard> {
  return callMCPTool<KanbanBoard>('get_project_tasks', {
    project_node_id: input.project_node_id,
    status: input.status,
    tenant_id: input.tenant_id || 'default',
  })
}

// ============================================================================
// Convenience Functions
// ============================================================================

/**
 * Create a parent-child relationship (project → task)
 */
export async function linkTaskToProject(
  projectNodeId: string,
  taskNodeId: string,
  options?: {
    status?: TaskStatus
    priority?: string
  }
): Promise<{ success: boolean; edge: Edge; message: string }> {
  return createEdge({
    from_node_id: projectNodeId,
    to_node_id: taskNodeId,
    type: 'parent_of',
    properties: options || { status: 'todo' },
  })
}

/**
 * Mark task as complete (status: 'done')
 */
export async function completeTask(
  edgeId: string,
  agent?: string
): Promise<{ success: boolean; edge: Edge; message: string }> {
  return updateEdgeProperties({
    edge_id: edgeId,
    properties: {
      status: 'done',
      completed_at: new Date().toISOString(),
      ...(agent && { agent }),
    },
  })
}

/**
 * Mark task as in progress (status: 'doing')
 */
export async function startTask(
  edgeId: string
): Promise<{ success: boolean; edge: Edge; message: string }> {
  return updateEdgeProperties({
    edge_id: edgeId,
    properties: {
      status: 'doing',
      started_at: new Date().toISOString(),
    },
  })
}

/**
 * Get all child tasks for a project (via parent_of edges)
 */
export async function getProjectTasksFlat(
  projectNodeId: string
): Promise<TaskCard[]> {
  const result = await getEdges({
    node_id: projectNodeId,
    direction: 'outgoing',
    type: 'parent_of',
  })

  // Extract task info from edges
  return result.edges.map((edge) => ({
    node_id: edge.to_node_id,
    title: '', // Will be populated when we join with knowledge_notes
    tags: [],
    properties: edge.properties as any,
    created_at: edge.created_at,
  }))
}

/**
 * Get dependencies for a task (via depends_on edges)
 */
export async function getTaskDependencies(
  taskNodeId: string
): Promise<{ blocking: Edge[]; blockedBy: Edge[] }> {
  const [blocking, blockedBy] = await Promise.all([
    getEdges({
      node_id: taskNodeId,
      direction: 'outgoing',
      type: 'depends_on',
    }),
    getEdges({
      node_id: taskNodeId,
      direction: 'incoming',
      type: 'depends_on',
    }),
  ])

  return {
    blocking: blocking.edges,
    blockedBy: blockedBy.edges,
  }
}

// ============================================================================
// Agent Coordination Helpers (Phase 4)
// ============================================================================

export interface AgentInitializationContext {
  projectNodeId: string
  projectContent: Record<string, unknown>
  siblingTasks: Array<{
    node_id: string
    content: Record<string, unknown>
    edge: Edge
  }>
  relatedWork: unknown[]
  myEdge: Edge
}

/**
 * Initialize an agent with full context awareness.
 * This is the standard startup routine for all agents working on tasks.
 *
 * Usage in agent:
 * ```typescript
 * const context = await initializeAgent('my_task_node_id', 'default')
 * console.log('Project:', context.projectContent)
 * console.log('Siblings:', context.siblingTasks)
 * // Now do the work!
 * ```
 */
export async function initializeAgent(
  taskNodeId: string,
  tenantId = 'default'
): Promise<AgentInitializationContext> {
  // 1. Find parent project by traversing child_of edge
  const parentResult = await traverse({
    node_id: taskNodeId,
    type: 'child_of',
    direction: 'incoming',
    depth: 1,
    tenant_id: tenantId,
  })

  if (!parentResult.root || parentResult.children.length === 0) {
    throw new Error(`Task ${taskNodeId} has no parent project`)
  }

  const projectNodeId = parentResult.children[0].node.node_id

  // 2. Get parent project content
  const projectNode = parentResult.children[0].node

  // 3. Find sibling tasks (other tasks under the same project)
  const siblingsResult = await traverse({
    node_id: projectNodeId,
    type: 'parent_of',
    direction: 'outgoing',
    depth: 1,
    tenant_id: tenantId,
  })

  // Filter out self from siblings
  const siblingTasks = siblingsResult.children
    .filter((child) => child.node.node_id !== taskNodeId)
    .map((child) => ({
      node_id: child.node.node_id,
      content: child.node.content,
      edge: child.edge as Edge, // Cast to Edge - traversal returns partial edge info
    }))

  // 4. Get my edge (for status updates)
  const myEdges = await getEdges({
    node_id: taskNodeId,
    direction: 'incoming',
    type: 'child_of',
    tenant_id: tenantId,
  })

  if (myEdges.edges.length === 0) {
    throw new Error(`Task ${taskNodeId} has no parent edge`)
  }

  const myEdge = myEdges.edges[0]

  // 5. Semantic search for related work (optional, returns empty if not available)
  let relatedWork: unknown[] = []
  try {
    // This would typically call a semantic search function
    // For now, we'll leave this empty as it depends on another service
    relatedWork = []
  } catch (error) {
    // Semantic search might not be available, that's okay
    console.warn('Semantic search not available:', error)
  }

  return {
    projectNodeId,
    projectContent: projectNode.content,
    siblingTasks,
    relatedWork,
    myEdge,
  }
}

/**
 * Wait for all dependencies of a task to complete.
 * Use this before starting work on a task that has dependencies.
 *
 * @returns Promise that resolves when all dependencies are done
 */
export async function waitForDependencies(
  taskNodeId: string,
  tenantId = 'default',
  pollIntervalMs = 5000
): Promise<void> {
  const deps = await getTaskDependencies(taskNodeId)

  if (deps.blockedBy.length === 0) {
    return // No dependencies to wait for
  }

  console.log(
    `Waiting for ${deps.blockedBy.length} dependencies to complete...`
  )

  while (true) {
    let allDone = true

    for (const dep of deps.blockedBy) {
      // Get the status edge of the dependency task
      const depEdges = await getEdges({
        node_id: dep.to_node_id,
        direction: 'incoming',
        type: 'child_of',
        tenant_id: tenantId,
      })

      if (depEdges.edges.length === 0) {
        console.warn(`Dependency ${dep.to_node_id} has no status edge`)
        continue
      }

      const status = depEdges.edges[0].properties.status as TaskStatus | undefined

      if (status !== 'done') {
        allDone = false
        console.log(`Dependency ${dep.to_node_id} status: ${status || 'unknown'}`)
        break
      }
    }

    if (allDone) {
      console.log('All dependencies complete!')
      return
    }

    // Wait before polling again
    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs))
  }
}

/**
 * Complete a task and create findings.
 * This is the standard way for agents to mark work as complete.
 *
 * @param taskNodeId - The task node being completed
 * @param findingsNodeId - The findings note created by the agent
 * @param agentName - Optional agent name for attribution
 * @param tenantId - Tenant ID
 */
export async function completeTaskWithFindings(
  taskNodeId: string,
  findingsNodeId: string,
  agentName?: string,
  tenantId = 'default'
): Promise<{ success: boolean; message: string }> {
  // 1. Create edge: task → findings (created_by)
  await createEdge({
    from_node_id: taskNodeId,
    to_node_id: findingsNodeId,
    type: 'created_by',
    properties: {
      agent: agentName || 'unknown-agent',
      completed_at: new Date().toISOString(),
    },
    tenant_id: tenantId,
  })

  // 2. Get my edge for status update
  const myEdges = await getEdges({
    node_id: taskNodeId,
    direction: 'incoming',
    type: 'child_of',
    tenant_id: tenantId,
  })

  if (myEdges.edges.length === 0) {
    throw new Error(`Task ${taskNodeId} has no parent edge`)
  }

  // 3. Update status to 'done'
  await updateEdgeProperties({
    edge_id: myEdges.edges[0].edge_id,
    properties: {
      status: 'done',
      completed_at: new Date().toISOString(),
      ...(agentName && { agent: agentName }),
    },
    tenant_id: tenantId,
  })

  return {
    success: true,
    message: `Task ${taskNodeId} completed with findings ${findingsNodeId}`,
  }
}

/**
 * Get real-time Kanban board for a project.
 * Use this to monitor progress of all tasks in a project.
 *
 * @param projectNodeId - The project node ID
 * @param tenantId - Tenant ID
 * @returns Kanban board with tasks grouped by status
 */
export async function getKanbanBoard(
  projectNodeId: string,
  tenantId = 'default'
): Promise<KanbanBoard> {
  return getProjectTasks({
    project_node_id: projectNodeId,
    tenant_id: tenantId,
  })
}

/**
 * Agent workflow: Standard agent startup sequence.
 * Combines initialization, dependency waiting, and status update.
 *
 * Usage in agent:
 * ```typescript
 * async function agentMain() {
 *   const { myEdge, projectContent } = await agentStartup('my_task_id', { agentName: 'agent-1' })
 *   // Do work...
 *   await completeTaskWithFindings('my_task_id', 'findings_id', 'agent-1')
 * }
 * ```
 */
export async function agentStartup(
  taskNodeId: string,
  options?: {
    tenantId?: string
    agentName?: string
    waitForDeps?: boolean
    pollIntervalMs?: number
  }
): Promise<AgentInitializationContext> {
  const tenantId = options?.tenantId || 'default'
  const agentName = options?.agentName || 'unknown-agent'

  console.log(`[${agentName}] Initializing...`)

  // 1. Initialize agent context
  const context = await initializeAgent(taskNodeId, tenantId)
  console.log(`[${agentName}] Found project: ${context.projectNodeId}`)
  console.log(`[${agentName}] Found ${context.siblingTasks.length} sibling tasks`)

  // 2. Wait for dependencies if requested
  if (options?.waitForDeps !== false) {
    console.log(`[${agentName}] Checking dependencies...`)
    await waitForDependencies(taskNodeId, tenantId, options?.pollIntervalMs)
  }

  // 3. Update status to 'doing'
  await updateEdgeProperties({
    edge_id: context.myEdge.edge_id,
    properties: {
      status: 'doing',
      started_at: new Date().toISOString(),
      agent: agentName,
    },
    tenant_id: tenantId,
  })
  console.log(`[${agentName}] Status updated to 'doing'`)

  return context
}
