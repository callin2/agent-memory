import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Slider } from '@/components/ui/slider'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import type { ACBRequest, Channel, QueryPreset } from '@/types'

interface QueryBuilderProps {
  onRetrieve: (params: ACBRequest) => void
  isLoading?: boolean
  tenantId: string
  savedQueries?: QueryPreset[]
}

export function QueryBuilder({ onRetrieve, isLoading, tenantId, savedQueries = [] }: QueryBuilderProps) {
  const [sessionId, setSessionId] = useState('')
  const [agentId, setAgentId] = useState('agent-default')
  const [channel, setChannel] = useState<Channel>('private')
  const [intent, setIntent] = useState('')
  const [queryText, setQueryText] = useState('')
  const [maxTokens, setMaxTokens] = useState([65000])
  const [includeCapsules, setIncludeCapsules] = useState(true)
  const [includeQuarantined, setIncludeQuarantined] = useState(false)

  const handleRetrieve = () => {
    if (!sessionId || !intent) {
      alert('Please fill in required fields: Session ID and Intent')
      return
    }

    const params: ACBRequest = {
      tenant_id: tenantId,
      session_id: sessionId,
      agent_id: agentId,
      channel,
      intent,
      query_text: queryText,
      max_tokens: maxTokens[0],
      include_capsules: includeCapsules,
      include_quarantined: includeQuarantined,
    }

    onRetrieve(params)
  }

  const handleSavePreset = () => {
    const preset: QueryPreset = {
      id: `preset-${Date.now()}`,
      name: intent.substring(0, 50) || 'Untitled Query',
      tenant_id: tenantId,
      session_id: sessionId,
      agent_id: agentId,
      channel,
      intent,
      query_text: queryText,
      max_tokens: maxTokens[0],
      created_at: new Date().toISOString(),
    }

    const saved = JSON.parse(localStorage.getItem('query_presets') || '[]')
    saved.push(preset)
    localStorage.setItem('query_presets', JSON.stringify(saved))
    alert('Query preset saved!')
  }

  const loadPreset = (preset: QueryPreset) => {
    setSessionId(preset.session_id)
    setAgentId(preset.agent_id)
    setChannel(preset.channel)
    setIntent(preset.intent)
    setQueryText(preset.query_text)
    setMaxTokens([preset.max_tokens])
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Query Builder</CardTitle>
        <CardDescription>Configure parameters for ACB retrieval</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Session Selector with Saved Queries */}
        <div className="space-y-2">
          <Label htmlFor="preset">Load Saved Query</Label>
          <Select onValueChange={(value) => loadPreset(savedQueries[Number(value)] as QueryPreset)}>
            <SelectTrigger id="preset" title="Load a previously saved query to quickly repeat common retrieval tests">
              <SelectValue placeholder="Select a saved query..." />
            </SelectTrigger>
            <SelectContent>
              {savedQueries.map((preset, index) => (
                <SelectItem key={preset.id} value={String(index)} title={`Load "${preset.name}" to reuse this retrieval configuration`}>
                  {preset.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Session ID */}
        <div className="space-y-2">
          <Label htmlFor="session_id">
            Session ID <span className="text-destructive">*</span>
          </Label>
          <Input
            id="session_id"
            placeholder="session-123"
            value={sessionId}
            onChange={(e) => setSessionId(e.target.value)}
            title="Enter the session ID to retrieve memory from that specific conversation context"
          />
        </div>

        {/* Agent ID */}
        <div className="space-y-2">
          <Label htmlFor="agent_id">Agent ID</Label>
          <Input
            id="agent_id"
            placeholder="agent-default"
            value={agentId}
            onChange={(e) => setAgentId(e.target.value)}
            title="Specify which agent's memory to retrieve - useful for testing multi-agent scenarios"
          />
        </div>

        {/* Channel Selector */}
        <div className="space-y-2">
          <Label htmlFor="channel">Channel</Label>
          <Select value={channel} onValueChange={(value) => setChannel(value as Channel)}>
            <SelectTrigger id="channel" title="Select which memory channel to retrieve from - filters messages by privacy level">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="private" title="Retrieve from private channel - personal messages only">Private</SelectItem>
              <SelectItem value="public" title="Retrieve from public channel - messages visible to everyone">Public</SelectItem>
              <SelectItem value="team" title="Retrieve from team channel - internal team discussions">Team</SelectItem>
              <SelectItem value="agent" title="Retrieve from agent channel - agent communication logs">Agent</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Intent */}
        <div className="space-y-2">
          <Label htmlFor="intent">
            Intent <span className="text-destructive">*</span>
          </Label>
          <Input
            id="intent"
            placeholder="e.g., 'Implement user authentication'"
            value={intent}
            onChange={(e) => setIntent(e.target.value)}
            title="Describe what you want to do - helps memory system find relevant context for your task"
          />
          <p className="text-xs text-muted-foreground">
            Describe what the user wants to do
          </p>
        </div>

        {/* Query Text */}
        <div className="space-y-2">
          <Label htmlFor="query_text">Query Text (Optional)</Label>
          <Input
            id="query_text"
            placeholder="e.g., authentication, user login, security"
            value={queryText}
            onChange={(e) => setQueryText(e.target.value)}
            title="Add keywords to improve semantic search - helps find more specific and relevant memories"
          />
          <p className="text-xs text-muted-foreground">
            Keywords for semantic search
          </p>
        </div>

        {/* Max Tokens Slider */}
        <div className="space-y-2">
          <Label htmlFor="max_tokens">
            Max Tokens: <Badge variant="secondary">{maxTokens[0].toLocaleString()}</Badge>
          </Label>
          <Slider
            id="max_tokens"
            min={1000}
            max={200000}
            step={1000}
            value={maxTokens}
            onValueChange={setMaxTokens}
            className="w-full"
            title="Adjust token limit to control how much context is retrieved - higher tokens provide more context but slower processing"
          />
          <p className="text-xs text-muted-foreground">
            Token budget for context retrieval
          </p>
        </div>

        {/* Options */}
        <div className="flex flex-wrap gap-4">
          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="include_capsules"
              checked={includeCapsules}
              onChange={(e) => setIncludeCapsules(e.target.checked)}
              className="rounded"
              title="Check this to include memory capsules - compressed memory summaries for faster retrieval"
            />
            <Label htmlFor="include_capsules" className="cursor-pointer" title="Include memory capsules to get compressed summaries alongside detailed context">
              Include Capsules
            </Label>
          </div>
          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="include_quarantined"
              checked={includeQuarantined}
              onChange={(e) => setIncludeQuarantined(e.target.checked)}
              className="rounded"
              title="Check this to include quarantined items - useful for testing how the system handles problematic or sensitive content"
            />
            <Label htmlFor="include_quarantined" className="cursor-pointer" title="Include quarantined content to test error handling and security filtering">
              Include Quarantined
            </Label>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2 pt-2">
          <Button onClick={handleRetrieve} disabled={isLoading} className="flex-1" title={isLoading ? "Retrieving relevant memory context..." : "Build Active Context Bundle to retrieve the most relevant memory for your intent"}>
            {isLoading ? 'Retrieving...' : 'Retrieve Context'}
          </Button>
          <Button onClick={handleSavePreset} variant="outline" title="Save this query configuration to reuse later without re-entering parameters">
            Save Preset
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
