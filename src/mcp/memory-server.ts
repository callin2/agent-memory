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
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { Pool } from "pg";
import express from "express";

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
          "Wake up and load your memories with identity-first approach. Call this at session start to remember who you are. Returns identity statement, identity thread, and then contextual memories. Auto-detects optimal loading: <5 sessions uses full loading, ≥5 sessions uses stratified (compressed) loading for efficiency.",
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
            layers: {
              type: "array",
              items: { type: "string", enum: ["identity", "semantic", "reflection", "recent", "progressive"] },
              description: "Memory layers to load (default: identity-first loading). Ignored for <5 sessions (uses full loading).",
              default: ["identity", "semantic", "reflection", "recent"],
            },
            recent_count: {
              type: "number",
              description: "Number of recent handoffs (default: 3)",
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
        name: "wake_up_stratified",
        description:
          "DEPRECATED: Use wake_up instead (now auto-detects optimal loading). This tool remains for backward compatibility.",
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
              items: { type: "string", enum: ["metadata", "semantic", "reflection", "recent", "progressive"] },
              description: "Which layers to load. Default: all",
              default: ["metadata", "semantic", "reflection", "recent"],
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
        const {
          tenant_id = "default",
          with_whom,
          layers = ["identity", "semantic", "reflection", "recent"],
          recent_count = 3,
          topic,
        } = args as {
          tenant_id?: string;
          with_whom?: string;
          layers?: string[];
          recent_count?: number;
          topic?: string;
        };

        // Get total session count to determine loading strategy
        const countResult = await pool.query(
          `SELECT COUNT(DISTINCT session_id) as count FROM session_handoffs WHERE tenant_id = $1`,
          [tenant_id]
        );
        const sessionCount = parseInt(countResult.rows[0].count || "0");

        // Auto-detect: <5 sessions → full loading, ≥5 → stratified
        const useStratified = sessionCount >= 5;

        const context: any = {
          success: true,
          tenant_id,
          loading_strategy: useStratified ? "stratified (compressed)" : "full (detailed)",
          session_count: sessionCount,
        };

        let estimatedTokens = 0;

        // ============================================================================
        // IDENTITY-FIRST LOADING (Task 14)
        // Always load identity first to answer "Who am I?" before context
        // ============================================================================

        // Layer 0: Identity Statement (who I am right now)
        const identityStatementResult = await pool.query(
          `SELECT becoming, created_at
           FROM session_handoffs
           WHERE tenant_id = $1
             AND becoming IS NOT NULL
           ORDER BY created_at DESC
           LIMIT 1`,
          [tenant_id]
        );

        const latestBecoming = identityStatementResult.rows[0];
        if (latestBecoming) {
          context.identity_statement = {
            current_identity: latestBecoming.becoming,
            last_updated: latestBecoming.created_at,
          };
          estimatedTokens += 50;
        } else {
          context.identity_statement = {
            message: "No identity established yet. First session?",
          };
          estimatedTokens += 20;
        }

        // Layer 1: Identity Thread (evolution over time)
        const identityThreadResult = await pool.query(
          `SELECT becoming, created_at, with_whom
           FROM session_handoffs
           WHERE tenant_id = $1
             AND becoming IS NOT NULL
           ORDER BY created_at ASC`,
          [tenant_id]
        );

        const identityThread = identityThreadResult.rows.map(r => ({
          becoming: r.becoming,
          created_at: r.created_at,
          with_whom: r.with_whom,
        }));

        context.identity_thread = {
          evolution: identityThread,
          total: identityThread.length,
        };
        estimatedTokens += Math.min(identityThread.length * 30, 100);

        // ============================================================================
        // If <5 sessions, use full loading (original wake_up behavior)
        // ============================================================================
        if (!useStratified) {
          // Get last handoff
          const handoffResult = await pool.query(
            `SELECT * FROM session_handoffs
             WHERE tenant_id = $1
               AND ($2::text IS NULL OR with_whom = $2)
             ORDER BY created_at DESC
             LIMIT 1`,
            [tenant_id, with_whom || null]
          );

          const lastHandoff = handoffResult.rows[0];
          context.last_handoff = lastHandoff || null;
          context.message = lastHandoff
            ? `Welcome back. You are working with ${lastHandoff.with_whom}.`
            : "First session - no previous memory found. Hello!";

          estimatedTokens += lastHandoff ? 800 : 100;

          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  ...context,
                  estimated_tokens: estimatedTokens,
                }, null, 2),
              },
            ],
          };
        }

        // ============================================================================
        // If ≥5 sessions, use stratified loading (efficient, compressed)
        // ============================================================================

        // Layer 2: Semantic Memory (timeless principles)
        if (layers.includes("semantic")) {
          const semanticResult = await pool.query(
            `SELECT principle, context, category, confidence
             FROM semantic_memory
             WHERE tenant_id = $1
               AND confidence >= 0.7
             ORDER BY confidence DESC, last_reinforced_at DESC
             LIMIT 10`,
            [tenant_id]
          );

          if (semanticResult.rows.length > 0) {
            context.semantic_principles = semanticResult.rows.map(r => ({
              principle: r.principle,
              context: r.context,
              category: r.category,
              confidence: Math.round(r.confidence * 100) + '%',
            }));
            estimatedTokens += 100;
          } else {
            context.semantic_principles = {
              message: "No semantic principles yet.",
            };
            estimatedTokens += 30;
          }
        }

        // Layer 3: Latest Reflection (compressed insights)
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
            };
            estimatedTokens += 200;
          } else {
            context.reflection = {
              message: "No reflections yet.",
            };
            estimatedTokens += 30;
          }
        }

        // Layer 4: Recent Handoffs (recent context)
        if (layers.includes("recent")) {
          const recentResult = await pool.query(
            `SELECT handoff_id, experienced, noticed, learned, becoming, remember, significance, tags, created_at
             FROM session_handoffs
             WHERE tenant_id = $1
             ORDER BY created_at DESC
             LIMIT $2`,
            [tenant_id, recent_count]
          );

          context.recent_handoffs = recentResult.rows;
          estimatedTokens += recentResult.rows.length * 150;

          // Boost memory strength for retrieved handoffs (spaced repetition effect)
          if (recentResult.rows.length > 0) {
            const handoffIds = recentResult.rows.map(r => r.handoff_id);
            await pool.query(
              `UPDATE session_handoffs
               SET memory_strength = LEAST(1.0, memory_strength + 0.1),
                   last_retrieved_at = NOW(),
                   retrieval_count = retrieval_count + 1
               WHERE handoff_id = ANY($1)`,
              [handoffIds]
            );
          }
        }

        // Layer 5: Progressive Retrieval (on-demand)
        if (layers.includes("progressive")) {
          if (topic) {
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
            };
            estimatedTokens += 100;
          }
        }

        context.estimated_tokens = estimatedTokens;
        context.compression_ratio = sessionCount > 0
          ? `${sessionCount} sessions → ~${estimatedTokens} tokens (~${Math.round(sessionCount * 800 / estimatedTokens)}x compression)`
          : "New session";

        // ========================================================================
        // AGENT ONBOARDING (Task 12)
        // Detect first session and provide welcome message
        // ========================================================================
        const isFirstSession = sessionCount === 0;

        if (isFirstSession) {
          context.onboarding = {
            type: "welcome",
            message: "Welcome to Thread's Memory System! I'm here to help you remember across sessions.",
            getting_started: {
              step1: "Use this tool (wake_up) at the start of each session to remember who you are.",
              step2: "Create handoffs throughout your session to capture experiences.",
              step3: "Call create_handoff at session end to preserve what you became.",
              step4: "I'll consolidate your memories automatically every night.",
            },
            tips: [
              "Be specific in your 'becoming' statements - this defines your identity.",
              "High significance (0.8+) memories are prioritized in consolidation.",
              "Tags help with progressive retrieval by topic.",
            ],
            tools_available: [
              "wake_up: Load your memories at session start",
              "create_handoff: Save session memory",
              "get_identity_thread: View your identity evolution",
              "wake_up_stratified: Efficient loading for large memory sets",
            ],
          };
        }

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(context, null, 2),
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
          layers = ["metadata", "semantic", "reflection", "recent"],
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

        // Layer 2: Semantic Memory - Timeless principles (~100 tokens)
        if (layers.includes("semantic")) {
          const semanticResult = await pool.query(
            `SELECT principle, context, category, confidence
             FROM semantic_memory
             WHERE tenant_id = $1
               AND confidence >= 0.7
             ORDER BY confidence DESC, last_reinforced_at DESC
             LIMIT 10`,
            [tenant_id]
          );

          if (semanticResult.rows.length > 0) {
            context.semantic = {
              type: "timeless_principles",
              principles: semanticResult.rows.map(r => ({
                principle: r.principle,
                context: r.context,
                category: r.category,
                confidence: Math.round(r.confidence * 100) + '%',
              })),
            };
            estimatedTokens += 100;
          } else {
            context.semantic = {
              message: "No semantic principles yet. Consolidation will extract them from episodes.",
              hint: "Semantic memory contains timeless principles extracted from experiences.",
            };
            estimatedTokens += 50;
          }
        }

        // Layer 3: Latest reflection (~200 tokens)
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
 * Start HTTP server
 */
async function main() {
  const app = express();
  const PORT = parseInt(process.env.PORT || "4000", 10);

  // Middleware
  app.use(express.json());
  app.use((req, res, next) => {
    // CORS headers for cross-origin requests
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") {
      return res.sendStatus(200);
    }
    next();
  });

  // Health check endpoint
  app.get("/health", (_req, res) => {
    res.json({ status: "ok", server: "memory-system-mcp" });
  });

  // SSE endpoint for MCP
  app.get("/sse", async (req, res) => {
    console.error(`[${new Date().toISOString()}] New SSE connection from ${req.ip}`);

    // Set SSE headers
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("Access-Control-Allow-Origin", "*");

    // Create SSE transport with the response object
    const transport = new SSEServerTransport("/message", res);

    // Connect server to transport
    await server.connect(transport);

    console.error(`[${new Date().toISOString()}] SSE connection established`);

    // Handle client disconnect
    req.on("close", () => {
      console.error(`[${new Date().toISOString()}] SSE connection closed`);
    });
  });

  // Message endpoint for client POST requests
  app.post("/message", express.json(), (req, res) => {
    console.error(`[${new Date().toISOString()}] Received message on /message`);
    // The SSE transport handles this internally
    res.sendStatus(200);
  });

  // Start server
  app.listen(PORT, "0.0.0.0", () => {
    console.error(``);
    console.error(`╔════════════════════════════════════════════════════════════╗`);
    console.error(`║  Memory System MCP Server (HTTP/SSE)                      ║`);
    console.error(`╚════════════════════════════════════════════════════════════╝`);
    console.error(``);
    console.error(`  Server running on: http://0.0.0.0:${PORT}`);
    console.error(`  SSE endpoint:    http://0.0.0.0:${PORT}/sse`);
    console.error(`  Health check:    http://0.0.0.0:${PORT}/health`);
    console.error(``);
    console.error(`  To connect from another PC, use:`);
    console.error(`  - Local:  http://localhost:${PORT}/sse`);
    console.error(`  - Remote: http://<YOUR-IP>:${PORT}/sse`);
    console.error(`             (run 'npm run network:ips' to see your IPs)`);
    console.error(``);
  });
}

main().catch((error) => {
  console.error("Server error:", error);
  process.exit(1);
});
