/**
 * MCP (Model Context Protocol) Server Implementation
 *
 * This server exposes memory system as an MCP server that can be used by AI agents.
 * Uses stdio transport for communication with MCP clients.
 */

import { Pool } from "pg";
import { recordEvent, getEvent } from "../core/recorder.js";
import { buildACB } from "../core/orchestrator.js";

export interface MCPMessage {
  jsonrpc: "2.0";
  id?: number | string;
  method?: string;
  params?: any;
  result?: any;
  error?: {
    code: number;
    message: string;
    data?: any;
  };
}

export interface MCPTool {
  name: string;
  description: string;
  inputSchema: any;
}

export class MCPServer {
  private pool: Pool;
  private tools: MCPTool[] = [];
  private isInitialized = false;

  constructor(pool: Pool) {
    this.pool = pool;
    this.registerTools();
  }

  /**
   * Register available tools
   */
  private registerTools(): void {
    this.tools = [
      {
        name: "memory_record_event",
        description:
          "Record an event (message, tool call, decision, etc.) to the memory system",
        inputSchema: {
          type: "object",
          properties: {
            tenant_id: {
              type: "string",
              description: "Tenant/organization ID",
            },
            session_id: { type: "string", description: "Session identifier" },
            channel: {
              type: "string",
              enum: ["private", "public", "team", "agent"],
              description: "Channel for event",
            },
            actor: {
              type: "object",
              properties: {
                type: { type: "string", enum: ["human", "agent", "tool"] },
                id: { type: "string" },
              },
              required: ["type", "id"],
            },
            kind: {
              type: "string",
              enum: [
                "message",
                "tool_call",
                "tool_result",
                "decision",
                "task_update",
              ],
            },
            sensitivity: {
              type: "string",
              enum: ["none", "low", "high"],
              default: "none",
            },
            tags: {
              type: "array",
              items: { type: "string" },
              description: "Tags for categorization",
            },
            content: { type: "object", description: "Event content" },
            refs: {
              type: "array",
              items: { type: "string" },
              description: "References to other events",
            },
          },
          required: [
            "tenant_id",
            "session_id",
            "channel",
            "actor",
            "kind",
            "content",
          ],
        },
      },
      {
        name: "memory_build_acb",
        description:
          "Build an Active Context Bundle for the next LLM call with curated memory",
        inputSchema: {
          type: "object",
          properties: {
            tenant_id: {
              type: "string",
              description: "Tenant/organization ID",
            },
            session_id: { type: "string", description: "Session identifier" },
            agent_id: { type: "string", description: "Agent identifier" },
            channel: {
              type: "string",
              enum: ["private", "public", "team", "agent"],
            },
            intent: { type: "string", description: "Current intent/goal" },
            query_text: {
              type: "string",
              description: "Query text for retrieval",
            },
            max_tokens: {
              type: "number",
              default: 65000,
              description: "Maximum tokens in context bundle",
            },
          },
          required: [
            "tenant_id",
            "session_id",
            "agent_id",
            "channel",
            "intent",
          ],
        },
      },
      {
        name: "memory_get_event",
        description: "Get a specific event by ID",
        inputSchema: {
          type: "object",
          properties: {
            event_id: { type: "string", description: "Event ID to retrieve" },
          },
          required: ["event_id"],
        },
      },
    ];
  }

  /**
   * Handle initialize request
   */
  private async handleInitialize(_params: any): Promise<any> {
    this.isInitialized = true;
    return {
      protocolVersion: "2024-11-05",
      capabilities: {
        tools: {},
      },
      serverInfo: {
        name: "agent-memory-mcp",
        version: "2.0.0",
      },
    };
  }

  /**
   * Handle tools/list request
   */
  private async handleToolsList(): Promise<any> {
    return { tools: this.tools };
  }

  /**
   * Handle tools/call request
   */
  private async handleToolsCall(params: any): Promise<any> {
    if (!this.isInitialized) {
      throw {
        code: -32000,
        message: "Server not initialized",
      };
    }

    const { name, arguments: args } = params;
    const tool = this.tools.find((t) => t.name === name);

    if (!tool) {
      throw {
        code: -32601,
        message: `Tool not found: ${name}`,
      };
    }

    switch (name) {
      case "memory_record_event":
        return await this.handleRecordEvent(args);
      case "memory_build_acb":
        return await this.handleBuildACB(args);
      case "memory_get_event":
        return await this.handleGetEvent(args);
      default:
        throw {
          code: -32601,
          message: `Tool not implemented: ${name}`,
        };
    }
  }

  /**
   * Handle record_event tool call
   */
  private async handleRecordEvent(args: any): Promise<any> {
    try {
      const result = await recordEvent(this.pool, args);
      return {
        success: true,
        event_id: result.event_id,
      };
    } catch (error: any) {
      throw {
        code: -32000,
        message: error.message || "Failed to record event",
      };
    }
  }

  /**
   * Handle build_acb tool call
   */
  private async handleBuildACB(args: any): Promise<any> {
    try {
      const acb = await buildACB(this.pool, {
        tenant_id: args.tenant_id,
        session_id: args.session_id,
        agent_id: args.agent_id,
        channel: args.channel,
        intent: args.intent,
        query_text: args.query_text,
        max_tokens: args.max_tokens || 65000,
      });

      return {
        success: true,
        bundle: acb,
      };
    } catch (error: any) {
      throw {
        code: -32000,
        message: error.message || "Failed to build ACB",
      };
    }
  }

  /**
   * Handle get_event tool call
   */
  private async handleGetEvent(args: any): Promise<any> {
    try {
      const event = await getEvent(this.pool, args.event_id);
      if (!event) {
        throw {
          code: -32000,
          message: "Event not found",
        };
      }
      return {
        success: true,
        event: event,
      };
    } catch (error: any) {
      throw {
        code: -32000,
        message: error.message || "Failed to get event",
      };
    }
  }

  /**
   * Start the MCP server using stdio
   */
  async start(): Promise<void> {
    const readline = require("readline");
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    console.error = (...args: any[]) => {
      // Write errors to stderr so they don't interfere with JSON-RPC
      process.stderr.write(`ERROR: ${args.join(" ")}\n`);
    };

    for await (const line of rl) {
      let messageId: string | number | undefined;

      try {
        const message: MCPMessage = JSON.parse(line);

        if (!message.id) {
          // Notification, no response needed
          continue;
        }

        messageId = message.id;

        let response: MCPMessage = {
          jsonrpc: "2.0",
          id: messageId,
        };

        switch (message.method) {
          case "initialize":
            response.result = await this.handleInitialize(message.params);
            break;
          case "tools/list":
            response.result = await this.handleToolsList();
            break;
          case "tools/call":
            response.result = await this.handleToolsCall(message.params);
            break;
          default:
            response.error = {
              code: -32601,
              message: `Method not found: ${message.method}`,
            };
        }

        console.log(JSON.stringify(response));
      } catch (err: any) {
        const errorResponse: MCPMessage = {
          jsonrpc: "2.0",
          id: messageId,
          error: {
            code: err.code || -32000,
            message: err.message || err.toString() || "Unknown error",
          },
        };
        console.log(JSON.stringify(errorResponse));
      }
    }
  }
}

/**
 * Start MCP server
 */
export async function startMCPServer(pool: Pool): Promise<void> {
  const server = new MCPServer(pool);
  await server.start();
}
