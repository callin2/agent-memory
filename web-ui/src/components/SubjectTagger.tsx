import { useState } from 'react'
import { X, Plus, Hash } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'

interface SubjectTaggerProps {
  tags: string[]
  onTagsChange: (tags: string[]) => void
  suggestions?: string[]
  placeholder?: string
  maxTags?: number
}

export function SubjectTagger({
  tags,
  onTagsChange,
  suggestions = [
    'technical',
    'design',
    'feature-request',
    'bug',
    'question',
    'discussion',
    'planning',
  ],
  placeholder = 'Add subject tags...',
  maxTags = 10,
}: SubjectTaggerProps) {
  const [input, setInput] = useState('')
  const [showSuggestions, setShowSuggestions] = useState(false)

  const addTag = (tag: string) => {
    const trimmed = tag.trim().toLowerCase()
    if (trimmed && !tags.includes(trimmed) && tags.length < maxTags) {
      onTagsChange([...tags, trimmed])
    }
    setInput('')
    setShowSuggestions(false)
  }

  const removeTag = (tagToRemove: string) => {
    onTagsChange(tags.filter((tag) => tag !== tagToRemove))
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && input) {
      e.preventDefault()
      addTag(input)
    } else if (e.key === 'Backspace' && !input && tags.length > 0) {
      removeTag(tags[tags.length - 1])
    }
  }

  const filteredSuggestions = suggestions.filter(
    (suggestion) =>
      suggestion.toLowerCase().includes(input.toLowerCase()) &&
      !tags.includes(suggestion.toLowerCase())
  )

  return (
    <div className="space-y-2" data-testid="subject-tagger">
      <div className="flex flex-wrap gap-2">
        {tags.map((tag) => (
          <Badge key={tag} variant="secondary" className="gap-1" title={`Tag "${tag}" - helps organize messages for better search and retrieval. Click X to remove.`}>
            <Hash className="h-3 w-3" />
            {tag}
            <button
              type="button"
              onClick={() => removeTag(tag)}
              className="ml-1 hover:text-destructive"
              aria-label={`Remove ${tag} tag`}
              title={`Remove "${tag}" tag to stop categorizing messages under this topic`}
            >
              <X className="h-3 w-3" />
            </button>
          </Badge>
        ))}
      </div>

      <div className="relative">
        <div className="flex gap-2">
          <Input
            value={input}
            onChange={(e) => {
              setInput(e.target.value)
              setShowSuggestions(true)
            }}
            onKeyDown={handleKeyDown}
            onFocus={() => setShowSuggestions(true)}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
            placeholder={placeholder}
            className="flex-1"
            data-testid="tag-input"
            title="Add subject tags to group related messages, making them easier to find and analyze later"
          />
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => addTag(input)}
            disabled={!input || tags.length >= maxTags}
            aria-label="Add tag"
            title={
              !input
                ? "Type a tag name first to categorize your message"
                : tags.length >= maxTags
                  ? `Maximum ${maxTags} tags reached - remove some tags first to stay organized`
                  : `Add "${input}" tag to organize this message under that topic`
            }
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>

        {showSuggestions && filteredSuggestions.length > 0 && (
          <div className="absolute z-10 mt-1 w-full rounded-md border bg-popover p-1 shadow-md">
            {filteredSuggestions.map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                onClick={() => addTag(suggestion)}
                className="w-full rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent"
                title={`Click to add "${suggestion}" tag and organize this message under ${suggestion} topic`}
              >
                <Hash className="mr-1 inline h-3 w-3" />
                {suggestion}
              </button>
            ))}
          </div>
        )}
      </div>

      {tags.length >= maxTags && (
        <p className="text-xs text-muted-foreground" title={`You can add maximum ${maxTags} tags to keep your messages well-organized`}>
          Maximum {maxTags} tags reached
        </p>
      )}
    </div>
  )
}
