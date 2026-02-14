/**
 * Test Harness Metrics Routes
 * Provides endpoints for tracking retrieval quality, performance metrics, and test runs
 */

import { Router, Request, Response } from 'express';
import { Pool } from 'pg';

export interface TestRunSnapshot {
  run_id: string;
  timestamp: Date;
  total_tests: number;
  passed_tests: number;
  failed_tests: number;
  skipped_tests: number;
  avg_precision: number;
  avg_recall: number;
  avg_f1: number;
  avg_latency_ms: number;
  p50_latency_ms: number;
  p95_latency_ms: number;
  p99_latency_ms: number;
  total_tokens: number;
  avg_tokens_per_query: number;
}

export interface ValidationFeedback {
  feedback_id: string;
  test_run_id: string;
  query_id: string;
  helpful: boolean;
  comments?: string;
  timestamp: Date;
}

export interface MetricsAggregation {
  time_range: string;
  total_tests: number;
  avg_precision: number;
  avg_recall: number;
  avg_f1: number;
  avg_latency_ms: number;
  p50_latency_ms: number;
  p95_latency_ms: number;
  p99_latency_ms: number;
  total_tokens: number;
  avg_tokens_per_query: number;
  coverage_percentage: number;
  thumbs_up_percentage: number;
  thumbs_down_percentage: number;
}

// In-memory storage for demo (in production, use database)
const testRuns = new Map<string, TestRunSnapshot>();
const feedbacks = new Map<string, ValidationFeedback[]>();

export function createTestHarnessRoutes(pool: Pool): Router {
  const router = Router();

  /**
   * POST /api/v1/test-harness/test-runs
   * Create a new test run snapshot
   */
  router.post('/test-runs', async (req: Request, res: Response) => {
    try {
      const snapshot: TestRunSnapshot = {
        run_id: `run_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        timestamp: new Date(),
        ...req.body,
      };

      // Store test run
      testRuns.set(snapshot.run_id, snapshot);

      // Initialize feedback array for this run
      feedbacks.set(snapshot.run_id, []);

      // Store in database for persistence
      await pool.query(
        `INSERT INTO test_runs (
          run_id, timestamp, total_tests, passed_tests, failed_tests, skipped_tests,
          avg_precision, avg_recall, avg_f1,
          avg_latency_ms, p50_latency_ms, p95_latency_ms, p99_latency_ms,
          total_tokens, avg_tokens_per_query
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
        [
          snapshot.run_id,
          snapshot.timestamp,
          snapshot.total_tests,
          snapshot.passed_tests,
          snapshot.failed_tests,
          snapshot.skipped_tests,
          snapshot.avg_precision,
          snapshot.avg_recall,
          snapshot.avg_f1,
          snapshot.avg_latency_ms,
          snapshot.p50_latency_ms,
          snapshot.p95_latency_ms,
          snapshot.p99_latency_ms,
          snapshot.total_tokens,
          snapshot.avg_tokens_per_query,
        ]
      );

      res.status(201).json(snapshot);
    } catch (error: any) {
      console.error('Error creating test run:', error);
      res.status(500).json({
        error: 'Failed to create test run',
        message: error.message,
      });
    }
  });

  /**
   * GET /api/v1/test-harness/test-runs
   * List test runs with optional filtering
   */
  router.get('/test-runs', async (req: Request, res: Response) => {
    try {
      const { limit = 50, offset = 0, sort = 'timestamp' } = req.query;

      const result = await pool.query(
        `SELECT * FROM test_runs
         ORDER BY ${sort === 'timestamp' ? 'timestamp' : 'avg_f1'} DESC
         LIMIT $1 OFFSET $2`,
        [Number(limit), Number(offset)]
      );

      res.json({
        test_runs: result.rows,
        total_count: result.rows.length,
      });
    } catch (error: any) {
      console.error('Error getting test runs:', error);
      res.status(500).json({
        error: 'Failed to get test runs',
        message: error.message,
      });
    }
  });

  /**
   * GET /api/v1/test-harness/test-runs/:run_id
   * Get specific test run details
   */
  router.get('/test-runs/:run_id', async (req: Request, res: Response) => {
    try {
      const result = await pool.query(
        'SELECT * FROM test_runs WHERE run_id = $1',
        [req.params.run_id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Test run not found' });
      }

      const testRun = result.rows[0];

      // Get feedback for this run
      const feedbackResult = await pool.query(
        'SELECT * FROM validation_feedback WHERE test_run_id = $1',
        [req.params.run_id]
      );

      return res.json({
        ...testRun,
        feedback: feedbackResult.rows,
      });
    } catch (error: any) {
      console.error('Error getting test run:', error);
      return res.status(500).json({
        error: 'Failed to get test run',
        message: error.message,
      });
    }
  });

  /**
   * POST /api/v1/test-harness/feedback
   * Store validation feedback
   */
  router.post('/feedback', async (req: Request, res: Response) => {
    try {
      const { test_run_id, query_id, helpful, comments } = req.body;

      const feedback: ValidationFeedback = {
        feedback_id: `fb_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        test_run_id,
        query_id,
        helpful,
        comments,
        timestamp: new Date(),
      };

      // Store in database
      await pool.query(
        `INSERT INTO validation_feedback (
          feedback_id, test_run_id, query_id, helpful, comments, timestamp
        ) VALUES ($1, $2, $3, $4, $5, $6)`,
        [feedback.feedback_id, feedback.test_run_id, feedback.query_id, feedback.helpful, feedback.comments, feedback.timestamp]
      );

      // Store in memory
      const runFeedbacks = feedbacks.get(test_run_id) || [];
      runFeedbacks.push(feedback);
      feedbacks.set(test_run_id, runFeedbacks);

      res.status(201).json(feedback);
    } catch (error: any) {
      console.error('Error storing feedback:', error);
      res.status(500).json({
        error: 'Failed to store feedback',
        message: error.message,
      });
    }
  });

  /**
   * GET /api/v1/test-harness/metrics
   * Get aggregated metrics with time range filtering
   */
  router.get('/metrics', async (req: Request, res: Response) => {
    try {
      const { time_range = '24h' } = req.query;

      // Calculate timestamp based on time_range
      const now = new Date();
      let startTime = new Date();

      switch (time_range) {
        case '1h':
          startTime = new Date(now.getTime() - 60 * 60 * 1000);
          break;
        case '24h':
          startTime = new Date(now.getTime() - 24 * 60 * 60 * 1000);
          break;
        case '7d':
          startTime = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case '30d':
          startTime = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
      }

      const result = await pool.query(
        `SELECT
          COUNT(*) as total_tests,
          AVG(avg_precision) as avg_precision,
          AVG(avg_recall) as avg_recall,
          AVG(avg_f1) as avg_f1,
          AVG(avg_latency_ms) as avg_latency_ms,
          AVG(p50_latency_ms) as p50_latency_ms,
          AVG(p95_latency_ms) as p95_latency_ms,
          AVG(p99_latency_ms) as p99_latency_ms,
          SUM(total_tokens) as total_tokens,
          AVG(avg_tokens_per_query) as avg_tokens_per_query,
          SUM(passed_tests) * 100.0 / NULLIF(SUM(total_tests), 0) as coverage_percentage
         FROM test_runs
         WHERE timestamp >= $1`,
        [startTime]
      );

      // Get feedback stats
      const feedbackResult = await pool.query(
        `SELECT
          COUNT(*) FILTER (WHERE helpful = true) * 100.0 / NULLIF(COUNT(*), 0) as thumbs_up_percentage,
          COUNT(*) FILTER (WHERE helpful = false) * 100.0 / NULLIF(COUNT(*), 0) as thumbs_down_percentage
         FROM validation_feedback
         WHERE timestamp >= $1`,
        [startTime]
      );

      const metrics: MetricsAggregation = {
        time_range: String(time_range),
        total_tests: Number(result.rows[0].total_tests) || 0,
        avg_precision: Number(result.rows[0].avg_precision) || 0,
        avg_recall: Number(result.rows[0].avg_recall) || 0,
        avg_f1: Number(result.rows[0].avg_f1) || 0,
        avg_latency_ms: Number(result.rows[0].avg_latency_ms) || 0,
        p50_latency_ms: Number(result.rows[0].p50_latency_ms) || 0,
        p95_latency_ms: Number(result.rows[0].p95_latency_ms) || 0,
        p99_latency_ms: Number(result.rows[0].p99_latency_ms) || 0,
        total_tokens: Number(result.rows[0].total_tokens) || 0,
        avg_tokens_per_query: Number(result.rows[0].avg_tokens_per_query) || 0,
        coverage_percentage: Number(result.rows[0].coverage_percentage) || 0,
        thumbs_up_percentage: Number(feedbackResult.rows[0]?.thumbs_up_percentage) || 0,
        thumbs_down_percentage: Number(feedbackResult.rows[0]?.thumbs_down_percentage) || 0,
      };

      res.json(metrics);
    } catch (error: any) {
      console.error('Error getting metrics:', error);
      res.status(500).json({
        error: 'Failed to get metrics',
        message: error.message,
      });
    }
  });

  /**
   * GET /api/v1/test-harness/metrics/history
   * Get metrics history for trend charts
   */
  router.get('/metrics/history', async (req: Request, res: Response) => {
    try {
      const { time_range = '24h', metric = 'f1' } = req.query;

      const now = new Date();
      let startTime = new Date();
      let interval = "1 hour";

      switch (String(time_range)) {
        case '1h':
          startTime = new Date(now.getTime() - 60 * 60 * 1000);
          interval = "5 minutes";
          break;
        case '24h':
          startTime = new Date(now.getTime() - 24 * 60 * 60 * 1000);
          interval = "1 hour";
          break;
        case '7d':
          startTime = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          interval = "1 day";
          break;
        case '30d':
          startTime = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          interval = "1 day";
          break;
      }

      const metricColumn = {
        precision: 'avg_precision',
        recall: 'avg_recall',
        f1: 'avg_f1',
        latency: 'avg_latency_ms',
      }[String(metric)] || 'avg_f1';

      const result = await pool.query(
        `SELECT
          date_trunc($2, timestamp) as time_bucket,
          AVG(${metricColumn}) as value,
          COUNT(*) as test_count
         FROM test_runs
         WHERE timestamp >= $1
         GROUP BY time_bucket
         ORDER BY time_bucket ASC`,
        [startTime, interval]
      );

      res.json({
        metric: String(metric),
        time_range: String(time_range),
        data_points: result.rows.map(row => ({
          timestamp: row.time_bucket,
          value: Number(row.value),
          test_count: Number(row.test_count),
        })),
      });
    } catch (error: any) {
      console.error('Error getting metrics history:', error);
      res.status(500).json({
        error: 'Failed to get metrics history',
        message: error.message,
      });
    }
  });

  return router;
}
