import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { SessionGraph } from '@/components/SessionGraph'
import { DatabaseView } from '@/components/DatabaseView'
import { MemoryTimeline } from '@/components/MemoryTimeline'
import { MemoryEvent, FilterOptions } from '@/types'
import { Download, BarChart3, Database, LineChart } from 'lucide-react'

// Mock data generation - replace with actual API calls
const generateMockEvents = (): MemoryEvent[] => {
  const events: MemoryEvent[] = []
  const subjects = ['auth', 'memory', 'planning', 'analysis']
  const kinds: Array<'message' | 'decision' | 'reply' | 'reference' | 'capsule'> = ['message', 'decision', 'reply', 'reference', 'capsule']
  const actors = ['Agent-001', 'Agent-002', 'Agent-003', 'Manager', 'Expert']

  const now = new Date()
  for (let i = 0; i < 500; i++) {
    const timestamp = new Date(now.getTime() - i * 3600000) // Last 500 hours
    const kind = kinds[Math.floor(Math.random() * kinds.length)]
    const subject = subjects[Math.floor(Math.random() * subjects.length)]

    events.push({
      id: `event-${i}`,
      timestamp,
      sessionId: `session-${Math.floor(Math.random() * 50)}`,
      actor: actors[Math.floor(Math.random() * actors.length)],
      kind,
      content: `Sample ${kind} content for ${subject} with detailed information about the event`,
      subject,
      tags: [subject, kind, 'test'],
      relatedTo: i > 0 ? [`event-${Math.floor(Math.random() * i)}`] : undefined,
    })
  }

  return events.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
}

export function Visualization() {
  const [events, setEvents] = useState<MemoryEvent[]>([])
  const [activeTab, setActiveTab] = useState<'graph' | 'database' | 'timeline'>('graph')
  const [filters, setFilters] = useState<FilterOptions>({
    subjects: [],
    kinds: [],
    dateRange: {},
    searchQuery: '',
  })

  useEffect(() => {
    // Load mock data - replace with actual API call
    const mockEvents = generateMockEvents()
    setEvents(mockEvents)
  }, [])

  const handleExportVisualization = () => {
    const canvas = document.querySelector('canvas') as HTMLCanvasElement
    if (canvas) {
      const link = document.createElement('a')
      link.download = `memory-graph-${new Date().toISOString()}.png`
      link.href = canvas.toDataURL()
      link.click()
    }
  }

  const handleExportData = () => {
    const blob = new Blob([JSON.stringify(events, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `memory-data-${new Date().toISOString()}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-6" data-testid="visualization-page">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Memory Visualization</h1>
          <p className="text-muted-foreground">Visualize memory structures and relationships</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handleExportVisualization} title="Export Image - Download the current memory graph visualization as a PNG image to save and share visual insights">
            <Download className="h-4 w-4 mr-2" />
            Export Image
          </Button>
          <Button variant="outline" onClick={handleExportData} title="Export Data - Download all memory events as JSON file for offline analysis and backup">
            <Download className="h-4 w-4 mr-2" />
            Export Data
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
          <CardDescription>Filter events by subject, type, date range, or search query</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label>Search</Label>
              <Input
                placeholder="Search events..."
                value={filters.searchQuery}
                onChange={(e) => setFilters({ ...filters, searchQuery: e.target.value })}
                title="Search events - Type keywords to find specific memory events by content, tags, or subjects for quick lookup"
              />
            </div>

            <div className="space-y-2">
              <Label>Date Range</Label>
              <div className="space-y-1">
                <Input
                  type="date"
                  value={filters.dateRange.from ? filters.dateRange.from.toISOString().split('T')[0] : ''}
                  onChange={(e) => setFilters({
                    ...filters,
                    dateRange: { ...filters.dateRange, from: e.target.value ? new Date(e.target.value) : undefined }
                  })}
                  title="From date - Select start date to show only memory events created after this date"
                />
                <Input
                  type="date"
                  value={filters.dateRange.to ? filters.dateRange.to.toISOString().split('T')[0] : ''}
                  onChange={(e) => setFilters({
                    ...filters,
                    dateRange: { ...filters.dateRange, to: e.target.value ? new Date(e.target.value) : undefined }
                  })}
                  title="To date - Select end date to show only memory events created before this date"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Subjects</Label>
              <div className="flex flex-wrap gap-1">
                {['auth', 'memory', 'planning', 'analysis'].map(subject => (
                  <Button
                    key={subject}
                    size="sm"
                    variant={filters.subjects.includes(subject) ? 'default' : 'outline'}
                    onClick={() => {
                      const newSubjects = filters.subjects.includes(subject)
                        ? filters.subjects.filter(s => s !== subject)
                        : [...filters.subjects, subject]
                      setFilters({ ...filters, subjects: newSubjects })
                    }}
                    title={`Filter by ${subject} - ${filters.subjects.includes(subject) ? 'Click to remove' : 'Click to add'} ${subject} subject filter to show only related memory events`}
                  >
                    {subject}
                  </Button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Event Types</Label>
              <div className="flex flex-wrap gap-1">
                {['message', 'decision', 'reply', 'reference', 'capsule'].map(kind => (
                  <Button
                    key={kind}
                    size="sm"
                    variant={filters.kinds.includes(kind) ? 'default' : 'outline'}
                    onClick={() => {
                      const newKinds = filters.kinds.includes(kind)
                        ? filters.kinds.filter(k => k !== kind)
                        : [...filters.kinds, kind]
                      setFilters({ ...filters, kinds: newKinds })
                    }}
                    title={`Filter by ${kind} - ${filters.kinds.includes(kind) ? 'Click to remove' : 'Click to add'} ${kind} type filter to show only this kind of memory event`}
                  >
                    {kind}
                  </Button>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-4 flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setFilters({ subjects: [], kinds: [], dateRange: {}, searchQuery: '' })}
              title="Clear All Filters - Remove all active filters to view all memory events without any restrictions"
            >
              Clear All Filters
            </Button>
          </div>
        </CardContent>
      </Card>

      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as any)}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="graph" title="Graph View tab - Visualize memory relationships as an interactive network graph to see connections between events and entities">
            <BarChart3 className="h-4 w-4 mr-2" />
            Graph View
          </TabsTrigger>
          <TabsTrigger value="database" title="Database View tab - View all memory events in a sortable table format to browse and inspect individual records">
            <Database className="h-4 w-4 mr-2" />
            Database View
          </TabsTrigger>
          <TabsTrigger value="timeline" title="Timeline View tab - View memory events chronologically to analyze temporal patterns and event sequences">
            <LineChart className="h-4 w-4 mr-2" />
            Timeline View
          </TabsTrigger>
        </TabsList>

        <TabsContent value="graph" className="mt-6">
          <SessionGraph
            events={events}
            filters={filters}
            onNodeClick={(nodeId) => console.log('Node clicked:', nodeId)}
          />
        </TabsContent>

        <TabsContent value="database" className="mt-6">
          <DatabaseView
            events={events}
            filters={filters}
            onFiltersChange={setFilters}
            onEventClick={(eventId) => console.log('Event clicked:', eventId)}
          />
        </TabsContent>

        <TabsContent value="timeline" className="mt-6">
          <MemoryTimeline
            events={events}
            filters={filters}
            onEventClick={(eventId) => console.log('Event clicked:', eventId)}
          />
        </TabsContent>
      </Tabs>

      <Card>
        <CardHeader>
          <CardTitle>Statistics</CardTitle>
          <CardDescription>Overview of memory events</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Total Events</p>
              <p className="text-2xl font-bold">{events.length}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Unique Sessions</p>
              <p className="text-2xl font-bold">{new Set(events.map(e => e.sessionId)).size}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Unique Actors</p>
              <p className="text-2xl font-bold">{new Set(events.map(e => e.actor)).size}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Filtered Events</p>
              <p className="text-2xl font-bold">
                {events.filter(e => {
                  if (filters.subjects.length > 0 && e.subject && !filters.subjects.includes(e.subject)) return false
                  if (filters.kinds.length > 0 && !filters.kinds.includes(e.kind)) return false
                  return true
                }).length}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
