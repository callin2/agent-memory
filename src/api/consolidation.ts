/**
 * Consolidation API
 *
 * API endpoints for triggering and monitoring sleep-based consolidation
 */

import { Router, Request, Response } from "express";
import { Pool } from "pg";
import { ConsolidationService } from "../services/consolidation";

export function createConsolidationRoutes(pool: Pool): Router {
  const router = Router();
  const consolidationService = new ConsolidationService(pool);

  /**
   * POST /api/v1/consolidation/run
   *
   * Manually trigger consolidation for a tenant
   *
   * Body:
   * - tenant_id: Tenant identifier (default: 'default')
   * - job_type: Type of consolidation to run (optional, default: 'all')
   *
   * Returns: Consolidation results
   */
  router.post("/consolidation/run", async (req: Request, res: Response) => {
    try {
      const { tenant_id = "default", job_type } = req.body;

      // Validate job_type
      const validJobTypes = [
        "all",
        "identity_consolidation",
        "handoff_compression",
        "decision_archival",
      ];

      if (job_type && !validJobTypes.includes(job_type)) {
        res.status(400).json({
          error: "Invalid job_type",
          valid_values: validJobTypes,
        });
        return;
      }

      let results;

      if (job_type === "identity_consolidation") {
        results = [await consolidationService.consolidateIdentityThread(tenant_id)];
      } else if (job_type === "handoff_compression") {
        results = [await consolidationService.compressHandoffs(tenant_id)];
      } else if (job_type === "decision_archival") {
        results = [await consolidationService.archiveDecisions(tenant_id)];
      } else {
        results = await consolidationService.consolidateAll(tenant_id);
      }

      res.json({
        success: true,
        tenant_id,
        job_type: job_type || "all",
        results,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error("[Consolidation API] Error:", error);
      res.status(500).json({
        error: "Consolidation failed",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  /**
   * GET /api/v1/consolidation/stats
   *
   * Get consolidation statistics for a tenant
   *
   * Query params:
   * - tenant_id: Tenant identifier (default: 'default')
   */
  router.get("/consolidation/stats", async (req: Request, res: Response) => {
    try {
      const tenant_id = req.query.tenant_id as string || "default";

      const stats = await consolidationService.getConsolidationStats(tenant_id);

      res.json({
        success: true,
        tenant_id,
        ...stats,
      });
    } catch (error) {
      console.error("[Consolidation API] Error:", error);
      res.status(500).json({
        error: "Failed to retrieve consolidation stats",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  /**
   * GET /api/v1/consolidation/jobs
   *
   * Get recent consolidation jobs for a tenant
   *
   * Query params:
   * - tenant_id: Tenant identifier (default: 'default')
   * - status: Filter by status (optional)
   * - limit: Maximum jobs to return (default: 50)
   */
  router.get("/consolidation/jobs", async (req: Request, res: Response) => {
    try {
      const tenant_id = req.query.tenant_id as string || "default";
      const status = req.query.status as string;
      const limit = parseInt(req.query.limit as string) || "50";

      const result = await pool.query(
        `SELECT
           job_id,
           job_type,
           status,
           started_at,
           completed_at,
           items_processed,
           items_affected,
           error_message,
           metadata
         FROM consolidation_jobs
         WHERE tenant_id = $1
           AND ($2::text IS NULL OR status = $2)
         ORDER BY started_at DESC
         LIMIT $3`,
        [tenant_id, status || null, limit]
      );

      res.json({
        success: true,
        tenant_id,
        count: result.rows.length,
        jobs: result.rows,
      });
    } catch (error) {
      console.error("[Consolidation API] Error:", error);
      res.status(500).json({
        error: "Failed to retrieve consolidation jobs",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  return router;
}
