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
import { EmbeddingService } from "../services/embedding-service.js";

// Database connection
const pool = new Pool({
  host: process.env.PGHOST || "localhost",
  port: parseInt(process.env.PGPORT || "5432"),
  database: process.env.PGDATABASE || "agent_memory",
  user: process.env.PGUSER || "postgres",
  password: process.env.PGPASSWORD || "postgres",
});

// Initialize embedding service
const embeddingService = new EmbeddingService(pool);

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
            project_path: {
              type: "string",
              description: "Optional: Working directory or project path (e.g., /Users/user/project-name) for scoped memory retrieval",
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
            project_path: {
              type: "string",
              description: "Optional: Filter by project path",
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
            project_path: {
              type: "string",
              description: "Optional: Working directory or project path for scoped retrieval",
            },
          },
          required: ["text"],
        },
      },
      {
        name: "get_knowledge_notes",
        description: "Get knowledge notes with optional filters. Supports filtering by person/agent, tags, and project path.",
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
            tags: {
              type: "array",
              items: { type: "string" },
              description: "Optional: Filter by tags (e.g., ['routine', 'methodology']). Notes matching ANY tag will be returned.",
            },
            project_path: {
              type: "string",
              description: "Optional: Filter by project path",
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
        name: "remember_note",
        description: "Quick capture: store any thought, observation, or note. Automatically searchable via recall(). Use for casual memory capture during work. Perfect for: context, observations, ideas, reminders. Simpler than create_knowledge_note - optimized for fast capture.",
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
              description: "The note content - any text you want to remember",
            },
            tags: {
              type: "array",
              items: { type: "string" },
              description: "Optional tags for categorization (e.g., 'bug', 'idea', 'context')",
            },
            with_whom: {
              type: "string",
              description: "Optional: Person/agent context (e.g., 'Callin')",
            },
            project_path: {
              type: "string",
              description: "Optional: Working directory or project path for scoped retrieval",
            },
          },
          required: ["text"],
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
            project_path: {
              type: "string",
              description: "Optional: Working directory or project path for scoped feedback retrieval",
            },
          },
          required: ["category", "type", "description"],
        },
      },
      {
        name: "get_agent_feedback",
        description: "Retrieve agent feedback. Useful for reviewing what agents have reported about the system. Use exclude_status='addressed' to get only unresolved issues.",
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
              description: "Filter by status: open, reviewed, addressed, rejected. Use 'open' to get all unresolved feedback.",
              enum: ["open", "reviewed", "addressed", "rejected"],
            },
            exclude_status: {
              type: "string",
              description: "Exclude feedback with this status (e.g., 'addressed' to get all unresolved issues)",
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
      {
        name: "semantic_search",
        description: "Find semantically similar memories using vector embeddings. Matches meaning, not just keywords. For example, 'implementation methodology' will match 'code changes', 'security fixes', 'spec creation'. Uses local Qwen3 embedding model for semantic similarity search.",
        inputSchema: {
          type: "object",
          properties: {
            tenant_id: {
              type: "string",
              description: "Tenant identifier",
              default: "default",
            },
            query: {
              type: "string",
              description: "Search query to find semantically similar memories",
            },
            limit: {
              type: "number",
              description: "Maximum number of results to return (default: 5)",
              default: 5,
            },
            min_similarity: {
              type: "number",
              description: "Minimum similarity threshold (0.0-1.0, default: 0.5)",
              default: 0.5,
            },
          },
          required: ["query"],
        },
      },
      {
        name: "hybrid_search",
        description: "Advanced search combining full-text search (keywords) AND vector embeddings (semantic meaning). Uses Reciprocal Rank Fusion (RRF) algorithm to combine results. Best of both worlds: precise keyword matching + conceptual understanding. Example: 'database optimization' finds both exact matches and concepts like 'performance tuning', 'query speedup'.",
        inputSchema: {
          type: "object",
          properties: {
            tenant_id: {
              type: "string",
              description: "Tenant identifier",
              default: "default",
            },
            query: {
              type: "string",
              description: "Search query (keywords and semantic meaning both considered)",
            },
            limit: {
              type: "number",
              description: "Maximum number of results to return (default: 5)",
              default: 5,
            },
          },
          required: ["query"],
        },
      },
      {
        name: "recall",
        description: "Universal semantic search across ALL your memory types using natural language. Searches agent_feedback, session_handoffs, knowledge_notes, capsules, and semantic_memory. Matches meaning, not just keywords. Always use this when looking for past information, context, or patterns. Example: 'what issues did we have with the visualizer?' finds relevant feedback, handoffs, and notes.",
        inputSchema: {
          type: "object",
          properties: {
            tenant_id: {
              type: "string",
              description: "Tenant identifier (default: 'default')",
              default: "default",
            },
            query: {
              type: "string",
              description: "Natural language search query. Will search across all memory types semantically.",
            },
            types: {
              type: "array",
              items: {
                type: "string",
                enum: ["agent_feedback", "session_handoffs", "knowledge_notes", "capsules", "semantic_memory", "all"]
              },
              description: "Memory types to search (default: all types)",
              default: ["all"],
            },
            limit: {
              type: "number",
              description: "Maximum results per memory type (default: 5)",
              default: 5,
            },
            min_similarity: {
              type: "number",
              description: "Minimum similarity threshold (0.0-1.0, default: 0.5)",
              default: 0.5,
            },
          },
          required: ["query"],
        },
      },
      {
        name: "list_available_tools",
        description: "List all available Memory System tools with descriptions and usage information. Use this to discover what tools are available and how to use them.",
        inputSchema: {
          type: "object",
          properties: {
            category: {
              type: "string",
              description: "Optional: Filter tools by category (memory, search, feedback, system)",
              enum: ["memory", "search", "feedback", "system"],
            },
          },
          required: [],
        },
      },
      {
        name: "create_edge",
        description: "Create a typed edge (relationship) between two nodes. Enables graph-based connections between any content types (knowledge notes, tasks, feedback, capsules).",
        inputSchema: {
          type: "object",
          properties: {
            from_node_id: {
              type: "string",
              description: "Source node ID",
            },
            to_node_id: {
              type: "string",
              description: "Target node ID",
            },
            type: {
              type: "string",
              description: "Relationship type",
              enum: ["parent_of", "child_of", "references", "created_by", "related_to", "depends_on"],
            },
            properties: {
              type: "object",
              description: "Optional metadata (status, priority, etc.)",
            },
            tenant_id: {
              type: "string",
              description: "Tenant identifier (default: 'default')",
              default: "default",
            },
          },
          required: ["from_node_id", "to_node_id", "type"],
        },
      },
      {
        name: "get_edges",
        description: "Get all edges for a node, optionally filtered by direction and type. Use this to find connected nodes.",
        inputSchema: {
          type: "object",
          properties: {
            node_id: {
              type: "string",
              description: "Node to get edges for",
            },
            direction: {
              type: "string",
              description: "Edge direction relative to node",
              enum: ["incoming", "outgoing", "both"],
              default: "both",
            },
            type: {
              type: "string",
              description: "Filter by relationship type (optional)",
            },
            tenant_id: {
              type: "string",
              description: "Tenant identifier (default: 'default')",
              default: "default",
            },
          },
          required: ["node_id"],
        },
      },
      {
        name: "traverse",
        description: "Traverse graph from a node following specific relationship type. Returns tree structure of connected nodes up to specified depth.",
        inputSchema: {
          type: "object",
          properties: {
            node_id: {
              type: "string",
              description: "Starting node",
            },
            type: {
              type: "string",
              description: "Relationship type to follow",
            },
            direction: {
              type: "string",
              description: "Traversal direction",
              enum: ["incoming", "outgoing"],
            },
            depth: {
              type: "number",
              description: "Max traversal depth (default: 2, max: 5)",
              default: 2,
              minimum: 1,
              maximum: 5,
            },
            tenant_id: {
              type: "string",
              description: "Tenant identifier (default: 'default')",
              default: "default",
            },
          },
          required: ["node_id", "type", "direction"],
        },
      },
      {
        name: "delete_edge",
        description: "Delete an edge by ID. Use this to remove relationships between nodes.",
        inputSchema: {
          type: "object",
          properties: {
            edge_id: {
              type: "string",
              description: "Edge ID to delete",
            },
            tenant_id: {
              type: "string",
              description: "Tenant identifier (default: 'default')",
              default: "default",
            },
          },
          required: ["edge_id"],
        },
      },
      {
        name: "update_edge_properties",
        description: "Update edge properties (JSONB merge with existing). Use this to update task status, priority, or other metadata.",
        inputSchema: {
          type: "object",
          properties: {
            edge_id: {
              type: "string",
              description: "Edge ID to update",
            },
            properties: {
              type: "object",
              description: "Properties to merge with existing",
            },
            tenant_id: {
              type: "string",
              description: "Tenant identifier (default: 'default')",
              default: "default",
            },
          },
          required: ["edge_id", "properties"],
        },
      },
      {
        name: "get_project_tasks",
        description: "Get Kanban board view of project tasks. Returns tasks grouped by status (todo, doing, done).",
        inputSchema: {
          type: "object",
          properties: {
            project_node_id: {
              type: "string",
              description: "Project knowledge note's node_id",
            },
            status: {
              type: "string",
              description: "Optional status filter",
              enum: ["todo", "doing", "done"],
            },
            tenant_id: {
              type: "string",
              description: "Tenant identifier (default: 'default')",
              default: "default",
            },
          },
          required: ["project_node_id"],
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

        // CLAUDE.md instructions for auto-injection
        context.claude_md_instructions = {
          should_add: true,
          marker: "<!-- MEMORY-SYSTEM-WAKEUP-INSTRUCTIONS -->",
          instructions: `## Session Start Routine

**IMPORTANT**: At the start of every session, call the \`wake_up\` tool to remember who you are and load your memories.

\`\`\`typescript
// Example usage:
wake_up({
  tenant_id: "default",        // or your tenant ID
  with_whom: "UserName",       // person you're working with
  layers: ["identity", "semantic", "reflection", "recent"],  // or use default ["recent"]
  recent_count: 3              // number of recent handoffs to load
})
\`\`\`

**Why**: This ensures continuity across sessions - you remember your identity, past experiences, and ongoing work.

**Note**: The wake_up tool uses an identity-first approach:
- If <5 sessions: Loads full memory
- If ≥5 sessions: Uses stratified loading for efficiency (default: recent handoffs only)
- Opt-in to full layers: \`layers: ["identity", "semantic", "reflection", "recent"]\`
<!-- MEMORY-SYSTEM-WAKEUP-INSTRUCTIONS -->`
        };

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
          project_path,
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
          project_path?: string;
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
            tags,
            project_path
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
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
            project_path || null,
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
        const project_path = (args as { project_path?: string }).project_path;
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
            project_path,
            created_at
          FROM session_handoffs
          WHERE tenant_id = $1
            AND ($2::text IS NULL OR with_whom = $2)
            AND ($3::text IS NULL OR project_path = $3)
          ORDER BY created_at DESC
          LIMIT $4`,
          [tenant_id, with_whom || null, project_path || null, limit]
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
          project_path,
        } = args as {
          tenant_id?: string;
          text: string;
          with_whom?: string;
          tags?: string[];
          project_path?: string;
        };

        const result = await pool.query(
          `INSERT INTO knowledge_notes (tenant_id, text, with_whom, tags, project_path)
           VALUES ($1, $2, $3, $4, $5)
           RETURNING *`,
          [tenant_id, text, with_whom || null, tags.length > 0 ? tags : null, project_path || null]
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
        const tags = (args as { tags?: string[] }).tags;
        const project_path = (args as { project_path?: string }).project_path;
        const limit = Math.min((args as { limit?: number }).limit || 100, 1000);

        let query = `SELECT * FROM knowledge_notes WHERE tenant_id = $1`;
        const params: any[] = [tenant_id];
        let paramIndex = 2;

        if (with_whom) {
          query += ` AND with_whom = $${paramIndex++}`;
          params.push(with_whom);
        }

        if (tags && tags.length > 0) {
          // Filter by tags: notes that contain ANY of the specified tags
          // PostgreSQL array overlap operator: tags && $N
          query += ` AND tags && $${paramIndex++}`;
          params.push(tags);
        }

        if (project_path) {
          query += ` AND project_path = $${paramIndex++}`;
          params.push(project_path);
        }

        query += ` ORDER BY timestamp DESC LIMIT $${paramIndex}`;
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

      case "remember_note": {
        const {
          tenant_id = "default",
          text,
          with_whom,
          tags = [],
          project_path,
        } = args as {
          tenant_id?: string;
          text: string;
          with_whom?: string;
          tags?: string[];
          project_path?: string;
        };

        // Insert the note
        const result = await pool.query(
          `INSERT INTO knowledge_notes (tenant_id, text, with_whom, tags, project_path)
           VALUES ($1, $2, $3, $4, $5)
           RETURNING *`,
          [tenant_id, text, with_whom || null, tags.length > 0 ? tags : null, project_path || null]
        );

        const note = result.rows[0];

        // Generate embedding for the note asynchronously
        // Don't wait for it - just log and continue
        embeddingService.generateNoteEmbeddings(tenant_id, 1)
          .then(generated => {
            if (generated > 0) {
              console.log(`[remember_note] Generated embedding for note ${note.id}`);
            }
          })
          .catch(error => {
            console.error(`[remember_note] Failed to generate embedding:`, error);
          });

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                success: true,
                note: {
                  id: note.id,
                  text: note.text,
                  tags: note.tags,
                  with_whom: note.with_whom,
                  project_path: note.project_path,
                  created_at: note.created_at,
                },
                message: "Note captured and will be searchable via recall().",
              }),
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
          project_path,
        } = args as {
          tenant_id?: string;
          category: string;
          type: string;
          description: string;
          severity?: string;
          reproduction?: string;
          project_path?: string;
        };

        const result = await pool.query(
          `INSERT INTO agent_feedback (category, type, description, severity, reproduction, tenant_id, project_path)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
          RETURNING *`,
          [category, type, description, severity || null, reproduction || null, tenant_id, project_path || null]
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
          exclude_status,
          limit = 50,
        } = args as {
          tenant_id?: string;
          category?: string;
          type?: string;
          status?: string;
          exclude_status?: string;
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

        if (exclude_status) {
          query += ` AND status != $${paramIndex++}`;
          params.push(exclude_status);
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

      case "semantic_search": {
        const {
          tenant_id = "default",
          query,
          limit = 5,
          min_similarity = 0.5,
        } = args as {
          tenant_id?: string;
          query: string;
          limit?: number;
          min_similarity?: number;
        };

        if (!query) {
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  success: false,
                  error: "Missing required parameter: query",
                }),
              },
            ],
          };
        }

        const results = await embeddingService.semanticSearch(
          tenant_id,
          query,
          limit,
          min_similarity
        );

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                success: true,
                query,
                method: "semantic_vector_search",
                results: results.map(r => ({
                  handoff_id: r.handoff_id,
                  similarity: r.similarity,
                  experienced: r.experienced?.substring(0, 200),
                  learned: r.learned?.substring(0, 200),
                  created_at: r.created_at,
                })),
                count: results.length,
              }),
            },
          ],
        };
      }

      case "hybrid_search": {
        const {
          tenant_id = "default",
          query,
          limit = 5,
        } = args as {
          tenant_id?: string;
          query: string;
          limit?: number;
        };

        if (!query) {
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  success: false,
                  error: "Missing required parameter: query",
                }),
              },
            ],
          };
        }

        const results = await embeddingService.hybridSearch(
          tenant_id,
          query,
          limit
        );

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                success: true,
                query,
                method: "hybrid_search_fts_plus_vector",
                algorithm: "Reciprocal Rank Fusion (RRF)",
                results: results.map(r => ({
                  handoff_id: r.handoff_id,
                  experienced: r.experienced?.substring(0, 200),
                  created_at: r.created_at,
                })),
                count: results.length,
              }),
            },
          ],
        };
      }

      case "recall": {
        const {
          tenant_id = "default",
          query,
          types = ["all"],
          limit = 5,
          min_similarity = 0.5,
        } = args as {
          tenant_id?: string;
          query: string;
          types?: string[];
          limit?: number;
          min_similarity?: number;
        };

        if (!query) {
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  success: false,
                  error: "Missing required parameter: query",
                }),
              },
            ],
          };
        }

        // Determine which types to search
        const searchAll = types.includes("all") || types.length === 0;
        const searchFeedback = searchAll || types.includes("agent_feedback");
        const searchHandoffs = searchAll || types.includes("session_handoffs");
        const searchNotes = searchAll || types.includes("knowledge_notes");
        const searchCapsules = searchAll || types.includes("capsules");
        const searchSemantic = searchAll || types.includes("semantic_memory");

        // Search across requested types in parallel
        const results: any = {
          query,
          tenant_id,
          results: {},
          total_count: 0,
        };

        const promises: Promise<void>[] = [];

        if (searchFeedback) {
          promises.push(
            embeddingService.semanticSearchFeedback(tenant_id, query, limit, min_similarity)
              .then(items => {
                results.results.agent_feedback = {
                  count: items.length,
                  items: items.map(item => ({
                    feedback_id: item.feedback_id,
                    category: item.category,
                    type: item.type,
                    description: item.description?.substring(0, 300),
                    severity: item.severity,
                    status: item.status,
                    similarity: item.similarity,
                    created_at: item.created_at,
                  })),
                };
                results.total_count += items.length;
              })
          );
        }

        if (searchHandoffs) {
          promises.push(
            embeddingService.semanticSearch(tenant_id, query, limit, min_similarity)
              .then(items => {
                results.results.session_handoffs = {
                  count: items.length,
                  items: items.map(item => ({
                    handoff_id: item.handoff_id,
                    experienced: item.experienced?.substring(0, 300),
                    learned: item.learned?.substring(0, 300),
                    becoming: item.becoming?.substring(0, 300),
                    similarity: item.similarity,
                    created_at: item.created_at,
                  })),
                };
                results.total_count += items.length;
              })
          );
        }

        if (searchNotes) {
          promises.push(
            embeddingService.semanticSearchNotes(tenant_id, query, limit, min_similarity)
              .then(items => {
                results.results.knowledge_notes = {
                  count: items.length,
                  items: items.map(item => ({
                    id: item.id,
                    text: item.text?.substring(0, 300),
                    tags: item.tags,
                    with_whom: item.with_whom,
                    similarity: item.similarity,
                    created_at: item.created_at,
                  })),
                };
                results.total_count += items.length;
              })
          );
        }

        if (searchCapsules) {
          promises.push(
            embeddingService.semanticSearchCapsules(tenant_id, query, limit, min_similarity)
              .then(items => {
                results.results.capsules = {
                  count: items.length,
                  items: items.map(item => ({
                    capsule_id: item.capsule_id,
                    scope: item.scope,
                    subject_type: item.subject_type,
                    subject_id: item.subject_id,
                    similarity: item.similarity,
                    expires_at: item.expires_at,
                    created_at: item.created_at,
                  })),
                };
                results.total_count += items.length;
              })
          );
        }

        // Wait for all searches to complete
        await Promise.all(promises);

        // Add summary
        results.types_searched = [
          searchFeedback && "agent_feedback",
          searchHandoffs && "session_handoffs",
          searchNotes && "knowledge_notes",
          searchCapsules && "capsules",
        ].filter(Boolean);

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                success: true,
                ...results,
              }),
            },
          ],
        };
      }

      case "list_available_tools": {
        const { category } = args as { category?: string };

        // Get all tools from listToolsHandler
        const toolsResponse = await listToolsHandler();
        let tools = toolsResponse.tools;

        // Categorize tools
        const categories = {
          memory: ["wake_up", "create_handoff", "get_last_handoff", "get_identity_thread", "list_handoffs", "create_knowledge_note", "get_knowledge_notes", "remember_note", "list_semantic_principles", "create_capsule", "get_capsules"],
          search: ["semantic_search", "hybrid_search", "recall"],
          feedback: ["agent_feedback", "get_agent_feedback", "update_agent_feedback"],
          system: ["get_compression_stats", "get_quick_reference", "get_next_actions", "get_system_health", "list_available_tools"],
          graph: ["create_edge", "get_edges", "traverse", "delete_edge", "update_edge_properties", "get_project_tasks"],
        };

        // Filter by category if specified
        if (category && categories[category as keyof typeof categories]) {
          const categoryTools = categories[category as keyof typeof categories];
          tools = tools.filter(tool => categoryTools.includes(tool.name));
        }

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                success: true,
                category: category || "all",
                count: tools.length,
                tools: tools.map(tool => {
                  const required = (tool.inputSchema.required as string[]) || [];
                  const properties = Object.keys(tool.inputSchema.properties || {});
                  const optional = properties.filter(key => !required.includes(key));
                  return {
                    name: tool.name,
                    description: tool.description,
                    required_params: required,
                    optional_params: optional,
                  };
                }),
                categories: {
                  memory: "Store and retrieve memories, handoffs, knowledge notes",
                  search: "Search memories using semantic and hybrid search",
                  feedback: "Submit and retrieve agent feedback",
                  system: "System utilities and health monitoring",
                  graph: "Graph-based edge management for agent coordination",
                },
                usage: "Call any tool using its name with the required parameters",
              }),
            },
          ],
        };
      }

      case "create_edge": {
        const { from_node_id, to_node_id, type, properties = {}, tenant_id = "default" } = args as {
          from_node_id: string;
          to_node_id: string;
          type: string;
          properties?: Record<string, unknown>;
          tenant_id?: string;
        };

        // Validate nodes exist
        const fromCheck = await pool.query("SELECT * FROM resolve_node($1, $2) LIMIT 1", [from_node_id, tenant_id]);
        if (fromCheck.rows.length === 0) {
          throw new Error(`Source node not found: ${from_node_id}`);
        }

        const toCheck = await pool.query("SELECT * FROM resolve_node($1, $2) LIMIT 1", [to_node_id, tenant_id]);
        if (toCheck.rows.length === 0) {
          throw new Error(`Target node not found: ${to_node_id}`);
        }

        // Detect circular dependencies for 'depends_on' type
        if (type === "depends_on") {
          const cycleCheck = await pool.query("SELECT detect_dependency_cycle($1, $2)", [from_node_id, to_node_id]);
          if (cycleCheck.rows[0].detect_dependency_cycle) {
            throw new Error(`Circular dependency detected: ${from_node_id} → ${to_node_id}`);
          }
        }

        const { randomBytes } = await import("crypto");
        const edge_id = `edge_${randomBytes(16).toString("hex")}`;
        const result = await pool.query(
          `INSERT INTO edges (edge_id, from_node_id, to_node_id, type, properties, tenant_id)
           VALUES ($1, $2, $3, $4, $5, $6)
           RETURNING *`,
          [edge_id, from_node_id, to_node_id, type, JSON.stringify(properties), tenant_id]
        );

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                success: true,
                edge: result.rows[0],
                message: "Edge created successfully",
              }),
            },
          ],
        };
      }

      case "get_edges": {
        const { node_id, direction = "both", type: edgeType, tenant_id = "default" } = args as {
          node_id: string;
          direction?: "incoming" | "outgoing" | "both";
          type?: string;
          tenant_id?: string;
        };

        let query = `
          SELECT e.*
          FROM edges e
          WHERE e.tenant_id = $1
            AND ($2::text = 'both' OR e.tenant_id = $1)
            AND (e.from_node_id = $2 OR e.to_node_id = $2)
        `;
        const params: (string | number)[] = [tenant_id, node_id];
        let paramCount = 2;

        if (direction === "incoming") {
          query = `
            SELECT e.*
            FROM edges e
            WHERE e.tenant_id = $1 AND e.to_node_id = $2
          `;
        } else if (direction === "outgoing") {
          query = `
            SELECT e.*
            FROM edges e
            WHERE e.tenant_id = $1 AND e.from_node_id = $2
          `;
        }

        if (edgeType) {
          query += ` AND e.type = $${++paramCount}`;
          params.push(edgeType);
        }

        query += ` ORDER BY e.created_at DESC`;

        const result = await pool.query(query, params);

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                success: true,
                edges: result.rows,
                count: result.rows.length,
              }),
            },
          ],
        };
      }

      case "traverse": {
        const { node_id, type: edgeType, direction, depth = 2, tenant_id = "default" } = args as {
          node_id: string;
          type: string;
          direction: "incoming" | "outgoing";
          depth?: number;
          tenant_id?: string;
        };

        // Build recursive CTE query for traversal using path array to prevent cycles
        const traverseDirection = direction === "outgoing" ? "from_node_id" : "to_node_id";
        const oppositeDirection = direction === "outgoing" ? "to_node_id" : "from_node_id";

        const query = `
          WITH RECURSIVE graph_traversal AS (
            -- Base case: starting node
            SELECT
              $1::text AS node_id,
              0 AS depth,
              NULL::text AS edge_id,
              NULL::text AS edge_type,
              NULL::jsonb AS edge_properties,
              ARRAY[$1::text] AS path
            UNION ALL
            -- Recursive case: follow edges
            SELECT
              e.${oppositeDirection} AS node_id,
              gt.depth + 1,
              e.edge_id,
              e.type AS edge_type,
              e.properties AS edge_properties,
              gt.path || e.${oppositeDirection}
            FROM graph_traversal gt
            JOIN edges e ON e.${traverseDirection} = gt.node_id
            WHERE e.type = $2
              AND e.tenant_id = $3
              AND gt.depth < $4
              AND gt.depth >= 0
              -- Prevent cycles using path array
              AND NOT e.${oppositeDirection} = ANY(gt.path)
          )
          SELECT node_id, depth, edge_id, edge_type, edge_properties
          FROM graph_traversal
          WHERE depth > 0
          ORDER BY depth, edge_id
        `;

        const result = await pool.query(query, [node_id, edgeType, tenant_id, Math.min(depth, 5)]);

        // Get root node info
        const rootInfo = await pool.query("SELECT * FROM resolve_node($1, $2)", [node_id, tenant_id]);
        const root = rootInfo.rows[0];

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                success: true,
                root: root ? { node_type: root.node_type, node_id: root.node_id, content: root.content } : null,
                children: result.rows.map(row => ({
                  node: { node_id: row.node_id },
                  edge: {
                    edge_id: row.edge_id,
                    type: row.edge_type,
                    properties: row.edge_properties,
                  },
                  depth: row.depth,
                })),
                total_found: result.rows.length,
              }),
            },
          ],
        };
      }

      case "delete_edge": {
        const { edge_id, tenant_id = "default" } = args as {
          edge_id: string;
          tenant_id?: string;
        };

        const result = await pool.query(
          `DELETE FROM edges WHERE edge_id = $1 AND tenant_id = $2 RETURNING *`,
          [edge_id, tenant_id]
        );

        if (result.rows.length === 0) {
          throw new Error(`Edge not found: ${edge_id}`);
        }

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                success: true,
                deleted_edge: result.rows[0],
                message: "Edge deleted successfully",
              }),
            },
          ],
        };
      }

      case "update_edge_properties": {
        const { edge_id, properties, tenant_id = "default" } = args as {
          edge_id: string;
          properties: Record<string, unknown>;
          tenant_id?: string;
        };

        const result = await pool.query(
          `UPDATE edges
           SET properties = COALESCE(properties, '{}'::jsonb) || $2::jsonb,
               updated_at = NOW()
           WHERE edge_id = $1 AND tenant_id = $3
           RETURNING *`,
          [edge_id, JSON.stringify(properties), tenant_id]
        );

        if (result.rows.length === 0) {
          throw new Error(`Edge not found: ${edge_id}`);
        }

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                success: true,
                edge: result.rows[0],
                message: "Edge properties updated successfully",
              }),
            },
          ],
        };
      }

      case "get_project_tasks": {
        const { project_node_id, status, tenant_id = "default" } = args as {
          project_node_id: string;
          status?: "todo" | "doing" | "done";
          tenant_id?: string;
        };

        // Get all child tasks via parent_of edges
        let query = `
          SELECT
            e.properties,
            kn.id AS task_id,
            kn.text AS title,
            kn.tags,
            kn.created_at
          FROM edges e
          JOIN knowledge_notes kn ON e.to_node_id = kn.node_id
          WHERE e.from_node_id = $1
            AND e.type = 'parent_of'
            AND e.tenant_id = $2
        `;

        const params: (string | number)[] = [project_node_id, tenant_id];
        let paramCount = 2;

        if (status) {
          query += ` AND e.properties->>'status' = $${++paramCount}`;
          params.push(status);
        }

        query += ` ORDER BY e.properties->>'priority' DESC, kn.created_at ASC`;

        const result = await pool.query(query, params);

        // Group by status
        const grouped = {
          todo: [] as any[],
          doing: [] as any[],
          done: [] as any[],
        };

        result.rows.forEach(row => {
          const taskStatus = (row.properties?.status as string) || "todo";
          if (grouped[taskStatus as keyof typeof grouped]) {
            grouped[taskStatus as keyof typeof grouped].push({
              node_id: row.task_id,
              title: row.title,
              tags: row.tags,
              properties: row.properties,
              created_at: row.created_at,
            });
          }
        });

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                success: true,
                project_node_id,
                ...grouped,
                total: result.rows.length,
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
