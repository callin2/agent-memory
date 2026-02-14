import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { SessionManager } from '@/components/SessionManager'
import { ChatInterface } from '@/components/ChatInterface'
import { Button } from '@/components/ui/button'
import { MessageSquare, Loader2 } from 'lucide-react'

export function Chat() {
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null)
  const [isSessionReady, setIsSessionReady] = useState(false)
  const [isCreatingSession, setIsCreatingSession] = useState(false)

  // Generate a unique session ID
  const generateSessionId = () => {
    return `session-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
  }

  // Load session from localStorage on mount
  useEffect(() => {
    const savedSessionId = localStorage.getItem('current_chat_session')
    if (savedSessionId) {
      setCurrentSessionId(savedSessionId)
      setIsSessionReady(true)
    } else {
      // Create a default session if none exists
      const newSessionId = generateSessionId()
      setCurrentSessionId(newSessionId)
      setIsSessionReady(true)
    }
  }, [])

  // Save session to localStorage when it changes
  useEffect(() => {
    if (currentSessionId) {
      localStorage.setItem('current_chat_session', currentSessionId)
      setIsSessionReady(true)
    }
  }, [currentSessionId])

  const handleNewSession = () => {
    setIsCreatingSession(true)

    // Clear current session
    localStorage.removeItem('current_chat_session')
    setCurrentSessionId(null)
    setIsSessionReady(false)

    // Small delay to show loading state
    setTimeout(() => {
      // Create new session ID
      const newSessionId = generateSessionId()
      setCurrentSessionId(newSessionId)
      setIsSessionReady(true)
      setIsCreatingSession(false)
    }, 500)
  }

  const handleSessionChange = (sessionId: string) => {
    setCurrentSessionId(sessionId)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold" data-testid="chat-page">Chat Interface</h1>
          <p className="text-muted-foreground">
            Test conversational memory operations
          </p>
        </div>
        <SessionManager
          currentSessionId={currentSessionId || undefined}
          onSessionSelect={handleSessionChange}
        />
      </div>

      {/* Main Chat Area */}
      {isSessionReady && currentSessionId ? (
        <Card className="h-[800px]">
          <CardHeader className="border-b">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <MessageSquare className="h-5 w-5" />
                  Conversation
                </CardTitle>
                <CardDescription>
                  Session ID: {currentSessionId.slice(0, 8)}...
                </CardDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleNewSession}
                disabled={isCreatingSession}
                title="Start a fresh session to test memory with clean state and no previous conversation history"
              >
                {isCreatingSession ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  'New Session'
                )}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-6 h-[calc(100%-80px)]">
            <ChatInterface
              sessionId={currentSessionId}
              agentId="test-agent"
              tenantId="default"
            />
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="flex h-[400px] items-center justify-center">
            <div className="text-center">
              <MessageSquare className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
              <p className="text-lg font-medium">Loading session...</p>
              <p className="text-sm text-muted-foreground">
                Please wait while we set up your chat session
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Feature Info Cards */}
      <div className="grid gap-6 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Multi-Subject Tagging</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Organize conversations with subject tags for better memory retrieval
              and context management.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Scenario Generation</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Generate realistic test conversations with configurable complexity and
              length for testing memory operations.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Session Management</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Create and manage multiple conversation sessions for different
              testing scenarios.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
