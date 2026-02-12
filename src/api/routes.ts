import { Router, Request, Response } from 'express';
import { Pool } from 'pg';
import { recordEvent } from '../core/recorder.js';
import { buildACB } from '../core/orchestrator.js';
import { metricsService } from '../utils/metrics.js';
import { createMemoryRoutes } from './memory-routes.js';

export function createRoutes(pool: Pool): Router {
  const router = Router();

  // Mount memory routes (capsules, edits)
  const memoryRoutes = createMemoryRoutes(pool);
  router.use('/api/v1', memoryRoutes);

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
  router.post('/events', async (req: Request, res: Response) => {
    try {
      const result = await recordEvent(pool, req.body);
      res.status(201).json(result);
    } catch (error: any) {
      console.error('Error recording event:', error);
      res.status(500).json({
        error: 'Failed to record event',
        message: error.message,
      });
    }
  });

  /**
   * GET /api/v1/events/:event_id
   * Get a specific event by ID
   */
  router.get('/events/:event_id', async (req: Request, res: Response) => {
    try {
      const result = await pool.query(
        'SELECT * FROM events WHERE event_id = $1',
        [req.params.event_id]
      );

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

      const result = await pool.query(
        `SELECT * FROM events
         WHERE tenant_id = $1 AND session_id = $2
         ORDER BY ts DESC
         LIMIT $3`,
        [tenant_id, session_id, Number(limit)]
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
  router.post('/acb/build', async (req: Request, res: Response) => {
    try {
      const acb = await buildACB(pool, req.body);
      res.json(acb);
    } catch (error: any) {
      console.error('Error building ACB:', error);
      res.status(500).json({
        error: 'Failed to build ACB',
        message: error.message,
      });
    }
  });

  /**
   * GET /api/v1/chunks/:chunk_id
   * Get a specific chunk by ID
   */
  router.get('/chunks/:chunk_id', async (req: Request, res: Response) => {
    try {
      const result = await pool.query(
        'SELECT * FROM chunks WHERE chunk_id = $1',
        [req.params.chunk_id]
      );

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
      const result = await pool.query(
        'SELECT * FROM artifacts WHERE artifact_id = $1',
        [req.params.artifact_id]
      );

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
      const {
        tenant_id,
        decision,
        rationale = [],
        constraints = [],
        alternatives = [],
        consequences = [],
        refs = [],
        scope = 'project',
      } = req.body;

      const decision_id = `dec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      await pool.query(
        `INSERT INTO decisions (decision_id, tenant_id, status, scope, decision,
                                rationale, constraints, alternatives, consequences, refs)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          decision_id,
          tenant_id,
          'active',
          scope,
          decision,
          rationale,
          constraints,
          alternatives,
          consequences,
          refs,
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
   * GET /api/v1/health
   * Health check endpoint
   */
  router.get('/api/v1/health', async (req: Request, res: Response) => {
    try {
      await pool.query('SELECT 1');
      res.json({ status: 'healthy', timestamp: new Date().toISOString() });
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

  // ===== Enhanced Memory Query Endpoints =====

  /**
   * POST /api/v1/chunks/search
   * Full-text search with scope+subject+edit awareness
   */
  router.post('/chunks/search', async (req: Request, res: Response) => {
    try {
      const {
        tenant_id,
        query,
        scope,
        subject_type,
        subject_id,
        project_id,
        include_quarantined = false,
        channel,
        limit = 50,
      } = req.body;

      if (!tenant_id || !query) {
        return res.status(400).json({
          error: 'Missing required parameters: tenant_id, query',
        });
      }

      const result = await pool.query(
        `SELECT * FROM search_chunks(
          $1::text, $2::text, $3::text, $4::text, $5::text, $6::text, $7::boolean, $8::text, $9::int
        )`,
        [
          tenant_id,
          query,
          scope || null,
          subject_type || null,
          subject_id || null,
          project_id || null,
          include_quarantined,
          channel || null,
          limit,
        ]
      );

      res.json({
        chunks: result.rows,
        total_count: result.rows.length,
      });
    } catch (error: any) {
      console.error('Error searching chunks:', error);
      res.status(500).json({
        error: 'Failed to search chunks',
        message: error.message,
      });
    }
  });

  /**
   * GET /api/v1/chunks/:chunk_id/timeline
   * Get time-bounded chunks around a chunk
   */
  router.get('/chunks/:chunk_id/timeline', async (req: Request, res: Response) => {
    try {
      const { tenant_id, window_seconds = 3600, include_quarantined = false } = req.query;

      if (!tenant_id) {
        return res.status(400).json({
          error: 'Missing required parameter: tenant_id',
        });
      }

      const result = await pool.query(
        `SELECT * FROM get_timeline(
          $1::text, $2::text, $3::int, $4::boolean
        )`,
        [
          tenant_id,
          req.params.chunk_id,
          Number(window_seconds),
          include_quarantined === 'true',
        ]
      );

      // Get center chunk timestamp
      const centerResult = await pool.query(
        'SELECT ts FROM chunks WHERE chunk_id = $1',
        [req.params.chunk_id]
      );

      if (centerResult.rows.length === 0) {
        return res.status(404).json({ error: 'Center chunk not found' });
      }

      res.json({
        around_chunk_id: req.params.chunk_id,
        center_ts: centerResult.rows[0].ts,
        window_seconds: Number(window_seconds),
        chunks: result.rows,
      });
    } catch (error: any) {
      console.error('Error getting timeline:', error);
      res.status(500).json({
        error: 'Failed to get timeline',
        message: error.message,
      });
    }
  });

  /**
   * POST /api/v1/chunks/get
   * Get chunks with edits applied and channel blocking
   */
  router.post('/chunks/get', async (req: Request, res: Response) => {
    try {
      const { chunk_ids, include_quarantined = false, channel } = req.body;

      if (!chunk_ids || !Array.isArray(chunk_ids)) {
        return res.status(400).json({
          error: 'Missing or invalid parameter: chunk_ids (array required)',
        });
      }

      const result = await pool.query(
        `SELECT * FROM effective_chunks
         WHERE chunk_id = ANY($1)
           AND ($2::boolean OR NOT is_quarantined)
           AND ($3::text IS NULL OR NOT $3 = ANY(blocked_channels))
           AND NOT is_retracted`,
        [chunk_ids, include_quarantined, channel || null]
      );

      res.json({
        chunks: result.rows.map(row => ({
          chunk_id: row.chunk_id,
          text: row.text,
          importance: row.importance,
          is_retracted: row.is_retracted,
          is_quarantined: row.is_quarantined,
          blocked_channels: row.blocked_channels,
          edits_applied: row.edits_applied_count,
        })),
      });
    } catch (error: any) {
      console.error('Error getting chunks:', error);
      res.status(500).json({
        error: 'Failed to get chunks',
        message: error.message,
      });
    }
  });

  return router;
}
