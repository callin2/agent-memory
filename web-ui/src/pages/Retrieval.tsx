import { useState, useEffect } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2 } from 'lucide-react'
import { QueryBuilder } from '@/components/QueryBuilder'
import { RetrievalResults } from '@/components/RetrievalResults'
import { SimilarityScores } from '@/components/SimilarityScores'
import { ComparisonView } from '@/components/ComparisonView'
import { RelevanceFeedback } from '@/components/RelevanceFeedback'
import { requestACB } from '@/services/api'
import type { ACBRequest, ACBResponse, QueryPreset } from '@/types'

export function Retrieval() {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [results, setResults] = useState<ACBResponse | null>(null)
  const [savedQueries, setSavedQueries] = useState<QueryPreset[]>([])
  const [tenantId] = useState('tenant-default')

  useEffect(() => {
    // Load saved queries from localStorage
    const saved = localStorage.getItem('query_presets')
    if (saved) {
      try {
        setSavedQueries(JSON.parse(saved))
      } catch (e) {
        console.error('Failed to load saved queries:', e)
      }
    }
  }, [])

  const handleRetrieve = async (params: ACBRequest) => {
    setIsLoading(true)
    setError(null)
    setResults(null)

    try {
      // Use transparent API - backend auto-builds ACB via middleware
      const response = await requestACB({
        sessionId: params.session_id,
        agentId: params.agent_id,
        tenantId,
        ...params,
      })
      setResults(response)
    } catch (err: any) {
      const errorMessage = err.response?.data?.error || err.message || 'Failed to retrieve context'
      setError(errorMessage)
      console.error('ACB retrieval error:', err)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="space-y-6" data-testid="retrieval-page">
      <div>
        <h1 className="text-3xl font-bold">Memory Retrieval Testing</h1>
        <p className="text-muted-foreground">
          Test ACB (Active Context Bundle) memory retrieval with various query parameters
        </p>
      </div>

      {/* Error Alert */}
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Loading State */}
      {isLoading && (
        <div className="flex items-center justify-center p-8">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="ml-2">Building Active Context Bundle...</span>
        </div>
      )}

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Query Builder - Left Column */}
        <div className="lg:col-span-1">
          <QueryBuilder
            onRetrieve={handleRetrieve}
            isLoading={isLoading}
            tenantId={tenantId}
            savedQueries={savedQueries}
          />
        </div>

        {/* Results and Analysis - Right Columns */}
        <div className="lg:col-span-2">
          {results ? (
            <Tabs defaultValue="results" className="space-y-4">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="results" title="Results tab - View retrieved memory chunks and context that match your query parameters">
                  Results
                </TabsTrigger>
                <TabsTrigger value="scores" title="Scores tab - View similarity scores and relevance metrics to understand how well memories match your query">
                  Scores
                </TabsTrigger>
                <TabsTrigger value="comparison" title="Comparison tab - Compare retrieved memories side by side to analyze their differences and overlaps">
                  Comparison
                </TabsTrigger>
                <TabsTrigger value="feedback" title="Feedback tab - Provide relevance feedback on retrieved memories to help improve future retrieval accuracy">
                  Feedback
                </TabsTrigger>
              </TabsList>

              <TabsContent value="results" className="space-y-4">
                <RetrievalResults results={results} />
              </TabsContent>

              <TabsContent value="scores" className="space-y-4">
                <SimilarityScores results={results} />
              </TabsContent>

              <TabsContent value="comparison" className="space-y-4">
                <ComparisonView results={results} />
              </TabsContent>

              <TabsContent value="feedback" className="space-y-4">
                <RelevanceFeedback results={results} />
              </TabsContent>
            </Tabs>
          ) : (
            <div className="text-center p-12 border rounded-lg bg-muted/50">
              <p className="text-muted-foreground">
                Use Query Builder to retrieve context and see results here
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
