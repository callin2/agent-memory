import { useState, useCallback } from 'react'
import { MessageList } from './MessageList'
import { MessageInput } from './MessageInput'
import { ScenarioGenerator } from './ScenarioGenerator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { sendChatMessage } from '@/services/api'
import memoryService from '@/services/memory'
import type { MemoryEvent, Channel, Sensitivity, ActorKind } from '@/types/chat'

interface ChatInterfaceProps {
  sessionId: string
  agentId?: string
  tenantId?: string
  actorName?: string
}

export function ChatInterface({
  sessionId,
  agentId = 'test-agent',
  tenantId = 'default',
}: ChatInterfaceProps) {
  const [messages, setMessages] = useState<MemoryEvent[]>([])
  const [isLoading, setIsLoading] = useState(false)

  // Fetch messages on mount
  useState(() => {
    const loadMessages = async () => {
      try {
        const events = await memoryService.getEvents(sessionId)
        setMessages(events)
      } catch (error) {
        console.error('Failed to load messages:', error)
      }
    }
    loadMessages()
  })

  const handleSendMessage = useCallback(
    async (message: {
      content: string
      channel: Channel
      sensitivity: Sensitivity
      tags: string[]
    }) => {
      setIsLoading(true)
      try {
        // Send message via transparent API
        // Backend middleware auto-captures the event
        await sendChatMessage({
          sessionId,
          agentId,
          tenantId,
          channel: message.channel,
          intent: 'chat',
          message: {
            text: message.content,
            metadata: {
              sensitivity: message.sensitivity,
              tags: message.tags,
            },
          },
        })

        // Refresh messages to see the auto-captured event
        const events = await memoryService.getEvents(sessionId)
        setMessages(events)
      } catch (error) {
        console.error('Failed to send message:', error)
        throw error
      } finally {
        setIsLoading(false)
      }
    },
    [sessionId, agentId, tenantId]
  )

  const handleSendGenerated = useCallback(
    async (generatedMessages: Array<{
      actor: ActorKind
      name: string
      content: string
      channel: Channel
      tags: string[]
      sensitivity: Sensitivity
    }>) => {
      setIsLoading(true)
      try {
        // Send messages sequentially via transparent API
        // Backend middleware auto-captures each event
        for (const msg of generatedMessages) {
          await sendChatMessage({
            sessionId,
            agentId: msg.name, // Use agent name from message
            tenantId,
            channel: msg.channel,
            intent: 'generated',
            message: {
              text: msg.content,
              metadata: {
                sensitivity: msg.sensitivity,
                tags: msg.tags,
                actor_kind: msg.actor,
              },
            },
          })
        }

        // Refresh messages to see the auto-captured events
        const events = await memoryService.getEvents(sessionId)
        setMessages(events)
      } catch (error) {
        console.error('Failed to send generated messages:', error)
        throw error
      } finally {
        setIsLoading(false)
      }
    },
    [sessionId, tenantId]
  )

  return (
    <div className="grid h-full grid-cols-1 gap-6 lg:grid-cols-3">
      {/* Messages Panel */}
      <div className="lg:col-span-2 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold">Messages</h2>
          <span className="text-sm text-muted-foreground">
            {messages.length} {messages.length === 1 ? 'message' : 'messages'}
          </span>
        </div>
        <MessageList messages={messages} />
      </div>

      {/* Input Panel */}
      <div className="space-y-4">
        <Tabs defaultValue="input" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="input" title="New Message tab - Switch to manual message input mode to type and send custom messages for testing">
              New Message
            </TabsTrigger>
            <TabsTrigger value="scenario" title="Scenario tab - Switch to scenario generator to auto-create realistic test conversations for batch testing">
              Scenario
            </TabsTrigger>
          </TabsList>

          <TabsContent value="input" className="mt-4">
            <MessageInput
              onSend={handleSendMessage}
              disabled={isLoading}
              placeholder="Type your message here..."
            />
          </TabsContent>

          <TabsContent value="scenario" className="mt-4">
            <ScenarioGenerator
              onSendAll={handleSendGenerated}
              disabled={isLoading}
            />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
