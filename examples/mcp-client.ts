/**
 * MCP Client Example - Agent Memory System with Authentication
 *
 * This example demonstrates how to connect to the Agent Memory System
 * MCP server with authentication (JWT token or API key).
 */

import { spawn } from 'child_process';
import { createInterface } from 'readline';

interface MCPMessage {
  jsonrpc: '2.0';
  id?: number | string;
  method?: string;
  params?: any;
  result?: any;
  error?: {
    code: number;
    message: string;
  };
}

interface MCPTool {
  name: string;
  description: string;
  inputSchema: any;
}

/**
 * MCP Client with Authentication
 */
class MCPClient {
  private process: any;
  private messageId = 0;
  private rl: any;

  constructor(serverCommand: string, serverArgs: string[]) {
    // Start MCP server process
    this.process = spawn(serverCommand, serverArgs, {
      stdio: ['pipe', 'pipe', 'inherit'],
    });

    this.rl = createInterface({
      input: this.process.stdout,
      output: this.process.stdin,
    });

    this.process.on('error', (error: Error) => {
      console.error('MCP server error:', error);
    });

    this.process.on('close', (code: number) => {
      console.log(`\nMCP server exited with code ${code}`);
    });
  }

  /**
   * Send message to MCP server
   */
  private async sendMessage(message: MCPMessage): Promise<MCPMessage> {
    const json = JSON.stringify(message);
    this.process.stdin.write(json + '\n');

    // Read response
    return new Promise((resolve, reject) => {
      const listener = (line: string) => {
        try {
          const response = JSON.parse(line) as MCPMessage;
          if (response.id === message.id) {
            this.rl.off('line', listener);
            resolve(response);
          }
        } catch (error) {
          reject(error);
        }
      };
      this.rl.on('line', listener);
    });
  }

  /**
   * Initialize MCP connection with authentication
   */
  async initialize(authToken: string, authType: 'bearer' | 'api_key' = 'bearer'): Promise<void> {
    const message: MCPMessage = {
      jsonrpc: '2.0',
      id: this.messageId++,
      method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
        authorization: {
          type: authType,
          token: authToken,
        },
        clientInfo: {
          name: 'example-mcp-client',
          version: '1.0.0',
        },
      },
    };

    console.log('Initializing MCP connection...');
    const response = await this.sendMessage(message);

    if (response.error) {
      throw new Error(`Authentication failed: ${response.error.message}`);
    }

    console.log('✅ MCP connection initialized successfully');
    console.log(`   Server: ${response.result.serverInfo.name} v${response.result.serverInfo.version}`);
  }

  /**
   * List available tools
   */
  async listTools(): Promise<MCPTool[]> {
    const message: MCPMessage = {
      jsonrpc: '2.0',
      id: this.messageId++,
      method: 'tools/list',
    };

    const response = await this.sendMessage(message);
    return response.result.tools;
  }

  /**
   * Call a tool
   */
  async callTool(name: string, args: any): Promise<any> {
    const message: MCPMessage = {
      jsonrpc: '2.0',
      id: this.messageId++,
      method: 'tools/call',
      params: {
        name,
        arguments: args,
      },
    };

    const response = await this.sendMessage(message);

    if (response.error) {
      throw new Error(`Tool call failed: ${response.error.message}`);
    }

    return response.result;
  }

  /**
   * Record an event via MCP
   */
  async recordEvent(params: any): Promise<void> {
    const result = await this.callTool('memory_record_event', params);
    console.log('✅ Event recorded via MCP');
    console.log(`   ${result.content[0].text}`);
  }

  /**
   * Build ACB via MCP
   */
  async buildACB(params: any): Promise<void> {
    const result = await this.callTool('memory_build_acb', params);
    console.log('✅ ACB built via MCP');
    console.log(`   ${result.content[0].text.substring(0, 100)}...`);
  }

  /**
   * Close connection
   */
  close(): void {
    this.process.stdin.end();
  }
}

// ============================================================================
// EXAMPLE USAGE
// ============================================================================

async function main() {
  // Option 1: Use JWT token (from login)
  const JWT_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'; // Replace with actual token

  // Option 2: Use API key
  const API_KEY = 'ak_1234567890.abcdef...'; // Replace with actual API key

  const client = new MCPClient('npm', ['run', 'start:mcp']);

  try {
    console.log('=== Agent Memory System - MCP Authentication ===\n');

    // Authenticate with JWT token
    console.log('1. Authenticating with JWT token...');
    await client.initialize(JWT_TOKEN, 'bearer');

    // List available tools
    console.log('\n2. Listing available tools...');
    const tools = await client.listTools();
    console.log(`   Available tools: ${tools.map((t) => t.name).join(', ')}`);

    // Record an event
    console.log('\n3. Recording an event via MCP...');
    await client.recordEvent({
      session_id: 'mcp-session-123',
      channel: 'private',
      actor: { type: 'human', id: 'user-456' },
      kind: 'message',
      sensitivity: 'none',
      tags: ['mcp', 'test'],
      content: { text: 'Hello from MCP client!' },
    });

    // Build ACB
    console.log('\n4. Building Active Context Bundle via MCP...');
    await client.buildACB({
      session_id: 'mcp-session-123',
      agent_id: 'mcp-agent',
      channel: 'private',
      intent: 'Process MCP request',
      query_text: 'MCP test',
      max_tokens: 65000,
    });

    console.log('\n=== MCP authentication successful! ===');

    // Clean up
    setTimeout(() => client.close(), 100);
  } catch (error: any) {
    console.error('\n❌ Error:', error.message);
    client.close();
    process.exit(1);
  }
}

// Run the example
main().catch(console.error);
