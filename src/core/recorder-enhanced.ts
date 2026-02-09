import { Pool } from 'pg';
import { generateEventId, generateArtifactId } from '../utils/id-generator.js';
import { redactSecrets, containsSecrets } from './privacy.js';
import { createChunks } from './chunker.js';
import { measurePerformance } from '../utils/performance.js';
import type { EventContent } from './chunker.js';

export interface Actor {
  type: 'human' | 'agent' | 'tool';
  id: string;
}

export interface EventInput {
  tenant_id: string;
  session_id: string;
  channel: 'private' | 'public' | 'team' | 'agent';
  actor: Actor;
  kind: 'message' | 'tool_call' | 'tool_result' | 'decision' | 'task_update' | 'artifact';
  sensitivity?: 'none' | 'low' | 'high' | 'secret';
  tags?: string[];
  content: EventContent;
  refs?: string[];
}

export interface EventResult {
  event_id: string;
  chunk_ids: string[];
  artifact_id?: string;
}

// Prepared statements cache
const statements = {
  insertEvent: `
    INSERT INTO events (event_id, tenant_id, session_id, channel,
                        actor_type, actor_id, kind, sensitivity, tags, content, refs)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
  `,
  insertArtifact: `
    INSERT INTO artifacts (artifact_id, tenant_id, kind, bytes, meta, refs)
    VALUES ($1, $2, $3, $4, $5, $6)
  `,
  insertChunk: `
    INSERT INTO chunks (chunk_id, tenant_id, event_id, ts, kind,
                        channel, sensitivity, tags, token_est, importance, text)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
  `,
};

/**
 * Record an event to the database with prepared statements
 */
export const recordEvent = measurePerformance(
  class {
    async execute(pool: Pool, input: EventInput): Promise<EventResult> {
      const event_id = generateEventId();
      const chunk_ids: string[] = [];
      let artifact_id: string | undefined;

      // Redact secrets if present
      const content = { ...input.content };
      const textToCheck = JSON.stringify(content);

      if (containsSecrets(textToCheck)) {
        input.sensitivity = 'secret';

        // Redact secrets from content
        for (const key in content) {
          if (typeof content[key] === 'string') {
            content[key] = redactSecrets(content[key] as string);
          }
        }
      }

      const client = await pool.connect();

      try {
        await client.query('BEGIN');

        // Handle tool results that exceed size limit
        const maxToolResultSize = 64 * 1024; // 64KB
        if (input.kind === 'tool_result' && content.excerpt_text) {
          const fullText = content.excerpt_text;

          if (fullText.length > maxToolResultSize) {
            artifact_id = generateArtifactId();
            const artifactBuffer = Buffer.from(fullText, 'utf-8');

            await client.query(statements.insertArtifact, [
              artifact_id,
              input.tenant_id,
              'tool_output',
              artifactBuffer,
              JSON.stringify({
                tool: content.tool,
                path: content.path,
                size: fullText.length,
              }),
              input.refs || [],
            ]);

            // Store excerpt in event content
            content.excerpt_text = fullText.substring(0, maxToolResultSize);
            content.truncated = true;
            content.artifact_id = artifact_id;
          }
        }

        // Insert event using prepared statement
        await client.query(statements.insertEvent, [
          event_id,
          input.tenant_id,
          input.session_id,
          input.channel,
          input.actor.type,
          input.actor.id,
          input.kind,
          input.sensitivity || 'none',
          input.tags || [],
          JSON.stringify(content),
          input.refs || [],
        ]);

        // Auto-chunking
        const chunks = createChunks(
          input.tenant_id,
          event_id,
          input.kind,
          input.channel,
          input.sensitivity || 'none',
          input.tags || [],
          content
        );

        for (const chunk of chunks) {
          await client.query(statements.insertChunk, [
            chunk.chunk_id,
            chunk.tenant_id,
            chunk.event_id,
            chunk.ts,
            chunk.kind,
            chunk.channel,
            chunk.sensitivity,
            chunk.tags,
            chunk.token_est,
            chunk.importance,
            chunk.text,
          ]);

          chunk_ids.push(chunk.chunk_id);
        }

        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }

      return {
        event_id,
        chunk_ids,
        artifact_id,
      };
    }
  }
).prototype.execute;

/**
 * Get event by ID with prepared statement
 */
export async function getEvent(
  pool: Pool,
  event_id: string
): Promise<any> {
  const result = await pool.query(
    'SELECT * FROM events WHERE event_id = $1',
    [event_id]
  );

  return result.rows[0];
}

/**
 * Get events by session with prepared statement
 */
export async function getEventsBySession(
  pool: Pool,
  tenant_id: string,
  session_id: string,
  limit: number = 100
): Promise<any[]> {
  const result = await pool.query(
    `SELECT * FROM events
     WHERE tenant_id = $1 AND session_id = $2
     ORDER BY ts DESC
     LIMIT $3`,
    [tenant_id, session_id, limit]
  );

  return result.rows;
}

// Re-export types
export type { EventInput, EventResult };
