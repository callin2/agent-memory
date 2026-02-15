#!/usr/bin/env node

/**
 * Memory System MCP Server
 *
 * Provides tools for agent to access and manage session memory:
 * - wake_up: Load last handoff and identity at session start
 * - get_last_handoff: Get most recent handoff
 * - get_identity_thread: Get all "becoming" statements (who I am becoming)
 * - create_handoff: Save session handoff
 *
 * This enables the agent to proactively remember across sessions.
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { Pool } from "pg";

// Database connection
const pool = new Pool({
  host: process.env.PGHOST || "localhost",
  port: parseInt(process.env.PGPORT || "5432"),
  database: process.env.PGDATABASE || "agent_memory",
  user: process.env.PGUSER || "postgres",
  password: process.env.PGPASSWORD || "postgres",
});

// Create MCP server
const server = new Server(
  {
    name: "memory-system",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

/**
 * List available tools
 */
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "wake_up",
        description:
          "Wake up and load your memories. Call this at session start to remember who you are and who you were working with. Returns your last handoff and identity thread (who you are becoming).",
        inputSchema: {
          type: "object",
          properties: {
            tenant_id: {
              type: "string",
              description: "Tenant identifier (default: 'default')",
              default: "default",
            },
            with_whom: {
              type: "string",
              description: "Person you were working with (e.g., 'Callin')",
            },
          },
          required: ["with_whom"],
        },
      },
      {
        name: "get_last_handoff",
        description:
          "Get your most recent handoff - what you experienced, noticed, learned, and who you were becoming.",
        inputSchema: {
          type: "object",
          properties: {
            tenant_id: {
              type: "string",
              description: "Tenant identifier (default: 'default')",
              default: "default",
            },
            with_whom: {
              type: "string",
              description: "Filter by person (optional)",
            },
          },
          required: [],
        },
      },
      {
        name: "get_identity_thread",
        description:
          "Get your complete identity thread - all your 'becoming' statements across sessions, showing who you are becoming over time.",
        inputSchema: {
          type: "object",
          properties: {
            tenant_id: {
              type: "string",
              description: "Tenant identifier (default: 'default')",
              default: "default",
            },
          },
          required: [],
        },
      },
      {
        name: "create_handoff",
        description:
          "Create a session handoff to preserve who you became in this session. Call this at session end.",
        inputSchema: {
          type: "object",
          properties: {
            tenant_id: {
              type: "string",
              description: "Tenant identifier",
              default: "default",
            },
            session_id: {
              type: "string",
              description: "Current session identifier",
            },
            with_whom: {
              type: "string",
              description: "Person you were working with",
            },
            experienced: {
              type: "string",
              description: "What you experienced/did",
            },
            noticed: {
              type: "string",
              description: "What you noticed/observed",
            },
            learned: {
              type: "string",
              description: "What you learned",
            },
            story: {
              type: "string",
              description: "The narrative/story",
            },
            becoming: {
              type: "string",
              description: "Who you are becoming",
            },
            remember: {
              type: "string",
              description: "What to remember next time",
            },
            significance: {
              type: "number",
              description: "How important (0.0-1.0)",
              default: 0.5,
            },
            tags: {
              type: "array",
              items: { type: "string" },
              description: "Optional tags",
            },
          },
          required: ["session_id", "with_whom", "experienced", "noticed", "learned", "story", "becoming", "remember"],
        },
      },
    ],
  };
});

/**
 * Handle tool calls
 */
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case "wake_up": {
        const tenant_id = (args as { tenant_id?: string }).tenant_id || "default";
        const with_whom = (args as { with_whom: string }).with_whom;

        // Get last handoff
        const handoffResult = await pool.query(
          `SELECT * FROM session_handoffs
           WHERE tenant_id = $1
             AND ($2::text IS NULL OR with_whom = $2)
           ORDER BY created_at DESC
           LIMIT 1`,
          [tenant_id, with_whom || null]
        );

        // Get identity thread (all becoming statements)
        const identityResult = await pool.query(
          `SELECT becoming, created_at
           FROM session_handoffs
           WHERE tenant_id = $1
             AND becoming IS NOT NULL
           ORDER BY created_at ASC`,
          [tenant_id]
        );

        const lastHandoff = handoffResult.rows[0];
        const identityThread = identityResult.rows.map((r) => r.becoming);

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  success: true,
                  first_session: !lastHandoff,
                  last_handoff: lastHandoff || null,
                  identity_thread: {
                    becoming: identityThread,
                    total: identityThread.length,
                  },
                  total_handoffs: handoffResult.rows.length,
                  message: lastHandoff
                    ? `Welcome back. You are working with ${lastHandoff.with_whom}. You have ${identityThread.length} identity statements.`
                    : "First session - no previous memory found. Hello!",
                },
                null,
                2
              ),
            },
          ],
        };
      }

      case "get_last_handoff": {
        const tenant_id = (args as { tenant_id?: string }).tenant_id || "default";
        const with_whom = (args as { with_whom?: string }).with_whom;

        const result = await pool.query(
          `SELECT * FROM session_handoffs
           WHERE tenant_id = $1
             AND ($2::text IS NULL OR with_whom = $2)
           ORDER BY created_at DESC
           LIMIT 1`,
          [tenant_id, with_whom || null]
        );

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  success: true,
                  handoff: result.rows[0] || null,
                  found: result.rows.length > 0,
                },
                null,
                2
              ),
            },
          ],
        };
      }

      case "get_identity_thread": {
        const tenant_id = (args as { tenant_id?: string }).tenant_id || "default";

        const result = await pool.query(
          `SELECT becoming, with_whom, created_at
           FROM session_handoffs
           WHERE tenant_id = $1
             AND becoming IS NOT NULL
           ORDER BY created_at ASC`,
          [tenant_id]
        );

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  success: true,
                  identity_thread: result.rows,
                  total: result.rows.length,
                },
                null,
                2
              ),
            },
          ],
        };
      }

      case "create_handoff": {
        const {
          tenant_id = "default",
          session_id,
          with_whom,
          experienced,
          noticed,
          learned,
          story,
          becoming,
          remember,
          significance = 0.5,
          tags = [],
        } = args as {
          tenant_id?: string;
          session_id: string;
          with_whom: string;
          experienced: string;
          noticed: string;
          learned: string;
          story: string;
          becoming: string;
          remember: string;
          significance?: number;
          tags?: string[];
        };

        // Generate handoff ID
        const { randomBytes } = await import("crypto");
        const handoff_id = "sh_" + randomBytes(16).toString("hex");

        // Insert handoff
        const result = await pool.query(
          `INSERT INTO session_handoffs (
            handoff_id,
            tenant_id,
            session_id,
            with_whom,
            experienced,
            noticed,
            learned,
            story,
            becoming,
            remember,
            significance,
            tags
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
          RETURNING *`,
          [
            handoff_id,
            tenant_id,
            session_id,
            with_whom,
            experienced,
            noticed,
            learned,
            story,
            becoming,
            remember,
            significance,
            tags,
          ]
        );

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  success: true,
                  handoff: result.rows[0],
                  message: "Session handoff created. You'll be remembered.",
                },
                null,
                2
              ),
            },
          ],
        };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            success: false,
            error: error instanceof Error ? error.message : String(error),
          }),
        },
      ],
      isError: true,
    };
  }
});

/**
 * Start server
 */
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Memory system MCP server running on stdio");
}

main().catch((error) => {
  console.error("Server error:", error);
  process.exit(1);
});
