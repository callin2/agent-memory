#!/usr/bin/env node

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

console.log('🧪 Final MCP Server Test\n');
console.log('Testing launcher:', '/Users/callin/Callin_Project/agent_memory_v2/start-mcp-final.js\n');

const client = new Client({
  name: "claude-code-test",
  version: "1.0.0",
}, { capabilities: {} });

const transport = new StdioClientTransport({
  command: "node",
  args: ["/Users/callin/Callin_Project/agent_memory_v2/start-mcp-final.js"],
  env: {
    PGPASSWORD: "adminqwer1234",
  },
});

try {
  await client.connect(transport);
  console.log('✅ Connected to MCP server\n');

  const tools = await client.listTools();
  console.log(`📦 Available tools (${tools.tools.length}):`);
  tools.tools.forEach(t => console.log(`   - ${t.name}`));
  console.log('');

  console.log('🔄 Testing wake_up_stratified...');
  const result = await client.callTool({
    name: "wake_up_stratified",
    arguments: {
      tenant_id: "claude-session",
      layers: ["metadata", "recent"],
      recent_count: 2,
    },
  });

  const response = JSON.parse(result.content[0].text);
  if (response.success) {
    console.log('✅ wake_up_stratified works!\n');
    console.log(`📊 Sessions: ${response.metadata?.session_count || 0}`);
    console.log(`📝 Recent handoffs: ${response.recent?.length || 0}`);
    if (response.recent?.length > 0) {
      console.log('\n   Latest memories:');
      response.recent.slice(0, 2).forEach((h, i) => {
        console.log(`   ${i+1}. ${h.becoming?.substring(0, 70)}...`);
      });
    }
    console.log('\n✅ All tests passed! MCP server is ready.\n');
  } else {
    console.log('❌ Test failed:', response);
  }
} catch (error) {
  console.error('❌ Error:', error.message);
} finally {
  await client.close();
}
