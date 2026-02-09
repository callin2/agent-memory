import { Router, Request, Response } from 'express';
import { Pool } from 'pg';
import { recordEvent } from '../core/recorder.js';
import { buildACB } from '../core/orchestrator.js';
import { metricsService } from '../utils/metrics.js';
import {
  validateEventInput,
  rateLimiter,
  eventRateLimiter,
  acbRateLimiter,
  securityHeaders,
  logSecurityEvent,
  detectSuspiciousInput,
} from '../core/security.js';

export function createSecureRoutes(pool: Pool): Router {
  const router = Router();

  // Apply security headers
  router.use(securityHeaders);

  // Metrics collection middleware
  router.use((req, res, next) => {
    const start = Date.now();

    res.on('finish', () => {
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
   * Record an event to the memory system
   */
  router.post(
    '/events',
    rateLimiter(eventRateLimiter, (req) => req.ip || 'unknown'),
    async (req: Request, res: Response) => {
      try {
        // Validate input
        const validation = validateEventInput(req.body);

        if (!validation.valid) {
          logSecurityEvent('Event validation failed', {
            errors: validation.errors,
            ip: req.ip,
          });
          return res.status(400).json({
            error: 'Validation failed',
            errors: validation.errors,
          });
        }

        // Check for suspicious patterns
        const bodyStr = JSON.stringify(req.body);
        if (detectSuspiciousInput(bodyStr)) {
          logSecurityEvent('Suspicious input detected', {
            input: bodyStr.substring(0, 500),
            ip: req.ip,
          });
          return res.status(400).json({
            error: 'Suspicious input detected',
          });
        }

        const result = await recordEvent(pool, validation.sanitized!);
        res.status(201).json(result);
      } catch (error: any) {
        console.error('Error recording event:', error);
        res.status(500).json({
          error: 'Failed to record event',
          message: error.message,
        });
      }
    }
  );

  /**
   * GET /api/v1/events/:event_id
   * Get a specific event by ID
   */
  router.get('/events/:event_id', async (req: Request, res: Response) => {
    try {
      // Validate event_id format
      const eventId = req.params.event_id;
      if (!eventId || !/^evt_[a-f0-9]{16}$/i.test(eventId)) {
        return res.status(400).json({
          error: 'Invalid event ID format',
        });
      }

      // Use parameterized query to prevent SQL injection
      const result = await pool.query('SELECT * FROM events WHERE event_id = $1', [
        eventId,
      ]);

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Event not found' });
      }

      res.json(result.rows[0]);
    } catch (error: any) {
      console.error('Error getting event:', error);
      res.status(500).json({
        error: 'Failed to get event',
        message: error.message,
      });
    }
  });

  /**
   * GET /api/v1/events
   * Get events by session
   */
  router.get('/events', async (req: Request, res: Response) => {
    try {
      const { tenant_id, session_id, limit = 100 } = req.query;

      if (!tenant_id || !session_id) {
        return res.status(400).json({
          error: 'Missing required parameters: tenant_id, session_id',
        });
      }

      // Validate and sanitize limit
      const limitNum = Math.min(Number(limit) || 100, 1000);

      // Use parameterized queries
      const result = await pool.query(
        `SELECT * FROM events
         WHERE tenant_id = $1 AND session_id = $2
         ORDER BY ts DESC
         LIMIT $3`,
        [tenant_id, session_id, limitNum]
      );

      res.json(result.rows);
    } catch (error: any) {
      console.error('Error getting events:', error);
      res.status(500).json({
        error: 'Failed to get events',
        message: error.message,
      });
    }
  });

  /**
   * POST /api/v1/acb/build
   * Build an Active Context Bundle for the next LLM call
   */
  router.post(
    '/acb/build',
    rateLimiter(acbRateLimiter, (req) => req.ip || 'unknown'),
    async (req: Request, res: Response) => {
      try {
        // Validate required fields
        const { tenant_id, session_id, agent_id, channel, intent, max_tokens } = req.body;

        if (!tenant_id || !session_id || !agent_id || !channel || !intent) {
          return res.status(400).json({
            error: 'Missing required fields: tenant_id, session_id, agent_id, channel, intent',
          });
        }

        // Validate channel
        if (!['private', 'public', 'team', 'agent'].includes(channel)) {
          return res.status(400).json({
            error: 'Invalid channel',
            allowed: ['private', 'public', 'team', 'agent'],
          });
        }

        // Validate max_tokens
        const maxTokens = Number(max_tokens) || 65000;
        if (maxTokens < 1000 || maxTokens > 200000) {
          return res.status(400).json({
            error: 'max_tokens must be between 1000 and 200000',
          });
        }

        const acb = await buildACB(pool, {
          tenant_id,
          session_id,
          agent_id,
          channel,
          intent,
          query_text: req.body.query_text || '',
          max_tokens: maxTokens,
        });

        res.json(acb);
      } catch (error: any) {
        console.error('Error building ACB:', error);
        res.status(500).json({
          error: 'Failed to build ACB',
          message: error.message,
        });
      }
    }
  );

  /**
   * GET /api/v1/chunks/:chunk_id
   * Get a specific chunk by ID
   */
  router.get('/chunks/:chunk_id', async (req: Request, res: Response) => {
    try {
      const chunkId = req.params.chunk_id;
      if (!chunkId || !/^chk_[a-f0-9]{16}$/i.test(chunkId)) {
        return res.status(400).json({
          error: 'Invalid chunk ID format',
        });
      }

      const result = await pool.query('SELECT * FROM chunks WHERE chunk_id = $1', [
        chunkId,
      ]);

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Chunk not found' });
      }

      res.json(result.rows[0]);
    } catch (error: any) {
      console.error('Error getting chunk:', error);
      res.status(500).json({
        error: 'Failed to get chunk',
        message: error.message,
      });
    }
  });

  /**
   * GET /api/v1/artifacts/:artifact_id
   * Get an artifact (large binary storage)
   */
  router.get('/artifacts/:artifact_id', async (req: Request, res: Response) => {
    try {
      const artifactId = req.params.artifact_id;
      if (!artifactId || !/^art_[a-f0-9]{16}$/i.test(artifactId)) {
        return res.status(400).json({
          error: 'Invalid artifact ID format',
        });
      }

      const result = await pool.query('SELECT * FROM artifacts WHERE artifact_id = $1', [
        artifactId,
      ]);

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Artifact not found' });
      }

      const artifact = result.rows[0];
      res.setHeader('Content-Type', 'application/octet-stream');
      res.send(artifact.bytes);
    } catch (error: any) {
      console.error('Error getting artifact:', error);
      res.status(500).json({
        error: 'Failed to get artifact',
        message: error.message,
      });
    }
  });

  /**
   * POST /api/v1/decisions
   * Create a decision record
   */
  router.post('/decisions', async (req: Request, res: Response) => {
    try {
      const { tenant_id, decision, rationale, constraints, alternatives, consequences, refs, scope } =
        req.body;

      if (!tenant_id || !decision) {
        return res.status(400).json({
          error: 'Missing required fields: tenant_id, decision',
        });
      }

      // Validate scope
      if (scope && !['project', 'user', 'global'].includes(scope)) {
        return res.status(400).json({
          error: 'Invalid scope',
          allowed: ['project', 'user', 'global'],
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
          'active',
          scope || 'project',
          decision,
          rationale || [],
          constraints || [],
          alternatives || [],
          consequences || [],
          refs || [],
        ]
      );

      res.status(201).json({ decision_id });
    } catch (error: any) {
      console.error('Error creating decision:', error);
      res.status(500).json({
        error: 'Failed to create decision',
        message: error.message,
      });
    }
  });

  /**
   * GET /api/v1/decisions
   * Query decisions by tenant
   */
  router.get('/decisions', async (req: Request, res: Response) => {
    try {
      const { tenant_id, status = 'active' } = req.query;

      if (!tenant_id) {
        return res.status(400).json({
          error: 'Missing required parameter: tenant_id',
        });
      }

      // Validate status
      if (!['active', 'superseded'].includes(status as string)) {
        return res.status(400).json({
          error: 'Invalid status',
          allowed: ['active', 'superseded'],
        });
      }

      const result = await pool.query(
        `SELECT * FROM decisions
         WHERE tenant_id = $1 AND status = $2
         ORDER BY ts DESC`,
        [tenant_id, status]
      );

      res.json(result.rows);
    } catch (error: any) {
      console.error('Error getting decisions:', error);
      res.status(500).json({
        error: 'Failed to get decisions',
        message: error.message,
      });
    }
  });

  /**
   * GET /health
   * Health check endpoint
   */
  router.get('/health', async (req: Request, res: Response) => {
    try {
      await pool.query('SELECT 1');
      res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      res.status(503).json({ status: 'unhealthy' });
    }
  });

  /**
   * GET /metrics
   * Get metrics in Prometheus format
   */
  router.get('/metrics', (req: Request, res: Response) => {
    res.set('Content-Type', 'text/plain');
    res.send(metricsService.getPrometheusMetrics());
  });

  /**
   * GET /metrics/json
   * Get metrics as JSON
   */
  router.get('/metrics/json', (req: Request, res: Response) => {
    res.json(metricsService.getSnapshot());
  });

  return router;
}
