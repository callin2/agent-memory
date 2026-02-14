import { useState, useMemo } from 'react'
import { format, startOfHour, startOfDay, startOfWeek, differenceInHours, differenceInDays, differenceInWeeks } from 'date-fns'
import { MemoryEvent, FilterOptions, TimelineEvent } from '@/types'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ZoomIn, ZoomOut } from 'lucide-react'

type ZoomLevel = 'hour' | 'day' | 'week'

interface MemoryTimelineProps {
  events: MemoryEvent[]
  filters: FilterOptions
  onEventClick?: (eventId: string) => void
}

const SUBJECT_COLORS: Record<string, string> = {
  'auth': '#e11d48',
  'memory': '#3b82f6',
  'planning': '#10b981',
  'analysis': '#f59e0b',
  'default': '#6b7280',
}

const KIND_COLORS: Record<string, string> = {
  'message': '#3b82f6',
  'decision': '#a855f7',
  'reply': '#22c55e',
  'reference': '#eab308',
  'capsule': '#ef4444',
}

export function MemoryTimeline({ events, filters, onEventClick }: MemoryTimelineProps) {
  const [zoomLevel, setZoomLevel] = useState<ZoomLevel>('day')
  const [hoveredEvent, setHoveredEvent] = useState<TimelineEvent | null>(null)
  const [selectedEvent, setSelectedEvent] = useState<MemoryEvent | null>(null)

  // Filter events
  const filteredEvents = useMemo(() => {
    return events.filter(event => {
      if (filters.subjects.length > 0 && event.subject && !filters.subjects.includes(event.subject)) {
        return false
      }
      if (filters.kinds.length > 0 && !filters.kinds.includes(event.kind)) {
        return false
      }
      if (filters.dateRange.from && event.timestamp < filters.dateRange.from) {
        return false
      }
      if (filters.dateRange.to && event.timestamp > filters.dateRange.to) {
        return false
      }
      return true
    })
  }, [events, filters])

  // Group events by time period based on zoom level
  const timelineEvents = useMemo(() => {
    const grouped = new Map<string, MemoryEvent[]>()

    filteredEvents.forEach(event => {
      let key: string
      let periodStart: Date

      switch (zoomLevel) {
        case 'hour':
          periodStart = startOfHour(event.timestamp)
          key = format(periodStart, 'yyyy-MM-dd HH:00')
          break
        case 'week':
          periodStart = startOfWeek(event.timestamp)
          key = format(periodStart, 'yyyy-ww')
          break
        case 'day':
        default:
          periodStart = startOfDay(event.timestamp)
          key = format(periodStart, 'yyyy-MM-dd')
          break
      }

      if (!grouped.has(key)) {
        grouped.set(key, [])
      }
      grouped.get(key)!.push(event)
    })

    // Convert to array and calculate density
    return Array.from(grouped.entries()).map(([periodKey, periodEvents]) => {
      const firstEvent = periodEvents[0]
      const maxDensity = Math.max(...Array.from(grouped.values()).map(e => e.length))

      return {
        id: periodKey,
        timestamp: firstEvent.timestamp,
        kind: firstEvent.kind,
        subject: firstEvent.subject,
        content: `${periodEvents.length} event${periodEvents.length > 1 ? 's' : ''}`,
        density: periodEvents.length / maxDensity, // Normalize to 0-1
        events: periodEvents,
      }
    }).sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())
  }, [filteredEvents, zoomLevel])

  // Calculate timeline dimensions
  const timelineStart = useMemo(() => {
    if (timelineEvents.length === 0) return new Date()
    return new Date(Math.min(...timelineEvents.map(e => e.timestamp.getTime())))
  }, [timelineEvents])

  const timelineEnd = useMemo(() => {
    if (timelineEvents.length === 0) return new Date()
    return new Date(Math.max(...timelineEvents.map(e => e.timestamp.getTime())))
  }, [timelineEvents])

  const timelineDuration = useMemo(() => {
    switch (zoomLevel) {
      case 'hour':
        return Math.max(1, differenceInHours(timelineEnd, timelineStart))
      case 'week':
        return Math.max(1, differenceInWeeks(timelineEnd, timelineStart))
      case 'day':
      default:
        return Math.max(1, differenceInDays(timelineEnd, timelineStart))
    }
  }, [timelineStart, timelineEnd, zoomLevel])

  const getPositionPercent = (timestamp: Date) => {
    let diff: number
    switch (zoomLevel) {
      case 'hour':
        diff = differenceInHours(timestamp, timelineStart)
        break
      case 'week':
        diff = differenceInWeeks(timestamp, timelineStart)
        break
      case 'day':
      default:
        diff = differenceInDays(timestamp, timelineStart)
        break
    }
    return (diff / timelineDuration) * 100
  }

  const handleZoomIn = () => {
    const levels: ZoomLevel[] = ['hour', 'day', 'week']
    const currentIdx = levels.indexOf(zoomLevel)
    if (currentIdx > 0) {
      setZoomLevel(levels[currentIdx - 1])
    }
  }

  const handleZoomOut = () => {
    const levels: ZoomLevel[] = ['hour', 'day', 'week']
    const currentIdx = levels.indexOf(zoomLevel)
    if (currentIdx < levels.length - 1) {
      setZoomLevel(levels[currentIdx + 1])
    }
  }

  const handleEventClick = (timelineEvent: any) => {
    if (timelineEvent.events && timelineEvent.events.length > 0) {
      const firstEvent = timelineEvent.events[0]
      setSelectedEvent(firstEvent)
      onEventClick?.(firstEvent.id)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-lg font-semibold">Memory Timeline</h3>
          <Badge variant="outline">{filteredEvents.length} events</Badge>
          <Badge variant="outline">{timelineEvents.length} periods</Badge>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={handleZoomIn} disabled={zoomLevel === 'hour'} title={zoomLevel === 'hour' ? "Already at maximum zoom" : "Zoom in to see more detailed hourly view of events"}>
            <ZoomIn className="h-4 w-4" />
          </Button>
          <Button size="sm" variant="outline" onClick={handleZoomOut} disabled={zoomLevel === 'week'} title={zoomLevel === 'week' ? "Already at minimum zoom" : "Zoom out to see broader weekly view of events"}>
            <ZoomOut className="h-4 w-4" />
          </Button>
          <Badge variant="outline" className="ml-2" title={`Current view level: ${zoomLevel === 'hour' ? 'Hourly - Shows events grouped by hour' : zoomLevel === 'day' ? 'Daily - Shows events grouped by day' : 'Weekly - Shows events grouped by week'}`}>
            {zoomLevel === 'hour' ? 'Hourly' : zoomLevel === 'day' ? 'Daily' : 'Weekly'} View
          </Badge>
        </div>
      </div>

      <Card className="p-4">
        <div className="space-y-4">
          {/* Timeline visualization */}
          <div className="relative">
            {/* Time axis */}
            <div className="flex justify-between text-xs text-muted-foreground mb-2">
              <span>{format(timelineStart, zoomLevel === 'hour' ? 'MMM d, HH:00' : zoomLevel === 'day' ? 'MMM d' : 'MMM d, yyyy')}</span>
              <span>{format(timelineEnd, zoomLevel === 'hour' ? 'HH:00' : zoomLevel === 'day' ? 'MMM d' : 'MMM d, yyyy')}</span>
            </div>

            {/* Timeline bar */}
            <div className="relative h-20 bg-muted-20 rounded-lg overflow-hidden">
              {/* Background grid */}
              <div className="absolute inset-0 flex">
                {Array.from({ length: 10 }).map((_, i) => (
                  <div key={i} className="flex-1 border-r border-muted-40" />
                ))}
              </div>

              {/* Event bars */}
              {timelineEvents.map((event) => {
                const left = getPositionPercent(event.timestamp)
                const width = Math.max(1, 100 / timelineDuration) // Minimum 1% width

                return (
                  <div
                    key={event.id}
                    className="absolute top-0 bottom-0 cursor-pointer transition-all hover:opacity-80 group"
                    style={{
                      left: `${left}%`,
                      width: `${width}%`,
                      height: `${30 + event.density * 70}%`,
                      backgroundColor: SUBJECT_COLORS[event.subject || 'default'],
                      opacity: 0.7,
                      top: `${50 - (15 + event.density * 35)}%`,
                    }}
                    onMouseEnter={() => setHoveredEvent(event)}
                    onMouseLeave={() => setHoveredEvent(null)}
                    onClick={() => handleEventClick(event)}
                  >
                    {/* Tooltip */}
                    <div className="hidden group-hover:block absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-background border rounded shadow-lg whitespace-nowrap z-10">
                      <div className="text-xs font-medium">{format(event.timestamp, 'PPp')}</div>
                      <div className="text-xs text-muted-foreground">{event.content}</div>
                      {event.subject && (
                        <Badge variant="outline" className="mt-1 text-xs">
                          {event.subject}
                        </Badge>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Hover detail */}
            {hoveredEvent && !selectedEvent && (
              <div className="mt-4 p-3 bg-muted-20 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Badge style={{ backgroundColor: SUBJECT_COLORS[hoveredEvent.subject || 'default'] }}>
                      {hoveredEvent.subject || 'default'}
                    </Badge>
                    <span className="text-sm font-medium">{format(hoveredEvent.timestamp, 'PPpp')}</span>
                  </div>
                  <Badge variant="outline">{hoveredEvent.events?.length || 0} events</Badge>
                </div>
                <div className="flex flex-wrap gap-2">
                  {hoveredEvent.events?.slice(0, 5).map(event => (
                    <Badge key={event.id} className="text-xs" style={{ backgroundColor: KIND_COLORS[event.kind] }}>
                      {event.kind}
                    </Badge>
                  ))}
                  {(hoveredEvent.events?.length || 0) > 5 && (
                    <Badge variant="secondary" className="text-xs">
                      +{(hoveredEvent.events?.length || 0) - 5} more
                    </Badge>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Selected event detail */}
          {selectedEvent && (
            <Card className="p-4 bg-muted-20">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge style={{ backgroundColor: SUBJECT_COLORS[selectedEvent.subject || 'default'] }}>
                      {selectedEvent.subject || 'default'}
                    </Badge>
                    <Badge className="text-white" style={{ backgroundColor: KIND_COLORS[selectedEvent.kind] }}>
                      {selectedEvent.kind}
                    </Badge>
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => setSelectedEvent(null)} title="Clear selection - Hide event details and return to timeline view">
                    Clear
                  </Button>
                </div>

                <div>
                  <div className="text-sm text-muted-foreground mb-1">Timestamp</div>
                  <div className="text-sm font-medium">{format(selectedEvent.timestamp, 'PPpp')}</div>
                </div>

                <div>
                  <div className="text-sm text-muted-foreground mb-1">Actor</div>
                  <div className="text-sm font-medium">{selectedEvent.actor}</div>
                </div>

                <div>
                  <div className="text-sm text-muted-foreground mb-1">Content</div>
                  <div className="text-sm bg-background p-3 rounded border max-h-40 overflow-y-auto">
                    {selectedEvent.content}
                  </div>
                </div>

                {selectedEvent.relatedTo && selectedEvent.relatedTo.length > 0 && (
                  <div>
                    <div className="text-sm text-muted-foreground mb-1">Related Events</div>
                    <div className="flex flex-wrap gap-2">
                      {selectedEvent.relatedTo.map(id => (
                        <Badge key={id} variant="outline" className="font-mono text-xs">
                          {id.slice(0, 8)}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </Card>
          )}

          {/* Legend */}
          <div className="pt-4 border-t">
            <h4 className="text-sm font-semibold mb-3">Legend</h4>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-2">Subject Colors</p>
                <div className="space-y-1">
                  {Object.entries(SUBJECT_COLORS).map(([subject, color]) => (
                    <div key={subject} className="flex items-center gap-2 text-xs">
                      <div className="w-4 h-4 rounded" style={{ backgroundColor: color }} />
                      <span className="capitalize">{subject}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-2">Event Kind Colors</p>
                <div className="space-y-1">
                  {Object.entries(KIND_COLORS).map(([kind, color]) => (
                    <div key={kind} className="flex items-center gap-2 text-xs">
                      <div className="w-4 h-4 rounded" style={{ backgroundColor: color }} />
                      <span className="capitalize">{kind}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </Card>
    </div>
  )
}
