/**
 * PM2 Ecosystem Configuration
 *
 * Process manager for Thread's Memory System v2.0
 *
 * Usage:
 *   pm2 start ecosystem.config.js
 *   pm2 logs
 *   pm2 monit
 *   pm2 stop all
 *   pm2 delete all
 *   pm2 restart all
 */

module.exports = {
  apps: [
    // ========================================================================
    // Main API Server
    // ========================================================================
    {
      name: 'thread-memory-api',
      script: './dist/server.js',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'production',
        PORT: 3456,
      },
      error_file: './logs/pm2-error.log',
      out_file: './logs/pm2-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
    },

    // ========================================================================
    // Consolidation Worker - Daily (2 AM UTC)
    // ========================================================================
    {
      name: 'consolidation-daily',
      script: './dist/scripts/run-consolidation.js',
      instances: 1,
      exec_mode: 'fork',
      autorestart: false, // Run once per day, don't restart
      cron_restart: '0 2 * * *', // 2:00 AM every day
      env: {
        NODE_ENV: 'production',
        CONSOLIDATION_TYPE: 'daily',
      },
      error_file: './logs/consolidation-daily-error.log',
      out_file: './logs/consolidation-daily-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    },

    // ========================================================================
    // Consolidation Worker - Weekly (Sunday 3 AM UTC)
    // ========================================================================
    {
      name: 'consolidation-weekly',
      script: './dist/scripts/run-consolidation.js',
      instances: 1,
      exec_mode: 'fork',
      autorestart: false, // Run once per week
      cron_restart: '0 3 * * 0', // 3:00 AM every Sunday
      env: {
        NODE_ENV: 'production',
        CONSOLIDATION_TYPE: 'weekly',
      },
      error_file: './logs/consolidation-weekly-error.log',
      out_file: './logs/consolidation-weekly-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    },

    // ========================================================================
    // Consolidation Worker - Monthly (1st of month 4 AM UTC)
    // ========================================================================
    {
      name: 'consolidation-monthly',
      script: './dist/scripts/run-consolidation.js',
      instances: 1,
      exec_mode: 'fork',
      autorestart: false, // Run once per month
      cron_restart: '0 4 1 * *', // 4:00 AM on 1st of month
      env: {
        NODE_ENV: 'production',
        CONSOLIDATION_TYPE: 'monthly',
      },
      error_file: './logs/consolidation-monthly-error.log',
      out_file: './logs/consolidation-monthly-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    },

    // ========================================================================
    // Embedding Generation Worker (Every hour, batch processing)
    // ========================================================================
    {
      name: 'embedding-generator',
      script: './dist/scripts/run-embeddings.js',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      cron_restart: '0 * * * *', // Every hour at :00
      env: {
        NODE_ENV: 'production',
        BATCH_SIZE: '20',
      },
      error_file: './logs/embedding-error.log',
      out_file: './logs/embedding-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    },

    // ========================================================================
    // MCP Server - Memory System (HTTP/SSE transport)
    // ========================================================================
    {
      name: 'memory-mcp-server',
      script: './node_modules/.bin/tsx',
      args: 'src/mcp/memory-server.ts',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '200M',
      env: {
        NODE_ENV: 'production',
        PORT: '4000',
        PGHOST: 'localhost',
        PGPORT: '5432',
        PGDATABASE: 'agent_memory',
        PGUSER: 'agent_mem_dba',
        PGPASSWORD: 'adminqwer1234',
      },
      error_file: './logs/mcp-error.log',
      out_file: './logs/mcp-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
    },
  ],
};
