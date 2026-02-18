/**
 * Workspace Navigation MCP Tools
 *
 * Tools for navigating between workspaces (tables) in Thread's Memory System.
 * Based on room/table metaphor: Room = AI environment, Workspace = Table (project).
 */

import { Pool } from "pg";

// ============================================================================
// Tool 1: list_workspaces
// ============================================================================

export const listWorkspacesTool = {
  name: "list_workspaces",
  description: "List all workspaces (tables) you can access. Shows your available project tables with metadata like handoff count and primary focus.",
  inputSchema: {
    type: "object",
    properties: {
      // Owner inferred from current context, no params needed
    }
  }
};

export async function handleListWorkspaces(
  pool: Pool,
  currentTenantId: string
): Promise<any> {
  // Get owner_id from current tenant
  const ownerResult = await pool.query(
    "SELECT owner_id FROM tenants WHERE tenant_id = $1",
    [currentTenantId]
  );

  if (ownerResult.rows.length === 0) {
    throw new Error("Tenant not found");
  }

  const ownerId = ownerResult.rows[0].owner_id;

  // List all workspaces for this owner
  const result = await pool.query(
    `SELECT
      tenant_id,
      display_name,
      last_updated,
      last_accessed,
      handoff_count,
      COALESCE(primary_focus, 'No focus yet') as primary_focus
    FROM workspace_summaries
    WHERE owner_id = $1
    ORDER BY last_accessed DESC`,
    [ownerId]
  );

  return {
    success: true,
    workspaces: result.rows,
    total: result.rows.length
  };
}

// ============================================================================
// Tool 2: get_workspace_snapshot
// ============================================================================

export const getWorkspaceSnapshotTool = {
  name: "get_workspace_snapshot",
  description: "Get quick polaroid - compressed state of a workspace. Returns context summary to activate memory before working. Includes what the workspace is, current state, recent focus, key learnings, and priming tags.",
  inputSchema: {
    type: "object",
    properties: {
      tenant_id: {
        type: "string",
        description: "Workspace ID to snapshot"
      },
      max_tokens: {
        type: "number",
        description: "Maximum tokens for snapshot (default: 100)"
      }
    },
    required: ["tenant_id"]
  }
};

export async function handleGetWorkspaceSnapshot(
  pool: Pool,
  tenantId: string,
  maxTokens: number = 100
): Promise<any> {
  const result = await pool.query(
    "SELECT * FROM get_workspace_snapshot($1, $2)",
    [tenantId, maxTokens]
  );

  if (result.rows.length === 0) {
    throw new Error("Workspace snapshot not found");
  }

  return {
    success: true,
    ...result.rows[0]
  };
}

// ============================================================================
// Tool 3: explore_room
// ============================================================================

export const exploreRoomTool = {
  name: "explore_room",
  description: "What can I do in this room? Discover available tools, enabled features, and system capabilities.",
  inputSchema: {
    type: "object",
    properties: {}
  }
};

export async function handleExploreRoom(
  pool: Pool
): Promise<any> {
  // Get system features
  const featuresResult = await pool.query(
    "SELECT feature_name, enabled FROM system_features"
  );

  const features: any = {
    stratified_memory: false,
    consolidation: false,
    cross_tenant_search: false
  };

  featuresResult.rows.forEach((row: any) => {
    features[row.feature_name] = row.enabled;
  });

  return {
    success: true,
    available_tools: [
      'list_workspaces',
      'get_workspace_snapshot',
      'explore_room',
      'search_all_workspaces',
      'memory_record_event',
      'memory_build_acb',
      'memory_get_event',
      'memory_session_startup'
    ],
    database_version: '0.22.0',
    features
  };
}

// ============================================================================
// Tool 4: search_all_workspaces
// ============================================================================

export const searchAllWorkspacesTool = {
  name: "search_all_workspaces",
  description: "Search across all your workspaces. Find handoffs, learnings, and concepts by full-text search.",
  inputSchema: {
    type: "object",
    properties: {
      query: {
        type: "string",
        description: "Search query"
      },
      limit: {
        type: "number",
        description: "Maximum results (default: 10)"
      },
      offset: {
        type: "number",
        description: "Pagination offset (default: 0)"
      }
    },
    required: ["query"]
  }
};

export async function handleSearchAllWorkspaces(
  pool: Pool,
  currentTenantId: string,
  query: string,
  limit: number = 10,
  offset: number = 0
): Promise<any> {
  // Get owner_id from current tenant
  const ownerResult = await pool.query(
    "SELECT owner_id FROM tenants WHERE tenant_id = $1",
    [currentTenantId]
  );

  if (ownerResult.rows.length === 0) {
    throw new Error("Tenant not found");
  }

  const ownerId = ownerResult.rows[0].owner_id;

  // Get total count for pagination
  const countResult = await pool.query(
    `SELECT COUNT(*) as count
    FROM session_handoffs sh
    JOIN tenants t ON sh.tenant_id = t.tenant_id
    WHERE t.owner_id = $1
      AND to_tsvector('english',
        coalesce(sh.experienced, '') || ' ' ||
        coalesce(sh.learned, '') || ' ' ||
        coalesce(sh.story, '')
      ) @@ plainto_tsquery('english', $2)`,
    [ownerId, query]
  );

  const total = parseInt(countResult.rows[0].count);

  // Search
  const results = await pool.query(
    "SELECT * FROM search_all_workspaces($1, $2, $3, $4)",
    [ownerId, query, limit, offset]
  );

  return {
    success: true,
    results: results.rows,
    total,
    has_more: (offset + results.rows.length) < total
  };
}
