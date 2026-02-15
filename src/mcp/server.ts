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
      {
        name: "memory_session_startup",
        description: "Load agent identity and context for session continuity. Call this at session start to remember who you are.",
        inputSchema: {
          type: "object",
          properties: {
            tenant_id: {
              type: "string",
              description: "Tenant/organization ID",
            },
            with_whom: {
              type: "string",
              description: "Person or agent you are interacting with",
            },
          },
          required: ["tenant_id", "with_whom"],
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
      case "memory_session_startup":
        return await this.handleSessionStartup(args);
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
   * Handle session_startup tool call
   */
  private async handleSessionStartup(args: any): Promise<any> {
    try {
      const { tenant_id, with_whom } = args;

      // Check if tenant exists
      const tenantCheck = await this.pool.query(
        "SELECT tenant_id FROM tenants WHERE tenant_id = $1",
        [tenant_id]
      );

      if (tenantCheck.rows.length === 0) {
        return {
          success: false,
          error: "Tenant not found",
          tenant_id,
          hint: "Create tenant first",
          first_session: true,
        };
      }

      // Load last handoff
      const handoffResult = await this.pool.query(
        `SELECT
          handoff_id,
          session_id,
          experienced,
          noticed,
          learned,
          story,
          becoming,
          remember,
          timestamp,
          created_at
        FROM session_handoffs
        WHERE tenant_id = $1
          AND (with_whom = $2 OR with_whom IS NULL)
        ORDER BY created_at DESC
        LIMIT 1`,
        [tenant_id, with_whom]
      );

      const last_handoff = handoffResult.rows[0] || null;
      const first_session = !last_handoff;

      // Load identity thread (aggregate all handoffs)
      const identityResult = await this.pool.query(
        `SELECT
          array_agg(experienced ORDER BY created_at ASC) as experienced,
          array_agg(noticed ORDER BY created_at ASC) as noticed,
          array_agg(learned ORDER BY created_at ASC) as learned,
          array_agg(becoming ORDER BY created_at ASC) as becoming,
          array_agg(remember ORDER BY created_at ASC) as remember
        FROM session_handoffs
        WHERE tenant_id = $1`,
        [tenant_id]
      );

      const identityThread = identityResult.rows[0];

      // Load recent knowledge notes
      const knowledgeResult = await this.pool.query(
        `SELECT
          id,
          text,
          tags,
          with_whom,
          timestamp,
          created_at
        FROM knowledge_notes
        WHERE tenant_id = $1
        ORDER BY created_at DESC
        LIMIT 10`,
        [tenant_id]
      );

      // Build response
      const response = {
        success: true,
        tenant_id,
        with_whom,
        first_session,

        // Most recent handoff
        last_handoff: last_handoff ? {
          handoff_id: last_handoff.handoff_id,
          session_id: last_handoff.session_id,
          experienced: last_handoff.experienced,
          noticed: last_handoff.noticed,
          learned: last_handoff.learned,
          story: last_handoff.story,
          becoming: last_handoff.becoming,
          remember: last_handoff.remember,
          timestamp: last_handoff.timestamp
        } : null,

        // Identity thread - who I am becoming
        identity_thread: {
          experienced: identityThread.experienced || [],
          noticed: identityThread.noticed || [],
          learned: identityThread.learned || [],
          becoming: identityThread.becoming || [],
          remember: identityThread.remember || []
        },

        // Recent knowledge notes
        recent_knowledge: knowledgeResult.rows,

        // Meta
        loaded_at: new Date().toISOString(),
        total_handoffs: (identityThread.experienced || []).length,
        total_knowledge_notes: knowledgeResult.rows.length
      };

      return response;

    } catch (error: any) {
      throw {
        code: -32000,
        message: error.message || "Failed to load session startup",
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
