/**
 * API routes (no authentication)
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

  /**
   * POST /api/v1/events
   * Record an event
   */
  apiRouter.post(
    "/events",
    rateLimiter(eventRateLimiter, (req) => req.ip || "unknown"),
    async (req: Request, res: Response) => {
      try {
        // Validate input
        const validation = validateEventInput(req.body);

        if (!validation.valid) {
          logSecurityEvent("Event validation failed", {
            errors: validation.errors,
            ip: req.ip,
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
          });
          return res.status(400).json({
            error: "Suspicious input detected",
          });
        }

        const result = await recordEvent(pool, validation.sanitized!);
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
   * Get a specific event by ID
   */
  apiRouter.get(
    "/events/:event_id",
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
   * Get events by session
   */
  apiRouter.get(
    "/events",
    async (req: Request, res: Response) => {
      try {
        const { session_id, tenant_id, limit = 100 } = req.query;

        if (!session_id || !tenant_id) {
          return res.status(400).json({
            error: "Missing required parameters: session_id, tenant_id",
          });
        }

        const limitNum = Math.min(Number(limit) || 100, 1000);

        const result = await pool.query(
          `SELECT * FROM events
         WHERE tenant_id = $1 AND session_id = $2
         ORDER BY ts DESC
         LIMIT $3`,
          [tenant_id, session_id, limitNum],
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
   * Build an Active Context Bundle
   */
  apiRouter.post(
    "/acb/build",
    rateLimiter(acbRateLimiter, (req) => req.ip || "unknown"),
    async (req: Request, res: Response) => {
      try {
        const {
          tenant_id,
          session_id,
          agent_id,
          channel,
          intent,
          query_text,
          max_tokens,
        } = req.body;

        if (!tenant_id || !session_id || !agent_id || !channel || !intent) {
          return res.status(400).json({
            error:
              "Missing required fields: tenant_id, session_id, agent_id, channel, intent",
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
          tenant_id,
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
   * Get a specific chunk
   */
  apiRouter.get(
    "/chunks/:chunk_id",
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
   * Get an artifact
   */
  apiRouter.get(
    "/artifacts/:artifact_id",
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
   * Create a decision
   */
  apiRouter.post(
    "/decisions",
    async (req: Request, res: Response) => {
      try {
        const {
          tenant_id,
          decision,
          rationale = [],
          constraints = [],
          alternatives = [],
          consequences = [],
          refs = [],
          scope = "project",
        } = req.body;

        if (!tenant_id || !decision) {
          return res.status(400).json({
            error: "Missing required fields: tenant_id, decision",
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
            tenant_id,
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
   * Query decisions
   */
  apiRouter.get(
    "/decisions",
    async (req: Request, res: Response) => {
      try {
        const { tenant_id, status = "active" } = req.query;

        if (!tenant_id) {
          return res.status(400).json({
            error: "Missing required parameter: tenant_id",
          });
        }

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
          [tenant_id, status],
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
   * Health check
   */
  apiRouter.get("/health", async (_req: Request, res: Response) => {
    try {
      await pool.query("SELECT 1");
      res.json({
        status: "healthy",
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      res.status(503).json({ status: "unhealthy" });
    }
  });

  /**
   * GET /metrics
   * Get metrics in Prometheus format
   */
  apiRouter.get("/metrics", (_req: Request, res: Response) => {
    res.set("Content-Type", "text/plain");
    res.send(metricsService.getPrometheusMetrics());
  });

  /**
   * GET /metrics/json
   * Get metrics as JSON
   */
  apiRouter.get("/metrics/json", (_req: Request, res: Response) => {
    res.json(metricsService.getSnapshot());
  });

  // ========================================================================
  // Tenant API Routes
  // ========================================================================

  /**
   * POST /api/v1/tenants
   * Create a new tenant
   */
  apiRouter.post(
    "/tenants",
    async (req: Request, res: Response) => {
      try {
        const { id, name } = req.body;

        if (!id) {
          return res.status(400).json({
            error: "Missing required field: id",
          });
        }

        // Check if tenant already exists
        const existing = await pool.query(
          "SELECT tenant_id FROM tenants WHERE tenant_id = $1",
          [id]
        );

        if (existing.rows.length > 0) {
          return res.status(409).json({
            error: "Tenant already exists",
            tenant_id: id,
          });
        }

        // Create tenant
        const result = await pool.query(
          `INSERT INTO tenants (tenant_id, name, settings)
           VALUES ($1, $2, $3)
           RETURNING tenant_id, name, created_at`,
          [id, name || id, {}]
        );

        return res.status(201).json(result.rows[0]);
      } catch (error: any) {
        console.error("Error creating tenant:", error);
        return res.status(500).json({
          error: "Failed to create tenant",
          message:
            process.env.NODE_ENV === "development" ? error.message : undefined,
        });
      }
    },
  );

  /**
   * GET /api/v1/tenants/:id
   * Get tenant details
   */
  apiRouter.get(
    "/tenants/:id",
    async (req: Request, res: Response) => {
      try {
        const result = await pool.query(
          "SELECT * FROM tenants WHERE tenant_id = $1",
          [req.params.id]
        );

        if (result.rows.length === 0) {
          return res.status(404).json({ error: "Tenant not found" });
        }

        return res.json(result.rows[0]);
      } catch (error: any) {
        console.error("Error getting tenant:", error);
        return res.status(500).json({
          error: "Failed to get tenant",
          message:
            process.env.NODE_ENV === "development" ? error.message : undefined,
        });
      }
    },
  );

  // ========================================================================
  // Session API Routes
  // ========================================================================

  /**
   * POST /api/v1/sessions
   * Create a new session
   */
  apiRouter.post(
    "/sessions",
    async (req: Request, res: Response) => {
      try {
        const userId = (req.headers["x-user-id"] as string) || "default";
        const tenantId = (req.headers["x-tenant-id"] as string) || "default";

        // Import session service
        const { SessionService } = await import("../services/session-service.js");
        const sessionService = new SessionService(pool);

        const sessionId = await sessionService.createSession(
          userId,
          tenantId,
          req.body.device_info || {},
          req.ip,
          req.get("user-agent"),
        );

        return res.status(201).json({
          session_id: sessionId,
          user_id: userId,
          tenant_id: tenantId,
          title: req.body.title || `Session ${new Date().toLocaleString()}`,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
      } catch (error: any) {
        console.error("Create session error:", error);
        return res.status(500).json({
          error: "Failed to create session",
          message:
            process.env.NODE_ENV === "development" ? error.message : undefined,
        });
      }
    },
  );

  /**
   * GET /api/v1/sessions
   * List all sessions for a user
   */
  apiRouter.get(
    "/sessions",
    async (req: Request, res: Response) => {
      try {
        const userId = (req.headers["x-user-id"] as string) || "default";

        // Import session service
        const { SessionService } = await import("../services/session-service.js");
        const sessionService = new SessionService(pool);

        const sessions = await sessionService.listUserSessions(userId);

        // Transform SessionData to match frontend Session interface
        const transformedSessions = sessions.map((session) => ({
          id: session.session_id,
          user_id: session.user_id,
          tenant_id: session.tenant_id,
          title: `Session ${new Date(session.created_at).toLocaleString()}`,
          created_at: session.created_at.toISOString(),
          updated_at: session.last_activity_at.toISOString(),
          message_count: 0, // Could be calculated from events table
          is_active: session.is_active,
          expires_at: session.expires_at.toISOString(),
        }));

        return res.status(200).json({ sessions: transformedSessions });
      } catch (error: any) {
        console.error("List sessions error:", error);
        return res.status(500).json({
          error: "Failed to list sessions",
          message:
            process.env.NODE_ENV === "development" ? error.message : undefined,
        });
      }
    },
  );

  /**
   * DELETE /api/v1/sessions/:id
   * Delete a specific session
   */
  apiRouter.delete(
    "/sessions/:id",
    async (req: Request, res: Response) => {
      try {
        const userId = (req.headers["x-user-id"] as string) || "default";
        const sessionId = req.params.id as string;

        // Import session service
        const { SessionService } = await import("../services/session-service.js");
        const sessionService = new SessionService(pool);

        const deleted = await sessionService.revokeSession(sessionId, userId);

        if (deleted) {
          return res.status(200).json({ success: true });
        } else {
          return res.status(404).json({ error: "Session not found" });
        }
      } catch (error: any) {
        console.error("Delete session error:", error);
        return res.status(500).json({
          error: "Failed to delete session",
          message:
            process.env.NODE_ENV === "development" ? error.message : undefined,
        });
      }
    },
  );

  // ========================================================================
  // Capsule API Routes
  // ========================================================================

  /**
   * POST /api/v1/capsules
   * Create a capsule with curated memory items
   */
  apiRouter.post(
    "/capsules",
    async (req: Request, res: Response) => {
      try {
        const {
          tenant_id,
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
          !tenant_id ||
          !author_agent_id ||
          !subject_type ||
          !subject_id ||
          !scope ||
          !audience_agent_ids ||
          !items
        ) {
          return res.status(400).json({
            error:
              "Missing required fields: tenant_id, author_agent_id, subject_type, subject_id, scope, audience_agent_ids, items",
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
          tenant_id,
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
   * Query available capsules for an agent
   */
  apiRouter.get(
    "/capsules",
    async (req: Request, res: Response) => {
      try {
        const { tenant_id, agent_id, subject_type, subject_id } = req.query;

        if (!tenant_id || !agent_id) {
          return res.status(400).json({
            error: "Missing required query parameters: tenant_id, agent_id",
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
   * Get a specific capsule
   */
  apiRouter.get(
    "/capsules/:capsule_id",
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
            .json({ error: "Capsule not found" });
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
   * Revoke a capsule
   */
  apiRouter.delete(
    "/capsules/:capsule_id",
    async (req: Request, res: Response) => {
      try {
        const { tenant_id } = req.body;

        if (!tenant_id) {
          return res.status(400).json({
            error: "Missing required field: tenant_id",
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
          !tenant_id ||
          !target_type ||
          !target_id ||
          !op ||
          !reason ||
          patch === undefined
        ) {
          return res.status(400).json({
            error:
              "Missing required fields: tenant_id, target_type, target_id, op, reason, patch",
          });
        }

        const { MemoryEditService } =
          await import("../services/memory-edit-service.js");
        const memoryEditService = new MemoryEditService(pool);

        const edit = await memoryEditService.createMemoryEdit({
          tenant_id,
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
  apiRouter.get("/edits", async (req: Request, res: Response) => {
    try {
      const { tenant_id, status, target_type, proposed_by, limit } = req.query;

      if (!tenant_id) {
        return res.status(400).json({
          error: "Missing required query parameter: tenant_id",
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
    async (req: Request, res: Response) => {
      try {
        const { MemoryEditService } =
          await import("../services/memory-edit-service.js");
        const memoryEditService = new MemoryEditService(pool);

        const edit = await memoryEditService.getEdit(req.params.edit_id);
        if (!edit) {
          return res.status(404).json({ error: "Edit not found" });
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
