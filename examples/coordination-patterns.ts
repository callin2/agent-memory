/**
 * Coordination Patterns for Multi-Agent Teams
 *
 * Demonstrates the BBS (Bulletin Board System) + Kanban workflow for
 * coordinating multiple agents working on a shared project.
 *
 * Scenario: Building OAuth authentication feature
 * - 3 agents: Database Agent, Backend Agent, Frontend Agent
 * - Each agent: claim_task → do work → complete_task → post_finding
 * - Dependencies: Backend waits for Database, Frontend waits for Backend
 * - Lead agent monitors progress via Kanban board
 */

const API_BASE = process.env.API_BASE || 'http://localhost:3456';
const MCP_URL = process.env.MCP_URL || 'http://localhost:4000/mcp';
const TENANT_ID = 'default';
const MCP_AUTH = process.env.MCP_AUTH || 'test-mcp-token';

// ============================================================================
// TypeScript Interfaces
// ============================================================================

interface TaskNode {
  node_id: string;
  title: string;
  description: string;
}

interface AgentContext {
  agentName: string;
  taskId: string;
  projectId: string;
}

interface MCPResponse {
  jsonrpc: string;
  id: number;
  result?: { content: Array<{ text: string }> };
  error?: { code: number; message: string };
}

interface KnowledgeNote {
  id: string;
  node_id: string;
  text: string;
  with_whom?: string;
  tags?: string[];
  created_at: string;
}

interface KanbanBoard {
  success: boolean;
  project_node_id: string;
  todo: Array<{
    node_id: string;
    title: string;
    properties: { status: string; agent?: string };
  }>;
  doing: Array<{
    node_id: string;
    title: string;
    properties: { status: string; agent?: string };
  }>;
  done: Array<{
    node_id: string;
    title: string;
    properties: { status: string; agent?: string };
  }>;
  total: number;
}

// ============================================================================
// MCP Client Helper
// ============================================================================

/**
 * Call an MCP tool via HTTP POST
 */
async function callMCPTool(
  name: string,
  args: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const response = await fetch(MCP_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${MCP_AUTH}`,
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: Date.now(),
      method: 'tools/call',
      params: { name, arguments: args },
    }),
  });

  const data = (await response.json()) as MCPResponse;

  if (data.error) {
    throw new Error(`MCP error (${name}): ${data.error.message}`);
  }

  const resultText = data.result?.content?.[0]?.text;
  if (!resultText) {
    throw new Error(`Empty response from ${name}`);
  }

  return JSON.parse(resultText);
}

// ============================================================================
// BBS (Bulletin Board System) Pattern - Post/Get Findings
// ============================================================================

/**
 * DEMONSTRATED: post_finding pattern
 *
 * Post a finding to the team bulletin board.
 * Findings are knowledge notes that other agents can discover.
 *
 * Tool used: create_knowledge_note
 */
async function postFinding(
  agentName: string,
  taskId: string,
  text: string,
  tags?: string[]
): Promise<KnowledgeNote> {
  console.log(`[${agentName}] Posting finding: ${text.substring(0, 50)}...`);

  const result = await callMCPTool('create_knowledge_note', {
    tenant_id: TENANT_ID,
    text,
    with_whom: agentName,
    tags: tags || [],
    project_path: taskId, // Link finding to task
  });

  return result as KnowledgeNote;
}

/**
 * DEMONSTRATED: get_team_findings pattern
 *
 * Get all findings posted by the team.
 * Used by lead agent to review all work completed.
 *
 * Tool used: get_knowledge_notes
 */
async function getTeamFindings(
  projectPath?: string
): Promise<KnowledgeNote[]> {
  console.log('\n--- Team Findings (BBS) ---');

  const result = await callMCPTool('get_knowledge_notes', {
    tenant_id: TENANT_ID,
    project_path: projectPath,
    limit: 100,
  });

  const findings = (result as { results: KnowledgeNote[] }).results || [];
  findings.forEach((finding) => {
    console.log(`  [${finding.with_whom || 'Unknown'}] ${finding.text}`);
  });

  return findings;
}

// ============================================================================
// Kanban Pattern - Claim/Complete Tasks
// ============================================================================

/**
 * DEMONSTRATED: claim_task pattern
 *
 * Claim a task by updating its status to 'doing'.
 * This signals to other agents that the task is being worked on.
 *
 * Tool used: update_edge_properties
 */
async function claimTask(
  agentName: string,
  taskId: string,
  projectId: string
): Promise<string> {
  console.log(`[${agentName}] Claiming task ${taskId}...`);

  // First, find the edge linking task to project
  const edgesResult = await callMCPTool('get_edges', {
    node_id: taskId,
    direction: 'incoming',
    type: 'child_of',
    tenant_id: TENANT_ID,
  });

  const edges = (edgesResult as { edges: unknown[] }).edges;
  if (!edges || edges.length === 0) {
    throw new Error(`Task ${taskId} has no parent edge`);
  }

  const edgeId = (edges[0] as { edge_id: string }).edge_id;

  // Update status to 'doing' to claim the task
  await callMCPTool('update_edge_properties', {
    edge_id: edgeId,
    properties: {
      status: 'doing',
      agent: agentName,
      started_at: new Date().toISOString(),
    },
    tenant_id: TENANT_ID,
  });

  console.log(`[${agentName}] Task claimed!`);
  return edgeId;
}

/**
 * DEMONSTRATED: complete_task pattern
 *
 * Mark a task as complete by updating status to 'done'.
 * Unblocks other tasks that depend on this one.
 *
 * Tool used: update_edge_properties
 */
async function completeTask(
  agentName: string,
  taskId: string,
  edgeId: string,
  findingNodeId?: string
): Promise<void> {
  console.log(`[${agentName}] Completing task ${taskId}...`);

  // Update status to 'done'
  await callMCPTool('update_edge_properties', {
    edge_id: edgeId,
    properties: {
      status: 'done',
      completed_at: new Date().toISOString(),
      ...(findingNodeId && { findings_node_id: findingNodeId }),
    },
    tenant_id: TENANT_ID,
  });

  console.log(`[${agentName}] Task completed!`);
}

/**
 * DEMONSTRATED: get_kanban_board pattern
 *
 * Get the Kanban board view showing all tasks and their status.
 * Used by lead to monitor project progress.
 *
 * Tool used: get_project_tasks
 */
async function getKanbanBoard(projectId: string): Promise<KanbanBoard> {
  console.log('\n=== Kanban Board ===');

  const result = await callMCPTool('get_project_tasks', {
    project_node_id: projectId,
    tenant_id: TENANT_ID,
  });

  const board = result as KanbanBoard;

  console.log(`\n📋 TODO (${board.todo.length}):`);
  board.todo.forEach((task) => {
    console.log(`  ⬜ ${task.title}`);
  });

  console.log(`\n🔄 IN PROGRESS (${board.doing.length}):`);
  board.doing.forEach((task) => {
    console.log(`  🟡 ${task.title} (${task.properties.agent})`);
  });

  console.log(`\n✅ DONE (${board.done.length}):`);
  board.done.forEach((task) => {
    console.log(`  ✅ ${task.title} (${task.properties.agent})`);
  });

  console.log(`\nTotal: ${board.total} tasks\n`);

  return board;
}

// ============================================================================
// Dependency Waiting Pattern
// ============================================================================

/**
 * DEMONSTRATED: wait_for_dependencies pattern
 *
 * Wait for all dependencies of a task to complete before starting work.
 * Uses polling to check status of dependent tasks.
 *
 * Tools used: get_edges, get_edges (for status checks)
 */
async function waitForDependencies(
  agentName: string,
  taskId: string,
  pollIntervalMs = 2000
): Promise<void> {
  console.log(`[${agentName}] Checking dependencies...`);

  // Get depends_on edges (tasks this task depends on)
  const depsResult = await callMCPTool('get_edges', {
    node_id: taskId,
    direction: 'incoming',
    type: 'depends_on',
    tenant_id: TENANT_ID,
  });

  const dependencies = (depsResult as { edges: unknown[] }).edges;

  if (dependencies.length === 0) {
    console.log(`[${agentName}] No dependencies to wait for.`);
    return;
  }

  console.log(
    `[${agentName}] Waiting for ${dependencies.length} dependencies...`
  );

  // Poll until all dependencies are done
  while (true) {
    let allDone = true;

    for (const dep of dependencies as { to_node_id: string }[]) {
      // Get the status edge of the dependency task
      const statusResult = await callMCPTool('get_edges', {
        node_id: dep.to_node_id,
        direction: 'incoming',
        type: 'child_of',
        tenant_id: TENANT_ID,
      });

      const statusEdges = (statusResult as { edges: unknown[] }).edges;

      if (statusEdges.length === 0) {
        console.warn(`  Dependency ${dep.to_node_id} has no status edge`);
        continue;
      }

      const status = (statusEdges[0] as { properties: { status?: string } })
        .properties?.status;

      if (status !== 'done') {
        allDone = false;
        console.log(
          `  [${agentName}] Still waiting for ${dep.to_node_id} (status: ${status || 'todo'})`
        );
        break;
      }
    }

    if (allDone) {
      console.log(`[${agentName}] All dependencies complete!`);
      return;
    }

    // Wait before polling again
    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
  }
}

// ============================================================================
// Example Scenario: Build OAuth Authentication Feature
// ============================================================================

/**
 * Scenario: 3 agents building OAuth authentication
 *
 * Task Flow:
 * 1. Database Agent: Create users table + OAuth tables
 * 2. Backend Agent: Implement OAuth endpoints (waits for DB)
 * 3. Frontend Agent: Build login UI (waits for Backend)
 */

async function setupOAuthProject(): Promise<{
  projectId: string;
  dbTaskId: string;
  backendTaskId: string;
  frontendTaskId: string;
}> {
  console.log('\n=== Setup: Creating OAuth Project ===\n');

  // 1. Create project knowledge note
  const projectResult = await callMCPTool('create_knowledge_note', {
    tenant_id: TENANT_ID,
    text: 'OAuth Authentication Feature - Add Google OAuth login to the application',
    with_whom: 'project-lead',
    tags: ['project', 'oauth', 'feature'],
  });

  const project = projectResult as { node_id: string };
  const projectId = project.node_id;
  console.log(`✓ Created project: ${projectId}`);

  // 2. Create task knowledge notes
  const dbTaskResult = await callMCPTool('create_knowledge_note', {
    tenant_id: TENANT_ID,
    text: 'Create database schema for OAuth - users table, oauth_accounts table, and sessions table',
    with_whom: 'database-agent',
    tags: ['task', 'database', 'oauth'],
  });

  const dbTaskId = (dbTaskResult as { node_id: string }).node_id;
  console.log(`✓ Created DB task: ${dbTaskId}`);

  const backendTaskResult = await callMCPTool('create_knowledge_note', {
    tenant_id: TENANT_ID,
    text: 'Implement OAuth backend endpoints - /auth/google, /callback, /logout with JWT tokens',
    with_whom: 'backend-agent',
    tags: ['task', 'backend', 'oauth'],
  });

  const backendTaskId = (backendTaskResult as { node_id: string }).node_id;
  console.log(`✓ Created Backend task: ${backendTaskId}`);

  const frontendTaskResult = await callMCPTool('create_knowledge_note', {
    tenant_id: TENANT_ID,
    text: 'Build OAuth login UI - "Sign in with Google" button, callback handler, session display',
    with_whom: 'frontend-agent',
    tags: ['task', 'frontend', 'oauth'],
  });

  const frontendTaskId = (frontendTaskResult as { node_id: string }).node_id;
  console.log(`✓ Created Frontend task: ${frontendTaskId}`);

  // 3. Link tasks to project (parent_of edges)
  await callMCPTool('create_edge', {
    from_node_id: projectId,
    to_node_id: dbTaskId,
    type: 'parent_of',
    properties: { status: 'todo', priority: 'high' },
    tenant_id: TENANT_ID,
  });

  await callMCPTool('create_edge', {
    from_node_id: projectId,
    to_node_id: backendTaskId,
    type: 'parent_of',
    properties: { status: 'todo', priority: 'high' },
    tenant_id: TENANT_ID,
  });

  await callMCPTool('create_edge', {
    from_node_id: projectId,
    to_node_id: frontendTaskId,
    type: 'parent_of',
    properties: { status: 'todo', priority: 'high' },
    tenant_id: TENANT_ID,
  });

  console.log('✓ Linked tasks to project');

  // 4. Create dependencies: Backend → Database, Frontend → Backend
  await callMCPTool('create_edge', {
    from_node_id: backendTaskId,
    to_node_id: dbTaskId,
    type: 'depends_on',
    properties: {},
    tenant_id: TENANT_ID,
  });

  await callMCPTool('create_edge', {
    from_node_id: frontendTaskId,
    to_node_id: backendTaskId,
    type: 'depends_on',
    properties: {},
    tenant_id: TENANT_ID,
  });

  console.log('✓ Created task dependencies');
  console.log('  Backend → Database (Backend waits for DB)');
  console.log('  Frontend → Backend (Frontend waits for Backend)\n');

  return { projectId, dbTaskId, backendTaskId, frontendTaskId };
}

/**
 * DEMONSTRATED: Full agent workflow
 * - claim_task → do work → complete_task → post_finding
 */
async function databaseAgentWorkflow(taskId: string, projectId: string) {
  const agentName = 'database-agent';

  // Step 1: Claim task
  const edgeId = await claimTask(agentName, taskId, projectId);

  // Step 2: Simulate doing the work
  console.log(`[${agentName}] Creating database schema...`);
  await new Promise((resolve) => setTimeout(resolve, 1000));

  // Step 3: Post findings to BBS
  const finding = await postFinding(
    agentName,
    taskId,
    'Created users table with id, email, name columns. Created oauth_accounts table with provider, provider_user_id, user_id. Added indexes for fast lookups.',
    ['database', 'schema', 'oauth', 'completed']
  );
  console.log(`[${agentName}] Finding posted: ${finding.node_id}`);

  // Step 4: Complete task
  await completeTask(agentName, taskId, edgeId, finding.node_id);
}

/**
 * DEMONSTRATED: Agent workflow with dependency waiting
 * - wait_for_dependencies → claim_task → do work → complete_task → post_finding
 */
async function backendAgentWorkflow(taskId: string, projectId: string) {
  const agentName = 'backend-agent';

  // Step 1: Wait for Database task to complete
  await waitForDependencies(agentName, taskId);

  // Step 2: Claim task
  const edgeId = await claimTask(agentName, taskId, projectId);

  // Step 3: Simulate doing the work
  console.log(`[${agentName}] Implementing OAuth endpoints...`);
  await new Promise((resolve) => setTimeout(resolve, 1000));

  // Step 4: Post findings to BBS
  const finding = await postFinding(
    agentName,
    taskId,
    'Implemented /auth/google endpoint (redirects to Google OAuth). Implemented /callback endpoint (exchanges code for tokens, creates/updates user). JWT tokens stored in httpOnly cookies.',
    ['backend', 'oauth', 'api', 'completed']
  );
  console.log(`[${agentName}] Finding posted: ${finding.node_id}`);

  // Step 5: Complete task
  await completeTask(agentName, taskId, edgeId, finding.node_id);
}

/**
 * DEMONSTRATED: Agent workflow with dependency waiting
 * - wait_for_dependencies → claim_task → do work → complete_task → post_finding
 */
async function frontendAgentWorkflow(taskId: string, projectId: string) {
  const agentName = 'frontend-agent';

  // Step 1: Wait for Backend task to complete
  await waitForDependencies(agentName, taskId);

  // Step 2: Claim task
  const edgeId = await claimTask(agentName, taskId, projectId);

  // Step 3: Simulate doing the work
  console.log(`[${agentName}] Building login UI...`);
  await new Promise((resolve) => setTimeout(resolve, 1000));

  // Step 4: Post findings to BBS
  const finding = await postFinding(
    agentName,
    taskId,
    'Added "Sign in with Google" button to login page. Handles OAuth callback, stores JWT token, shows user profile when authenticated. Logout clears cookies.',
    ['frontend', 'oauth', 'ui', 'completed']
  );
  console.log(`[${agentName}] Finding posted: ${finding.node_id}`);

  // Step 5: Complete task
  await completeTask(agentName, taskId, edgeId, finding.node_id);
}

/**
 * DEMONSTRATED: Lead agent monitoring workflow
 * - Monitor Kanban board → Review team findings
 */
async function leadAgentWorkflow(projectId: string) {
  const agentName = 'project-lead';

  console.log(`\n[${agentName}] Monitoring project progress...`);

  // Check Kanban board
  const board = await getKanbanBoard(projectId);

  // Log status
  console.log(
    `[${agentName}] Status: ${board.done.length}/${board.total} tasks complete`
  );

  // Get all team findings
  await getTeamFindings();

  return board;
}

// ============================================================================
// Main Example Run
// ============================================================================

/**
 * Run the complete OAuth feature example
 *
 * Demonstrates:
 * 1. Setup: Create project and tasks with dependencies
 * 2. Database Agent: claim_task → do work → complete_task → post_finding
 * 3. Backend Agent: wait_for_dependencies → claim_task → do work → complete_task → post_finding
 * 4. Frontend Agent: wait_for_dependencies → claim_task → do work → complete_task → post_finding
 * 5. Lead: get_kanban_board → get_team_findings
 */
async function runOAuthExample() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║     Multi-Agent Coordination: BBS + Kanban Pattern        ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  try {
    // ========================================================================
    // Step 1: Setup - Create project and tasks
    // ========================================================================
    const { projectId, dbTaskId, backendTaskId, frontendTaskId } =
      await setupOAuthProject();

    // Show initial Kanban board
    await leadAgentWorkflow(projectId);

    // ========================================================================
    // Step 2: Database Agent works (no dependencies)
    // ========================================================================
    console.log('\n=== Database Agent (No Dependencies) ===');
    await databaseAgentWorkflow(dbTaskId, projectId);

    // Show progress
    await leadAgentWorkflow(projectId);

    // ========================================================================
    // Step 3: Backend Agent works (waits for Database)
    // ========================================================================
    console.log('\n=== Backend Agent (Waits for Database) ===');
    await backendAgentWorkflow(backendTaskId, projectId);

    // Show progress
    await leadAgentWorkflow(projectId);

    // ========================================================================
    // Step 4: Frontend Agent works (waits for Backend)
    // ========================================================================
    console.log('\n=== Frontend Agent (Waits for Backend) ===');
    await frontendAgentWorkflow(frontendTaskId, projectId);

    // ========================================================================
    // Step 5: Final review
    // ========================================================================
    console.log('\n=== Final Review ===');
    const finalBoard = await leadAgentWorkflow(projectId);

    if (finalBoard.total === finalBoard.done.length) {
      console.log('\n✅ All tasks completed successfully!');
    }

    console.log('\n=== Summary ===');
    console.log('Tools demonstrated:');
    console.log('  • create_knowledge_note - Post findings to BBS');
    console.log('  • get_knowledge_notes - Get team findings');
    console.log('  • create_edge - Link tasks, create dependencies');
    console.log('  • get_edges - Check dependencies, find task edges');
    console.log('  • update_edge_properties - Claim/complete tasks');
    console.log('  • get_project_tasks - Get Kanban board view');
  } catch (error) {
    console.error('❌ Example failed:', error);
    throw error;
  }
}

// ============================================================================
// Additional Pattern Examples
// ============================================================================

/**
 * Pattern: Parallel Independent Tasks
 *
 * When multiple tasks can be done in parallel (no dependencies),
 * agents can claim and work simultaneously.
 */
async function parallelTasksExample() {
  console.log('\n=== Pattern: Parallel Independent Tasks ===\n');

  const projectId = 'project-parallel';

  // Create independent tasks
  const taskIds = ['task-a', 'task-b', 'task-c'];

  console.log('Creating 3 independent tasks...');

  // In a real system, these would be created as knowledge notes
  // with parent_of edges to the project

  console.log('All 3 agents can work in parallel!');
  console.log('Agent 1 → Task A');
  console.log('Agent 2 → Task B');
  console.log('Agent 3 → Task C');

  // Each agent independently:
  // 1. claim_task(taskId)
  // 2. do_work()
  // 3. complete_task(taskId)
  // 4. post_finding(...)

  console.log('\nNo waiting needed - tasks are independent!\n');
}

/**
 * Pattern: Fan-In / Fan-Out
 *
 * Fan-out: One task completes, enabling multiple downstream tasks
 * Fan-in: Multiple tasks must complete before one task can start
 */
async function fanInFanOutExample() {
  console.log('\n=== Pattern: Fan-In / Fan-Out ===\n');

  console.log('Fan-Out (one enables many):');
  console.log('  Design Doc →');
  console.log('    → Frontend Task');
  console.log('    → Backend Task');
  console.log('    → Database Task');
  console.log('  (All three can start after Design completes)\n');

  console.log('Fan-In (many enable one):');
  console.log('  Frontend Task ─┐');
  console.log('  Backend Task  ─┼→ Integration Test Task');
  console.log('  Database Task ─┘');
  console.log('  (Test waits for all three to complete)\n');
}

/**
 * Pattern: Iterative Refinement
 *
 * Agent completes task, posts finding, then claims related task
 * based on what they learned.
 */
async function iterativeRefinementExample() {
  console.log('\n=== Pattern: Iterative Refinement ===\n');

  console.log('Workflow:');
  console.log('  1. Agent claims "Implement Feature X"');
  console.log('  2. Agent discovers edge case during work');
  console.log('  3. Agent completes task, posts finding about edge case');
  console.log('  4. Lead reviews finding, creates "Handle Edge Case" task');
  console.log('  5. Agent claims new task, handles edge case\n');

  console.log('This allows adaptive planning based on real discoveries!\n');
}

// ============================================================================
// Export and Run
// ============================================================================

export {
  // BBS Pattern
  postFinding,
  getTeamFindings,

  // Kanban Pattern
  claimTask,
  completeTask,
  getKanbanBoard,

  // Dependency Pattern
  waitForDependencies,

  // Full Workflows
  databaseAgentWorkflow,
  backendAgentWorkflow,
  frontendAgentWorkflow,
  leadAgentWorkflow,

  // Main Example
  runOAuthExample,

  // Pattern Examples
  parallelTasksExample,
  fanInFanOutExample,
  iterativeRefinementExample,
};

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runOAuthExample()
    .then(() => {
      console.log('\n✅ Coordination patterns example completed!');
    })
    .catch((error) => {
      console.error('❌ Example failed:', error);
      process.exit(1);
    });
}
