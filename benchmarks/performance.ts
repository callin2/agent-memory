#!/usr/bin/env tsx

/**
 * Performance Benchmarks
 *
 * Measures system performance under various loads to identify bottlenecks
 * and validate scaling capabilities.
 *
 * Usage:
 *   npx tsx benchmarks/performance.ts              # Run all benchmarks
 *   npx tsx benchmarks/performance.ts --handoff    # Handoff operations only
 *   npx tsx benchmarks/performance.ts --consolidation  # Consolidation only
 *   npx tsx benchmarks/performance.ts --export     # Export only
 */

import { Pool } from 'pg';
import { randomUUID } from 'crypto';
import request from 'undici';

const API_BASE = process.env.API_BASE || 'http://localhost:3456';
const TENANT_ID = 'benchmarks';
const CONCURRENT_REQUESTS = Number(process.env.CONCURRENT) || 10;
const TOTAL_REQUESTS = Number(process.env.TOTAL) || 100;

// Benchmark results
interface BenchmarkResult {
  name: string;
  totalRequests: number;
  concurrentRequests: number;
  totalTime: number;
  avgTime: number;
  minTime: number;
  maxTime: number;
  requestsPerSecond: number;
  errors: number;
}

// PostgreSQL connection pool
const pool = new Pool({
  host: process.env.PGHOST || 'localhost',
  port: Number(process.env.PGPORT) || 5432,
  database: process.env.PGDATABASE || 'agent_memory',
  user: process.env.PGUSER || 'postgres',
  password: process.env.PGPASSWORD || '',
  max: CONCURRENT_REQUESTS + 5,
});

/**
 * Benchmark: Create Handoff
 *
 * Measures handoff creation performance under concurrent load.
 */
async function benchmarkCreateHandoffs(): Promise<BenchmarkResult> {
  console.log('\n📊 Benchmark: Create Handoffs');
  console.log(`   Total: ${TOTAL_REQUESTS}, Concurrent: ${CONCURRENT_REQUESTS}`);

  const times: number[] = [];
  let errors = 0;
  const startTime = Date.now();

  // Process in batches
  for (let i = 0; i < TOTAL_REQUESTS; i += CONCURRENT_REQUESTS) {
    const batchSize = Math.min(CONCURRENT_REQUESTS, TOTAL_REQUESTS - i);
    const batch = Array.from({ length: batchSize }, (_, j) => i + j);

    const results = await Promise.allSettled(
      batch.map(async (idx) => {
        const start = Date.now();

        try {
          await request(`${API_BASE}/api/v1/handoff`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              tenant_id: TENANT_ID,
              session_id: `bench-session-${idx}`,
              with_whom: 'Benchmark',
              experienced: `Benchmark run ${idx}`,
              noticed: 'Performance testing',
              learned: 'Measuring system capabilities',
              story: 'Running performance benchmarks',
              becoming: 'An agent that measures and optimizes',
              remember: 'Benchmark results',
              significance: 0.5,
              tags: ['benchmark', 'performance'],
            }),
          });

          return Date.now() - start;
        } catch (error) {
          errors++;
          throw error;
        }
      })
    );

    // Collect successful times
    results.forEach((result) => {
      if (result.status === 'fulfilled') {
        times.push(result.value);
      }
    });
  }

  const totalTime = Date.now() - startTime;

  return {
    name: 'Create Handoffs',
    totalRequests: times.length,
    concurrentRequests: CONCURRENT_REQUESTS,
    totalTime,
    avgTime: times.reduce((a, b) => a + b, 0) / times.length,
    minTime: Math.min(...times),
    maxTime: Math.max(...times),
    requestsPerSecond: (times.length / totalTime) * 1000,
    errors,
  };
}

/**
 * Benchmark: Wake Up
 *
 * Measures wake-up endpoint performance (retrieves identity thread).
 */
async function benchmarkWakeUp(): Promise<BenchmarkResult> {
  console.log('\n📊 Benchmark: Wake Up (Identity Thread Retrieval)');
  console.log(`   Total: ${TOTAL_REQUESTS}, Concurrent: ${CONCURRENT_REQUESTS}`);

  const times: number[] = [];
  let errors = 0;
  const startTime = Date.now();

  for (let i = 0; i < TOTAL_REQUESTS; i += CONCURRENT_REQUESTS) {
    const batchSize = Math.min(CONCURRENT_REQUESTS, TOTAL_REQUESTS - i);
    const batch = Array.from({ length: batchSize }, (_, j) => i + j);

    const results = await Promise.allSettled(
      batch.map(async () => {
        const start = Date.now();

        try {
          await request(`${API_BASE}/api/v1/wake-up?tenant_id=${TENANT_ID}&with_whom=Benchmark`);
          return Date.now() - start;
        } catch (error) {
          errors++;
          throw error;
        }
      })
    );

    results.forEach((result) => {
      if (result.status === 'fulfilled') {
        times.push(result.value);
      }
    });
  }

  const totalTime = Date.now() - startTime;

  return {
    name: 'Wake Up',
    totalRequests: times.length,
    concurrentRequests: CONCURRENT_REQUESTS,
    totalTime,
    avgTime: times.reduce((a, b) => a + b, 0) / times.length,
    minTime: Math.min(...times),
    maxTime: Math.max(...times),
    requestsPerSecond: (times.length / totalTime) * 1000,
    errors,
  };
}

/**
 * Benchmark: Export Identity Thread
 *
 * Measures export performance with JSON format.
 */
async function benchmarkExport(): Promise<BenchmarkResult> {
  console.log('\n📊 Benchmark: Export Identity Thread (JSON)');
  console.log(`   Total: ${TOTAL_REQUESTS}, Concurrent: ${CONCURRENT_REQUESTS}`);

  const times: number[] = [];
  let errors = 0;
  const startTime = Date.now();

  for (let i = 0; i < TOTAL_REQUESTS; i += CONCURRENT_REQUESTS) {
    const batchSize = Math.min(CONCURRENT_REQUESTS, TOTAL_REQUESTS - i);
    const batch = Array.from({ length: batchSize }, (_, j) => i + j);

    const results = await Promise.allSettled(
      batch.map(async () => {
        const start = Date.now();

        try {
          await request(`${API_BASE}/api/v1/export/thread?tenant_id=${TENANT_ID}&format=json`);
          return Date.now() - start;
        } catch (error) {
          errors++;
          throw error;
        }
      })
    );

    results.forEach((result) => {
      if (result.status === 'fulfilled') {
        times.push(result.value);
      }
    });
  }

  const totalTime = Date.now() - startTime;

  return {
    name: 'Export Identity Thread',
    totalRequests: times.length,
    concurrentRequests: CONCURRENT_REQUESTS,
    totalTime,
    avgTime: times.reduce((a, b) => a + b, 0) / times.length,
    minTime: Math.min(...times),
    maxTime: Math.max(...times),
    requestsPerSecond: (times.length / totalTime) * 1000,
    errors,
  };
}

/**
 * Benchmark: Consolidation
 *
 * Measures consolidation job performance.
 */
async function benchmarkConsolidation(): Promise<BenchmarkResult> {
  console.log('\n📊 Benchmark: Consolidation Job');
  console.log('   Running consolidation...');

  const start = Date.now();

  try {
    await request(`${API_BASE}/api/v1/consolidation/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tenant_id: TENANT_ID }),
    });

    const totalTime = Date.now() - start;

    return {
      name: 'Consolidation Job',
      totalRequests: 1,
      concurrentRequests: 1,
      totalTime,
      avgTime: totalTime,
      minTime: totalTime,
      maxTime: totalTime,
      requestsPerSecond: 1000 / totalTime,
      errors: 0,
    };
  } catch (error) {
    return {
      name: 'Consolidation Job',
      totalRequests: 0,
      concurrentRequests: 1,
      totalTime: 0,
      avgTime: 0,
      minTime: 0,
      maxTime: 0,
      requestsPerSecond: 0,
      errors: 1,
    };
  }
}

/**
 * Benchmark: Database Query Performance
 *
 * Measures raw PostgreSQL query performance.
 */
async function benchmarkDatabaseQueries(): Promise<BenchmarkResult> {
  console.log('\n📊 Benchmark: Database Queries (Handoff Retrieval)');
  console.log(`   Total: ${TOTAL_REQUESTS}, Concurrent: ${CONCURRENT_REQUESTS}`);

  const times: number[] = [];
  let errors = 0;
  const startTime = Date.now();

  for (let i = 0; i < TOTAL_REQUESTS; i += CONCURRENT_REQUESTS) {
    const batchSize = Math.min(CONCURRENT_REQUESTS, TOTAL_REQUESTS - i);
    const batch = Array.from({ length: batchSize }, (_, j) => i + j);

    const results = await Promise.allSettled(
      batch.map(async () => {
        const start = Date.now();

        try {
          await pool.query(
            `SELECT * FROM session_handoffs
             WHERE tenant_id = $1
             ORDER BY created_at DESC
             LIMIT 10`,
            [TENANT_ID]
          );

          return Date.now() - start;
        } catch (error) {
          errors++;
          throw error;
        }
      })
    );

    results.forEach((result) => {
      if (result.status === 'fulfilled') {
        times.push(result.value);
      }
    });
  }

  const totalTime = Date.now() - startTime;

  return {
    name: 'Database Query',
    totalRequests: times.length,
    concurrentRequests: CONCURRENT_REQUESTS,
    totalTime,
    avgTime: times.reduce((a, b) => a + b, 0) / times.length,
    minTime: Math.min(...times),
    maxTime: Math.max(...times),
    requestsPerSecond: (times.length / totalTime) * 1000,
    errors,
  };
}

/**
 * Print benchmark results
 */
function printResult(result: BenchmarkResult): void {
  console.log('\n' + '='.repeat(60));
  console.log(`📈 ${result.name}`);
  console.log('='.repeat(60));
  console.log(`Total Requests:      ${result.totalRequests}`);
  console.log(`Concurrent:          ${result.concurrentRequests}`);
  console.log(`Total Time:          ${result.totalTime}ms`);
  console.log(`Avg Time:            ${result.avgTime.toFixed(2)}ms`);
  console.log(`Min Time:            ${result.minTime}ms`);
  console.log(`Max Time:            ${result.maxTime}ms`);
  console.log(`Requests/Second:     ${result.requestsPerSecond.toFixed(2)}`);
  console.log(`Errors:              ${result.errors}`);

  // Performance评级
  const rps = result.requestsPerSecond;
  let rating = '⚠️  Needs Improvement';

  if (rps > 100) rating = '🚀 Excellent';
  else if (rps > 50) rating = '✅ Good';
  else if (rps > 20) rating = '⚡ Acceptable';

  console.log(`Rating:              ${rating}`);
  console.log('='.repeat(60));
}

/**
 * Main benchmark runner
 */
async function main() {
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║      Thread\'s Memory System - Performance Benchmarks       ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log(`\nConfiguration:`);
  console.log(`  API Base:          ${API_BASE}`);
  console.log(`  Tenant ID:         ${TENANT_ID}`);
  console.log(`  Total Requests:    ${TOTAL_REQUESTS}`);
  console.log(`  Concurrent:        ${CONCURRENT_REQUESTS}`);

  const args = process.argv.slice(2);
  const runAll = args.length === 0;

  const results: BenchmarkResult[] = [];

  // Run benchmarks
  if (runAll || args.includes('--handoff')) {
    results.push(await benchmarkCreateHandoffs());
  }

  if (runAll || args.includes('--wakeup')) {
    results.push(await benchmarkWakeUp());
  }

  if (runAll || args.includes('--export')) {
    results.push(await benchmarkExport());
  }

  if (runAll || args.includes('--consolidation')) {
    results.push(await benchmarkConsolidation());
  }

  if (runAll || args.includes('--database')) {
    results.push(await benchmarkDatabaseQueries());
  }

  // Print summary
  console.log('\n\n' + '█'.repeat(60));
  console.log('█                    BENCHMARK SUMMARY                          █');
  console.log('█'.repeat(60));

  results.forEach(printResult);

  // Overall assessment
  const avgRPS = results.reduce((sum, r) => sum + r.requestsPerSecond, 0) / results.length;
  const totalErrors = results.reduce((sum, r) => sum + r.errors, 0);

  console.log('\n' + '█'.repeat(60));
  console.log('█                    OVERALL ASSESSMENT                         █');
  console.log('█'.repeat(60));
  console.log(`Average Throughput:  ${avgRPS.toFixed(2)} req/s`);
  console.log(`Total Errors:        ${totalErrors}`);

  if (avgRPS > 50 && totalErrors === 0) {
    console.log('Status:              🚀 Production Ready');
  } else if (avgRPS > 20 && totalErrors < results.length * 5) {
    console.log('Status:              ✅ Good Performance');
  } else {
    console.log('Status:              ⚠️  Optimization Needed');
  }

  console.log('█'.repeat(60));

  // Cleanup
  await pool.end();

  console.log('\n✅ Benchmarks completed!\n');
}

main().catch((error) => {
  console.error('❌ Benchmark failed:', error);
  process.exit(1);
});
