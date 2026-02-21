import { useState } from 'react'
import { Task, TaskStatus, TaskPriority } from '@/services/tasks'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Slider } from '@/components/ui/slider'

interface TaskDialogProps {
  task?: Task
  projectId?: string
  onSave: (updates: any) => void
  onCancel: () => void
}

export function TaskDialog({ task, projectId, onSave, onCancel }: TaskDialogProps) {
  const [title, setTitle] = useState(task?.title || '')
  const [details, setDetails] = useState(task?.details || '')
  const [status, setStatus] = useState<TaskStatus>(task?.status || 'backlog')
  const [priority, setPriority] = useState<TaskPriority>(task?.priority || 'medium')
  const [progress, setProgress] = useState(task?.progress_percentage || 0)
  const [dueDate, setDueDate] = useState(task?.due_date?.split('T')[0] || '')
  const [timeEstimate, setTimeEstimate] = useState(task?.time_estimate_hours?.toString() || '')

  const isEditMode = !!task

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    const updates: any = {
      title,
      details,
      status,
      priority,
      progress_percentage: progress,
    }

    if (dueDate) {
      updates.due_date = new Date(dueDate).toISOString()
    }

    if (timeEstimate) {
      updates.time_estimate_hours = parseFloat(timeEstimate)
    }

    if (projectId && !isEditMode) {
      updates.project_id = projectId
    }

    onSave(updates)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Title */}
      <div className="space-y-2">
        <Label htmlFor="title">Title *</Label>
        <Input
          id="title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Task title"
          required
        />
      </div>

      {/* Details */}
      <div className="space-y-2">
        <Label htmlFor="details">Description</Label>
        <Textarea
          id="details"
          value={details}
          onChange={(e) => setDetails(e.target.value)}
          placeholder="Task description (optional)"
          rows={3}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* Status */}
        <div className="space-y-2">
          <Label htmlFor="status">Status</Label>
          <Select value={status} onValueChange={(value) => setStatus(value as TaskStatus)}>
            <SelectTrigger id="status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="backlog">Backlog</SelectItem>
              <SelectItem value="open">Open</SelectItem>
              <SelectItem value="doing">In Progress</SelectItem>
              <SelectItem value="review">In Review</SelectItem>
              <SelectItem value="blocked">Blocked</SelectItem>
              <SelectItem value="done">Done</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Priority */}
        <div className="space-y-2">
          <Label htmlFor="priority">Priority</Label>
          <Select value={priority} onValueChange={(value) => setPriority(value as TaskPriority)}>
            <SelectTrigger id="priority">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="critical">🔴 Critical</SelectItem>
              <SelectItem value="high">🟠 High</SelectItem>
              <SelectItem value="medium">🟡 Medium</SelectItem>
              <SelectItem value="low">⚪ Low</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Progress */}
      <div className="space-y-2">
        <Label htmlFor="progress">Progress: {progress}%</Label>
        <Slider
          id="progress"
          value={[progress]}
          onValueChange={(value) => setProgress(value[0])}
          max={100}
          step={5}
          className="w-full"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* Due Date */}
        <div className="space-y-2">
          <Label htmlFor="dueDate">Due Date</Label>
          <Input
            id="dueDate"
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
          />
        </div>

        {/* Time Estimate */}
        <div className="space-y-2">
          <Label htmlFor="timeEstimate">Time Estimate (hours)</Label>
          <Input
            id="timeEstimate"
            type="number"
            step="0.5"
            value={timeEstimate}
            onChange={(e) => setTimeEstimate(e.target.value)}
            placeholder="e.g., 2.5"
          />
        </div>
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-2 pt-4">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit">
          {isEditMode ? 'Save Changes' : 'Create Task'}
        </Button>
      </div>
    </form>
  )
}
