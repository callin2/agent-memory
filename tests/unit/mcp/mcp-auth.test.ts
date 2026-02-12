/**
 * Unit Tests: MCP Server Authentication
 *
 * Tests for MCP server authentication, authorization, and tenant isolation
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { Pool } from "pg";
import { MCPServer } from "../../../src/mcp/server.js";
import { generateToken } from "../../../src/middleware/auth.js";
import { APIKeyService } from "../../../src/services/api-key-service.js";

describe("MCP Server Authentication", () => {
  let pool: Pool;
  let mcpServer: MCPServer;
  let apiKeyService: APIKeyService;

  beforeEach(async () => {
    pool = new Pool({
      host: process.env.PGHOST || "localhost",
      port: Number(process.env.PGPORT) || 5432,
      database: process.env.PGDATABASE || "agent_memory_test",
      user: process.env.PGUSER || "postgres",
      password: process.env.PGPASSWORD || "",
    });

    mcpServer = new MCPServer(pool);
    apiKeyService = new APIKeyService(pool);

    // DB schema is bootstrapped by tests/vitest.setup.ts

    // Create test user
    await pool.query(
      `INSERT INTO users (user_id, tenant_id, username, password_hash, roles)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (user_id) DO NOTHING`,
      ["test_user_1", "tenant_1", "testuser", "hash", ["user"]],
    );

    // Create test event
    await pool.query(
      `INSERT INTO events (event_id, tenant_id, session_id, channel, actor_type, actor_id, kind, content)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (event_id) DO NOTHING`,
      [
        "evt_aaaaaaaaaaaaaaaa",
        "tenant_1",
        "sess_1",
        "private",
        "human",
        "user_1",
        "message",
        '{"text": "test"}',
      ],
    );

    // Create test decision
    await pool.query(
      `INSERT INTO decisions (decision_id, tenant_id, status, scope, decision)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (decision_id) DO NOTHING`,
      ["dec_1", "tenant_1", "active", "project", "Test decision"],
    );
  });

  afterEach(async () => {
    const tenants = ["tenant_1", "tenant_2"];
    await pool.query("DELETE FROM audit_logs WHERE tenant_id = ANY($1)", [
      tenants,
    ]);
    await pool.query("DELETE FROM memory_edits WHERE tenant_id = ANY($1)", [
      tenants,
    ]);
    await pool.query("DELETE FROM capsules WHERE tenant_id = ANY($1)", [
      tenants,
    ]);
    await pool.query("DELETE FROM chunks WHERE tenant_id = ANY($1)", [tenants]);
    await pool.query("DELETE FROM events WHERE tenant_id = ANY($1)", [tenants]);
    await pool.query("DELETE FROM decisions WHERE tenant_id = ANY($1)", [
      tenants,
    ]);
    await pool.query("DELETE FROM api_keys WHERE tenant_id = ANY($1)", [
      tenants,
    ]);
    await pool.query("DELETE FROM users WHERE tenant_id = ANY($1)", [tenants]);
    await pool.end();
  });

  describe("initialize - Authentication Validation", () => {
    it("should reject initialize without authorization", async () => {
      const response = await mcpServer.handleMessage({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {},
      });

      expect(response.error).toBeDefined();
      expect(response.error?.message).toContain("Missing authorization");
    });

    it("should reject initialize with invalid JWT", async () => {
      const response = await mcpServer.handleMessage({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          authorization: {
            type: "bearer",
            token: "invalid.jwt.token",
          },
        },
      });

      expect(response.error).toBeDefined();
      expect(response.error?.message).toContain("Invalid token or API key");
    });

    it("should reject initialize with invalid API key", async () => {
      const response = await mcpServer.handleMessage({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          authorization: {
            type: "api_key",
            token: "ak_invalid_key",
          },
        },
      });

      expect(response.error).toBeDefined();
      expect(response.error?.message).toContain("Invalid token or API key");
    });

    it("should accept initialize with valid JWT", async () => {
      const token = generateToken("tenant_1", "test_user_1", ["user"]);

      const response = await mcpServer.handleMessage({
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

      expect(response.error).toBeUndefined();
      expect(response.result).toBeDefined();
      expect(response.result?.serverInfo?.name).toBe("agent-memory-system");
    });

    it("should accept initialize with valid API key", async () => {
      const { apiKey } = await apiKeyService.generateAPIKey(
        "tenant_1",
        "test_user_1",
        "Test Key",
      );

      const response = await mcpServer.handleMessage({
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

      expect(response.error).toBeUndefined();
      expect(response.result).toBeDefined();
    });

    it("should log authentication events to audit_logs", async () => {
      const token = generateToken("tenant_1", "test_user_1", ["user"]);

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

      const result = await pool.query(
        `SELECT * FROM audit_logs
         WHERE event_type = 'auth.mcp_connection'
         AND outcome = 'success'
         AND user_id = $1`,
        ["test_user_1"],
      );

      expect(result.rows.length).toBe(1);
      expect(result.rows[0].action).toBe("mcp_connection");
    });
  });

  describe("Tool Call Authentication", () => {
    it("should reject tool calls before initialize", async () => {
      const response = await mcpServer.handleMessage({
        jsonrpc: "2.0",
        id: 1,
        method: "tools/call",
        params: {
          name: "memory_record_event",
          arguments: {
            tenant_id: "tenant_1",
            session_id: "sess_1",
            channel: "private",
            actor: { type: "human", id: "user_1" },
            kind: "message",
            content: { text: "test" },
          },
        },
      });

      expect(response.error).toBeDefined();
      expect(response.error?.message).toContain("Not authenticated");
    });

    it("should attach user context to tool calls after successful initialize", async () => {
      const token = generateToken("tenant_1", "test_user_1", ["user"]);

      // First initialize
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

      // Then call a tool
      const response = await mcpServer.handleMessage({
        jsonrpc: "2.0",
        id: 2,
        method: "tools/call",
        params: {
          name: "memory_query_decisions",
          arguments: {
            tenant_id: "should_be_overridden",
            status: "active",
          },
        },
      });

      expect(response.error).toBeUndefined();
      expect(response.result).toBeDefined();
    });
  });

  describe("Tenant Isolation", () => {
    it("should enforce tenant isolation in record_event", async () => {
      const token = generateToken("tenant_1", "test_user_1", ["user"]);

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

      // Try to record event for different tenant
      const response = await mcpServer.handleMessage({
        jsonrpc: "2.0",
        id: 2,
        method: "tools/call",
        params: {
          name: "memory_record_event",
          arguments: {
            tenant_id: "tenant_2", // Different tenant
            session_id: "sess_1",
            channel: "private",
            actor: { type: "human", id: "user_1" },
            kind: "message",
            content: { text: "test" },
          },
        },
      });

      expect(response.error).toBeUndefined();

      // Verify event was recorded with tenant_1 (not tenant_2)
      const result = await pool.query(
        `SELECT * FROM events WHERE session_id = 'sess_1' ORDER BY ts DESC LIMIT 1`,
      );

      expect(result.rows[0].tenant_id).toBe("tenant_1");
    });

    it("should enforce tenant isolation in build_acb", async () => {
      const token = generateToken("tenant_1", "test_user_1", ["user"]);

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

      const response = await mcpServer.handleMessage({
        jsonrpc: "2.0",
        id: 2,
        method: "tools/call",
        params: {
          name: "memory_build_acb",
          arguments: {
            tenant_id: "tenant_2", // Should be overridden
            session_id: "sess_1",
            agent_id: "agent_1",
            channel: "private",
            intent: "test",
          },
        },
      });

      expect(response.error).toBeUndefined();
    });

    it("should enforce tenant isolation in query_decisions", async () => {
      const token = generateToken("tenant_1", "test_user_1", ["user"]);

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

      const response = await mcpServer.handleMessage({
        jsonrpc: "2.0",
        id: 2,
        method: "tools/call",
        params: {
          name: "memory_query_decisions",
          arguments: {
            tenant_id: "tenant_2", // Should be overridden
            status: "active",
          },
        },
      });

      expect(response.error).toBeUndefined();
      expect(response.result?.data).toBeDefined();
      // Should only return decisions for tenant_1
      expect(
        response.result?.data.every((d: any) => d.tenant_id === "tenant_1"),
      ).toBe(true);
    });

    it("should prevent cross-tenant event access in get_event", async () => {
      // Create event for tenant_2
      await pool.query(
        `INSERT INTO events (event_id, tenant_id, session_id, channel, actor_type, actor_id, kind, content)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          "evt_2",
          "tenant_2",
          "sess_2",
          "private",
          "human",
          "user_2",
          "message",
          '{"text": "secret"}',
        ],
      );

      const token = generateToken("tenant_1", "test_user_1", ["user"]);

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

      const response = await mcpServer.handleMessage({
        jsonrpc: "2.0",
        id: 2,
        method: "tools/call",
        params: {
          name: "memory_get_event",
          arguments: {
            event_id: "evt_2", // Event from tenant_2
          },
        },
      });

      expect(response.error).toBeDefined();
      expect(response.error?.message).toContain("Access denied");
    });

    it("should allow access to events from own tenant", async () => {
      const token = generateToken("tenant_1", "test_user_1", ["user"]);

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

      const response = await mcpServer.handleMessage({
        jsonrpc: "2.0",
        id: 2,
        method: "tools/call",
        params: {
          name: "memory_get_event",
          arguments: {
            event_id: "evt_1", // Event from tenant_1
          },
        },
      });

      expect(response.error).toBeUndefined();
      expect(response.result).toBeDefined();
    });
  });

  describe("Audit Logging", () => {
    it("should log all MCP tool calls to audit_logs", async () => {
      const token = generateToken("tenant_1", "test_user_1", ["user"]);

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

      await mcpServer.handleMessage({
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

      const result = await pool.query(
        `SELECT * FROM audit_logs
         WHERE event_type = 'mcp_tool_call'
         AND details->>'tool_name' = 'memory_query_decisions'
         AND user_id = $1`,
        ["test_user_1"],
      );

      expect(result.rows.length).toBe(1);
      expect(result.rows[0].outcome).toBe("success");
    });

    it("should redact sensitive content in audit logs", async () => {
      const token = generateToken("tenant_1", "test_user_1", ["user"]);

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

      await mcpServer.handleMessage({
        jsonrpc: "2.0",
        id: 2,
        method: "tools/call",
        params: {
          name: "memory_record_event",
          arguments: {
            session_id: "sess_1",
            channel: "private",
            actor: { type: "human", id: "user_1" },
            kind: "message",
            content: { text: "sensitive data", password: "secret123" },
          },
        },
      });

      const result = await pool.query(
        `SELECT details FROM audit_logs
         WHERE event_type = 'mcp_tool_call'
         AND details->>'tool_name' = 'memory_record_event'
         AND user_id = $1`,
        ["test_user_1"],
      );

      const details = result.rows[0].details;
      expect(details.args.content).toBe("[REDACTED]");
    });

    it("should log denied access attempts", async () => {
      // Create event for different tenant
      await pool.query(
        `INSERT INTO events (event_id, tenant_id, session_id, channel, actor_type, actor_id, kind, content)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          "evt_denied",
          "tenant_2",
          "sess_2",
          "private",
          "human",
          "user_2",
          "message",
          '{"text": "secret"}',
        ],
      );

      const token = generateToken("tenant_1", "test_user_1", ["user"]);

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

      await mcpServer.handleMessage({
        jsonrpc: "2.0",
        id: 2,
        method: "tools/call",
        params: {
          name: "memory_get_event",
          arguments: {
            event_id: "evt_denied",
          },
        },
      });

      const result = await pool.query(
        `SELECT * FROM audit_logs
         WHERE event_type = 'mcp_access_denied'
         AND action = 'get_event'
         AND outcome = 'failure'`,
      );

      expect(result.rows.length).toBe(1);
      expect(result.rows[0].details.reason).toBe("tenant_mismatch");
    });
  });

  describe("Error Responses", () => {
    it("should return correct error code for missing auth", async () => {
      const response = await mcpServer.handleMessage({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {},
      });

      expect(response.error?.code).toBeDefined();
      expect(response.error?.message).toContain("Missing authorization");
    });

    it("should return correct error code for invalid token", async () => {
      const response = await mcpServer.handleMessage({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          authorization: {
            type: "bearer",
            token: "invalid",
          },
        },
      });

      expect(response.error?.code).toBeDefined();
      expect(response.error?.message).toContain("Invalid token or API key");
    });

    it("should return correct error for tool call before init", async () => {
      const response = await mcpServer.handleMessage({
        jsonrpc: "2.0",
        id: 1,
        method: "tools/call",
        params: {
          name: "memory_query_decisions",
          arguments: {},
        },
      });

      expect(response.error?.message).toContain("Not authenticated");
    });
  });
});
