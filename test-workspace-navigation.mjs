#!/usr/bin/env node

/**
 * Test Workspace Navigation Tools
 *
 * Tests the new MCP tools for workspace navigation:
 * - list_workspaces
 * - get_workspace_snapshot
 * - explore_room
 * - search_all_workspaces
 */

import { Pool } from 'pg';
import {
  handleListWorkspaces,
  handleGetWorkspaceSnapshot,
  handleExploreRoom,
  handleSearchAllWorkspaces
} from './dist/mcp/tools/workspace-navigation.js';

// Create database connection
const pool = new Pool({
  host: process.env.PGHOST || 'localhost',
  port: parseInt(process.env.PGPORT || '5432'),
  database: process.env.PGDATABASE || 'agent_memory_dev',
  user: process.env.PGUSER || 'agent_mem_dba',
  password: process.env.PGPASSWORD || 'adminqwer1234'
});

async function test() {
  console.log('🧪 Testing Workspace Navigation Tools\n');

  try {
    // Test 1: Explore room
    console.log('📍 Test 1: explore_room');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    const room = await handleExploreRoom(pool);
    console.log(JSON.stringify(room, null, 2));
    console.log('\n✅ explore_room works!\n');

    // Test 2: List workspaces
    console.log('🗂️  Test 2: list_workspaces');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    const workspaces = await handleListWorkspaces(pool, 'claude-session');
    console.log(`Found ${workspaces.total} workspaces:`);
    workspaces.workspaces.forEach(ws => {
      console.log(`  • ${ws.display_name} (${ws.tenant_id})`);
      console.log(`    ${ws.handoff_count} handoffs • Focus: ${ws.primary_focus}`);
    });
    console.log('\n✅ list_workspaces works!\n');

    // Test 3: Get workspace snapshot
    console.log('📸 Test 3: get_workspace_snapshot');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    const snapshot = await handleGetWorkspaceSnapshot(pool, 'claude-session', 100);
    console.log(`${snapshot.what_is_this}`);
    console.log(`\nRecent focus:`);
    snapshot.recent_focus.forEach(f => console.log(`  • ${f}`));
    console.log(`\nPriming tags: ${snapshot.priming_tags.join(', ')}`);
    console.log(`\nEstimated tokens: ${snapshot.token_count}`);
    console.log('\n✅ get_workspace_snapshot works!\n');

    // Test 4: Search all workspaces
    console.log('🔍 Test 4: search_all_workspaces');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    const search = await handleSearchAllWorkspaces(pool, 'claude-session', 'design methodology', 3, 0);
    console.log(`Found ${search.total} matches:`);
    search.results.forEach(match => {
      console.log(`  • ${match.tenant_id}`);
      console.log(`    Relevance: ${match.relevance}`);
      console.log(`    ${match.snippet.substring(0, 100)}...`);
    });
    console.log(`\n✅ search_all_workspaces works!\n`);

    console.log('╔══════════════════════════════════════════════════════╗');
    console.log('║  ✅ ALL TESTS PASSED                                  ║');
    console.log('╚══════════════════════════════════════════════════════╝');

  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

test();
