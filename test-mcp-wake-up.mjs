#!/usr/bin/env node

/**
 * Test MCP wake_up_stratified for Thread
 *
 * This tests the cross-platform MCP launcher (not HTTP API, not shell scripts)
 * Run: node test-mcp-wake-up.mjs
 */

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { spawn } from "child_process";

async function testWakeUp() {
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("  Testing MCP wake_up_stratified for Thread");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("");

  // Start MCP server using cross-platform launcher
  const serverProcess = spawn("node", ["/Users/callin/Callin_Project/agent_memory_v2/start-mcp-server.js"], {
    env: {
      ...process.env,
      PGPASSWORD: process.env.PGPASSWORD,
    },
  });

  const client = new Client({
    name: "thread-test-client",
    version: "1.0.0",
  }, {
    capabilities: {},
  });

  const transport = new StdioClientTransport({
    command: "node",
    args: ["/Users/callin/Callin_Project/agent_memory_v2/start-mcp-server.js"],
    env: {
      ...process.env,
      PGPASSWORD: process.env.PGPASSWORD,
    },
  });

  try {
    await client.connect(transport);

    console.log("✅ Connected to MCP server");
    console.log("");

    // List available tools
    const tools = await client.listTools();
    console.log("Available tools:");
    tools.tools.forEach(tool => {
      console.log(`  - ${tool.name}`);
    });
    console.log("");

    // Test wake_up_stratified
    console.log("Calling wake_up_stratified...");
    const result = await client.callTool({
      name: "wake_up_stratified",
      arguments: {
        tenant_id: "claude-session",
        layers: ["metadata", "reflection", "recent"],
        recent_count: 10,
      },
    });

    console.log("");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("  RESULT");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("");

    const response = JSON.parse(result.content[0].text);

    if (response.success) {
      console.log("✅ Wake-up successful!");
      console.log("");
      console.log(`Layers loaded: ${response.layers_loaded.join(", ")}`);
      console.log(`Estimated tokens: ${response.estimated_tokens}`);
      console.log(`Compression: ${response.compression_ratio}`);
      console.log("");

      if (response.metadata) {
        console.log("📊 Metadata:");
        console.log(`  Sessions: ${response.metadata.session_count}`);
        console.log(`  Last session: ${response.metadata.last_session_at}`);
        console.log("");
      }

      if (response.reflection && !response.reflection.message) {
        console.log("🪞 Reflection:");
        console.log(`  ${response.reflection.summary}`);
        console.log("");
      }

      if (response.recent && response.recent.length > 0) {
        console.log(`📝 Recent handoffs (${response.recent.length}):`);
        response.recent.forEach((h, i) => {
          console.log(`  ${i + 1}. ${h.created_at?.substring(0, 10)} | ${h.becoming?.substring(0, 60)}...`);
        });
        console.log("");
      }
    } else {
      console.log("❌ Wake-up failed");
      console.log(JSON.stringify(response, null, 2));
    }

  } catch (error) {
    console.error("❌ Error:", error.message);
  } finally {
    await client.close();
    serverProcess.kill();
  }
}

testWakeUp();
