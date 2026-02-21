import { Task, TaskStatus } from '@/services/tasks'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

interface GanttChartProps {
  tasks: Task[]
}

export function GanttChart({ tasks }: GanttChartProps) {
  // Filter tasks that have dates
  const tasksWithDates = tasks.filter(
    (task) => task.start_date || task.due_date
  )

  // Prepare data for Gantt chart
  const chartData = tasksWithDates.map((task) => {
    const startDate = task.start_date ? new Date(task.start_date) : new Date()
    const endDate = task.due_date ? new Date(task.due_date) : new Date(startDate.getTime() + 7 * 24 * 60 * 60 * 1000)

    const duration = endDate.getTime() - startDate.getTime()
    const dayDuration = duration / (24 * 60 * 60 * 1000)

    return {
      id: task.task_id,
      name: task.title.length > 25 ? task.title.substring(0, 25) + '...' : task.title,
      start: startDate.getTime(),
      end: endDate.getTime(),
      duration: dayDuration,
      progress: task.progress_percentage / 100,
      status: task.status,
      priority: task.priority,
    }
  })

  const getStatusColor = (status: TaskStatus) => {
    const colors: Record<TaskStatus, string> = {
      backlog: '#9ca3af',
      open: '#60a5fa',
      doing: '#818cf8',
      review: '#a78bfa',
      blocked: '#f87171',
      done: '#34d399',
    }
    return colors[status] || '#9ca3af'
  }

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload
      return (
        <div className="bg-background border rounded-lg p-3 shadow-lg">
          <p className="font-semibold">{data.name}</p>
          <p className="text-sm text-muted-foreground">
            Duration: {data.duration.toFixed(1)} days
          </p>
          <p className="text-sm text-muted-foreground">
            Progress: {(data.progress * 100).toFixed(0)}%
          </p>
          <p className="text-sm">
            Status: <span style={{ color: getStatusColor(data.status) }}>{data.status}</span>
          </p>
        </div>
      )
    }
    return null
  }

  if (tasksWithDates.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 border rounded-lg bg-muted">
        <p className="text-muted-foreground">
          No tasks with dates to display. Add start dates or due dates to tasks to see timeline.
        </p>
      </div>
    )
  }

  // Find min and max dates for axis
  const allDates = chartData.flatMap((d) => [d.start, d.end])
  const minDate = Math.min(...allDates)
  const maxDate = Math.max(...allDates)

  // Format date for display
  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  return (
    <div className="space-y-4">
      <ResponsiveContainer width="100%" height={400}>
        <BarChart
          layout="vertical"
          data={chartData}
          margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
          <XAxis
            type="number"
            domain={[minDate, maxDate]}
            tickFormatter={formatDate}
            className="text-xs"
          />
          <YAxis
            type="category"
            dataKey="name"
            width={150}
            className="text-xs"
            tick={{ fontSize: 11 }}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend />
          <Bar
            dataKey="duration"
            fill="#8884d8"
            name="Duration (days)"
            radius={[4, 4, 0, 0]}
          >
            {chartData.map((entry, index) => (
              <rect
                key={`bar-${index}`}
                x={entry.start}
                y={0}
                width={entry.end - entry.start}
                height={0}
                fill={getStatusColor(entry.status)}
                fillOpacity={0.8}
              />
            ))}
          </Bar>
          {/* Progress overlay */}
          <Bar
            dataKey="duration"
            fill="#34d399"
            name="Completed"
            radius={[0, 0, 4, 4]}
            stackId="progress"
          >
            {chartData.map((entry, index) => {
              const progressWidth = (entry.end - entry.start) * entry.progress
              return (
                <rect
                  key={`progress-${index}`}
                  x={entry.start}
                  y={0}
                  width={progressWidth}
                  height={0}
                  fill="#34d399"
                  fillOpacity={0.6}
                />
              )
            })}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      <div className="grid grid-cols-2 gap-4 text-sm">
        <div>
          <h4 className="font-semibold mb-2">Legend</h4>
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-gray-400" />
              <span>Backlog</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-blue-400" />
              <span>Open</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-indigo-400" />
              <span>In Progress</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-purple-400" />
              <span>In Review</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-red-400" />
              <span>Blocked</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-green-400" />
              <span>Done</span>
            </div>
          </div>
        </div>
        <div>
          <h4 className="font-semibold mb-2">Statistics</h4>
          <div className="space-y-1 text-sm">
            <p>
              Total tasks with dates: <span className="font-medium">{tasksWithDates.length}</span>
            </p>
            <p>
              Average duration:{' '}
              <span className="font-medium">
                {chartData.length > 0
                  ? (chartData.reduce((sum, d) => sum + d.duration, 0) / chartData.length).toFixed(1)
                  : 0}{' '}
                days
              </span>
            </p>
            <p>
              Overall progress:{' '}
              <span className="font-medium">
                {chartData.length > 0
                  ? (chartData.reduce((sum, d) => sum + d.progress, 0) / chartData.length * 100).toFixed(0)
                  : 0}%
              </span>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
