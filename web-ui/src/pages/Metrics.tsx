import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { MetricCard } from '@/components/metrics/MetricCard'
import { TrendChart } from '@/components/metrics/TrendChart'
import { TestRunComparison } from '@/components/metrics/TestRunComparison'
import {
  getMetrics,
  getMetricsHistory,
  getTestRuns,
} from '@/services/metrics'
import { Activity, Clock, Target, Zap, ThumbsUp, ThumbsDown } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'

export function Metrics() {
  const [timeRange, setTimeRange] = useState('24h')
  const [selectedMetric, setSelectedMetric] = useState('f1')

  // Fetch aggregated metrics
  const { data: metrics } = useQuery({
    queryKey: ['metrics', timeRange],
    queryFn: () => getMetrics(timeRange),
    refetchInterval: 30000, // Refresh every 30 seconds
  })

  // Fetch metrics history for trend chart
  const { data: history } = useQuery({
    queryKey: ['metricsHistory', selectedMetric, timeRange],
    queryFn: () => getMetricsHistory(selectedMetric, timeRange),
    refetchInterval: 30000,
  })

  // Fetch test runs for comparison
  const { data: testRuns, isLoading: testRunsLoading } = useQuery({
    queryKey: ['testRuns'],
    queryFn: () => getTestRuns(50, 0),
    refetchInterval: 60000, // Refresh every minute
  })

  const handleTimeRangeChange = (range: string) => {
    setTimeRange(range)
  }

  const handleMetricChange = (metric: string) => {
    setSelectedMetric(metric)
  }

  const metricTitles = {
    precision: 'Precision Trend',
    recall: 'Recall Trend',
    f1: 'F1 Score Trend',
    latency: 'Latency Trend',
  }

  const metricUnits = {
    precision: '%',
    recall: '%',
    f1: '%',
    latency: 'ms',
  }

  return (
    <div className="space-y-6" data-testid="metrics-page">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Performance Metrics</h1>
          <p className="text-muted-foreground">
            Monitor and analyze memory system testing performance
          </p>
        </div>
        <div className="flex gap-2">
          {['1h', '24h', '7d', '30d'].map((range) => (
            <Button
              key={range}
              variant={timeRange === range ? 'default' : 'outline'}
              size="sm"
              onClick={() => handleTimeRangeChange(range)}
              title={`Select ${range === '1h' ? '1 Hour' : range === '24h' ? '24 Hours' : range === '7d' ? '7 Days' : '30 Days'} time range - ${timeRange === range ? 'Currently selected' : 'Click to'} view metrics from the ${range === '1h' ? 'last hour' : range === '24h' ? 'last 24 hours' : range === '7d' ? 'last 7 days' : 'last 30 days'}`}
            >
              {range === '1h' ? '1 Hour' : range === '24h' ? '24 Hours' : range === '7d' ? '7 Days' : '30 Days'}
            </Button>
          ))}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <MetricCard
          title="Total Tests"
          value={metrics?.total_tests || 0}
          icon={<Activity className="h-4 w-4" />}
          color="blue"
        />
        <MetricCard
          title="Avg Precision"
          value={((metrics?.avg_precision || 0) * 100).toFixed(2)}
          unit="%"
          icon={<Target className="h-4 w-4" />}
          color="green"
        />
        <MetricCard
          title="Avg Recall"
          value={((metrics?.avg_recall || 0) * 100).toFixed(2)}
          unit="%"
          icon={<Zap className="h-4 w-4" />}
          color="yellow"
        />
        <MetricCard
          title="Avg F1 Score"
          value={((metrics?.avg_f1 || 0) * 100).toFixed(2)}
          unit="%"
          icon={<Activity className="h-4 w-4" />}
          color="blue"
        />
        <MetricCard
          title="Avg Latency"
          value={metrics?.avg_latency_ms?.toFixed(2) || '0'}
          unit="ms"
          icon={<Clock className="h-4 w-4" />}
          color="blue"
        />
      </div>

      {/* Performance Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <MetricCard
          title="P50 Latency"
          value={metrics?.p50_latency_ms?.toFixed(2) || '0'}
          unit="ms"
          description="Median response time"
          color="blue"
        />
        <MetricCard
          title="P95 Latency"
          value={metrics?.p95_latency_ms?.toFixed(2) || '0'}
          unit="ms"
          description="95th percentile response time"
          color="yellow"
        />
        <MetricCard
          title="P99 Latency"
          value={metrics?.p99_latency_ms?.toFixed(2) || '0'}
          unit="ms"
          description="99th percentile response time"
          color="red"
        />
      </div>

      {/* Coverage and User Feedback */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <MetricCard
          title="Test Coverage"
          value={metrics?.coverage_percentage?.toFixed(1) || '0'}
          unit="%"
          description="Percentage of passed tests"
          color="green"
        />
        <MetricCard
          title="Helpful Feedback"
          value={metrics?.thumbs_up_percentage?.toFixed(1) || '0'}
          unit="%"
          icon={<ThumbsUp className="h-4 w-4" />}
          description="Positive user feedback"
          color="green"
        />
        <MetricCard
          title="Not Helpful"
          value={metrics?.thumbs_down_percentage?.toFixed(1) || '0'}
          unit="%"
          icon={<ThumbsDown className="h-4 w-4" />}
          description="Negative user feedback"
          color="red"
        />
      </div>

      {/* Token Usage */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <MetricCard
          title="Total Tokens"
          value={metrics?.total_tokens?.toLocaleString() || '0'}
          description={`Across ${metrics?.total_tests || 0} tests`}
          color="blue"
        />
        <MetricCard
          title="Avg Tokens per Query"
          value={metrics?.avg_tokens_per_query?.toFixed(0) || '0'}
          description="Token efficiency ratio"
          color="blue"
        />
      </div>

      {/* Analytics Tabs */}
      <Tabs defaultValue="trends" className="space-y-4">
        <TabsList>
          <TabsTrigger value="trends" title="Trend Analysis tab - View metric trends over time to identify performance patterns, improvements, or regressions">
            Trend Analysis
          </TabsTrigger>
          <TabsTrigger value="comparison" title="Test Run Comparison tab - Compare different test runs side by side to analyze performance variations and identify differences">
            Test Run Comparison
          </TabsTrigger>
          <TabsTrigger value="recent" title="Recent Test Runs tab - View detailed results from the most recent test runs to monitor current system performance">
            Recent Test Runs
          </TabsTrigger>
        </TabsList>

        <TabsContent value="trends" className="space-y-4">
          <div className="flex gap-2 mb-4">
            {['precision', 'recall', 'f1', 'latency'].map((metric) => (
              <Button
                key={metric}
                variant={selectedMetric === metric ? 'default' : 'outline'}
                size="sm"
                onClick={() => handleMetricChange(metric)}
                title={`View ${metric.toUpperCase()} trend - ${selectedMetric === metric ? 'Currently showing' : 'Click to'} display ${metric} changes over time in the chart below`}
              >
                {metric.toUpperCase()}
              </Button>
            ))}
          </div>

          <TrendChart
            data={history?.data_points || []}
            metric={selectedMetric as 'precision' | 'recall' | 'f1' | 'latency'}
            title={metricTitles[selectedMetric as keyof typeof metricTitles]}
            unit={metricUnits[selectedMetric as keyof typeof metricUnits]}
          />
        </TabsContent>

        <TabsContent value="comparison">
          {testRunsLoading ? (
            <Card>
              <CardContent className="flex items-center justify-center h-64">
                <div className="text-muted-foreground">Loading test runs...</div>
              </CardContent>
            </Card>
          ) : (
            <TestRunComparison testRuns={testRuns || []} />
          )}
        </TabsContent>

        <TabsContent value="recent">
          <Card>
            <CardHeader>
              <CardTitle>Recent Test Runs</CardTitle>
            </CardHeader>
            <CardContent>
              {testRunsLoading ? (
                <div className="text-center py-8 text-muted-foreground">Loading...</div>
              ) : !testRuns || testRuns.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No test runs available
                </div>
              ) : (
                <div className="space-y-4">
                  {testRuns.slice(0, 10).map((run) => (
                    <div
                      key={run.run_id}
                      className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex-1">
                        <div className="font-medium">
                          {new Date(run.timestamp).toLocaleString()}
                        </div>
                        <div className="text-sm text-muted-foreground mt-1">
                          Tests: {run.passed_tests}/{run.total_tests} passed
                        </div>
                      </div>
                      <div className="flex gap-6 text-sm">
                        <div>
                          <div className="text-muted-foreground">Precision</div>
                          <div className="font-medium">{(run.avg_precision * 100).toFixed(1)}%</div>
                        </div>
                        <div>
                          <div className="text-muted-foreground">Recall</div>
                          <div className="font-medium">{(run.avg_recall * 100).toFixed(1)}%</div>
                        </div>
                        <div>
                          <div className="text-muted-foreground">F1</div>
                          <div className="font-medium">{(run.avg_f1 * 100).toFixed(1)}%</div>
                        </div>
                        <div>
                          <div className="text-muted-foreground">Latency</div>
                          <div className="font-medium">{run.avg_latency_ms.toFixed(0)}ms</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
