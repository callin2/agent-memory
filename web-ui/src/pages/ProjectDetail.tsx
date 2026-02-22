import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { getProjectSummary, listTasks, updateTask } from '@/services/tasks'
import { TaskTable } from '@/components/projects/TaskTable'
import { TaskDialog } from '@/components/projects/TaskDialog'
import { DependencyGraph } from '@/components/projects/DependencyGraph'
import { GanttChart } from '@/components/projects/GanttChart'
import { ProjectProgress } from '@/components/projects/ProjectProgress'
import { useState } from 'react'

export function ProjectDetail() {
  const { projectId } = useParams<{ projectId: string }>()
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)

  const decodedProjectId = decodeURIComponent(projectId || '')

  // Fetch project summary
  const { data: projectData, isLoading: isLoadingProject, error: projectError } = useQuery({
    queryKey: ['project', decodedProjectId],
    queryFn: () => getProjectSummary(decodedProjectId),
    refetchInterval: 30000, // Auto-refresh every 30 seconds
  })

  // Fetch tasks
  const { data: tasksData, refetch: refetchTasks } = useQuery({
    queryKey: ['tasks', decodedProjectId],
    queryFn: () => listTasks({ project_id: decodedProjectId }),
    refetchInterval: 30000,
  })

  const handleTaskUpdate = async (taskId: string, updates: any) => {
    await updateTask(taskId, updates)
    refetchTasks()
  }

  const handleTaskCreate = async (updates: any) => {
    // TODO: Implement createTask
    console.log('Create task:', updates)
    setIsCreateDialogOpen(false)
    refetchTasks()
  }

  if (isLoadingProject) {
    return (
      <div className="space-y-6" data-testid="project-detail-page">
        <div>
          <h1 className="text-3xl font-bold">Loading project...</h1>
        </div>
      </div>
    )
  }

  if (projectError || !projectData) {
    return (
      <div className="space-y-6" data-testid="project-detail-page">
        <div>
          <h1 className="text-3xl font-bold">Error</h1>
          <p className="text-red-500">Failed to load project: {projectError?.message}</p>
        </div>
      </div>
    )
  }

  const { summary, blocking_tasks, recent_tasks } = projectData
  const tasks = tasksData?.tasks || []

  return (
    <div className="space-y-6" data-testid="project-detail-page">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{decodedProjectId}</h1>
          <p className="text-muted-foreground">
            {summary.total_tasks} task{summary.total_tasks !== 1 ? 's' : ''} • {summary.progress_percentage.toFixed(0)}% complete
          </p>
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>Create Task</Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Create New Task</DialogTitle>
              <DialogDescription>
                Add a new task to {decodedProjectId}
              </DialogDescription>
            </DialogHeader>
            <TaskDialog
              projectId={decodedProjectId}
              onSave={handleTaskCreate}
              onCancel={() => setIsCreateDialogOpen(false)}
            />
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Tasks</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.total_tasks}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Completed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{summary.completed_tasks}</div>
            <p className="text-xs text-muted-foreground">{((summary.completed_tasks / summary.total_tasks) * 100).toFixed(0)}% done</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">In Progress</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{summary.in_progress_tasks}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Blocked</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{summary.blocked_tasks}</div>
            {summary.overdue_tasks > 0 && (
              <p className="text-xs text-orange-600">{summary.overdue_tasks} overdue</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="tasks">Tasks</TabsTrigger>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
          <TabsTrigger value="dependencies">Dependencies</TabsTrigger>
          <TabsTrigger value="blocking">Blocking Tasks</TabsTrigger>
          <TabsTrigger value="recent">Recent Activity</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <ProjectProgress tasks={tasks} summary={summary} />
        </TabsContent>

        <TabsContent value="tasks" className="space-y-4">
          <TaskTable tasks={tasks} onTaskUpdate={handleTaskUpdate} />
        </TabsContent>

        <TabsContent value="timeline" className="space-y-4">
          <GanttChart tasks={tasks} />
        </TabsContent>

        <TabsContent value="dependencies" className="space-y-4">
          <DependencyGraph tasks={tasks} />
        </TabsContent>

        <TabsContent value="blocking" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Blocking Tasks ({blocking_tasks.length})</CardTitle>
              <p className="text-sm text-muted-foreground">
                Tasks that are blocking other tasks from starting
              </p>
            </CardHeader>
            <CardContent>
              {blocking_tasks.length === 0 ? (
                <p className="text-sm text-muted-foreground">No blocking tasks</p>
              ) : (
                <div className="space-y-2">
                  {blocking_tasks.map((task) => (
                    <div key={task.task_id} className="flex items-center justify-between p-3 border rounded">
                      <div>
                        <div className="font-medium">{task.title}</div>
                        <div className="text-xs text-muted-foreground">
                          {task.blocking?.length} task{task.blocking?.length !== 1 ? 's' : ''} waiting
                        </div>
                      </div>
                      <Badge>{task.status}</Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="recent" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Recent Tasks ({recent_tasks.length})</CardTitle>
            </CardHeader>
            <CardContent>
              {recent_tasks.length === 0 ? (
                <p className="text-sm text-muted-foreground">No recent activity</p>
              ) : (
                <div className="space-y-2">
                  {recent_tasks.map((task) => (
                    <div key={task.task_id} className="flex items-center justify-between p-3 border rounded">
                      <div>
                        <div className="font-medium">{task.title}</div>
                        <div className="text-xs text-muted-foreground">
                          {new Date(task.ts).toLocaleString()}
                        </div>
                      </div>
                      <Badge>{task.status}</Badge>
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
