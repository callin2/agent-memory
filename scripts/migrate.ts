#!/usr/bin/env tsx

/**
 * Database Migration Helper
 *
 * Safe database migration and rollback tool for Thread's Memory System.
 *
 * Usage:
 *   npx tsx scripts/migrate.ts status       # Show migration status
 *   npx tsx scripts/migrate.ts up           # Run pending migrations
 *   npx tsx scripts/migrate.ts down [id]    # Rollback migration
 *   npx tsx scripts/migrate.ts create name  # Create new migration
 *   npx tsx scripts/migrate.ts backup       # Backup before migration
 *   npx tsx scripts/migrate.ts restore      # Restore from backup
 */

import { Pool, PoolConfig } from 'pg';
import { promises as fs } from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';

const MIGRATIONS_DIR = path.join(__dirname, '..', 'src', 'db', 'migrations');
const BACKUP_DIR = process.env.BACKUP_DIR || path.join(__dirname, '..', 'backups');

interface Migration {
  id: string;
  name: string;
  filename: string;
  applied_at?: Date;
}

// Parse migration ID from filename (e.g., "001_initial.sql" -> "001")
function parseMigrationId(filename: string): string {
  const match = filename.match(/^(\d+)_/);
  return match ? match[1] : filename;
}

// Get all migration files
async function getMigrationFiles(): Promise<string[]> {
  const files = await fs.readdir(MIGRATIONS_DIR);
  return files
    .filter(f => f.endsWith('.sql') && !f.startsWith('010_')) // Skip rollback
    .sort((a, b) => {
      const aNum = parseInt(a.split('_')[0]);
      const bNum = parseInt(b.split('_')[0]);
      return aNum - bNum;
    });
}

// Get applied migrations from database
async function getAppliedMigrations(pool: Pool): Promise<Set<string>> {
  try {
    const result = await pool.query(
      'SELECT migration_id FROM schema_migrations ORDER BY migration_id'
    );
    return new Set(result.rows.map((row: any) => row.migration_id));
  } catch (error) {
    // Table doesn't exist yet - no migrations applied
    return new Set();
  }
}

// Create database connection pool
function createPool(): Pool {
  const config: PoolConfig = {
    host: process.env.PGHOST || 'localhost',
    port: Number(process.env.PGPORT) || 5432,
    database: process.env.PGDATABASE || 'agent_memory',
    user: process.env.PGUSER || 'postgres',
    password: process.env.PGPASSWORD || '',
  };

  return new Pool(config);
}

// Show migration status
async function showStatus(): Promise<void> {
  const pool = createPool();

  try {
    const files = await getMigrationFiles();
    const applied = await getAppliedMigrations(pool);

    console.log('\n📊 Migration Status\n');

    if (files.length === 0) {
      console.log('No migrations found.');
      return;
    }

    let pendingCount = 0;

    for (const file of files) {
      const id = parseMigrationId(file);
      const isApplied = applied.has(id);
      const status = isApplied ? '✅' : '⏳';
      const label = isApplied ? 'applied' : 'pending';

      console.log(`${status} ${id} - ${file.replace(/\.sql$/, '')} (${label})`);

      if (!isApplied) pendingCount++;
    }

    console.log(`\nTotal: ${files.length} migrations, ${applied.size} applied, ${pendingCount} pending\n`);
  } finally {
    await pool.end();
  }
}

// Run pending migrations
async function runMigrations(): Promise<void> {
  const pool = createPool();

  try {
    // Ensure schema_migrations table exists
    await pool.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        migration_id VARCHAR(255) PRIMARY KEY,
        applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    const files = await getMigrationFiles();
    const applied = await getAppliedMigrations(pool);
    const pending = files.filter(f => !applied.has(parseMigrationId(f)));

    if (pending.length === 0) {
      console.log('✅ No pending migrations.\n');
      return;
    }

    console.log(`\n🔄 Running ${pending.length} pending migration(s)...\n`);

    const client = await pool.connect();

    try {
      for (const file of pending) {
        const id = parseMigrationId(file);
        const filePath = path.join(MIGRATIONS_DIR, file);
        const sql = await fs.readFile(filePath, 'utf-8');

        console.log(`Applying: ${file}...`);

        await client.query('BEGIN');

        try {
          await client.query(sql);
          await client.query(
            'INSERT INTO schema_migrations (migration_id) VALUES ($1)',
            [id]
          );
          await client.query('COMMIT');
          console.log(`✅ ${file} applied.\n`);
        } catch (error: any) {
          await client.query('ROLLBACK');

          // Check if error is "already exists" (migration already applied)
          const isDuplicateError =
            error.message.includes('already exists') ||
            error.code === '42P07' || // duplicate_table
            error.code === '42P06';   // duplicate_schema

          if (isDuplicateError) {
            console.log(`⊘ ${file} skipped (already applied).\n`);

            // Record as applied
            await client.query(
              'INSERT INTO schema_migrations (migration_id) VALUES ($1) ON CONFLICT DO NOTHING',
              [id]
            );
          } else {
            console.error(`✗ ${file} failed:`, error.message);
            console.error('\nMigration rolled back. Fix the error and run again.\n');
            throw error;
          }
        }
      }

      console.log('✅ All migrations applied successfully!\n');
    } finally {
      client.release();
    }
  } catch (error: any) {
    console.error('\n❌ Migration failed:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Rollback migration
async function rollbackMigration(migrationId: string): Promise<void> {
  const pool = createPool();

  try {
    const files = await getMigrationFiles();
    const file = files.find(f => parseMigrationId(f) === migrationId);

    if (!file) {
      console.error(`❌ Migration ${migrationId} not found.\n`);
      process.exit(1);
    }

    const applied = await getAppliedMigrations(pool);

    if (!applied.has(migrationId)) {
      console.error(`❌ Migration ${migrationId} is not applied.\n`);
      process.exit(1);
    }

    console.log(`\n⚠️  Rolling back migration ${migrationId}...\n`);

    // Check for rollback file
    const rollbackFile = path.join(MIGRATIONS_DIR, '010_rollback.sql');

    if (await fileExists(rollbackFile)) {
      console.log('Note: Automatic rollback not implemented.');
      console.log('Manual rollback required. See migration file for instructions.\n');
    } else {
      console.log('No rollback file found. Manual rollback required.\n');
    }

    // Remove from schema_migrations
    await pool.query(
      'DELETE FROM schema_migrations WHERE migration_id = $1',
      [migrationId]
    );

    console.log(`✅ Migration ${migrationId} marked as rolled back.`);
    console.log('⚠️  Database changes must be reverted manually.\n');
  } catch (error: any) {
    console.error('\n❌ Rollback failed:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Create new migration file
async function createMigration(name: string): Promise<void> {
  const files = await getMigrationFiles();
  const lastId = files.length > 0
    ? parseInt(parseMigrationId(files[files.length - 1]))
    : 0;
  const newId = String(lastId + 1).padStart(3, '0');
  const filename = `${newId}_${name.replace(/\s+/g, '_').toLowerCase()}.sql`;
  const filePath = path.join(MIGRATIONS_DIR, filename);

  const template = `-- Migration: ${name}
-- Created: ${new Date().toISOString()}
-- Description: Add description here

-- Your migration SQL goes here
-- Example:
-- ALTER TABLE example_table ADD COLUMN new_column VARCHAR(255);

-- Remember to test in development first!
`;

  await fs.writeFile(filePath, template, 'utf-8');

  console.log(`\n✅ Created migration: ${filename}\n`);
  console.log(`Edit: ${filePath}\n`);
}

// Backup database before migration
async function backupDatabase(): Promise<void> {
  const pool = createPool();

  try {
    await fs.mkdir(BACKUP_DIR, { recursive: true });

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
    const backupFile = path.join(BACKUP_DIR, `backup_${timestamp}.sql`);

    console.log(`\n💾 Creating backup: ${backupFile}\n`);

    // Use pg_dump via child process
    const { spawn } = await import('child_process');

    const pgdump = spawn('pg_dump', [
      `-h${process.env.PGHOST || 'localhost'}`,
      `-U${process.env.PGUSER || 'postgres'}`,
      `-d${process.env.PGDATABASE || 'agent_memory'}`,
      '--no-owner',
      '--no-acl'
    ], {
      env: { ...process.env, PGPASSWORD: process.env.PGPASSWORD || '' }
    });

    const writeStream = (await import('fs')).createWriteStream(backupFile);
    pgdump.stdout.pipe(writeStream);

    await new Promise((resolve, reject) => {
      pgdump.on('close', (code: number) => {
        if (code === 0) {
          resolve(void 0);
        } else {
          reject(new Error(`pg_dump exited with code ${code}`));
        }
      });
    });

    console.log(`✅ Backup created: ${backupFile}\n`);
  } catch (error: any) {
    console.error('\n❌ Backup failed:', error.message);
    console.log('\nTip: Ensure pg_dump is installed and in PATH\n');
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Restore database from backup
async function restoreDatabase(backupFile: string): Promise<void> {
  const pool = createPool();

  try {
    const backupPath = path.join(BACKUP_DIR, backupFile);

    if (!(await fileExists(backupPath))) {
      console.error(`❌ Backup file not found: ${backupPath}\n`);
      process.exit(1);
    }

    console.log(`\n⚠️  Restoring from: ${backupPath}`);
    console.log('⚠️  This will REPLACE the current database!');
    console.log('\nPress Ctrl+C to cancel, or Enter to continue...\n');

    // Wait for user confirmation
    await new Promise(resolve => {
      process.stdin.once('data', resolve);
    });

    console.log('Restoring...\n');

    // Use psql to restore
    const { spawn } = await import('child_process');

    const psql = spawn('psql', [
      `-h${process.env.PGHOST || 'localhost'}`,
      `-U${process.env.PGUSER || 'postgres'}`,
      `-d${process.env.PGDATABASE || 'agent_memory'}`,
      '-f', backupPath
    ], {
      env: { ...process.env, PGPASSWORD: process.env.PGPASSWORD || '' }
    });

    await new Promise((resolve, reject) => {
      psql.on('close', (code: number) => {
        if (code === 0) {
          resolve(void 0);
        } else {
          reject(new Error(`psql exited with code ${code}`));
        }
      });
    });

    console.log('✅ Database restored successfully!\n');
  } catch (error: any) {
    console.error('\n❌ Restore failed:', error.message);
    console.log('\nTip: Ensure psql is installed and in PATH\n');
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Helper: Check if file exists
async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

// Main CLI
async function main() {
  const command = process.argv[2];
  const arg = process.argv[3];

  switch (command) {
    case 'status':
      await showStatus();
      break;

    case 'up':
      await runMigrations();
      break;

    case 'down':
      if (!arg) {
        console.error('Usage: npx tsx scripts/migrate.ts down <migration_id>\n');
        process.exit(1);
      }
      await rollbackMigration(arg);
      break;

    case 'create':
      if (!arg) {
        console.error('Usage: npx tsx scripts/migrate.ts create <migration_name>\n');
        process.exit(1);
      }
      await createMigration(arg);
      break;

    case 'backup':
      await backupDatabase();
      break;

    case 'restore':
      if (!arg) {
        console.error('Usage: npx tsx scripts/migrate.ts restore <backup_file.sql>\n');
        process.exit(1);
      }
      await restoreDatabase(arg);
      break;

    default:
      console.log(`
Thread's Memory System - Migration Helper

Usage:
  npx tsx scripts/migrate.ts <command> [args]

Commands:
  status                    Show migration status
  up                        Run pending migrations
  down <id>                 Rollback migration
  create <name>             Create new migration file
  backup                    Backup database before migration
  restore <file>            Restore from backup

Examples:
  npx tsx scripts/migrate.ts status
  npx tsx scripts/migrate.ts up
  npx tsx scripts/migrate.ts create add_user_preferences
  npx tsx scripts/migrate.ts backup
  npx tsx scripts/migrate.ts down 005

Environment:
  PGHOST         Database host (default: localhost)
  PGPORT         Database port (default: 5432)
  PGDATABASE     Database name (default: agent_memory)
  PGUSER         Database user (default: postgres)
  PGPASSWORD     Database password
  BACKUP_DIR     Backup directory (default: ./backups)

For safe migrations, always backup first:
  1. npx tsx scripts/migrate.ts backup
  2. npx tsx scripts/migrate.ts up
      `);
      process.exit(1);
  }
}

main().catch(error => {
  console.error('Error:', error);
  process.exit(1);
});
