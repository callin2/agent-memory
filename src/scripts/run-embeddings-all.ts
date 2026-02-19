#!/usr/bin/env node

/**
 * Embedding Generator Script for All Memory Types
 *
 * Generates embeddings for:
 * - agent_feedback
 * - knowledge_notes
 * - capsules
 *
 * Environment variables:
 *   BATCH_SIZE: Number of records to process per type (default: 20)
 *   TENANT_ID: Tenant ID to process (default: 'default')
 */

import { Pool } from 'pg';
import { EmbeddingService } from '../services/embedding-service.js';
import { createLLMClient } from '../services/llm-client.js';

async function main() {
  const batchSize = parseInt(process.env.BATCH_SIZE || '20');
  const tenantId = process.env.TENANT_ID || 'default';

  console.log(`[Embedding] Starting batch processing for all memory types...`);
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
    // Create embedding service
    const embeddingService = new EmbeddingService(pool, null);

    // Get initial progress
    console.log(`\n[Embedding] Initial progress:`);
    const initialProgress = await embeddingService.getProgressAll(tenantId);
    console.log(JSON.stringify(initialProgress, null, 2));

    // Generate embeddings for all types
    const results = await embeddingService.processAllForTenantAllTypes(tenantId);

    // Get final progress
    console.log(`\n[Embedding] Final progress:`);
    const finalProgress = await embeddingService.getProgressAll(tenantId);
    console.log(JSON.stringify(finalProgress, null, 2));

    console.log(`\n[Embedding] ✅ Batch complete:`);
    console.log(`  - Agent Feedback: ${results.agent_feedback} generated`);
    console.log(`  - Knowledge Notes: ${results.knowledge_notes} generated`);
    console.log(`  - Capsules: ${results.capsules} generated`);
    console.log(`  - Total: ${results.total} generated`);

    // Close database connection
    await pool.end();

    process.exit(0);

  } catch (error) {
    console.error(`[Embedding] ❌ Batch processing failed:`, error);
    await pool.end();
    process.exit(1);
  }
}

// Run embedding generation
main();
