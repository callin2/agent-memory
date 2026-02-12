/**
 * Integration Tests: Memory Edit API Endpoints
 *
 * Tests for memory surgery endpoints:
 * - POST /api/v1/edits (create memory edit)
 * - GET /api/v1/edits (list edits with filters)
 * - GET /api/v1/edits/:edit_id (get edit details)
 * - PUT /api/v1/edits/:edit_id/approve (approve pending edit)
 * - PUT /api/v1/edits/:edit_id/reject (reject pending edit)
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import request from "supertest";
import { Pool } from "pg";
import { app } from "../../../src/server.js";
import { generateId } from "../../../src/utils/id-generator.js";
import { generateToken } from "../../../src/middleware/auth.js";

describe("Memory Edit API Integration Tests", () => {
  let pool: Pool;
  const tenantId = "test-tenant-edit-api";
  const agentId = "agent-edit-api";
  const userId = "user-edit-api";
  const sessionId = "sess-edit-api";
  const authToken = `Bearer ${generateToken(tenantId, agentId, ["agent"])}`;

  beforeAll(async () => {
    pool = new Pool({
      host: process.env.PGHOST || "localhost",
      port: Number(process.env.PGPORT) || 5432,
      database: process.env.PGDATABASE || "agent_memory_test",
      user: process.env.PGUSER || "postgres",
      password: process.env.PGPASSWORD || "",
    });

    // Create test tenant and user
    await pool.query(
      "INSERT INTO tenants (tenant_id, name, settings) VALUES ($1, $2, $3)",
      [tenantId, "Test Tenant Edit API", "{}"],
    );

    await pool.query(
      "INSERT INTO users (user_id, tenant_id, username, password_hash, roles) VALUES ($1, $2, $3, $4, $5)",
      [agentId, tenantId, "agent-edit", "hash", ["agent"]],
    );

    // Create test chunks
    const chunks = [
      {
        id: generateId("chk"),
        text: "Original text that will be amended",
        importance: 0.5,
      },
      {
        id: generateId("chk"),
        text: "Text that will be retracted",
        importance: 0.7,
      },
      {
        id: generateId("chk"),
        text: "Text that will be quarantined",
        importance: 0.6,
      },
      {
        id: generateId("chk"),
        text: "Important text to be attenuated",
        importance: 0.9,
      },
      {
        id: generateId("chk"),
        text: "Internal team discussion",
        importance: 0.5,
      },
    ];

    for (const chunk of chunks) {
      const eventId = generateId("evt");

      await pool.query(
        `INSERT INTO events (event_id, tenant_id, session_id, channel, actor_type, actor_id, kind, content, scope, subject_type, subject_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        [
          eventId,
          tenantId,
          sessionId,
          "private",
          "agent",
          agentId,
          "message",
          JSON.stringify({ text: chunk.text }),
          "user",
          "user",
          userId,
        ],
      );

      await pool.query(
        `INSERT INTO chunks (chunk_id, tenant_id, event_id, ts, kind, channel, token_est, importance, text, scope, subject_type, subject_id)
         VALUES ($1, $2, $3, NOW(), $4, $5, $6, $7, $8, $9, $10, $11)`,
        [
          chunk.id,
          tenantId,
          eventId,
          "message",
          "private",
          16,
          chunk.importance,
          chunk.text,
          "user",
          "user",
          userId,
        ],
      );
    }
  });

  afterAll(async () => {
    // Cleanup
    await pool.query("DELETE FROM memory_edits WHERE tenant_id = $1", [
      tenantId,
    ]);
    await pool.query("DELETE FROM chunks WHERE tenant_id = $1", [tenantId]);
    await pool.query("DELETE FROM users WHERE tenant_id = $1", [tenantId]);
    await pool.query("DELETE FROM tenants WHERE tenant_id = $1", [tenantId]);
    await pool.end();
  });

  beforeEach(async () => {
    await pool.query("DELETE FROM memory_edits WHERE tenant_id = $1", [
      tenantId,
    ]);
  });

  describe("POST /api/v1/edits", () => {
    it("should create a retract edit", async () => {
      const chunkResult = await pool.query(
        "SELECT chunk_id FROM chunks WHERE tenant_id = $1 AND text LIKE '%retracted%' LIMIT 1",
        [tenantId],
      );

      const response = await request(app)
        .post("/api/v1/edits")
        .set("Authorization", authToken)
        .send({
          tenant_id: tenantId,
          target_type: "chunk",
          target_id: chunkResult.rows[0].chunk_id,
          op: "retract",
          reason: "PII violation",
          proposed_by: "human",
          patch: {},
          auto_approve: true,
        });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty("edit_id");
      expect(response.body).toHaveProperty("status", "approved");
      expect(response.body).toHaveProperty("applied_at");
    });

    it("should create an amend edit", async () => {
      const chunkResult = await pool.query(
        "SELECT chunk_id FROM chunks WHERE tenant_id = $1 AND text LIKE '%amended%' LIMIT 1",
        [tenantId],
      );

      const response = await request(app)
        .post("/api/v1/edits")
        .set("Authorization", authToken)
        .send({
          tenant_id: tenantId,
          target_type: "chunk",
          target_id: chunkResult.rows[0].chunk_id,
          op: "amend",
          reason: "Correct customer name",
          proposed_by: "agent",
          patch: {
            text: "Amended text with corrections",
            importance: 0.8,
          },
          auto_approve: true,
        });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty("edit_id");
      expect(response.body).toHaveProperty("status", "approved");

      // Verify edit was applied
      const effectiveResult = await pool.query(
        "SELECT * FROM effective_chunks WHERE chunk_id = $1",
        [chunkResult.rows[0].chunk_id],
      );
      expect(effectiveResult.rows[0].text).toBe(
        "Amended text with corrections",
      );
      expect(effectiveResult.rows[0].importance).toBe(0.8);
    });

    it("should create a quarantine edit", async () => {
      const chunkResult = await pool.query(
        "SELECT chunk_id FROM chunks WHERE tenant_id = $1 AND text LIKE '%quarantined%' LIMIT 1",
        [tenantId],
      );

      const response = await request(app)
        .post("/api/v1/edits")
        .set("Authorization", authToken)
        .send({
          tenant_id: tenantId,
          target_type: "chunk",
          target_id: chunkResult.rows[0].chunk_id,
          op: "quarantine",
          reason: "Unverified information",
          proposed_by: "human",
          patch: {},
          auto_approve: true,
        });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty("status", "approved");

      // Verify quarantine flag
      const effectiveResult = await pool.query(
        "SELECT * FROM effective_chunks WHERE chunk_id = $1",
        [chunkResult.rows[0].chunk_id],
      );
      expect(effectiveResult.rows[0].is_quarantined).toBe(true);
    });

    it("should create an attenuate edit with delta", async () => {
      const chunkResult = await pool.query(
        "SELECT chunk_id FROM chunks WHERE tenant_id = $1 AND text LIKE '%attenuated%' LIMIT 1",
        [tenantId],
      );

      const response = await request(app)
        .post("/api/v1/edits")
        .set("Authorization", authToken)
        .send({
          tenant_id: tenantId,
          target_type: "chunk",
          target_id: chunkResult.rows[0].chunk_id,
          op: "attenuate",
          reason: "Lower priority",
          proposed_by: "agent",
          patch: {
            importance_delta: -0.5,
          },
          auto_approve: true,
        });

      expect(response.status).toBe(201);

      // Verify importance was reduced
      const effectiveResult = await pool.query(
        "SELECT * FROM effective_chunks WHERE chunk_id = $1",
        [chunkResult.rows[0].chunk_id],
      );
      expect(effectiveResult.rows[0].importance).toBeCloseTo(0.4); // 0.9 - 0.5
    });

    it("should create a block edit", async () => {
      const chunkResult = await pool.query(
        "SELECT chunk_id FROM chunks WHERE tenant_id = $1 AND text LIKE '%Internal%' LIMIT 1",
        [tenantId],
      );

      const response = await request(app)
        .post("/api/v1/edits")
        .set("Authorization", authToken)
        .send({
          tenant_id: tenantId,
          target_type: "chunk",
          target_id: chunkResult.rows[0].chunk_id,
          op: "block",
          reason: "Internal discussion only",
          proposed_by: "human",
          patch: {
            channel: "public",
          },
          auto_approve: true,
        });

      expect(response.status).toBe(201);

      // Verify blocked channel
      const effectiveResult = await pool.query(
        "SELECT * FROM effective_chunks WHERE chunk_id = $1",
        [chunkResult.rows[0].chunk_id],
      );
      expect(effectiveResult.rows[0].blocked_channels).toContain("public");
    });

    it("should create pending edit when auto_approve is false", async () => {
      const chunkResult = await pool.query(
        "SELECT chunk_id FROM chunks WHERE tenant_id = $1 LIMIT 1",
        [tenantId],
      );

      const response = await request(app)
        .post("/api/v1/edits")
        .set("Authorization", authToken)
        .send({
          tenant_id: tenantId,
          target_type: "chunk",
          target_id: chunkResult.rows[0].chunk_id,
          op: "amend",
          reason: "Pending approval",
          proposed_by: "agent",
          patch: {
            text: "Pending text",
          },
          auto_approve: false,
        });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty("status", "pending");
      expect(response.body.applied_at).toBeNull();
    });

    it("should validate target exists", async () => {
      const response = await request(app)
        .post("/api/v1/edits")
        .set("Authorization", authToken)
        .send({
          tenant_id: tenantId,
          target_type: "chunk",
          target_id: "nonexistent-chunk",
          op: "retract",
          reason: "Test",
          proposed_by: "agent",
          patch: {},
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty("error");
    });

    it("should validate amend has required patch fields", async () => {
      const chunkResult = await pool.query(
        "SELECT chunk_id FROM chunks WHERE tenant_id = $1 LIMIT 1",
        [tenantId],
      );

      const response = await request(app)
        .post("/api/v1/edits")
        .set("Authorization", authToken)
        .send({
          tenant_id: tenantId,
          target_type: "chunk",
          target_id: chunkResult.rows[0].chunk_id,
          op: "amend",
          reason: "Test",
          proposed_by: "agent",
          patch: {}, // Missing text or importance
        });

      expect(response.status).toBe(400);
    });

    it("should validate attenuate has required patch fields", async () => {
      const chunkResult = await pool.query(
        "SELECT chunk_id FROM chunks WHERE tenant_id = $1 LIMIT 1",
        [tenantId],
      );

      const response = await request(app)
        .post("/api/v1/edits")
        .set("Authorization", authToken)
        .send({
          tenant_id: tenantId,
          target_type: "chunk",
          target_id: chunkResult.rows[0].chunk_id,
          op: "attenuate",
          reason: "Test",
          proposed_by: "agent",
          patch: {}, // Missing importance_delta or importance
        });

      expect(response.status).toBe(400);
    });

    it("should validate block has required patch fields", async () => {
      const chunkResult = await pool.query(
        "SELECT chunk_id FROM chunks WHERE tenant_id = $1 LIMIT 1",
        [tenantId],
      );

      const response = await request(app)
        .post("/api/v1/edits")
        .set("Authorization", authToken)
        .send({
          tenant_id: tenantId,
          target_type: "chunk",
          target_id: chunkResult.rows[0].chunk_id,
          op: "block",
          reason: "Test",
          proposed_by: "agent",
          patch: {}, // Missing channel
        });

      expect(response.status).toBe(400);
    });
  });

  describe("GET /api/v1/edits", () => {
    beforeEach(async () => {
      const chunksResult = await pool.query(
        "SELECT chunk_id FROM chunks WHERE tenant_id = $1",
        [tenantId],
      );

      // Create edits with different statuses
      await pool.query(
        `INSERT INTO memory_edits (edit_id, tenant_id, target_type, target_id, op, reason, proposed_by, status, patch, created_at, applied_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())`,
        [
          generateId("edt"),
          tenantId,
          "chunk",
          chunksResult.rows[0].chunk_id,
          "amend",
          "Test 1",
          "agent",
          "approved",
          JSON.stringify({ text: "Text 1" }),
        ],
      );

      await pool.query(
        `INSERT INTO memory_edits (edit_id, tenant_id, target_type, target_id, op, reason, proposed_by, status, patch, created_at, applied_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NULL)`,
        [
          generateId("edt"),
          tenantId,
          "chunk",
          chunksResult.rows[1].chunk_id,
          "retract",
          "Test 2",
          "agent",
          "pending",
          "{}",
        ],
      );

      await pool.query(
        `INSERT INTO memory_edits (edit_id, tenant_id, target_type, target_id, op, reason, proposed_by, status, patch, created_at, applied_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())`,
        [
          generateId("edt"),
          tenantId,
          "chunk",
          chunksResult.rows[2].chunk_id,
          "quarantine",
          "Test 3",
          "human",
          "approved",
          "{}",
        ],
      );
    });

    it("should list all edits for tenant", async () => {
      const response = await request(app)
        .get("/api/v1/edits")
        .set("Authorization", authToken)
        .query({ tenant_id: tenantId });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("edits");
      expect(response.body).toHaveProperty("count");
      expect(response.body.count).toBe(3);
    });

    it("should filter by status", async () => {
      const response = await request(app)
        .get("/api/v1/edits")
        .set("Authorization", authToken)
        .query({
          tenant_id: tenantId,
          status: "pending",
        });

      expect(response.status).toBe(200);
      expect(
        response.body.edits.every((e: any) => e.status === "pending"),
      ).toBe(true);
    });

    it("should filter by target_type", async () => {
      const response = await request(app)
        .get("/api/v1/edits")
        .set("Authorization", authToken)
        .query({
          tenant_id: tenantId,
          target_type: "chunk",
        });

      expect(response.status).toBe(200);
      expect(
        response.body.edits.every((e: any) => e.target_type === "chunk"),
      ).toBe(true);
    });

    it("should filter by proposed_by", async () => {
      const response = await request(app)
        .get("/api/v1/edits")
        .set("Authorization", authToken)
        .query({
          tenant_id: tenantId,
          proposed_by: "agent",
        });

      expect(response.status).toBe(200);
      expect(
        response.body.edits.every((e: any) => e.proposed_by === "agent"),
      ).toBe(true);
    });

    it("should respect limit parameter", async () => {
      const response = await request(app)
        .get("/api/v1/edits")
        .set("Authorization", authToken)
        .query({
          tenant_id: tenantId,
          limit: 2,
        });

      expect(response.status).toBe(200);
      expect(response.body.edits.length).toBe(2);
    });

    it("should require tenant_id parameter", async () => {
      const response = await request(app)
        .get("/api/v1/edits")
        .set("Authorization", authToken);

      expect(response.status).toBe(400);
    });
  });

  describe("GET /api/v1/edits/:edit_id", () => {
    it("should return edit details", async () => {
      const chunkResult = await pool.query(
        "SELECT chunk_id FROM chunks WHERE tenant_id = $1 LIMIT 1",
        [tenantId],
      );

      const insertResult = await pool.query(
        `INSERT INTO memory_edits (edit_id, tenant_id, target_type, target_id, op, reason, proposed_by, status, patch, created_at, applied_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
         RETURNING edit_id`,
        [
          generateId("edt"),
          tenantId,
          "chunk",
          chunkResult.rows[0].chunk_id,
          "amend",
          "Test",
          "agent",
          "approved",
          JSON.stringify({ text: "New text" }),
        ],
      );

      const editId = insertResult.rows[0].edit_id;

      const response = await request(app)
        .get(`/api/v1/edits/${editId}`)
        .set("Authorization", authToken);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("edit_id", editId);
      expect(response.body).toHaveProperty("target_type", "chunk");
      expect(response.body).toHaveProperty("op", "amend");
      expect(response.body).toHaveProperty("status", "approved");
      expect(response.body).toHaveProperty("patch");
    });

    it("should return 404 for non-existent edit", async () => {
      const response = await request(app)
        .get("/api/v1/edits/nonexistent-edit")
        .set("Authorization", authToken);

      expect(response.status).toBe(404);
    });
  });

  describe("PUT /api/v1/edits/:edit_id/approve", () => {
    it("should approve a pending edit", async () => {
      const chunkResult = await pool.query(
        "SELECT chunk_id FROM chunks WHERE tenant_id = $1 LIMIT 1",
        [tenantId],
      );

      const insertResult = await pool.query(
        `INSERT INTO memory_edits (edit_id, tenant_id, target_type, target_id, op, reason, proposed_by, status, patch, created_at, applied_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NULL)
         RETURNING edit_id`,
        [
          generateId("edt"),
          tenantId,
          "chunk",
          chunkResult.rows[0].chunk_id,
          "amend",
          "Test",
          "agent",
          "pending",
          JSON.stringify({ text: "Approved text" }),
        ],
      );

      const editId = insertResult.rows[0].edit_id;

      const response = await request(app)
        .put(`/api/v1/edits/${editId}/approve`)
        .set("Authorization", authToken)
        .send({ approved_by: "admin-user" });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("edit_id", editId);
      expect(response.body).toHaveProperty("status", "approved");
      expect(response.body).toHaveProperty("approved_by", "admin-user");
      expect(response.body).toHaveProperty("applied_at");
    });

    it("should return 404 for non-pending edit", async () => {
      const chunkResult = await pool.query(
        "SELECT chunk_id FROM chunks WHERE tenant_id = $1 LIMIT 1",
        [tenantId],
      );

      const insertResult = await pool.query(
        `INSERT INTO memory_edits (edit_id, tenant_id, target_type, target_id, op, reason, proposed_by, status, patch, created_at, applied_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
         RETURNING edit_id`,
        [
          generateId("edt"),
          tenantId,
          "chunk",
          chunkResult.rows[0].chunk_id,
          "amend",
          "Test",
          "agent",
          "approved",
          JSON.stringify({ text: "Text" }),
        ],
      );

      const editId = insertResult.rows[0].edit_id;

      const response = await request(app)
        .put(`/api/v1/edits/${editId}/approve`)
        .set("Authorization", authToken)
        .send({ approved_by: "admin-user" });

      expect(response.status).toBe(404);
    });

    it("should require approved_by in request body", async () => {
      const chunkResult = await pool.query(
        "SELECT chunk_id FROM chunks WHERE tenant_id = $1 LIMIT 1",
        [tenantId],
      );

      const insertResult = await pool.query(
        `INSERT INTO memory_edits (edit_id, tenant_id, target_type, target_id, op, reason, proposed_by, status, patch, created_at, applied_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NULL)
         RETURNING edit_id`,
        [
          generateId("edt"),
          tenantId,
          "chunk",
          chunkResult.rows[0].chunk_id,
          "amend",
          "Test",
          "agent",
          "pending",
          JSON.stringify({ text: "Text" }),
        ],
      );

      const editId = insertResult.rows[0].edit_id;

      const response = await request(app)
        .put(`/api/v1/edits/${editId}/approve`)
        .set("Authorization", authToken);

      expect(response.status).toBe(400);
    });
  });

  describe("PUT /api/v1/edits/:edit_id/reject", () => {
    it("should reject a pending edit", async () => {
      const chunkResult = await pool.query(
        "SELECT chunk_id FROM chunks WHERE tenant_id = $1 LIMIT 1",
        [tenantId],
      );

      const insertResult = await pool.query(
        `INSERT INTO memory_edits (edit_id, tenant_id, target_type, target_id, op, reason, proposed_by, status, patch, created_at, applied_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NULL)
         RETURNING edit_id`,
        [
          generateId("edt"),
          tenantId,
          "chunk",
          chunkResult.rows[0].chunk_id,
          "amend",
          "Test",
          "agent",
          "pending",
          JSON.stringify({ text: "Text" }),
        ],
      );

      const editId = insertResult.rows[0].edit_id;

      const response = await request(app)
        .put(`/api/v1/edits/${editId}/reject`)
        .set("Authorization", authToken);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("edit_id", editId);
      expect(response.body).toHaveProperty("status", "rejected");
    });

    it("should return 404 for non-pending edit", async () => {
      const chunkResult = await pool.query(
        "SELECT chunk_id FROM chunks WHERE tenant_id = $1 LIMIT 1",
        [tenantId],
      );

      const insertResult = await pool.query(
        `INSERT INTO memory_edits (edit_id, tenant_id, target_type, target_id, op, reason, proposed_by, status, patch, created_at, applied_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
         RETURNING edit_id`,
        [
          generateId("edt"),
          tenantId,
          "chunk",
          chunkResult.rows[0].chunk_id,
          "amend",
          "Test",
          "agent",
          "approved",
          JSON.stringify({ text: "Text" }),
        ],
      );

      const editId = insertResult.rows[0].edit_id;

      const response = await request(app)
        .put(`/api/v1/edits/${editId}/reject`)
        .set("Authorization", authToken);

      expect(response.status).toBe(404);
    });
  });

  describe("Edit application verification", () => {
    it("should correctly apply multiple edits to same chunk", async () => {
      const chunkResult = await pool.query(
        "SELECT chunk_id FROM chunks WHERE tenant_id = $1 LIMIT 1",
        [tenantId],
      );
      const chunkId = chunkResult.rows[0].chunk_id;

      // Apply first edit: amend text
      await pool.query(
        `INSERT INTO memory_edits (edit_id, tenant_id, target_type, target_id, op, reason, proposed_by, status, patch, created_at, applied_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())`,
        [
          generateId("edt"),
          tenantId,
          "chunk",
          chunkId,
          "amend",
          "First edit",
          "agent",
          "approved",
          JSON.stringify({ text: "First amendment", importance: 0.7 }),
        ],
      );

      // Apply second edit: attenuate importance
      await pool.query(
        `INSERT INTO memory_edits (edit_id, tenant_id, target_type, target_id, op, reason, proposed_by, status, patch, created_at, applied_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())`,
        [
          generateId("edt"),
          tenantId,
          "chunk",
          chunkId,
          "attenuate",
          "Second edit",
          "agent",
          "approved",
          JSON.stringify({ importance_delta: -0.2 }),
        ],
      );

      // Check effective_chunks - should apply latest edit by applied_at
      const result = await pool.query(
        "SELECT * FROM effective_chunks WHERE chunk_id = $1",
        [chunkId],
      );

      // Latest edit should be applied
      expect(result.rows[0].text).toBe("First amendment");
      expect(result.rows[0].importance).toBeCloseTo(0.5); // 0.7 - 0.2
      expect(result.rows[0].edits_applied_count).toBe(2);
    });
  });
});
