import { Router, Request, Response } from "express";
import { Pool } from "pg";

/**
 * Stratified Memory API
 *
 * Provides token-efficient memory loading with 4 layers:
 * - Metadata: ~50 tokens (session count, key people, tags)
 * - Reflection: ~200 tokens (compressed insights)
 * - Recent: ~500 tokens (last N handoffs in full)
 * - Progressive: ~100 tokens (on-demand by topic)
 *
 * Total compression: ~32x (25,000 tokens → ~850 tokens)
 */

export function createStratifiedMemoryRoutes(pool: Pool): Router {
  const router = Router();

  /**
   * POST /api/memory/wake-up-stratified
   *
   * Wake up with stratified memory layers - token-efficient context loading
   *
   * Body:
   * - tenant_id: Tenant identifier
   * - layers: Array of layers to load ["metadata", "reflection", "recent", "progressive"]
   * - recent_count: Number of recent handoffs (default: 3)
   * - topic: Optional topic for progressive retrieval
   *
   * Returns: Stratified memory with estimated token count
   */
  router.post("/wake-up-stratified", async (req: Request, res: Response): Promise<void> => {
    try {
      const {
        tenant_id = "default",
        layers = ["metadata", "reflection", "recent"],
        recent_count = 3,
        topic
      } = req.body;

      if (!tenant_id) {
        res.status(400).json({
          error: "tenant_id is required"
        });
        return;
      }

      // Check if tenant exists
      const tenantCheck = await pool.query(
        "SELECT tenant_id FROM tenants WHERE tenant_id = $1",
        [tenant_id]
      );

      if (tenantCheck.rows.length === 0) {
        res.status(404).json({
          error: "Tenant not found",
          tenant_id
        });
        return;
      }

      const response: any = {
        success: true,
        tenant_id,
        layers_loaded: [],
        estimated_tokens: 0
      };

      // Layer 1: Metadata (~50 tokens)
      if (layers.includes("metadata")) {
        const metadata = await loadMetadata(pool, tenant_id);
        response.metadata = metadata;
        response.layers_loaded.push("metadata");
        response.estimated_tokens += 50;
      }

      // Layer 2: Reflection (~200 tokens)
      if (layers.includes("reflection")) {
        const reflection = await loadReflection(pool, tenant_id);
        response.reflection = reflection;
        response.layers_loaded.push("reflection");
        response.estimated_tokens += 200;
      }

      // Layer 3: Recent (~500 tokens for 3 handoffs)
      if (layers.includes("recent")) {
        const recent = await loadRecent(pool, tenant_id, recent_count);
        response.recent = recent;
        response.layers_loaded.push("recent");
        response.estimated_tokens += recent_count * 150;
      }

      // Layer 4: Progressive (~100 tokens, on-demand)
      if (layers.includes("progressive")) {
        const progressive = await loadProgressive(pool, tenant_id, topic);
        response.progressive = progressive;
        response.layers_loaded.push("progressive");
        response.estimated_tokens += 100;
      }

      // Calculate compression ratio
      const totalHandoffs = await pool.query(
        "SELECT COUNT(*) as count FROM session_handoffs WHERE tenant_id = $1",
        [tenant_id]
      );
      const totalHandoffCount = parseInt(totalHandoffs.rows[0].count);
      const estimatedOriginalTokens = totalHandoffCount * 800; // ~800 tokens per full handoff
      // Calculate compression ratio and use it in the response
      const compressionRatio = estimatedOriginalTokens > 0
        ? Math.round(estimatedOriginalTokens / response.estimated_tokens)
        : 1;

      response.compression_ratio = `${totalHandoffCount} sessions → ~${response.estimated_tokens} tokens (${compressionRatio}x compression)`;
      response.loaded_at = new Date().toISOString();

      res.json(response);

    } catch (error) {
      console.error("[Stratified Memory] Error:", error);
      res.status(500).json({
        error: "Failed to load stratified memory",
        message: error instanceof Error ? error.message : String(error)
      });
    }
  });

  /**
   * GET /api/memory/compression-stats
   *
   * Get compression statistics for a tenant
   */
  router.get("/compression-stats", async (req: Request, res: Response) => {
    try {
      const tenant_id = req.query.tenant_id as string || "default";

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

      res.json({
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
          : 0
      });

    } catch (error) {
      console.error("[Compression Stats] Error:", error);
      res.status(500).json({
        error: "Failed to get compression stats",
        message: error instanceof Error ? error.message : String(error)
      });
    }
  });

  return router;
}

/**
 * Load metadata layer (~50 tokens)
 */
async function loadMetadata(pool: Pool, tenant_id: string) {
  const result = await pool.query(
    `SELECT
      COUNT(DISTINCT session_id) as session_count,
      MIN(created_at) as first_session,
      MAX(created_at) as last_session,
      AVG(significance) as significance_avg,
      COUNT(DISTINCT with_whom) as unique_people_count,
      array_agg(DISTINCT with_whom) FILTER (WHERE with_whom IS NOT NULL) as key_people
    FROM session_handoffs
    WHERE tenant_id = $1`,
    [tenant_id]
  );

  const row = result.rows[0];

  // Get all tags
  const tagsResult = await pool.query(
    `SELECT DISTINCT unnest(tags) as tag
    FROM session_handoffs
    WHERE tenant_id = $1
    ORDER BY tag`,
    [tenant_id]
  );

  // Get high significance count
  const highSigResult = await pool.query(
    `SELECT COUNT(*) as count
    FROM session_handoffs
    WHERE tenant_id = $1 AND significance >= 0.8`,
    [tenant_id]
  );

  return {
    tenant_id,
    session_count: row.session_count || "0",
    first_session: row.first_session,
    last_session: row.last_session,
    significance_avg: parseFloat(row.significance_avg || "0.5").toFixed(2),
    key_people: row.key_people || [],
    all_tags: tagsResult.rows.map(r => r.tag),
    high_significance_count: highSigResult.rows[0].count
  };
}

/**
 * Load reflection layer (~200 tokens)
 * TODO: Implement actual reflection consolidation
 */
async function loadReflection(pool: Pool, tenant_id: string) {
  // For now, return latest high-significance handoff as reflection
  const result = await pool.query(
    `SELECT
      experienced,
      noticed,
      learned,
      story,
      becoming,
      remember
    FROM session_handoffs
    WHERE tenant_id = $1 AND significance >= 0.8
    ORDER BY created_at DESC
    LIMIT 1`,
    [tenant_id]
  );

  if (result.rows.length === 0) {
    return {
      message: "No reflections yet. System needs to run consolidation.",
      hint: "Reflections are created periodically from session data."
    };
  }

  const row = result.rows[0];
  return {
    type: "latest_high_significance",
    experienced: row.experienced,
    noticed: row.noticed,
    learned: row.learned,
    becoming: row.becoming,
    remember: row.remember
  };
}

/**
 * Load recent layer (~500 tokens for 3 handoffs)
 */
async function loadRecent(pool: Pool, tenant_id: string, count: number) {
  const result = await pool.query(
    `SELECT
      handoff_id,
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
    ORDER BY created_at DESC
    LIMIT $2`,
    [tenant_id, count]
  );

  return result.rows;
}

/**
 * Load progressive layer (~100 tokens, on-demand)
 */
async function loadProgressive(pool: Pool, tenant_id: string, topic?: string) {
  if (!topic) {
    // Return topic index if no specific topic requested
    const result = await pool.query(
      `SELECT
        unnest(tags) as topic,
        COUNT(*) as count
      FROM session_handoffs
      WHERE tenant_id = $1 AND tags IS NOT NULL
      GROUP BY topic
      ORDER BY count DESC
      LIMIT 10`,
      [tenant_id]
    );

    return {
      type: "available_topics",
      topics: result.rows.map(r => ({ topic: r.topic, count: r.count })),
      hint: "Call again with topic parameter to retrieve specific memories."
    };
  }

  // Search for memories related to topic
  const result = await pool.query(
    `SELECT
      handoff_id,
      experienced,
      learned,
      becoming,
      tags,
      created_at
    FROM session_handoffs
    WHERE tenant_id = $1
      AND to_tsvector('english',
            coalesce(experienced, '') || ' ' ||
            coalesce(learned, '') || ' ' ||
            coalesce(noticed, '') || ' ' ||
            coalesce(becoming, '')
          ) @@ plainto_tsquery('english', $2)
    ORDER BY created_at DESC
    LIMIT 5`,
    [tenant_id, topic]
  );

  return {
    type: "topic_memories",
    topic,
    memories: result.rows
  };
}
