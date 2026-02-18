#!/usr/bin/env node

/**
 * Embedding Generator Script
 *
 * Called by PM2 to generate embeddings for handoffs
 * Runs every hour to process new handoffs
 *
 * Environment variables:
 *   BATCH_SIZE: Number of handoffs to process (default: 20)
 */

import { Pool } from 'pg';
import { EmbeddingService } from '../services/embedding-service.js';
import { createLLMClient } from '../services/llm-client.js';

async function main() {
  const batchSize = parseInt(process.env.BATCH_SIZE || '20');
  const tenantId = process.env.TENANT_ID || 'default';

  console.log(`[Embedding] Starting batch processing...`);
  console.log(`[Embedding] Tenant: ${tenantId}, Batch size: ${batchSize}`);
  console.log(`[Embedding] Started at: ${new Date().toISOString()}`);

  // Create database connection
  const pool = new Pool({
    host: process.env.PGHOST || 'localhost',
    port: parseInt(process.env.PGPORT || '5432'),
    user: process.env.PGUSER || 'postgres',
    password: process.env.PGPASSWORD || 'postgres',
    database: process.env.PGDATABASE || 'agent_memory_dev',
  });

  try {
    // Create LLM client (for potential future use)
    const llmClient = createLLMClient();

    // Create embedding service
    const embeddingService = new EmbeddingService(pool, llmClient);

    // Generate embeddings for handoffs
    const results = await embeddingService.generateEmbeddingsForHandoffs(
      tenantId,
      batchSize
    );

    const successCount = results.filter(r => r.embedding_generated).length;
    const failCount = results.filter(r => !r.embedding_generated).length;

    console.log(`[Embedding] ✅ Batch complete: ${successCount} succeeded, ${failCount} failed`);

    // Get progress stats
    const progress = await embeddingService.getProgress(tenantId);
    console.log(`[Embedding] Progress: ${progress.withEmbeddings}/${progress.total} (${progress.progressPercent.toFixed(1)}%)`);

    // Close database connection
    await pool.end();

    // PM2 will restart this process (cron_restart: '0 * * * *')
    process.exit(0);

  } catch (error) {
    console.error(`[Embedding] ❌ Batch processing failed:`, error);
    await pool.end();
    process.exit(1);
  }
}

// Run embedding generation
main();
