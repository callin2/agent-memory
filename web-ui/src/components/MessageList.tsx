import { useState, useRef, useEffect } from 'react'
import { Bot, User, Shield, Eye, ChevronDown, ChevronUp } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import type { MemoryEvent, Sensitivity } from '@/types/chat'
import { cn } from '@/lib/utils'

interface MessageListProps {
  messages: MemoryEvent[]
  className?: string
}

interface MessageBubbleProps {
  message: MemoryEvent
}

const sensitivityConfig: Record<
  Sensitivity,
  { color: string; icon: typeof Eye; label: string }
> = {
  none: { color: 'bg-slate-500', icon: Eye, label: 'None' },
  low: { color: 'bg-blue-500', icon: Eye, label: 'Low' },
  high: { color: 'bg-orange-500', icon: Eye, label: 'High' },
  secret: { color: 'bg-red-500', icon: Shield, label: 'Secret' },
}

function MessageBubble({ message }: MessageBubbleProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const isHuman = message.actor.kind === 'human'
  const isLong = message.content.text.length > 300

  const SensitivityIcon = sensitivityConfig[message.sensitivity].icon
  const timestamp = new Date(message.timestamp)
  const timeStr = timestamp.toLocaleTimeString()
  const dateStr = timestamp.toLocaleDateString()

  return (
    <div
      className={cn(
        'flex gap-3 mb-4',
        isHuman ? 'flex-row-reverse' : 'flex-row'
      )}
      data-testid={`message-${message.id}`}
    >
      {/* Avatar */}
      <div
        className={cn(
          'flex h-10 w-10 shrink-0 items-center justify-center rounded-full',
          isHuman ? 'bg-primary text-primary-foreground' : 'bg-muted'
        )}
      >
        {isHuman ? (
          <User className="h-5 w-5" />
        ) : (
          <Bot className="h-5 w-5" />
        )}
      </div>

      {/* Message Content */}
      <div
        className={cn(
          'flex max-w-[70%] flex-col gap-2',
          isHuman ? 'items-end' : 'items-start'
        )}
      >
        {/* Header */}
        <div
          className={cn(
            'flex items-center gap-2 text-sm',
            isHuman ? 'flex-row-reverse' : 'flex-row'
          )}
        >
          <span className="font-semibold" title={`Actor: ${message.actor.name} - The ${message.actor.kind === 'human' ? 'person' : 'agent'} who sent this message`}>
            {message.actor.name}
          </span>
          <Badge variant="outline" className="text-xs" title={`Channel: ${message.channel} - Indicates the visibility level of this message (${message.channel === 'public' ? 'visible to all' : message.channel === 'team' ? 'internal team only' : 'restricted access'})`}>
            {message.channel}
          </Badge>
          <div className="flex items-center gap-1 text-xs text-muted-foreground" title={`Sensitivity: ${sensitivityConfig[message.sensitivity].label} - ${message.sensitivity === 'secret' ? 'Highest secrecy' : message.sensitivity === 'high' ? 'Restricted access' : message.sensitivity === 'low' ? 'Limited visibility' : 'Normal visibility'} level for this memory`}>
            <SensitivityIcon className="h-3 w-3" />
            {sensitivityConfig[message.sensitivity].label}
          </div>
        </div>

        {/* Message Bubble */}
        <Card
          className={cn(
            'px-4 py-3',
            isHuman
              ? 'bg-primary text-primary-foreground'
              : 'bg-muted text-foreground'
          )}
          title={`Message content: ${isLong && !isExpanded ? message.content.text.slice(0, 100) + '...' : message.content.text}`}
        >
          <p className="text-sm whitespace-pre-wrap break-words">
            {isLong && !isExpanded
              ? `${message.content.text.slice(0, 300)}...`
              : message.content.text}
          </p>

          {isLong && (
            <Button
              variant="link"
              size="sm"
              onClick={() => setIsExpanded(!isExpanded)}
              className={cn(
                'mt-2 h-auto p-0 text-xs',
                isHuman
                  ? 'text-primary-foreground/80 hover:text-primary-foreground'
                  : 'text-muted-foreground'
              )}
              title={isExpanded ? "Show less - Click to collapse long message and hide full content" : "Show more - Click to expand and read the complete message text"}
            >
              {isExpanded ? (
                <>
                  Show less <ChevronUp className="ml-1 h-3 w-3" />
                </>
              ) : (
                <>
                  Show more <ChevronDown className="ml-1 h-3 w-3" />
                </>
              )}
            </Button>
          )}
        </Card>

        {/* Tags */}
        {message.tags.length > 0 && (
          <div
            className={cn(
              'flex flex-wrap gap-1',
              isHuman ? 'justify-end' : 'justify-start'
            )}
          >
            {message.tags.map((tag) => (
              <Badge
                key={tag}
                variant="secondary"
                className="text-xs"
                data-testid={`tag-${tag}`}
                title={`Subject tag: #${tag} - Click to find other messages related to this topic for better memory organization`}
              >
                #{tag}
              </Badge>
            ))}
          </div>
        )}

        {/* Timestamp */}
        <span className="text-xs text-muted-foreground">
          {dateStr} at {timeStr}
        </span>
      </div>
    </div>
  )
}

export function MessageList({ messages, className }: MessageListProps) {
  const scrollAreaRef = useRef<HTMLDivElement>(null)
  const [autoScroll, setAutoScroll] = useState(true)

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (autoScroll && scrollAreaRef.current) {
      const viewport = scrollAreaRef.current.querySelector(
        '[data-radix-scroll-area-viewport]'
      )
      if (viewport) {
        viewport.scrollTop = viewport.scrollHeight
      }
    }
  }, [messages, autoScroll])

  // Detect user scroll
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement
    const isAtBottom =
      target.scrollHeight - target.scrollTop - target.clientHeight < 100
    setAutoScroll(isAtBottom)
  }

  if (messages.length === 0) {
    return (
      <div
        className={cn(
          'flex h-[400px] items-center justify-center text-muted-foreground',
          className
        )}
        data-testid="empty-message-list"
      >
        <div className="text-center">
          <p className="text-lg font-medium">No messages yet</p>
          <p className="text-sm">Send a message to start the conversation</p>
        </div>
      </div>
    )
  }

  return (
    <ScrollArea
      ref={scrollAreaRef}
      className={cn('h-[600px] pr-4', className)}
      onScroll={handleScroll}
      data-testid="message-list"
    >
      <div className="space-y-1 p-4">
        {messages.map((message) => (
          <MessageBubble key={message.id} message={message} />
        ))}
      </div>
    </ScrollArea>
  )
}
