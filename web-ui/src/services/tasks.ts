import axios from 'axios'

const MCP_URL = import.meta.env.VITE_MCP_URL || 'http://localhost:4000/mcp'
const MCP_AUTH = import.meta.env.VITE_MCP_AUTH || 'test-mcp-token'

// ============================================================================
// TypeScript Interfaces
// ============================================================================

export type TaskStatus = 'backlog' | 'open' | 'doing' | 'review' | 'blocked' | 'done'
export type TaskPriority = 'critical' | 'high' | 'medium' | 'low'

export interface Task {
  task_id: string
  tenant_id: string
  ts: string
  status: TaskStatus
  title: string
  details: string
  refs: string[]
  scope: string | null
  subject_type: string | null
  subject_id: string | null
  project_id: string | null
  blocked_by: string[]
  blocking: string[]
  start_date: string | null
  due_date: string | null
  time_estimate_hours: number | null
  time_actual_hours: number | null
  priority: TaskPriority
  progress_percentage: number
  assignee_id: string | null
  completed_at: string | null
}

export interface TaskWithDependencies extends Task {
  blocked_by_tasks: Task[]
  blocking_tasks: Task[]
}

export interface ProjectSummary {
  project_id: string
  total_tasks: number
  completed_tasks: number
  in_progress_tasks: number
  blocked_tasks: number
  backlog_tasks: number
  progress_percentage: number
  overdue_tasks: number
}

export interface ProjectDetail {
  project_id: string
  summary: ProjectSummary
  blocking_tasks: Task[]
  recent_tasks: Task[]
}

export interface TaskDependencyNode {
  task_id: string
  title: string
  status: TaskStatus
  priority: TaskPriority
  blocked_by: string[]
  level: number
}

export interface TaskDependencies {
  task_id: string
  depth: number
  upstream: TaskDependencyNode[]  // Tasks that must complete before this one
  downstream: TaskDependencyNode[]  // Tasks that depend on this one
}

export interface CreateTaskInput {
  title: string
  details?: string
  project_id?: string
  status?: TaskStatus
  priority?: TaskPriority
  blocked_by?: string[]
  start_date?: string
  due_date?: string
  time_estimate_hours?: number
  assignee_id?: string
  progress_percentage?: number
}

export interface UpdateTaskInput {
  title?: string
  details?: string
  status?: TaskStatus
  priority?: TaskPriority
  blocked_by?: string[] | null
  start_date?: string
  due_date?: string
  time_estimate_hours?: number
  time_actual_hours?: number
  assignee_id?: string
  progress_percentage?: number
}

export interface ListTasksInput {
  project_id?: string
  status?: TaskStatus[]
  priority?: TaskPriority[]
  assignee_id?: string
  include_overdue_only?: boolean
  limit?: number
  offset?: number
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

async function callMCPTool<T>(name: string, args: Record<string, unknown> | CreateTaskInput | ListTasksInput): Promise<T> {
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
          'Authorization': `Bearer ${MCP_AUTH}`,
        },
        timeout: 30000, // 30 second timeout
      }
    )

    // Validate JSON-RPC response structure
    if (!response.data.jsonrpc || response.data.jsonrpc !== '2.0') {
      throw new Error(`Invalid JSON-RPC response for ${name}`)
    }

    // Check for JSON-RPC level errors
    if (response.data.error) {
      throw new Error(`MCP Error (${name}): ${response.data.error.message}`)
    }

    const result = response.data.result?.content?.[0]?.text
    if (!result) {
      throw new Error(`Missing content in MCP response for ${name}`)
    }

    let parsed: MCPSuccess<T> | MCPError
    try {
      parsed = JSON.parse(result)
    } catch (parseError) {
      throw new Error(`Failed to parse JSON response from ${name}: ${parseError}`)
    }

    if (!parsed.success) {
      throw new Error(`Tool ${name} failed: ${parsed.error || 'Unknown error'}`)
    }

    // Return the whole object excluding success flag
    const { success, ...data } = parsed as MCPSuccess<T>
    return data as unknown as T
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
// Task Service Functions
// ============================================================================

/**
 * Create a new task
 */
export async function createTask(input: CreateTaskInput): Promise<{ task: Task; message: string }> {
  return callMCPTool('create_task', input)
}

/**
 * Update an existing task
 */
export async function updateTask(taskId: string, input: UpdateTaskInput): Promise<{ task: Task; message: string }> {
  return callMCPTool('update_task', { task_id: taskId, ...input })
}

/**
 * Get a single task with dependencies
 */
export async function getTask(taskId: string): Promise<TaskWithDependencies> {
  return callMCPTool('get_task', { task_id: taskId })
}

/**
 * List tasks with optional filters
 */
export async function listTasks(input: ListTasksInput = {}): Promise<{
  tasks: Task[]
  count: number
  limit: number
  offset: number
}> {
  return callMCPTool('list_tasks', input)
}

/**
 * Delete a task
 */
export async function deleteTask(taskId: string): Promise<{ message: string; task_id: string }> {
  return callMCPTool('delete_task', { task_id: taskId })
}

/**
 * Get project summary with statistics
 */
export async function getProjectSummary(projectId: string): Promise<ProjectDetail> {
  const raw = await callMCPTool<{
    project_id: string
    summary: {
      total_tasks: string
      completed_tasks: string
      in_progress_tasks: string
      blocked_tasks: string
      backlog_tasks: string
      progress_percentage: string
      overdue_tasks: string
    }
    blocking_tasks: Task[]
    recent_tasks: Task[]
  }>('get_project_summary', { project_id: projectId })

  // Convert string counts to numbers
  return {
    project_id: raw.project_id,
    summary: {
      project_id: raw.project_id,
      total_tasks: parseInt(raw.summary.total_tasks, 10),
      completed_tasks: parseInt(raw.summary.completed_tasks, 10),
      in_progress_tasks: parseInt(raw.summary.in_progress_tasks, 10),
      blocked_tasks: parseInt(raw.summary.blocked_tasks, 10),
      backlog_tasks: parseInt(raw.summary.backlog_tasks, 10),
      progress_percentage: parseFloat(raw.summary.progress_percentage),
      overdue_tasks: parseInt(raw.summary.overdue_tasks, 10),
    },
    blocking_tasks: raw.blocking_tasks,
    recent_tasks: raw.recent_tasks,
  }
}

/**
 * Get task dependency graph (recursive)
 */
export async function getTaskDependencies(taskId: string, depth: number = 2): Promise<TaskDependencies> {
  return callMCPTool('get_task_dependencies', { task_id: taskId, depth })
}

/**
 * List all projects with summaries
 */
export async function listProjects(limit: number = 50): Promise<{
  projects: Array<ProjectSummary & { project_id: string; task_count: number }>
  count: number
}> {
  const raw = await callMCPTool<{
    projects: Array<{
      project_id: string
      task_count: number
      total_tasks: string
      completed_tasks: string
      in_progress_tasks: string
      blocked_tasks: string
      backlog_tasks: string
      progress_percentage: string
      overdue_tasks: string
    }>
    count: number
  }>('list_projects', { limit })

  // Convert string counts to numbers
  return {
    projects: raw.projects.map(p => ({
      ...p,
      total_tasks: parseInt(p.total_tasks, 10),
      completed_tasks: parseInt(p.completed_tasks, 10),
      in_progress_tasks: parseInt(p.in_progress_tasks, 10),
      blocked_tasks: parseInt(p.blocked_tasks, 10),
      backlog_tasks: parseInt(p.backlog_tasks, 10),
      progress_percentage: parseFloat(p.progress_percentage),
      overdue_tasks: parseInt(p.overdue_tasks, 10),
    })),
    count: raw.count,
  }
}
