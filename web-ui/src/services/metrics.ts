import api from './api'

export interface MetricsAggregation {
  time_range: string
  total_tests: number
  avg_precision: number
  avg_recall: number
  avg_f1: number
  avg_latency_ms: number
  p50_latency_ms: number
  p95_latency_ms: number
  p99_latency_ms: number
  total_tokens: number
  avg_tokens_per_query: number
  coverage_percentage: number
  thumbs_up_percentage: number
  thumbs_down_percentage: number
}

export interface TestRun {
  run_id: string
  timestamp: string
  total_tests: number
  passed_tests: number
  failed_tests: number
  skipped_tests: number
  avg_precision: number
  avg_recall: number
  avg_f1: number
  avg_latency_ms: number
  p50_latency_ms: number
  p95_latency_ms: number
  p99_latency_ms: number
  total_tokens: number
  avg_tokens_per_query: number
}

export interface MetricsHistory {
  metric: string
  time_range: string
  data_points: Array<{
    timestamp: string
    value: number
    test_count: number
  }>
}

export interface ValidationFeedback {
  feedback_id: string
  test_run_id: string
  query_id: string
  helpful: boolean
  comments?: string
  timestamp: string
}

export interface CreateTestRunInput {
  total_tests: number
  passed_tests: number
  failed_tests: number
  skipped_tests: number
  avg_precision: number
  avg_recall: number
  avg_f1: number
  avg_latency_ms: number
  p50_latency_ms: number
  p95_latency_ms: number
  p99_latency_ms: number
  total_tokens: number
  avg_tokens_per_query: number
}

export interface CreateFeedbackInput {
  test_run_id: string
  query_id: string
  helpful: boolean
  comments?: string
}

/**
 * Get aggregated metrics for a time range
 */
export async function getMetrics(timeRange: string = '24h'): Promise<MetricsAggregation> {
  const response = await api.get<MetricsAggregation>('/v1/test-harness/metrics', {
    params: { time_range: timeRange },
  })
  return response.data
}

/**
 * Get metrics history for trend charts
 */
export async function getMetricsHistory(
  metric: string = 'f1',
  timeRange: string = '24h'
): Promise<MetricsHistory> {
  const response = await api.get<MetricsHistory>('/v1/test-harness/metrics/history', {
    params: { metric, time_range: timeRange },
  })
  return response.data
}

/**
 * Create a new test run snapshot
 */
export async function createTestRun(input: CreateTestRunInput): Promise<TestRun> {
  const response = await api.post<TestRun>('/v1/test-harness/test-runs', input)
  return response.data
}

/**
 * Get all test runs
 */
export async function getTestRuns(limit: number = 50, offset: number = 0): Promise<TestRun[]> {
  const response = await api.get<{ test_runs: TestRun[] }>('/v1/test-harness/test-runs', {
    params: { limit, offset },
  })
  return response.data.test_runs
}

/**
 * Get a specific test run with feedback
 */
export async function getTestRun(runId: string): Promise<TestRun & { feedback: ValidationFeedback[] }> {
  const response = await api.get<TestRun & { feedback: ValidationFeedback[] }>(
    `/v1/test-harness/test-runs/${runId}`
  )
  return response.data
}

/**
 * Submit validation feedback
 */
export async function submitFeedback(input: CreateFeedbackInput): Promise<ValidationFeedback> {
  const response = await api.post<ValidationFeedback>('/v1/test-harness/feedback', input)
  return response.data
}
