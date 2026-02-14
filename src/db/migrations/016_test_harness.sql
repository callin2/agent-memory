-- Migration 016: Test Harness Tables
-- Creates tables for tracking test runs, metrics, and validation feedback

-- Test runs table for storing test execution snapshots
CREATE TABLE IF NOT EXISTS test_runs (
  run_id TEXT PRIMARY KEY,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  total_tests INTEGER NOT NULL DEFAULT 0,
  passed_tests INTEGER NOT NULL DEFAULT 0,
  failed_tests INTEGER NOT NULL DEFAULT 0,
  skipped_tests INTEGER NOT NULL DEFAULT 0,
  avg_precision NUMERIC(5, 4) NOT NULL DEFAULT 0.0,
  avg_recall NUMERIC(5, 4) NOT NULL DEFAULT 0.0,
  avg_f1 NUMERIC(5, 4) NOT NULL DEFAULT 0.0,
  avg_latency_ms NUMERIC(10, 2) NOT NULL DEFAULT 0.0,
  p50_latency_ms NUMERIC(10, 2) NOT NULL DEFAULT 0.0,
  p95_latency_ms NUMERIC(10, 2) NOT NULL DEFAULT 0.0,
  p99_latency_ms NUMERIC(10, 2) NOT NULL DEFAULT 0.0,
  total_tokens INTEGER NOT NULL DEFAULT 0,
  avg_tokens_per_query NUMERIC(10, 2) NOT NULL DEFAULT 0.0
);

-- Validation feedback table for storing user feedback on test results
CREATE TABLE IF NOT EXISTS validation_feedback (
  feedback_id TEXT PRIMARY KEY,
  test_run_id TEXT NOT NULL REFERENCES test_runs(run_id) ON DELETE CASCADE,
  query_id TEXT NOT NULL,
  helpful BOOLEAN NOT NULL,
  comments TEXT,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for test runs
CREATE INDEX IF NOT EXISTS idx_test_runs_timestamp ON test_runs(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_test_runs_f1 ON test_runs(avg_f1 DESC);

-- Index for validation feedback lookups
CREATE INDEX IF NOT EXISTS idx_validation_feedback_test_run ON validation_feedback(test_run_id);
CREATE INDEX IF NOT EXISTS idx_validation_feedback_timestamp ON validation_feedback(timestamp DESC);

-- Comment on tables
COMMENT ON TABLE test_runs IS 'Stores test execution snapshots with metrics for analytics';
COMMENT ON TABLE validation_feedback IS 'Stores user feedback on test result quality';

-- Comment on important columns
COMMENT ON COLUMN test_runs.avg_precision IS 'Average precision score across all retrieval tests';
COMMENT ON COLUMN test_runs.avg_recall IS 'Average recall score across all retrieval tests';
COMMENT ON COLUMN test_runs.avg_f1 IS 'Average F1 score (harmonic mean of precision and recall)';
COMMENT ON COLUMN validation_feedback.helpful IS 'Whether the retrieval result was helpful (true) or not (false)';
