import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { ChevronDown, ChevronRight } from 'lucide-react'
import type { ACBResponse, ACBItem } from '@/types'

interface RetrievalResultsProps {
  results: ACBResponse | null
}

export function RetrievalResults({ results }: RetrievalResultsProps) {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['rules', 'recent_window']))

  if (!results) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Retrieval Results</CardTitle>
          <CardDescription>Submit a query to see results</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            No results to display. Use the Query Builder to retrieve context.
          </p>
        </CardContent>
      </Card>
    )
  }

  const toggleSection = (sectionName: string) => {
    const newExpanded = new Set(expandedSections)
    if (newExpanded.has(sectionName)) {
      newExpanded.delete(sectionName)
    } else {
      newExpanded.add(sectionName)
    }
    setExpandedSections(newExpanded)
  }

  const renderACBItem = (item: ACBItem, index: number) => {
    const isExpanded = expandedSections.has(`${item.type}-${index}`)

    return (
      <div key={`${item.type}-${index}`} className="border rounded-md p-3 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Badge variant={item.type === 'decision' ? 'default' : item.type === 'task' ? 'secondary' : 'outline'}>
              {item.type}
            </Badge>
            {item.decision_id && (
              <span className="text-xs text-muted-foreground">ID: {item.decision_id}</span>
            )}
            {item.task_id && (
              <span className="text-xs text-muted-foreground">ID: {item.task_id}</span>
            )}
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => toggleSection(`${item.type}-${index}`)}
            title={isExpanded ? "Collapse this item to hide detailed content" : "Expand this item to view full content and details"}
          >
            {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </Button>
        </div>

        {item.text && isExpanded && (
          <div className="text-sm bg-muted/50 p-2 rounded">
            <p className="whitespace-pre-wrap">{item.text}</p>
          </div>
        )}

        {item.refs.length > 0 && (
          <div className="text-xs text-muted-foreground">
            <span className="font-medium">References:</span> {item.refs.join(', ')}
          </div>
        )}
      </div>
    )
  }

  const renderSection = (section: { name: string; items: ACBItem[]; token_est: number }) => {
    const isExpanded = expandedSections.has(section.name)
    const tokenPercentage = (section.token_est / results.budget_tokens) * 100

    return (
      <div key={section.name} className="space-y-2">
        <div
          className="flex items-center justify-between cursor-pointer hover:bg-muted/50 p-2 rounded"
          onClick={() => toggleSection(section.name)}
          title={isExpanded ? `Click to collapse ${formatSectionName(section.name)} section` : `Click to expand ${formatSectionName(section.name)} section to see ${section.items.length} items`}
        >
          <div className="flex items-center gap-2">
            {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            <h3 className="font-semibold">{formatSectionName(section.name)}</h3>
            <Badge variant="secondary" title={`Contains ${section.items.length} memory ${section.items.length === 1 ? 'item' : 'items'} in this section`}>{section.items.length} items</Badge>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground" title={`Estimated ${section.token_est.toLocaleString()} tokens used by this section`}>
              {section.token_est.toLocaleString()} tokens
            </span>
            <Badge variant={tokenPercentage > 80 ? 'destructive' : tokenPercentage > 50 ? 'default' : 'secondary'} title={`Token utilization: ${tokenPercentage.toFixed(1)}% of budget - ${tokenPercentage > 80 ? 'High usage, consider reducing' : tokenPercentage > 50 ? 'Moderate usage' : 'Efficient usage'}`}>
              {tokenPercentage.toFixed(1)}%
            </Badge>
          </div>
        </div>

        {isExpanded && (
          <div className="pl-6 space-y-2">
            {section.items.length > 0 ? (
              section.items.map((item, index) => renderACBItem(item, index))
            ) : (
              <p className="text-sm text-muted-foreground italic">No items in this section</p>
            )}
          </div>
        )}
      </div>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Active Context Bundle</CardTitle>
        <CardDescription>ACB ID: {results.acb_id}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Token Usage Breakdown */}
        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-1">
            <p className="text-sm font-medium">Budget Tokens</p>
            <p className="text-2xl font-bold">{results.budget_tokens.toLocaleString()}</p>
          </div>
          <div className="space-y-1">
            <p className="text-sm font-medium">Used Tokens</p>
            <p className="text-2xl font-bold text-primary">{results.token_used_est.toLocaleString()}</p>
          </div>
          <div className="space-y-1">
            <p className="text-sm font-medium">Utilization</p>
            <p className="text-2xl font-bold">
              {((results.token_used_est / results.budget_tokens) * 100).toFixed(1)}%
            </p>
          </div>
        </div>

        <Separator />

        {/* Provenance Info */}
        <div className="space-y-2">
          <h3 className="font-semibold">Provenance</h3>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div>
              <span className="text-muted-foreground">Intent:</span> {results.provenance.intent}
            </div>
            <div>
              <span className="text-muted-foreground">Query Terms:</span>{' '}
              {results.provenance.query_terms.join(', ')}
            </div>
            <div>
              <span className="text-muted-foreground">Candidate Pool:</span>{' '}
              {results.provenance.candidate_pool_size} chunks
            </div>
            <div>
              <span className="text-muted-foreground">Edits Applied:</span>{' '}
              {results.edits_applied}
            </div>
          </div>
        </div>

        {/* Capsules */}
        {results.capsules.length > 0 && (
          <>
            <Separator />
            <div className="space-y-2">
              <h3 className="font-semibold">Memory Capsules ({results.capsules.length})</h3>
              <ScrollArea className="h-32">
                <div className="space-y-1">
                  {results.capsules.map((capsule) => (
                    <div key={capsule.capsule_id} className="text-sm border rounded p-2">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{capsule.scope}</Badge>
                        <span className="font-medium">{capsule.capsule_id}</span>
                        <span className="text-muted-foreground">({capsule.item_count} items)</span>
                      </div>
                      {capsule.risks.length > 0 && (
                        <div className="mt-1 text-xs text-destructive">
                          Risks: {capsule.risks.join(', ')}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          </>
        )}

        <Separator />

        {/* ACB Sections */}
        <div className="space-y-3">
          <h3 className="font-semibold">Context Sections</h3>
          <ScrollArea className="h-96">
            <div className="space-y-3 pr-4">
              {results.sections.map((section) => renderSection(section))}
            </div>
          </ScrollArea>
        </div>

        {/* Omissions */}
        {results.omissions.length > 0 && (
          <>
            <Separator />
            <div className="space-y-2">
              <h3 className="font-semibold text-destructive">Omissions ({results.omissions.length})</h3>
              <ScrollArea className="h-32">
                <div className="space-y-2">
                  {results.omissions.map((omission, index) => (
                    <div key={index} className="text-sm border-l-2 border-destructive pl-2">
                      <p className="font-medium">{omission.reason}</p>
                      <p className="text-xs text-muted-foreground">
                        Candidates: {omission.candidates.length}
                      </p>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}

function formatSectionName(name: string): string {
  return name
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}
