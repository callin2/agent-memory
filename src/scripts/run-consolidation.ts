#!/usr/bin/env node

/**
 * Consolidation Runner Script
 *
 * Called by PM2 to run consolidation jobs
 * Usage: node dist/scripts/run-consolidation.js
 *
 * Environment variables:
 *   CONSOLIDATION_TYPE: daily|weekly|monthly
 */

import { Pool } from 'pg';
import { ConsolidationScheduler } from '../services/consolidation/scheduler.js';
import { createLLMClient } from '../services/llm-client.js';

async function main() {
  const consolidationType = process.env.CONSOLIDATION_TYPE || 'daily';

  console.log(`[Consolidation] Starting ${consolidationType} consolidation...`);
  console.log(`[Consolidation] Started at: ${new Date().toISOString()}`);

  // Create database connection
  const pool = new Pool({
    host: process.env.PGHOST || 'localhost',
    port: parseInt(process.env.PGPORT || '5432'),
    user: process.env.PGUSER || 'postgres',
    password: process.env.PGPASSWORD || 'postgres',
    database: process.env.PGDATABASE || 'agent_memory_dev',
  });

  try {
    // Create LLM client
    const llmClient = createLLMClient();

    // Create consolidation scheduler
    const scheduler = new ConsolidationScheduler(pool, {
      enabled: true,
      llmClient
    });

    // Run consolidation
    const startTime = Date.now();
    await scheduler.triggerConsolidation(consolidationType as any);
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    console.log(`[Consolidation] ✅ ${consolidationType} consolidation complete in ${duration}s`);

    // Close database connection
    await pool.end();

    // Exit successfully (PM2 will not restart since autorestart: false)
    process.exit(0);

  } catch (error) {
    console.error(`[Consolidation] ❌ ${consolidationType} consolidation failed:`, error);
    await pool.end();
    process.exit(1);
  }
}

// Run consolidation
main();
