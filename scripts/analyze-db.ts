#!/usr/bin/env tsx

/**
 * Database Analysis Tool
 *
 * Analyzes the PostgreSQL database for insights, issues, and
 * optimization opportunities.
 *
 * Usage:
 *   npx tsx scripts/analyze-db.ts              # Full analysis
 *   npx tsx scripts/analyze-db.ts --tables     # Table stats
 *   npx tsx scripts/analyze-db.ts --indexes    # Index usage
 *   npx tsx scripts/analyze-db.ts --size      # Table sizes
 *   npx tsx scripts/analyze-db.ts --health    # Health check
 */

import { Pool } from 'pg';
import { promises as fs } from 'fs';

const pool = new Pool({
  host: process.env.PGHOST || 'localhost',
  port: Number(process.env.PGPORT) || 5432,
  database: process.env.PGDATABASE || 'agent_memory',
  user: process.env.PGUSER || 'postgres',
  password: process.env.PGPASSWORD || '',
});

interface AnalysisResult {
  category: string;
  findings: string[];
  recommendations: string[];
}

async function analyzeTables(): Promise<AnalysisResult> {
  console.log('\n📊 Analyzing Tables...\n');

  const findings: string[] = [];
  const recommendations: string[] = [];

  // Get table statistics
  const tables = await pool.query(`
    SELECT
      schemaname,
      tablename,
      pg_size_pretty(tableoid) AS size,
      pg_total_indexes(tableoid) AS index_count
    FROM pg_tables
    WHERE schemaname = 'public'
    ORDER BY pg_table_size(tableoid) DESC
  `);

  console.log('Tables:');
  tables.rows.forEach((table: any) => {
    const sizeMB = parseFloat(table.size) || 0;
    if (sizeMB > 100) {
      findings.push(`Large table: ${table.tablename} (${table.size})`);
      recommendations.push(`Consider archiving old data from ${table.tablename}`);
    }
    console.log(`  ${table.tablename}: ${table.size}, ${table.index_count} indexes`);
  });

  return {
    category: 'Tables',
    findings,
    recommendations,
  };
}

async function analyzeIndexes(): Promise<AnalysisResult> {
  console.log('\n🔍 Analyzing Indexes...\n');

  const findings: string[] = [];
  const recommendations: string[] = [];

  // Get index usage statistics
  const indexes = await pool.query(`
    SELECT
      schemaname,
      tablename,
      indexname,
      idx_scan as index_scans,
      idx_tup_read as tuple_reads,
      idx_tup_fetch as tuple_fetches
    FROM pg_stat_user_indexes
    WHERE schemaname = 'public'
    ORDER BY idx_scan DESC
  `);

  console.log('Index Usage:');
  indexes.rows.forEach((idx: any) => {
    const usage = idx.index_scans || 0;
    const efficiency = idx.tuple_reads > 0 ? (idx.tuple_fetches / idx.tuple_reads) * 100 : 0;

    console.log(`  ${idx.indexname}:`);
    console.log(`    Scans: ${usage}, Reads: ${idx.tuple_reads}, Efficiency: ${efficiency.toFixed(1)}%`);

    if (usage === 0) {
      findings.push(`Unused index: ${idx.indexname} on ${idx.tablename}`);
      recommendations.push(`Drop unused index: ${idx.indexname}`);
    }

    if (efficiency < 90 && idx.tuple_reads > 100) {
      findings.push(`Low efficiency index: ${idx.indexname} (${efficiency.toFixed(1)}% cache hit)`);
    }
  });

  // Check for missing indexes
  const missingIndexes = await pool.query(`
    SELECT
      schemaname,
      tablename,
      attname,
      n_distinct
    FROM pg_stats
    WHERE schemaname = 'public'
      AND n_distinct > 100
    ORDER BY n_distinct DESC
  `);

  console.log('\nHigh-cardinality columns (may need indexes):');
  missingIndexes.rows.slice(0, 5).forEach((col: any) => {
    console.log(`  ${col.tablename}.${col.attname}: ${col.n_distinct} distinct values`);
  });

  return {
    category: 'Indexes',
    findings,
    recommendations,
  };
}

async function analyzeTableSizes(): Promise<AnalysisResult> {
  console.log('\n💾 Analyzing Table Sizes...\n');

  const findings: string[] = [];
  const recommendations: string[] = [];

  const sizes = await pool.query(`
    SELECT
      table_name,
      pg_total_relation_size(table_name) AS total_size,
      pg_relation_size(table_name) AS data_size,
      pg_total_relation_size(table_name) - pg_relation_size(table_name) AS index_size,
      (SELECT count(*) FROM table_name) as row_count
    FROM (
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_type = 'BASE TABLE'
    ) sizes
    LEFT JOIN pg_class ON pg_class.relname = sizes.table_name
  `);

  console.log('Table Sizes (Data + Indexes):');
  sizes.rows.forEach((table: any) => {
    const totalMB = (table.total_size || 0) / 1024 / 1024;
    const dataMB = (table.data_size || 0) / 1024 / 1024;
    const indexMB = (table.index_size || 0) / 1024 / 1024;
    const rowCount = table.row_count || 0;

    console.log(`  ${table.table_name}:`);
    console.log(`    Total: ${totalMB.toFixed(2)} MB, Data: ${dataMB.toFixed(2)} MB, Indexes: ${indexMB.toFixed(2)} MB`);
    console.log(`    Rows: ${rowCount.toLocaleString()}`);

    if (totalMB > 500) {
      findings.push(`Very large table: ${table.table_name} (${totalMB.toFixed(2)} MB)`);
      recommendations.push(`Consider partitioning or archiving ${table.table_name}`);
    }

    if (indexMB > dataMB * 2) {
      findings.push(`Index size > data size for ${table.table_name}`);
    }
  });

  return {
    category: 'Storage',
    findings,
    recommendations,
  };
}

async function analyzeHealth(): Promise<AnalysisResult> {
  console.log('\n🏥 Database Health Check...\n');

  const findings: string[] = [];
  const recommendations: string[] = [];

  // Check connection pool
  const poolStatus = {
    total: pool.totalCount,
    idle: pool.idleCount,
    waiting: pool.waitingCount,
  };

  console.log('Connection Pool:');
  console.log(`  Total: ${poolStatus.total}`);
  console.log(`  Idle: ${poolStatus.idle}`);
  console.log(`  Waiting: ${poolStatus.waiting}`);

  if (poolStatus.waiting > 5) {
    findings.push(`High connection pool wait time: ${poolStatus.waiting} clients waiting`);
    recommendations.push(`Increase connection pool size or optimize long-running queries`);
  }

  // Check for long-running queries
  const longQueries = await pool.query(`
    SELECT
      pid,
      now() - query_start as duration,
      state,
      query
    FROM pg_stat_activity
    WHERE state IN ('active', 'idle in transaction')
      AND now() - query_start > interval '1 minute'
    ORDER BY duration DESC
  `);

  if (longQueries.rows.length > 0) {
    console.log('\nLong-running queries (>1 min):');
    longQueries.rows.forEach((q: any) => {
      const duration = Math.floor(q.duration / 60);
      console.log(`  PID ${q.pid}: ${duration}m ${q.state}`);
      console.log(`    ${q.query.substring(0, 100)}...`);
      findings.push(`Long query: PID ${q.pid} (${duration}m)`);
    });
  }

  // Check for bloat
  const bloat = await pool.query(`
    SELECT
      schemaname,
      tablename,
      pg_size_pretty(pg_total_relation_size(oid) AS size,
      pg_total_relation_size(oid) - pg_relation_size(oid) AS bloat
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    JOIN pg_tables t ON t.tablename = c.relname
    WHERE n.schemaname = 'public'
      AND pg_total_relation_size(oid) > pg_relation_size(oid) * 1.5
    ORDER BY (pg_total_relation_size(oid) - pg_relation_size(oid)) DESC
  `);

  if (bloat.rows.length > 0) {
    console.log('\nTables with bloat (>50% bloat):');
    bloat.rows.forEach((table: any) => {
      const bloatMB = (table.bloat || 0) / 1024 / 1024;
      console.log(`  ${table.tablename}: ${bloatMB.toFixed(2)} MB bloat`);
      findings.push(`Table bloat: ${table.tablename} (${table.bloat} waste)`);
      recommendations.push(`Run VACUUM on ${table.tablename} to reclaim space`);
    });
  }

  return {
    category: 'Health',
    findings,
    recommendations,
  };
}

async function analyzeSlowQueries(): Promise<AnalysisResult> {
  console.log('\n🐌 Slow Query Analysis...\n');

  const findings: string[] = [];
  const recommendations: string[] = [];

  // Check for pg_stat_statements
  try {
    const slowQueries = await pool.query(`
      SELECT
        query,
        calls,
        total_time,
        mean_time,
        max_time
      FROM pg_stat_statements
      WHERE mean_time > 100  -- > 100ms average
      ORDER BY mean_time DESC
      LIMIT 10
    `);

    if (slowQueries.rows.length > 0) {
      console.log('Slow Queries (>100ms average):');
      slowQueries.rows.forEach((q: any) => {
        console.log(`  ${q.query.substring(0, 80)}...`);
        console.log(`    Calls: ${q.calls}, Avg: ${q.mean_time.toFixed(1)}ms, Max: ${q.max_time.toFixed(1)}ms`);
        findings.push(`Slow query: ${q.calls} calls, avg ${q.mean_time.toFixed(1)}ms`);
        recommendations.push(`Optimize or add index for slow query`);
      });
    } else {
      console.log('✓ No slow queries detected');
    }
  } catch (error)) {
    console.log('⚠️  pg_stat_statements not available (run: CREATE EXTENSION pg_stat_statements)');
  }

  return {
    category: 'Performance',
    findings,
    recommendations,
  };
}

async function generateReport(results: AnalysisResult[]): void {
  console.log('\n' + '='.repeat(70));
  console.log('📋 ANALYSIS SUMMARY');
  console.log('='.repeat(70) + '\n');

  results.forEach((result) => {
    console.log(`\n${result.category}:`);

    if (result.findings.length > 0) {
      console.log('\n  Findings:');
      result.findings.forEach((finding) => {
        console.log(`    ⚠️  ${finding}`);
      });
    } else {
      console.log('\n  ✅ No issues found');
    }

    if (result.recommendations.length > 0) {
      console.log('\n  Recommendations:');
      result.recommendations.forEach((rec) => {
        console.log(`    💡 ${rec}`);
      });
    }
  });

  console.log('\n' + '='.repeat(70));
  console.log('End of Analysis');
  console.log('='.repeat(70) + '\n');
}

async function main() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║        Thread\'s Memory System - Database Analysis Tool           ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  const args = process.argv.slice(2);
  const runAll = args.length === 0;

  const results: AnalysisResult[] = [];

  try {
    if (runAll || args.includes('--tables')) {
      results.push(await analyzeTables());
    }

    if (runAll || args.includes('--indexes')) {
      results.push(await analyzeIndexes());
    }

    if (runAll || args.includes('--size')) {
      results.push(await analyzeTableSizes());
    }

    if (runAll || args.includes('--health')) {
      results.push(await analyzeHealth());
    }

    if (runAll || args.includes('--performance')) {
      results.push(await analyzeSlowQueries());
    }

    if (runAll || args.includes('--all')) {
      // Already ran all above
    }

    if (args.includes('--vacuum')) {
      console.log('\n🧹 Running VACUUM...\n');
      await pool.query('VACUUM ANALYZE');
      console.log('✓ VACUUM complete');
    }

    if (results.length > 0) {
      generateReport(results);
    }
  } catch (error: any) {
    console.error('\n❌ Analysis failed:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }

  console.log('✅ Analysis complete!\n');
}

main().catch((error) => {
  console.error('Error:', error);
  process.exit(1);
});
