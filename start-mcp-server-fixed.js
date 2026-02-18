#!/usr/bin/env node

/**
 * Robust MCP server launcher with absolute paths
 * Works reliably when launched from any context (Claude Code, shell scripts, etc.)
 */

const { spawn } = require("child_process");
const path = require("path");

// Use absolute paths for everything
const serverDir = "/Users/callin/Callin_Project/agent_memory_v2";
const npxPath = "/opt/homebrew/bin/npx";
const tsxPath = "/opt/homebrew/bin/tsx";
const tsxLocalPath = path.join(serverDir, "node_modules", ".bin", "tsx");

// Try local tsx first (more reliable), fall back to global tsx
const tsxToUse = tsxLocalPath;

console.error(`[MCP Launcher] Starting memory server...`);
console.error(`[MCP Launcher] Server dir: ${serverDir}`);
console.error(`[MCP Launcher] Using tsx: ${tsxToUse}`);

// Spawn npx tsx with proper working directory and environment
const serverProcess = spawn(npxPath, ["tsx", "src/mcp/memory-server.ts"], {
  cwd: serverDir,
  stdio: "inherit",
  env: {
    ...process.env,
    PATH: `/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:${process.env.PATH}`,
    PGHOST: process.env.PGHOST || "localhost",
    PGPORT: process.env.PGPORT || "5432",
    PGDATABASE: process.env.PGDATABASE || "agent_memory_dev",
    PGUSER: process.env.PGUSER || "agent_mem_dba",
    PGPASSWORD: process.env.PGPASSWORD || "adminqwer1234",
  },
});

serverProcess.on("error", (err) => {
  console.error("[MCP Launcher] Failed to start MCP server:", err);
  process.exit(1);
});

serverProcess.on("exit", (code) => {
  console.error(`[MCP Launcher] Server exited with code ${code}`);
  process.exit(code ?? 0);
});
