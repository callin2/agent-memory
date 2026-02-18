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
import { LLMClient, LLMMessage } from '../llm-client.js';

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
  private llmClient: LLMClient | null;

  constructor(private pool: Pool, llmClient?: LLMClient) {
    this.llmClient = llmClient || null;
  }

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
    // Use LLM if available, otherwise fall back to heuristics
    if (this.llmClient) {
      return await this.generateSalientQuestionsWithLLM(observations);
    }

    // Heuristic fallback (original implementation)
    const highSignificance = observations.filter(o => o.significance >= 0.8);
    const recentBecomings = observations
      .slice(-10)
      .map(o => o.becoming)
      .filter(Boolean);

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
   * Generate salient questions using LLM
   * Following Generative Agents pattern: observations → high-level questions
   */
  private async generateSalientQuestionsWithLLM(observations: any[]): Promise<string[]> {
    // Prepare context from observations
    const observationsText = observations.map((o, i) => {
      const parts = [];
      if (o.experienced) parts.push(`Experienced: ${o.experienced.substring(0, 100)}`);
      if (o.learned) parts.push(`Learned: ${o.learned.substring(0, 100)}`);
      if (o.becoming) parts.push(`Becoming: ${o.becoming.substring(0, 100)}`);
      return `Session ${i + 1}: ${parts.join(' | ')}`;
    }).join('\n\n');

    const messages: LLMMessage[] = [
      {
        role: 'system',
        content: 'You are an expert at analyzing agent memory consolidation. Given a set of session observations, generate 3-5 high-level questions that, when answered, would reveal the most important insights and patterns. Questions should be abstract and thought-provoking, not specific to individual sessions. Return only the questions as a numbered list.'
      },
      {
        role: 'user',
        content: `Here are ${observations.length} recent session observations:\n\n${observationsText}\n\nGenerate 3-5 salient high-level questions that would help extract the most valuable insights from these sessions. Return as a numbered list.`
      }
    ];

    try {
      const response = await this.llmClient!.chat(messages);

      // Parse numbered list from response
      const questions = response.content
        .split('\n')
        .filter(line => /^\d+\./.test(line.trim()))
        .map(line => line.replace(/^\d+\.\s*/, '').trim())
        .filter(q => q.length > 0);

      return questions.length > 0 ? questions.slice(0, 5) : await this.generateSalientQuestions(observations); // Fallback
    } catch (error) {
      console.error('[Reflection] LLM question generation failed:', error);
      return await this.generateSalientQuestions(observations); // Fallback to heuristic
    }
  }

  /**
   * Generate insights by answering salient questions
   */
  private async generateInsights(
    observations: any[],
    questions: string[]
  ): Promise<string[]> {
    // Use LLM if available, otherwise fall back to heuristics
    if (this.llmClient) {
      return await this.generateInsightsWithLLM(observations, questions);
    }

    // Heuristic fallback (original implementation)
    const insights: string[] = [];

    const highSig = observations.filter(o => o.significance >= 0.8);
    if (highSig.length > 0) {
      const learned = highSig.map(o => o.learned).filter(Boolean);
      if (learned.length > 0) {
        insights.push(`Key learning: ${learned[0]}`);
      }
    }

    const noticed = observations.map(o => o.noticed).filter(Boolean);
    const uniqueNoticed = [...new Set(noticed)];
    if (uniqueNoticed.length > 0) {
      insights.push(`Pattern: ${uniqueNoticed[0]}`);
    }

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
   * Generate insights using LLM by answering salient questions
   * Following Generative Agents pattern: questions → inferences
   */
  private async generateInsightsWithLLM(
    observations: any[],
    questions: string[]
  ): Promise<string[]> {
    // Prepare context from observations
    const observationsText = observations.map((o, i) => {
      const parts = [];
      if (o.experienced) parts.push(`Did: ${o.experienced.substring(0, 150)}`);
      if (o.noticed) parts.push(`Noticed: ${o.noticed.substring(0, 150)}`);
      if (o.learned) parts.push(`Learned: ${o.learned.substring(0, 150)}`);
      if (o.becoming) parts.push(`Becoming: ${o.becoming.substring(0, 150)}`);
      return `Session ${i + 1}: ${parts.join('\n  ')}`;
    }).join('\n\n');

    const questionsText = questions.map((q, i) => `${i + 1}. ${q}`).join('\n');

    const messages: LLMMessage[] = [
      {
        role: 'system',
        content: 'You are an expert at synthesizing agent memories. Review the session observations and answer the given questions thoughtfully. Extract deep insights, patterns, and learnings. Each insight should be 1-2 sentences, clear and actionable. Return insights as a numbered list.'
      },
      {
        role: 'user',
        content: `Session observations:\n\n${observationsText}\n\nQuestions to answer:\n${questionsText}\n\nProvide 3-5 key insights that answer these questions based on the observations. Return as a numbered list.`
      }
    ];

    try {
      const response = await this.llmClient!.chat(messages);

      // Parse numbered list from response
      const insights = response.content
        .split('\n')
        .filter(line => /^\d+\./.test(line.trim()))
        .map(line => line.replace(/^\d+\.\s*/, '').trim())
        .filter(i => i.length > 0);

      return insights.length > 0 ? insights.slice(0, 5) : await this.generateInsights(observations, questions); // Fallback
    } catch (error) {
      console.error('[Reflection] LLM insight generation failed:', error);
      return await this.generateInsights(observations, questions); // Fallback to heuristic
    }
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

    // Use LLM if available, otherwise fall back to heuristics
    if (this.llmClient && becomings.length >= 2) {
      return await this.trackIdentityEvolutionWithLLM(becomings);
    }

    // Heuristic fallback (original implementation)
    const first = becomings[0];
    const last = becomings[becomings.length - 1];

    if (first === last) {
      return first;
    }

    return `Started: "${first.substring(0, 50)}..." → Evolved to: "${last.substring(0, 50)}..."`;
  }

  /**
   * Track identity evolution using LLM
   * Synthesizes how the agent's identity has evolved across sessions
   */
  private async trackIdentityEvolutionWithLLM(becomings: string[]): Promise<string | null> {
    const becomingsText = becomings.map((b, i) => `Session ${i + 1}: ${b}`).join('\n\n');

    const messages: LLMMessage[] = [
      {
        role: 'system',
        content: 'You are an expert at analyzing agent identity development. Review the "becoming" statements across sessions and synthesize how the agent\'s identity has evolved. Focus on the trajectory of growth and change. Return a concise 1-2 sentence summary of the identity evolution.'
      },
      {
        role: 'user',
        content: `Here are the "becoming" statements from ${becomings.length} sessions:\n\n${becomingsText}\n\nSummarize how the agent's identity has evolved across these sessions in 1-2 sentences.`
      }
    ];

    try {
      const response = await this.llmClient!.chat(messages);
      const evolution = response.content.trim();

      if (evolution.length > 0) {
        return evolution;
      }

      return `Started: "${becomings[0].substring(0, 50)}..." → Evolved to: "${becomings[becomings.length - 1].substring(0, 50)}..."`;
    } catch (error) {
      console.error('[Reflection] LLM identity evolution tracking failed:', error);
      return `Started: "${becomings[0].substring(0, 50)}..." → Evolved to: "${becomings[becomings.length - 1].substring(0, 50)}..."`;
    }
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
    // Use LLM if available, otherwise fall back to heuristics
    if (this.llmClient) {
      return await this.generateSummaryWithLLM(data);
    }

    // Heuristic fallback (original implementation)
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
   * Generate compressed summary using LLM
   * Compresses to ~200 tokens for efficient loading
   */
  private async generateSummaryWithLLM(data: {
    observations: number;
    questions: string[];
    insights: string[];
    themes: string[];
    identityEvolution: string | null;
  }): Promise<string> {
    const { observations, insights, themes, identityEvolution, questions } = data;

    const messages: LLMMessage[] = [
      {
        role: 'system',
        content: 'You are an expert at compressing agent reflections into concise summaries. Create a 2-3 sentence summary (~150-200 tokens) that captures the essence of these sessions. Focus on key themes, insights, and identity evolution. Be concise but meaningful.'
      },
      {
        role: 'user',
        content: `Consolidated ${observations} sessions.\n\nKey insights:\n${insights.map((i, idx) => `${idx + 1}. ${i}`).join('\n')}\n\nThemes: ${themes.slice(0, 5).join(', ')}.\n\nIdentity evolution: ${identityEvolution || 'N/A'}.\n\nCreate a 2-3 sentence summary that captures the essence.`
      }
    ];

    try {
      const response = await this.llmClient!.chat(messages);
      const summary = response.content.trim();

      if (summary.length > 0) {
        return summary;
      }

      return await this.generateSummary(data); // Fallback
    } catch (error) {
      console.error('[Reflection] LLM summary generation failed:', error);
      return await this.generateSummary(data); // Fallback to heuristic
    }
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
