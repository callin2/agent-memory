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
        name: "wake_up_stratified",
        description:
          "Wake up with stratified memory layers - token-efficient context loading. Returns metadata (fast), latest reflection (compressed), recent handoffs (detail), and optional progressive retrieval. Much more efficient than wake_up for large memory sets.",
        inputSchema: {
          type: "object",
          properties: {
            tenant_id: {
              type: "string",
              description: "Tenant identifier (default: 'default')",
              default: "default",
            },
            layers: {
              type: "array",
              items: { type: "string", enum: ["metadata", "reflection", "recent", "progressive"] },
              description: "Which layers to load. Default: all",
              default: ["metadata", "reflection", "recent"],
            },
            recent_count: {
              type: "number",
              description: "Number of recent handoffs to include (default: 3)",
              default: 3,
            },
            topic: {
              type: "string",
              description: "Specific topic for progressive retrieval (optional)",
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

      case "wake_up_stratified": {
        const {
          tenant_id = "default",
          layers = ["metadata", "reflection", "recent"],
          recent_count = 3,
          topic,
        } = args as {
          tenant_id?: string;
          layers?: string[];
          recent_count?: number;
          topic?: string;
        };

        const context: any = {
          success: true,
          tenant_id,
          layers_loaded: layers,
        };

        let estimatedTokens = 0;

        // Layer 1: Metadata (~50 tokens)
        if (layers.includes("metadata")) {
          const metadataResult = await pool.query(
            `SELECT * FROM memory_metadata WHERE tenant_id = $1`,
            [tenant_id]
          );
          context.metadata = metadataResult.rows[0] || {
            session_count: 0,
            message: "No metadata found. First session?",
          };
          estimatedTokens += 50;
        }

        // Layer 2: Latest reflection (~200 tokens)
        if (layers.includes("reflection")) {
          const reflectionResult = await pool.query(
            `SELECT * FROM memory_reflections
             WHERE tenant_id = $1
             ORDER BY generated_at DESC
             LIMIT 1`,
            [tenant_id]
          );

          if (reflectionResult.rows.length > 0) {
            context.reflection = {
              summary: reflectionResult.rows[0].summary,
              key_insights: reflectionResult.rows[0].key_insights || [],
              themes: reflectionResult.rows[0].themes || [],
              session_count: reflectionResult.rows[0].session_count,
              generated_at: reflectionResult.rows[0].generated_at,
            };
            estimatedTokens += 200;
          } else {
            context.reflection = {
              message: "No reflections yet. System needs to run consolidation.",
              hint: "Reflections are created periodically from session data.",
            };
            estimatedTokens += 50;
          }
        }

        // Layer 3: Recent handoffs (~500 tokens for 3 handoffs)
        if (layers.includes("recent")) {
          const recentResult = await pool.query(
            `SELECT handoff_id, experienced, noticed, learned, becoming, remember, significance, tags, created_at
             FROM session_handoffs
             WHERE tenant_id = $1
             ORDER BY created_at DESC
             LIMIT $2`,
            [tenant_id, recent_count]
          );
          context.recent = recentResult.rows;
          estimatedTokens += recentResult.rows.length * 150; // ~150 tokens per handoff
        }

        // Layer 4: Progressive retrieval (on-demand, varies)
        if (layers.includes("progressive")) {
          if (topic) {
            // Topic-based retrieval using full-text search (fixes SQL injection)
            const topicResult = await pool.query(
              `SELECT handoff_id, experienced, becoming, created_at,
                       ts_rank(
                         to_tsvector('english',
                           coalesce(experienced, '') || ' ' ||
                           coalesce(noticed, '') || ' ' ||
                           coalesce(becoming, '')
                         ),
                         plainto_tsquery('english', $2)
                       ) as relevance
               FROM session_handoffs
               WHERE tenant_id = $1
                 AND to_tsvector('english',
                      coalesce(experienced, '') || ' ' ||
                      coalesce(noticed, '') || ' ' ||
                      coalesce(becoming, '')
                    ) @@ plainto_tsquery('english', $2)
               ORDER BY relevance DESC, created_at DESC
               LIMIT 5`,
              [tenant_id, topic]
            );
            context.progressive = {
              type: "topic",
              topic,
              results: topicResult.rows,
            };
            estimatedTokens += topicResult.rows.length * 100;
          } else {
            // Show available topics (using GIN index)
            const topicsResult = await pool.query(
              `SELECT DISTINCT unnest(tags) as topic, COUNT(*) as count
               FROM session_handoffs
               WHERE tenant_id = $1
               GROUP BY topic
               ORDER BY count DESC
               LIMIT 10`,
              [tenant_id]
            );
            context.progressive = {
              type: "available_topics",
              topics: topicsResult.rows,
              hint: "Call again with topic parameter to retrieve specific memories.",
            };
            estimatedTokens += 100;
          }
        }

        context.estimated_tokens = estimatedTokens;
        context.compression_ratio = context.metadata?.session_count
          ? `${context.metadata.session_count} sessions → ${estimatedTokens} tokens`
          : "New session";

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(context, null, 2),
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
