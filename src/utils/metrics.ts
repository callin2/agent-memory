/**
 * Metrics collection and reporting
 */

export interface MetricData {
  operation: string;
  duration: number;
  success: boolean;
  error?: string;
  timestamp?: number;
}

export interface MetricsSnapshot {
  total_requests: number;
  successful_requests: number;
  failed_requests: number;
  avg_latency_ms: number;
  p50_latency_ms: number;
  p95_latency_ms: number;
  p99_latency_ms: number;
  operations: Record<string, OperationMetrics>;
}

export interface OperationMetrics {
  count: number;
  failures: number;
  avg_latency_ms: number;
  p95_latency_ms: number;
}

class MetricsService {
  private metrics: Map<string, MetricData[]> = new Map();
  private maxSamples: number = 10000;

  constructor() {
    // Register globally for access from decorators
    (global as any).__metricsService = this;
  }

  /**
   * Record a metric
   */
  record(data: MetricData): void {
    const operation = data.operation || 'unknown';
    const record = { ...data, timestamp: Date.now() };

    if (!this.metrics.has(operation)) {
      this.metrics.set(operation, []);
    }

    const samples = this.metrics.get(operation)!;
    samples.push(record);

    // Keep only recent samples
    if (samples.length > this.maxSamples) {
      samples.shift();
    }
  }

  /**
   * Get metrics snapshot for all operations
   */
  getSnapshot(): MetricsSnapshot {
    let totalRequests = 0;
    let successfulRequests = 0;
    let failedRequests = 0;
    const allLatencies: number[] = [];
    const operations: Record<string, OperationMetrics> = {};

    for (const [operation, samples] of this.metrics.entries()) {
      const latencies = samples.map((s) => s.duration);
      const failures = samples.filter((s) => !s.success).length;

      totalRequests += samples.length;
      successfulRequests += samples.length - failures;
      failedRequests += failures;
      allLatencies.push(...latencies);

      latencies.sort((a, b) => a - b);

      operations[operation] = {
        count: samples.length,
        failures,
        avg_latency_ms: latencies.reduce((sum, l) => sum + l, 0) / latencies.length,
        p95_latency_ms: latencies[Math.floor(latencies.length * 0.95)] || 0,
      };
    }

    allLatencies.sort((a, b) => a - b);

    return {
      total_requests: totalRequests,
      successful_requests: successfulRequests,
      failed_requests: failedRequests,
      avg_latency_ms:
        allLatencies.length > 0
          ? allLatencies.reduce((sum, l) => sum + l, 0) / allLatencies.length
          : 0,
      p50_latency_ms: allLatencies[Math.floor(allLatencies.length * 0.5)] || 0,
      p95_latency_ms: allLatencies[Math.floor(allLatencies.length * 0.95)] || 0,
      p99_latency_ms: allLatencies[Math.floor(allLatencies.length * 0.99)] || 0,
      operations,
    };
  }

  /**
   * Get metrics for a specific operation
   */
  getOperationMetrics(operation: string): OperationMetrics | null {
    const samples = this.metrics.get(operation);
    if (!samples || samples.length === 0) {
      return null;
    }

    const latencies = samples.map((s) => s.duration).sort((a, b) => a - b);
    const failures = samples.filter((s) => !s.success).length;

    return {
      count: samples.length,
      failures,
      avg_latency_ms: latencies.reduce((sum, l) => sum + l, 0) / latencies.length,
      p95_latency_ms: latencies[Math.floor(latencies.length * 0.95)] || 0,
    };
  }

  /**
   * Reset all metrics
   */
  reset(): void {
    this.metrics.clear();
  }

  /**
   * Get metrics in Prometheus format
   */
  getPrometheusMetrics(): string {
    const snapshot = this.getSnapshot();
    const lines: string[] = [];

    // Global metrics
    lines.push('# HELP agent_memory_total_requests Total number of requests');
    lines.push('# TYPE agent_memory_total_requests counter');
    lines.push(`agent_memory_total_requests ${snapshot.total_requests}`);

    lines.push('# HELP agent_memory_successful_requests Total successful requests');
    lines.push('# TYPE agent_memory_successful_requests counter');
    lines.push(`agent_memory_successful_requests ${snapshot.successful_requests}`);

    lines.push('# HELP agent_memory_failed_requests Total failed requests');
    lines.push('# TYPE agent_memory_failed_requests counter');
    lines.push(`agent_memory_failed_requests ${snapshot.failed_requests}`);

    // Latency metrics
    lines.push('# HELP agent_memory_latency_ms Request latency in milliseconds');
    lines.push('# TYPE agent_memory_latency_ms histogram');
    lines.push(`agent_memory_latency_ms_avg ${snapshot.avg_latency_ms.toFixed(2)}`);
    lines.push(`agent_memory_latency_ms_p50 ${snapshot.p50_latency_ms}`);
    lines.push(`agent_memory_latency_ms_p95 ${snapshot.p95_latency_ms}`);
    lines.push(`agent_memory_latency_ms_p99 ${snapshot.p99_latency_ms}`);

    // Per-operation metrics
    for (const [operation, metrics] of Object.entries(snapshot.operations)) {
      const safeOpName = operation.replace(/[^a-zA-Z0-9_]/g, '_');

      lines.push(
        `agent_memory_operation_count{operation="${safeOpName}"} ${metrics.count}`
      );
      lines.push(
        `agent_memory_operation_failures{operation="${safeOpName}"} ${metrics.failures}`
      );
      lines.push(
        `agent_memory_operation_latency_avg{operation="${safeOpName}"} ${metrics.avg_latency_ms.toFixed(2)}`
      );
      lines.push(
        `agent_memory_operation_latency_p95{operation="${safeOpName}"} ${metrics.p95_latency_ms}`
      );
    }

    return lines.join('\n');
  }
}

// Singleton instance
export const metricsService = new MetricsService();
