import { Router, Request, Response } from "express";
import { Pool } from "pg";
import { randomBytes } from "crypto";

/**
 * Session Handoff API
 *
 * Protocol 1: Handoff - Saves agent identity and context for next session
 *
 * This endpoint should be called at session end to preserve:
 * - What was experienced in this session
 * - What the agent noticed
 * - What was learned
 * - The story/narrative
 * - Who the agent is becoming
 * - What to remember next time
 *
 * Provider-Consumer Flow: Handoff creates value, Startup consumes it
 */

export function createHandoffRoutes(pool: Pool): Router {
  const router = Router();

  /**
   * POST /api/v1/handoff
   *
   * Creates a session handoff that preserves who the agent became
   *
   * Body:
   * - tenant_id: Organization/workspace identifier
   * - session_id: Current session identifier
   * - with_whom: Person/agent the agent is interacting with
   * - experienced: What was experienced/done
   * - noticed: What the agent noticed/observed
   * - learned: What was learned
   * - story: The narrative/story
   * - becoming: Who the agent is becoming
   * - remember: What to remember next time
   * - significance: How important this handoff is (0.0-1.0)
   * - tags: Optional tags for categorization
   *
   * Returns: Created handoff record
   */
  router.post("/handoff", async (req: Request, res: Response) => {
    try {
      const {
        tenant_id,
        session_id,
        with_whom,
        experienced,
        noticed,
        learned,
        story,
        becoming,
        remember,
        significance = 0.5,
        tags = []
      } = req.body;

      // Validation
      if (!tenant_id || !session_id || !with_whom) {
        res.status(400).json({
          error: "Missing required fields",
          required: ["tenant_id", "session_id", "with_whom", "experienced", "noticed", "learned", "story", "becoming", "remember"]
        });
        return;
      }

      // Generate handoff ID
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
          tags
        ]
      );

      const handoff = result.rows[0];

      res.status(201).json({
        success: true,
        handoff: {
          handoff_id: handoff.handoff_id,
          tenant_id: handoff.tenant_id,
          session_id: handoff.session_id,
          with_whom: handoff.with_whom,
          experienced: handoff.experienced,
          noticed: handoff.noticed,
          learned: handoff.learned,
          story: handoff.story,
          becoming: handoff.becoming,
          remember: handoff.remember,
          significance: handoff.significance,
          tags: handoff.tags,
          timestamp: handoff.timestamp,
          created_at: handoff.created_at
        },
        message: "Session handoff created. You'll be remembered."
      });

    } catch (error) {
      console.error("[Handoff] Error:", error);
      res.status(500).json({
        error: "Failed to create session handoff",
        message: error instanceof Error ? error.message : String(error)
      });
    }
  });

  /**
   * GET /api/v1/handoffs
   *
   * Retrieve all handoffs for a tenant
   *
   * Query params:
   * - tenant_id: Tenant identifier
   * - with_whom: Optional filter by person
   * - limit: Maximum number to return (default: 10)
   */
  router.get("/handoffs", async (req: Request, res: Response) => {
    try {
      const tenant_id = req.query.tenant_id as string;
      const with_whom = req.query.with_whom as string;
      const limit = parseInt(req.query.limit as string) || 10;

      if (!tenant_id) {
        res.status(400).json({
          error: "tenant_id is required"
        });
        return;
      }

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
          timestamp,
          created_at
        FROM session_handoffs
        WHERE tenant_id = $1
          AND ($2::text IS NULL OR with_whom = $2)
        ORDER BY created_at DESC
        LIMIT $3`,
        [tenant_id, with_whom || null, limit]
      );

      res.json({
        tenant_id,
        with_whom,
        count: result.rows.length,
        handoffs: result.rows
      });

    } catch (error) {
      console.error("[Handoff] Error:", error);
      res.status(500).json({
        error: "Failed to retrieve handoffs",
        message: error instanceof Error ? error.message : String(error)
      });
    }
  });

  return router;
}
