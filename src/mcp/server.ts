/**
 * MCP (Model Context Protocol) Server Implementation
 *
 * This server exposes the memory system as an MCP server that can be used by AI agents.
 * Uses stdio transport for communication with MCP clients.
 *
 * Security: Requires authentication via JWT or API key during initialize handshake.
 */

import { Pool } from "pg";
import { recordEvent, getEvent } from "../core/recorder.js";
import { buildACB } from "../core/orchestrator.js";
import { verifyToken } from "../middleware/auth.js";
import { APIKeyService } from "../services/api-key-service.js";
import { AuditService } from "../services/audit-service.js";

/**
 * User context from authentication
 */
export interface UserContext {
  user_id: string;
  tenant_id: string;
  roles: string[];
}

/**
 * Initialize params with authorization
 */
export interface InitializeParams {
  protocolVersion?: string;
  capabilities?: any;
  authorization?: {
    type: "bearer" | "api_key";
    token: string;
  };
  clientInfo?: {
    name: string;
    version: string;
  };
}

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
  private currentUser?: UserContext;
  private apiKeyService: APIKeyService;
  private auditService: AuditService;
  private isInitialized = false;

  constructor(pool: Pool) {
    this.pool = pool;
    this.apiKeyService = new APIKeyService(pool);
    this.auditService = new AuditService(pool);
    this.registerTools();
  }

  private getEnvAuthorization(): {
    type: "bearer" | "api_key";
    token: string;
  } | null {
    const rawType = (process.env.MCP_AUTH_TYPE || "").trim();
    const rawToken = (process.env.MCP_AUTH_TOKEN || "").trim();

    if (
      rawType &&
      rawToken &&
      (rawType === "bearer" || rawType === "api_key")
    ) {
      return { type: rawType, token: rawToken };
    }

    const apiKey = (process.env.MCP_API_KEY || "").trim();
    if (apiKey) {
      return { type: "api_key", token: apiKey };
    }

    const bearerToken = (process.env.MCP_BEARER_TOKEN || "").trim();
    if (bearerToken) {
      return { type: "bearer", token: bearerToken };
    }

    return null;
  }

  /**
   * Validate authentication token (JWT or API key)
   */
  private async validateAuthToken(auth: {
    type: string;
    token: string;
  }): Promise<UserContext | null> {
    if (auth.type === "bearer") {
      // Validate JWT token
      const payload = verifyToken(auth.token);
      if (payload) {
        return {
          user_id: payload.user_id,
          tenant_id: payload.tenant_id,
          roles: payload.roles,
        };
      }
    } else if (auth.type === "api_key") {
      // Validate API key
      const result = await this.apiKeyService.validateAPIKey(auth.token);
      if (result.valid && result.keyData) {
        return {
          user_id: `service:${result.keyData.key_id}`,
          tenant_id: result.keyData.tenant_id,
          roles: result.keyData.scopes,
        };
      }
    }
    return null;
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
              description: "Channel for the event",
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
        name: "memory_query_decisions",
        description: "Query decisions in the decision ledger",
        inputSchema: {
          type: "object",
          properties: {
            tenant_id: {
              type: "string",
              description: "Tenant/organization ID",
            },
            status: {
              type: "string",
              enum: ["active", "superseded"],
              default: "active",
            },
          },
          required: ["tenant_id"],
        },
      },
    ];
  }

  /**
   * Handle incoming MCP message
   */
  async handleMessage(message: MCPMessage): Promise<MCPMessage> {
    const response: MCPMessage = {
      jsonrpc: "2.0",
      id: message.id,
    };

    try {
      switch (message.method) {
        case "initialize":
          response.result = await this.initialize(message.params);
          break;

        case "tools/list":
          response.result = await this.listTools();
          break;

        case "tools/call":
          response.result = await this.callTool(message.params);
          break;

        case "ping":
          response.result = { pong: true };
          break;

        default:
          response.error = {
            code: -32601,
            message: `Method not found: ${message.method}`,
          };
      }
    } catch (error: any) {
      response.error = {
        code: -32603,
        message: error.message || "Internal error",
        data: error.stack,
      };
    }

    return response;
  }

  /**
   * Initialize handshake with authentication
   */
  private async initialize(params: InitializeParams): Promise<any> {
    const authorization = params.authorization ?? this.getEnvAuthorization();

    // Allow local-only auth bypass for clients that can't send initialize.authorization
    if (!authorization) {
      if (
        process.env.MCP_ALLOW_UNAUTHENTICATED === "true" &&
        process.env.NODE_ENV !== "production"
      ) {
        const tenantId =
          (process.env.MCP_TENANT_ID || "local").trim() || "local";
        const userId =
          (process.env.MCP_USER_ID || "opencode").trim() || "opencode";

        this.currentUser = {
          user_id: userId,
          tenant_id: tenantId,
          roles: ["admin"],
        };
        this.isInitialized = true;

        await this.auditService.logAuthEvent(
          userId,
          "mcp_connection",
          "success",
          undefined,
          {
            tenant_id: tenantId,
            client: params.clientInfo,
            auth: "unauthenticated_env",
          },
        );

        return {
          protocolVersion: "2024-11-05",
          capabilities: {
            tools: {},
            resources: {},
          },
          serverInfo: {
            name: "agent-memory-system",
            version: "2.0.0",
          },
        };
      }

      throw new Error(
        "Authentication required: Missing authorization in initialize params (or set MCP_AUTH_* env vars)",
      );
    }

    const user = await this.validateAuthToken(authorization);
    if (!user) {
      throw new Error("Authentication failed: Invalid token or API key");
    }

    // Store user context for subsequent tool calls
    this.currentUser = user;
    this.isInitialized = true;

    // Log authentication event
    await this.auditService.logAuthEvent(
      user.user_id,
      "mcp_connection",
      "success",
      undefined,
      {
        tenant_id: user.tenant_id,
        client: params.clientInfo,
      },
    );

    return {
      protocolVersion: "2024-11-05",
      capabilities: {
        tools: {},
        resources: {},
      },
      serverInfo: {
        name: "agent-memory-system",
        version: "2.0.0",
      },
    };
  }

  /**
   * List available tools
   */
  private async listTools(): Promise<any> {
    return {
      tools: this.tools,
    };
  }

  /**
   * Call a tool with authentication check
   */
  private async callTool(params: any): Promise<any> {
    // Ensure user is authenticated
    if (!this.currentUser || !this.isInitialized) {
      throw new Error("Not authenticated: Connection not initialized");
    }

    const { name, arguments: args } = params;

    // Inject tenant_id from authenticated user
    args.tenant_id = this.currentUser.tenant_id;

    // Log tool usage
    await this.auditService.logEvent(
      this.currentUser.tenant_id,
      this.currentUser.user_id,
      "mcp_tool_call",
      name,
      "success",
      {
        tool_name: name,
        args: { ...args, content: args.content ? "[REDACTED]" : undefined },
      },
      "tool",
      name,
      undefined, // ip_address
      undefined, // user_agent
    );

    switch (name) {
      case "memory_record_event":
        return await this.recordEvent(args);

      case "memory_build_acb":
        return await this.buildACB(args);

      case "memory_get_event":
        return await this.getEvent(args);

      case "memory_query_decisions":
        return await this.queryDecisions(args);

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  }

  /**
   * Record event tool with tenant isolation
   */
  private async recordEvent(args: any): Promise<any> {
    // Override tenant_id with authenticated user's tenant
    const eventData = {
      ...args,
      tenant_id: this.currentUser!.tenant_id,
    };

    const result = await recordEvent(this.pool, eventData);

    return {
      content: [
        {
          type: "text",
          text: `Event recorded successfully. Event ID: ${result.event_id}, Chunks: ${result.chunk_ids.length}`,
        },
      ],
      isError: false,
      data: result,
    };
  }

  /**
   * Build ACB tool with tenant isolation
   */
  private async buildACB(args: any): Promise<any> {
    // Override tenant_id with authenticated user's tenant
    const acbArgs = {
      ...args,
      tenant_id: this.currentUser!.tenant_id,
    };

    const acb = await buildACB(this.pool, acbArgs);

    // Format ACB as readable text
    let text = `Active Context Bundle (${acb.token_used_est}/${acb.budget_tokens} tokens):\n\n`;

    for (const section of acb.sections) {
      if (section.items.length > 0) {
        text += `## ${section.name} (${section.token_est} tokens)\n`;
        for (const item of section.items) {
          if (item.text) {
            text += `${item.text}\n\n`;
          }
        }
      }
    }

    return {
      content: [
        {
          type: "text",
          text,
        },
      ],
      isError: false,
      data: acb,
    };
  }

  /**
   * Get event tool with tenant isolation
   */
  private async getEvent(args: any): Promise<any> {
    const event = await getEvent(this.pool, args.event_id);

    if (!event) {
      throw new Error(`Event not found: ${args.event_id}`);
    }

    // Verify event belongs to user's tenant
    if (event.tenant_id !== this.currentUser!.tenant_id) {
      await this.auditService.logEvent(
        this.currentUser!.tenant_id,
        this.currentUser!.user_id,
        "mcp_access_denied",
        "get_event",
        "failure",
        {
          event_id: args.event_id,
          reason: "tenant_mismatch",
        },
        "event",
        args.event_id,
        undefined, // ip_address
        undefined, // user_agent
      );
      throw new Error(`Access denied: Event belongs to different tenant`);
    }

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(event, null, 2),
        },
      ],
      isError: false,
    };
  }

  /**
   * Query decisions tool with tenant isolation
   */
  private async queryDecisions(args: any): Promise<any> {
    // Force tenant_id from authenticated user
    const tenantId = this.currentUser!.tenant_id;
    const status = args.status || "active";

    const result = await this.pool.query(
      `SELECT * FROM decisions
       WHERE tenant_id = $1 AND status = $2
       ORDER BY ts DESC
       LIMIT 50`,
      [tenantId, status],
    );

    return {
      content: [
        {
          type: "text",
          text: `Found ${result.rows.length} decisions:\n\n${result.rows
            .map((d: any) => `- ${d.decision} (${d.status})`)
            .join("\n")}`,
        },
      ],
      isError: false,
      data: result.rows,
    };
  }

  /**
   * Start stdio server
   */
  async startStdioServer(): Promise<void> {
    process.stdin.setEncoding("utf-8");

    let buffer = "";

    for await (const chunk of process.stdin) {
      buffer += chunk;

      // Process complete messages (one per line)
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (!line.trim()) {
          continue;
        }

        try {
          const message: MCPMessage = JSON.parse(line);
          const response = await this.handleMessage(message);
          process.stdout.write(JSON.stringify(response) + "\n");
        } catch (error: any) {
          const errorResponse: MCPMessage = {
            jsonrpc: "2.0",
            id: undefined,
            error: {
              code: -32700,
              message: "Parse error",
              data: error.message,
            },
          };
          process.stdout.write(JSON.stringify(errorResponse) + "\n");
        }
      }
    }
  }
}

/**
 * Create and start MCP server
 */
export async function startMCPServer(pool: Pool): Promise<void> {
  const server = new MCPServer(pool);
  await server.startStdioServer();
}
