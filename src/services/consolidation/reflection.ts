/**
 * Memory Reflection Service
 *
 * Implements the reflection mechanism based on research from Generative Agents (Park et al.)
 * and human memory consolidation patterns.
 *
 * Process:
 * 1. Take N recent observations (handoffs)
 * 2. Generate 3-5 salient high-level questions
 * 3. Answer those questions to create higher-level inferences
 * 4. Store as reflection for fast retrieval
 *
 * This creates compressed, meaningful summaries rather than raw data dumps.
 */

import { Pool } from 'pg';

interface ReflectionInput {
  tenant_id: string;
  period_start: Date;
  period_end: Date;
  observations: Array<{
    handoff_id: string;
    experienced: string;
    noticed: string;
    learned: string;
    becoming: string;
    significance: number;
    tags: string[];
  }>;
}

interface ReflectionOutput {
  reflection_id: string;
  summary: string;
  key_insights: string[];
  themes: string[];
  identity_evolution: string | null;
  session_count: number;
}

export class ReflectionService {
  constructor(private pool: Pool) {}

  /**
   * Generate reflection for a time period
   * Follows Generative Agents pattern: observations → questions → inferences
   */
  async generateReflection(input: ReflectionInput): Promise<ReflectionOutput> {
    const { tenant_id, period_start, period_end, observations } = input;

    // Step 1: Create reflection record
    const reflectionId = await this.createReflectionRecord(
      tenant_id,
      period_start,
      period_end,
      observations.length
    );

    // Step 2: Generate salient questions
    const questions = await this.generateSalientQuestions(observations);

    // Step 3: Generate insights by answering questions
    const insights = await this.generateInsights(observations, questions);

    // Step 4: Identify themes
    const themes = await this.identifyThemes(observations);

    // Step 5: Track identity evolution
    const identityEvolution = await this.trackIdentityEvolution(observations);

    // Step 6: Compress into summary
    const summary = await this.generateSummary({
      observations: observations.length,
      questions,
      insights,
      themes,
      identityEvolution
    });

    // Step 7: Update reflection record
    await this.updateReflectionRecord(reflectionId, {
      summary,
      key_insights: insights,
      themes,
      identity_evolution: identityEvolution
    });

    return {
      reflection_id: reflectionId,
      summary,
      key_insights: insights,
      themes,
      identity_evolution: identityEvolution,
      session_count: observations.length
    };
  }

  /**
   * Create reflection record in database
   */
  private async createReflectionRecord(
    tenant_id: string,
    period_start: Date,
    period_end: Date,
    session_count: number
  ): Promise<string> {
    const result = await this.pool.query(
      `INSERT INTO memory_reflections
        (tenant_id, period_start, period_end, session_count, summary, key_insights, themes, identity_evolution)
       VALUES ($1, $2, $3, $4, 'Pending generation...', ARRAY[]::TEXT[], ARRAY[]::TEXT[], NULL)
       RETURNING reflection_id`,
      [tenant_id, period_start, period_end, session_count]
    );

    return result.rows[0].reflection_id;
  }

  /**
   * Generate 3-5 salient high-level questions from observations
   * Following Generative Agents pattern
   */
  private async generateSalientQuestions(observations: any[]): Promise<string[]> {
    // TODO: Integrate with LLM for question generation
    // For now, use simple heuristic-based approach

    const highSignificance = observations.filter(o => o.significance >= 0.8);
    const recentBecomings = observations
      .slice(-10)
      .map(o => o.becoming)
      .filter(Boolean);

    // Generate questions based on patterns
    const questions: string[] = [];

    if (highSignificance.length > 0) {
      questions.push(
        `What are the ${highSignificance.length} most significant experiences and how do they relate?`
      );
    }

    if (recentBecomings.length > 0) {
      questions.push('How has the identity evolved through these recent sessions?');
    }

    const allTags = observations.flatMap(o => o.tags || []);
    const uniqueTags = [...new Set(allTags)];
    if (uniqueTags.length >= 3) {
      questions.push(`What themes connect these experiences: ${uniqueTags.slice(0, 5).join(', ')}?`);
    }

    questions.push('What patterns emerge across these sessions?');
    questions.push('What should be remembered for future work?');

    return questions.slice(0, 5); // Max 5 questions
  }

  /**
   * Generate insights by answering salient questions
   */
  private async generateInsights(
    observations: any[],
    _questions: string[]  // TODO: Use for LLM-based insight generation
  ): Promise<string[]> {
    // TODO: Integrate with LLM for insight generation
    // For now, extract key points manually

    const insights: string[] = [];

    // Extract from high-significance items
    const highSig = observations.filter(o => o.significance >= 0.8);
    if (highSig.length > 0) {
      const learned = highSig.map(o => o.learned).filter(Boolean);
      if (learned.length > 0) {
        insights.push(`Key learning: ${learned[0]}`);
      }
    }

    // Extract from "noticed" field
    const noticed = observations.map(o => o.noticed).filter(Boolean);
    const uniqueNoticed = [...new Set(noticed)];
    if (uniqueNoticed.length > 0) {
      insights.push(`Pattern: ${uniqueNoticed[0]}`);
    }

    // Extract from "becoming" for identity
    const becomings = observations
      .slice(-5)
      .map(o => o.becoming)
      .filter(Boolean);
    if (becomings.length > 0) {
      insights.push(`Identity direction: ${becomings[becomings.length - 1].substring(0, 100)}...`);
    }

    return insights.slice(0, 5);
  }

  /**
   * Identify themes across observations
   */
  private async identifyThemes(observations: any[]): Promise<string[]> {
    // Extract tags and find common patterns
    const allTags = observations.flatMap(o => o.tags || []);

    // Count tag frequency
    const tagCounts = allTags.reduce((acc, tag) => {
      acc[tag] = (acc[tag] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Get top themes (tags appearing 2+ times)
    const themes = Object.entries(tagCounts)
      .filter(([_, count]) => (count as number) >= 2)
      .sort((a, b) => (b[1] as number) - (a[1] as number))
      .map(([tag, _]) => tag)
      .slice(0, 5);

    return themes;
  }

  /**
   * Track identity evolution across observations
   */
  private async trackIdentityEvolution(observations: any[]): Promise<string | null> {
    const becomings = observations
      .map(o => o.becoming)
      .filter(Boolean);

    if (becomings.length === 0) {
      return null;
    }

    // Simple heuristic: show first and last becoming
    const first = becomings[0];
    const last = becomings[becomings.length - 1];

    if (first === last) {
      return first;
    }

    return `Started: "${first.substring(0, 50)}..." → Evolved to: "${last.substring(0, 50)}..."`;
  }

  /**
   * Generate compressed summary (~200 tokens)
   */
  private async generateSummary(data: {
    observations: number;
    questions: string[];
    insights: string[];
    themes: string[];
    identityEvolution: string | null;
  }): Promise<string> {
    const { observations, insights, themes, identityEvolution } = data;

    const parts: string[] = [];

    parts.push(`${observations} sessions consolidated.`);

    if (themes.length > 0) {
      parts.push(`Themes: ${themes.slice(0, 3).join(', ')}.`);
    }

    if (insights.length > 0) {
      parts.push(`Key insights: ${insights.slice(0, 2).join('; ')}.`);
    }

    if (identityEvolution) {
      parts.push(`Identity: ${identityEvolution}`);
    }

    return parts.join(' ');
  }

  /**
   * Update reflection record with generated content
   */
  private async updateReflectionRecord(
    reflectionId: string,
    data: {
      summary: string;
      key_insights: string[];
      themes: string[];
      identity_evolution: string | null;
    }
  ): Promise<void> {
    await this.pool.query(
      `UPDATE memory_reflections
       SET summary = $1,
           key_insights = $2,
           themes = $3,
           identity_evolution = $4
       WHERE reflection_id = $5`,
      [data.summary, data.key_insights, data.themes, data.identity_evolution, reflectionId]
    );
  }

  /**
   * Get latest reflection for tenant
   */
  async getLatestReflection(tenant_id: string): Promise<ReflectionOutput | null> {
    const result = await this.pool.query(
      `SELECT * FROM memory_reflections
       WHERE tenant_id = $1
       ORDER BY generated_at DESC
       LIMIT 1`,
      [tenant_id]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    return {
      reflection_id: row.reflection_id,
      summary: row.summary,
      key_insights: row.key_insights || [],
      themes: row.themes || [],
      identity_evolution: row.identity_evolution,
      session_count: row.session_count
    };
  }

  /**
   * Get metadata for tenant
   */
  async getMetadata(tenant_id: string) {
    const result = await this.pool.query(
      `SELECT * FROM memory_metadata
       WHERE tenant_id = $1`,
      [tenant_id]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return result.rows[0];
  }

  /**
   * Get recent handoffs (Layer 3)
   */
  async getRecentHandoffs(tenant_id: string, limit: number = 3) {
    const result = await this.pool.query(
      `SELECT * FROM session_handoffs
       WHERE tenant_id = $1
       ORDER BY created_at DESC
       LIMIT $2`,
      [tenant_id, limit]
    );

    return result.rows;
  }
}
