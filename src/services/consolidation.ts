/**
 * Sleep-Based Consolidation Service
 *
 * Inspired by human memory consolidation during sleep, this service:
 * 1. Strengthens important patterns (identity thread consolidation)
 * 2. Compresses experiences over time (handoff compression)
 * 3. Archives old decisions (active vs archived)
 * 4. Organizes chunks into hierarchies (atomic → episodes → themes)
 *
 * Consolidation schedule:
 * - Daily: Light consolidation (recent sessions)
 * - Weekly: Medium consolidation (identity thread, decisions)
 * - Monthly: Deep consolidation (old sessions, chunk reorganization)
 */

import { Pool } from "pg";

interface ConsolidationConfig {
  /** Days after which to create handoff summaries */
  summary_threshold_days: number;
  /** Days after which to create quick refs */
  quick_ref_threshold_days: number;
  /** Days after which to integrate into principles */
  integration_threshold_days: number;
  /** Days after which to archive decisions */
  decision_archive_threshold_days: number;
  /** Minimum number of becoming statements before consolidation */
  identity_consolidation_min_count: number;
}

const DEFAULT_CONFIG: ConsolidationConfig = {
  summary_threshold_days: 30,
  quick_ref_threshold_days: 90,
  integration_threshold_days: 180,
  decision_archive_threshold_days: 60,
  identity_consolidation_min_count: 10,
};

interface ConsolidationResult {
  job_type: string;
  items_processed: number;
  items_affected: number;
  tokens_saved: number;
  details: any;
}

export class ConsolidationService {
  constructor(
    private pool: Pool,
    private config: ConsolidationConfig = DEFAULT_CONFIG
  ) {}

  /**
   * Run all consolidation jobs for a tenant
   */
  async consolidateAll(tenant_id: string = "default"): Promise<ConsolidationResult[]> {
    const results: ConsolidationResult[] = [];

    // Run each consolidation type
    results.push(await this.consolidateIdentityThread(tenant_id));
    results.push(await this.compressHandoffs(tenant_id));
    results.push(await this.archiveDecisions(tenant_id));

    return results;
  }

  /**
   * 1. Identity Thread Consolidation
   *
   * Merge similar "becoming" statements to prevent linear growth
   * Extract core principles from recurring themes
   */
  async consolidateIdentityThread(tenant_id: string): Promise<ConsolidationResult> {
    const job_id = await this.createJob(tenant_id, "identity_consolidation");

    try {
      // Get all becoming statements
      const result = await this.pool.query(
        `SELECT becoming, created_at, COUNT(*) as frequency
         FROM session_handoffs
         WHERE tenant_id = $1
           AND becoming IS NOT NULL
         GROUP BY becoming, created_at
         ORDER BY created_at ASC`,
        [tenant_id]
      );

      const statements = result.rows;
      let itemsAffected = 0;
      let tokensSaved = 0;

      // Extract recurring themes (simple approach: similar statements)
      const themes = this.extractThemes(statements);

      // Mark similar statements for potential consolidation
      for (const theme of themes) {
        if (theme.count >= this.config.identity_consolidation_min_count) {
          // Create consolidated principle
          await this.pool.query(
            `INSERT INTO decisions (decision_id, tenant_id, status, scope, decision, rationale)
             VALUES ($1, $2, 'active', 'global', $3, $4)
             ON CONFLICT (decision_id) DO UPDATE SET
               rationale = decisions.rationale || EXCLUDED.rationale`,
            [
              `dp_${theme.theme.substring(0, 20).replace(/\s/g, "_")}_${Date.now()}`,
              tenant_id,
              theme.principle,
              theme.statements, // Array of original becoming statements
            ]
          );

          itemsAffected += theme.count;
          tokensSaved += (theme.count - 1) * 50; // Each becoming ~50 tokens
        }
      }

      await this.completeJob(job_id, itemsAffected, itemsAffected);

      return {
        job_type: "identity_consolidation",
        items_processed: statements.length,
        items_affected: itemsAffected,
        tokens_saved: tokensSaved,
        details: { themes_found: themes.length },
      };
    } catch (error) {
      await this.failJob(job_id, error instanceof Error ? error.message : String(error));
      throw error;
    }
  }

  /**
   * 2. Handoff Compression
   *
   * Progressive compression:
   * - Fresh (0-30 days): Full detail
   * - Summary (30-90 days): ~500 tokens
   * - Quick Ref (90-180 days): ~100 tokens
   * - Integrated (180+ days): Merged into principles
   */
  async compressHandoffs(tenant_id: string): Promise<ConsolidationResult> {
    const job_id = await this.createJob(tenant_id, "handoff_compression");

    try {
      let itemsProcessed = 0;
      let itemsAffected = 0;
      let tokensSaved = 0;

      // Create summaries for sessions older than threshold
      const summaryResult = await this.pool.query(
        `SELECT handoff_id, experienced, noticed, learned, story, becoming, remember,
           EXTRACT(DAY FROM NOW() - created_at) as days_old
         FROM session_handoffs
         WHERE tenant_id = $1
           AND compression_level = 'full'
           AND EXTRACT(DAY FROM NOW() - created_at) > $2
         ORDER BY created_at ASC`,
        [tenant_id, this.config.summary_threshold_days]
      );

      for (const row of summaryResult.rows) {
        const summary = this.createSummary(row);
        const quickRef = this.createQuickRef(row);

        // Update with compressed versions
        const daysOld = parseInt(row.days_old);
        let compressionLevel = "full";

        if (daysOld > this.config.integration_threshold_days) {
          compressionLevel = "integrated";
        } else if (daysOld > this.config.quick_ref_threshold_days) {
          compressionLevel = "quick_ref";
        } else if (daysOld > this.config.summary_threshold_days) {
          compressionLevel = "summary";
        }

        await this.pool.query(
          `UPDATE session_handoffs
           SET summary = $1,
               quick_ref = $2,
               compression_level = $3,
               consolidated_at = NOW()
           WHERE handoff_id = $4`,
          [summary, quickRef, compressionLevel, row.handoff_id]
        );

        itemsProcessed++;
        itemsAffected++;
        tokensSaved += 1500; // Full handoff ~2000 tokens → summary ~500 tokens
      }

      await this.completeJob(job_id, itemsProcessed, itemsAffected);

      return {
        job_type: "handoff_compression",
        items_processed: itemsProcessed,
        items_affected: itemsAffected,
        tokens_saved: tokensSaved,
        details: {
          summary_threshold: this.config.summary_threshold_days,
          quick_ref_threshold: this.config.quick_ref_threshold_days,
        },
      };
    } catch (error) {
      await this.failJob(job_id, error instanceof Error ? error.message : String(error));
      throw error;
    }
  }

  /**
   * 3. Decision Archival
   *
   * Archive old decisions to keep only active ones in memory
   */
  async archiveDecisions(tenant_id: string): Promise<ConsolidationResult> {
    const job_id = await this.createJob(tenant_id, "decision_archival");

    try {
      // Find decisions older than threshold that are still active
      const result = await this.pool.query(
        `UPDATE decisions
         SET status = 'superseded'
         WHERE tenant_id = $1
           AND status = 'active'
           AND EXTRACT(DAY FROM NOW() - ts) > $2
         RETURNING decision_id, decision`,
        [tenant_id, this.config.decision_archive_threshold_days]
      );

      const itemsProcessed = result.rowCount || 0;
      const tokensSaved = itemsProcessed * 200; // Each decision ~200 tokens

      await this.completeJob(job_id, itemsProcessed, itemsProcessed);

      return {
        job_type: "decision_archival",
        items_processed: itemsProcessed,
        items_affected: itemsProcessed,
        tokens_saved: tokensSaved,
        details: {
          archive_threshold_days: this.config.decision_archive_threshold_days,
          archived_decisions: result.rows,
        },
      };
    } catch (error) {
      await this.failJob(job_id, error instanceof Error ? error.message : String(error));
      throw error;
    }
  }

  /**
   * Create a summary (~500 tokens) from full handoff
   */
  private createSummary(handoff: any): string {
    const parts = [];

    if (handoff.experienced) {
      parts.push(`Experienced: ${this.summarizeText(handoff.experienced, 150)}`);
    }
    if (handoff.noticed) {
      parts.push(`Noticed: ${this.summarizeText(handoff.noticed, 100)}`);
    }
    if (handoff.learned) {
      parts.push(`Learned: ${this.summarizeText(handoff.learned, 100)}`);
    }
    if (handoff.becoming) {
      parts.push(`Becoming: ${this.summarizeText(handoff.becoming, 80)}`);
    }
    if (handoff.remember) {
      parts.push(`Remember: ${this.summarizeText(handoff.remember, 70)}`);
    }

    return parts.join("\n");
  }

  /**
   * Create a quick reference (~100 tokens) from handoff
   */
  private createQuickRef(handoff: any): string {
    const date = new Date().toISOString().split("T")[0];
    const oneSentence = this.summarizeText(handoff.story || handoff.experienced || "", 80);

    return `[${date}] ${oneSentence}`;
  }

  /**
   * Truncate text to approximate token limit
   */
  private summarizeText(text: string, maxChars: number): string {
    if (text.length <= maxChars) return text;
    return text.substring(0, maxChars - 3) + "...";
  }

  /**
   * Extract recurring themes from becoming statements
   * Simple approach: group by keyword similarity
   */
  private extractThemes(statements: any[]): Array<{
    theme: string;
    principle: string;
    count: number;
    statements: string[];
  }> {
    // Simple keyword-based grouping
    const themes: Map<string, string[]> = new Map();

    for (const stmt of statements) {
      const becoming = stmt.becoming;
      const keywords = this.extractKeywords(becoming);

      for (const keyword of keywords) {
        if (!themes.has(keyword)) {
          themes.set(keyword, []);
        }
        themes.get(keyword)!.push(becoming);
      }
    }

    // Convert to array
    return Array.from(themes.entries()).map(([theme, statements]) => ({
      theme,
      principle: `Core principle: ${theme}`,
      count: statements.length,
      statements,
    }));
  }

  /**
   * Extract keywords from text
   */
  private extractKeywords(text: string): string[] {
    // Simple approach: extract significant words
    const words = text
      .toLowerCase()
      .replace(/[^\w\s]/g, "")
      .split(/\s+/)
      .filter((w) => w.length > 4); // Only significant words

    // Remove duplicates and return
    return Array.from(new Set(words));
  }

  /**
   * Create a consolidation job record
   */
  private async createJob(
    tenant_id: string,
    job_type: string
  ): Promise<string> {
    const { randomBytes } = await import("crypto");
    const job_id = "cj_" + randomBytes(16).toString("hex");

    await this.pool.query(
      `INSERT INTO consolidation_jobs (job_id, tenant_id, job_type, status)
       VALUES ($1, $2, $3, 'pending')`,
      [job_id, tenant_id, job_type]
    );

    return job_id;
  }

  /**
   * Mark job as completed
   */
  private async completeJob(
    job_id: string,
    items_processed: number,
    items_affected: number
  ): Promise<void> {
    await this.pool.query(
      `UPDATE consolidation_jobs
       SET status = 'completed',
           completed_at = NOW(),
           items_processed = $1,
           items_affected = $2
       WHERE job_id = $3`,
      [items_processed, items_affected, job_id]
    );
  }

  /**
   * Mark job as failed
   */
  private async failJob(job_id: string, error_message: string): Promise<void> {
    await this.pool.query(
      `UPDATE consolidation_jobs
       SET status = 'failed',
           completed_at = NOW(),
           error_message = $1
       WHERE job_id = $2`,
      [error_message, job_id]
    );
  }

  /**
   * Get consolidation statistics for a tenant
   */
  async getConsolidationStats(tenant_id: string = "default"): Promise<any> {
    const result = await this.pool.query(
      `SELECT
         stat_date,
         compression_type,
         before_count,
         after_count,
         tokens_saved,
         percentage_saved
       FROM consolidation_stats
       WHERE tenant_id = $1
       ORDER BY stat_date DESC, compression_type
       LIMIT 100`,
      [tenant_id]
    );

    return {
      tenant_id,
      stats: result.rows,
      total_tokens_saved: result.rows.reduce((sum, row) => sum + (row.tokens_saved || 0), 0),
    };
  }
}
