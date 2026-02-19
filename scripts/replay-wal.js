#!/usr/bin/env node

/**
 * WAL Replay Script
 *
 * Manually replay WAL operations to MCP server
 * Usage: node scripts/replay-wal.js
 */

import { replayWAL } from '../src/utils/wal.js';

// Simple MCP client for replay
class SimpleMCPClient {
  constructor(baseUrl = 'http://localhost:4000/mcp') {
    this.baseUrl = baseUrl;
    this.token = 'Bearer test-mcp-token';
  }

  async callTool(name, args) {
    const response = await fetch(this.baseUrl, {
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

async function main() {
  console.log('=== WAL Replay ===\n');

  const client = new SimpleMCPClient();

  try {
    const result = await replayWAL(client);

    console.log('\n=== Results ===');
    console.log(`Replayed: ${result.replayed}`);
    console.log(`Failed: ${result.failed}`);

    if (result.failed === 0 && result.replayed > 0) {
      console.log('\n✅ All operations replayed successfully');
      process.exit(0);
    } else if (result.replayed === 0) {
      console.log('\nℹ️  No operations to replay');
      process.exit(0);
    } else {
      console.log('\n❌ Some operations failed - WAL preserved');
      process.exit(1);
    }
  } catch (error) {
    console.error('\n❌ Replay failed:', error.message);
    process.exit(1);
  }
}

main();
