#!/usr/bin/env node

/**
 * Final MCP launcher - works in any environment
 * Uses only node builtins, no external dependencies
 */

const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");

// Absolute paths for reliability
const SERVER_DIR = "/Users/callin/Callin_Project/agent_memory_v2";
const TSX_BIN = path.join(SERVER_DIR, "node_modules", ".bin", "tsx");
const NPX_BIN = "/opt/homebrew/bin/npx";
const NODE_BIN = "/opt/homebrew/bin/node";

// Debug logging
const debug = process.env.MCP_DEBUG === "1";

if (debug) {
  console.error("[MCP] Starting memory system server...");
  console.error("[MCP] SERVER_DIR:", SERVER_DIR);
  console.error("[MCP] NODE_BIN:", NODE_BIN);
  console.error("[MCP] NPX_BIN:", NPX_BIN);
  console.error("[MCP] TSX_BIN:", TSX_BIN);
  console.error("[MCP] PATH:", process.env.PATH);
}

// Check if tsx exists locally
const useLocalTsx = fs.existsSync(TSX_BIN);
if (debug) {
  console.error("[MCP] Using local tsx:", useLocalTsx);
}

// Environment
const serverEnv = {
  PATH: `/opt/homebrew/bin:/usr/bin:/bin:${process.env.PATH}`,
  PGHOST: "localhost",
  PGPORT: "5432",
  PGDATABASE: "agent_memory_dev",
  PGUSER: "agent_mem_dba",
  PGPASSWORD: process.env.PGPASSWORD || "adminqwer1234",
  ...process.env,
};

// Spawn server
const args = ["tsx", "src/mcp/memory-server.ts"];
const serverProc = spawn(NPX_BIN, args, {
  cwd: SERVER_DIR,
  stdio: "inherit",
  env: serverEnv,
});

serverProc.on("error", (err) => {
  console.error("[MCP] Failed to start:", err.message);
  process.exit(1);
});

serverProc.on("exit", (code) => {
  if (debug) console.error(`[MCP] Exited: ${code}`);
  process.exit(code ?? 0);
});
