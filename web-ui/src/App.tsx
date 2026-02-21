import { useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ErrorBoundary } from './components/common/ErrorBoundary'
import { Layout } from './components/layout/Layout'
import { NavHeader } from './components/layout/NavHeader'
import { Dashboard, Chat, Retrieval, Visualization, Metrics, Projects, ProjectDetail } from './pages'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
})

function AppLayout() {
  const [currentSessionId, setCurrentSessionId] = useState<string | undefined>()

  const handleSessionSelect = (sessionId: string) => {
    console.log('Selected session:', sessionId)
    setCurrentSessionId(sessionId)
  }

  return (
    <>
      <NavHeader
        currentSessionId={currentSessionId}
        onSessionSelect={handleSessionSelect}
      />
      <Layout>
        <Outlet />
      </Layout>
    </>
  )
}

function AppContent() {
  return (
    <Routes>
      {/* All routes are now public - no authentication */}
      <Route element={<AppLayout />}>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/chat" element={<Chat />} />
        <Route path="/retrieval" element={<Retrieval />} />
        <Route path="/visualization" element={<Visualization />} />
        <Route path="/metrics" element={<Metrics />} />
        <Route path="/projects" element={<Projects />} />
        <Route path="/projects/:projectId" element={<ProjectDetail />} />
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
      </Route>
    </Routes>
  )
}

function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <AppContent />
        </BrowserRouter>
      </QueryClientProvider>
    </ErrorBoundary>
  )
}

export default App
