import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { listProjects } from '@/services/tasks'
import { Progress } from '@/components/ui/progress'

export function Projects() {
  const { data: projectsData, isLoading, error } = useQuery({
    queryKey: ['projects'],
    queryFn: () => listProjects(50),
    refetchInterval: 30000, // Auto-refresh every 30 seconds
  })

  if (isLoading) {
    return (
      <div className="space-y-6" data-testid="projects-page">
        <div>
          <h1 className="text-3xl font-bold">Projects</h1>
          <p className="text-muted-foreground">Loading projects...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-6" data-testid="projects-page">
        <div>
          <h1 className="text-3xl font-bold">Projects</h1>
          <p className="text-red-500">Error loading projects: {error.message}</p>
        </div>
      </div>
    )
  }

  const projects = projectsData?.projects || []

  return (
    <div className="space-y-6" data-testid="projects-page">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Projects</h1>
          <p className="text-muted-foreground">Manage and track your project tasks</p>
        </div>
        <Button>Create Project</Button>
      </div>

      {projects.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>No Projects Found</CardTitle>
            <CardDescription>Create a project to start tracking tasks</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Projects are automatically created when you add tasks with a project_id.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => (
            <Link key={project.project_id} to={`/projects/${encodeURIComponent(project.project_id)}`}>
              <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <CardTitle className="text-lg truncate flex-1">{project.project_id}</CardTitle>
                    {project.overdue_tasks > 0 && (
                      <Badge variant="destructive" className="ml-2">
                        {project.overdue_tasks} overdue
                      </Badge>
                    )}
                  </div>
                  <CardDescription>
                    {project.task_count} task{project.task_count !== 1 ? 's' : ''}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Progress Bar */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Progress</span>
                      <span className="font-medium">{project.progress_percentage.toFixed(0)}%</span>
                    </div>
                    <Progress value={project.progress_percentage} className="h-2" />
                  </div>

                  {/* Task Status Breakdown */}
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Completed:</span>
                      <span className="font-medium text-green-600">{project.completed_tasks}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">In Progress:</span>
                      <span className="font-medium text-blue-600">{project.in_progress_tasks}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Blocked:</span>
                      <span className="font-medium text-red-600">{project.blocked_tasks}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Backlog:</span>
                      <span className="font-medium text-gray-600">{project.backlog_tasks}</span>
                    </div>
                  </div>

                  {/* Priority Tasks */}
                  {project.blocked_tasks > 0 && (
                    <div className="pt-2 border-t">
                      <p className="text-xs text-orange-600 font-medium">
                        ⚠️ {project.blocked_tasks} task{project.blocked_tasks !== 1 ? 's' : ''} blocked
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
