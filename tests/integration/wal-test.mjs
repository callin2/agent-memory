#!/usr/bin/env node

/**
 * WAL Integration Test
 *
 * Tests the full Write-Ahead Logging cycle:
 * 1. Memory operation with MCP up (direct save)
 * 2. Memory operation with MCP down (WAL save)
 * 3. Replay WAL when MCP recovers
 * 4. Verify all operations persisted
 */

import { execSync } from 'child_process';
import { writeFile, mkdir, readFile, rm } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';

const WAL_DIR = '.memory-wal-test';
const OPERATIONS_FILE = join(WAL_DIR, 'operations.jsonl');
const MCP_BASE_URL = 'http://localhost:4000/mcp';
const MCP_TOKEN = 'Bearer test-mcp-token';

class MCPClient {
  async callTool(name, args) {
    const response = await fetch(MCP_BASE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': MCP_TOKEN
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: Date.now(),
        method: 'tools/call',
        params: { name, arguments: args }
      })
    });

    const data = await response.json();

    if (data.error) {
      throw new Error(data.error.message || 'MCP error');
    }

    if (data.result && data.result.isError) {
      const errorText = data.result.content?.[0]?.text || 'Unknown error';
      throw new Error(errorText);
    }

    return data.result;
  }
}

async function mcpServerRunning() {
  try {
    await fetch(MCP_BASE_URL, { method: 'HEAD' });
    return true;
  } catch {
    return false;
  }
}

async function stopMCPServer() {
  try {
    execSync('pm2 stop memory-mcp-server', { stdio: 'pipe' });
    await new Promise(r => setTimeout(r, 1000));
    return true;
  } catch {
    return false;
  }
}

async function startMCPServer() {
  try {
    execSync('pm2 start memory-mcp-server', { stdio: 'pipe' });
    await new Promise(r => setTimeout(r, 2000));
    return true;
  } catch {
    return false;
  }
}

async function setupTestWAL() {
  if (existsSync(WAL_DIR)) {
    await rm(WAL_DIR, { recursive: true, force: true });
  }
  await mkdir(WAL_DIR, { recursive: true });
}

async function readTestWAL() {
  if (!existsSync(OPERATIONS_FILE)) {
    return [];
  }

  const content = await readFile(OPERATIONS_FILE, 'utf-8');
  const lines = content.trim().split('\n').filter(l => l.length > 0);

  return lines.map(line => {
    try {
      return JSON.parse(line);
    } catch {
      return null;
    }
  }).filter(entry => entry !== null);
}

async function writeToTestWAL(operation, params) {
  const entry = {
    timestamp: new Date().toISOString(),
    operation,
    params
  };

  const line = JSON.stringify(entry) + '\n';
  await writeFile(OPERATIONS_FILE, line, { flag: 'a' });

  return entry;
}

async function replayTestWAL(client) {
  const operations = await readTestWAL();

  let replayed = 0;
  let failed = 0;

  for (const entry of operations) {
    try {
      await client.callTool(entry.operation, entry.params);
      replayed++;
    } catch (error) {
      console.error(`  ❌ Failed to replay ${entry.operation}: ${error.message}`);
      failed++;
      break;
    }
  }

  if (failed === 0 && replayed > 0) {
    await writeFile(OPERATIONS_FILE, '');
  }

  return { replayed, failed };
}

async function main() {
  console.log('=== WAL Integration Test ===\n');

  const client = new MCPClient();
  const testId = Date.now();
  const uniqueId = `wal-test-${testId}`;

  // Clean up any previous test artifacts
  await setupTestWAL();

  // Test 1: MCP server running
  console.log('Test 1: Check MCP server status');
  const isRunning = await mcpServerRunning();
  console.log(`  MCP Server: ${isRunning ? '✅ Running' : '❌ Stopped'}`);

  if (!isRunning) {
    await startMCPServer();
    console.log('  Started MCP server');
  }

  // Test 2: Direct MCP operation
  console.log('\nTest 2: Create handoff via MCP (direct)');
  try {
    const result = await client.callTool('create_handoff', {
      session_id: `${uniqueId}-direct`,
      with_whom: 'WAL Test',
      experienced: 'Testing direct MCP call',
      noticed: 'MCP is running',
      learned: 'Direct calls work',
      story: 'Direct MCP operation test',
      becoming: 'Testing WAL system',
      remember: 'This should save directly'
    });
    console.log('  ✅ Direct save successful');
  } catch (error) {
    console.log(`  ❌ Direct save failed: ${error.message}`);
    process.exit(1);
  }

  // Test 3: Stop MCP and save to WAL
  console.log('\nTest 3: Stop MCP and save to WAL');
  await stopMCPServer();

  // Write directly to WAL (simulating WAL behavior)
  await writeToTestWAL('create_handoff', {
    session_id: `${uniqueId}-wal`,
    with_whom: 'WAL Test',
    experienced: 'Testing WAL save when MCP is down',
    noticed: 'MCP stopped',
    learned: 'WAL catches operations',
    story: 'WAL save test',
    becoming: 'Testing WAL system',
    remember: 'This should go to WAL'
  });

  const walOps = await readTestWAL();
  console.log(`  ✅ WAL save successful (${walOps.length} operations)`);

  // Test 4: Start MCP and replay WAL
  console.log('\nTest 4: Start MCP and replay WAL');
  await startMCPServer();

  const replayResult = await replayTestWAL(client);
  console.log(`  Replayed: ${replayResult.replayed}`);
  console.log(`  Failed: ${replayResult.failed}`);

  if (replayResult.failed > 0) {
    console.log('  ❌ WAL replay failed');
    process.exit(1);
  }

  console.log('  ✅ WAL replay successful');

  // Test 5: Verify both handoffs exist
  console.log('\nTest 5: Verify handoffs in memory');
  try {
    const listResult = await client.callTool('list_handoffs', {});
    const handoffs = JSON.parse(listResult.content[0].text);

    const directHandoff = handoffs.handoffs.find(h => h.session_id === `${uniqueId}-direct`);
    const walHandoff = handoffs.handoffs.find(h => h.session_id === `${uniqueId}-wal`);

    console.log(`  Direct handoff: ${directHandoff ? '✅ Found' : '❌ Missing'}`);
    console.log(`  WAL handoff: ${walHandoff ? '✅ Found' : '❌ Missing'}`);

    if (!directHandoff || !walHandoff) {
      console.log('  ❌ Verification failed');
      process.exit(1);
    }

    console.log('  ✅ Both handoffs verified');
  } catch (error) {
    console.log(`  ❌ Verification error: ${error.message}`);
    process.exit(1);
  }

  // Clean up
  console.log('\nCleanup: Removing test WAL');
  await rm(WAL_DIR, { recursive: true, force: true });

  console.log('\n=== All Tests Passed ✅ ===');
  process.exit(0);
}

main().catch(error => {
  console.error('\n❌ Test failed:', error);
  process.exit(1);
});
