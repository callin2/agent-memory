/**
 * Health Check Routes
 *
 * Provides health check endpoint for Admin Server monitoring.
 */

import express from 'express';

const router = express.Router();

/**
 * GET /health
 *
 * Health check endpoint that returns server status.
 * Used by load balancers and monitoring systems.
 */
router.get('/health', (_req, res) => {
  res.json({
    status: 'healthy',
    service: 'admin-server',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  });
});

export { router as healthRoutes };
