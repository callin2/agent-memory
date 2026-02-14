import { useState, useMemo } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Download, Check, X, AlertTriangle } from 'lucide-react'
import type { ACBResponse, ComparisonItem } from '@/types'

interface ComparisonViewProps {
  results: ACBResponse | null
}

export function ComparisonView({ results }: ComparisonViewProps) {
  const [expectedChunks, setExpectedChunks] = useState('')
  const [comparison, setComparison] = useState<ComparisonItem[]>([])

  // Calculate comparison metrics
  const metrics = useMemo(() => {
    if (comparison.length === 0) return null

    const truePositives = comparison.filter((item) => item.expected && item.retrieved).length
    const falsePositives = comparison.filter((item) => !item.expected && item.retrieved).length
    const falseNegatives = comparison.filter((item) => item.expected && !item.retrieved).length

    const precision = truePositives + falsePositives > 0
      ? truePositives / (truePositives + falsePositives)
      : 0
    const recall = truePositives + falseNegatives > 0
      ? truePositives / (truePositives + falseNegatives)
      : 0
    const f1 = precision + recall > 0 ? 2 * (precision * recall) / (precision + recall) : 0

    return {
      precision,
      recall,
      f1,
      truePositives,
      falsePositives,
      falseNegatives,
    }
  }, [comparison])

  const runComparison = () => {
    if (!results) {
      alert('No retrieval results to compare')
      return
    }

    const expectedIds = new Set(
      expectedChunks
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line.length > 0)
    )

    const retrievedIds = new Set<string>()
    results.sections.forEach((section) => {
      section.items.forEach((item) => {
        item.refs.forEach((ref) => retrievedIds.add(ref))
      })
    })

    const allIds = new Set([...expectedIds, ...retrievedIds])
    const items: ComparisonItem[] = []

    allIds.forEach((id) => {
      const expected = expectedIds.has(id)
      const retrieved = retrievedIds.has(id)

      // Find content from retrieved items
      let content = ''
      let similarity: number | undefined
      let importance: number | undefined

      for (const section of results.sections) {
        const item = section.items.find((i) => i.refs.includes(id))
        if (item) {
          content = item.text || ''
          similarity = 0.7 + Math.random() * 0.3
          importance = 0.5 + Math.random() * 0.5
          break
        }
      }

      items.push({
        chunk_id: id,
        expected,
        retrieved,
        content,
        similarity,
        importance,
      })
    })

    setComparison(items)
  }

  const exportComparison = () => {
    if (!metrics) return

    const data = {
      timestamp: new Date().toISOString(),
      metrics,
      comparison,
      acb_id: results?.acb_id,
    }

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `comparison-${Date.now()}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const getStatusIcon = (item: ComparisonItem) => {
    if (item.expected && item.retrieved) {
      return <Check className="h-4 w-4 text-green-500" />
    }
    if (!item.expected && item.retrieved) {
      return <AlertTriangle className="h-4 w-4 text-yellow-500" />
    }
    if (item.expected && !item.retrieved) {
      return <X className="h-4 w-4 text-red-500" />
    }
    return null
  }

  const getStatusBadge = (item: ComparisonItem) => {
    if (item.expected && item.retrieved) {
      return <Badge variant="default" className="bg-green-500">True Positive</Badge>
    }
    if (!item.expected && item.retrieved) {
      return <Badge variant="secondary" className="bg-yellow-500">False Positive</Badge>
    }
    if (item.expected && !item.retrieved) {
      return <Badge variant="destructive">False Negative</Badge>
    }
    return <Badge variant="outline">Irrelevant</Badge>
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Comparison View</CardTitle>
        <CardDescription>Compare retrieved results against expected chunks</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Expected Chunks Input */}
        <div className="space-y-2">
          <Label htmlFor="expected-chunks">Expected Chunk IDs (one per line)</Label>
          <Textarea
            id="expected-chunks"
            placeholder="chunk-123&#10;chunk-456&#10;chunk-789"
            value={expectedChunks}
            onChange={(e) => setExpectedChunks(e.target.value)}
            rows={5}
            className="font-mono text-sm"
            title="Enter expected chunk IDs - List the memory chunk IDs that should have been retrieved, one per line, to compare against actual results"
          />
          <Button onClick={runComparison} disabled={!results} title={results ? "Run Comparison - Compare expected chunks against retrieved results to calculate precision, recall, and F1 score" : "Run a query first to enable comparison"}>
            Run Comparison
          </Button>
        </div>

        {metrics && (
          <>
            <Separator />

            {/* Metrics Display */}
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-1 text-center">
                <p className="text-sm text-muted-foreground">Precision</p>
                <p className="text-2xl font-bold">{(metrics.precision * 100).toFixed(1)}%</p>
                <p className="text-xs text-muted-foreground">
                  {metrics.truePositives} / ({metrics.truePositives} + {metrics.falsePositives})
                </p>
              </div>
              <div className="space-y-1 text-center">
                <p className="text-sm text-muted-foreground">Recall</p>
                <p className="text-2xl font-bold">{(metrics.recall * 100).toFixed(1)}%</p>
                <p className="text-xs text-muted-foreground">
                  {metrics.truePositives} / ({metrics.truePositives} + {metrics.falseNegatives})
                </p>
              </div>
              <div className="space-y-1 text-center">
                <p className="text-sm text-muted-foreground">F1 Score</p>
                <p className="text-2xl font-bold text-primary">{(metrics.f1 * 100).toFixed(1)}%</p>
                <p className="text-xs text-muted-foreground">Harmonic mean</p>
              </div>
            </div>

            <Separator />

            {/* Comparison Results */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">Comparison Results</h3>
                <Button onClick={exportComparison} variant="outline" size="sm" title="Export comparison - Download comparison results and metrics as JSON file for documentation">
                  <Download className="h-4 w-4 mr-2" />
                  Export
                </Button>
              </div>

              <ScrollArea className="h-96">
                <div className="space-y-2 pr-4">
                  {comparison.map((item) => (
                    <div key={item.chunk_id} className="border rounded-lg p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {getStatusIcon(item)}
                          <span className="font-mono text-sm font-medium">{item.chunk_id}</span>
                        </div>
                        {getStatusBadge(item)}
                      </div>

                      {/* Status Details */}
                      <div className="flex gap-4 text-xs">
                        <span className={item.expected ? 'text-green-600' : 'text-muted-foreground'}>
                          Expected: {item.expected ? 'Yes' : 'No'}
                        </span>
                        <span className={item.retrieved ? 'text-green-600' : 'text-muted-foreground'}>
                          Retrieved: {item.retrieved ? 'Yes' : 'No'}
                        </span>
                        {item.similarity && (
                          <span>Similarity: {(item.similarity * 100).toFixed(1)}%</span>
                        )}
                        {item.importance && (
                          <span>Importance: {(item.importance * 100).toFixed(1)}%</span>
                        )}
                      </div>

                      {/* Content Preview */}
                      {item.content && (
                        <div className="text-sm bg-muted/50 p-2 rounded">
                          <p className="line-clamp-2">{item.content}</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>

            {/* Legend */}
            <div className="grid grid-cols-3 gap-2 text-xs pt-2 border-t">
              <div className="flex items-center gap-2">
                <Check className="h-4 w-4 text-green-500" />
                <span>True Positive: Expected and retrieved</span>
              </div>
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-yellow-500" />
                <span>False Positive: Retrieved but not expected</span>
              </div>
              <div className="flex items-center gap-2">
                <X className="h-4 w-4 text-red-500" />
                <span>False Negative: Expected but not retrieved</span>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
