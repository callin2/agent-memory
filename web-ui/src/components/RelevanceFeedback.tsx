import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import { ThumbsUp, ThumbsDown, Plus, Save } from 'lucide-react'
import type { ACBResponse, ItemFeedback, RetrievalFeedback } from '@/types'

interface RelevanceFeedbackProps {
  results: ACBResponse | null
}

export function RelevanceFeedback({ results }: RelevanceFeedbackProps) {
  const [feedback, setFeedback] = useState<Record<string, ItemFeedback>>({})
  const [missingChunks, setMissingChunks] = useState('')
  const [missingNotes, setMissingNotes] = useState('')

  const toggleRelevance = (chunkId: string, relevant: boolean) => {
    setFeedback((prev) => ({
      ...prev,
      [chunkId]: {
        ...prev[chunkId],
        chunk_id: chunkId,
        relevant,
        shouldHaveRetrieved: prev[chunkId]?.shouldHaveRetrieved ?? false,
        notes: prev[chunkId]?.notes || '',
      },
    }))
  }

  const toggleShouldHaveRetrieved = (chunkId: string) => {
    setFeedback((prev) => ({
      ...prev,
      [chunkId]: {
        ...prev[chunkId],
        chunk_id: chunkId,
        relevant: prev[chunkId]?.relevant ?? null,
        shouldHaveRetrieved: !prev[chunkId]?.shouldHaveRetrieved,
        notes: prev[chunkId]?.notes || '',
      },
    }))
  }

  const updateNotes = (chunkId: string, notes: string) => {
    setFeedback((prev) => ({
      ...prev,
      [chunkId]: {
        ...prev[chunkId],
        chunk_id: chunkId,
        relevant: prev[chunkId]?.relevant ?? null,
        shouldHaveRetrieved: prev[chunkId]?.shouldHaveRetrieved ?? false,
        notes,
      },
    }))
  }

  const saveFeedback = () => {
    if (!results) {
      alert('No results to provide feedback for')
      return
    }

    const feedbackData: RetrievalFeedback = {
      query_id: results.acb_id,
      timestamp: new Date().toISOString(),
      feedback: Object.values(feedback),
    }

    // Save to localStorage for now (could be sent to backend later)
    const existing = JSON.parse(localStorage.getItem('retrieval_feedback') || '[]')
    existing.push(feedbackData)
    localStorage.setItem('retrieval_feedback', JSON.stringify(existing))

    alert('Feedback saved successfully!')
  }

  const addMissingChunks = () => {
    if (!missingChunks.trim() || !results) return

    const chunks = missingChunks.split('\n').map((c) => c.trim()).filter((c) => c)

    chunks.forEach((chunkId) => {
      setFeedback((prev) => ({
        ...prev,
        [chunkId]: {
          chunk_id: chunkId,
          relevant: null,
          shouldHaveRetrieved: true,
          notes: missingNotes,
        },
      }))
    })

    setMissingChunks('')
    setMissingNotes('')
  }

  if (!results) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Relevance Feedback</CardTitle>
          <CardDescription>Provide feedback on retrieval quality</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No results to provide feedback for.</p>
        </CardContent>
      </Card>
    )
  }

  const allItems = results.sections.flatMap((section) =>
    section.items.map((item, itemIndex) => ({
      id: `${section.name}-${itemIndex}`,
      sectionName: section.name,
      item,
    }))
  )

  return (
    <Card>
      <CardHeader>
        <CardTitle>Relevance Feedback</CardTitle>
        <CardDescription>Rate retrieved items and suggest improvements</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Retrieved Items Feedback */}
        <div className="space-y-2">
          <h3 className="font-semibold">Retrieved Items</h3>
          <ScrollArea className="h-96">
            <div className="space-y-3 pr-4">
              {allItems.map(({ id, sectionName, item }) => {
                const itemFeedback = feedback[id]
                const chunkId = item.refs[0] || id

                return (
                  <div key={id} className="border rounded-lg p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{sectionName}</Badge>
                        <span className="text-xs text-muted-foreground font-mono">
                          {chunkId.substring(0, 20)}...
                        </span>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant={itemFeedback?.relevant === true ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => toggleRelevance(id, true)}
                          className={itemFeedback?.relevant === true ? 'bg-green-500' : ''}
                          title={itemFeedback?.relevant === true ? "Marked as relevant - Click to remove this rating" : "Mark as relevant - This item correctly matches your query and is useful"}
                        >
                          <ThumbsUp className="h-4 w-4" />
                        </Button>
                        <Button
                          variant={itemFeedback?.relevant === false ? 'destructive' : 'outline'}
                          size="sm"
                          onClick={() => toggleRelevance(id, false)}
                          title={itemFeedback?.relevant === false ? "Marked as irrelevant - Click to remove this rating" : "Mark as irrelevant - This item doesn't match your query and is not useful"}
                        >
                          <ThumbsDown className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    {/* Should Have Retrieved Toggle */}
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id={`should-have-${id}`}
                        checked={itemFeedback?.shouldHaveRetrieved || false}
                        onChange={() => toggleShouldHaveRetrieved(id)}
                        className="rounded"
                        title="Check to confirm this chunk was correctly retrieved and should be included in future queries"
                      />
                      <Label htmlFor={`should-have-${id}`} className="text-sm cursor-pointer" title="This chunk was correctly retrieved - Mark this as a positive example for the retrieval system to learn from">
                        This chunk was correctly retrieved
                      </Label>
                    </div>

                    {/* Content Preview */}
                    {item.text && (
                      <div className="text-sm bg-muted/50 p-2 rounded max-h-20 overflow-y-auto">
                        <p className="line-clamp-3">{item.text}</p>
                      </div>
                    )}

                    {/* Feedback Notes */}
                    <div className="space-y-1">
                      <Label htmlFor={`notes-${id}`} className="text-xs">
                        Notes (optional)
                      </Label>
                      <Textarea
                        id={`notes-${id}`}
                        placeholder="Why was this relevant or irrelevant?"
                        value={itemFeedback?.notes || ''}
                        onChange={(e) => updateNotes(id, e.target.value)}
                        rows={2}
                        className="text-sm"
                        title="Add notes explaining your feedback - Helps improve the retrieval system by providing context for your ratings"
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </ScrollArea>
        </div>

        {/* Missing Chunks Section */}
        <div className="space-y-2 pt-4 border-t">
          <h3 className="font-semibold flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Chunks That Should Have Been Retrieved
          </h3>
          <p className="text-sm text-muted-foreground">
            Enter chunk IDs that were missed by the retrieval system
          </p>
          <Textarea
            placeholder="chunk-123&#10;chunk-456&#10;chunk-789"
            value={missingChunks}
            onChange={(e) => setMissingChunks(e.target.value)}
            rows={3}
            className="font-mono text-sm"
            title="Enter missing chunk IDs - List memory chunks that should have been retrieved but weren't, one per line"
          />
          <div className="space-y-1">
            <Label htmlFor="missing-notes" className="text-xs">
              Reason for missing (optional)
            </Label>
            <Textarea
              id="missing-notes"
              placeholder="Explain why these chunks should have been included..."
              value={missingNotes}
              onChange={(e) => setMissingNotes(e.target.value)}
              rows={2}
              className="text-sm"
            />
          </div>
          <Button onClick={addMissingChunks} variant="outline" size="sm" title="Add missing chunks - Add the listed chunk IDs to feedback as items that should have been retrieved">
            <Plus className="h-4 w-4 mr-2" />
            Add Missing Chunks
          </Button>
        </div>

        {/* Save Button */}
        <div className="pt-4 border-t">
          <Button onClick={saveFeedback} className="w-full" title="Save all feedback - Store your relevance ratings and notes locally to help improve future retrieval accuracy">
            <Save className="h-4 w-4 mr-2" />
            Save All Feedback
          </Button>
          <p className="text-xs text-muted-foreground mt-2 text-center">
            Feedback is saved locally and can be exported later
          </p>
        </div>

        {/* Feedback Summary */}
        {Object.keys(feedback).length > 0 && (
          <div className="pt-4 border-t">
            <h4 className="font-semibold mb-2">Feedback Summary</h4>
            <div className="grid grid-cols-3 gap-2 text-sm">
              <div className="bg-green-50 dark:bg-green-950 p-2 rounded text-center">
                <p className="font-medium text-green-700 dark:text-green-400">
                  {Object.values(feedback).filter((f) => f.relevant === true).length}
                </p>
                <p className="text-xs text-muted-foreground">Relevant</p>
              </div>
              <div className="bg-red-50 dark:bg-red-950 p-2 rounded text-center">
                <p className="font-medium text-red-700 dark:text-red-400">
                  {Object.values(feedback).filter((f) => f.relevant === false).length}
                </p>
                <p className="text-xs text-muted-foreground">Irrelevant</p>
              </div>
              <div className="bg-blue-50 dark:bg-blue-950 p-2 rounded text-center">
                <p className="font-medium text-blue-700 dark:text-blue-400">
                  {Object.values(feedback).filter((f) => f.shouldHaveRetrieved).length}
                </p>
                <p className="text-xs text-muted-foreground">Correctly Retrieved</p>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
