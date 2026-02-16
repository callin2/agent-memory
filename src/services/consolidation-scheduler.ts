/**
 * Consolidation Scheduler
 *
 * Runs consolidation jobs periodically:
 * - Daily: Light consolidation (compress handoffs older than 30 days)
 * - Weekly: Medium consolidation (identity thread, archive decisions)
 * - Monthly: Deep consolidation (integrate very old sessions)
 */

import { Pool } from "pg";
import { ConsolidationService } from "./consolidation";

export class ConsolidationScheduler {
  private consolidationService: ConsolidationService;
  private intervals: NodeJS.Timeout[] = [];

  constructor(private pool: Pool) {
    this.consolidationService = new ConsolidationService(pool);
  }

  /**
   * Start all consolidation schedules
   */
  start(tenant_id: string = "default"): void {
    console.log("[Consolidation] Starting consolidation scheduler...");

    // Daily: Light consolidation (compress handoffs)
    const dailyInterval = setInterval(async () => {
      try {
        await this.runDailyConsolidation(tenant_id);
      } catch (error) {
        console.error("[Consolidation] Daily job failed:", error);
      }
    }, 24 * 60 * 60 * 1000); // Every 24 hours

    // Weekly: Medium consolidation (identity + decisions)
    const weeklyInterval = setInterval(async () => {
      try {
        await this.runWeeklyConsolidation(tenant_id);
      } catch (error) {
        console.error("[Consolidation] Weekly job failed:", error);
      }
    }, 7 * 24 * 60 * 60 * 1000); // Every 7 days

    this.intervals.push(dailyInterval, weeklyInterval);

    // Run initial consolidation after a delay
    setTimeout(() => {
      this.runDailyConsolidation(tenant_id);
    }, 5000); // 5 seconds after start

    console.log("[Consolidation] Scheduler started");
  }

  /**
   * Stop all consolidation schedules
   */
  stop(): void {
    console.log("[Consolidation] Stopping consolidation scheduler...");
    this.intervals.forEach((interval) => clearInterval(interval));
    this.intervals = [];
    console.log("[Consolidation] Scheduler stopped");
  }

  /**
   * Daily consolidation: Light compression
   */
  private async runDailyConsolidation(tenant_id: string): Promise<void> {
    console.log(`[Consolidation] Running daily consolidation for tenant: ${tenant_id}`);

    const results = await this.consolidationService.consolidateAll(tenant_id);

    for (const result of results) {
      console.log(
        `[Consolidation] ${result.job_type}: ` +
          `${result.items_affected} items affected, ` +
          `${result.tokens_saved} tokens saved`
      );
    }
  }

  /**
   * Weekly consolidation: Medium compression
   */
  private async runWeeklyConsolidation(tenant_id: string): Promise<void> {
    console.log(`[Consolidation] Running weekly consolidation for tenant: ${tenant_id}`);

    // Get consolidation stats
    const stats = await this.consolidationService.getConsolidationStats(tenant_id);

    console.log(
      `[Consolidation] Weekly stats: ` +
        `${stats.stats.length} records, ` +
        `${stats.total_tokens_saved} total tokens saved`
    );
  }

  /**
   * Manual trigger for consolidation (for testing or admin use)
   */
  async triggerConsolidation(
    tenant_id: string = "default",
    job_type?: "identity_consolidation" | "handoff_compression" | "decision_archival" | "all"
  ): Promise<any> {
    console.log(`[Consolidation] Manual trigger: ${job_type || "all"} for tenant: ${tenant_id}`);

    if (job_type === "identity_consolidation") {
      return await this.consolidationService.consolidateIdentityThread(tenant_id);
    } else if (job_type === "handoff_compression") {
      return await this.consolidationService.compressHandoffs(tenant_id);
    } else if (job_type === "decision_archival") {
      return await this.consolidationService.archiveDecisions(tenant_id);
    } else {
      return await this.consolidationService.consolidateAll(tenant_id);
    }
  }
}
