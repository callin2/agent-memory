type McpEnvProfile = "dev" | "prod";

function normalizeMcpEnv(value: string | undefined): McpEnvProfile | undefined {
  const v = (value || "").trim().toLowerCase();
  if (v === "dev") {
    return "dev";
  }
  if (v === "prod" || v === "production") {
    return "prod";
  }
  return undefined;
}

/**
 * Apply opinionated defaults for running the server in MCP (stdio) mode.
 *
 * Intended for MCP clients (e.g. OpenCode) so they can set a single env var:
 *   MCP_ENV=dev|prod
 *
 * Notes:
 * - Runs only in `--mcp` mode.
 * - Sets a few safe defaults and avoids hardcoding secrets.
 * - Allows explicit environment variables to override by setting them BEFORE launch.
 */
export function applyMcpEnvDefaults(): void {
  if (!process.argv.includes("--mcp")) {
    return;
  }

  const profile = normalizeMcpEnv(process.env.MCP_ENV);
  if (!profile) {
    return;
  }

  if (profile === "dev") {
    // Development: enable unauthenticated local MCP for clients that can't send auth.
    process.env.NODE_ENV = "development";
    process.env.MCP_ALLOW_UNAUTHENTICATED = "true";
    process.env.MCP_TENANT_ID = process.env.MCP_TENANT_ID || "local";
    process.env.MCP_USER_ID = process.env.MCP_USER_ID || "opencode";

    // Local DB defaults for MCP-only usage. Keep PGPASSWORD unset so users can use
    // `.env`, `.pgpass`, or other OS-level credential mechanisms.
    process.env.PGHOST = process.env.PGHOST || "127.0.0.1";
    process.env.PGPORT = process.env.PGPORT || "5433";
    process.env.PGDATABASE = process.env.PGDATABASE || "agent_memory";
    process.env.PGUSER = process.env.PGUSER || "memory";
    return;
  }

  // Production: disable any local auth bypass.
  process.env.NODE_ENV = "production";
  process.env.MCP_ALLOW_UNAUTHENTICATED = "false";
}
