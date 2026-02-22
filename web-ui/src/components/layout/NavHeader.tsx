import { Link, useLocation } from 'react-router-dom'
import { SessionManager } from '@/components/SessionManager'
import { cn } from '@/lib/utils'

interface NavHeaderProps {
  currentSessionId?: string
  onSessionSelect?: (sessionId: string) => void
}

const navLinks = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/projects', label: 'Projects' },
  { href: '/chat', label: 'Chat' },
  { href: '/retrieval', label: 'Retrieval' },
  { href: '/visualization', label: 'Visualization' },
  { href: '/metrics', label: 'Metrics' },
]

export function NavHeader({
  currentSessionId,
  onSessionSelect
}: NavHeaderProps) {
  const location = useLocation()

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
          <Link to="/" className="flex items-center space-x-2" title="Return to Dashboard">
            <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-lg">M</span>
            </div>
            <div>
              <h1 className="text-lg font-semibold">Memory Test Harness</h1>
              <p className="text-xs text-muted-foreground">Agent Memory Testing</p>
            </div>
          </Link>

          {/* Navigation Links */}
          <nav className="hidden md:flex items-center gap-1">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                to={link.href}
                className={cn(
                  "px-3 py-2 rounded-md text-sm font-medium transition-colors",
                  location.pathname === link.href || (link.href !== '/' && location.pathname.startsWith(link.href))
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                {link.label}
              </Link>
            ))}
          </nav>

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
