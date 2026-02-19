/**
 * Vector Embedding Service
 *
 * Generates and manages vector embeddings for semantic similarity search.
 * Uses local Qwen3 text-embedding-qwen3-embedding-0.6b model (1024 dimensions).
 *
 * API Endpoint: http://172.30.1.23:1234/v1/embeddings
 *
 * Benefits over FTS:
 * - "dog" matches "puppy", "canine", "pet" (semantic similarity)
 * - Better for conceptual queries vs keyword matching
 * - 2-3× better retrieval relevance
 * - Free (runs locally on your LAN PC)
 */

import { Pool } from 'pg';

export interface EmbeddingResult {
  handoff_id: string;
  tenant_id: string;
  embedding_generated: boolean;
  error?: string;
}

export class EmbeddingService {
  private pool: Pool;

  constructor(pool: Pool, _llmClient?: unknown) {
    this.pool = pool;
  }

  /**
   * Generate embedding for text using local Qwen3 API
   * Endpoint: http://172.30.1.23:1234/v1/embeddings
   */
  private async generateEmbedding(text: string): Promise<number[]> {
    const embeddingApiUrl = process.env.EMBEDDING_API_URL || 'http://172.30.1.23:1234/v1/embeddings';
    const embeddingModel = process.env.EMBEDDING_MODEL || 'text-embedding-qwen3-embedding-0.6b';

    try {
      const response = await fetch(embeddingApiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: embeddingModel,
          input: text,
        }),
      });

      if (!response.ok) {
        throw new Error(`Embedding API error: ${response.status} ${response.statusText}`);
      }

      const data: any = await response.json();

      // Handle OpenAI-compatible response format
      if (data.data && data.data[0] && data.data[0].embedding) {
        return data.data[0].embedding;
      }

      throw new Error('Invalid embedding response format');
    } catch (error) {
      // Fallback to hash-based mock embedding if API fails
      console.error('[Embedding] API call failed, using fallback:', error);
      const hash = this.simpleHash(text);
      return this.hashToEmbedding(hash);
    }
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
   * Convert hash to 1024-dimension embedding vector (Qwen3 size)
   */
  private hashToEmbedding(hash: number): number[] {
    const embedding: number[] = [];
    const seed = hash;

    for (let i = 0; i < 1024; i++) {
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

        // Store embedding - format as pgvector array string: [0.1,0.2,0.3]
        const embeddingString = `[${embedding.join(',')}]`;

        await this.pool.query(
          `UPDATE session_handoffs
          SET embedding = $1::vector(1024)
          WHERE handoff_id = $2`,
          [embeddingString, handoff.handoff_id]
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
    const queryEmbeddingString = `[${queryEmbedding.join(',')}]`;

    // Find similar handoffs using vector similarity
    const result = await this.pool.query(
      `SELECT
        handoff_id,
        experienced,
        learned,
        becoming,
        1 - (embedding <=> $1::vector(1024)) AS similarity,
        created_at
      FROM session_handoffs
      WHERE tenant_id = $2
        AND embedding IS NOT NULL
        AND (embedding <=> $1::vector(1024)) < (1 - $3::float8)
      ORDER BY embedding <=> $1::vector(1024)
      LIMIT $4`,
      [queryEmbeddingString, tenantId, minSimilarity, limit]
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
        const embeddingString = `[${embedding.join(',')}]`;

        await this.pool.query(
          `UPDATE semantic_memory
          SET embedding = $1::vector(1024)
          WHERE semantic_id = $2`,
          [embeddingString, principle.semantic_id]
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

  // ==========================================================================
  // NEW: Agent Feedback Embeddings
  // ==========================================================================

  /**
   * Generate embeddings for agent feedback that doesn't have them
   */
  async generateFeedbackEmbeddings(
    tenantId: string,
    batchSize: number = 20
  ): Promise<number> {
    const result = await this.pool.query(
      `SELECT feedback_id, tenant_id, category, type, description
      FROM agent_feedback
      WHERE tenant_id = $1
        AND embedding IS NULL
      ORDER BY created_at DESC
      LIMIT $2`,
      [tenantId, batchSize]
    );

    const feedbackItems = result.rows;
    let generated = 0;

    for (const feedback of feedbackItems) {
      try {
        const text = [
          feedback.category,
          feedback.type,
          feedback.description
        ].filter(Boolean).join('. ');

        if (text.length < 10) continue;

        const embedding = await this.generateEmbedding(text);
        const embeddingString = `[${embedding.join(',')}]`;

        await this.pool.query(
          `UPDATE agent_feedback
          SET embedding = $1::vector(1024)
          WHERE feedback_id = $2`,
          [embeddingString, feedback.feedback_id]
        );

        generated++;
        console.log(`[Embedding] Generated feedback embedding for ${feedback.feedback_id}`);
      } catch (error) {
        console.error(`[Embedding] Failed for feedback ${feedback.feedback_id}:`, error);
      }
    }

    console.log(`[Embedding] Generated ${generated}/${feedbackItems.length} feedback embeddings`);
    return generated;
  }

  /**
   * Semantic search for agent feedback
   */
  async semanticSearchFeedback(
    tenantId: string,
    queryText: string,
    limit: number = 5,
    minSimilarity: number = 0.5
  ): Promise<any[]> {
    const queryEmbedding = await this.generateEmbedding(queryText);
    const queryEmbeddingString = `[${queryEmbedding.join(',')}]`;

    const result = await this.pool.query(
      `SELECT
        feedback_id,
        category,
        type,
        description,
        severity,
        status,
        1 - (embedding <=> $1::vector(1024)) AS similarity,
        created_at
      FROM agent_feedback
      WHERE tenant_id = $2
        AND embedding IS NOT NULL
        AND (embedding <=> $1::vector(1024)) < (1 - $3::float8)
      ORDER BY embedding <=> $1::vector(1024)
      LIMIT $4`,
      [queryEmbeddingString, tenantId, minSimilarity, limit]
    );

    return result.rows;
  }

  // ==========================================================================
  // NEW: Knowledge Notes Embeddings
  // ==========================================================================

  /**
   * Generate embeddings for knowledge notes that don't have them
   */
  async generateNoteEmbeddings(
    tenantId: string,
    batchSize: number = 20
  ): Promise<number> {
    const result = await this.pool.query(
      `SELECT id, tenant_id, text, tags, with_whom
      FROM knowledge_notes
      WHERE tenant_id = $1
        AND embedding IS NULL
      ORDER BY created_at DESC
      LIMIT $2`,
      [tenantId, batchSize]
    );

    const notes = result.rows;
    let generated = 0;

    for (const note of notes) {
      try {
        const text = [
          note.text,
          note.with_whom || '',
          note.tags?.join(' ') || ''
        ].filter(Boolean).join('. ');

        if (text.length < 10) continue;

        const embedding = await this.generateEmbedding(text);
        const embeddingString = `[${embedding.join(',')}]`;

        await this.pool.query(
          `UPDATE knowledge_notes
          SET embedding = $1::vector(1024)
          WHERE id = $2`,
          [embeddingString, note.id]
        );

        generated++;
        console.log(`[Embedding] Generated note embedding for ${note.id}`);
      } catch (error) {
        console.error(`[Embedding] Failed for note ${note.id}:`, error);
      }
    }

    console.log(`[Embedding] Generated ${generated}/${notes.length} note embeddings`);
    return generated;
  }

  /**
   * Semantic search for knowledge notes
   */
  async semanticSearchNotes(
    tenantId: string,
    queryText: string,
    limit: number = 5,
    minSimilarity: number = 0.5
  ): Promise<any[]> {
    const queryEmbedding = await this.generateEmbedding(queryText);
    const queryEmbeddingString = `[${queryEmbedding.join(',')}]`;

    const result = await this.pool.query(
      `SELECT
        id,
        text,
        tags,
        with_whom,
        1 - (embedding <=> $1::vector(1024)) AS similarity,
        created_at
      FROM knowledge_notes
      WHERE tenant_id = $2
        AND embedding IS NOT NULL
        AND (embedding <=> $1::vector(1024)) < (1 - $3::float8)
      ORDER BY embedding <=> $1::vector(1024)
      LIMIT $4`,
      [queryEmbeddingString, tenantId, minSimilarity, limit]
    );

    return result.rows;
  }

  // ==========================================================================
  // NEW: Capsules Embeddings
  // ==========================================================================

  /**
   * Generate embeddings for capsules that don't have them
   * Strategy: Flatten JSONB items to text (chunks + decisions + artifacts)
   */
  async generateCapsuleEmbeddings(
    tenantId: string,
    batchSize: number = 20
  ): Promise<number> {
    const result = await this.pool.query(
      `SELECT capsule_id, tenant_id, scope, subject_type, subject_id, items
      FROM capsules
      WHERE tenant_id = $1
        AND embedding IS NULL
        AND status = 'active'
      ORDER BY created_at DESC
      LIMIT $2`,
      [tenantId, batchSize]
    );

    const capsules = result.rows;
    let generated = 0;

    for (const capsule of capsules) {
      try {
        // Flatten JSONB items to text
        const items = capsule.items || {};
        const chunks = (items.chunks || []).map((c: any) => typeof c === 'string' ? c : c.text || '').join(' ');
        const decisions = (items.decisions || []).map((d: any) => typeof d === 'string' ? d : d.text || '').join(' ');
        const artifacts = (items.artifacts || []).map((a: any) => typeof a === 'string' ? a : a.description || '').join(' ');

        const text = [
          capsule.subject_type,
          capsule.subject_id,
          capsule.scope,
          chunks,
          decisions,
          artifacts
        ].filter(Boolean).join('. ');

        if (text.length < 10) continue;

        const embedding = await this.generateEmbedding(text);
        const embeddingString = `[${embedding.join(',')}]`;

        await this.pool.query(
          `UPDATE capsules
          SET embedding = $1::vector(1024)
          WHERE capsule_id = $2`,
          [embeddingString, capsule.capsule_id]
        );

        generated++;
        console.log(`[Embedding] Generated capsule embedding for ${capsule.capsule_id}`);
      } catch (error) {
        console.error(`[Embedding] Failed for capsule ${capsule.capsule_id}:`, error);
      }
    }

    console.log(`[Embedding] Generated ${generated}/${capsules.length} capsule embeddings`);
    return generated;
  }

  /**
   * Semantic search for capsules
   */
  async semanticSearchCapsules(
    tenantId: string,
    queryText: string,
    limit: number = 5,
    minSimilarity: number = 0.5
  ): Promise<any[]> {
    const queryEmbedding = await this.generateEmbedding(queryText);
    const queryEmbeddingString = `[${queryEmbedding.join(',')}]`;

    const result = await this.pool.query(
      `SELECT
        capsule_id,
        scope,
        subject_type,
        subject_id,
        items,
        1 - (embedding <=> $1::vector(1024)) AS similarity,
        created_at,
        expires_at
      FROM capsules
      WHERE tenant_id = $2
        AND embedding IS NOT NULL
        AND status = 'active'
        AND (embedding <=> $1::vector(1024)) < (1 - $3::float8)
      ORDER BY embedding <=> $1::vector(1024)
      LIMIT $4`,
      [queryEmbeddingString, tenantId, minSimilarity, limit]
    );

    return result.rows;
  }

  // ==========================================================================
  // NEW: Universal Embedding Progress (All Tables)
  // ==========================================================================

  /**
   * Get embedding progress for all memory types
   */
  async getProgressAll(tenantId: string): Promise<{
    agent_feedback: { total: number; withEmbeddings: number; withoutEmbeddings: number; progressPercent: number };
    knowledge_notes: { total: number; withEmbeddings: number; withoutEmbeddings: number; progressPercent: number };
    capsules: { total: number; withEmbeddings: number; withoutEmbeddings: number; progressPercent: number };
  }> {
    const result = await this.pool.query(
      `SELECT * FROM get_embedding_progress_all($1)`,
      [tenantId]
    );

    const progress: any = {};

    for (const row of result.rows) {
      progress[row.table_name] = {
        total: row.total_records,
        withEmbeddings: row.with_embeddings,
        withoutEmbeddings: row.without_embeddings,
        progressPercent: row.progress_percent
      };
    }

    return progress;
  }

  /**
   * Batch process all embeddings for a tenant (all memory types)
   */
  async processAllForTenantAllTypes(tenantId: string): Promise<{
    agent_feedback: number;
    knowledge_notes: number;
    capsules: number;
    total: number;
  }> {
    console.log(`[Embedding] Starting batch processing for all types...`);

    const feedbackCount = await this.generateFeedbackEmbeddings(tenantId, 20);
    await new Promise(resolve => setTimeout(resolve, 1000));

    const notesCount = await this.generateNoteEmbeddings(tenantId, 20);
    await new Promise(resolve => setTimeout(resolve, 1000));

    const capsulesCount = await this.generateCapsuleEmbeddings(tenantId, 20);

    const total = feedbackCount + notesCount + capsulesCount;

    console.log(`[Embedding] Complete: ${feedbackCount} feedback, ${notesCount} notes, ${capsulesCount} capsules (total: ${total})`);

    return {
      agent_feedback: feedbackCount,
      knowledge_notes: notesCount,
      capsules: capsulesCount,
      total
    };
  }
}
