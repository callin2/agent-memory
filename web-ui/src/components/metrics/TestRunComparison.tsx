import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Download, ArrowRight } from 'lucide-react'

interface TestRun {
  run_id: string
  timestamp: string
  total_tests: number
  passed_tests: number
  failed_tests: number
  avg_precision: number
  avg_recall: number
  avg_f1: number
  avg_latency_ms: number
  p95_latency_ms: number
  total_tokens: number
}

interface TestRunComparisonProps {
  testRuns: TestRun[]
}

interface MetricDiff {
  label: string
  baseline: number | string
  comparison: number | string
  diff: number
  improved: boolean
  format?: 'percentage' | 'milliseconds' | 'number'
}

export function TestRunComparison({ testRuns }: TestRunComparisonProps) {
  const [baselineRunId, setBaselineRunId] = useState<string | null>(null)
  const [comparisonRunId, setComparisonRunId] = useState<string | null>(null)

  const baseline = testRuns.find((r) => r.run_id === baselineRunId)
  const comparison = testRuns.find((r) => r.run_id === comparisonRunId)

  const calculateDiff = (
    baseline: number,
    comparison: number,
    lowerIsBetter = false
  ): { diff: number; improved: boolean } => {
    if (baseline === 0 || comparison === 0) {
      return { diff: 0, improved: false }
    }

    const diff = ((comparison - baseline) / baseline) * 100
    const improved = lowerIsBetter ? diff < 0 : diff > 0

    return { diff: Math.abs(diff), improved }
  }

  const getMetricsDiff = (): MetricDiff[] => {
    if (!baseline || !comparison) return []

    return [
      {
        label: 'Total Tests',
        baseline: baseline.total_tests,
        comparison: comparison.total_tests,
        diff: comparison.total_tests - baseline.total_tests,
        improved: comparison.total_tests >= baseline.total_tests,
        format: 'number',
      },
      {
        label: 'Pass Rate',
        baseline: `${((baseline.passed_tests / baseline.total_tests) * 100).toFixed(1)}%`,
        comparison: `${((comparison.passed_tests / comparison.total_tests) * 100).toFixed(1)}%`,
        ...calculateDiff(
          baseline.passed_tests / baseline.total_tests,
          comparison.passed_tests / comparison.total_tests
        ),
        format: 'percentage',
      },
      {
        label: 'Avg Precision',
        baseline: (baseline.avg_precision * 100).toFixed(2),
        comparison: (comparison.avg_f1 * 100).toFixed(2),
        ...calculateDiff(baseline.avg_precision, comparison.avg_precision),
        format: 'percentage',
      },
      {
        label: 'Avg Recall',
        baseline: (baseline.avg_recall * 100).toFixed(2),
        comparison: (comparison.avg_recall * 100).toFixed(2),
        ...calculateDiff(baseline.avg_recall, comparison.avg_recall),
        format: 'percentage',
      },
      {
        label: 'Avg F1 Score',
        baseline: (baseline.avg_f1 * 100).toFixed(2),
        comparison: (comparison.avg_f1 * 100).toFixed(2),
        ...calculateDiff(baseline.avg_f1, comparison.avg_f1),
        format: 'percentage',
      },
      {
        label: 'Avg Latency',
        baseline: baseline.avg_latency_ms.toFixed(2),
        comparison: comparison.avg_latency_ms.toFixed(2),
        ...calculateDiff(baseline.avg_latency_ms, comparison.avg_latency_ms, true),
        format: 'milliseconds',
      },
      {
        label: 'P95 Latency',
        baseline: baseline.p95_latency_ms.toFixed(2),
        comparison: comparison.p95_latency_ms.toFixed(2),
        ...calculateDiff(baseline.p95_latency_ms, comparison.p95_latency_ms, true),
        format: 'milliseconds',
      },
    ]
  }

  const metricsDiff = getMetricsDiff()

  const exportComparison = () => {
    if (!baseline || !comparison) return

    const report = {
      generated_at: new Date().toISOString(),
      baseline_run: {
        run_id: baseline.run_id,
        timestamp: baseline.timestamp,
      },
      comparison_run: {
        run_id: comparison.run_id,
        timestamp: comparison.timestamp,
      },
      metrics_comparison: metricsDiff,
    }

    const blob = new Blob([JSON.stringify(report, null, 2)], {
      type: 'application/json',
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `comparison_${baseline.run_id}_vs_${comparison.run_id}.json`
    a.click()
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Test Run Comparison</CardTitle>
          {baseline && comparison && (
            <Button size="sm" variant="outline" onClick={exportComparison}>
              <Download className="h-4 w-4 mr-2" />
              Export Report
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Baseline Run</label>
            <Select onValueChange={setBaselineRunId}>
              <SelectTrigger>
                <SelectValue placeholder="Select baseline run" />
              </SelectTrigger>
              <SelectContent>
                {testRuns.map((run) => (
                  <SelectItem key={run.run_id} value={run.run_id}>
                    {new Date(run.timestamp).toLocaleString()} - F1:{(run.avg_f1 * 100).toFixed(1)}%
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Comparison Run</label>
            <Select onValueChange={setComparisonRunId}>
              <SelectTrigger>
                <SelectValue placeholder="Select comparison run" />
              </SelectTrigger>
              <SelectContent>
                {testRuns.map((run) => (
                  <SelectItem key={run.run_id} value={run.run_id}>
                    {new Date(run.timestamp).toLocaleString()} - F1:{(run.avg_f1 * 100).toFixed(1)}%
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {baseline && comparison && (
          <>
            <Separator />

            <div className="space-y-4">
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <Badge variant="outline">Baseline</Badge>
                  <span>{new Date(baseline.timestamp).toLocaleString()}</span>
                </div>
                <ArrowRight className="h-4 w-4" />
                <div className="flex items-center gap-2">
                  <Badge variant="outline">Comparison</Badge>
                  <span>{new Date(comparison.timestamp).toLocaleString()}</span>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3">
                {metricsDiff.map((metric, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-3 border rounded-lg"
                  >
                    <div className="flex-1">
                      <div className="text-sm font-medium">{metric.label}</div>
                      <div className="flex items-center gap-4 mt-1">
                        <span className="text-sm text-muted-foreground">
                          {metric.baseline}
                        </span>
                        <ArrowRight className="h-3 w-3 text-muted-foreground" />
                        <span className="text-sm font-medium">{metric.comparison}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge
                        variant={metric.improved ? 'default' : 'destructive'}
                        className="min-w-[80px] justify-center"
                      >
                        {metric.improved ? 'Improved' : 'Degraded'}
                      </Badge>
                      <span
                        className={`text-sm font-medium ${
                          metric.improved ? 'text-green-600' : 'text-red-600'
                        }`}
                      >
                        {metric.diff > 0 ? '+' : ''}
                        {metric.diff.toFixed(2)}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
