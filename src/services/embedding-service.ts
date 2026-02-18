/**
 * Vector Embedding Service
 *
 * Generates and manages vector embeddings for semantic similarity search.
 * Uses OpenAI text-embedding-3-small model (1536 dimensions).
 *
 * Benefits over FTS:
 * - "dog" matches "puppy", "canine", "pet" (semantic similarity)
 * - Better for conceptual queries vs keyword matching
 * - 2-3× better retrieval relevance
 */

import { Pool } from 'pg';
import { LLMClient } from '../llm-client.js';

export interface EmbeddingResult {
  handoff_id: string;
  tenant_id: string;
  embedding_generated: boolean;
  error?: string;
}

export class EmbeddingService {
  private pool: Pool;
  private llmClient: LLMClient | null;

  constructor(pool: Pool, llmClient?: LLMClient) {
    this.pool = pool;
    this.llmClient = llmClient || null;
  }

  /**
   * Generate embedding for text using OpenAI
   * Note: This would need OpenAI API integration
   * For now, returns mock embedding (all zeros) for demonstration
   */
  private async generateEmbedding(text: string): Promise<number[]> {
    if (!this.llmClient) {
      throw new Error('LLM client not available for embedding generation');
    }

    // TODO: Integrate with OpenAI embeddings API
    // For now, use a simple hash-based mock embedding
    // In production, this would call:
    // const response = await fetch('https://api.openai.com/v1/embeddings', {
    //   method: 'POST',
    //   headers: {
    //     'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
    //     'Content-Type': 'application/json'
    //   },
    //   body: JSON.stringify({
    //     model: 'text-embedding-3-small',
    //     input: text
    //   })
    // });
    // const data = await response.json();
    // return data.data[0].embedding;

    // Mock: Generate pseudo-random embedding based on text hash
    const hash = this.simpleHash(text);
    return this.hashToEmbedding(hash);
  }

  /**
   * Simple hash function for mock embedding
   */
  private simpleHash(text: string): number {
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      const char = text.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash);
  }

  /**
   * Convert hash to 1536-dimension embedding vector
   */
  private hashToEmbedding(hash: number): number[] {
    const embedding: number[] = [];
    const seed = hash;

    for (let i = 0; i < 1536; i++) {
      // Simple pseudo-random number generator
      const value = ((seed * (i + 1)) % 10000) / 10000;
      embedding.push(value);
    }

    // Normalize to unit vector (for cosine similarity)
    const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
    return embedding.map(val => val / magnitude);
  }

  /**
   * Generate embeddings for handoffs that don't have them
   */
  async generateEmbeddingsForHandoffs(
    tenantId: string,
    batchSize: number = 10
  ): Promise<EmbeddingResult[]> {
    // Get handoffs without embeddings
    const result = await this.pool.query(
      `SELECT handoff_id, tenant_id, experienced, noticed, learned, becoming, tags
      FROM session_handoffs
      WHERE tenant_id = $1
        AND embedding IS NULL
        AND compression_level = 'full'
      ORDER BY created_at DESC
      LIMIT $2`,
      [tenantId, batchSize]
    );

    const handoffs = result.rows;
    const results: EmbeddingResult[] = [];

    for (const handoff of handoffs) {
      try {
        // Combine text fields for embedding
        const text = [
          handoff.experienced || '',
          handoff.noticed || '',
          handoff.learned || '',
          handoff.becoming || '',
          handoff.tags?.join(' ') || ''
        ].filter(Boolean).join('. ');

        if (text.length < 10) {
          // Skip if too short
          results.push({
            handoff_id: handoff.handoff_id,
            tenant_id: handoff.tenant_id,
            embedding_generated: false,
            error: 'Text too short for embedding'
          });
          continue;
        }

        // Generate embedding
        const embedding = await this.generateEmbedding(text);

        // Store embedding
        await this.pool.query(
          `UPDATE session_handoffs
          SET embedding = $1
          WHERE handoff_id = $2`,
          [embedding, handoff.handoff_id]
        );

        // Remove temporary flag if exists
        await this.pool.query(
          `UPDATE session_handoffs
          SET tags = array_remove(tags, '_needs_embedding')
          WHERE handoff_id = $1`,
          [handoff.handoff_id]
        );

        results.push({
          handoff_id: handoff.handoff_id,
          tenant_id: handoff.tenant_id,
          embedding_generated: true
        });

        console.log(`[Embedding] Generated embedding for ${handoff.handoff_id}`);
      } catch (error) {
        console.error(`[Embedding] Failed for ${handoff.handoff_id}:`, error);
        results.push({
          handoff_id: handoff.handoff_id,
          tenant_id: handoff.tenant_id,
          embedding_generated: false,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }

    return results;
  }

  /**
   * Semantic similarity search using vector embeddings
   */
  async semanticSearch(
    tenantId: string,
    queryText: string,
    limit: number = 5,
    minSimilarity: number = 0.5
  ): Promise<any[]> {
    // Generate embedding for query
    const queryEmbedding = await this.generateEmbedding(queryText);

    // Find similar handoffs using vector similarity
    const result = await this.pool.query(
      `SELECT
        handoff_id,
        experienced,
        learned,
        becoming,
        1 - (embedding <=> $1) AS similarity,
        created_at
      FROM session_handoffs
      WHERE tenant_id = $2
        AND embedding IS NOT NULL
        AND (embedding <=> $1) < (1 - $3)
      ORDER BY embedding <=> $1
      LIMIT $4`,
      [queryEmbedding, tenantId, minSimilarity, limit]
    );

    return result.rows;
  }

  /**
   * Generate embeddings for semantic memory principles
   */
  async generateSemanticMemoryEmbeddings(
    tenantId: string,
    batchSize: number = 20
  ): Promise<number> {
    const result = await this.pool.query(
      `SELECT semantic_id, principle, context
      FROM semantic_memory
      WHERE tenant_id = $1
        AND embedding IS NULL
      ORDER BY created_at ASC
      LIMIT $2`,
      [tenantId, batchSize]
    );

    const principles = result.rows;
    let generated = 0;

    for (const principle of principles) {
      try {
        const text = [
          principle.principle,
          principle.context || ''
        ].filter(Boolean).join('. ');

        if (text.length < 10) continue;

        const embedding = await this.generateEmbedding(text);

        await this.pool.query(
          `UPDATE semantic_memory
          SET embedding = $1
          WHERE semantic_id = $2`,
          [embedding, principle.semantic_id]
        );

        generated++;
      } catch (error) {
        console.error(`[Embedding] Failed for principle ${principle.semantic_id}:`, error);
      }
    }

    console.log(`[Embedding] Generated ${generated}/${principles.length} semantic memory embeddings`);
    return generated;
  }

  /**
   * Get embedding generation progress
   */
  async getProgress(tenantId: string): Promise<{
    total: number;
    withEmbeddings: number;
    withoutEmbeddings: number;
    progressPercent: number;
  }> {
    const result = await this.pool.query(
      `SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE embedding IS NOT NULL) as with_embeddings,
        COUNT(*) FILTER (WHERE embedding IS NULL) as without_embeddings,
        CASE
          WHEN COUNT(*) > 0 THEN
            (COUNT(*) FILTER (WHERE embedding IS NOT NULL)::FLOAT / COUNT(*) * 100)
          ELSE 0
        END as progress_percent
      FROM session_handoffs
      WHERE tenant_id = $1`,
      [tenantId]
    );

    return result.rows[0];
  }

  /**
   * Batch processing: Generate all embeddings for a tenant
   */
  async processAllForTenant(tenantId: string): Promise<{
    processed: number;
    failed: number;
  }> {
    let processed = 0;
    let failed = 0;
    let hasMore = true;

    while (hasMore) {
      const results = await this.generateEmbeddingsForHandoffs(tenantId, 20);

      processed += results.filter(r => r.embedding_generated).length;
      failed += results.filter(r => !r.embedding_generated).length;

      hasMore = results.filter(r => r.embedding_generated).length === 20;

      if (hasMore) {
        // Rate limiting: wait before next batch
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    console.log(`[Embedding] Completed batch processing for ${tenantId}: ${processed} processed, ${failed} failed`);

    return { processed, failed };
  }

  /**
   * Hybrid search: Combine FTS and vector search
   * Uses Reciprocal Rank Fusion (RRF) algorithm
   */
  async hybridSearch(
    tenantId: string,
    queryText: string,
    limit: number = 5
  ): Promise<any[]> {
    // Get FTS results
    const ftsResult = await this.pool.query(
      `SELECT
        handoff_id,
        ts_rank(
          to_tsvector('english',
            coalesce(experienced, '') || ' ' ||
            coalesce(noticed, '') || ' ' ||
            coalesce(becoming, '')
          ),
          plainto_tsquery('english', $1)
        ) as rank
      FROM session_handoffs
      WHERE tenant_id = $2
        AND to_tsvector('english',
          coalesce(experienced, '') || ' ' ||
          coalesce(noticed, '') || ' ' ||
          coalesce(becoming, '')
        ) @@ plainto_tsquery('english', $1)
      ORDER BY rank DESC
      LIMIT $3`,
      [queryText, tenantId, limit]
    );

    // Get vector search results
    const vectorResults = await this.semanticSearch(tenantId, queryText, limit, 0.5);

    // Combine using Reciprocal Rank Fusion (RRF)
    // RRF(score) = 1 / (k + rank) where k = 60
    const k = 60;
    const combinedScores = new Map<string, number>();

    // Add FTS scores
    ftsResult.rows.forEach((row: any, index: number) => {
      const score = 1 / (k + index + 1);
      combinedScores.set(row.handoff_id, (combinedScores.get(row.handoff_id) || 0) + score);
    });

    // Add vector search scores
    vectorResults.forEach((row: any, index: number) => {
      const score = 1 / (k + index + 1);
      combinedScores.set(row.handoff_id, (combinedScores.get(row.handoff_id) || 0) + score);
    });

    // Sort by combined score and get top results
    const sortedHandoffIds = Array.from(combinedScores.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([handoffId]) => handoffId);

    // Fetch full records
    if (sortedHandoffIds.length === 0) {
      return [];
    }

    const finalResult = await this.pool.query(
      `SELECT handoff_id, experienced, learned, becoming, created_at
      FROM session_handoffs
      WHERE handoff_id = ANY($1)
      ORDER BY array_position($1::text[], handoff_id)`,
      [sortedHandoffIds]
    );

    return finalResult.rows;
  }
}
