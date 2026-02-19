#!/usr/bin/env node

/**
 * Memory Client with WAL Fallback
 *
 * Wraps memory operations with WAL fallback for fault tolerance.
 * When MCP server is down, operations are saved to local WAL.
 */

import { tryMemoryOperation, replayWAL, hasPendingOperations } from './wal.js';

const MCP_URL = process.env.MCP_URL || 'http://localhost:4000/mcp';
const MCP_TOKEN = process.env.MCP_TOKEN || 'Bearer test-mcp-token';

/**
 * Simple MCP client for memory operations
 */
class MemoryClient {
  constructor(url = MCP_URL, token = MCP_TOKEN) {
    this.url = url;
    this.token = token;
  }

  async callTool(name, args) {
    const response = await fetch(this.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': this.token
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: Date.now(),
        method: 'tools/call',
        params: { name, arguments: args }
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

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

  /**
   * Create handoff with WAL fallback
   */
  async createHandoff(params) {
    console.log('[Memory] Creating handoff...');
    return await tryMemoryOperation(this, 'create_handoff', params);
  }

  /**
   * Create knowledge note with WAL fallback
   */
  async createKnowledgeNote(params) {
    console.log('[Memory] Creating knowledge note...');
    return await tryMemoryOperation(this, 'create_knowledge_note', params);
  }

  /**
   * Create capsule with WAL fallback
   */
  async createCapsule(params) {
    console.log('[Memory] Creating capsule...');
    return await tryMemoryOperation(this, 'create_capsule', params);
  }

  /**
   * Wake up with automatic WAL replay
   */
  async wakeUp(params) {
    console.log('[Memory] Waking up...');

    // First check for pending WAL operations
    const hasPending = await hasPendingOperations();

    if (hasPending) {
      console.log('[Memory] ⚠️  Found pending WAL operations, replaying...');
      const replayResult = await replayWAL(this);

      if (replayResult.failed > 0) {
        console.log(`[Memory] ⚠️  Replayed ${replayResult.replayed}, ${replayResult.failed} failed`);
      } else {
        console.log(`[Memory] ✅ Replayed ${replayResult.replayed} operations from WAL`);
      }
    }

    // Then call wake_up
    return await this.callTool('wake_up', params);
  }
}

export default MemoryClient;
