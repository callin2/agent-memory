import { useEffect, useRef, useState } from 'react'
import { Network } from 'vis-network/standalone'
import { Task } from '@/services/tasks'

interface DependencyGraphProps {
  tasks: Task[]
}

export function DependencyGraph({ tasks }: DependencyGraphProps) {
  const networkRef = useRef<HTMLDivElement>(null)
  const networkInstance = useRef<Network | null>(null)
  const [selectedNode, setSelectedNode] = useState<string | null>(null)

  useEffect(() => {
    if (!networkRef.current || tasks.length === 0) return

    // Create nodes from tasks
    const nodes = tasks.map((task) => ({
      id: task.task_id,
      label: task.title.length > 20 ? task.title.substring(0, 20) + '...' : task.title,
      title: `${task.title}\nStatus: ${task.status}\nPriority: ${task.priority}`,
      color: getStatusColor(task.status),
      font: { size: 14 },
      shape: 'box',
    }))

    // Create edges from dependencies
    const edges: Array<{ from: string; to: string; arrows: string; label?: string }> = []

    tasks.forEach((task) => {
      task.blocked_by?.forEach((blockingTaskId) => {
        edges.push({
          from: blockingTaskId,
          to: task.task_id,
          arrows: 'to',
          label: 'blocks',
        })
      })
    })

    // Network options
    const options = {
      nodes: {
        shape: 'box',
        margin: { top: 10, right: 10, bottom: 10, left: 10 },
        widthConstraint: {
          maximum: 200,
        },
      },
      edges: {
        smooth: {
          enabled: true,
          type: 'cubicBezier',
          forceDirection: 'vertical',
          roundness: 0.4,
        },
        arrows: {
          to: {
            enabled: true,
            scaleFactor: 0.5,
          },
        },
        font: {
          size: 12,
          align: 'middle',
        },
      },
      layout: {
        hierarchical: {
          enabled: true,
          direction: 'UD',
          sortMethod: 'directed',
          nodeSpacing: 150,
          levelSeparation: 200,
        },
      },
      physics: {
        hierarchicalRepulsion: {
          nodeDistance: 200,
        },
      },
      interaction: {
        hover: true,
        tooltipDelay: 200,
        zoomView: true,
      },
    }

    // Create network
    networkInstance.current = new Network(
      networkRef.current,
      { nodes, edges },
      options
    )

    // Handle node selection
    networkInstance.current.on('click', (params) => {
      if (params.nodes.length > 0) {
        setSelectedNode(params.nodes[0])
      } else {
        setSelectedNode(null)
      }
    })

    return () => {
      if (networkInstance.current) {
        networkInstance.current.destroy()
        networkInstance.current = null
      }
    }
  }, [tasks])

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      backlog: '#9ca3af',
      open: '#60a5fa',
      doing: '#818cf8',
      review: '#a78bfa',
      blocked: '#f87171',
      done: '#34d399',
    }
    return colors[status] || '#9ca3af'
  }

  if (tasks.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 border rounded-lg bg-muted">
        <p className="text-muted-foreground">No tasks to display</p>
      </div>
    )
  }

  const selectedTask = tasks.find((t) => t.task_id === selectedNode)

  return (
    <div className="space-y-4">
      <div ref={networkRef} className="border rounded-lg bg-background" style={{ height: '500px' }} />

      {selectedTask && (
        <div className="p-4 border rounded-lg bg-muted/50">
          <h4 className="font-semibold mb-2">Selected Task</h4>
          <div className="space-y-1 text-sm">
            <p><span className="font-medium">Title:</span> {selectedTask.title}</p>
            <p><span className="font-medium">Status:</span> {selectedTask.status}</p>
            <p><span className="font-medium">Priority:</span> {selectedTask.priority}</p>
            {selectedTask.blocked_by && selectedTask.blocked_by.length > 0 && (
              <p>
                <span className="font-medium">Blocked by:</span>{' '}
                {selectedTask.blocked_by.length} task(s)
              </p>
            )}
            {selectedTask.blocking && selectedTask.blocking.length > 0 && (
              <p>
                <span className="font-medium">Blocking:</span>{' '}
                {selectedTask.blocking.length} task(s)
              </p>
            )}
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-2 text-xs">
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded" style={{ backgroundColor: getStatusColor('backlog') }} />
          <span>Backlog</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded" style={{ backgroundColor: getStatusColor('open') }} />
          <span>Open</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded" style={{ backgroundColor: getStatusColor('doing') }} />
          <span>In Progress</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded" style={{ backgroundColor: getStatusColor('review') }} />
          <span>In Review</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded" style={{ backgroundColor: getStatusColor('blocked') }} />
          <span>Blocked</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded" style={{ backgroundColor: getStatusColor('done') }} />
          <span>Done</span>
        </div>
      </div>
    </div>
  )
}
