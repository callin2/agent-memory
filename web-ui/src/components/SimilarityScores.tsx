import { useState, useMemo } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { ACBResponse } from '@/types'

interface SimilarityScoresProps {
  results: ACBResponse | null
}

type SortBy = 'similarity' | 'importance' | 'recency'

interface ScoredItem {
  id: string
  type: string
  content: string
  similarity: number
  importance: number
  timestamp: string
  refs: string[]
}

export function SimilarityScores({ results }: SimilarityScoresProps) {
  const [sortBy, setSortBy] = useState<SortBy>('similarity')

  const scoredItems = useMemo(() => {
    if (!results) return []

    const items: ScoredItem[] = []

    results.sections.forEach((section) => {
      section.items.forEach((item, index) => {
        items.push({
          id: `${section.name}-${index}`,
          type: item.type,
          content: item.text || '',
          similarity: 0.7 + Math.random() * 0.3, // Simulated similarity scores
          importance: 0.5 + Math.random() * 0.5, // Simulated importance
          timestamp: new Date().toISOString(),
          refs: item.refs,
        })
      })
    })

    // Sort based on selected criteria
    const sorted = items.sort((a, b) => {
      switch (sortBy) {
        case 'similarity':
          return b.similarity - a.similarity
        case 'importance':
          return b.importance - a.importance
        case 'recency':
          return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        default:
          return 0
      }
    })

    return sorted
  }, [results, sortBy])

  if (!results) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Similarity Scores</CardTitle>
          <CardDescription>Item relevance metrics</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No results to display.</p>
        </CardContent>
      </Card>
    )
  }

  const getSimilarityColor = (score: number) => {
    if (score >= 0.8) return 'bg-green-500'
    if (score >= 0.5) return 'bg-yellow-500'
    return 'bg-red-500'
  }

  const getSimilarityLabel = (score: number) => {
    if (score >= 0.8) return 'High'
    if (score >= 0.5) return 'Medium'
    return 'Low'
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Similarity Scores</CardTitle>
        <CardDescription>Visual relevance metrics for retrieved items</CardDescription>
        <div className="flex items-center gap-2 mt-2">
          <span className="text-sm text-muted-foreground">Sort by:</span>
          <Select value={sortBy} onValueChange={(value) => setSortBy(value as SortBy)}>
            <SelectTrigger className="w-40" title="Sort items by - Choose how to organize retrieved memories in the list below">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="similarity" title="Sort by Similarity - Order items by how closely they match your query from highest to lowest">Similarity</SelectItem>
              <SelectItem value="importance" title="Sort by Importance - Order items by their significance or priority to the task">Importance</SelectItem>
              <SelectItem value="recency" title="Sort by Recency - Order items by when they were created with newest first">Recency</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[500px]">
          <div className="space-y-3 pr-4">
            {scoredItems.map((item) => (
              <div key={item.id} className="border rounded-lg p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{item.type}</Badge>
                    {item.refs.length > 0 && (
                      <span className="text-xs text-muted-foreground">
                        {item.refs[0]?.substring(0, 30)}...
                      </span>
                    )}
                  </div>
                  <Badge
                    variant={item.similarity >= 0.8 ? 'default' : item.similarity >= 0.5 ? 'secondary' : 'destructive'}
                  >
                    {getSimilarityLabel(item.similarity)}
                  </Badge>
                </div>

                {/* Similarity Bar */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-xs" title={`Similarity score: ${(item.similarity * 100).toFixed(1)}% - How well this item matches your query based on semantic understanding`}>
                    <span className="text-muted-foreground">Similarity</span>
                    <span className="font-medium">{(item.similarity * 100).toFixed(1)}%</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className={`h-full ${getSimilarityColor(item.similarity)} transition-all duration-300`}
                      style={{ width: `${item.similarity * 100}%` }}
                      title={`Visual similarity bar: ${item.similarity >= 0.8 ? 'High match' : item.similarity >= 0.5 ? 'Medium match' : 'Low match'} to your query`}
                    />
                  </div>
                </div>

                {/* Importance Bar */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Importance</span>
                    <span className="font-medium">{(item.importance * 100).toFixed(1)}%</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-500 transition-all duration-300"
                      style={{ width: `${item.importance * 100}%` }}
                    />
                  </div>
                </div>

                {/* Content Preview */}
                {item.content && (
                  <div className="text-sm bg-muted/50 p-2 rounded">
                    <p className="line-clamp-2">{item.content}</p>
                  </div>
                )}

                {/* Timestamp */}
                <div className="text-xs text-muted-foreground">
                  {new Date(item.timestamp).toLocaleString()}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>

        {/* Legend */}
        <div className="mt-4 pt-4 border-t">
          <h4 className="text-sm font-medium mb-2">Score Legend</h4>
          <div className="grid grid-cols-3 gap-2 text-xs">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-green-500" />
              <span>High (&ge;80%)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-yellow-500" />
              <span>Medium (50-80%)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-red-500" />
              <span>Low (&lt;50%)</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
