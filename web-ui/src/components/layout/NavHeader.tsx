import { Link } from 'react-router-dom'
import { SessionManager } from '@/components/SessionManager'

interface NavHeaderProps {
  currentSessionId?: string
  onSessionSelect?: (sessionId: string) => void
}

export function NavHeader({
  currentSessionId,
  onSessionSelect
}: NavHeaderProps) {
  const handleSessionSelect = (sessionId: string) => {
    if (onSessionSelect) {
      onSessionSelect(sessionId)
    }
  }

  return (
    <header className="border-b bg-card" data-testid="nav-header">
      <div className="container mx-auto px-4 py-3">
        <div className="flex items-center justify-between">
          {/* Logo and Title */}
          <Link to="/" className="flex items-center space-x-2" title="Return to Dashboard to see all test results and statistics">
            <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-lg">M</span>
            </div>
            <div>
              <h1 className="text-lg font-semibold">Memory Test Harness</h1>
              <p className="text-xs text-muted-foreground">Agent Memory Testing</p>
            </div>
          </Link>

          {/* Session Manager */}
          <div className="flex items-center gap-3">
            <SessionManager
              onSessionSelect={handleSessionSelect}
              currentSessionId={currentSessionId}
            />
          </div>
        </div>
      </div>
    </header>
  )
}
