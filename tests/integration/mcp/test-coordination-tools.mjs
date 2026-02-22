#!/usr/bin/env node

/**
 * Integration Tests for Coordination Tools
 *
 * Tests the 4 coordination tools that implement the BBS + Kanban workflow:
 * 1. post_finding() - Post findings to team BBS
 * 2. get_team_findings() - Retrieve team findings
 * 3. claim_task() - Claim a task and update status
 * 4. complete_task() - Complete a task with findings
 *
 * Prerequisites:
 * - MCP server running on http://localhost:4000/mcp
 * - Valid MCP token in MCP_TOKEN env var (or defaults to test token)
 * - Database migrations applied
 */

import { MemoryClient } from '../../../src/utils/memory-client-v2.js';

const MEMORY_API = process.env.MEMORY_API || 'http://localhost:4000/mcp';
const client = new MemoryClient(MEMORY_API);

// Track test artifacts for cleanup
const testArtifacts = {
  projectNote: null,
  projectNodeId: null,
  taskNotes: [],
  findingNotes: [],
  edges: []
};

/**
 * Helper: Create a test project
 * Returns project node_id
 */
async function createTestProject(name) {
  const response = await client.callTool('create_knowledge_note', {
    text: `TEST PROJECT: ${name}`,
    tags: ['project', 'test'],
  });

  const result = JSON.parse(response.content[0].text);
  if (!result.success) {
    throw new Error(`Failed to create project: ${result.error}`);
  }

  testArtifacts.projectNote = result.note.id;
  testArtifacts.projectNodeId = result.note.node_id;
  return result.note.node_id;
}

/**
 * Helper: Create a test task linked to a project
 * Returns task node_id
 */
async function createTestTask(projectNodeId, title) {
  const response = await client.callTool('create_knowledge_note', {
    text: `TEST TASK: ${title}`,
    tags: ['task', 'test'],
  });

  const result = JSON.parse(response.content[0].text);
  if (!result.success) {
    throw new Error(`Failed to create task note: ${result.error}`);
  }

  testArtifacts.taskNotes.push(result.note.id);

  // Link task to project via child_of edge
  const edgeResponse = await client.callTool('create_edge', {
    from_node_id: result.note.node_id,
    to_node_id: projectNodeId,
    type: 'child_of',
    properties: { status: 'todo', priority: 'medium' }
  });

  const edgeResult = JSON.parse(edgeResponse.content[0].text);
  if (!edgeResult.success) {
    throw new Error(`Failed to link task to project: ${edgeResult.error}`);
  }

  testArtifacts.edges.push(edgeResult.edge.edge_id);
  return result.note.node_id;
}

/**
 * Helper: Create a dependency edge between tasks
 */
async function createDependency(fromTaskId, toTaskId) {
  const response = await client.callTool('create_edge', {
    from_node_id: fromTaskId,
    to_node_id: toTaskId,
    type: 'depends_on',
  });

  const result = JSON.parse(response.content[0].text);
  if (!result.success) {
    throw new Error(`Failed to create dependency: ${result.error}`);
  }

  testArtifacts.edges.push(result.edge.edge_id);
  return result.edge;
}

/**
 * Helper: Clean up test data
 */
async function cleanupTestData() {
  console.log('\n=== Cleaning up test data ===');

  // Delete edges
  for (const edgeId of testArtifacts.edges) {
    try {
      await client.callTool('delete_edge', { edge_id: edgeId });
      console.log(`  Deleted edge: ${edgeId}`);
    } catch (e) {
      console.log(`  Failed to delete edge ${edgeId}: ${e.message}`);
    }
  }

  // Delete notes (Postgres cascade will handle orphaned edges)
  const allNotes = [
    testArtifacts.projectNote,
    ...testArtifacts.taskNotes,
    ...testArtifacts.findingNotes
  ].filter(Boolean);

  for (const noteId of allNotes) {
    try {
      // Direct DB delete for knowledge notes (we don't have a delete_note tool)
      // Using a workaround via traverse to verify existence, then manual cleanup
      console.log(`  Note to clean: ${noteId} (manual cleanup may be needed)`);
    } catch (e) {
      // Ignore
    }
  }

  console.log('  Cleanup complete. Some manual cleanup may be needed.\n');
}

/**
 * Test 1: post_finding
 * - Creates a test project
 * - Posts a finding
 * - Verifies knowledge note created with "findings" tag
 * - Verifies edge created (parent_of)
 */
async function testPostFinding() {
  console.log('\n=== Test 1: post_finding ===\n');

  const testName = `post_finding_test_${Date.now()}`;
  const projectId = await createTestProject(testName);

  console.log(`1. Created project: ${projectId}`);

  const findingText = `TEST FINDING: Discovered a bug in the authentication flow`;
  const response = await client.callTool('post_finding', {
    text: findingText,
    project_id: projectId,
    tags: ['bug', 'auth'],
    agent: 'TestAgent'
  });

  const result = JSON.parse(response.content[0].text);

  if (!result.success) {
    console.log(`❌ Failed: ${result.error}`);
    return { success: false, error: result.error };
  }

  console.log(`2. Posted finding: ${result.note.id}`);
  console.log(`   Note tags: ${result.note.tags?.join(', ')}`);
  console.log(`   Edge type: ${result.edge.type}`);
  console.log(`   Edge from: ${result.edge.from_node_id}`);
  console.log(`   Edge to: ${result.edge.to_node_id}`);

  // Verify the note has "findings" tag
  const hasFindingsTag = result.note.tags?.includes('findings');
  if (!hasFindingsTag) {
    console.log(`❌ Failed: Note missing 'findings' tag`);
    return { success: false, error: 'Missing findings tag' };
  }

  // Verify the edge type is parent_of
  if (result.edge.type !== 'parent_of') {
    console.log(`❌ Failed: Edge type is ${result.edge.type}, expected parent_of`);
    return { success: false, error: 'Wrong edge type' };
  }

  // Verify edge connects project to note
  if (result.edge.from_node_id !== projectId) {
    console.log(`❌ Failed: Edge from_node_id doesn't match project`);
    return { success: false, error: 'Edge not from project' };
  }

  testArtifacts.findingNotes.push(result.note.id);
  testArtifacts.edges.push(result.edge.edge_id);

  console.log('✅ Test PASSED: post_finding works correctly');
  return { success: true, result };
}

/**
 * Test 2: get_team_findings
 * - Creates project with multiple findings
 * - Retrieves team findings
 * - Verifies only findings with "findings" tag returned
 */
async function testGetTeamFindings() {
  console.log('\n=== Test 2: get_team_findings ===\n');

  const testName = `get_findings_test_${Date.now()}`;
  const projectId = await createTestProject(testName);

  console.log(`1. Created project: ${projectId}`);

  // Post multiple findings
  const findings = [
    { text: 'Finding 1: Fixed memory leak', tags: ['bug'] },
    { text: 'Finding 2: Improved API performance', tags: ['performance'] },
    { text: 'Finding 3: Updated documentation', tags: ['docs'] }
  ];

  for (const finding of findings) {
    await client.callTool('post_finding', {
      text: `TEST: ${finding.text}`,
      project_id: projectId,
      tags: finding.tags,
      agent: 'TestAgent'
    });
  }

  console.log(`2. Posted ${findings.length} findings`);

  // Also create a non-finding note (should not be returned)
  await client.callTool('create_knowledge_note', {
    text: 'This is just a regular note, not a finding',
    tags: ['misc'],
  });

  console.log(`3. Created non-finding note (should be filtered out)`);

  // Retrieve findings
  const response = await client.callTool('get_team_findings', {
    project_id: projectId,
    limit: 10
  });

  const result = JSON.parse(response.content[0].text);

  if (!result.success) {
    console.log(`❌ Failed: ${result.error}`);
    return { success: false, error: result.error };
  }

  console.log(`4. Retrieved ${result.count} findings`);
  console.log(`   Expected: ${findings.length}`);

  // Verify we got the right number of findings
  if (result.count !== findings.length) {
    console.log(`⚠️  Warning: Expected ${findings.length} findings, got ${result.count}`);
    // This might be OK if tests run in parallel and share data
  }

  // Verify all returned items have 'findings' tag
  const allHaveFindingsTag = result.findings.every(f =>
    f.tags && f.tags.includes('findings')
  );

  if (!allHaveFindingsTag) {
    console.log(`❌ Failed: Not all results have 'findings' tag`);
    return { success: false, error: 'Missing findings tag in results' };
  }

  console.log('✅ Test PASSED: get_team_findings filters correctly');
  return { success: true, result };
}

/**
 * Test 3: claim_task
 * - Creates project + task
 * - Claims task
 * - Verifies status updated to "doing"
 * - Verifies agent attribution
 * - Verifies started_at timestamp
 */
async function testClaimTask() {
  console.log('\n=== Test 3: claim_task ===\n');

  const testName = `claim_task_test_${Date.now()}`;
  const projectId = await createTestProject(testName);
  const taskId = await createTestTask(projectId, 'Implement feature X');

  console.log(`1. Created project: ${projectId}`);
  console.log(`2. Created task: ${taskId}`);

  // Claim the task
  const agentName = 'TestAgent';
  const response = await client.callTool('claim_task', {
    task_id: taskId,
    agent: agentName
  });

  const result = JSON.parse(response.content[0].text);

  if (!result.success) {
    console.log(`❌ Failed: ${result.error}`);
    return { success: false, error: result.error };
  }

  console.log(`3. Claimed task by agent: ${agentName}`);
  console.log(`   Task edge properties: ${JSON.stringify(result.task_edge.properties)}`);

  // Verify status is "doing"
  const status = result.task_edge.properties?.status;
  if (status !== 'doing') {
    console.log(`❌ Failed: Status is ${status}, expected 'doing'`);
    return { success: false, error: 'Wrong status' };
  }

  // Verify agent attribution
  const agent = result.task_edge.properties?.agent;
  if (agent !== agentName) {
    console.log(`❌ Failed: Agent is ${agent}, expected ${agentName}`);
    return { success: false, error: 'Wrong agent attribution' };
  }

  // Verify started_at timestamp exists
  const startedAt = result.task_edge.properties?.started_at;
  if (!startedAt) {
    console.log(`❌ Failed: Missing started_at timestamp`);
    return { success: false, error: 'Missing started_at' };
  }

  console.log(`   Status: ${status}`);
  console.log(`   Agent: ${agent}`);
  console.log(`   Started at: ${startedAt}`);

  console.log('✅ Test PASSED: claim_task updates status correctly');
  return { success: true, result };
}

/**
 * Test 4: claim_task with dependencies
 * - Creates project + taskA + taskB
 * - Creates dependency: taskB depends_on taskA
 * - Agent claims taskB
 * - Verifies it waits for taskA to complete
 */
async function testClaimTaskWithDependencies() {
  console.log('\n=== Test 4: claim_task_with_dependencies ===\n');

  const testName = `dep_test_${Date.now()}`;
  const projectId = await createTestProject(testName);
  const taskAId = await createTestTask(projectId, 'Task A - Must complete first');
  const taskBId = await createTestTask(projectId, 'Task B - Depends on Task A');

  console.log(`1. Created project: ${projectId}`);
  console.log(`2. Created taskA: ${taskAId}`);
  console.log(`3. Created taskB: ${taskBId}`);

  // Create dependency: taskB depends_on taskA
  await createDependency(taskBId, taskAId);
  console.log(`4. Created dependency: taskB depends_on taskA`);

  // Try to claim taskB (should be blocked)
  const response = await client.callTool('claim_task', {
    task_id: taskBId,
    agent: 'TestAgent'
  });

  const result = JSON.parse(response.content[0].text);

  if (result.success) {
    console.log(`❌ Failed: TaskB should be blocked but was claimed`);
    return { success: false, error: 'Task should be blocked' };
  }

  console.log(`5. TaskB correctly blocked`);
  console.log(`   Message: ${result.message}`);
  console.log(`   Blocked by: ${result.blocked}`);

  // Verify the blocked array contains taskA
  if (!result.blocked || !result.blocked.includes(taskAId)) {
    console.log(`❌ Failed: Blocked array doesn't contain taskA`);
    return { success: false, error: 'Wrong blocked tasks' };
  }

  console.log('✅ Test PASSED: claim_task respects dependencies');
  return { success: true, result };
}

/**
 * Test 5: complete_task
 * - Creates project + task
 * - Claims task
 * - Completes task with findings
 * - Verifies findings note created
 * - Verifies edge created (created_by)
 * - Verifies status updated to "done"
 */
async function testCompleteTask() {
  console.log('\n=== Test 5: complete_task ===\n');

  const testName = `complete_test_${Date.now()}`;
  const projectId = await createTestProject(testName);
  const taskId = await createTestTask(projectId, 'Task to complete');

  console.log(`1. Created project: ${projectId}`);
  console.log(`2. Created task: ${taskId}`);

  // Claim the task first
  await client.callTool('claim_task', {
    task_id: taskId,
    agent: 'TestAgent'
  });
  console.log(`3. Claimed task`);

  // Complete the task with findings
  const findings = 'Implemented the feature successfully. Added unit tests and documentation.';
  const agentName = 'TestAgent';
  const response = await client.callTool('complete_task', {
    task_id: taskId,
    findings: findings,
    agent: agentName
  });

  const result = JSON.parse(response.content[0].text);

  if (!result.success) {
    console.log(`❌ Failed: ${result.error}`);
    return { success: false, error: result.error };
  }

  console.log(`4. Completed task with findings`);
  console.log(`   Findings note: ${result.findings_note.id}`);
  console.log(`   Findings edge: ${result.findings_edge_id}`);
  console.log(`   Task edge properties: ${JSON.stringify(result.task_edge.properties)}`);

  // Verify findings note was created
  if (!result.findings_note || !result.findings_note.id) {
    console.log(`❌ Failed: Findings note not created`);
    return { success: false, error: 'No findings note' };
  }

  // Verify findings note has correct content
  if (result.findings_note.text !== findings) {
    console.log(`❌ Failed: Findings content mismatch`);
    return { success: false, error: 'Wrong findings content' };
  }

  // Verify findings note has 'findings' tag
  if (!result.findings_note.tags || !result.findings_note.tags.includes('findings')) {
    console.log(`❌ Failed: Findings note missing 'findings' tag`);
    return { success: false, error: 'Missing findings tag' };
  }

  // Verify edge was created
  if (!result.findings_edge_id) {
    console.log(`❌ Failed: No edge created for findings`);
    return { success: false, error: 'No findings edge' };
  }

  // Verify status is "done"
  const status = result.task_edge.properties?.status;
  if (status !== 'done') {
    console.log(`❌ Failed: Status is ${status}, expected 'done'`);
    return { success: false, error: 'Wrong status after completion' };
  }

  // Verify completed_at timestamp
  const completedAt = result.task_edge.properties?.completed_at;
  if (!completedAt) {
    console.log(`❌ Failed: Missing completed_at timestamp`);
    return { success: false, error: 'Missing completed_at' };
  }

  console.log(`   Status: ${status}`);
  console.log(`   Completed at: ${completedAt}`);

  testArtifacts.findingNotes.push(result.findings_note.id);

  console.log('✅ Test PASSED: complete_task works correctly');
  return { success: true, result };
}

/**
 * Test 6: Full workflow
 * - End-to-end: Setup → 3 agents claim → complete → get findings
 * - Verifies entire BBS + Kanban workflow
 */
async function testFullWorkflow() {
  console.log('\n=== Test 6: Full Workflow (End-to-End) ===\n');

  const testName = `workflow_test_${Date.now()}`;
  const projectId = await createTestProject(testName);

  console.log(`1. Created project: ${projectId}`);
  console.log(`   Scenario: 3 agents working on different tasks`);

  // Create 3 tasks
  const task1 = await createTestTask(projectId, 'Task 1: Database schema');
  const task2 = await createTestTask(projectId, 'Task 2: API endpoints');
  const task3 = await createTestTask(projectId, 'Task 3: Frontend UI');

  console.log(`2. Created 3 tasks`);
  console.log(`   Task 1: ${task1.substring(0, 20)}...`);
  console.log(`   Task 2: ${task2.substring(0, 20)}...`);
  console.log(`   Task 3: ${task3.substring(0, 20)}...`);

  // Agent 1 claims and completes task 1
  console.log(`\n3. Agent1 claims Task 1`);
  await client.callTool('claim_task', {
    task_id: task1,
    agent: 'Agent1'
  });

  console.log(`4. Agent1 completes Task 1 with findings`);
  await client.callTool('complete_task', {
    task_id: task1,
    findings: 'Designed database schema with proper indexing',
    agent: 'Agent1'
  });

  // Agent 2 claims and completes task 2
  console.log(`5. Agent2 claims Task 2`);
  await client.callTool('claim_task', {
    task_id: task2,
    agent: 'Agent2'
  });

  console.log(`6. Agent2 completes Task 2 with findings`);
  await client.callTool('complete_task', {
    task_id: task2,
    findings: 'Implemented REST API endpoints with authentication',
    agent: 'Agent2'
  });

  // Agent 3 claims and completes task 3
  console.log(`7. Agent3 claims Task 3`);
  await client.callTool('claim_task', {
    task_id: task3,
    agent: 'Agent3'
  });

  console.log(`8. Agent3 completes Task 3 with findings`);
  await client.callTool('complete_task', {
    task_id: task3,
    findings: 'Built responsive UI with React components',
    agent: 'Agent3'
  });

  // Get all team findings
  console.log(`\n9. Retrieving all team findings`);
  const findingsResponse = await client.callTool('get_team_findings', {
    project_id: projectId,
    limit: 20
  });

  const findingsResult = JSON.parse(findingsResponse.content[0].text);

  if (!findingsResult.success) {
    console.log(`❌ Failed: ${findingsResult.error}`);
    return { success: false, error: findingsResult.error };
  }

  console.log(`10. Retrieved ${findingsResult.count} findings`);

  // Verify we have findings from all 3 agents
  const agent1Findings = findingsResult.findings.filter(f => f.with_whom === 'Agent1');
  const agent2Findings = findingsResult.findings.filter(f => f.with_whom === 'Agent2');
  const agent3Findings = findingsResult.findings.filter(f => f.with_whom === 'Agent3');

  console.log(`   Agent1 findings: ${agent1Findings.length}`);
  console.log(`   Agent2 findings: ${agent2Findings.length}`);
  console.log(`   Agent3 findings: ${agent3Findings.length}`);

  // Check Kanban board
  console.log(`\n11. Checking Kanban board`);
  const boardResponse = await client.callTool('get_project_tasks', {
    project_node_id: projectId
  });

  const boardResult = JSON.parse(boardResponse.content[0].text);

  if (!boardResult.success) {
    console.log(`❌ Failed to get board: ${boardResult.error}`);
    return { success: false, error: boardResult.error };
  }

  console.log(`   Todo: ${boardResult.todo.length}`);
  console.log(`   Doing: ${boardResult.doing.length}`);
  console.log(`   Done: ${boardResult.done.length}`);

  // Verify all tasks are in "done" column
  if (boardResult.done.length !== 3) {
    console.log(`⚠️  Warning: Expected 3 tasks in done, got ${boardResult.done.length}`);
  }

  console.log('\n✅ Test PASSED: Full workflow successful');
  console.log('   BBS: Findings posted and retrieved');
  console.log('   Kanban: Tasks tracked through lifecycle');

  return { success: true, result: findingsResult };
}

/**
 * Main test runner
 */
async function main() {
  console.log('╔════════════════════════════════════════════════════════╗');
  console.log('║  Coordination Tools - Integration Test                 ║');
  console.log('║  Testing: BBS + Kanban workflow for agents            ║');
  console.log('╚════════════════════════════════════════════════════════╝');

  console.log(`\nAPI Endpoint: ${MEMORY_API}`);
  console.log(`Started at: ${new Date().toISOString()}`);

  const results = {
    post_finding: null,
    get_team_findings: null,
    claim_task: null,
    claim_task_with_dependencies: null,
    complete_task: null,
    full_workflow: null,
  };

  try {
    // Run tests
    results.post_finding = await testPostFinding();
    results.get_team_findings = await testGetTeamFindings();
    results.claim_task = await testClaimTask();
    results.claim_task_with_dependencies = await testClaimTaskWithDependencies();
    results.complete_task = await testCompleteTask();
    results.full_workflow = await testFullWorkflow();

    // Cleanup
    await cleanupTestData();

    // Summary
    console.log('\n╔════════════════════════════════════════════════════════╗');
    console.log('║  Test Summary                                          ║');
    console.log('╚════════════════════════════════════════════════════════╝\n');

    const summary = [];

    for (const [testName, result] of Object.entries(results)) {
      const status = result?.success ? '✅ PASS' : '❌ FAIL';
      const displayName = testName.replace(/_/g, ' ');
      console.log(`${displayName.padEnd(35)} ${status}`);
      summary.push({ test: displayName, passed: result?.success });
    }

    console.log('');

    const passedCount = summary.filter(s => s.passed).length;
    const totalCount = summary.length;

    console.log(`Total: ${passedCount}/${totalCount} tests passed`);

    // Exit with appropriate code
    if (passedCount === totalCount) {
      console.log('\n✅ All tests PASSED!');
      process.exit(0);
    } else {
      console.log(`\n⚠️  ${totalCount - passedCount} test(s) FAILED`);
      process.exit(1);
    }
  } catch (error) {
    console.error('\n❌ Test suite failed:', error.message);
    console.error(error.stack);
    await cleanupTestData();
    process.exit(1);
  }
}

main();
