import { Link, useLocation } from 'react-router-dom'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'

interface LayoutProps {
  children: React.ReactNode
}

export function Layout({ children }: LayoutProps) {
  const location = useLocation()

  const navItems = [
    {
      path: '/dashboard',
      label: 'Dashboard',
      icon: '📊',
      title: 'Dashboard - View overview of all test statistics and system status to monitor your testing progress'
    },
    {
      path: '/chat',
      label: 'Chat',
      icon: '💬',
      title: 'Chat Interface - Send messages and test conversational memory storage to see how the system remembers context'
    },
    {
      path: '/retrieval',
      label: 'Retrieval',
      icon: '🔍',
      title: 'Memory Retrieval - Build Active Context Bundles (ACB) to test how the system retrieves relevant memories'
    },
    {
      path: '/visualization',
      label: 'Visualization',
      icon: '📈',
      title: 'Visualization - View memory graphs and session timelines to visually understand memory relationships'
    },
    {
      path: '/metrics',
      label: 'Metrics',
      icon: '📉',
      title: 'Metrics Dashboard - Analyze detailed performance metrics and test run statistics to evaluate system efficiency'
    },
  ]

  const isActive = (path: string) => location.pathname === path

  return (
    <div className="min-h-screen bg-background" data-testid="layout">
      {/* Navigation Sidebar */}
      <div className="flex">
        <aside className="w-64 border-r bg-card min-h-screen sticky top-0">
          <nav className="p-4 space-y-1">
            {navItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  'flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors',
                  isActive(item.path)
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                )}
                data-testid={`nav-${item.label.toLowerCase()}`}
                title={item.title}
              >
                <span className="text-lg">{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            ))}
          </nav>

          <Separator className="my-4" />

          {/* Footer Info */}
          <div className="px-4 pb-4">
            <div className="text-xs text-muted-foreground space-y-1">
              <p>Version: 0.1.0</p>
              <p>© 2025 Agent Memory</p>
            </div>
          </div>
        </aside>

        {/* Main Content Area */}
        <main className="flex-1">
          <div className="container mx-auto px-6 py-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}
