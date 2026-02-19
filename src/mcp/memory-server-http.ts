#!/usr/bin/env node

/**
 * Memory System MCP Server - Simple HTTP Transport
 *
 * HTTP-based MCP server following n8n's architecture pattern.
 * Handles independent HTTP POST requests without session management.
 * Supports Bearer token authentication from Authorization header.
 *
 * Endpoint: POST /mcp
 * Authentication: Bearer token in Authorization header
 * Response format: JSON (not SSE)
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { Pool } from "pg";
import { createServer, IncomingMessage, ServerResponse } from "http";
import { URL } from "url";
import { extractBearerToken, validateBearerToken } from "./auth.js";
import * as quickReference from "../utils/quick-reference.js";

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
 * Normalize parameters to handle different client formats
 *
 * Handles various parameter formats that different clients might send:
 * - Standard: {name, arguments: {...}}
 * - Flat: {name, param1, param2, ...}
 * - Double-nested: {name, params: {...}}
 * - Missing params: undefined or null
 */
function normalizeParams(method: string, params: any): any {
  if (!params) {
    return { name: method, arguments: {} };
  }

  // If already in standard format, return as-is
  if (params.arguments && typeof params.arguments === 'object') {
    return params;
  }

  // If params has 'name' but no 'arguments', might be flat format
  if (params.name && !params.arguments) {
    const { name, params: nestedParams, ...rest } = params;
    // Check if there's a 'params' key that should be extracted
    if (nestedParams && typeof nestedParams === 'object' && Object.keys(nestedParams).length > 0) {
      // Has both 'name' and 'params' - extract params as arguments
      return { name, arguments: nestedParams };
    }
    // Pure flat format - all remaining keys are arguments
    return { name, arguments: rest };
  }

  // If params is an array or other unexpected format, default to empty arguments
  if (!params.name) {
    return { name: method, arguments: {} };
  }

  return params;
}

/**
 * List available tools
 */
const listToolsHandler = async () => {
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
      {
        name: "get_last_handoff",
        description: "Get the most recent session handoff for context continuity.",
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
              description: "Optional: Filter by person/agent",
            },
          },
          required: [],
        },
      },
      {
        name: "get_identity_thread",
        description: "Get your identity evolution over time - all 'becoming' statements from past sessions.",
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
        name: "list_handoffs",
        description: "List all handoffs for a tenant with optional filters.",
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
              description: "Optional: Filter by person/agent",
            },
            limit: {
              type: "number",
              description: "Maximum number to return (default: 10)",
              default: 10,
            },
          },
          required: [],
        },
      },
      {
        name: "create_knowledge_note",
        description: "Create a quick knowledge note (Post-It style capture).",
        inputSchema: {
          type: "object",
          properties: {
            tenant_id: {
              type: "string",
              description: "Tenant identifier (default: 'default')",
              default: "default",
            },
            text: {
              type: "string",
              description: "The knowledge note content",
            },
            with_whom: {
              type: "string",
              description: "Optional: Person/agent context",
            },
            tags: {
              type: "array",
              items: { type: "string" },
              description: "Optional tags for categorization",
            },
          },
          required: ["text"],
        },
      },
      {
        name: "get_knowledge_notes",
        description: "Get knowledge notes with optional filters.",
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
              description: "Optional: Filter by person/agent",
            },
            limit: {
              type: "number",
              description: "Maximum number to return (default: 100)",
              default: 100,
            },
          },
          required: [],
        },
      },
      {
        name: "list_semantic_principles",
        description: "List semantic memory principles (timeless learnings extracted from experiences).",
        inputSchema: {
          type: "object",
          properties: {
            tenant_id: {
              type: "string",
              description: "Tenant identifier (default: 'default')",
              default: "default",
            },
            category: {
              type: "string",
              description: "Optional: Filter by category (coding, communication, etc.)",
            },
            min_confidence: {
              type: "number",
              description: "Minimum confidence threshold (0.0-1.0, default: 0.7)",
              default: 0.7,
            },
            limit: {
              type: "number",
              description: "Maximum number to return (default: 10)",
              default: 10,
            },
          },
          required: [],
        },
      },
      {
        name: "create_capsule",
        description: "Create a secure capsule for timed release of memory to another agent.",
        inputSchema: {
          type: "object",
          properties: {
            tenant_id: {
              type: "string",
              description: "Tenant identifier",
              default: "default",
            },
            capsule_id: {
              type: "string",
              description: "Unique capsule identifier (auto-generated if not provided)",
            },
            agent_id: {
              type: "string",
              description: "Creator agent ID",
            },
            subject_type: {
              type: "string",
              description: "Subject type (e.g., 'session', 'task', 'project')",
            },
            subject_id: {
              type: "string",
              description: "Subject identifier",
            },
            content: {
              type: "object",
              description: "Capsule content (memory payload)",
            },
            expires_at: {
              type: "string",
              description: "Expiration timestamp (ISO 8601)",
            },
          },
          required: ["tenant_id", "agent_id", "content"],
        },
      },
      {
        name: "get_capsules",
        description: "List available capsules for the requesting agent.",
        inputSchema: {
          type: "object",
          properties: {
            tenant_id: {
              type: "string",
              description: "Tenant identifier",
            },
            agent_id: {
              type: "string",
              description: "Agent ID",
            },
            subject_type: {
              type: "string",
              description: "Optional: Filter by subject type",
            },
            subject_id: {
              type: "string",
              description: "Optional: Filter by subject ID",
            },
          },
          required: ["tenant_id", "agent_id"],
        },
      },
      {
        name: "get_compression_stats",
        description: "Get memory compression statistics showing token savings from stratified loading.",
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
        name: "agent_feedback",
        description: "Submit feedback about the system (friction points, bugs, suggestions, patterns, insights). Agents can report their direct experience using the tools to help improve the system.",
        inputSchema: {
          type: "object",
          properties: {
            tenant_id: {
              type: "string",
              description: "Tenant identifier",
              default: "default",
            },
            category: {
              type: "string",
              description: "Area of system: memory_system, documentation, tools, workflow, other",
              enum: ["memory_system", "documentation", "tools", "workflow", "other"],
            },
            type: {
              type: "string",
              description: "Feedback type: friction (pain point), bug (broken), suggestion (improvement), pattern (observation), insight (learning)",
              enum: ["friction", "bug", "suggestion", "pattern", "insight"],
            },
            description: {
              type: "string",
              description: "Clear description of the feedback",
            },
            severity: {
              type: "string",
              description: "Impact level: low, medium, high, critical",
              enum: ["low", "medium", "high", "critical"],
            },
            reproduction: {
              type: "string",
              description: "Steps to reproduce (for bugs)",
            },
          },
          required: ["category", "type", "description"],
        },
      },
      {
        name: "get_agent_feedback",
        description: "Retrieve agent feedback. Useful for reviewing what agents have reported about the system.",
        inputSchema: {
          type: "object",
          properties: {
            tenant_id: {
              type: "string",
              description: "Tenant identifier",
              default: "default",
            },
            category: {
              type: "string",
              description: "Filter by category",
            },
            type: {
              type: "string",
              description: "Filter by feedback type",
            },
            status: {
              type: "string",
              description: "Filter by status: open, reviewed, addressed, rejected",
              enum: ["open", "reviewed", "addressed", "rejected"],
            },
            limit: {
              type: "number",
              description: "Maximum number to return (default: 50)",
              default: 50,
            },
          },
          required: [],
        },
      },
      {
        name: "update_agent_feedback",
        description: "Update the status of agent feedback items. Use this when issues have been addressed or reviewed.",
        inputSchema: {
          type: "object",
          properties: {
            tenant_id: {
              type: "string",
              description: "Tenant identifier",
              default: "default",
            },
            feedback_id: {
              type: "string",
              description: "Feedback ID to update",
            },
            status: {
              type: "string",
              description: "New status: open, reviewed, addressed, rejected",
              enum: ["open", "reviewed", "addressed", "rejected"],
            },
          },
          required: ["feedback_id", "status"],
        },
      },
      {
        name: "get_quick_reference",
        description: "Get quick reference summary for common topics. Faster than reading entire SOURCES_OF_TRUTH.md. Available topics: pre_implementation_checklist, mcp_tools, common_tasks, project_structure, troubleshooting, database_schema",
        inputSchema: {
          type: "object",
          properties: {
            topic: {
              type: "string",
              description: "Topic to get reference for: pre_implementation_checklist, mcp_tools, common_tasks, project_structure, troubleshooting, database_schema",
              enum: ["pre_implementation_checklist", "mcp_tools", "common_tasks", "project_structure", "troubleshooting", "database_schema"],
            },
          },
          required: [],
        },
      },
      {
        name: "get_next_actions",
        description: "Get prioritized next actions based on open feedback. Helps maintain focus on high-impact improvements. Shows priority, estimated effort, and specific actions to take.",
        inputSchema: {
          type: "object",
          properties: {
            tenant_id: {
              type: "string",
              description: "Tenant identifier",
              default: "default",
            },
            limit: {
              type: "number",
              description: "Maximum number of actions to return (default: 5)",
              default: 5,
            },
          },
          required: [],
        },
      },
      {
        name: "get_system_health",
        description: "Get system health summary including feedback stats, activity metrics, and overall health status (good/fair/needs_attention). Useful for monitoring progress and system state.",
        inputSchema: {
          type: "object",
          properties: {
            tenant_id: {
              type: "string",
              description: "Tenant identifier",
              default: "default",
            },
          },
          required: [],
        },
      },
    ],
  };
};

// Register handler with server
server.setRequestHandler(ListToolsRequestSchema, listToolsHandler);

/**
 * Handle tool calls
 */
const callToolHandler = async (request: any) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case "wake_up": {
        const {
          tenant_id = "default",
          with_whom,
          layers = ["recent"],  // Changed: default to recent only, opt-in for full layers
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

        // If <5 sessions, use full loading
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

        // If ≥5 sessions, use stratified loading (efficient, compressed)
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
        }

        context.estimated_tokens = estimatedTokens;
        context.compression_ratio = sessionCount > 0
          ? `${sessionCount} sessions → ~${estimatedTokens} tokens (~${Math.round(sessionCount * 800 / estimatedTokens)}x compression)`
          : "New session";

        // Agent onboarding
        const isFirstSession = sessionCount === 0;

        // Hint about layers when using default
        const isDefaultLayers = layers.length === 1 && layers[0] === "recent";
        if (isDefaultLayers && sessionCount > 0) {
          context.hint = {
            layers_tip: "Loading recent handoffs only (default). For full memory including identity, semantic principles, and reflections, use: layers: ['identity', 'semantic', 'reflection', 'recent']",
            pre_work_tip: "⚠️  Pattern reminder: Before implementing, call get_quick_reference(topic='pre_implementation_checklist'). Avoid 'implement before understanding' mistake."
          };
        }

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
          significance?: number | string;  // Accept both, auto-convert to string
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
            String(significance),  // Convert number to string
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

      case "list_handoffs": {
        const tenant_id = (args as { tenant_id?: string }).tenant_id || "default";
        const with_whom = (args as { with_whom?: string }).with_whom;
        const limit = (args as { limit?: number }).limit || 10;

        const result = await pool.query(
          `SELECT
            handoff_id,
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
            created_at
          FROM session_handoffs
          WHERE tenant_id = $1
            AND ($2::text IS NULL OR with_whom = $2)
          ORDER BY created_at DESC
          LIMIT $3`,
          [tenant_id, with_whom || null, limit]
        );

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  success: true,
                  tenant_id,
                  with_whom,
                  count: result.rows.length,
                  handoffs: result.rows,
                },
                null,
                2
              ),
            },
          ],
        };
      }

      case "create_knowledge_note": {
        const {
          tenant_id = "default",
          text,
          with_whom,
          tags = [],
        } = args as {
          tenant_id?: string;
          text: string;
          with_whom?: string;
          tags?: string[];
        };

        const result = await pool.query(
          `INSERT INTO knowledge_notes (tenant_id, text, with_whom, tags)
           VALUES ($1, $2, $3, $4)
           RETURNING *`,
          [tenant_id, text, with_whom || null, tags.length > 0 ? tags : null]
        );

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  success: true,
                  note: result.rows[0],
                  message: "Knowledge note created.",
                },
                null,
                2
              ),
            },
          ],
        };
      }

      case "get_knowledge_notes": {
        const tenant_id = (args as { tenant_id?: string }).tenant_id || "default";
        const with_whom = (args as { with_whom?: string }).with_whom;
        const limit = Math.min((args as { limit?: number }).limit || 100, 1000);

        let query = `SELECT * FROM knowledge_notes WHERE tenant_id = $1`;
        const params: any[] = [tenant_id];

        if (with_whom) {
          query += ` AND with_whom = $2`;
          params.push(with_whom);
        }

        query += ` ORDER BY timestamp DESC LIMIT $${params.length + 1}`;
        params.push(limit);

        const result = await pool.query(query, params);

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  success: true,
                  tenant_id,
                  with_whom,
                  count: result.rows.length,
                  notes: result.rows,
                },
                null,
                2
              ),
            },
          ],
        };
      }

      case "list_semantic_principles": {
        const {
          tenant_id = "default",
          category,
          min_confidence = 0.7,
          limit = 10,
        } = args as {
          tenant_id?: string;
          category?: string;
          min_confidence?: number;
          limit?: number;
        };

        const result = await pool.query(
          `SELECT * FROM semantic_memory
          WHERE tenant_id = $1
            AND confidence >= $2
            AND ($3::text IS NULL OR category = $3)
          ORDER BY confidence DESC, created_at DESC
          LIMIT $4`,
          [tenant_id, min_confidence, category || null, limit]
        );

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  success: true,
                  tenant_id,
                  category,
                  count: result.rows.length,
                  principles: result.rows.map(r => ({
                    principle: r.principle,
                    context: r.context,
                    category: r.category,
                    confidence: Math.round(r.confidence * 100) + '%',
                    source_count: r.source_count,
                    tags: r.tags,
                  })),
                },
                null,
                2
              ),
            },
          ],
        };
      }

      case "create_capsule": {
        const {
          tenant_id = "default",
          capsule_id,
          agent_id,
          subject_type,
          subject_id,
          content,
          expires_at,
        } = args as {
          tenant_id?: string;
          capsule_id?: string;
          agent_id: string;
          subject_type?: string;
          subject_id?: string;
          content: any;
          expires_at?: string;
        };

        // Generate capsule ID if not provided
        const { randomBytes } = await import("crypto");
        const finalCapsuleId = capsule_id || "cap_" + randomBytes(16).toString("hex");

        // Calculate expiration (default: 24 hours)
        const expires = expires_at
          ? new Date(expires_at)
          : new Date(Date.now() + 24 * 60 * 60 * 1000);

        const result = await pool.query(
          `INSERT INTO capsules (capsule_id, tenant_id, agent_id, subject_type, subject_id, content, status, expires_at)
           VALUES ($1, $2, $3, $4, $5, $6, 'pending', $7)
           RETURNING *`,
          [finalCapsuleId, tenant_id, agent_id, subject_type || null, subject_id || null, JSON.stringify(content), expires]
        );

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  success: true,
                  capsule: result.rows[0],
                  message: "Capsule created. Available for retrieval by authorized agents.",
                },
                null,
                2
              ),
            },
          ],
        };
      }

      case "get_capsules": {
        const {
          tenant_id,
          agent_id,
          subject_type,
          subject_id,
        } = args as {
          tenant_id: string;
          agent_id: string;
          subject_type?: string;
          subject_id?: string;
        };

        // Get capsules where this agent is authorized
        // Capsules are available if: agent_id matches creator OR subject_type/subject_id match
        const result = await pool.query(
          `SELECT * FROM capsules
           WHERE tenant_id = $1
             AND status = 'pending'
             AND expires_at > NOW()
             AND (
               agent_id = $2
               OR ($3::text IS NULL OR subject_type = $3)
               OR ($4::text IS NULL OR subject_id = $4)
             )
           ORDER BY created_at DESC`,
          [tenant_id, agent_id, subject_type || null, subject_id || null]
        );

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  success: true,
                  tenant_id,
                  agent_id,
                  count: result.rows.length,
                  capsules: result.rows,
                },
                null,
                2
              ),
            },
          ],
        };
      }

      case "get_compression_stats": {
        const tenant_id = (args as { tenant_id?: string }).tenant_id || "default";

        // Get handoff statistics
        const stats = await pool.query(
          `SELECT
            COUNT(*) as total_handoffs,
            MIN(created_at) as first_session,
            MAX(created_at) as last_session,
            AVG(LENGTH(experienced) + LENGTH(noticed) + LENGTH(learned) + LENGTH(becoming)) as avg_handoff_size
          FROM session_handoffs
          WHERE tenant_id = $1`,
          [tenant_id]
        );

        const row = stats.rows[0];
        const totalHandoffs = parseInt(row.total_handoffs || "0");
        const avgHandoffSize = parseInt(row.avg_handoff_size || "0");

        // Estimate tokens (rough estimate: 4 chars ≈ 1 token)
        const estimatedFullTokens = totalHandoffs * (avgHandoffSize / 4);
        const estimatedStratifiedTokens = 50 + 200 + (3 * 150) + 100; // metadata + reflection + recent(3) + progressive
        const compressionRatio = estimatedStratifiedTokens > 0
          ? (estimatedFullTokens / estimatedStratifiedTokens).toFixed(1)
          : "1.0";

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  success: true,
                  tenant_id,
                  total_handoffs: totalHandoffs,
                  first_session: row.first_session,
                  last_session: row.last_session,
                  avg_handoff_size_chars: avgHandoffSize,
                  estimated_full_tokens: Math.round(estimatedFullTokens),
                  estimated_stratified_tokens: estimatedStratifiedTokens,
                  compression_ratio: `${compressionRatio}x`,
                  savings_percent: estimatedFullTokens > 0
                    ? Math.round((1 - estimatedStratifiedTokens / estimatedFullTokens) * 100)
                    : 0,
                },
                null,
                2
              ),
            },
          ],
        };
      }

      case "agent_feedback": {
        const {
          tenant_id = "default",
          category,
          type,
          description,
          severity,
          reproduction,
        } = args as {
          tenant_id?: string;
          category: string;
          type: string;
          description: string;
          severity?: string;
          reproduction?: string;
        };

        const result = await pool.query(
          `INSERT INTO agent_feedback (category, type, description, severity, reproduction, tenant_id)
          VALUES ($1, $2, $3, $4, $5, $6)
          RETURNING *`,
          [category, type, description, severity || null, reproduction || null, tenant_id]
        );

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                success: true,
                feedback: result.rows[0],
                message: "Feedback recorded. Thank you for improving the system.",
              }),
            },
          ],
        };
      }

      case "get_agent_feedback": {
        const {
          tenant_id = "default",
          category,
          type,
          status,
          limit = 50,
        } = args as {
          tenant_id?: string;
          category?: string;
          type?: string;
          status?: string;
          limit?: number;
        };

        let query = `SELECT * FROM agent_feedback WHERE tenant_id = $1`;
        const params: any[] = [tenant_id];
        let paramIndex = 2;

        if (category) {
          query += ` AND category = $${paramIndex++}`;
          params.push(category);
        }

        if (type) {
          query += ` AND type = $${paramIndex++}`;
          params.push(type);
        }

        if (status) {
          query += ` AND status = $${paramIndex++}`;
          params.push(status);
        }

        query += ` ORDER BY created_at DESC LIMIT $${paramIndex}`;
        params.push(limit);

        const result = await pool.query(query, params);

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                success: true,
                tenant_id,
                count: result.rows.length,
                feedback: result.rows,
              }),
            },
          ],
        };
      }

      case "update_agent_feedback": {
        const {
          tenant_id = "default",
          feedback_id,
          status,
        } = args as {
          tenant_id?: string;
          feedback_id: string;
          status: string;
        };

        const result = await pool.query(
          `UPDATE agent_feedback
          SET status = $1, updated_at = NOW()
          WHERE feedback_id = $2 AND tenant_id = $3
          RETURNING *`,
          [status, feedback_id, tenant_id]
        );

        if (result.rows.length === 0) {
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  success: false,
                  error: "Feedback not found",
                }),
              },
            ],
            isError: true,
          };
        }

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                success: true,
                feedback: result.rows[0],
                message: `Feedback status updated to: ${status}`,
              }),
            },
          ],
        };
      }

      case "get_quick_reference": {
        const { topic } = args as { topic?: string };

        if (!topic) {
          // List all available topics
          const topics = quickReference.listQuickReferenceTopics();
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  success: true,
                  available_topics: topics,
                  usage: "Call get_quick_reference with a topic parameter",
                }),
              },
            ],
          };
        }

        const ref = quickReference.getQuickReference(topic);
        if (!ref) {
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  success: false,
                  error: `Unknown topic: ${topic}`,
                  available_topics: quickReference.listQuickReferenceTopics(),
                }),
              },
            ],
            isError: true,
          };
        }

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                success: true,
                topic,
                title: ref.title,
                content: ref.content,
              }),
            },
          ],
        };
      }

      case "get_next_actions": {
        const {
          tenant_id = "default",
          limit = 5,
        } = args as {
          tenant_id?: string;
          limit?: number;
        };

        // Get all feedback to analyze
        const feedbackResult = await pool.query(
          `SELECT * FROM agent_feedback WHERE tenant_id = $1 ORDER BY created_at DESC`,
          [tenant_id]
        );

        const { getNextActions } = await import("../utils/next-actions.js" satisfies string);
        const actions = (getNextActions as any)(feedbackResult.rows, limit);

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                success: true,
                count: actions.length,
                actions,
                tip: "Prioritized by priority (high/medium/low) and effort (quick/moderate/large). Focus on high-priority, quick-effort items first.",
              }),
            },
          ],
        };
      }

      case "get_system_health": {
        const { tenant_id = "default" } = args as { tenant_id?: string };

        // Get feedback stats
        const [feedbackResult, handoffResult] = await Promise.all([
          pool.query(
            `SELECT * FROM agent_feedback WHERE tenant_id = $1`,
            [tenant_id]
          ),
          pool.query(
            `SELECT COUNT(*) as count FROM session_handoffs WHERE tenant_id = $1 AND created_at > NOW() - INTERVAL '7 days'`,
            [tenant_id]
          )
        ]);

        const { getSystemHealth } = await import("../utils/next-actions.js" satisfies string);
        const health = (getSystemHealth as any)(
          feedbackResult.rows,
          parseInt(handoffResult.rows[0].count)
        );

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                success: true,
                ...health,
                recommendation: health.health === 'good'
                  ? "System is healthy! Keep maintaining feedback loop."
                  : health.health === 'fair'
                  ? "System needs attention. Address open feedback items."
                  : "System needs immediate attention. Focus on high-priority feedback items.",
              }),
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
};

// Register handler with server
server.setRequestHandler(CallToolRequestSchema, callToolHandler);

/**
 * Parse JSON body from request
 */
function parseJSONBody(req: IncomingMessage): Promise<any> {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk.toString();
    });
    req.on("end", () => {
      try {
        resolve(JSON.parse(body));
      } catch (error) {
        reject(error);
      }
    });
    req.on("error", reject);
  });
}

/**
 * Send JSON-RPC response
 */
function sendJSONRPCResponse(
  res: ServerResponse,
  id: any,
  result?: any,
  error?: any
) {
  const response: any = {
    jsonrpc: "2.0",
    id,
  };

  if (error) {
    response.error = {
      code: error.code || -32603,
      message: error.message || "Internal error",
    };
  } else {
    response.result = result;
  }

  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify(response));
}

/**
 * Start HTTP server
 */
async function main() {
  const PORT = parseInt(process.env.PORT || "4000", 10);

  // We're not using the MCP SDK's transport system
  // We'll handle requests directly

  // Create HTTP server
  const httpServer = createServer(async (req, res) => {
    const startTime = Date.now();

    // CORS headers
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

    // Handle OPTIONS preflight
    if (req.method === "OPTIONS") {
      res.writeHead(200);
      res.end();
      return;
    }

    // Parse URL
    const url = new URL(req.url || "", `http://${req.headers.host}`);

    // Health check endpoint (GET only)
    if (url.pathname === "/health" && req.method === "GET") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({
        status: "ok",
        server: "memory-system-mcp",
        transport: "http",
      }));
      return;
    }

    // MCP endpoint (POST only)
    if (url.pathname === "/mcp") {
      if (req.method !== "POST") {
        res.writeHead(405, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Method not allowed. Use POST for /mcp" }));
        return;
      }

      try {
        // Parse JSON-RPC request
        const jsonRpcRequest = await parseJSONBody(req);

        // Normalize parameters to handle different client formats
        // Some clients (like Skill tool) send parameters in different structures
        const originalParams = jsonRpcRequest.params;
        jsonRpcRequest.params = normalizeParams(jsonRpcRequest.method, jsonRpcRequest.params);

        // Log if parameters were normalized
        const originalStr = JSON.stringify(originalParams);
        const normalizedStr = JSON.stringify(jsonRpcRequest.params);
        if (originalStr !== normalizedStr) {
          console.error(`[${new Date().toISOString()}] Params normalized from:`, (originalStr || 'undefined').substring(0, 200));
          console.error(`[${new Date().toISOString()}] Params normalized to:`, (normalizedStr || 'undefined').substring(0, 200));
        }

        console.error(`[${new Date().toISOString()}] MCP ${jsonRpcRequest.method} request`);

        // Extract and validate Bearer token
        const authHeader = req.headers["authorization"];
        const token = extractBearerToken(typeof authHeader === "string" ? authHeader : undefined);

        if (!token) {
          console.error(`[${new Date().toISOString()}] Missing Authorization header`);
          sendJSONRPCResponse(res, jsonRpcRequest.id, null, {
            code: 401,
            message: "Unauthorized: Missing Authorization header",
          });
          return;
        }

        // Validate token
        const authResult = await validateBearerToken(token, pool);

        if (!authResult.valid) {
          console.error(`[${new Date().toISOString()}] Invalid token: ${authResult.error}`);
          sendJSONRPCResponse(res, jsonRpcRequest.id, null, {
            code: 401,
            message: authResult.error || "Invalid token",
          });
          return;
        }

        console.error(`[${new Date().toISOString()}] Authenticated tenant: ${authResult.tenant_id}`);

        // Inject tenant_id into arguments for tool calls
        if (jsonRpcRequest.method === "tools/call" && jsonRpcRequest.params) {
          // Ensure arguments object exists
          if (!jsonRpcRequest.params.arguments) {
            jsonRpcRequest.params.arguments = {};
          }
          jsonRpcRequest.params.arguments = {
            ...jsonRpcRequest.params.arguments,
            tenant_id: jsonRpcRequest.params.arguments.tenant_id || authResult.tenant_id,
          };
        }

        // Handle initialize
        if (jsonRpcRequest.method === "initialize") {
          sendJSONRPCResponse(res, jsonRpcRequest.id, {
            protocolVersion: "2024-11-05",
            capabilities: {
              tools: {},
            },
            serverInfo: {
              name: "memory-system",
              version: "1.0.0",
            },
          });
          return;
        }

        // Handle tools/list
        if (jsonRpcRequest.method === "tools/list") {
          const toolsResponse = await listToolsHandler();
          sendJSONRPCResponse(res, jsonRpcRequest.id, toolsResponse);
          return;
        }

        // Handle tools/call
        if (jsonRpcRequest.method === "tools/call") {
          const toolResponse = await callToolHandler(jsonRpcRequest);
          sendJSONRPCResponse(res, jsonRpcRequest.id, toolResponse);
          return;
        }

        // Unknown method
        sendJSONRPCResponse(res, jsonRpcRequest.id, null, {
          code: -32601,
          message: "Method not found",
        });

      } catch (error) {
        console.error(`[${new Date().toISOString()}] Error handling request:`, error);
        sendJSONRPCResponse(res, null, null, {
          code: -32700,
          message: "Parse error",
        });
      }
      return;
    }

    // 404 for unknown paths
    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Not found" }));
  });

  // Start server
  httpServer.listen(PORT, "0.0.0.0", () => {
    console.error(``);
    console.error(`╔════════════════════════════════════════════════════════════╗`);
    console.error(`║  Memory System MCP Server (Simple HTTP)                  ║`);
    console.error(`╚════════════════════════════════════════════════════════════╝`);
    console.error(``);
    console.error(`  Server running on: http://0.0.0.0:${PORT}`);
    console.error(`  MCP endpoint:     http://0.0.0.0:${PORT}/mcp`);
    console.error(`  Health check:     http://0.0.0.0:${PORT}/health`);
    console.error(``);
    console.error(`  Authentication:   Bearer token in Authorization header`);
    console.error(`  Protocol:         JSON-RPC 2.0 over HTTP`);
    console.error(``);
  });
}

main().catch((error) => {
  console.error("Server error:", error);
  process.exit(1);
});
