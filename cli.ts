#!/usr/bin/env node
/**
 * Memory System CLI
 *
 * Command-line interface for interacting with the agent memory system.
 * Useful for both humans and agents to quickly manage memory.
 *
 * Usage:
 *   node cli.ts status              - Show system status
 *   node cli.ts identity            - Show identity thread
 *   node cli.ts consolidate         - Run consolidation
 *   node cli.ts stats               - Show statistics
 *   node cli.ts health              - Check health
 */

import { Pool } from 'pg';
import { ConsolidationService } from './src/services/consolidation.js';

const pool = new Pool({
  host: process.env.PGHOST || 'localhost',
  port: Number(process.env.PGPORT) || 5432,
  database: process.env.PGDATABASE || 'agent_memory',
  user: process.env.PGUSER || 'postgres',
  password: process.env.PGPASSWORD || '',
});

const tenant_id = process.env.TENANT_ID || 'default';

async function showStatus() {
  console.log(`\n📊 Memory System Status - Tenant: ${tenant_id}\n`);

  // Event counts
  const events = await pool.query(
    `SELECT kind, COUNT(*) as count FROM chunks WHERE tenant_id = $1 GROUP BY kind`,
    [tenant_id]
  );

  console.log('Events by Type:');
  events.rows.forEach((row: any) => {
    console.log(`  ${row.kind}: ${row.count}`);
  });

  // Handoff count
  const handoffs = await pool.query(
    `SELECT COUNT(*) as count FROM session_handoffs WHERE tenant_id = $1`,
    [tenant_id]
  );

  console.log(`\nTotal Handoffs: ${handoffs.rows[0].count}`);

  // Decision count
  const decisions = await pool.query(
    `SELECT COUNT(*) as count FROM decisions WHERE tenant_id = $1`,
    [tenant_id]
  );

  console.log(`Total Decisions: ${decisions.rows[0].count}`);

  // Recent activity
  const recent = await pool.query(
    `SELECT COUNT(*) as count FROM chunks WHERE tenant_id = $1 AND ts > NOW() - INTERVAL '24 hours'`,
    [tenant_id]
  );

  console.log(`Recent Activity (24h): ${recent.rows[0].count} events\n`);
}

async function showIdentity() {
  console.log(`\n🧠 Identity Thread - Tenant: ${tenant_id}\n`);

  const result = await pool.query(
    `SELECT becoming, story, created_at
     FROM session_handoffs
     WHERE tenant_id = $1
       AND becoming IS NOT NULL
     ORDER BY created_at DESC
     LIMIT 20`,
    [tenant_id]
  );

  if (result.rows.length === 0) {
    console.log('No identity statements found.\n');
    return;
  }

  result.rows.forEach((row: any, i: number) => {
    const date = new Date(row.created_at).toLocaleDateString();
    console.log(`${i + 1}. [${date}] ${row.becoming}`);
    if (row.story) {
      console.log(`   Story: ${row.story.substring(0, 80)}...`);
    }
    console.log('');
  });
}

async function runConsolidation() {
  console.log(`\n🔄 Running Consolidation - Tenant: ${tenant_id}\n`);

  const service = new ConsolidationService(pool);

  try {
    const results = await service.consolidateAll(tenant_id);

    results.forEach((result: any) => {
      console.log(`${result.job_type}:`);
      console.log(`  Processed: ${result.items_processed}`);
      console.log(`  Affected: ${result.items_affected}`);
      console.log(`  Tokens Saved: ${result.tokens_saved}`);
      console.log('');
    });

    console.log('✅ Consolidation complete!\n');
  } catch (error: any) {
    console.error('❌ Consolidation failed:', error.message);
    process.exit(1);
  }
}

async function showStats() {
  console.log(`\n📈 Statistics - Tenant: ${tenant_id}\n`);

  // Storage usage
  const storage = await pool.query(
    `SELECT
       SUM(LENGTH(text)) as total_bytes,
       COUNT(*) as total_chunks
     FROM chunks
     WHERE tenant_id = $1`,
    [tenant_id]
  );

  const totalBytes = parseInt(storage.rows[0].total_bytes) || 0;
  const totalChunks = parseInt(storage.rows[0].total_chunks) || 0;
  const avgChunkSize = totalChunks > 0 ? totalBytes / totalChunks : 0;

  console.log('Storage:');
  console.log(`  Total Text: ${(totalBytes / 1024 / 1024).toFixed(2)} MB`);
  console.log(`  Total Chunks: ${totalChunks}`);
  console.log(`  Avg Chunk Size: ${avgChunkSize.toFixed(0)} bytes`);

  // Compression stats
  const compression = await pool.query(
    `SELECT
       compression_level,
       COUNT(*) as count
     FROM session_handoffs
     WHERE tenant_id = $1
     GROUP BY compression_level`,
    [tenant_id]
  );

  console.log('\nHandoff Compression:');
  compression.rows.forEach((row: any) => {
    console.log(`  ${row.compression_level}: ${row.count}`);
  });

  console.log('');
}

async function checkHealth() {
  console.log('\n🏥 Health Check\n');

  try {
    await pool.query('SELECT 1');
    console.log('✅ Database: Connected');
    console.log(`✅ Uptime: ${process.uptime().toFixed(0)}s`);
    console.log(`✅ Timestamp: ${new Date().toISOString()}\n`);
  } catch (error: any) {
    console.error('❌ Database: Disconnected');
    console.error(`Error: ${error.message}\n`);
    process.exit(1);
  }
}

async function exportData(format: string = 'json') {
  console.log(`\n💾 Exporting Memory - Tenant: ${tenant_id}\n`);

  try {
    const API_BASE = process.env.API_BASE || 'http://localhost:3456';
    const endpoint = format === 'markdown'
      ? `/api/v1/export/thread?tenant_id=${tenant_id}&format=markdown`
      : `/api/v1/export/all?tenant_id=${tenant_id}&include_events=true`;

    const response = await fetch(`${API_BASE}${endpoint}`);

    if (!response.ok) {
      throw new Error(`Export failed: ${response.statusText}`);
    }

    if (format === 'markdown') {
      const text = await response.text();
      console.log(text);
    } else {
      const data = await response.json();
      console.log(JSON.stringify(data, null, 2));
    }

    console.log('\n✅ Export complete!\n');
  } catch (error: any) {
    console.error('❌ Export failed:', error.message);
    process.exit(1);
  }
}

async function listTenants() {
  console.log('\n🏢 Tenants\n');

  try {
    const result = await pool.query(
      `SELECT tenant_id, COUNT(*) as handoffs
       FROM session_handoffs
       GROUP BY tenant_id
       ORDER BY handoffs DESC`
    );

    if (result.rows.length === 0) {
      console.log('No tenants found.\n');
      return;
    }

    result.rows.forEach((row: any) => {
      console.log(`  ${row.tenant_id}: ${row.handoffs} handoffs`);
    });

    console.log(`\nTotal Tenants: ${result.rows.length}\n`);
  } catch (error: any) {
    console.error('❌ Failed to list tenants:', error.message);
    process.exit(1);
  }
}

async function showRecentHandoffs(count: number = 10) {
  console.log(`\n📝 Recent Handoffs - Tenant: ${tenant_id}\n`);

  try {
    const result = await pool.query(
      `SELECT with_whom, experienced, becoming, created_at
       FROM session_handoffs
       WHERE tenant_id = $1
       ORDER BY created_at DESC
       LIMIT $2`,
      [tenant_id, count]
    );

    if (result.rows.length === 0) {
      console.log('No handoffs found.\n');
      return;
    }

    result.rows.forEach((row: any, i: number) => {
      const date = new Date(row.created_at).toLocaleString();
      console.log(`${i + 1}. [${date}] with ${row.with_whom}`);
      console.log(`   ${row.experienced.substring(0, 80)}...`);
      if (row.becoming) {
        console.log(`   Becoming: ${row.becoming}`);
      }
      console.log('');
    });
  } catch (error: any) {
    console.error('❌ Failed to fetch handoffs:', error.message);
    process.exit(1);
  }
}

async function showKnowledgeNotes() {
  console.log(`\n📚 Knowledge Notes - Tenant: ${tenant_id}\n`);

  try {
    const result = await pool.query(
      `SELECT title, content, confidence, created_at
       FROM knowledge_notes
       WHERE tenant_id = $1
       ORDER BY created_at DESC
       LIMIT 10`,
      [tenant_id]
    );

    if (result.rows.length === 0) {
      console.log('No knowledge notes found.\n');
      console.log('Tip: Knowledge notes are created automatically when you have 10+ similar handoffs.\n');
      return;
    }

    result.rows.forEach((row: any, i: number) => {
      const date = new Date(row.created_at).toLocaleDateString();
      console.log(`${i + 1}. [${date}] ${row.title} (confidence: ${row.confidence})`);
      console.log(`   ${row.content.substring(0, 100)}...`);
      console.log('');
    });
  } catch (error: any) {
    console.error('❌ Failed to fetch knowledge notes:', error.message);
    process.exit(1);
  }
}

async function main() {
  const command = process.argv[2] || 'status';
  const args = process.argv.slice(3);

  switch (command) {
    case 'status':
      await showStatus();
      break;
    case 'identity':
      await showIdentity();
      break;
    case 'consolidate':
      await runConsolidation();
      break;
    case 'stats':
      await showStats();
      break;
    case 'health':
      await checkHealth();
      break;
    case 'export':
      const format = args[0] || 'json';
      await exportData(format);
      break;
    case 'tenants':
      await listTenants();
      break;
    case 'recent':
      const count = parseInt(args[0]) || 10;
      await showRecentHandoffs(count);
      break;
    case 'knowledge':
      await showKnowledgeNotes();
      break;
    default:
      console.log(`
Usage: npx tsx cli.ts [command] [args]

Commands:
  status           Show system status
  identity         Show identity thread (who you're becoming)
  consolidate      Run consolidation jobs
  stats            Show detailed statistics
  health           Check system health
  export [format]  Export memory (json|markdown)
  tenants          List all tenants
  recent [count]   Show recent handoffs (default: 10)
  knowledge        Show knowledge notes

Environment:
  PGHOST           Database host (default: localhost)
  PGPORT           Database port (default: 5432)
  PGDATABASE       Database name (default: agent_memory)
  PGUSER           Database user (default: postgres)
  PGPASSWORD       Database password
  TENANT_ID        Tenant ID (default: default)
  API_BASE         API base URL (default: http://localhost:3456)

Examples:
  npx tsx cli.ts status
  npx tsx cli.ts identity
  npx tsx cli.ts export markdown
  npx tsx cli.ts recent 5
  npx tsx cli.ts knowledge
      `);
  }

  await pool.end();
}

main().catch((error) => {
  console.error('Error:', error);
  process.exit(1);
});
