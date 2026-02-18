#!/usr/bin/env node

/**
 * Migration Runner
 *
 * Run pending database migrations
 * Usage: node run-migrations.mjs
 */

import { Pool } from 'pg';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Database connection
const pool = new Pool({
  host: process.env.PGHOST || 'localhost',
  port: parseInt(process.env.PGPORT || '5432'),
  user: process.env.PGUSER || 'postgres',
  password: process.env.PGPASSWORD || 'postgres',
  database: process.env.PGDATABASE || 'threadsmemory',
});

/**
 * Run a single migration file
 */
async function runMigration(migrationFile) {
  const migrationPath = join(__dirname, 'src/db/migrations', migrationFile);
  console.log(`\n📄 Running migration: ${migrationFile}`);

  try {
    // Read migration SQL
    const sql = readFileSync(migrationPath, 'utf-8');

    // Start transaction
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Run migration
      await client.query(sql);

      await client.query('COMMIT');
      console.log(`✅ ${migrationFile} - SUCCESS`);

      return true;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error(`❌ ${migrationFile} - FAILED`);
    console.error(`   Error: ${error.message}`);
    return false;
  }
}

/**
 * Main migration runner
 */
async function main() {
  console.log('🚀 Starting migrations...\n');

  // Migrations to run
  const migrations = [
    '028_vector_embeddings.sql',
    '029_pii_protection.sql',
  ];

  let successCount = 0;
  let failCount = 0;

  for (const migration of migrations) {
    const success = await runMigration(migration);
    if (success) {
      successCount++;
    } else {
      failCount++;
    }
  }

  console.log(`\n${'='.repeat(50)}`);
  console.log(`✅ Successful: ${successCount}`);
  console.log(`❌ Failed: ${failCount}`);
  console.log(`${'='.repeat(50)}\n`);

  await pool.end();

  if (failCount > 0) {
    process.exit(1);
  }
}

main().catch(console.error);
