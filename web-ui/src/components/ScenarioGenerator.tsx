import { useState } from 'react'
import { Wand2, Loader2, Play, Trash2, Edit2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import type { GeneratedMessage, ScenarioGenerationParams } from '@/types/chat'
import { cn } from '@/lib/utils'

interface ScenarioGeneratorProps {
  onGenerate?: (params: ScenarioGenerationParams) => Promise<GeneratedMessage[]>
  onSendAll?: (messages: GeneratedMessage[]) => Promise<void>
  disabled?: boolean
}

// Predefined scenarios for testing (can be replaced with LLM generation later)
const PREDEFINED_SCENARIOS: Record<
  string,
  (subjects: string[]) => GeneratedMessage[]
> = {
  short: (subjects) => [
    {
      actor: 'human',
      name: 'User',
      content: `I need help with ${subjects[0] || 'a topic'}. Can you assist me?`,
      channel: 'public',
      tags: subjects,
      sensitivity: 'none',
    },
    {
      actor: 'agent',
      name: 'Assistant',
      content: `Of course! I'd be happy to help you with ${subjects[0] || 'that topic'}. What specific aspect would you like to discuss?`,
      channel: 'public',
      tags: subjects,
      sensitivity: 'none',
    },
  ],

  medium: (subjects) => [
    {
      actor: 'human',
      name: 'User',
      content: `I'm working on ${subjects[0] || 'a project'} and need guidance on ${subjects[1] || 'implementation'}.`,
      channel: 'public',
      tags: subjects,
      sensitivity: 'low',
    },
    {
      actor: 'agent',
      name: 'Assistant',
      content: `I can help with ${subjects[0] || 'your project'}! Let me break down the approach for ${subjects[1] || 'this implementation'}...`,
      channel: 'public',
      tags: subjects,
      sensitivity: 'none',
    },
    {
      actor: 'human',
      name: 'User',
      content: `That's helpful! What about performance considerations for ${subjects[0] || 'this approach'}?`,
      channel: 'team',
      tags: subjects,
      sensitivity: 'low',
    },
    {
      actor: 'agent',
      name: 'Assistant',
      content: `Great question! For optimal performance with ${subjects[0] || 'this approach'}, consider these factors...`,
      channel: 'team',
      tags: subjects,
      sensitivity: 'none',
    },
  ],

  long: (subjects) => [
    {
      actor: 'human',
      name: 'User',
      content: `I'm planning a complex system involving ${subjects[0] || 'multiple components'}. Can you help me design the architecture?`,
      channel: 'team',
      tags: subjects,
      sensitivity: 'low',
    },
    {
      actor: 'agent',
      name: 'Assistant',
      content: `Absolutely! Designing a ${subjects[0] || 'system'} architecture requires careful consideration. Let's start by identifying the key requirements...`,
      channel: 'team',
      tags: subjects,
      sensitivity: 'none',
    },
    {
      actor: 'human',
      name: 'User',
      content: `The main requirements include: scalability, maintainability, and performance. Also, ${subjects[1] || 'specific feature'} is critical.`,
      channel: 'team',
      tags: subjects,
      sensitivity: 'low',
    },
    {
      actor: 'agent',
      name: 'Assistant',
      content: `Based on those requirements, I'd recommend a modular approach. For ${subjects[1] || 'this feature'}, we could implement...`,
      channel: 'public',
      tags: subjects,
      sensitivity: 'none',
    },
    {
      actor: 'human',
      name: 'User',
      content: `That sounds good! What about testing strategy for ${subjects[0] || 'this system'}?`,
      channel: 'team',
      tags: subjects,
      sensitivity: 'low',
    },
    {
      actor: 'agent',
      name: 'Assistant',
      content: `Excellent point! A comprehensive testing strategy should include unit tests, integration tests, and E2E tests. Here's my recommendation...`,
      channel: 'team',
      tags: subjects,
      sensitivity: 'none',
    },
  ],
}

export function ScenarioGenerator({
  onGenerate,
  onSendAll,
  disabled = false,
}: ScenarioGeneratorProps) {
  const [subjects] = useState<string[]>([])
  const [complexity, setComplexity] = useState<number>(5)
  const [length, setLength] = useState<'short' | 'medium' | 'long'>('medium')
  const [generatedMessages, setGeneratedMessages] = useState<GeneratedMessage[]>([])
  const [isGenerating, setIsGenerating] = useState(false)
  const [isSending, setIsSending] = useState(false)
  const [editingIndex, setEditingIndex] = useState<number | null>(null)

  const handleGenerate = async () => {
    if (subjects.length === 0) {
      return
    }

    setIsGenerating(true)
    try {
      if (onGenerate) {
        // Use LLM-based generation if provided
        const messages = await onGenerate({ subjects, complexity, length })
        setGeneratedMessages(messages)
      } else {
        // Use predefined scenarios
        await new Promise((resolve) => setTimeout(resolve, 800)) // Simulate loading
        const scenario = PREDEFINED_SCENARIOS[length]
        const messages = scenario(subjects)
        setGeneratedMessages(messages)
      }
    } finally {
      setIsGenerating(false)
    }
  }

  const handleSendAll = async () => {
    if (generatedMessages.length === 0) {
      return
    }

    setIsSending(true)
    try {
      await onSendAll?.(generatedMessages)
      setGeneratedMessages([])
    } finally {
      setIsSending(false)
    }
  }

  const handleClear = () => {
    setGeneratedMessages([])
    setEditingIndex(null)
  }

  const handleEditMessage = (index: number, content: string) => {
    const updated = [...generatedMessages]
    updated[index].content = content
    setGeneratedMessages(updated)
  }

  const handleRemoveMessage = (index: number) => {
    const updated = generatedMessages.filter((_, i) => i !== index)
    setGeneratedMessages(updated)
  }

  return (
    <div className="space-y-4" data-testid="scenario-generator">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wand2 className="h-5 w-5" />
            Test Scenario Generator
          </CardTitle>
          <CardDescription>
            Generate realistic conversation scenarios for testing memory operations
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Subject Tags */}
          <div className="space-y-2">
            <Label>Subject Tags</Label>
            <div className="flex flex-wrap gap-2">
              {subjects.length > 0 ? (
                subjects.map((subject) => (
                  <Badge key={subject} variant="secondary">
                    {subject}
                  </Badge>
                ))
              ) : (
                <span className="text-sm text-muted-foreground">
                  Add tags via the message input first
                </span>
              )}
            </div>
          </div>

          {/* Complexity Slider */}
          <div className="space-y-2">
            <Label>Complexity: {complexity}/10</Label>
            <Slider
              value={[complexity]}
              onValueChange={(value) => setComplexity(value[0])}
              min={1}
              max={10}
              step={1}
              disabled={disabled}
              className="w-full"
              data-testid="complexity-slider"
              title={`Complexity slider: ${complexity}/10 - Adjust scenario complexity where 1 is simple and 10 is highly complex with intricate details`}
            />
          </div>

          {/* Length Selector */}
          <div className="space-y-2">
            <Label htmlFor="length-select">Scenario Length</Label>
            <Select
              value={length}
              onValueChange={(value) =>
                setLength(value as 'short' | 'medium' | 'long')
              }
              disabled={disabled}
            >
              <SelectTrigger id="length-select" title="Scenario Length selector - Choose how many messages to generate in the test scenario (short=2, medium=4, long=6 messages)">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="short" title="Short scenario - Generate 2 messages for quick testing with minimal conversation">Short (2 messages)</SelectItem>
                <SelectItem value="medium" title="Medium scenario - Generate 4 messages for moderate testing with balanced conversation length">Medium (4 messages)</SelectItem>
                <SelectItem value="long" title="Long scenario - Generate 6 messages for thorough testing with extended conversation and multiple exchanges">Long (6 messages)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Generate Button */}
          <Button
            onClick={handleGenerate}
            disabled={disabled || subjects.length === 0 || isGenerating}
            className="w-full"
            data-testid="generate-button"
            title={subjects.length === 0 ? "Generate Scenario - Add subject tags first to create realistic test conversations" : isGenerating ? "Generating scenario - Creating test messages based on your settings..." : "Generate Scenario - Create a realistic test conversation with messages using your configured settings"}
          >
            {isGenerating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Wand2 className="mr-2 h-4 w-4" />
                Generate Scenario
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Generated Messages Preview */}
      {generatedMessages.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Generated Messages</CardTitle>
                <CardDescription>
                  {generatedMessages.length} messages ready to send
                </CardDescription>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleClear}
                disabled={isSending}
                title="Clear all - Remove all generated messages without sending to start over"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {generatedMessages.map((message, index) => (
              <div
                key={index}
                className={cn(
                  'rounded-lg border p-3',
                  editingIndex === index && 'ring-2 ring-primary'
                )}
                data-testid={`generated-message-${index}`}
              >
                <div className="mb-2 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge
                      variant={message.actor === 'human' ? 'default' : 'secondary'}
                    >
                      {message.actor}
                    </Badge>
                    <Badge variant="outline">{message.channel}</Badge>
                    <Badge variant="outline">{message.sensitivity}</Badge>
                  </div>
                  <div className="flex gap-1">
                    {editingIndex !== index && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => setEditingIndex(index)}
                        disabled={isSending}
                        title="Edit message - Click to modify this message content before sending"
                      >
                        <Edit2 className="h-3 w-3" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => handleRemoveMessage(index)}
                      disabled={isSending}
                      title="Remove message - Delete this message from the generated scenario"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>

                {editingIndex === index ? (
                  <Textarea
                    value={message.content}
                    onChange={(e) => handleEditMessage(index, e.target.value)}
                    className="mb-2 min-h-[80px]"
                    autoFocus
                    onBlur={() => setEditingIndex(null)}
                    title="Edit message content - Type your changes and click outside to save"
                  />
                ) : (
                  <p className="text-sm whitespace-pre-wrap" title={`Message content: ${message.content.slice(0, 100)}${message.content.length > 100 ? '...' : ''}`}>
                    {message.content}
                  </p>
                )}

                {message.tags.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {message.tags.map((tag) => (
                      <Badge key={tag} variant="secondary" className="text-xs">
                        #{tag}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            ))}

            {/* Send All Button */}
            <Button
              onClick={handleSendAll}
              disabled={isSending || generatedMessages.length === 0}
              className="w-full"
              size="lg"
              data-testid="send-all-button"
              title={isSending ? "Sending all messages - Uploading generated messages to memory system..." : `Send All Messages - Upload all ${generatedMessages.length} generated messages to the memory system to test batch operations`}
            >
              {isSending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Play className="mr-2 h-4 w-4" />
                  Send All Messages
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
