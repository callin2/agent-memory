/**
 * Health Monitoring Service
 *
 * Comprehensive health checks and system diagnostics for
 * production monitoring and alerting.
 */

import { Pool } from 'pg';

export interface HealthCheckResult {
  status: 'healthy' | 'degraded' | 'unhealthy';
  checks: {
    database: CheckResult;
    storage: CheckResult;
    consolidation: CheckResult;
    performance: CheckResult;
  };
  timestamp: Date;
  uptime: number;
}

export interface CheckResult {
  status: 'pass' | 'fail' | 'warn';
  message: string;
  details?: any;
}

export class HealthMonitor {
  constructor(private pool: Pool) {}

  /**
   * Run comprehensive health check
   */
  async checkHealth(tenantId?: string): Promise<HealthCheckResult> {
    const checks = {
      database: await this.checkDatabase(),
      storage: await this.checkStorage(tenantId),
      consolidation: await this.checkConsolidation(tenantId),
      performance: await this.checkPerformance(tenantId),
    };

    // Determine overall status
    const allPass = Object.values(checks).every(c => c.status === 'pass');
    const anyFail = Object.values(checks).some(c => c.status === 'fail');

    const status: 'healthy' | 'degraded' | 'unhealthy' = allPass
      ? 'healthy'
      : anyFail
      ? 'unhealthy'
      : 'degraded';

    return {
      status,
      checks,
      timestamp: new Date(),
      uptime: process.uptime(),
    };
  }

  /**
   * Check database connectivity and performance
   */
  private async checkDatabase(): Promise<CheckResult> {
    try {
      const start = Date.now();

      // Test connection
      await this.pool.query('SELECT 1');

      const latency = Date.now() - start;

      // Check connection pool
      const totalCount = this.pool.totalCount;
      const idleCount = this.pool.idleCount;
      const waitingCount = this.pool.waitingCount;

      if (latency > 1000) {
        return {
          status: 'warn',
          message: `Database slow: ${latency}ms`,
          details: { latency, totalCount, idleCount, waitingCount },
        };
      }

      if (waitingCount > 5) {
        return {
          status: 'warn',
          message: 'High connection pool wait time',
          details: { latency, totalCount, idleCount, waitingCount },
        };
      }

      return {
        status: 'pass',
        message: `Database healthy (${latency}ms)`,
        details: { latency, totalCount, idleCount, waitingCount },
      };
    } catch (error: any) {
      return {
        status: 'fail',
        message: `Database unreachable: ${error.message}`,
        details: { error: error.message },
      };
    }
  }

  /**
   * Check storage usage and growth
   */
  private async checkStorage(tenantId?: string): Promise<CheckResult> {
    try {
      // Check total storage
      const storageResult = await this.pool.query(
        `SELECT
           SUM(LENGTH(text)) as total_bytes,
           COUNT(*) as total_chunks
         FROM chunks
         WHERE $1::text IS NULL OR tenant_id = $1`,
        [tenantId || null]
      );

      const totalBytes = parseInt(storageResult.rows[0].total_bytes) || 0;
      const totalChunks = parseInt(storageResult.rows[0].total_chunks) || 0;

      // Check for rapid growth (last 24h vs previous 24h)
      const growthResult = await this.pool.query(
        `SELECT
           COUNT(CASE WHEN ts > NOW() - INTERVAL '24 hours' THEN 1 END) as recent,
           COUNT(CASE WHEN ts > NOW() - INTERVAL '48 hours' AND ts <= NOW() - INTERVAL '24 hours' THEN 1 END) as previous
         FROM chunks
         WHERE $1::text IS NULL OR tenant_id = $1`,
        [tenantId || null]
      );

      const recent = parseInt(growthResult.rows[0].recent) || 0;
      const previous = parseInt(growthResult.rows[0].previous) || 0;
      const growthRate = previous > 0 ? recent / previous : 1;

      // Warnings
      if (totalBytes > 10 * 1024 * 1024 * 1024) {
        // > 10GB
        return {
          status: 'warn',
          message: `Large storage: ${(totalBytes / 1024 / 1024 / 1024).toFixed(2)}GB`,
          details: { totalBytes, totalChunks, growthRate },
        };
      }

      if (growthRate > 2) {
        // Doubled in 24h
        return {
          status: 'warn',
          message: `Rapid growth: ${(growthRate * 100).toFixed(0)}% increase in 24h`,
          details: { totalBytes, totalChunks, growthRate },
        };
      }

      return {
        status: 'pass',
        message: `Storage normal: ${totalChunks} chunks, ${(totalBytes / 1024 / 1024).toFixed(2)}MB`,
        details: { totalBytes, totalChunks, growthRate },
      };
    } catch (error: any) {
      return {
        status: 'fail',
        message: `Storage check failed: ${error.message}`,
        details: { error: error.message },
      };
    }
  }

  /**
   * Check consolidation system health
   */
  private async checkConsolidation(tenantId?: string): Promise<CheckResult> {
    try {
      // Check last consolidation run
      const lastRunResult = await this.pool.query(
        `SELECT
           MAX(created_at) as last_run,
           COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed,
           COUNT(*) as total
         FROM consolidation_jobs
         WHERE $1::text IS NULL OR tenant_id = $1`,
        [tenantId || null]
      );

      const lastRun = lastRunResult.rows[0].last_run;
      const failed = parseInt(lastRunResult.rows[0].failed) || 0;
      const total = parseInt(lastRunResult.rows[0].total) || 0;

      // Check if consolidation is running
      const runningResult = await this.pool.query(
        `SELECT COUNT(*) as count
         FROM consolidation_jobs
         WHERE status = 'running'
           AND ($1::text IS NULL OR tenant_id = $1)`,
        [tenantId || null]
      );

      const running = parseInt(runningResult.rows[0].count) || 0;

      if (failed > total * 0.1) {
        // > 10% failure rate
        return {
          status: 'warn',
          message: `High consolidation failure rate: ${failed}/${total}`,
          details: { lastRun, failed, total, running },
        };
      }

      if (lastRun) {
        const daysSinceLastRun = (Date.now() - new Date(lastRun).getTime()) / (1000 * 60 * 60 * 24);

        if (daysSinceLastRun > 2) {
          return {
            status: 'warn',
            message: `Consolidation not run recently: ${daysSinceLastRun.toFixed(1)} days ago`,
            details: { lastRun, failed, total, running },
          };
        }
      }

      return {
        status: 'pass',
        message: running > 0
          ? `Consolidation running (${running} jobs)`
          : `Consolidation healthy (last run: ${lastRun ? new Date(lastRun).toLocaleDateString() : 'never'})`,
        details: { lastRun, failed, total, running },
      };
    } catch (error: any) {
      return {
        status: 'fail',
        message: `Consolidation check failed: ${error.message}`,
        details: { error: error.message },
      };
    }
  }

  /**
   * Check performance metrics
   */
  private async checkPerformance(tenantId?: string): Promise<CheckResult> {
    try {
      // Check query performance
      const start = Date.now();

      await this.pool.query(
        `SELECT COUNT(*) FROM session_handoffs WHERE $1::text IS NULL OR tenant_id = $1`,
        [tenantId || null]
      );

      const queryTime = Date.now() - start;

      // Check for slow queries (if pg_stat_statements is available)
      let slowQueries = 0;
      try {
        const slowQueryResult = await this.pool.query(
          `SELECT COUNT(*) as count
           FROM pg_stat_statements
           WHERE mean_exec_time > 1000`
        );
        slowQueries = parseInt(slowQueryResult.rows[0].count) || 0;
      } catch {
        // pg_stat_statements not available
      }

      if (queryTime > 500) {
        return {
          status: 'warn',
          message: `Slow query performance: ${queryTime}ms`,
          details: { queryTime, slowQueries },
        };
      }

      if (slowQueries > 10) {
        return {
          status: 'warn',
          message: `${slowQueries} slow queries detected (>1s)`,
          details: { queryTime, slowQueries },
        };
      }

      return {
        status: 'pass',
        message: `Performance good (${queryTime}ms query time)`,
        details: { queryTime, slowQueries },
      };
    } catch (error: any) {
      return {
        status: 'fail',
        message: `Performance check failed: ${error.message}`,
        details: { error: error.message },
      };
    }
  }

  /**
   * Get detailed metrics for monitoring
   */
  async getMetrics(tenantId?: string): Promise<any> {
    const [
      storage,
      handoffs,
      consolidation,
      database,
    ] = await Promise.all([
      this.getStorageMetrics(tenantId),
      this.getHandoffMetrics(tenantId),
      this.getConsolidationMetrics(tenantId),
      this.getDatabaseMetrics(),
    ]);

    return {
      timestamp: new Date(),
      tenant_id: tenantId,
      storage,
      handoffs,
      consolidation,
      database,
    };
  }

  private async getStorageMetrics(tenantId?: string) {
    const result = await this.pool.query(
      `SELECT
         COUNT(*) as total_chunks,
         SUM(LENGTH(text)) as total_bytes,
         AVG(LENGTH(text)) as avg_chunk_size
       FROM chunks
       WHERE $1::text IS NULL OR tenant_id = $1`,
      [tenantId || null]
    );

    return result.rows[0];
  }

  private async getHandoffMetrics(tenantId?: string) {
    const result = await this.pool.query(
      `SELECT
         COUNT(*) as total,
         COUNT(CASE WHEN becoming IS NOT NULL THEN 1 END) as with_becoming,
         COUNT(CASE WHEN created_at > NOW() - INTERVAL '24 hours' THEN 1 END) as recent_24h,
         AVG(significance) as avg_significance
       FROM session_handoffs
       WHERE $1::text IS NULL OR tenant_id = $1`,
      [tenantId || null]
    );

    return result.rows[0];
  }

  private async getConsolidationMetrics(tenantId?: string) {
    const result = await this.pool.query(
      `SELECT
         COUNT(*) as total_jobs,
         COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed,
         COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed,
         COUNT(CASE WHEN status = 'running' THEN 1 END) as running,
         MAX(created_at) as last_run
       FROM consolidation_jobs
       WHERE $1::text IS NULL OR tenant_id = $1`,
      [tenantId || null]
    );

    return result.rows[0];
  }

  private async getDatabaseMetrics() {
    return {
      totalConnections: this.pool.totalCount,
      idleConnections: this.pool.idleCount,
      waitingClients: this.pool.waitingCount,
    };
  }
}
