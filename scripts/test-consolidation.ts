import { Pool } from "pg";
import { ConsolidationService } from "../src/services/consolidation.js";

const pool = new Pool({
  host: process.env.PGHOST || "localhost",
  port: Number(process.env.PGPORT) || 5432,
  database: process.env.PGDATABASE || "agent_memory_dev",
  user: process.env.PGUSER || "agent_mem_dba",
  password: process.env.PGPASSWORD || "adminqwer1234",
});

async function testConsolidation() {
  console.log("Testing consolidation system...\n");

  const service = new ConsolidationService(pool);

  try {
    // Run all consolidation jobs
    console.log("1. Running all consolidation jobs...");
    const results = await service.consolidateAll("default");

    console.log("\nResults:");
    for (const result of results) {
      console.log(`\n${result.job_type}:`);
      console.log(`  - Items processed: ${result.items_processed}`);
      console.log(`  - Items affected: ${result.items_affected}`);
      console.log(`  - Tokens saved: ${result.tokens_saved}`);
      console.log(`  - Details:`, JSON.stringify(result.details, null, 2));
    }

    // Get stats
    console.log("\n2. Getting consolidation stats...");
    const stats = await service.getConsolidationStats("default");
    console.log("\nStats:", JSON.stringify(stats, null, 2));

    console.log("\n✅ Consolidation test completed!");
  } catch (error) {
    console.error("\n❌ Error:", error);
    throw error;
  } finally {
    await pool.end();
  }
}

testConsolidation();
