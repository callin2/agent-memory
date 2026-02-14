import { useState, useMemo } from 'react'
import { format } from 'date-fns'
import { MemoryEvent, FilterOptions } from '@/types'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select'
import { ChevronLeft, ChevronRight, Download, Search, X } from 'lucide-react'

interface DatabaseViewProps {
  events: MemoryEvent[]
  filters: FilterOptions
  onFiltersChange: (filters: FilterOptions) => void
  onEventClick?: (eventId: string) => void
}

const ITEMS_PER_PAGE = 100

const KIND_COLORS: Record<string, string> = {
  'message': 'bg-blue-100 text-blue-800 hover:bg-blue-200',
  'decision': 'bg-purple-100 text-purple-800 hover:bg-purple-200',
  'reply': 'bg-green-100 text-green-800 hover:bg-green-200',
  'reference': 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200',
  'capsule': 'bg-red-100 text-red-800 hover:bg-red-200',
}

export function DatabaseView({ events, filters, onFiltersChange, onEventClick }: DatabaseViewProps) {
  const [sortField, setSortField] = useState<keyof MemoryEvent>('timestamp')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc')
  const [currentPage, setCurrentPage] = useState(1)
  const [selectedEvent, setSelectedEvent] = useState<MemoryEvent | null>(null)

  // Filter and sort events
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
      if (filters.searchQuery) {
        const query = filters.searchQuery.toLowerCase()
        return (
          event.content.toLowerCase().includes(query) ||
          event.actor.toLowerCase().includes(query) ||
          event.sessionId.toLowerCase().includes(query) ||
          (event.subject && event.subject.toLowerCase().includes(query))
        )
      }
      return true
    })
  }, [events, filters])

  // Sort events
  const sortedEvents = useMemo(() => {
    return [...filteredEvents].sort((a, b) => {
      const aValue = a[sortField]
      const bValue = b[sortField]

      if (aValue === undefined || bValue === undefined) return 0

      if (sortDirection === 'asc') {
        return aValue > bValue ? 1 : -1
      } else {
        return aValue < bValue ? 1 : -1
      }
    })
  }, [filteredEvents, sortField, sortDirection])

  // Pagination
  const totalPages = Math.ceil(sortedEvents.length / ITEMS_PER_PAGE)
  const paginatedEvents = sortedEvents.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  )

  const handleSort = (field: keyof MemoryEvent) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection('asc')
    }
  }

  const handleExport = (exportFormat: 'csv' | 'json') => {
    const data = sortedEvents
    if (exportFormat === 'json') {
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `memory-events-${format(new Date(), 'yyyy-MM-dd')}.json`
      a.click()
      URL.revokeObjectURL(url)
    } else {
      const headers = ['ID', 'Timestamp', 'Session ID', 'Actor', 'Kind', 'Subject', 'Content', 'Tags']
      const rows = data.map(event => [
        event.id,
        format(event.timestamp, 'yyyy-MM-dd HH:mm:ss'),
        event.sessionId,
        event.actor,
        event.kind,
        event.subject || '',
        `"${event.content.replace(/"/g, '""')}"`,
        event.tags?.join('; ') || '',
      ])
      const csv = [headers.join(','), ...rows.map(row => row.join(','))].join('\n')
      const blob = new Blob([csv], { type: 'text/csv' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `memory-events-${format(new Date(), 'yyyy-MM-dd')}.csv`
      a.click()
      URL.revokeObjectURL(url)
    }
  }

  const uniqueSubjects = Array.from(new Set(events.map(e => e.subject).filter(Boolean)))
  const uniqueKinds = Array.from(new Set(events.map(e => e.kind)))

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-lg font-semibold">Database View</h3>
          <Badge variant="outline">{sortedEvents.length} events</Badge>
        </div>
        <div className="flex items-center gap-2">
          <Select onValueChange={(value: string) => handleExport(value as 'csv' | 'json')}>
            <SelectTrigger className="w-32" title="Export - Download filtered memory events as CSV or JSON for offline analysis">
              <Download className="h-4 w-4 mr-2" />
              Export
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="csv" title="Export as CSV - Download data in spreadsheet-compatible format for Excel or Google Sheets">CSV</SelectItem>
              <SelectItem value="json" title="Export as JSON - Download data in JSON format for programmatic processing">JSON</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Card className="p-4">
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by content, actor, session, or subject..."
              value={filters.searchQuery}
              onChange={(e) => onFiltersChange({ ...filters, searchQuery: e.target.value })}
              className="flex-1"
              title="Search events - Type keywords to filter memory events by content, actor name, session ID, or subject tag"
            />
            {filters.searchQuery && (
              <Button size="sm" variant="ghost" onClick={() => onFiltersChange({ ...filters, searchQuery: '' })} title="Clear search - Remove search filter to show all events">
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Filter by Subject</label>
              <div className="flex flex-wrap gap-2">
                {uniqueSubjects.map(subject => (
                  <Badge
                    key={subject}
                    variant={filters.subjects.includes(subject || '') ? 'default' : 'outline'}
                    className="cursor-pointer"
                    onClick={() => {
                      const newSubjects = filters.subjects.includes(subject || '')
                        ? filters.subjects.filter(s => s !== subject)
                        : [...filters.subjects, subject || '']
                      onFiltersChange({ ...filters, subjects: newSubjects })
                    }}
                    title={`Filter by ${subject} - ${filters.subjects.includes(subject || '') ? 'Click to remove' : 'Click to add'} ${subject} subject filter`}
                  >
                    {subject}
                  </Badge>
                ))}
              </div>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Filter by Kind</label>
              <div className="flex flex-wrap gap-2">
                {uniqueKinds.map(kind => (
                  <Badge
                    key={kind}
                    variant={filters.kinds.includes(kind) ? 'default' : 'outline'}
                    className="cursor-pointer"
                    onClick={() => {
                      const newKinds = filters.kinds.includes(kind)
                        ? filters.kinds.filter(k => k !== kind)
                        : [...filters.kinds, kind]
                      onFiltersChange({ ...filters, kinds: newKinds })
                    }}
                    title={`Filter by ${kind} - ${filters.kinds.includes(kind) ? 'Click to remove' : 'Click to add'} ${kind} event type filter`}
                  >
                    {kind}
                  </Badge>
                ))}
              </div>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Date Range</label>
              <div className="space-y-2">
                <Input
                  type="date"
                  value={filters.dateRange.from ? format(filters.dateRange.from, 'yyyy-MM-dd') : ''}
                  onChange={(e) => onFiltersChange({
                    ...filters,
                    dateRange: { ...filters.dateRange, from: e.target.value ? new Date(e.target.value) : undefined }
                  })}
                  title="From date - Show only events after this date"
                />
                <Input
                  type="date"
                  value={filters.dateRange.to ? format(filters.dateRange.to, 'yyyy-MM-dd') : ''}
                  onChange={(e) => onFiltersChange({
                    ...filters,
                    dateRange: { ...filters.dateRange, to: e.target.value ? new Date(e.target.value) : undefined }
                  })}
                  title="To date - Show only events before this date"
                />
              </div>
            </div>
          </div>
        </div>
      </Card>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-muted">
              <tr>
                <th
                  className="px-4 py-2 text-left text-sm font-medium cursor-pointer hover:bg-muted-80"
                  onClick={() => handleSort('timestamp')}
                  title={`Sort by Timestamp ${sortField === 'timestamp' ? `(currently ${sortDirection === 'asc' ? 'ascending' : 'descending'})` : '- Click to sort events by time'}`}
                >
                  Timestamp {sortField === 'timestamp' && (sortDirection === 'asc' ? '↑' : '↓')}
                </th>
                <th
                  className="px-4 py-2 text-left text-sm font-medium cursor-pointer hover:bg-muted-80"
                  onClick={() => handleSort('sessionId')}
                  title={`Sort by Session ID ${sortField === 'sessionId' ? `(currently ${sortDirection === 'asc' ? 'ascending' : 'descending'})` : '- Click to sort events by session'}`}
                >
                  Session ID {sortField === 'sessionId' && (sortDirection === 'asc' ? '↑' : '↓')}
                </th>
                <th
                  className="px-4 py-2 text-left text-sm font-medium cursor-pointer hover:bg-muted-80"
                  onClick={() => handleSort('actor')}
                  title={`Sort by Actor ${sortField === 'actor' ? `(currently ${sortDirection === 'asc' ? 'ascending' : 'descending'})` : '- Click to sort events by who created them'}`}
                >
                  Actor {sortField === 'actor' && (sortDirection === 'asc' ? '↑' : '↓')}
                </th>
                <th
                  className="px-4 py-2 text-left text-sm font-medium cursor-pointer hover:bg-muted-80"
                  onClick={() => handleSort('kind')}
                  title={`Sort by Kind ${sortField === 'kind' ? `(currently ${sortDirection === 'asc' ? 'ascending' : 'descending'})` : '- Click to sort events by type'}`}
                >
                  Kind {sortField === 'kind' && (sortDirection === 'asc' ? '↑' : '↓')}
                </th>
                <th className="px-4 py-2 text-left text-sm font-medium">Subject</th>
                <th className="px-4 py-2 text-left text-sm font-medium">Content</th>
                <th className="px-4 py-2 text-left text-sm font-medium">Tags</th>
              </tr>
            </thead>
            <tbody>
              {paginatedEvents.map((event, idx) => (
                <tr
                  key={event.id}
                  className={`border-t cursor-pointer hover:bg-muted-50 ${
                    idx % 2 === 0 ? 'bg-background' : 'bg-muted-20'
                  }`}
                  onClick={() => {
                    setSelectedEvent(event)
                    onEventClick?.(event.id)
                  }}
                  title={`Click to view details for this ${event.kind} event from ${event.actor}`}
                >
                  <td className="px-4 py-2 text-sm">
                    {format(event.timestamp, 'yyyy-MM-dd HH:mm:ss')}
                  </td>
                  <td className="px-4 py-2 text-sm font-mono text-xs">
                    {event.sessionId.slice(0, 8)}...
                  </td>
                  <td className="px-4 py-2 text-sm">{event.actor}</td>
                  <td className="px-4 py-2 text-sm">
                    <Badge className={KIND_COLORS[event.kind] || 'bg-gray-100'}>
                      {event.kind}
                    </Badge>
                  </td>
                  <td className="px-4 py-2 text-sm">
                    {event.subject && <Badge variant="outline">{event.subject}</Badge>}
                  </td>
                  <td className="px-4 py-2 text-sm max-w-md truncate">
                    {event.content}
                  </td>
                  <td className="px-4 py-2 text-sm">
                    <div className="flex flex-wrap gap-1">
                      {event.tags?.slice(0, 3).map(tag => (
                        <Badge key={tag} variant="secondary" className="text-xs">
                          {tag}
                        </Badge>
                      ))}
                      {event.tags && event.tags.length > 3 && (
                        <Badge variant="secondary" className="text-xs">
                          +{event.tags.length - 3}
                        </Badge>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between px-4 py-2 border-t">
          <div className="text-sm text-muted-foreground">
            Showing {(currentPage - 1) * ITEMS_PER_PAGE + 1} to {Math.min(currentPage * ITEMS_PER_PAGE, sortedEvents.length)} of {sortedEvents.length} events
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              title={currentPage === 1 ? "Already on first page" : "Go to previous page"}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm">
              Page {currentPage} of {totalPages || 1}
            </span>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages || totalPages === 0}
              title={currentPage === totalPages || totalPages === 0 ? "Already on last page" : "Go to next page"}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </Card>

      {selectedEvent && (
        <Card className="p-4">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="font-semibold">Event Details</h4>
              <Button size="sm" variant="ghost" onClick={() => setSelectedEvent(null)} title="Close details panel - Hide event details and return to table view">
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="font-medium">ID:</span>
                <span className="ml-2 font-mono text-xs">{selectedEvent.id}</span>
              </div>
              <div>
                <span className="font-medium">Timestamp:</span>
                <span className="ml-2">{format(selectedEvent.timestamp, 'PPpp')}</span>
              </div>
              <div>
                <span className="font-medium">Session ID:</span>
                <span className="ml-2 font-mono text-xs">{selectedEvent.sessionId}</span>
              </div>
              <div>
                <span className="font-medium">Actor:</span>
                <span className="ml-2">{selectedEvent.actor}</span>
              </div>
              <div>
                <span className="font-medium">Kind:</span>
                <span className="ml-2">{selectedEvent.kind}</span>
              </div>
              <div>
                <span className="font-medium">Subject:</span>
                <span className="ml-2">{selectedEvent.subject || 'N/A'}</span>
              </div>
            </div>
            <div>
              <span className="font-medium text-sm">Content:</span>
              <p className="mt-1 text-sm whitespace-pre-wrap bg-muted-20 p-3 rounded-md">
                {selectedEvent.content}
              </p>
            </div>
            {selectedEvent.relatedTo && selectedEvent.relatedTo.length > 0 && (
              <div>
                <span className="font-medium text-sm">Related Events:</span>
                <div className="mt-1 flex flex-wrap gap-2">
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
    </div>
  )
}
