/**
 * Prometheus Metrics Exporter
 *
 * Exports metrics in Prometheus text format for scraping by Prometheus server.
 * Follows Prometheus exposition format specification.
 *
 * Metrics include:
 * - HTTP request metrics (count, latency)
 * - Database connection pool metrics
 * - Business metrics (events, handoffs, decisions)
 * - Consolidation job metrics
 * - Storage metrics
 */

import { Pool } from 'pg';

export interface PrometheusMetricsConfig {
  /**
   * Prefix for all metric names
   * @default "agent_memory"
   */
  prefix?: string;

  /**
   * Labels to add to all metrics
   * @example { environment: "production", host: "server1" }
   */
  constantLabels?: Record<string, string>;
}

export class PrometheusMetrics {
  private pool: Pool;
  private prefix: string;
  private constantLabels: string;

  // HTTP request tracking
  private httpRequestsTotal = new Map<string, number>();
  private httpRequestDuration = new Map<string, number[]>();

  constructor(pool: Pool, config: PrometheusMetricsConfig = {}) {
    this.pool = pool;
    this.prefix = config.prefix || 'agent_memory';
    this.constantLabels = this.formatLabels(config.constantLabels || {});
  }

  /**
   * Record an HTTP request
   */
  recordHttpRequest(method: string, path: string, statusCode: number, durationMs: number): void {
    const labels = { method, path, status: statusCode.toString() };
    const labelStr = this.formatLabels(labels);

    // Increment request counter
    const key = `http_requests_total${labelStr}`;
    this.httpRequestsTotal.set(key, (this.httpRequestsTotal.get(key) || 0) + 1);

    // Record duration
    const durationKey = `http_request_duration_seconds${labelStr}`;
    if (!this.httpRequestDuration.has(durationKey)) {
      this.httpRequestDuration.set(durationKey, []);
    }
    this.httpRequestDuration.get(durationKey)!.push(durationMs / 1000); // Convert to seconds

    // Keep only last 1000 durations per label set
    const durations = this.httpRequestDuration.get(durationKey)!;
    if (durations.length > 1000) {
      durations.shift();
    }
  }

  /**
   * Generate Prometheus metrics text format
   */
  async scrape(): Promise<string> {
    const lines: string[] = [];

    // Help and type metadata
    lines.push(`# HELP ${this.prefix}_up Whether the server is up`);
    lines.push(`# TYPE ${this.prefix}_up gauge`);
    lines.push(`${this.prefix}_up${this.constantLabels} 1`);
    lines.push('');

    // System info
    lines.push(`# HELP ${this.prefix}_uptime_seconds Server uptime in seconds`);
    lines.push(`# TYPE ${this.prefix}_uptime_seconds gauge`);
    lines.push(`${this.prefix}_uptime_seconds${this.constantLabels} ${process.uptime().toFixed(3)}`);
    lines.push('');

    // Memory usage
    const memUsage = process.memoryUsage();
    lines.push(`# HELP ${this.prefix}_memory_bytes Memory usage in bytes`);
    lines.push(`# TYPE ${this.prefix}_memory_bytes gauge`);
    lines.push(`${this.prefix}_memory_bytes${this.constantLabels}${this.formatLabels({ type: 'heap_used' })} ${memUsage.heapUsed}`);
    lines.push(`${this.prefix}_memory_bytes${this.constantLabels}${this.formatLabels({ type: 'heap_total' })} ${memUsage.heapTotal}`);
    lines.push(`${this.prefix}_memory_bytes${this.constantLabels}${this.formatLabels({ type: 'rss' })} ${memUsage.rss}`);
    lines.push(`${this.prefix}_memory_bytes${this.constantLabels}${this.formatLabels({ type: 'external' })} ${memUsage.external}`);
    lines.push('');

    // HTTP request metrics
    if (this.httpRequestsTotal.size > 0) {
      lines.push(`# HELP ${this.prefix}_http_requests_total Total HTTP requests`);
      lines.push(`# TYPE ${this.prefix}_http_requests_total counter`);
      for (const [metric, value] of this.httpRequestsTotal) {
        lines.push(`${this.prefix}_${metric}${this.constantLabels} ${value}`);
      }
      lines.push('');

      // Calculate percentiles for request duration
      lines.push(`# HELP ${this.prefix}_http_request_duration_seconds HTTP request duration in seconds`);
      lines.push(`# TYPE ${this.prefix}_http_request_duration_seconds histogram`);
      for (const [metric, durations] of this.httpRequestDuration) {
        if (durations.length === 0) continue;

        const sorted = durations.sort((a, b) => a - b);
        const count = sorted.length;
        const sum = sorted.reduce((a, b) => a + b, 0);

        // Buckets (standard Prometheus histogram buckets)
        const buckets = [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10];

        for (const bucket of buckets) {
          const leCount = sorted.filter(d => d <= bucket).length;
          lines.push(`${this.prefix}_${metric}_bucket{le="${bucket}"${this.constantLabels.slice(0, -1)}} ${leCount}`);
        }
        lines.push(`${this.prefix}_${metric}_bucket{le="+Inf"${this.constantLabels.slice(0, -1)}} ${count}`);
        lines.push(`${this.prefix}_${metric}_sum${this.constantLabels} ${sum.toFixed(6)}`);
        lines.push(`${this.prefix}_${metric}_count${this.constantLabels} ${count}`);
      }
      lines.push('');
    }

    // Database pool metrics
    try {
      const poolMetrics = await this.getPoolMetrics();
      lines.push(`# HELP ${this.prefix}_db_pool_connections Database connection pool connections`);
      lines.push(`# TYPE ${this.prefix}_db_pool_connections gauge`);
      lines.push(`${this.prefix}_db_pool_connections${this.constantLabels}${this.formatLabels({ state: 'total' })} ${poolMetrics.totalCount}`);
      lines.push(`${this.prefix}_db_pool_connections${this.constantLabels}${this.formatLabels({ state: 'idle' })} ${poolMetrics.idleCount}`);
      lines.push(`${this.prefix}_db_pool_connections${this.constantLabels}${this.formatLabels({ state: 'waiting' })} ${poolMetrics.waitingCount}`);
      lines.push('');
    } catch (error) {
      // Skip pool metrics if unavailable
    }

    // Business metrics from database
    try {
      const businessMetrics = await this.getBusinessMetrics();

      // Events
      lines.push(`# HELP ${this.prefix}_events_total Total number of events stored`);
      lines.push(`# TYPE ${this.prefix}_events_total gauge`);
      for (const [kind, count] of Object.entries(businessMetrics.events.byKind)) {
        lines.push(`${this.prefix}_events_total${this.constantLabels}${this.formatLabels({ kind })} ${count}`);
      }
      lines.push(`${this.prefix}_events_total${this.constantLabels}${this.formatLabels({ kind: 'all' })} ${businessMetrics.events.total}`);
      lines.push('');

      // Handoffs
      lines.push(`# HELP ${this.prefix}_handoffs_total Total number of handoffs`);
      lines.push(`# TYPE ${this.prefix}_handoffs_total gauge`);
      lines.push(`${this.prefix}_handoffs_total${this.constantLabels}${this.formatLabels({ compression_level: 'full' })} ${businessMetrics.handoffs.full}`);
      lines.push(`${this.prefix}_handoffs_total${this.constantLabels}${this.formatLabels({ compression_level: 'summary' })} ${businessMetrics.handoffs.summary}`);
      lines.push(`${this.prefix}_handoffs_total${this.constantLabels}${this.formatLabels({ compression_level: 'quick_ref' })} ${businessMetrics.handoffs.quickRef}`);
      lines.push(`${this.prefix}_handoffs_total${this.constantLabels}${this.formatLabels({ compression_level: 'all' })} ${businessMetrics.handoffs.total}`);
      lines.push('');

      // Decisions
      lines.push(`# HELP ${this.prefix}_decisions_total Total number of decisions`);
      lines.push(`# TYPE ${this.prefix}_decisions_total gauge`);
      lines.push(`${this.prefix}_decisions_total${this.constantLabels}${this.formatLabels({ status: 'active' })} ${businessMetrics.decisions.active}`);
      lines.push(`${this.prefix}_decisions_total${this.constantLabels}${this.formatLabels({ status: 'superseded' })} ${businessMetrics.decisions.superseded}`);
      lines.push(`${this.prefix}_decisions_total${this.constantLabels}${this.formatLabels({ status: 'all' })} ${businessMetrics.decisions.total}`);
      lines.push('');

      // Consolidation
      lines.push(`# HELP ${this.prefix}_consolidation_jobs_total Total consolidation jobs run`);
      lines.push(`# TYPE ${this.prefix}_consolidation_jobs_total gauge`);
      for (const [jobType, count] of Object.entries(businessMetrics.consolidation)) {
        lines.push(`${this.prefix}_consolidation_jobs_total${this.constantLabels}${this.formatLabels({ job_type: jobType })} ${count}`);
      }
      lines.push('');

      // Storage
      lines.push(`# HELP ${this.prefix}_storage_bytes Total storage used in bytes`);
      lines.push(`# TYPE ${this.prefix}_storage_bytes gauge`);
      lines.push(`${this.prefix}_storage_bytes${this.constantLabels}${this.formatLabels({ type: 'text' })} ${businessMetrics.storage.textBytes}`);
      lines.push('');

      // Knowledge notes
      lines.push(`# HELP ${this.prefix}_knowledge_notes_total Total knowledge notes`);
      lines.push(`# TYPE ${this.prefix}_knowledge_notes_total gauge`);
      lines.push(`${this.prefix}_knowledge_notes_total${this.constantLabels} ${businessMetrics.knowledgeNotes}`);
      lines.push('');

    } catch (error) {
      // Add error metric
      lines.push(`# HELP ${this.prefix}_scrape_error Whether there was an error scraping business metrics`);
      lines.push(`# TYPE ${this.prefix}_scrape_error gauge`);
      lines.push(`${this.prefix}_scrape_error${this.constantLabels} 1`);
      lines.push('');
    }

    return lines.join('\n');
  }

  /**
   * Get database connection pool metrics
   */
  private async getPoolMetrics(): Promise<{
    totalCount: number;
    idleCount: number;
    waitingCount: number;
  }> {
    return {
      totalCount: this.pool.totalCount,
      idleCount: this.pool.idleCount,
      waitingCount: this.pool.waitingCount,
    };
  }

  /**
   * Get business metrics from database
   */
  private async getBusinessMetrics(): Promise<{
    events: {
      total: number;
      byKind: Record<string, number>;
    };
    handoffs: {
      total: number;
      full: number;
      summary: number;
      quickRef: number;
    };
    decisions: {
      total: number;
      active: number;
      superseded: number;
    };
    consolidation: Record<string, number>;
    storage: {
      textBytes: number;
    };
    knowledgeNotes: number;
  }> {
    const client = await this.pool.connect();

    try {
      // Get event stats by kind
      const eventResult = await client.query(
        `SELECT kind, COUNT(*) as count
         FROM chunks
         GROUP BY kind`
      );

      const byKind: Record<string, number> = {};
      let total = 0;
      for (const row of eventResult.rows) {
        byKind[row.kind] = parseInt(row.count);
        total += parseInt(row.count);
      }

      // Get handoff stats
      const handoffResult = await client.query(
        `SELECT
           COUNT(*) as total,
           COUNT(CASE WHEN compression_level = 'full' THEN 1 END) as full_count,
           COUNT(CASE WHEN compression_level = 'summary' THEN 1 END) as summary_count,
           COUNT(CASE WHEN compression_level = 'quick_ref' THEN 1 END) as quick_ref_count
         FROM session_handoffs`
      );

      // Get decision stats
      const decisionResult = await client.query(
        `SELECT
           COUNT(*) as total,
           COUNT(CASE WHEN status = 'active' THEN 1 END) as active,
           COUNT(CASE WHEN status = 'superseded' THEN 1 END) as superseded
         FROM decisions`
      );

      // Get consolidation job stats
      const consolidationResult = await client.query(
        `SELECT job_type, COUNT(*) as count
         FROM consolidation_jobs
         GROUP BY job_type`
      );

      const consolidation: Record<string, number> = {};
      for (const row of consolidationResult.rows) {
        consolidation[row.job_type] = parseInt(row.count);
      }

      // Get storage stats
      const storageResult = await client.query(
        `SELECT SUM(LENGTH(text)) as total_text_bytes
         FROM chunks`
      );

      // Get knowledge notes count
      let knowledgeNotes = 0;
      try {
        const knowledgeResult = await client.query(
          `SELECT COUNT(*) as count FROM knowledge_notes`
        );
        knowledgeNotes = parseInt(knowledgeResult.rows[0].count);
      } catch {
        // Table might not exist
      }

      return {
        events: { total, byKind },
        handoffs: {
          total: parseInt(handoffResult.rows[0].total),
          full: parseInt(handoffResult.rows[0].full_count),
          summary: parseInt(handoffResult.rows[0].summary_count),
          quickRef: parseInt(handoffResult.rows[0].quick_ref_count),
        },
        decisions: {
          total: parseInt(decisionResult.rows[0].total),
          active: parseInt(decisionResult.rows[0].active),
          superseded: parseInt(decisionResult.rows[0].superseded),
        },
        consolidation,
        storage: {
          textBytes: parseInt(storageResult.rows[0].total_text_bytes) || 0,
        },
        knowledgeNotes,
      };
    } finally {
      client.release();
    }
  }

  /**
   * Format labels for Prometheus metric
   */
  private formatLabels(labels: Record<string, string>): string {
    const entries = Object.entries(labels).map(([key, value]) => {
      // Escape values according to Prometheus format
      const escaped = value.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n');
      return `${key}="${escaped}"`;
    });

    if (entries.length === 0) {
      return '';
    }

    return `{${entries.join(',')}}`;
  }
}
