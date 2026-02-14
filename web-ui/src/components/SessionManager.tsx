import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Plus, MessageSquare, Calendar, Clock, Trash2 } from 'lucide-react'
import api from '@/services/api'

export interface Session {
  id: string
  user_id: string
  tenant_id: string
  title?: string
  created_at: string
  updated_at: string
  message_count?: number
  metadata?: Record<string, unknown>
  is_active?: boolean
  expires_at?: string
}

interface SessionManagerProps {
  onSessionSelect?: (sessionId: string) => void
  currentSessionId?: string
}

export function SessionManager({ onSessionSelect, currentSessionId }: SessionManagerProps) {
  const [sessions, setSessions] = useState<Session[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [isOpen, setIsOpen] = useState(false)

  // Load sessions when dialog opens
  useEffect(() => {
    if (isOpen) {
      loadSessions()
    }
  }, [isOpen])

  const loadSessions = async () => {
    setIsLoading(true)
    setError(null)

    try {
      // Try to fetch sessions from API
      const response = await api.get<{ sessions: Session[] }>('/api/v1/sessions')
      setSessions(response.data.sessions || [])
    } catch (err) {
      // If API endpoint doesn't exist, use empty state
      console.warn('Sessions API not available:', err)
      setSessions([])
    } finally {
      setIsLoading(false)
    }
  }

  const createSession = async () => {
    setIsCreating(true)
    setError(null)

    try {
      const response = await api.post<{
        session_id: string
        user_id: string
        tenant_id: string
        title: string
        created_at: string
        updated_at: string
      }>('/api/v1/sessions', {
        title: `Session ${new Date().toLocaleString()}`,
      })

      // API returns session data directly, construct Session object
      const newSession: Session = {
        id: response.data.session_id,
        user_id: response.data.user_id,
        tenant_id: response.data.tenant_id,
        title: response.data.title,
        created_at: response.data.created_at,
        updated_at: response.data.updated_at,
      }

      setSessions(prev => [newSession, ...prev])

      // Notify parent component
      if (onSessionSelect) {
        onSessionSelect(newSession.id)
      }

      setIsOpen(false)
    } catch (err) {
      setError('Failed to create session')
      console.error('Create session failed:', err)
    } finally {
      setIsCreating(false)
    }
  }

  const deleteSession = async (sessionId: string) => {
    try {
      await api.delete(`/api/v1/sessions/${sessionId}`)
      setSessions(prev => prev.filter(s => s.id !== sessionId))
    } catch (err) {
      setError('Failed to delete session')
      console.error('Delete session failed:', err)
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }

  const formatTime = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" data-testid="session-manager-trigger" title="Manage sessions to organize different test scenarios and keep your conversations separate">
          <MessageSquare className="h-4 w-4 mr-2" />
          Sessions
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px]" data-testid="session-manager-dialog">
        <DialogHeader>
          <DialogTitle>Session Management</DialogTitle>
          <DialogDescription>
            Create and manage your memory sessions to keep different test scenarios organized
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Actions */}
          <div className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground" title={`You have ${sessions.length} session${sessions.length !== 1 ? 's' : ''} - each session keeps memory data separate for cleaner testing`}>
              {sessions.length} session{sessions.length !== 1 ? 's' : ''}
            </div>
            <Button
              onClick={createSession}
              disabled={isCreating}
              size="sm"
              data-testid="create-session-button"
              title={
                isCreating
                  ? "Creating new session to start a fresh test scenario..."
                  : "Create a new session to test memory in isolation from previous conversations"
              }
            >
              <Plus className="h-4 w-4 mr-2" />
              {isCreating ? 'Creating...' : 'New Session'}
            </Button>
          </div>

          {/* Error Message */}
          {error && (
            <div className="text-sm text-destructive" data-testid="session-error" title={`Error: ${error} - please try again or check your connection`}>
              {error}
            </div>
          )}

          {/* Sessions List */}
          <ScrollArea className="h-[400px] w-full rounded-md border">
            {isLoading ? (
              <div className="flex items-center justify-center h-40">
                <div className="text-sm text-muted-foreground">Loading sessions...</div>
              </div>
            ) : sessions.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-40 text-muted-foreground">
                <MessageSquare className="h-12 w-12 mb-2 opacity-50" />
                <p className="text-sm">No sessions yet</p>
                <p className="text-xs mt-1">Create your first session to start testing memory operations</p>
              </div>
            ) : (
              <div className="divide-y">
                {sessions.map((session) => (
                  <div
                    key={session.id}
                    className={`p-4 hover:bg-muted/50 transition-colors cursor-pointer ${
                      currentSessionId === session.id ? 'bg-muted' : ''
                    }`}
                    onClick={() => {
                      if (onSessionSelect) {
                        onSessionSelect(session.id)
                        setIsOpen(false)
                      }
                    }}
                    data-testid={`session-${session.id}`}
                    title={`Switch to this session to continue testing with its memory context and history`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-medium truncate">
                            {session.title || `Session ${session.id.slice(0, 8)}`}
                          </h4>
                          {currentSessionId === session.id && (
                            <Badge variant="secondary" className="text-xs" title="This is your currently active session - messages are stored here">
                              Active
                            </Badge>
                          )}
                        </div>

                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          <div className="flex items-center gap-1" title={`Created on ${formatDate(session.created_at)} - helps identify when you started this test`}>
                            <Calendar className="h-3 w-3" />
                            {formatDate(session.created_at)}
                          </div>
                          <div className="flex items-center gap-1" title={`Created at ${formatTime(session.created_at)} - shows start time of this test session`}>
                            <Clock className="h-3 w-3" />
                            {formatTime(session.created_at)}
                          </div>
                          {session.message_count !== undefined && (
                            <div className="flex items-center gap-1" title={`${session.message_count} message${session.message_count !== 1 ? 's' : ''} stored - indicates how much memory data this session contains`}>
                              <MessageSquare className="h-3 w-3" />
                              {session.message_count} message{session.message_count !== 1 ? 's' : ''}
                            </div>
                          )}
                        </div>
                      </div>

                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={(e: React.MouseEvent) => {
                          e.stopPropagation()
                          deleteSession(session.id)
                        }}
                        data-testid={`delete-session-${session.id}`}
                        title={`Delete this session and all its memory data - useful for cleaning up test results`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  )
}
