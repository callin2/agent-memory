// Common types for the memory test harness

export interface Agent {
  id: string
  name: string
  type: 'manager' | 'expert' | 'builder'
  status: 'active' | 'inactive'
}

export interface MemoryCapsule {
  id: string
  agentId: string
  content: string
  timestamp: Date
  tags: string[]
}

export interface MemoryTestResult {
  id: string
  testName: string
  status: 'passed' | 'failed' | 'skipped'
  duration: number
  timestamp: Date
  error?: string
}

// Visualization types
export interface MemoryEvent {
  id: string
  timestamp: Date
  sessionId: string
  actor: string
  kind: 'message' | 'decision' | 'reply' | 'reference' | 'capsule'
  content: string
  subject?: string
  tags?: string[]
  relatedTo?: string[] // IDs of related events
}

export interface GraphNode {
  id: string
  label: string
  kind: 'session' | 'message' | 'decision' | 'capsule' | 'reply' | 'reference'
  subject?: string
  timestamp: Date
  color?: string
  title?: string
}

export interface GraphEdge {
  id: string
  from: string
  to: string
  kind: 'reply' | 'reference' | 'decision'
  label?: string
  dashes?: boolean
  color?: string
}

export interface FilterOptions {
  subjects: string[]
  dateRange: {
    from?: Date
    to?: Date
  }
  kinds: string[]
  searchQuery: string
}

export interface TimelineEvent {
  id: string
  timestamp: Date
  kind: string
  subject?: string
  content: string
  density: number // Number of events in this time period
  events?: MemoryEvent[] // Associated events for this time period
}

// ACB (Active Context Bundle) Types
export type Channel = 'private' | 'public' | 'team' | 'agent'

export interface ACBRequest {
  tenant_id: string
  session_id: string
  agent_id: string
  channel: Channel
  intent: string
  query_text: string
  max_tokens?: number
  subject_type?: string
  subject_id?: string
  project_id?: string
  include_capsules?: boolean
  include_quarantined?: boolean
}

export interface ACBItem {
  type: 'text' | 'decision' | 'task'
  text?: string
  decision_id?: string
  task_id?: string
  refs: string[]
}

export interface ACBSection {
  name: string
  items: ACBItem[]
  token_est: number
}

export interface ACBOmission {
  reason: string
  candidates: string[]
  artifact_id?: string
}

export interface ACBProvenance {
  intent: string
  query_terms: string[]
  candidate_pool_size: number
  filters: {
    sensitivity_allowed: string[]
  }
  scoring: {
    alpha: number
    beta: number
    gamma: number
  }
}

export interface CapsuleInfo {
  capsule_id: string
  scope: string
  subject_type: string
  subject_id: string
  item_count: number
  author_agent_id: string
  risks: string[]
}

export interface ACBResponse {
  acb_id: string
  budget_tokens: number
  token_used_est: number
  sections: ACBSection[]
  omissions: ACBOmission[]
  provenance: ACBProvenance
  capsules: CapsuleInfo[]
  edits_applied: number
}

// Chunk Types
export interface Chunk {
  chunk_id: string
  tenant_id: string
  scope: string
  subject_type: string
  subject_id: string
  channel: string
  content: string
  importance_score: number
  timestamp: string
  similarity?: number
  quarantine_reason?: string | null
}

export interface SearchChunksRequest {
  tenant_id: string
  query: string
  scope?: string
  subject_type?: string
  subject_id?: string
  project_id?: string
  include_quarantined?: boolean
  channel?: string
  limit?: number
}

export interface SearchChunksResponse {
  chunks: Chunk[]
  total_count: number
}

// Query Preset Type
export interface QueryPreset {
  id: string
  name: string
  tenant_id: string
  session_id: string
  agent_id: string
  channel: Channel
  intent: string
  query_text: string
  max_tokens: number
  created_at: string
}

// Comparison Types
export interface ComparisonItem {
  chunk_id: string
  expected: boolean
  retrieved: boolean
  content: string
  similarity?: number
  importance?: number
}

export interface ComparisonMetrics {
  precision: number
  recall: number
  f1: number
  truePositives: number
  falsePositives: number
  falseNegatives: number
}

// Feedback Types
export interface ItemFeedback {
  chunk_id: string
  relevant: boolean | null
  shouldHaveRetrieved: boolean
  notes: string
}

export interface RetrievalFeedback {
  query_id: string
  timestamp: string
  feedback: ItemFeedback[]
}
