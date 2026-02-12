import { afterAll } from "vitest";
import { Pool } from "pg";
import { readFile, readdir } from "fs/promises";
import path from "path";

function sanitizeIdent(value: string): string {
  return value.replace(/[^a-zA-Z0-9_]/g, "_");
}

function getWorkerId(): string {
  return sanitizeIdent(
    process.env.VITEST_POOL_ID || process.env.VITEST_WORKER_ID || "0",
  );
}

function stripCreateExtensions(sql: string): string {
  return sql
    .split("\n")
    .filter((line) => !line.trim().toUpperCase().startsWith("CREATE EXTENSION"))
    .join("\n");
}

// Ensure tests never fight over a fixed port when importing `src/server.ts`.
// Force these so a user's shell env can't leak.
process.env.NODE_ENV = "test";
process.env.PORT = "0";

// Create an isolated schema per test file (per worker process).
const g = globalThis as any;
g.__VITEST_SCHEMA_COUNTER = (g.__VITEST_SCHEMA_COUNTER || 0) + 1;

const schemaName = `vt_${getWorkerId()}_${g.__VITEST_SCHEMA_COUNTER}`;
process.env.PGSCHEMA = schemaName;

const basePgConfig = {
  host: process.env.PGHOST || "localhost",
  port: Number(process.env.PGPORT) || 5432,
  database: process.env.PGDATABASE || "agent_memory_dev",
  user: process.env.PGUSER || "postgres",
  password: process.env.PGPASSWORD || "",
};

// Create schema + bootstrap tables/migrations before any test module code runs.
{
  const prevPgOptions = process.env.PGOPTIONS;
  delete process.env.PGOPTIONS;

  const adminPool = new Pool(basePgConfig);
  const client = await adminPool.connect();
  try {
    await client.query(`CREATE SCHEMA IF NOT EXISTS "${schemaName}"`);
    await client.query(`SET search_path TO "${schemaName}", public`);

    const schemaSqlPath = path.join(process.cwd(), "src", "db", "schema.sql");
    const rawSchemaSql = await readFile(schemaSqlPath, "utf8");
    await client.query(stripCreateExtensions(rawSchemaSql));

    const migrationsDir = path.join(process.cwd(), "src", "db", "migrations");
    const migrationFiles = (await readdir(migrationsDir))
      .filter((f) => f.endsWith(".sql") && f !== "010_rollbacks.sql")
      .sort((a, b) => {
        const aNum = parseInt(a.split("_")[0].replace(/[^0-9]/g, ""), 10);
        const bNum = parseInt(b.split("_")[0].replace(/[^0-9]/g, ""), 10);
        return aNum - bNum;
      });

    for (const file of migrationFiles) {
      const sql = await readFile(path.join(migrationsDir, file), "utf8");
      try {
        await client.query("BEGIN");
        await client.query(sql);
        await client.query("COMMIT");
      } catch (err: any) {
        await client.query("ROLLBACK");
        // Allow idempotent replays and existing objects.
        const msg = String(err?.message || err);
        if (!msg.includes("already exists") && !msg.includes("duplicate key")) {
          throw err;
        }
      }
    }
  } finally {
    client.release();
    await adminPool.end();
    process.env.PGOPTIONS = `-c search_path=${schemaName},public`;
    if (prevPgOptions && prevPgOptions.trim().length > 0) {
      // Preserve any user-supplied options by appending.
      process.env.PGOPTIONS = `${process.env.PGOPTIONS} ${prevPgOptions}`;
    }
  }
}

afterAll(async () => {
  const prevPgOptions = process.env.PGOPTIONS;
  delete process.env.PGOPTIONS;
  const pool = new Pool(basePgConfig);
  try {
    await pool.query(`DROP SCHEMA IF EXISTS "${schemaName}" CASCADE`);
  } finally {
    await pool.end();
    process.env.PGOPTIONS = prevPgOptions;
  }
});
