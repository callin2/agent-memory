import api from './api'
import type {
  MemoryEvent,
  Session,
} from '@/types/chat'
import type {
  Chunk,
  SearchChunksRequest,
  SearchChunksResponse,
} from '@/types'

// Use /v1 prefix (baseURL is already /api)
const MEMORY_API = '/v1'

/**
 * Memory Service - Test Harness Visualization
 *
 * IMPORTANT: Backend transparently captures all agent activity via middleware.
 * Frontend no longer needs to explicitly record events or build ACB.
 *
 * These methods are READ-ONLY and kept for test harness visualization.
 */
export const memoryService = {
  /**
   * Get all events for a specific session
   * NOTE: Backend auto-captures events transparently via headers.
   * This method is for test harness visualization only.
   */
  async getEvents(session_id: string): Promise<MemoryEvent[]> {
    const response = await api.get<MemoryEvent[]>(`${MEMORY_API}/events`, {
      params: { session_id },
    })
    return response.data
  },

  /**
   * Get a specific event by ID
   * For test harness visualization
   */
  async getEvent(event_id: string): Promise<MemoryEvent> {
    const response = await api.get<MemoryEvent>(`${MEMORY_API}/events/${event_id}`)
    return response.data
  },

  /**
   * Get a specific chunk by ID
   * GET /api/v1/chunks/:chunk_id
   */
  async getChunk(chunkId: string): Promise<Chunk> {
    const response = await api.get<Chunk>(`${MEMORY_API}/chunks/${chunkId}`)
    return response.data
  },

  /**
   * Search chunks with filters
   * POST /api/v1/chunks/search
   */
  async searchChunks(
    params: SearchChunksRequest
  ): Promise<SearchChunksResponse> {
    const response = await api.post<SearchChunksResponse>(
      `${MEMORY_API}/chunks/search`,
      params
    )
    return response.data
  },

  /**
   * Get timeline for a chunk
   * GET /api/v1/chunks/:chunk_id/timeline
   */
  async getChunkTimeline(
    chunkId: string,
    windowSeconds?: number
  ): Promise<Chunk[]> {
    const params = windowSeconds ? { window_seconds: windowSeconds } : {}
    const response = await api.get<Chunk[]>(
      `${MEMORY_API}/chunks/${chunkId}/timeline`,
      { params }
    )
    return response.data
  },

  /**
   * Create a new session
   */
  async createSession(name: string): Promise<Session> {
    const response = await api.post<Session>(`${MEMORY_API}/sessions`, { name })
    return response.data
  },

  /**
   * Get all sessions
   */
  async getSessions(): Promise<Session[]> {
    const response = await api.get<Session[]>(`${MEMORY_API}/sessions`)
    return response.data
  },

  /**
   * Get a specific session by ID
   */
  async getSession(session_id: string): Promise<Session> {
    const response = await api.get<Session>(
      `${MEMORY_API}/sessions/${session_id}`
    )
    return response.data
  },

  /**
   * Delete a session
   */
  async deleteSession(session_id: string): Promise<void> {
    await api.delete(`${MEMORY_API}/sessions/${session_id}`)
  },
}

export default memoryService
