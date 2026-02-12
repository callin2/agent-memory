/**
 * Integration Tests: MCP Authentication Flow
 *
 * Complete end-to-end tests for MCP server authentication
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { Pool } from "pg";
import { MCPServer } from "../../src/mcp/server.js";
import { generateToken } from "../../src/middleware/auth.js";
import { APIKeyService } from "../../src/services/api-key-service.js";
import { AuditService } from "../../src/services/audit-service.js";

describe("MCP Authentication Flow Integration Tests", () => {
  let pool: Pool;
  let mcpServer: MCPServer;
  let apiKeyService: APIKeyService;
  let auditService: AuditService;

  beforeAll(async () => {
    pool = new Pool({
      host: process.env.PGHOST || "localhost",
      port: Number(process.env.PGPORT) || 5432,
      database: process.env.PGDATABASE || "agent_memory_test",
      user: process.env.PGUSER || "postgres",
      password: process.env.PGPASSWORD || "",
    });

    // Setup complete schema
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        user_id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL,
        username TEXT NOT NULL,
        password_hash TEXT NOT NULL,
        roles TEXT[] NOT NULL DEFAULT '{user}',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS api_keys (
        key_id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL,
        created_by TEXT NOT NULL,
        key_hash TEXT NOT NULL UNIQUE,
        key_prefix TEXT NOT NULL,
        name TEXT NOT NULL,
        scopes TEXT[] NOT NULL DEFAULT '{}',
        expires_at TIMESTAMPTZ,
        last_used_at TIMESTAMPTZ,
        usage_count INT NOT NULL DEFAULT 0,
        rate_limit INT,
        is_active BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS events (
        event_id TEXT PRIMARY KEY,
        ts TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        tenant_id TEXT NOT NULL,
        session_id TEXT NOT NULL,
        channel TEXT NOT NULL CHECK (channel IN ('private', 'public', 'team', 'agent')),
        actor_type TEXT NOT NULL CHECK (actor_type IN ('human', 'agent', 'tool')),
        actor_id TEXT NOT NULL,
        kind TEXT NOT NULL CHECK (kind IN ('message', 'tool_call', 'tool_result', 'decision', 'task_update', 'artifact')),
        sensitivity TEXT NOT NULL DEFAULT 'none' CHECK (sensitivity IN ('none', 'low', 'high', 'secret')),
        tags TEXT[] NOT NULL DEFAULT '{}',
        content JSONB NOT NULL,
        refs TEXT[] NOT NULL DEFAULT '{}'
      );

      CREATE TABLE IF NOT EXISTS chunks (
        chunk_id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL,
        event_id TEXT NOT NULL REFERENCES events(event_id) ON DELETE CASCADE,
        ts TIMESTAMPTZ NOT NULL,
        kind TEXT NOT NULL,
        channel TEXT NOT NULL,
        sensitivity TEXT NOT NULL DEFAULT 'none',
        tags TEXT[] NOT NULL DEFAULT '{}',
        token_est INT NOT NULL,
        importance REAL NOT NULL DEFAULT 0.0,
        text TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS decisions (
        decision_id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL,
        ts TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        status TEXT NOT NULL CHECK (status IN ('active', 'superseded')),
        scope TEXT NOT NULL CHECK (scope IN ('project', 'user', 'global')),
        decision TEXT NOT NULL,
        rationale TEXT[] NOT NULL DEFAULT '{}',
        constraints TEXT[] NOT NULL DEFAULT '{}',
        alternatives TEXT[] NOT NULL DEFAULT '{}',
        consequences TEXT[] NOT NULL DEFAULT '{}',
        refs TEXT[] NOT NULL DEFAULT '{}'
      );

      CREATE TABLE IF NOT EXISTS audit_logs (
        log_id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL,
        user_id TEXT,
        event_type TEXT NOT NULL,
        resource_type TEXT,
        resource_id TEXT,
        action TEXT NOT NULL,
        outcome TEXT NOT NULL,
        ip_address TEXT,
        user_agent TEXT,
        details JSONB NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    // Create test users
    await pool.query(
      `INSERT INTO users (user_id, tenant_id, username, password_hash, roles)
       VALUES ($1, $2, $3, $4, $5)`,
      ["user_t1", "tenant_1", "user1", "hash", ["user"]],
    );

    await pool.query(
      `INSERT INTO users (user_id, tenant_id, username, password_hash, roles)
       VALUES ($1, $2, $3, $4, $5)`,
      ["user_t2", "tenant_2", "user2", "hash", ["user"]],
    );

    // Create test data for tenant_1
    await pool.query(
      `INSERT INTO events (event_id, tenant_id, session_id, channel, actor_type, actor_id, kind, content)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        "evt_t1_1",
        "tenant_1",
        "sess_t1",
        "private",
        "human",
        "user_t1",
        "message",
        '{"text": "Hello from tenant 1"}',
      ],
    );

    await pool.query(
      `INSERT INTO events (event_id, tenant_id, session_id, channel, actor_type, actor_id, kind, content)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        "evt_t1_2",
        "tenant_1",
        "sess_t1",
        "private",
        "human",
        "user_t1",
        "message",
        '{"text": "Another message"}',
      ],
    );

    await pool.query(
      `INSERT INTO decisions (decision_id, tenant_id, status, scope, decision)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        "dec_t1_1",
        "tenant_1",
        "active",
        "project",
        "Use TypeScript for backend",
      ],
    );

    // Create test data for tenant_2
    await pool.query(
      `INSERT INTO events (event_id, tenant_id, session_id, channel, actor_type, actor_id, kind, content)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        "evt_t2_1",
        "tenant_2",
        "sess_t2",
        "private",
        "human",
        "user_t2",
        "message",
        '{"text": "Secret from tenant 2"}',
      ],
    );

    await pool.query(
      `INSERT INTO decisions (decision_id, tenant_id, status, scope, decision)
       VALUES ($1, $2, $3, $4, $5)`,
      ["dec_t2_1", "tenant_2", "active", "project", "Use Python for ML"],
    );

    mcpServer = new MCPServer(pool);
    apiKeyService = new APIKeyService(pool);
    auditService = new AuditService(pool);
  });

  beforeEach(async () => {
    // Keep base fixtures (users/events/decisions), reset per-test mutable state.
    await pool.query("DELETE FROM audit_logs");
    await pool.query("DELETE FROM api_keys");
    mcpServer = new MCPServer(pool);
    apiKeyService = new APIKeyService(pool);
    auditService = new AuditService(pool);
  });

  afterAll(async () => {
    await pool.query("DROP TABLE IF EXISTS audit_logs CASCADE");
    await pool.query("DROP TABLE IF EXISTS decisions CASCADE");
    await pool.query("DROP TABLE IF EXISTS chunks CASCADE");
    await pool.query("DROP TABLE IF EXISTS events CASCADE");
    await pool.query("DROP TABLE IF EXISTS api_keys CASCADE");
    await pool.query("DROP TABLE IF EXISTS users CASCADE");
    await pool.end();
  });

  describe("Complete MCP Flow with JWT Authentication", () => {
    it("should authenticate, call tools, and maintain tenant isolation", async () => {
      const token = generateToken("tenant_1", "user_t1", ["user"]);

      // Step 1: Initialize with JWT
      const initResponse = await mcpServer.handleMessage({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          authorization: {
            type: "bearer",
            token,
          },
          clientInfo: {
            name: "test-client",
            version: "1.0.0",
          },
        },
      });

      expect(initResponse.error).toBeUndefined();
      expect(initResponse.result?.serverInfo?.name).toBe("agent-memory-system");

      // Step 2: List tools
      const listResponse = await mcpServer.handleMessage({
        jsonrpc: "2.0",
        id: 2,
        method: "tools/list",
        params: {},
      });

      expect(listResponse.result?.tools).toBeDefined();
      expect(listResponse.result?.tools.length).toBeGreaterThan(0);

      // Step 3: Record an event
      const recordResponse = await mcpServer.handleMessage({
        jsonrpc: "2.0",
        id: 3,
        method: "tools/call",
        params: {
          name: "memory_record_event",
          arguments: {
            session_id: "sess_new",
            channel: "private",
            actor: { type: "human", id: "user_t1" },
            kind: "message",
            content: { text: "New message from authenticated user" },
          },
        },
      });

      expect(recordResponse.error).toBeUndefined();
      expect(recordResponse.result?.content[0]?.text).toContain(
        "Event recorded",
      );

      // Step 4: Query decisions
      const queryResponse = await mcpServer.handleMessage({
        jsonrpc: "2.0",
        id: 4,
        method: "tools/call",
        params: {
          name: "memory_query_decisions",
          arguments: {
            status: "active",
          },
        },
      });

      expect(queryResponse.error).toBeUndefined();
      expect(queryResponse.result?.data).toBeDefined();
      // Should only return decisions for tenant_1
      expect(
        queryResponse.result?.data.every(
          (d: any) => d.tenant_id === "tenant_1",
        ),
      ).toBe(true);
    });

    it("should prevent cross-tenant data access", async () => {
      const token1 = generateToken("tenant_1", "user_t1", ["user"]);

      // Initialize as tenant_1 user
      await mcpServer.handleMessage({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          authorization: {
            type: "bearer",
            token: token1,
          },
        },
      });

      // Try to access tenant_2's event
      const getResponse = await mcpServer.handleMessage({
        jsonrpc: "2.0",
        id: 2,
        method: "tools/call",
        params: {
          name: "memory_get_event",
          arguments: {
            event_id: "evt_t2_1", // This belongs to tenant_2
          },
        },
      });

      expect(getResponse.error).toBeDefined();
      expect(getResponse.error?.message).toContain("Access denied");
    });
  });

  describe("Complete MCP Flow with API Key Authentication", () => {
    it("should authenticate with API key and call tools", async () => {
      // Generate API key for tenant_1
      const { apiKey } = await apiKeyService.generateAPIKey(
        "tenant_1",
        "user_t1",
        "Test API Key",
        ["read", "write"],
      );

      // Step 1: Initialize with API key
      const initResponse = await mcpServer.handleMessage({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          authorization: {
            type: "api_key",
            token: apiKey,
          },
        },
      });

      expect(initResponse.error).toBeUndefined();

      // Step 2: Query decisions
      const queryResponse = await mcpServer.handleMessage({
        jsonrpc: "2.0",
        id: 2,
        method: "tools/call",
        params: {
          name: "memory_query_decisions",
          arguments: {
            status: "active",
          },
        },
      });

      expect(queryResponse.error).toBeUndefined();
      expect(queryResponse.result?.data).toBeDefined();
    });

    it("should track API key usage", async () => {
      const { apiKey, keyId } = await apiKeyService.generateAPIKey(
        "tenant_1",
        "user_t1",
        "Trackable Key",
      );

      // Initialize and use the key
      await mcpServer.handleMessage({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          authorization: {
            type: "api_key",
            token: apiKey,
          },
        },
      });

      await mcpServer.handleMessage({
        jsonrpc: "2.0",
        id: 2,
        method: "tools/call",
        params: {
          name: "memory_query_decisions",
          arguments: {},
        },
      });

      // Check API key usage was tracked
      const keyData = await apiKeyService.getAPIKey(keyId, "tenant_1");
      expect(keyData?.usage_count).toBeGreaterThan(0);
      expect(keyData?.last_used_at).toBeDefined();
    });
  });

  describe("Failed Authentication Followed by Successful Retry", () => {
    it("should allow retry after failed authentication", async () => {
      // Step 1: Try to initialize with invalid token
      const failResponse = await mcpServer.handleMessage({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          authorization: {
            type: "bearer",
            token: "invalid.token.here",
          },
        },
      });

      expect(failResponse.error).toBeDefined();

      // Step 2: Retry with valid token
      const validToken = generateToken("tenant_1", "user_t1", ["user"]);
      const successResponse = await mcpServer.handleMessage({
        jsonrpc: "2.0",
        id: 2,
        method: "initialize",
        params: {
          authorization: {
            type: "bearer",
            token: validToken,
          },
        },
      });

      expect(successResponse.error).toBeUndefined();
      expect(successResponse.result?.serverInfo?.name).toBe(
        "agent-memory-system",
      );

      // Step 3: Verify tool calls work after retry
      const toolResponse = await mcpServer.handleMessage({
        jsonrpc: "2.0",
        id: 3,
        method: "tools/call",
        params: {
          name: "memory_query_decisions",
          arguments: {},
        },
      });

      expect(toolResponse.error).toBeUndefined();
    });
  });

  describe("Audit Logs Capture All MCP Operations", () => {
    it("should log complete authentication and tool usage flow", async () => {
      const token = generateToken("tenant_1", "user_t1", ["user"]);

      // Initialize
      await mcpServer.handleMessage({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          authorization: {
            type: "bearer",
            token,
          },
        },
      });

      // Call multiple tools
      await mcpServer.handleMessage({
        jsonrpc: "2.0",
        id: 2,
        method: "tools/call",
        params: {
          name: "memory_query_decisions",
          arguments: {},
        },
      });

      await mcpServer.handleMessage({
        jsonrpc: "2.0",
        id: 3,
        method: "tools/call",
        params: {
          name: "memory_get_event",
          arguments: {
            event_id: "evt_t1_1",
          },
        },
      });

      // Verify all operations were logged
      const logs = await auditService.queryAuditLogs("tenant_1", {
        userId: "user_t1",
      });

      expect(logs.length).toBeGreaterThan(0);

      // Check for specific log types
      const authLogs = logs.filter(
        (log) => log.event_type === "auth.mcp_connection",
      );
      expect(authLogs.length).toBe(1);
      expect(authLogs[0].outcome).toBe("success");

      const toolLogs = logs.filter((log) => log.event_type === "mcp_tool_call");
      expect(toolLogs.length).toBeGreaterThanOrEqual(2);
    });

    it("should log failed access attempts", async () => {
      const token = generateToken("tenant_1", "user_t1", ["user"]);

      await mcpServer.handleMessage({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          authorization: {
            type: "bearer",
            token,
          },
        },
      });

      // Try to access different tenant's event
      await mcpServer.handleMessage({
        jsonrpc: "2.0",
        id: 2,
        method: "tools/call",
        params: {
          name: "memory_get_event",
          arguments: {
            event_id: "evt_t2_1",
          },
        },
      });

      // Check that denied access was logged
      const logs = await auditService.queryAuditLogs("tenant_1", {
        userId: "user_t1",
      });

      const deniedLogs = logs.filter(
        (log) => log.event_type === "mcp_access_denied",
      );
      expect(deniedLogs.length).toBe(1);
      expect(deniedLogs[0].action).toBe("get_event");
      expect(deniedLogs[0].outcome).toBe("failure");
    });
  });

  describe("Multiple Concurrent Connections", () => {
    it("should handle multiple authenticated connections independently", async () => {
      // Create separate MCP server instances for different tenants
      const server1 = new MCPServer(pool);
      const server2 = new MCPServer(pool);

      const token1 = generateToken("tenant_1", "user_t1", ["user"]);
      const token2 = generateToken("tenant_2", "user_t2", ["user"]);

      // Initialize server1 with tenant_1
      await server1.handleMessage({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          authorization: {
            type: "bearer",
            token: token1,
          },
        },
      });

      // Initialize server2 with tenant_2
      await server2.handleMessage({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          authorization: {
            type: "bearer",
            token: token2,
          },
        },
      });

      // Query decisions from server1 (tenant_1)
      const response1 = await server1.handleMessage({
        jsonrpc: "2.0",
        id: 2,
        method: "tools/call",
        params: {
          name: "memory_query_decisions",
          arguments: {},
        },
      });

      // Query decisions from server2 (tenant_2)
      const response2 = await server2.handleMessage({
        jsonrpc: "2.0",
        id: 2,
        method: "tools/call",
        params: {
          name: "memory_query_decisions",
          arguments: {},
        },
      });

      // Verify each server only sees their tenant's data
      expect(
        response1.result?.data.every((d: any) => d.tenant_id === "tenant_1"),
      ).toBe(true);
      expect(
        response2.result?.data.every((d: any) => d.tenant_id === "tenant_2"),
      ).toBe(true);
    });
  });

  describe("Tool Schema Validation", () => {
    it("should provide correct tool schemas", async () => {
      const token = generateToken("tenant_1", "user_t1", ["user"]);

      await mcpServer.handleMessage({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          authorization: {
            type: "bearer",
            token,
          },
        },
      });

      const listResponse = await mcpServer.handleMessage({
        jsonrpc: "2.0",
        id: 2,
        method: "tools/list",
        params: {},
      });

      const tools = listResponse.result?.tools;

      // Check that required tools exist
      const toolNames = tools?.map((t: any) => t.name);
      expect(toolNames).toContain("memory_record_event");
      expect(toolNames).toContain("memory_build_acb");
      expect(toolNames).toContain("memory_get_event");
      expect(toolNames).toContain("memory_query_decisions");

      // Check tool schemas
      const recordEventTool = tools?.find(
        (t: any) => t.name === "memory_record_event",
      );
      expect(recordEventTool?.inputSchema).toBeDefined();
      expect(recordEventTool?.inputSchema?.type).toBe("object");
    });
  });
});
