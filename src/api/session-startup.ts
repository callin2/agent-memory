import { Router, Request, Response } from "express";
import { Pool } from "pg";

/**
 * Session Startup API
 *
 * Protocol 2: Startup - Loads agent identity and context for session continuity
 *
 * This endpoint enables the agent to "wake up" as themselves by loading:
 * - Last handoff (most recent session context)
 * - Identity thread (aggregated becoming across all sessions)
 * - Knowledge notes (accumulated learning)
 * - Recent stories (personal memory)
 *
 * Provider-Consumer Flow: Startup consumes what Handoff provides
 */

export function createSessionStartupRoutes(pool: Pool): Router {
  const router = Router();

  /**
   * GET /api/v1/session/startup
   *
   * Query params:
   * - tenant_id: Organization/workspace identifier
   * - with_whom: Person/agent the agent is interacting with
   *
   * Returns: Complete startup context for agent to remember themselves
   */
  router.get("/session/startup", async (req: Request, res: Response) => {
    try {
      const tenant_id = req.query.tenant_id as string;
      const with_whom = req.query.with_whom as string;

      if (!tenant_id) {
        res.status(400).json({
          error: "tenant_id is required",
          hint: "Use ?tenant_id=default&with_whom=Callin"
        });
        return;
      }

      if (!with_whom) {
        res.status(400).json({
          error: "with_whom is required",
          hint: "Use ?tenant_id=default&with_whom=Callin"
        });
        return;
      }

      // Check if tenant exists
      const tenantCheck = await pool.query(
        "SELECT tenant_id FROM tenants WHERE tenant_id = $1",
        [tenant_id]
      );

      if (tenantCheck.rows.length === 0) {
        res.status(400).json({
          error: "Tenant not found",
          tenant_id,
          hint: "Create tenant first via POST /api/v1/tenants",
          first_session: true
        });
        return;
      }

      // Load last handoff
      const handoffResult = await pool.query(
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
        [tenant_id, with_whom || null]
      );

      const last_handoff = handoffResult.rows[0] || null;
      const first_session = !last_handoff;

      // Load identity thread (aggregate all handoffs)
      const identityResult = await pool.query(
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
      const knowledgeResult = await pool.query(
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

      // Load recent stories (when story_memory is implemented)
      const recent_stories: any[] = []; // TODO: Load from story_memory table

      // Load recent patterns (when patterns are implemented)
      const recent_patterns: any[] = []; // TODO: Load from patterns table

      // Build response
      const response = {
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

        // Personal stories (TODO)
        recent_stories,

        // Recent patterns (TODO)
        recent_patterns,

        // Meta
        loaded_at: new Date().toISOString(),
        total_handoffs: (identityThread.experienced || []).length,
        total_knowledge_notes: knowledgeResult.rows.length
      };

      res.json(response);

    } catch (error) {
      console.error("[Session Startup] Error:", error);
      res.status(500).json({
        error: "Failed to load session startup",
        message: error instanceof Error ? error.message : String(error)
      });
    }
  });

  return router;
}
