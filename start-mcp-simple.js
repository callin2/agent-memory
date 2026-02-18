#!/usr/bin/env node

/**
 * Ultra-simple MCP launcher - no dependencies, direct execution
 */

const { spawn } = require("child_process");

const proc = spawn("npx", ["tsx", "src/mcp/memory-server.ts"], {
  cwd: "/Users/callin/Callin_Project/agent_memory_v2",
  stdio: "inherit",
  env: {
    ...process.env,
    PGHOST: "localhost",
    PGPORT: "5432",
    PGDATABASE: "agent_memory_dev",
    PGUSER: "agent_mem_dba",
    PGPASSWORD: "adminqwer1234",
  },
});

proc.on("error", (err) => {
  console.error("MCP server error:", err);
  process.exit(1);
});

proc.on("exit", (code) => {
  process.exit(code ?? 0);
});
