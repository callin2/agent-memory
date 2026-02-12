/**
 * Combined API routes with authentication
 */

import { Router, Request, Response } from "express";
import { Pool } from "pg";
import { recordEvent, getEvent } from "../core/recorder.js";
import { buildACB } from "../core/orchestrator.js";
import { metricsService } from "../utils/metrics.js";
import {
  validateEventInput,
  rateLimiter,
  eventRateLimiter,
  acbRateLimiter,
  securityHeaders,
  logSecurityEvent,
  detectSuspiciousInput,
} from "../core/security.js";
import { authenticate, authenticateAny } from "../middleware/auth.js";

export function createAPIRoutes(pool: Pool): Router {
  const apiRouter = Router();

  // Apply security headers
  apiRouter.use(securityHeaders);

  // Metrics collection middleware
  apiRouter.use((req, res, next) => {
    const start = Date.now();

    res.on("finish", () => {
      const duration = Date.now() - start;
      metricsService.record({
        operation: `${req.method} ${req.route?.path || req.path}`,
        duration,
        success: res.statusCode < 400,
      });
    });

    next();
  });

  // Note: Authentication routes are handled separately in server.ts
  // They are mounted at /auth while API routes are at /api/v1

  /**
   * POST /api/v1/events
   * Record an event - requires authentication
   */
  apiRouter.post(
    "/events",
    authenticateAny, // Can use JWT or API key
    rateLimiter(eventRateLimiter, (req) => req.ip || "unknown"),
    async (req: Request, res: Response) => {
      try {
        // Validate input
        const validation = validateEventInput(req.body);

        if (!validation.valid) {
          logSecurityEvent("Event validation failed", {
            errors: validation.errors,
            ip: req.ip,
            tenant_id: req.tenant_id,
          });
          return res.status(400).json({
            error: "Validation failed",
            errors: validation.errors,
          });
        }

        // Check for suspicious patterns
        const bodyStr = JSON.stringify(req.body);
        if (detectSuspiciousInput(bodyStr)) {
          logSecurityEvent("Suspicious input detected", {
            input: bodyStr.substring(0, 500),
            ip: req.ip,
            tenant_id: req.tenant_id,
          });
          return res.status(400).json({
            error: "Suspicious input detected",
          });
        }

        // Override tenant_id from authenticated user
        const eventInput = {
          ...validation.sanitized!,
          tenant_id: req.tenant_id!,
        };

        const result = await recordEvent(pool, eventInput);
        return res.status(201).json(result);
      } catch (error: any) {
        console.error("Error recording event:", error);
        return res.status(500).json({
          error: "Failed to record event",
          message:
            process.env.NODE_ENV === "development" ? error.message : undefined,
        });
      }
    },
  );

  /**
   * GET /api/v1/events/:event_id
   * Get a specific event by ID - requires authentication
   */
  apiRouter.get(
    "/events/:event_id",
    authenticate,
    async (req: Request, res: Response) => {
      try {
        const eventId = req.params.event_id;
        if (!eventId || !/^evt_[a-f0-9]{16}$/i.test(eventId)) {
          return res.status(400).json({
            error: "Invalid event ID format",
          });
        }

        const event = await getEvent(pool, eventId);

        if (!event) {
          return res.status(404).json({ error: "Event not found" });
        }

        // Enforce tenant isolation
        if (event.tenant_id !== req.tenant_id) {
          return res.status(403).json({
            error: "Forbidden",
            message: "Cannot access event from different tenant",
          });
        }

        return res.json(event);
      } catch (error: any) {
        console.error("Error getting event:", error);
        return res.status(500).json({
          error: "Failed to get event",
          message:
            process.env.NODE_ENV === "development" ? error.message : undefined,
        });
      }
    },
  );

  /**
   * GET /api/v1/events
   * Get events by session - requires authentication
   */
  apiRouter.get(
    "/events",
    authenticate,
    async (req: Request, res: Response) => {
      try {
        const { session_id, limit = 100 } = req.query;

        if (!session_id) {
          return res.status(400).json({
            error: "Missing required parameter: session_id",
          });
        }

        const limitNum = Math.min(Number(limit) || 100, 1000);

        const result = await pool.query(
          `SELECT * FROM events
         WHERE tenant_id = $1 AND session_id = $2
         ORDER BY ts DESC
         LIMIT $3`,
          [req.tenant_id, session_id, limitNum],
        );

        return res.json(result.rows);
      } catch (error: any) {
        console.error("Error getting events:", error);
        return res.status(500).json({
          error: "Failed to get events",
          message:
            process.env.NODE_ENV === "development" ? error.message : undefined,
        });
      }
    },
  );

  /**
   * POST /api/v1/acb/build
   * Build an Active Context Bundle - requires authentication
   */
  apiRouter.post(
    "/acb/build",
    authenticate,
    rateLimiter(acbRateLimiter, (req) => req.ip || "unknown"),
    async (req: Request, res: Response) => {
      try {
        const {
          session_id,
          agent_id,
          channel,
          intent,
          query_text,
          max_tokens,
        } = req.body;

        if (!session_id || !agent_id || !channel || !intent) {
          return res.status(400).json({
            error:
              "Missing required fields: session_id, agent_id, channel, intent",
          });
        }

        if (!["private", "public", "team", "agent"].includes(channel)) {
          return res.status(400).json({
            error: "Invalid channel",
            allowed: ["private", "public", "team", "agent"],
          });
        }

        const maxTokens = Number(max_tokens) || 65000;
        if (maxTokens < 1000 || maxTokens > 200000) {
          return res.status(400).json({
            error: "max_tokens must be between 1000 and 200000",
          });
        }

        const acb = await buildACB(pool, {
          tenant_id: req.tenant_id!,
          session_id,
          agent_id,
          channel,
          intent,
          query_text: query_text || "",
          max_tokens: maxTokens,
        });

        return res.json(acb);
      } catch (error: any) {
        console.error("Error building ACB:", error);
        return res.status(500).json({
          error: "Failed to build ACB",
          message:
            process.env.NODE_ENV === "development" ? error.message : undefined,
        });
      }
    },
  );

  /**
   * GET /api/v1/chunks/:chunk_id
   * Get a specific chunk - requires authentication
   */
  apiRouter.get(
    "/chunks/:chunk_id",
    authenticate,
    async (req: Request, res: Response) => {
      try {
        const chunkId = req.params.chunk_id;
        if (!chunkId || !/^chk_[a-f0-9]{16}$/i.test(chunkId)) {
          return res.status(400).json({
            error: "Invalid chunk ID format",
          });
        }

        const result = await pool.query(
          "SELECT * FROM chunks WHERE chunk_id = $1",
          [chunkId],
        );

        if (result.rows.length === 0) {
          return res.status(404).json({ error: "Chunk not found" });
        }

        // Enforce tenant isolation
        if (result.rows[0].tenant_id !== req.tenant_id) {
          return res.status(403).json({
            error: "Forbidden",
          });
        }

        return res.json(result.rows[0]);
      } catch (error: any) {
        console.error("Error getting chunk:", error);
        return res.status(500).json({
          error: "Failed to get chunk",
          message:
            process.env.NODE_ENV === "development" ? error.message : undefined,
        });
      }
    },
  );

  /**
   * GET /api/v1/artifacts/:artifact_id
   * Get an artifact - requires authentication
   */
  apiRouter.get(
    "/artifacts/:artifact_id",
    authenticate,
    async (req: Request, res: Response) => {
      try {
        const artifactId = req.params.artifact_id;
        if (!artifactId || !/^art_[a-f0-9]{16}$/i.test(artifactId)) {
          return res.status(400).json({
            error: "Invalid artifact ID format",
          });
        }

        const result = await pool.query(
          "SELECT * FROM artifacts WHERE artifact_id = $1",
          [artifactId],
        );

        if (result.rows.length === 0) {
          return res.status(404).json({ error: "Artifact not found" });
        }

        // Enforce tenant isolation
        if (result.rows[0].tenant_id !== req.tenant_id) {
          return res.status(403).json({
            error: "Forbidden",
          });
        }

        const artifact = result.rows[0];
        res.setHeader("Content-Type", "application/octet-stream");
        return res.send(artifact.bytes);
      } catch (error: any) {
        console.error("Error getting artifact:", error);
        return res.status(500).json({
          error: "Failed to get artifact",
          message:
            process.env.NODE_ENV === "development" ? error.message : undefined,
        });
      }
    },
  );

  /**
   * POST /api/v1/decisions
   * Create a decision - requires authentication
   */
  apiRouter.post(
    "/decisions",
    authenticate,
    async (req: Request, res: Response) => {
      try {
        const {
          decision,
          rationale = [],
          constraints = [],
          alternatives = [],
          consequences = [],
          refs = [],
          scope = "project",
        } = req.body;

        if (!decision) {
          return res.status(400).json({
            error: "Missing required field: decision",
          });
        }

        if (scope && !["project", "user", "global"].includes(scope)) {
          return res.status(400).json({
            error: "Invalid scope",
            allowed: ["project", "user", "global"],
          });
        }

        const decision_id = `dec_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;

        await pool.query(
          `INSERT INTO decisions (decision_id, tenant_id, status, scope, decision,
                                rationale, constraints, alternatives, consequences, refs)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
          [
            decision_id,
            req.tenant_id,
            "active",
            scope,
            decision,
            rationale,
            constraints,
            alternatives,
            consequences,
            refs,
          ],
        );

        return res.status(201).json({ decision_id });
      } catch (error: any) {
        console.error("Error creating decision:", error);
        return res.status(500).json({
          error: "Failed to create decision",
          message:
            process.env.NODE_ENV === "development" ? error.message : undefined,
        });
      }
    },
  );

  /**
   * GET /api/v1/decisions
   * Query decisions - requires authentication
   */
  apiRouter.get(
    "/decisions",
    authenticate,
    async (req: Request, res: Response) => {
      try {
        const { status = "active" } = req.query;

        if (!["active", "superseded"].includes(status as string)) {
          return res.status(400).json({
            error: "Invalid status",
            allowed: ["active", "superseded"],
          });
        }

        const result = await pool.query(
          `SELECT * FROM decisions
         WHERE tenant_id = $1 AND status = $2
         ORDER BY ts DESC`,
          [req.tenant_id, status],
        );

        return res.json(result.rows);
      } catch (error: any) {
        console.error("Error getting decisions:", error);
        return res.status(500).json({
          error: "Failed to get decisions",
          message:
            process.env.NODE_ENV === "development" ? error.message : undefined,
        });
      }
    },
  );

  /**
   * GET /health
   * Health check - no authentication required
   */
  apiRouter.get("/health", async (req: Request, res: Response) => {
    try {
      await pool.query("SELECT 1");
      res.json({
        status: "healthy",
        timestamp: new Date().toISOString(),
        authenticated: !!req.user,
      });
    } catch (error) {
      res.status(503).json({ status: "unhealthy" });
    }
  });

  /**
   * GET /metrics
   * Get metrics in Prometheus format - no authentication required (monitoring)
   */
  apiRouter.get("/metrics", (_req: Request, res: Response) => {
    res.set("Content-Type", "text/plain");
    res.send(metricsService.getPrometheusMetrics());
  });

  /**
   * GET /metrics/json
   * Get metrics as JSON - no authentication required (monitoring)
   */
  apiRouter.get("/metrics/json", (_req: Request, res: Response) => {
    res.json(metricsService.getSnapshot());
  });

  // ========================================================================
  // Capsule API Routes
  // ========================================================================

  /**
   * POST /api/v1/capsules
   * Create a capsule with curated memory items - requires authentication
   */
  apiRouter.post(
    "/capsules",
    authenticate,
    async (req: Request, res: Response) => {
      try {
        const {
          author_agent_id,
          subject_type,
          subject_id,
          scope,
          project_id,
          audience_agent_ids,
          items,
          ttl_days,
          risks,
        } = req.body;

        // Validation
        if (
          !author_agent_id ||
          !subject_type ||
          !subject_id ||
          !scope ||
          !audience_agent_ids ||
          !items
        ) {
          return res.status(400).json({
            error:
              "Missing required fields: author_agent_id, subject_type, subject_id, scope, audience_agent_ids, items",
          });
        }

        if (
          !["session", "user", "project", "policy", "global"].includes(scope)
        ) {
          return res.status(400).json({
            error: "Invalid scope",
            allowed: ["session", "user", "project", "policy", "global"],
          });
        }

        if (
          !Array.isArray(audience_agent_ids) ||
          audience_agent_ids.length === 0
        ) {
          return res.status(400).json({
            error: "audience_agent_ids must be a non-empty array",
          });
        }

        if (!items.chunks && !items.decisions && !items.artifacts) {
          return res.status(400).json({
            error:
              "items must contain at least one of: chunks, decisions, artifacts",
          });
        }

        // Import capsule service
        const { CapsuleService } =
          await import("../services/capsule-service.js");
        const capsuleService = new CapsuleService(pool);

        const capsule = await capsuleService.createCapsule({
          tenant_id: req.tenant_id!,
          author_agent_id,
          subject_type,
          subject_id,
          scope,
          project_id,
          audience_agent_ids,
          items,
          ttl_days,
          risks,
        });

        return res.status(201).json({
          capsule_id: capsule.capsule_id,
          status: capsule.status,
          expires_at: capsule.expires_at,
        });
      } catch (error: any) {
        console.error("Error creating capsule:", error);
        return res.status(400).json({
          error: "Failed to create capsule",
          message:
            process.env.NODE_ENV === "development" ? error.message : undefined,
        });
      }
    },
  );

  /**
   * GET /api/v1/capsules
   * Query available capsules for an agent - requires authentication
   */
  apiRouter.get(
    "/capsules",
    authenticate,
    async (req: Request, res: Response) => {
      try {
        const { tenant_id, agent_id, subject_type, subject_id } = req.query;

        if (!tenant_id || !agent_id) {
          return res.status(400).json({
            error: "Missing required query parameters: tenant_id, agent_id",
          });
        }

        if (tenant_id !== req.tenant_id) {
          return res.status(403).json({
            error: "Forbidden",
            message: "Cannot access capsules from different tenant",
          });
        }

        const { CapsuleService } =
          await import("../services/capsule-service.js");
        const capsuleService = new CapsuleService(pool);

        const capsules = await capsuleService.getAvailableCapsules(
          tenant_id as string,
          agent_id as string,
          subject_type as string | undefined,
          subject_id as string | undefined,
        );

        return res.json({
          capsules,
          count: capsules.length,
        });
      } catch (error: any) {
        console.error("Error getting capsules:", error);
        return res.status(500).json({
          error: "Failed to get capsules",
          message:
            process.env.NODE_ENV === "development" ? error.message : undefined,
        });
      }
    },
  );

  /**
   * GET /api/v1/capsules/:capsule_id
   * Get a specific capsule - requires authentication
   */
  apiRouter.get(
    "/capsules/:capsule_id",
    authenticate,
    async (req: Request, res: Response) => {
      try {
        const { agent_id } = req.query;

        if (!agent_id) {
          return res.status(400).json({
            error: "Missing required query parameter: agent_id",
          });
        }

        const { CapsuleService } =
          await import("../services/capsule-service.js");
        const capsuleService = new CapsuleService(pool);

        const capsule = await capsuleService.getCapsule(
          req.params.capsule_id,
          agent_id as string,
        );

        if (!capsule) {
          return res
            .status(404)
            .json({ error: "Capsule not found or access denied" });
        }

        // Enforce tenant isolation
        if (capsule.tenant_id !== req.tenant_id) {
          return res.status(403).json({
            error: "Forbidden",
          });
        }

        return res.json(capsule);
      } catch (error: any) {
        console.error("Error getting capsule:", error);
        return res.status(500).json({
          error: "Failed to get capsule",
          message:
            process.env.NODE_ENV === "development" ? error.message : undefined,
        });
      }
    },
  );

  /**
   * DELETE /api/v1/capsules/:capsule_id
   * Revoke a capsule - requires authentication
   */
  apiRouter.delete(
    "/capsules/:capsule_id",
    authenticate,
    async (req: Request, res: Response) => {
      try {
        const { tenant_id } = req.body;

        if (!tenant_id) {
          return res.status(400).json({
            error: "Missing required field: tenant_id",
          });
        }

        if (tenant_id !== req.tenant_id) {
          return res.status(403).json({
            error: "Forbidden",
            message: "Cannot revoke capsule from different tenant",
          });
        }

        const { CapsuleService } =
          await import("../services/capsule-service.js");
        const capsuleService = new CapsuleService(pool);

        const revoked = await capsuleService.revokeCapsule(
          req.params.capsule_id,
          tenant_id,
        );

        if (!revoked) {
          return res.status(404).json({ error: "Capsule not found" });
        }

        return res.json({
          capsule_id: req.params.capsule_id,
          status: "revoked",
          revoked_at: new Date().toISOString(),
        });
      } catch (error: any) {
        console.error("Error revoking capsule:", error);
        return res.status(500).json({
          error: "Failed to revoke capsule",
          message:
            process.env.NODE_ENV === "development" ? error.message : undefined,
        });
      }
    },
  );

  // ========================================================================
  // Memory Edit API Routes
  // ========================================================================

  /**
   * POST /api/v1/edits
   * Create a new memory edit (retract/amend/quarantine/attenuate/block)
   */
  apiRouter.post(
    "/edits",
    authenticate,
    async (req: Request, res: Response) => {
      try {
        const {
          tenant_id,
          target_type,
          target_id,
          op,
          reason,
          proposed_by,
          approved_by,
          patch,
          auto_approve,
        } = req.body;

        if (
          !target_type ||
          !target_id ||
          !op ||
          !reason ||
          patch === undefined
        ) {
          return res.status(400).json({
            error:
              "Missing required fields: target_type, target_id, op, reason, patch",
          });
        }

        if (tenant_id && tenant_id !== req.tenant_id) {
          return res.status(403).json({
            error: "Forbidden",
            message: "Cannot create edits for different tenant",
          });
        }

        const { MemoryEditService } =
          await import("../services/memory-edit-service.js");
        const memoryEditService = new MemoryEditService(pool);

        const edit = await memoryEditService.createMemoryEdit({
          tenant_id: req.tenant_id!,
          target_type,
          target_id,
          op,
          reason,
          proposed_by,
          approved_by,
          patch,
          auto_approve,
        });

        return res.status(201).json(edit);
      } catch (error: any) {
        console.error("Error creating memory edit:", error);
        return res.status(400).json({
          error: "Failed to create edit",
          message:
            process.env.NODE_ENV === "development" ? error.message : undefined,
        });
      }
    },
  );

  /**
   * GET /api/v1/edits
   * List edits with filters
   */
  apiRouter.get("/edits", authenticate, async (req: Request, res: Response) => {
    try {
      const { tenant_id, status, target_type, proposed_by, limit } = req.query;

      if (!tenant_id) {
        return res.status(400).json({
          error: "Missing required query parameter: tenant_id",
        });
      }

      if (tenant_id !== req.tenant_id) {
        return res.status(403).json({
          error: "Forbidden",
          message: "Cannot list edits for different tenant",
        });
      }

      const { MemoryEditService } =
        await import("../services/memory-edit-service.js");
      const memoryEditService = new MemoryEditService(pool);

      const edits = await memoryEditService.listEdits(tenant_id as string, {
        status: status as any,
        target_type: target_type as any,
        proposed_by: proposed_by as string | undefined,
        limit: limit ? Number(limit) : undefined,
      });

      return res.json({ edits, count: edits.length });
    } catch (error: any) {
      console.error("Error listing edits:", error);
      return res.status(500).json({
        error: "Failed to list edits",
        message:
          process.env.NODE_ENV === "development" ? error.message : undefined,
      });
    }
  });

  /**
   * GET /api/v1/edits/:edit_id
   * Get edit details
   */
  apiRouter.get(
    "/edits/:edit_id",
    authenticate,
    async (req: Request, res: Response) => {
      try {
        const { MemoryEditService } =
          await import("../services/memory-edit-service.js");
        const memoryEditService = new MemoryEditService(pool);

        const edit = await memoryEditService.getEdit(req.params.edit_id);
        if (!edit) {
          return res.status(404).json({ error: "Edit not found" });
        }

        if (edit.tenant_id !== req.tenant_id) {
          return res.status(403).json({ error: "Forbidden" });
        }

        return res.json(edit);
      } catch (error: any) {
        console.error("Error getting edit:", error);
        return res.status(500).json({
          error: "Failed to get edit",
          message:
            process.env.NODE_ENV === "development" ? error.message : undefined,
        });
      }
    },
  );

  /**
   * PUT /api/v1/edits/:edit_id/approve
   * Approve a pending edit
   */
  apiRouter.put(
    "/edits/:edit_id/approve",
    authenticate,
    async (req: Request, res: Response) => {
      try {
        const { approved_by } = req.body;
        if (!approved_by) {
          return res
            .status(400)
            .json({ error: "Missing required field: approved_by" });
        }

        const { MemoryEditService } =
          await import("../services/memory-edit-service.js");
        const memoryEditService = new MemoryEditService(pool);

        const edit = await memoryEditService.approveEdit(
          req.params.edit_id,
          approved_by,
        );
        if (!edit) {
          return res
            .status(404)
            .json({ error: "Edit not found or not pending" });
        }

        if (edit.tenant_id !== req.tenant_id) {
          return res.status(403).json({ error: "Forbidden" });
        }

        return res.json(edit);
      } catch (error: any) {
        console.error("Error approving edit:", error);
        return res.status(500).json({
          error: "Failed to approve edit",
          message:
            process.env.NODE_ENV === "development" ? error.message : undefined,
        });
      }
    },
  );

  /**
   * PUT /api/v1/edits/:edit_id/reject
   * Reject a pending edit
   */
  apiRouter.put(
    "/edits/:edit_id/reject",
    authenticate,
    async (req: Request, res: Response) => {
      try {
        const { MemoryEditService } =
          await import("../services/memory-edit-service.js");
        const memoryEditService = new MemoryEditService(pool);

        const edit = await memoryEditService.rejectEdit(req.params.edit_id);
        if (!edit) {
          return res
            .status(404)
            .json({ error: "Edit not found or not pending" });
        }

        if (edit.tenant_id !== req.tenant_id) {
          return res.status(403).json({ error: "Forbidden" });
        }

        return res.json(edit);
      } catch (error: any) {
        console.error("Error rejecting edit:", error);
        return res.status(500).json({
          error: "Failed to reject edit",
          message:
            process.env.NODE_ENV === "development" ? error.message : undefined,
        });
      }
    },
  );

  return apiRouter;
}
