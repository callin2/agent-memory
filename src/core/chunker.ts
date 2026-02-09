import { generateChunkId } from '../utils/id-generator.js';
import { estimateTokens } from '../utils/token-counter.js';

export interface EventContent {
  text?: string;
  excerpt_text?: string;
  decision?: string;
  rationale?: string[];
  // Scope+subject framework
  scope?: string;
  subject_type?: string;
  subject_id?: string;
  project_id?: string;
  [key: string]: any;
}

export interface Chunk {
  chunk_id: string;
  tenant_id: string;
  event_id: string;
  ts: Date;
  kind: string;
  channel: string;
  sensitivity: string;
  tags: string[];
  token_est: number;
  importance: number;
  text: string;
  // Scope+subject framework
  scope?: string | null;
  subject_type?: string | null;
  subject_id?: string | null;
  project_id?: string | null;
}

/**
 * Extract text from event content for chunking
 */
export function extractText(kind: string, content: EventContent): string {
  switch (kind) {
    case 'message':
      return content.text || '';

    case 'tool_result':
      return content.excerpt_text || '';

    case 'decision': {
      const parts = [content.decision || ''];
      if (content.rationale && content.rationale.length > 0) {
        parts.push(content.rationale.join('\n'));
      }
      return parts.join('\n');
    }

    case 'tool_call':
      // Tool calls typically don't need chunking
      return '';

    case 'task_update':
      return content.details || content.title || '';

    default:
      return '';
  }
}

/**
 * Calculate importance score for a chunk
 */
export function calculateImportance(
  kind: string,
  tags: string[],
  content: EventContent
): number {
  // Decisions are most important
  if (kind === 'decision') {
    return 1.0;
  }

  // Tasks are highly important
  if (kind === 'task_update') {
    return 0.8;
  }

  // Pinned tags
  if (tags.includes('pinned')) {
    return 0.9;
  }

  // Check for important file types in tool results
  if (kind === 'tool_result') {
    const path = content.path || '';
    const importantFiles = ['README', 'package.json', 'pyproject.toml', 'Cargo.toml', 'go.mod'];
    if (importantFiles.some((f) => path.includes(f))) {
      return 0.7;
    }
  }

  return 0.0;
}

/**
 * Create a chunk from an event with scope+subject propagation
 */
export function createChunk(
  tenant_id: string,
  event_id: string,
  kind: string,
  channel: string,
  sensitivity: string,
  tags: string[],
  content: EventContent,
  ts: Date = new Date(),
  scope?: string | null,
  subject_type?: string | null,
  subject_id?: string | null,
  project_id?: string | null
): Chunk | null {
  const text = extractText(kind, content);

  // Don't create empty chunks
  if (!text || text.trim().length === 0) {
    return null;
  }

  const importance = calculateImportance(kind, tags, content);

  return {
    chunk_id: generateChunkId(),
    tenant_id,
    event_id,
    ts,
    kind,
    channel,
    sensitivity,
    tags,
    token_est: estimateTokens(text),
    importance,
    text,
    // Propagate scope+subject from event
    scope,
    subject_type,
    subject_id,
    project_id,
  };
}

/**
 * Create multiple chunks from an event
 * Currently creates 1 chunk per event, but can be extended for large content
 */
export function createChunks(
  tenant_id: string,
  event_id: string,
  kind: string,
  channel: string,
  sensitivity: string,
  tags: string[],
  content: EventContent,
  ts: Date = new Date(),
  scope?: string | null,
  subject_type?: string | null,
  subject_id?: string | null,
  project_id?: string | null
): Chunk[] {
  const chunk = createChunk(
    tenant_id,
    event_id,
    kind,
    channel,
    sensitivity,
    tags,
    content,
    ts,
    scope,
    subject_type,
    subject_id,
    project_id
  );

  return chunk ? [chunk] : [];
}
