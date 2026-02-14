/**
 * Admin Server - Main Entry Point
 *
 * Admin Server for Agent Memory System.
 * Handles system monitoring.
 *
 * Port: 3001 (configurable via ADMIN_PORT env var)
 */

import express from 'express';
import dotenv from 'dotenv';
import { createDatabasePool } from './config/database.js';
import { errorHandler, requestLogger } from './middleware/index.js';
import { healthRoutes } from './routes/index.js';

// Load environment variables
dotenv.config();

const app: express.Express = express();
const PORT = process.env.ADMIN_PORT || 3001;

// Middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(requestLogger);

// Create PostgreSQL connection pool
const pool = createDatabasePool();

// Attach pool to request for use in routes
app.use((req, _res, next) => {
  (req as any).db = pool;
  next();
});

// Health check routes
app.use('/', healthRoutes);

// Root endpoint with server information
app.get('/', (_req, res) => {
  res.json({
    name: 'Admin Server',
    version: '1.0.0',
    status: 'running',
    port: PORT,
    environment: process.env.NODE_ENV || 'development',
    endpoints: {
      root: 'GET /',
      health: 'GET /health',
    },
  });
});

// Error handling middleware (must be last)
app.use(errorHandler);

// Graceful shutdown
const shutdown = async () => {
  console.log('Admin Server: Shutting down gracefully...');

  try {
    await pool.end();
    console.log('Admin Server: PostgreSQL pool closed');
  } catch (err) {
    console.error('Admin Server: Error closing pool:', err);
  }

  process.exit(0);
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

// Start HTTP server
const server = app.listen(PORT, () => {
  console.log(`Admin Server v1.0.0 running on port ${PORT}`);
  console.log(`Database: ${process.env.PGDATABASE || 'agent_memory'}@${process.env.PGHOST || 'localhost'}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`\nEndpoints:`);
  console.log(`  Health:   http://localhost:${PORT}/health`);
  console.log(`  Root:     http://localhost:${PORT}/`);
});

// Handle server errors
server.on('error', (err: any) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`Admin Server: Port ${PORT} is already in use`);
  } else {
    console.error('Admin Server: Error:', err);
  }
  process.exit(1);
});

export { app, pool };
