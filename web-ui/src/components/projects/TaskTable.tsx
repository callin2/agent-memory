import { useState } from 'react'
import { Task, TaskStatus, TaskPriority } from '@/services/tasks'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { TaskDialog } from './TaskDialog'

interface TaskTableProps {
  tasks: Task[]
  onTaskUpdate?: (taskId: string, updates: any) => void
}

const statusColors: Record<TaskStatus, string> = {
  backlog: 'bg-gray-100 text-gray-800 hover:bg-gray-200',
  open: 'bg-blue-100 text-blue-800 hover:bg-blue-200',
  doing: 'bg-indigo-100 text-indigo-800 hover:bg-indigo-200',
  review: 'bg-purple-100 text-purple-800 hover:bg-purple-200',
  blocked: 'bg-red-100 text-red-800 hover:bg-red-200',
  done: 'bg-green-100 text-green-800 hover:bg-green-200',
}

const priorityColors: Record<TaskPriority, string> = {
  critical: 'text-red-600',
  high: 'text-orange-600',
  medium: 'text-yellow-600',
  low: 'text-gray-600',
}

const priorityIcons: Record<TaskPriority, string> = {
  critical: '🔴',
  high: '🟠',
  medium: '🟡',
  low: '⚪',
}

export function TaskTable({ tasks, onTaskUpdate }: TaskTableProps) {
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)

  const handleTaskClick = (task: Task) => {
    setSelectedTask(task)
    setIsDialogOpen(true)
  }

  const handleTaskUpdate = (taskId: string, updates: any) => {
    if (onTaskUpdate) {
      onTaskUpdate(taskId, updates)
    }
    setIsDialogOpen(false)
    setSelectedTask(null)
  }

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-'
    return new Date(dateStr).toLocaleDateString()
  }

  if (tasks.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Tasks</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No tasks found. Create your first task to get started.</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Tasks ({tasks.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 px-4 font-medium text-sm">Priority</th>
                  <th className="text-left py-3 px-4 font-medium text-sm">Title</th>
                  <th className="text-left py-3 px-4 font-medium text-sm">Status</th>
                  <th className="text-left py-3 px-4 font-medium text-sm">Due Date</th>
                  <th className="text-left py-3 px-4 font-medium text-sm">Progress</th>
                  <th className="text-left py-3 px-4 font-medium text-sm">Dependencies</th>
                </tr>
              </thead>
              <tbody>
                {tasks.map((task) => (
                  <tr
                    key={task.task_id}
                    className="border-b hover:bg-muted/50 cursor-pointer"
                    onClick={() => handleTaskClick(task)}
                  >
                    <td className="py-3 px-4">
                      <span className={priorityColors[task.priority]} title={task.priority}>
                        {priorityIcons[task.priority]}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <div>
                        <div className="font-medium">{task.title}</div>
                        {task.details && (
                          <div className="text-xs text-muted-foreground truncate max-w-md">
                            {task.details}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <Badge className={statusColors[task.status]} variant="secondary">
                        {task.status}
                      </Badge>
                    </td>
                    <td className="py-3 px-4 text-sm">
                      {formatDate(task.due_date)}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-2 bg-gray-200 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-blue-600"
                            style={{ width: `${task.progress_percentage}%` }}
                          />
                        </div>
                        <span className="text-xs text-muted-foreground">{task.progress_percentage}%</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-sm">
                      {task.blocked_by?.length > 0 ? (
                        <Badge variant="outline" className="text-xs">
                          {task.blocked_by.length} blocking
                        </Badge>
                      ) : task.blocking?.length > 0 ? (
                        <Badge variant="outline" className="text-xs">
                          {task.blocking.length} blocked
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Task Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Task</DialogTitle>
            <DialogDescription>
              Update task details, status, or dependencies
            </DialogDescription>
          </DialogHeader>
          {selectedTask && (
            <TaskDialog
              task={selectedTask}
              onSave={(updates) => handleTaskUpdate(selectedTask.task_id, updates)}
              onCancel={() => setIsDialogOpen(false)}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
