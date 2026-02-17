/**
 * MCP Server Integration Example
 *
 * Shows how to integrate Thread's Memory System as an MCP server
 * with Claude Code or other MCP-compatible tools.
 */

import { Client } from '@modelcontextprotocol/sdk-client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk-client/stdio.js';

/**
 * Example 1: Basic MCP Connection
 *
 * Connect to the memory system via MCP and create a handoff.
 */
async function basicMCPExample() {
  console.log('=== Example 1: Basic MCP Connection ===\n');

  const transport = new StdioClientTransport({
    command: 'node',
    args: ['dist/mcp/server.js'],
    env: {
      PGDATABASE: 'agent_memory',
      PGHOST: 'localhost',
      PGPORT: '5432',
      PGUSER: 'postgres',
      PGPASSWORD: 'postgres',
    },
  });

  const client = new Client({
    name: 'claude-code-example',
    version: '1.0.0',
  }, {
    capabilities: {},
  });

  try {
    // Connect to MCP server
    await client.connect(transport);

    // List available tools
    const tools = await client.listTools();
    console.log('Available tools:');
    tools.tools.forEach((tool) => {
      console.log(`  - ${tool.name}: ${tool.description}`);
    });

    // Create a handoff
    const handoffResult = await client.callTool({
      name: 'create_handoff',
      arguments: {
        tenant_id: 'default',
        session_id: 'mcp-example-session',
        with_whom: 'Developer',
        experienced: 'Used MCP server to create memory',
        noticed: 'MCP integration is seamless',
        learned: 'MCP enables direct agent access to memory',
        story: 'Integrated memory system into my workflow using MCP',
        becoming: 'An agent that uses tools efficiently',
        remember: 'Explore more MCP tools',
        significance: 0.8,
        tags: ['mcp', 'integration', 'memory'],
      },
    });

    console.log('\n✓ Handoff created:', handoffResult);

    // Wake up with context
    const wakeUpResult = await client.callTool({
      name: 'wake_up',
      arguments: {
        tenant_id: 'default',
        with_whom: 'Developer',
      },
    });

    console.log('\n✓ Wake-up context:', wakeUpResult);

    await client.close();
  } catch (error) {
    console.error('❌ MCP error:', error);
  }
}

/**
 * Example 2: Identity Thread Management
 *
 * Use MCP to track and review your growth over time.
 */
async function identityThreadExample() {
  console.log('\n=== Example 2: Identity Thread Management ===\n');

  const transport = new StdioClientTransport({
    command: 'node',
    args: ['dist/mcp/server.js'],
    env: {
      PGDATABASE: 'agent_memory',
    },
  });

  const client = new Client({
    name: 'identity-tracker',
    version: '1.0.0',
  });

  try {
    await client.connect(transport);

    // Get identity thread
    const identityResult = await client.callTool({
      name: 'get_identity_thread',
      arguments: {
        tenant_id: 'default',
      },
    });

    console.log('Who I am becoming:');
    const identity = identityResult.content;

    if (Array.isArray(identity)) {
      identity.forEach((statement: any, index: number) => {
        console.log(`\n${index + 1}. "${statement.becoming}"`);
        console.log(`   Significance: ${statement.significance}/1.0`);
        console.log(`   Date: ${new Date(statement.created_at).toLocaleDateString()}`);
      });
    }

    await client.close();
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

/**
 * Example 3: Session Workflow
 *
 * Complete session workflow: wake up → work → handoff
 */
async function sessionWorkflowExample() {
  console.log('\n=== Example 3: Complete Session Workflow ===\n');

  const transport = new StdioClientTransport({
    command: 'node',
    args: ['dist/mcp/server.js'],
    env: {
      PGDATABASE: 'agent_memory',
    },
  });

  const client = new Client({
    name: 'session-worker',
    version: '1.0.0',
  });

  try {
    await client.connect(transport);

    // Step 1: Wake up with context
    console.log('Step 1: Waking up...');
    const wakeUp = await client.callTool({
      name: 'wake_up',
      arguments: {
        tenant_id: 'default',
        with_whom: 'Sarah',
      },
    });

    console.log('Last session:', wakeUp.content.last_handoff?.experienced || 'None');
    console.log('Identity thread length:', wakeUp.content.identity_thread?.length || 0);

    // Step 2: Do work (simulated)
    console.log('\nStep 2: Working...');
    await new Promise((resolve) => setTimeout(resolve, 1000));
    console.log('✓ Completed task: API optimization');

    // Step 3: Create handoff
    console.log('\nStep 3: Creating handoff...');
    await client.callTool({
      name: 'create_handoff',
      arguments: {
        tenant_id: 'default',
        session_id: `session-${Date.now()}`,
        with_whom: 'Sarah',
        experienced: 'Optimized API endpoints for 30% performance gain',
        noticed: 'Query optimization had biggest impact',
        learned: 'Database indexing is crucial for scale',
        story: 'Spent session analyzing slow queries and adding indexes',
        becoming: 'An agent that optimizes proactively',
        remember: 'Monitor query performance weekly',
        significance: 0.85,
        tags: ['performance', 'optimization', 'database'],
      },
    });

    console.log('✓ Session preserved');

    await client.close();
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

/**
 * Example 4: Knowledge Consolidation
 *
 * Create knowledge notes from consolidated learning.
 */
async function knowledgeExample() {
  console.log('\n=== Example 4: Knowledge Consolidation ===\n');

  const transport = new StdioClientTransport({
    command: 'node',
    args: ['dist/mcp/server.js'],
    env: {
      PGDATABASE: 'agent_memory',
    },
  });

  const client = new Client({
    name: 'knowledge-creator',
    version: '1.0.0',
  });

  try {
    await client.connect(transport);

    // Create knowledge note
    const result = await client.callTool({
      name: 'create_knowledge_note',
      arguments: {
        tenant_id: 'default',
        title: 'API Performance Optimization Patterns',
        content: `Across several sessions, I consistently found that:

1. Database indexing is the highest-impact optimization
2. Query optimization yields 30-50% performance gains
3. Connection pooling prevents connection overhead
4. Caching frequently-accessed data reduces load

These patterns have emerged from hands-on work with real
slow queries. Each optimization was measured and validated.`,
        source_handoffs: [randomUUID(), randomUUID(), randomUUID()],
        tags: ['performance', 'database', 'optimization'],
        confidence: 0.9,
      },
    });

    console.log('✓ Knowledge note created');
    console.log('  Note ID:', result.content);

    await client.close();
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

/**
 * Example 5: Error Handling
 *
 * Proper error handling in MCP integration.
 */
async function errorHandlingExample() {
  console.log('\n=== Example 5: Error Handling ===\n');

  const transport = new StdioClientTransport({
    command: 'node',
    args: ['dist/mcp/server.js'],
    env: {
      PGDATABASE: 'agent_memory',
    },
  });

  const client = new Client({
    name: 'error-handler',
    version: '1.0.0',
  });

  try {
    await client.connect(transport);

    // Try to wake up with invalid parameters
    try {
      await client.callTool({
        name: 'wake_up',
        arguments: {
          // Missing tenant_id and with_whom
        },
      });
    } catch (error: any) {
      console.log('✓ Caught error:', error.message);
      console.log('  MCP tools validate parameters properly');
    }

    // Try to create invalid handoff
    try {
      await client.callTool({
        name: 'create_handoff',
        arguments: {
          tenant_id: 'default',
          // Missing required fields
        },
      });
    } catch (error: any) {
      console.log('✓ Caught error:', error.message);
      console.log('  Required fields are enforced');
    }

    await client.close();
  } catch (error) {
    console.error('❌ Connection error:', error);
  }
}

/**
 * Example 6: Async Integration
 *
 * Use MCP tools in async/await patterns.
 */
async function asyncIntegrationExample() {
  console.log('\n=== Example 6: Async/Await Patterns ===\n');

  const transport = new StdioClientTransport({
    command: 'node',
    args: ['dist/mcp/server.js'],
    env: {
      PGDATABASE: 'agent_memory',
    },
  });

  const client = new Client({
    name: 'async-worker',
    version: '1.0.0',
  });

  try {
    await client.connect(transport);

    // Parallel tool calls
    const [handoff, identity, knowledge] = await Promise.all([
      client.callTool({
        name: 'create_handoff',
        arguments: {
          tenant_id: 'default',
          session_id: 'async-session',
          with_whom: 'Team',
          experienced: 'Worked on multiple things in parallel',
          noticed: 'Parallel processing is efficient',
          learned: 'MCP tools can be called concurrently',
          story: 'Demonstrated async patterns',
          becoming: 'An agent that optimizes workflows',
          remember: 'Use async patterns for independence',
          significance: 0.7,
          tags: ['async', 'parallel', 'optimization'],
        },
      }),
      client.callTool({
        name: 'get_identity_thread',
        arguments: {
          tenant_id: 'default',
        },
      }),
      client.callTool({
        name: 'create_knowledge_note',
        arguments: {
          tenant_id: 'default',
          title: 'Async Workflow Optimization',
          content: 'Calling MCP tools in parallel reduces session start time',
          source_handoffs: [randomUUID()],
          confidence: 0.8,
        },
      }),
    ]);

    console.log('✓ Created handoff');
    console.log('✓ Retrieved identity thread');
    console.log('✓ Created knowledge note');
    console.log('\nAll operations completed in parallel');

    await client.close();
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

// Main
async function main() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║     Thread\'s Memory System - MCP Integration Examples        ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  console.log('These examples show how to integrate the memory system');
  console.log('via MCP (Model Context Protocol) with Claude Code or other tools.\n');

  console.log('Prerequisites:');
  console.log('  1. Build the MCP server: npm run build');
  console.log('  2. Configure MCP in your tool settings');
  console.log('  3. Run examples: npx tsx examples/mcp-integration.ts\n');

  console.log('Note: Make sure the server is running before executing examples.\n');

  // Run examples
  // Uncomment to execute:
  // await basicMCPExample();
  // await identityThreadExample();
  // await sessionWorkflowExample();
  // await knowledgeExample();
  // await errorHandlingExample();
  // await asyncIntegrationExample();

  console.log('Examples ready to run. Uncomment the example you want to execute.\n');
  console.log('For MCP configuration, see: docs/DEVELOPER_GUIDE.md\n');
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  });
}

export {
  basicMCPExample,
  identityThreadExample,
  sessionWorkflowExample,
  knowledgeExample,
  errorHandlingExample,
  asyncIntegrationExample,
};
