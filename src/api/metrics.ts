/**
 * Metrics and Health API
 *
 * Provides visibility into system health and memory usage
 * for both humans and AI agents to monitor the system.
 */

import { Router } from 'express';
import { Pool } from 'pg';
import { HealthMonitor } from '../services/health-monitor.js';
import { PrometheusMetrics } from './prometheus.js';

export function createMetricsRoutes(pool: Pool): Router {
  const router = Router();

  // Initialize Prometheus metrics
  const prometheus = new PrometheusMetrics(pool);

  /**
   * GET /metrics
   *
   * Returns system metrics including:
   * - Total events captured
   * - Total handoffs created
   * - Memory usage by tenant
   * - Recent activity
   */
  router.get('/metrics', async (req, res) => {
    try {
      const tenant_id = req.query.tenant_id || 'default';

      // Get event counts by kind
      const eventStats = await pool.query(
        `SELECT kind, COUNT(*) as count
         FROM chunks
         WHERE tenant_id = $1
         GROUP BY kind
         ORDER BY count DESC`,
        [tenant_id]
      );

      // Get handoff stats
      const handoffStats = await pool.query(
        `SELECT
           COUNT(*) as total,
           COUNT(CASE WHEN compression_level = 'full' THEN 1 END) as full_count,
           COUNT(CASE WHEN compression_level = 'summary' THEN 1 END) as summary_count,
           COUNT(CASE WHEN compression_level = 'quick_ref' THEN 1 END) as quick_ref_count
         FROM session_handoffs
         WHERE tenant_id = $1`,
        [tenant_id]
      );

      // Get decision stats
      const decisionStats = await pool.query(
        `SELECT
           COUNT(*) as total,
           COUNT(CASE WHEN status = 'active' THEN 1 END) as active,
           COUNT(CASE WHEN status = 'superseded' THEN 1 END) as superseded
         FROM decisions
         WHERE tenant_id = $1`,
        [tenant_id]
      );

      // Get recent activity (last 24 hours)
      const recentActivity = await pool.query(
        `SELECT COUNT(*) as count
         FROM chunks
         WHERE tenant_id = $1
           AND ts > NOW() - INTERVAL '24 hours'`,
        [tenant_id]
      );

      // Get storage estimates
      const storageStats = await pool.query(
        `SELECT
           SUM(LENGTH(text)) as total_text_bytes,
           COUNT(*) as total_chunks
         FROM chunks
         WHERE tenant_id = $1`,
        [tenant_id]
      );

      const metrics = {
        tenant_id,
        timestamp: new Date().toISOString(),
        events: {
          by_kind: eventStats.rows,
          recent_24h: parseInt(recentActivity.rows[0].count),
        },
        handoffs: handoffStats.rows[0] || {
          total: 0,
          full_count: 0,
          summary_count: 0,
          quick_ref_count: 0,
        },
        decisions: decisionStats.rows[0] || {
          total: 0,
          active: 0,
          superseded: 0,
        },
        storage: {
          total_text_bytes: parseInt(storageStats.rows[0].total_text_bytes) || 0,
          total_chunks: parseInt(storageStats.rows[0].total_chunks) || 0,
          avg_chunk_size_bytes:
            (parseInt(storageStats.rows[0].total_text_bytes) || 0) /
            (parseInt(storageStats.rows[0].total_chunks) || 1) || 0,
        },
      };

      res.json(metrics);
    } catch (error) {
      console.error('[Metrics] Error fetching metrics:', error);
      res.status(500).json({
        error: 'Failed to fetch metrics',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  /**
   * GET /health (when mounted at /health) or GET / (when mounted at root)
   *
   * Simple health check endpoint
   */
  router.get('/', async (_req, res) => {
    try {
      // Basic database connectivity check
      await pool.query('SELECT 1');

      res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
      });
    } catch (error) {
      res.status(503).json({
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  // Also support /health for backward compatibility when mounted at /metrics
  router.get('/health', async (_req, res) => {
    try {
      // Basic database connectivity check
      await pool.query('SELECT 1');

      res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
      });
    } catch (error) {
      res.status(503).json({
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  /**
   * GET /health/detailed
   *
   * Comprehensive health check with detailed diagnostics
   */
  router.get('/health/detailed', async (req, res) => {
    try {
      const tenant_id = req.query.tenant_id as string || undefined;
      const monitor = new HealthMonitor(pool);

      const health = await monitor.checkHealth(tenant_id);

      // Return appropriate HTTP status based on health
      const statusCode = health.status === 'healthy' ? 200 : health.status === 'degraded' ? 200 : 503;

      res.status(statusCode).json(health);
    } catch (error) {
      console.error('[Health] Error during health check:', error);
      res.status(503).json({
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  /**
   * GET /metrics/consolidation
   *
   * Get consolidation statistics
   */
  router.get('/metrics/consolidation', async (req, res) => {
    try {
      const tenant_id = req.query.tenant_id || 'default';

      const result = await pool.query(
        `SELECT
           job_type,
           COUNT(*) as jobs_run,
           SUM(items_affected) as total_items_affected,
           SUM(tokens_saved) as total_tokens_saved,
           MAX(created_at) as last_run
         FROM consolidation_jobs
         WHERE tenant_id = $1
         GROUP BY job_type
         ORDER BY job_type`,
        [tenant_id]
      );

      res.json({
        tenant_id,
        consolidation_stats: result.rows,
      });
    } catch (error) {
      console.error('[Metrics] Error fetching consolidation stats:', error);
      res.status(500).json({
        error: 'Failed to fetch consolidation stats',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  /**
   * GET /metrics/detailed
   *
   * Get detailed system metrics for monitoring
   */
  router.get('/metrics/detailed', async (req, res) => {
    try {
      const tenant_id = req.query.tenant_id as string || undefined;
      const monitor = new HealthMonitor(pool);

      const metrics = await monitor.getMetrics(tenant_id);

      res.json(metrics);
    } catch (error) {
      console.error('[Metrics] Error fetching detailed metrics:', error);
      res.status(500).json({
        error: 'Failed to fetch detailed metrics',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  /**
   * GET /metrics/prometheus
   *
   * Prometheus metrics endpoint for scraping
   * Returns metrics in Prometheus text exposition format
   */
  router.get('/metrics/prometheus', async (_req, res) => {
    try {
      const metrics = await prometheus.scrape();

      res.set('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
      res.send(metrics);
    } catch (error) {
      console.error('[Prometheus] Error scraping metrics:', error);
      res.status(500).set('Content-Type', 'text/plain').send(
        '# Error scraping metrics\n' +
        `# ${error instanceof Error ? error.message : String(error)}\n`
      );
    }
  });

  return router;
}
