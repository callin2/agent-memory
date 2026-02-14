import { useState } from 'react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { format } from 'date-fns'

interface DataPoint {
  timestamp: string
  value: number
  test_count: number
}

interface TrendChartProps {
  data: DataPoint[]
  metric: 'precision' | 'recall' | 'f1' | 'latency'
  title: string
  color?: string
  unit?: string
}

const timeRanges = [
  { value: '1h', label: '1 Hour' },
  { value: '24h', label: '24 Hours' },
  { value: '7d', label: '7 Days' },
  { value: '30d', label: '30 Days' },
]

const metricColors = {
  precision: '#10b981',
  recall: '#3b82f6',
  f1: '#8b5cf6',
  latency: '#f59e0b',
}

export function TrendChart({ data, metric, title, color, unit }: TrendChartProps) {
  const [selectedRange, setSelectedRange] = useState('24h')
  const chartColor = color || metricColors[metric]

  const formatXAxis = (tickItem: string) => {
    const date = new Date(tickItem)
    return format(date, 'HH:mm')
  }

  const formatTooltip = (value: any, _name: string | undefined, props: any) => {
    const payload = props?.payload
    if (!payload || !payload[0]) return `${value}${unit || ''}`
    const date = new Date(payload[0].payload?.timestamp)
    return [value, format(date, 'MMM d, HH:mm')]
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>{title}</CardTitle>
          <div className="flex gap-2">
            {timeRanges.map((range) => (
              <Button
                key={range.value}
                variant={selectedRange === range.value ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedRange(range.value)}
              >
                {range.label}
              </Button>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {data.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis
                dataKey="timestamp"
                tickFormatter={formatXAxis}
                className="text-xs"
              />
              <YAxis className="text-xs" />
              <Tooltip formatter={formatTooltip} />
              <Legend />
              <Line
                type="monotone"
                dataKey="value"
                stroke={chartColor}
                strokeWidth={2}
                dot={{ r: 4 }}
                activeDot={{ r: 6 }}
                name={`${metric} score`}
              />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex items-center justify-center h-[300px] text-muted-foreground">
            No data available for the selected time range
          </div>
        )}
      </CardContent>
    </Card>
  )
}
