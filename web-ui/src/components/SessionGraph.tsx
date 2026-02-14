import { useEffect, useRef, useState } from 'react'
import { Network, DataSet } from 'vis-network/standalone'
import { format } from 'date-fns'
import { GraphNode, GraphEdge, FilterOptions, MemoryEvent } from '@/types'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ZoomIn, ZoomOut, RotateCcw, Filter } from 'lucide-react'

interface SessionGraphProps {
  events: MemoryEvent[]
  filters: FilterOptions
  onNodeClick?: (nodeId: string) => void
}

const SUBJECT_COLORS: Record<string, string> = {
  'auth': '#e11d48', // red
  'memory': '#3b82f6', // blue
  'planning': '#10b981', // green
  'analysis': '#f59e0b', // amber
  'default': '#6b7280', // gray
}

const NODE_SHAPES: Record<string, string> = {
  'session': 'dot',
  'message': 'box',
  'decision': 'diamond',
  'capsule': 'hexagon',
}

export function SessionGraph({ events, filters, onNodeClick }: SessionGraphProps) {
  const networkRef = useRef<HTMLDivElement>(null)
  const networkInstance = useRef<Network | null>(null)
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null)
  const [showFilters, setShowFilters] = useState(false)

  // Transform events to nodes and edges
  const { nodes, edges } = events.reduce<{ nodes: GraphNode[]; edges: GraphEdge[] }>((acc, event) => {
    // Check filters
    if (filters.subjects.length > 0 && event.subject && !filters.subjects.includes(event.subject)) {
      return acc
    }
    if (filters.kinds.length > 0 && !filters.kinds.includes(event.kind)) {
      return acc
    }
    if (filters.dateRange.from && event.timestamp < filters.dateRange.from) {
      return acc
    }
    if (filters.dateRange.to && event.timestamp > filters.dateRange.to) {
      return acc
    }
    if (filters.searchQuery && !event.content.toLowerCase().includes(filters.searchQuery.toLowerCase())) {
      return acc
    }

    // Create node
    const node: GraphNode = {
      id: event.id,
      label: `${event.kind}\n${format(event.timestamp, 'HH:mm')}`,
      kind: event.kind,
      subject: event.subject,
      timestamp: event.timestamp,
      color: SUBJECT_COLORS[event.subject || 'default'],
      title: `${event.kind}\n${event.content}\n${format(event.timestamp, 'PPp')}`,
    }

    acc.nodes.push(node)

    // Create edges for relationships
    if (event.relatedTo) {
      event.relatedTo.forEach((relatedId) => {
        const edge: GraphEdge = {
          id: `${event.id}-${relatedId}`,
          from: event.id,
          to: relatedId,
          kind: event.kind === 'decision' ? 'decision' : 'reply',
          dashes: event.kind === 'reference',
          color: SUBJECT_COLORS[event.subject || 'default'],
        }
        acc.edges.push(edge)
      })
    }

    return acc
  }, { nodes: [], edges: [] })

  // Initialize and update network
  useEffect(() => {
    if (!networkRef.current) return

    const nodesDataSet = new DataSet(
      nodes.map(node => ({
        id: node.id,
        label: node.label,
        shape: NODE_SHAPES[node.kind] || 'dot',
        color: {
          background: node.color,
          border: '#000',
        },
        title: node.title,
        font: { size: 12 },
      }))
    )

    const edgesDataSet = new DataSet(
      edges.map(edge => ({
        id: edge.id,
        from: edge.from,
        to: edge.to,
        dashes: edge.dashes,
        color: { color: edge.color || '#999' },
        arrows: { to: { enabled: true } },
      }))
    )

    const data = { nodes: nodesDataSet, edges: edgesDataSet }
    const options: any = {
      nodes: {
        size: 25,
        font: { size: 12, color: '#fff' },
        borderWidth: 2,
      },
      edges: {
        width: 2,
        smooth: { type: 'continuous' },
      },
      physics: {
        enabled: true,
        stabilization: { iterations: 200 },
        barnesHut: {
          gravitationalConstant: -8000,
          springConstant: 0.04,
          springLength: 95,
        },
      },
      interaction: {
        hover: true,
        tooltipDelay: 100,
      },
    }

    if (!networkInstance.current) {
      networkInstance.current = new Network(networkRef.current, data, options)

      networkInstance.current.on('click', (params: any) => {
        if (params.nodes.length > 0) {
          const nodeId = params.nodes[0]
          const node = nodes.find(n => n.id === nodeId)
          if (node) {
            setSelectedNode(node)
            onNodeClick?.(nodeId)
          }
        }
      })
    } else {
      networkInstance.current.setData(data)
    }

    return () => {
      if (networkInstance.current) {
        networkInstance.current.destroy()
        networkInstance.current = null
      }
    }
  }, [nodes, edges, onNodeClick])

  const handleZoomIn = () => {
    networkInstance.current?.moveTo({ scale: networkInstance.current.getScale() * 1.2 })
  }

  const handleZoomOut = () => {
    networkInstance.current?.moveTo({ scale: networkInstance.current.getScale() * 0.8 })
  }

  const handleReset = () => {
    networkInstance.current?.fit()
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-lg font-semibold">Memory Graph</h3>
          <Badge variant="outline">{nodes.length} nodes</Badge>
          <Badge variant="outline">{edges.length} edges</Badge>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={handleZoomIn}>
            <ZoomIn className="h-4 w-4" />
          </Button>
          <Button size="sm" variant="outline" onClick={handleZoomOut}>
            <ZoomOut className="h-4 w-4" />
          </Button>
          <Button size="sm" variant="outline" onClick={handleReset}>
            <RotateCcw className="h-4 w-4" />
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setShowFilters(!showFilters)}
          >
            <Filter className="h-4 w-4 mr-2" />
            Filters
          </Button>
        </div>
      </div>

      {showFilters && (
        <Card className="p-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Subjects</label>
              <div className="flex flex-wrap gap-2">
                {Object.keys(SUBJECT_COLORS).map(subject => (
                  <Badge
                    key={subject}
                    variant={filters.subjects.includes(subject) ? 'default' : 'outline'}
                    style={{ backgroundColor: filters.subjects.includes(subject) ? SUBJECT_COLORS[subject] : undefined }}
                  >
                    {subject}
                  </Badge>
                ))}
              </div>
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Event Types</label>
              <div className="flex flex-wrap gap-2">
                {['message', 'decision', 'reply', 'reference', 'capsule'].map(kind => (
                  <Badge
                    key={kind}
                    variant={filters.kinds.includes(kind) ? 'default' : 'outline'}
                  >
                    {kind}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        </Card>
      )}

      {selectedNode && (
        <Card className="p-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Badge style={{ backgroundColor: SUBJECT_COLORS[selectedNode.subject || 'default'] }}>
                {selectedNode.subject || 'default'}
              </Badge>
              <Badge variant="outline">{selectedNode.kind}</Badge>
            </div>
            <p className="text-sm">{format(selectedNode.timestamp, 'PPpp')}</p>
          </div>
        </Card>
      )}

      <Card className="overflow-hidden">
        <div ref={networkRef} style={{ width: '100%', height: '600px' }} />
      </Card>

      <Card className="p-4">
        <h4 className="text-sm font-semibold mb-3">Legend</h4>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">Node Types</p>
            <div className="flex items-center gap-2 text-xs">
              <div className="w-3 h-3 rounded-full bg-gray-500" />
              <span>Session (circle)</span>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <div className="w-3 h-3 bg-gray-500" />
              <span>Message (square)</span>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <div className="w-3 h-3 bg-gray-500 rotate-45" />
              <span>Decision (diamond)</span>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <div className="w-3 h-3 bg-gray-500" />
              <span>Capsule (hexagon)</span>
            </div>
          </div>
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">Edge Types</p>
            <div className="flex items-center gap-2 text-xs">
              <div className="w-8 h-0.5 bg-gray-500" />
              <span>Reply (solid)</span>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <div className="w-8 h-0.5 border-t-2 border-dashed border-gray-500" />
              <span>Reference (dashed)</span>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <div className="w-8 h-0.5 border-dotted border-gray-500" />
              <span>Decision (dotted)</span>
            </div>
          </div>
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">Subject Colors</p>
            {Object.entries(SUBJECT_COLORS).map(([subject, color]) => (
              <div key={subject} className="flex items-center gap-2 text-xs">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
                <span className="capitalize">{subject}</span>
              </div>
            ))}
          </div>
        </div>
      </Card>
    </div>
  )
}
