#!/usr/bin/env node

/**
 * Simple MCP connection test
 */

const response = await fetch("http://localhost:4000/sse", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Accept": "application/json, text/event-stream",
    "Authorization": "Bearer test-mcp-token",
  },
  body: JSON.stringify({
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: {
        name: "test-client",
        version: "1.0.0",
      },
    },
  }),
});

console.log("Status:", response.status);
console.log("Headers:", Object.fromEntries(response.headers.entries()));

const text = await response.text();
console.log("Response body:", text);

if (response.status === 200) {
  console.log("\n✅ SUCCESS: MCP server initialized!");
} else {
  console.log("\n❌ FAILED: Status", response.status);
}
