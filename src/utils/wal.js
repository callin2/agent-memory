#!/usr/bin/env node

/**
 * Write-Ahead Logging (WAL) for Memory System
 *
 * Provides fault tolerance for memory operations:
 * - Tries MCP server first
 * - Falls back to local WAL if MCP is down
 * - WAL logs can be replayed when MCP recovers
 */

import { writeFile, mkdir, readdir, readFile, rename } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';

const WAL_DIR = '.memory-wal';
const OPERATIONS_FILE = join(WAL_DIR, 'operations.jsonl');

/**
 * Initialize WAL directory
 */
export async function initWAL() {
  if (!existsSync(WAL_DIR)) {
    await mkdir(WAL_DIR, { recursive: true });
  }
}

/**
 * Write memory operation to WAL
 * Used when MCP server is down
 */
export async function writeToWAL(operation, params) {
  await initWAL();

  const entry = {
    timestamp: new Date().toISOString(),
    operation,
    params
  };

  const line = JSON.stringify(entry) + '\n';

  // Append to operations file
  await writeFile(OPERATIONS_FILE, line, { flag: 'a' });

  console.error(`[WAL] Saved to local log: ${operation}`);
  return entry;
}

/**
 * Try to execute memory operation via MCP
 * Falls back to WAL if MCP is down
 */
export async function tryMemoryOperation(mcpClient, operation, params) {
  try {
    // Try MCP server first
    const result = await mcpClient.callTool(operation, params);
    return { success: true, result, source: 'mcp' };
  } catch (error) {
    // MCP is down, save to WAL
    console.error(`[WAL] MCP down, saving to local log: ${error.message}`);
    const walEntry = await writeToWAL(operation, params);
    return { success: false, walEntry, source: 'wal', error };
  }
}

/**
 * Read all WAL operations
 */
export async function readWALOperations() {
  if (!existsSync(OPERATIONS_FILE)) {
    return [];
  }

  const content = await readFile(OPERATIONS_FILE, 'utf-8');
  const lines = content.trim().split('\n').filter(l => l.length > 0);

  return lines.map(line => {
    try {
      return JSON.parse(line);
    } catch (error) {
      console.error(`[WAL] Failed to parse line: ${line.substring(0, 50)}...`);
      return null;
    }
  }).filter(entry => entry !== null);
}

/**
 * Replay WAL operations to MCP server
 */
export async function replayWAL(mcpClient) {
  const operations = await readWALOperations();

  if (operations.length === 0) {
    console.log('[WAL] No operations to replay');
    return { replayed: 0, failed: 0 };
  }

  console.log(`[WAL] Found ${operations.length} operations to replay`);

  let replayed = 0;
  let failed = 0;

  for (const entry of operations) {
    try {
      console.log(`[WAL] Replaying: ${entry.operation} (${entry.timestamp})`);
      console.log(`[WAL] Params:`, JSON.stringify(entry.params).substring(0, 80) + '...');

      const result = await mcpClient.callTool(entry.operation, entry.params);
      console.log(`[WAL] ✅ Success`);
      replayed++;
    } catch (error) {
      console.error(`[WAL] ❌ Failed to replay ${entry.operation}:`);
      console.error(`[WAL] Error:`, error.message);
      if (error.cause) console.error(`[WAL] Cause:`, error.cause);
      failed++;
      break; // Stop on first failure - maintain order
    }
  }

  // If all succeeded, clear WAL
  if (failed === 0 && replayed > 0) {
    await clearWAL();
    console.log('[WAL] All operations replayed successfully, WAL cleared');
  }

  return { replayed, failed };
}

/**
 * Clear WAL file after successful replay
 */
export async function clearWAL() {
  if (existsSync(OPERATIONS_FILE)) {
    await writeFile(OPERATIONS_FILE, '');
  }
}

/**
 * Check if WAL has pending operations
 */
export async function hasPendingOperations() {
  const operations = await readWALOperations();
  return operations.length > 0;
}
