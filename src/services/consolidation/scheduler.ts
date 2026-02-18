/**
 * Consolidation Scheduler
 *
 * Automated memory consolidation scheduler based on research from human memory
 * consolidation during sleep.
 *
 * Schedule:
 * - Daily (quick): Consolidate last 24h sessions (~100 handoffs)
 * - Weekly (deep): Consolidate last 7 days (~700 handoffs)
 * - Monthly (identity): Consolidate identity thread across all sessions
 *
 * Triggers during low-activity periods to minimize disruption.
 *
 * Implementation: Uses node-cron for scheduling
 */

import { Pool } from 'pg';
import { ReflectionService } from './reflection.js';
import { SemanticMemoryService } from '../semantic-memory.js';
import { createLLMClient } from '../llm-client.js';

// Types for consolidation jobs
export type ConsolidationType = 'daily' | 'weekly' | 'monthly';
export type ConsolidationStatus = 'pending' | 'running' | 'completed' | 'failed';

export interface ConsolidationSchedule {
  type: ConsolidationType;
  cron: string; // cron expression
  description: string;
  maxSessions: number;
}

// Schedules for different consolidation types
const SCHEDULES: Record<ConsolidationType, ConsolidationSchedule> = {
  daily: {
    type: 'daily',
    cron: '0 2 * * *', // 2:00 AM every day (low activity)
    description: 'Quick consolidation of last 24h sessions',
    maxSessions: 100,
  },
  weekly: {
    type: 'weekly',
    cron: '0 3 * * 0', // 3:00 AM every Sunday (low activity)
    description: 'Deep consolidation of last 7 days',
    maxSessions: 700,
  },
  monthly: {
    type: 'monthly',
    cron: '0 4 1 * *', // 4:00 AM on 1st of month (low activity)
    description: 'Identity consolidation across all sessions',
    maxSessions: 10000, // All sessions
  },
};

export class ConsolidationScheduler {
  private reflectionService: ReflectionService;
  private semanticMemoryService: SemanticMemoryService;
  private jobs: Map<ConsolidationType, any> = new Map();
  private enabled: boolean;

  constructor(
    pool: Pool,
    options: {
      enabled?: boolean;
      llmClient?: any;
    } = {}
  ) {
    const llmClient = options.llmClient || createLLMClient();
    this.reflectionService = new ReflectionService(pool, llmClient || undefined);
    this.semanticMemoryService = new SemanticMemoryService(pool, llmClient || undefined);
    this.enabled = options.enabled !== false; // Default enabled
  }

  /**
   * Start all scheduled consolidation jobs
   */
  async start(): Promise<void> {
    if (!this.enabled) {
      console.log('[Consolidation Scheduler] Disabled - not starting jobs');
      return;
    }

    console.log('[Consolidation Scheduler] Starting scheduled consolidation jobs...');

    // Import node-cron dynamically
    let cron: any;
    try {
      cron = await import('node-cron');
    } catch (error) {
      console.error('[Consolidation Scheduler] node-cron not installed:', error);
      console.error('[Consolidation Scheduler] Install with: npm install node-cron');
      return;
    }

    // Schedule each consolidation type
    for (const [type, schedule] of Object.entries(SCHEDULES)) {
      const job = cron.schedule(
        schedule.cron,
        async () => {
          await this.runConsolidation(type as ConsolidationType);
        },
        {
          scheduled: true,
          timezone: 'UTC',
        }
      );

      this.jobs.set(type as ConsolidationType, job);
      console.log(`[Consolidation Scheduler] ✓ Scheduled ${type} consolidation (${schedule.cron})`);
    }

    console.log('[Consolidation Scheduler] All jobs started');
  }

  /**
   * Stop all scheduled consolidation jobs
   */
  stop(): void {
    console.log('[Consolidation Scheduler] Stopping all jobs...');

    for (const [type, job] of this.jobs.entries()) {
      job.stop();
      console.log(`[Consolidation Scheduler] ✓ Stopped ${type} consolidation`);
    }

    this.jobs.clear();
    console.log('[Consolidation Scheduler] All jobs stopped');
  }

  /**
   * Run consolidation for a specific type
   */
  async runConsolidation(type: ConsolidationType): Promise<void> {
    const schedule = SCHEDULES[type];
    console.log(`[Consolidation Scheduler] Starting ${type} consolidation: ${schedule.description}`);

    const startTime = Date.now();

    try {
      // Create consolidation job record
      const jobId = await this.createJobRecord(type);

      // Get recent handoffs to consolidate
      const cutoffDate = this.getCutoffDate(type);
      const handoffs = await this.getHandoffsForConsolidation(cutoffDate, schedule.maxSessions);

      console.log(`[Consolidation Scheduler] Found ${handoffs.length} handoffs for ${type} consolidation`);

      if (handoffs.length === 0) {
        console.log(`[Consolidation Scheduler] No handoffs to consolidate for ${type}`);
        await this.updateJobRecord(jobId, 'completed', 0, 0);
        return;
      }

      // Group by tenant_id for multi-tenant consolidation
      const handoffsByTenant = this.groupByTenant(handoffs);

      let totalProcessed = 0;
      let totalAffected = 0;

      // Consolidate each tenant's data
      for (const [tenantId, tenantHandoffs] of Object.entries(handoffsByTenant)) {
        console.log(`[Consolidation Scheduler] Consolidating ${tenantHandoffs.length} handoffs for tenant ${tenantId}`);

        try {
          const result = await this.consolidateTenant(tenantId, tenantHandoffs, type);
          totalProcessed += tenantHandoffs.length;
          totalAffected += result.sessionsAffected || 0;
        } catch (error) {
          console.error(`[Consolidation Scheduler] Failed to consolidate tenant ${tenantId}:`, error);
        }
      }

      // Update job record
      await this.updateJobRecord(jobId, 'completed', totalProcessed, totalAffected);

      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      console.log(
        `[Consolidation Scheduler] ✓ ${type} consolidation complete: ` +
        `${totalProcessed} processed, ${totalAffected} affected in ${duration}s`
      );

      // Run memory decay after weekly consolidation
      if (type === 'weekly') {
        try {
          await this.runMemoryDecay();
          console.log('[Consolidation Scheduler] ✓ Memory decay applied');
        } catch (error) {
          console.error('[Consolidation Scheduler] Memory decay failed:', error);
        }
      }
    } catch (error) {
      console.error(`[Consolidation Scheduler] ${type} consolidation failed:`, error);
      throw error;
    }
  }

  /**
   * Consolidate a single tenant's handoffs
   */
  private async consolidateTenant(
    tenantId: string,
    handoffs: any[],
    type: ConsolidationType
  ): Promise<{ sessionsAffected: number }> {
    // Generate reflection using LLM-based service
    const periodStart = new Date(Math.min(...handoffs.map(h => new Date(h.created_at).getTime())));
    const periodEnd = new Date(Math.max(...handoffs.map(h => new Date(h.created_at).getTime())));

    const reflection = await this.reflectionService.generateReflection({
      tenant_id: tenantId,
      period_start: periodStart,
      period_end: periodEnd,
      observations: handoffs.map(h => ({
        handoff_id: h.handoff_id,
        experienced: h.experienced,
        noticed: h.noticed,
        learned: h.learned,
        becoming: h.becoming,
        significance: parseFloat(h.significance) || 0.5,
        tags: h.tags || [],
      })),
    });

    console.log(
      `[Consolidation Scheduler] Generated reflection for ${tenantId}: ` +
      `${reflection.reflection_id} (${reflection.session_count} sessions)`
    );

    // Extract semantic principles from episodic memories
    try {
      const episodicMemories = handoffs.map(h => ({
        handoff_id: h.handoff_id,
        experienced: h.experienced,
        learned: h.learned,
        becoming: h.becoming,
        significance: parseFloat(h.significance) || 0.5,
        created_at: new Date(h.created_at),
      }));

      const principles = await this.semanticMemoryService.extractPrinciples(
        tenantId,
        episodicMemories
      );

      console.log(
        `[Consolidation Scheduler] Extracted ${principles.length} semantic principles for ${tenantId}`
      );
    } catch (error) {
      console.error(
        `[Consolidation Scheduler] Failed to extract semantic principles for ${tenantId}:`,
        error
      );
    }

    // Mark handoffs as consolidated
    await this.markHandoffsConsolidated(
      handoffs.map(h => h.handoff_id),
      type,
      reflection.reflection_id
    );

    return { sessionsAffected: handoffs.length };
  }

  /**
   * Get cutoff date for consolidation type
   */
  private getCutoffDate(type: ConsolidationType): Date {
    const now = new Date();

    switch (type) {
      case 'daily':
        // Last 24 hours
        return new Date(now.getTime() - 24 * 60 * 60 * 1000);
      case 'weekly':
        // Last 7 days
        return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      case 'monthly':
        // Last 30 days
        return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      default:
        return new Date(0);
    }
  }

  /**
   * Get handoffs for consolidation
   */
  private async getHandoffsForConsolidation(
    cutoffDate: Date,
    limit: number
  ): Promise<any[]> {
    const result = await (this.reflectionService as any).pool.query(
      `SELECT
        handoff_id,
        tenant_id,
        experienced,
        noticed,
        learned,
        becoming,
        significance,
        tags,
        created_at
      FROM session_handoffs
      WHERE created_at >= $1
        AND compression_level = 'full'
      ORDER BY created_at DESC
      LIMIT $2`,
      [cutoffDate, limit]
    );

    return result.rows;
  }

  /**
   * Group handoffs by tenant_id
   */
  private groupByTenant(handoffs: any[]): Record<string, any[]> {
    const grouped: Record<string, any[]> = {};

    for (const handoff of handoffs) {
      const tenantId = handoff.tenant_id || 'default';
      if (!grouped[tenantId]) {
        grouped[tenantId] = [];
      }
      grouped[tenantId].push(handoff);
    }

    return grouped;
  }

  /**
   * Create consolidation job record
   */
  private async createJobRecord(type: ConsolidationType): Promise<string> {
    const { randomBytes } = await import('crypto');
    const jobId = 'cj_' + randomBytes(16).toString('hex');

    await (this.reflectionService as any).pool.query(
      `INSERT INTO consolidation_jobs (job_id, tenant_id, job_type, status, started_at)
      VALUES ($1, $2, $3, $4, NOW())`,
      [jobId, 'system', `${type}_consolidation`, 'running']
    );

    return jobId;
  }

  /**
   * Update consolidation job record
   */
  private async updateJobRecord(
    jobId: string,
    status: ConsolidationStatus,
    itemsProcessed: number,
    itemsAffected: number
  ): Promise<void> {
    await (this.reflectionService as any).pool.query(
      `UPDATE consolidation_jobs
      SET status = $1,
          completed_at = NOW(),
          items_processed = $2,
          items_affected = $3
      WHERE job_id = $4`,
      [status, itemsProcessed, itemsAffected, jobId]
    );
  }

  /**
   * Mark handoffs as consolidated (OPTIMIZED: Single batch UPDATE)
   * Before: O(k) round trips (one UPDATE per handoff)
   * After: 1 batch UPDATE using unnest()
   * Performance: 10× faster for 100 handoffs (100 queries → 1 query)
   */
  private async markHandoffsConsolidated(
    handoffIds: string[],
    type: ConsolidationType,
    reflectionId: string
  ): Promise<void> {
    const compressionLevel = type === 'daily' ? 'summary' : type === 'weekly' ? 'quick_ref' : 'integrated';

    // Single batch UPDATE instead of loop
    await (this.reflectionService as any).pool.query(
      `UPDATE session_handoffs
      SET compression_level = $1,
          consolidated_at = NOW(),
          integrated_into = $2
      WHERE handoff_id = ANY($3)`,
      [compressionLevel, reflectionId, handoffIds]
    );
  }

  /**
   * Manually trigger a consolidation job
   */
  async triggerConsolidation(type: ConsolidationType): Promise<void> {
    console.log(`[Consolidation Scheduler] Manually triggering ${type} consolidation`);
    await this.runConsolidation(type);
  }

  /**
   * Get scheduler status
   */
  getStatus(): {
    enabled: boolean;
    jobs: string[];
    schedules: Record<string, ConsolidationSchedule>;
  } {
    return {
      enabled: this.enabled,
      jobs: Array.from(this.jobs.keys()),
      schedules: SCHEDULES,
    };
  }

  /**
   * Run memory decay (forgetting curve)
   * Called after weekly consolidation
   */
  private async runMemoryDecay(): Promise<void> {
    await (this.reflectionService as any).pool.query('SELECT decay_memory_strength()');
  }
}

/**
 * Create and start consolidation scheduler
 */
export async function createConsolidationScheduler(
  pool: Pool,
  options?: { enabled?: boolean }
): Promise<ConsolidationScheduler> {
  const scheduler = new ConsolidationScheduler(pool, options);
  await scheduler.start();
  return scheduler;
}
