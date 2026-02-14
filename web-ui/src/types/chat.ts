// Chat and memory event types

export type Channel = 'private' | 'public' | 'team' | 'agent'
export type Sensitivity = 'none' | 'low' | 'high' | 'secret'
export type ActorKind = 'human' | 'agent' | 'system'

export interface MemoryEvent {
  id: string
  session_id: string
  channel: Channel
  actor: {
    kind: ActorKind
    name: string
  }
  kind: string
  content: {
    text: string
    metadata?: Record<string, unknown>
  }
  sensitivity: Sensitivity
  tags: string[]
  timestamp: string
}

export interface RecordEventRequest {
  session_id: string
  channel: Channel
  actor: {
    kind: ActorKind
    name: string
  }
  kind: string
  content: {
    text: string
    metadata?: Record<string, unknown>
  }
  sensitivity: Sensitivity
  tags: string[]
}

export interface Session {
  id: string
  name: string
  created_at: string
  message_count: number
}

export interface GeneratedMessage {
  actor: ActorKind
  name: string
  content: string
  channel: Channel
  tags: string[]
  sensitivity: Sensitivity
}

export interface ScenarioGenerationParams {
  subjects: string[]
  complexity: number
  length: 'short' | 'medium' | 'long'
}
