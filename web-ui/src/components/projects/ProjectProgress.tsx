import { Task, TaskStatus, TaskPriority } from '@/services/tasks'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'

interface ProjectProgressProps {
  tasks: Task[]
  summary: {
    total_tasks: number
    completed_tasks: number
    in_progress_tasks: number
    blocked_tasks: number
    backlog_tasks: number
    progress_percentage: number
  }
}

export function ProjectProgress({ tasks, summary }: ProjectProgressProps) {
  // Calculate status distribution
  const statusDistribution = tasks.reduce((acc, task) => {
    acc[task.status] = (acc[task.status] || 0) + 1
    return acc
  }, {} as Record<TaskStatus, number>)

  // Calculate priority distribution
  const priorityDistribution = tasks.reduce((acc, task) => {
    acc[task.priority] = (acc[task.priority] || 0) + 1
    return acc
  }, {} as Record<TaskPriority, number>)

  // Calculate overdue tasks
  const overdueTasks = tasks.filter(
    (task) => task.due_date && new Date(task.due_date) < new Date() && task.status !== 'done'
  )

  // Calculate tasks due soon (within 7 days)
  const upcomingTasks = tasks.filter((task) => {
    if (!task.due_date || task.status === 'done') return false
    const dueDate = new Date(task.due_date)
    const now = new Date()
    const daysUntilDue = Math.ceil((dueDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000))
    return daysUntilDue > 0 && daysUntilDue <= 7
  })

  const statusColors: Record<TaskStatus, string> = {
    backlog: 'bg-gray-500',
    open: 'bg-blue-500',
    doing: 'bg-indigo-500',
    review: 'bg-purple-500',
    blocked: 'bg-red-500',
    done: 'bg-green-500',
  }

  const priorityColors: Record<TaskPriority, string> = {
    critical: 'bg-red-600',
    high: 'bg-orange-500',
    medium: 'bg-yellow-500',
    low: 'bg-gray-400',
  }

  const totalTasks = summary.total_tasks

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {/* Status Distribution */}
      <Card>
        <CardHeader>
          <CardTitle>Status Distribution</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {Object.entries(statusDistribution).map(([status, count]) => {
            const percentage = totalTasks > 0 ? (count / totalTasks) * 100 : 0
            return (
              <div key={status} className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <div className={`w-3 h-3 rounded ${statusColors[status as TaskStatus]}`} />
                    <span className="capitalize font-medium">{status}</span>
                  </div>
                  <span className="text-muted-foreground">
                    {count} ({percentage.toFixed(0)}%)
                  </span>
                </div>
                <Progress value={percentage} className="h-2" />
              </div>
            )
          })}
        </CardContent>
      </Card>

      {/* Priority Distribution */}
      <Card>
        <CardHeader>
          <CardTitle>Priority Distribution</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {Object.entries(priorityDistribution).map(([priority, count]) => {
            const percentage = totalTasks > 0 ? (count / totalTasks) * 100 : 0
            return (
              <div key={priority} className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <div className={`w-3 h-3 rounded ${priorityColors[priority as TaskPriority]}`} />
                    <span className="capitalize font-medium">{priority}</span>
                  </div>
                  <span className="text-muted-foreground">
                    {count} ({percentage.toFixed(0)}%)
                  </span>
                </div>
                <Progress value={percentage} className="h-2" />
              </div>
            )
          })}
        </CardContent>
      </Card>

      {/* Task Health Stats */}
      <Card className="md:col-span-2">
        <CardHeader>
          <CardTitle>Task Health</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            {/* Overall Progress */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Overall Progress</span>
                <span className="text-2xl font-bold">{summary.progress_percentage.toFixed(0)}%</span>
              </div>
              <Progress value={summary.progress_percentage} className="h-3" />
              <p className="text-xs text-muted-foreground">
                {summary.completed_tasks} of {summary.total_tasks} tasks completed
              </p>
            </div>

            {/* Overdue Tasks */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Overdue</span>
                <Badge variant="destructive" className="text-base">
                  {overdueTasks.length}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                Tasks past their due date
              </p>
              {overdueTasks.length > 0 && (
                <div className="mt-2 space-y-1">
                  {overdueTasks.slice(0, 3).map((task) => (
                    <div key={task.task_id} className="text-xs truncate" title={task.title}>
                      • {task.title}
                    </div>
                  ))}
                  {overdueTasks.length > 3 && (
                    <div className="text-xs text-muted-foreground">
                      +{overdueTasks.length - 3} more
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Upcoming Tasks */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Due Soon (7 days)</span>
                <Badge variant="outline" className="text-base">
                  {upcomingTasks.length}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                Tasks due within a week
              </p>
              {upcomingTasks.length > 0 && (
                <div className="mt-2 space-y-1">
                  {upcomingTasks.slice(0, 3).map((task) => {
                    const daysUntilDue = task.due_date
                      ? Math.ceil((new Date(task.due_date).getTime() - Date.now()) / (24 * 60 * 60 * 1000))
                      : 0
                    return (
                      <div key={task.task_id} className="text-xs truncate" title={task.title}>
                        • {task.title} ({daysUntilDue}d)
                      </div>
                    )
                  })}
                  {upcomingTasks.length > 3 && (
                    <div className="text-xs text-muted-foreground">
                      +{upcomingTasks.length - 3} more
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Additional Stats */}
          <div className="mt-4 pt-4 border-t">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Tasks in progress:</span>{' '}
                <span className="font-medium">{summary.in_progress_tasks}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Blocked tasks:</span>{' '}
                <span className="font-medium text-red-600">{summary.blocked_tasks}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Backlog tasks:</span>{' '}
                <span className="font-medium">{summary.backlog_tasks}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Completed:</span>{' '}
                <span className="font-medium text-green-600">{summary.completed_tasks}</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
