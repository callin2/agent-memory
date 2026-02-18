/**
 * Semantic Memory Service
 *
 * Manages timeless principles and generalized knowledge extracted from
 * episodic experiences. Based on cognitive science research (Tulving, 1972)
 * distinguishing episodic (what/when/where) from semantic (timeless) memory.
 *
 * Process:
 * 1. Collect episodic memories (session handoffs)
 * 2. Extract patterns and principles
 * 3. Calculate confidence (frequency × significance)
 * 4. Store in semantic_memory table
 * 5. Link back to source episodes
 */

import { Pool } from 'pg';
import { LLMClient, LLMMessage } from './llm-client.js';

export interface SemanticMemory {
  semantic_id: string;
  tenant_id: string;
  principle: string;
  context?: string;
  category?: string;
  confidence: number;
  source_handoff_ids: string[];
  source_count: number;
  tags: string[];
  created_at: Date;
  updated_at: Date;
  last_reinforced_at?: Date;
}

export interface EpisodicMemory {
  handoff_id: string;
  experienced: string;
  learned: string;
  becoming?: string;
  significance: number;
  created_at: Date;
}

export class SemanticMemoryService {
  private pool: Pool;
  private llmClient: LLMClient | null;

  constructor(pool: Pool, llmClient?: LLMClient) {
    this.pool = pool;
    this.llmClient = llmClient || null;
  }

  /**
   * Extract semantic principles from episodic memories
   * This is the core "episodic → semantic" transformation
   */
  async extractPrinciples(
    tenantId: string,
    episodicMemories: EpisodicMemory[]
  ): Promise<SemanticMemory[]> {
    if (episodicMemories.length === 0) {
      return [];
    }

    console.log(
      `[Semantic Memory] Extracting principles from ${episodicMemories.length} episodes`
    );

    // Use LLM to extract principles if available
    if (this.llmClient) {
      return await this.extractPrinciplesWithLLM(tenantId, episodicMemories);
    }

    // Fallback: Simple heuristic extraction
    return await this.extractPrinciplesHeuristic(tenantId, episodicMemories);
  }

  /**
   * Extract principles using LLM
   */
  private async extractPrinciplesWithLLM(
    tenantId: string,
    episodicMemories: EpisodicMemory[]
  ): Promise<SemanticMemory[]> {
    // Prepare episodic memories context
    const episodesText = episodicMemories.map((ep, i) => {
      const parts = [];
      if (ep.experienced) parts.push(`Did: ${ep.experienced.substring(0, 200)}`);
      if (ep.learned) parts.push(`Learned: ${ep.learned.substring(0, 200)}`);
      return `Episode ${i + 1}: ${parts.join('. ')}`;
    }).join('\n\n');

    const messages: LLMMessage[] = [
      {
        role: 'system',
        content: `You are an expert at extracting timeless principles from experiences.
Review the episodic memories and extract 3-5 generalized principles.

For each principle:
- Name it (2-6 words)
- Provide context (concrete example from episodes)
- Categorize it (coding, communication, problem-solving, ux-design, etc.)
- Estimate confidence (0.0-1.0) based on frequency and significance

Return as JSON array:
[
  {
    "principle": "TypeScript prevents bugs in large apps",
    "context": "Caught 3 compile-time bugs",
    "category": "coding",
    "confidence": 0.8
  }
]`
      },
      {
        role: 'user',
        content: `Here are ${episodicMemories.length} episodic memories:\n\n${episodesText}\n\nExtract 3-5 timeless principles. Return as JSON array.`
      }
    ];

    try {
      const response = await this.llmClient!.chat(messages);
      const principlesData = this.parseJSONResponse(response.content);

      if (!Array.isArray(principlesData)) {
        throw new Error('LLM did not return an array');
      }

      // Create semantic memories from extracted principles
      const semanticMemories: SemanticMemory[] = [];

      for (const principleData of principlesData) {
        // Check if similar principle already exists
        const existing = await this.findSimilarPrinciple(
          tenantId,
          principleData.principle
        );

        if (existing) {
          // Reinforce existing principle
          await this.reinforcePrinciple(
            existing.semantic_id,
            episodicMemories.map(e => e.handoff_id)
          );
          semanticMemories.push(existing);
        } else {
          // Create new principle
          const newPrinciple = await this.createPrinciple({
            tenant_id: tenantId,
            principle: principleData.principle,
            context: principleData.context,
            category: principleData.category || 'general',
            confidence: principleData.confidence || 0.5,
            source_handoff_ids: episodicMemories.map(e => e.handoff_id),
            tags: [],
          });
          semanticMemories.push(newPrinciple);
        }
      }

      console.log(
        `[Semantic Memory] Extracted ${semanticMemories.length} principles using LLM`
      );

      return semanticMemories;
    } catch (error) {
      console.error('[Semantic Memory] LLM extraction failed:', error);
      return await this.extractPrinciplesHeuristic(tenantId, episodicMemories);
    }
  }

  /**
   * Extract principles using heuristics (fallback)
   */
  private async extractPrinciplesHeuristic(
    tenantId: string,
    episodicMemories: EpisodicMemory[]
  ): Promise<SemanticMemory[]> {
    const principles: SemanticMemory[] = [];

    // Extract "learned" statements as principles
    for (const ep of episodicMemories) {
      if (ep.learned && ep.learned.length > 20) {
        // Check if similar principle exists
        const existing = await this.findSimilarPrinciple(tenantId, ep.learned);

        if (existing) {
          // Reinforce existing
          await this.reinforcePrinciple(existing.semantic_id, [ep.handoff_id]);
        } else {
          // Create new principle
          const principle = await this.createPrinciple({
            tenant_id: tenantId,
            principle: ep.learned.substring(0, 100),
            context: ep.experienced?.substring(0, 200),
            category: 'general',
            confidence: ep.significance || 0.5,
            source_handoff_ids: [ep.handoff_id],
            tags: [],
          });
          principles.push(principle);
        }
      }
    }

    console.log(
      `[Semantic Memory] Extracted ${principles.length} principles using heuristics`
    );

    return principles;
  }

  /**
   * Create a new semantic principle
   */
  async createPrinciple(data: {
    tenant_id: string;
    principle: string;
    context?: string;
    category?: string;
    confidence?: number;
    source_handoff_ids?: string[];
    tags?: string[];
  }): Promise<SemanticMemory> {
    const result = await this.pool.query(
      `INSERT INTO semantic_memory (
        tenant_id,
        principle,
        context,
        category,
        confidence,
        source_handoff_ids,
        source_count,
        tags
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *`,
      [
        data.tenant_id,
        data.principle,
        data.context || null,
        data.category || 'general',
        data.confidence || 0.5,
        data.source_handoff_ids || [],
        (data.source_handoff_ids || []).length,
        data.tags || [],
      ]
    );

    return result.rows[0];
  }

  /**
   * Find similar principle (for deduplication)
   */
  async findSimilarPrinciple(
    tenantId: string,
    principle: string
  ): Promise<SemanticMemory | null> {
    // Use full-text search to find similar principles
    const result = await this.pool.query(
      `SELECT *, ts_rank(
         to_tsvector('english', principle),
         plainto_tsquery('english', $1)
       ) as similarity
      FROM semantic_memory
      WHERE tenant_id = $2
        AND to_tsvector('english', principle) @@ plainto_tsquery('english', $1)
      ORDER BY similarity DESC
      LIMIT 1`,
      [principle, tenantId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    // Only return if similarity is high enough
    if (result.rows[0].similarity < 0.5) {
      return null;
    }

    return result.rows[0];
  }

  /**
   * Reinforce existing principle (increase confidence)
   */
  async reinforcePrinciple(
    semanticId: string,
    additionalHandoffIds: string[]
  ): Promise<void> {
    await this.pool.query(
      `UPDATE semantic_memory
      SET source_handoff_ids = array_cat(source_handoff_ids, $1),
          source_count = array_length(array_cat(source_handoff_ids, $1), 1),
          confidence = LEAST(1.0, confidence + 0.1),
          updated_at = NOW(),
          last_reinforced_at = NOW()
      WHERE semantic_id = $2`,
      [additionalHandoffIds, semanticId]
    );
  }

  /**
   * Get semantic memories for tenant
   */
  async getSemanticMemories(
    tenantId: string,
    options: {
      category?: string;
      minConfidence?: number;
      limit?: number;
    } = {}
  ): Promise<SemanticMemory[]> {
    const { category, minConfidence = 0.0, limit = 100 } = options;

    const result = await this.pool.query(
      `SELECT * FROM semantic_memory
      WHERE tenant_id = $1
        AND confidence >= $2
        AND ($3::text IS NULL OR category = $3)
      ORDER BY confidence DESC, created_at DESC
      LIMIT $4`,
      [tenantId, minConfidence, category || null, limit]
    );

    return result.rows;
  }

  /**
   * Get semantic memories as formatted text for wake_up
   */
  async getSemanticMemoryText(
    tenantId: string,
    limit: number = 10
  ): Promise<string> {
    const principles = await this.getSemanticMemories(tenantId, {
      minConfidence: 0.7,
      limit,
    });

    if (principles.length === 0) {
      return 'No semantic principles yet.';
    }

    const lines = [];
    lines.push(`Timeless Principles (${principles.length}):\n`);

    for (const p of principles) {
      const confidence = Math.round(p.confidence * 100);
      lines.push(`• ${p.principle} (${confidence}% confident)`);
      if (p.context) {
        lines.push(`  (${p.context})`);
      }
    }

    return lines.join('\n');
  }

  /**
   * Decay principle confidence (forgetting curve)
   * Should be called periodically to reduce confidence of unused principles
   */
  async decayPrinciples(tenantId: string): Promise<void> {
    const daysSinceReinforced = 30; // Decay after 30 days

    await this.pool.query(
      `UPDATE semantic_memory
      SET confidence = GREATEST(0.1, confidence * 0.9),
          updated_at = NOW()
      WHERE tenant_id = $1
        AND last_reinforced_at < NOW() - INTERVAL '${daysSinceReinforced} days'`,
      [tenantId]
    );

    console.log(
      `[Semantic Memory] Decayed old principles for tenant ${tenantId}`
    );
  }

  /**
   * Parse JSON from LLM response (handles markdown code blocks)
   */
  private parseJSONResponse(content: string): any {
    // Remove markdown code blocks if present
    let jsonStr = content.trim();
    if (jsonStr.startsWith('```')) {
      const lines = jsonStr.split('\n');
      lines.shift(); // Remove first line (```)
      lines.pop(); // Remove last line (```)
      jsonStr = lines.join('\n').trim();
    }

    try {
      return JSON.parse(jsonStr);
    } catch (error) {
      console.error('[Semantic Memory] Failed to parse JSON:', jsonStr);
      throw error;
    }
  }
}
