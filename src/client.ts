/**
 * Agent Memory System - Client Library
 *
 * This module provides a TypeScript client library for integrating with
 * the Agent Memory System from external applications like WiseNote.
 */

export interface MemoryClientConfig {
  /**
   * Base URL of the agent memory HTTP server
   * @default http://localhost:3000
   */
  baseUrl?: string;

  /**
   * API key for authentication (optional)
   */
  apiKey?: string;

  /**
   * Tenant ID for multi-tenant isolation
   * @default "default"
   */
  tenantId?: string;

  /**
   * Request timeout in milliseconds
   * @default 10000
   */
  timeoutMs?: number;
}

export interface MemoryEvent {
  kind: string;
  content: unknown;
  tags?: string[];
}

export interface AssembleContextOptions {
  sessionId?: string;
  channel?: string;
  maxTokens?: number;
  limit?: number;
  query?: string;
}

export interface ContextEvent {
  kind: string;
  content: { text?: string; tool?: string; result?: string; decision?: string };
}

/**
 * Client for interacting with Agent Memory System
 */
export class AgentMemoryClient {
  private readonly config: Required<MemoryClientConfig>;

  constructor(config: MemoryClientConfig = {}) {
    this.config = {
      baseUrl: config.baseUrl ?? 'http://localhost:3000',
      apiKey: config.apiKey ?? '',
      tenantId: config.tenantId ?? 'default',
      timeoutMs: config.timeoutMs ?? 10000,
    };
  }

  /**
   * Store events in memory
   */
  async storeEvents(events: MemoryEvent[], sessionId?: string): Promise<void> {
    const response = await this.fetchWithTimeout('/api/v1/events', {
      method: 'POST',
      body: JSON.stringify({
        tenant_id: this.config.tenantId,
        session_id: sessionId ?? this.generateSessionId(),
        channel: 'private',
        events: events.map(e => ({
          tenant_id: this.config.tenantId,
          session_id: sessionId ?? this.generateSessionId(),
          channel: 'private',
          actor: { type: 'user', id: 'external' },
          kind: e.kind,
          content: e.content,
          tags: e.tags,
        })),
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to store events: ${response.status} ${response.statusText}`);
    }
  }

  /**
   * Retrieve context for LLM
   */
  async assembleContext(options: AssembleContextOptions = {}): Promise<{
    events: ContextEvent[];
    nextEventId: string;
  }> {
    const params = new URLSearchParams();
    if (options.maxTokens) params.append('max_tokens', options.maxTokens.toString());
    if (options.limit) params.append('limit', options.limit.toString());
    if (options.query) params.append('query', options.query);

    const response = await this.fetchWithTimeout(
      `/api/v1/assemble?${params.toString()}`,
      {
        method: 'POST',
        body: JSON.stringify({
          tenant_id: this.config.tenantId,
          session_id: options.sessionId ?? this.generateSessionId(),
          channel: options.channel ?? 'private',
          max_tokens: options.maxTokens ?? 60000,
          limit: options.limit ?? 50,
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to assemble context: ${response.status} ${response.statusText}`);
    }

    const data = await response.json() as {
      events: ContextEvent[];
      next_event_id: string;
    };

    return {
      events: data.events,
      nextEventId: data.next_event_id,
    };
  }

  /**
   * Store a knowledge note
   */
  async createKnowledgeNote(text: string, tags?: string[]): Promise<void> {
    const response = await this.fetchWithTimeout('/api/v1/knowledge', {
      method: 'POST',
      body: JSON.stringify({
        tenant_id: this.config.tenantId,
        text,
        tags,
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to create knowledge note: ${response.status} ${response.statusText}`);
    }
  }

  /**
   * Search memory semantically
   */
  async semanticSearch(query: string, limit = 5): Promise<unknown[]> {
    const response = await this.fetchWithTimeout(
      `/api/v1/semantic-search?query=${encodeURIComponent(query)}&limit=${limit}`
    );

    if (!response.ok) {
      throw new Error(`Failed to search memory: ${response.status} ${response.statusText}`);
    }

    const data = await response.json() as { results?: unknown[] };
    return data.results ?? [];
  }

  private async fetchWithTimeout(
    path: string,
    options: { method?: string; body?: string } = {}
  ): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeoutMs);

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      if (this.config.apiKey) {
        headers['X-API-Key'] = this.config.apiKey;
      }

      const response = await fetch(`${this.config.baseUrl}${path}`, {
        method: options.method ?? 'GET',
        headers,
        body: options.body,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error(`Request timeout after ${this.config.timeoutMs}ms`);
      }
      throw error;
    }
  }

  private generateSessionId(): string {
    return `session-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }
}

/**
 * Create a configured agent memory client
 */
export function createAgentMemoryClient(config: MemoryClientConfig = {}): AgentMemoryClient {
  return new AgentMemoryClient(config);
}
