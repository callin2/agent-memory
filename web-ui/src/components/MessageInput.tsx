import { useState, useRef, useEffect } from 'react'
import { Send, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { SubjectTagger } from './SubjectTagger'
import type { Channel, Sensitivity } from '@/types/chat'

interface MessageInputProps {
  onSend: (message: {
    content: string
    channel: Channel
    sensitivity: Sensitivity
    tags: string[]
  }) => Promise<void>
  disabled?: boolean
  placeholder?: string
  minLength?: number
  maxLength?: number
  defaultChannel?: Channel
  defaultSensitivity?: Sensitivity
}

export function MessageInput({
  onSend,
  disabled = false,
  placeholder = 'Type your message...',
  minLength = 1,
  maxLength = 5000,
  defaultChannel = 'public',
  defaultSensitivity = 'none',
}: MessageInputProps) {
  const [content, setContent] = useState('')
  const [channel, setChannel] = useState<Channel>(defaultChannel)
  const [sensitivity, setSensitivity] = useState<Sensitivity>(defaultSensitivity)
  const [tags, setTags] = useState<string[]>([])
  const [isSending, setIsSending] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`
    }
  }, [content])

  const handleSend = async () => {
    if (content.trim().length < minLength || content.length > maxLength) {
      return
    }

    setIsSending(true)
    try {
      await onSend({
        content: content.trim(),
        channel,
        sensitivity,
        tags,
      })
      setContent('')
      setTags([])
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto'
      }
    } finally {
      setIsSending(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const characterCount = content.length
  const isValid =
    characterCount >= minLength &&
    characterCount <= maxLength &&
    !isSending &&
    !disabled

  return (
    <div className="space-y-4" data-testid="message-input">
      {/* Content Input */}
      <div className="space-y-2">
        <Label htmlFor="message-content">Message</Label>
        <Textarea
          id="message-content"
          ref={textareaRef}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled || isSending}
          className="min-h-[120px] resize-none"
          data-testid="message-textarea"
          title="Type your message here to test memory operations. Press Enter to send or Shift+Enter for a new line."
        />
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>
            Press Enter to send, Shift+Enter for new line
          </span>
          <span
            className={
              characterCount > maxLength
                ? 'text-destructive'
                : characterCount >= maxLength * 0.9
                  ? 'text-yellow-600 dark:text-yellow-400'
                  : ''
            }
            title={`Message length: ${characterCount} characters (max: ${maxLength})`}
          >
            {characterCount}/{maxLength}
          </span>
        </div>
      </div>

      {/* Settings Row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {/* Channel Selector */}
        <div className="space-y-2">
          <Label htmlFor="channel-select">Channel</Label>
          <Select
            value={channel}
            onValueChange={(value) => setChannel(value as Channel)}
            disabled={disabled || isSending}
          >
            <SelectTrigger id="channel-select" title="Choose who can see this message to control memory access and privacy">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="private" title="Only you can see this message - use for personal notes">Private</SelectItem>
              <SelectItem value="public" title="Everyone can see this message - use for team collaboration">Public</SelectItem>
              <SelectItem value="team" title="Only your team members can see this message - use for internal discussions">Team</SelectItem>
              <SelectItem value="agent" title="For agent communication only - use when testing agent memory">Agent</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Sensitivity Selector */}
        <div className="space-y-2">
          <Label htmlFor="sensitivity-select">Sensitivity</Label>
          <Select
            value={sensitivity}
            onValueChange={(value) => setSensitivity(value as Sensitivity)}
            disabled={disabled || isSending}
          >
            <SelectTrigger id="sensitivity-select" title="Set sensitivity level to control how this message is stored and protected in memory">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none" title="Normal message, no special handling - use for general conversations">None</SelectItem>
              <SelectItem value="low" title="Somewhat sensitive, be careful sharing - use for internal discussions">Low</SelectItem>
              <SelectItem value="high" title="Very sensitive, limit access - use for confidential information">High</SelectItem>
              <SelectItem value="secret" title="Top secret, auto-redacted from logs - use for passwords or secrets">Secret</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Subject Tags */}
      <div className="space-y-2">
        <Label title="Add tags to organize your messages and find them easily later when searching">Subject Tags</Label>
        <SubjectTagger
          tags={tags}
          onTagsChange={setTags}
          placeholder="Add subject tags (e.g., technical, design, feature-request)"
        />
      </div>

      {/* Send Button */}
      <Button
        onClick={handleSend}
        disabled={!isValid}
        className="w-full"
        size="lg"
        data-testid="send-button"
        title={
          isSending
            ? "Sending your message to memory system..."
            : !isValid
              ? content.trim().length < minLength
                ? "Message is too short - please type at least 1 character to test memory"
                : "Message is too long - please shorten to under 5000 characters"
              : "Click to send your message and test memory storage"
        }
      >
        {isSending ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Sending...
          </>
        ) : (
          <>
            <Send className="mr-2 h-4 w-4" />
            Send Message
          </>
        )}
      </Button>
    </div>
  )
}
