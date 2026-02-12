/**
 * Integration Tests: Capsule API Endpoints
 *
 * Tests for capsule transfer system endpoints:
 * - POST /api/v1/capsules (create capsule)
 * - GET /api/v1/capsules (list available capsules)
 * - GET /api/v1/capsules/:capsule_id (get capsule)
 * - DELETE /api/v1/capsules/:capsule_id (revoke capsule)
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import request from "supertest";
import { Pool } from "pg";
import { app } from "../../../src/server.js";
import { generateId } from "../../../src/utils/id-generator.js";
import { generateToken } from "../../../src/middleware/auth.js";

describe("Capsule API Integration Tests", () => {
  let pool: Pool;
  const tenantId = "test-tenant-capsule-api";
  const agentAlice = "agent-alice-api";
  const agentBob = "agent-bob-api";
  const agentCharlie = "agent-charlie-api";
  const userId = "user-jack-api";
  const projectId = "project-alpha-api";
  const sessionId = "sess-capsule-api";
  const authToken = `Bearer ${generateToken(tenantId, agentAlice, ["agent"])}`;

  beforeAll(async () => {
    pool = new Pool({
      host: process.env.PGHOST || "localhost",
      port: Number(process.env.PGPORT) || 5432,
      database: process.env.PGDATABASE || "agent_memory_test",
      user: process.env.PGUSER || "postgres",
      password: process.env.PGPASSWORD || "",
    });

    // Create test tenant and users
    await pool.query(
      "INSERT INTO tenants (tenant_id, name, settings) VALUES ($1, $2, $3)",
      [tenantId, "Test Tenant Capsule API", "{}"],
    );

    for (const agentId of [agentAlice, agentBob, agentCharlie]) {
      await pool.query(
        "INSERT INTO users (user_id, tenant_id, username, password_hash, roles) VALUES ($1, $2, $3, $4, $5)",
        [agentId, tenantId, agentId, "hash", ["agent"]],
      );
    }

    // Create test chunks
    for (let i = 1; i <= 5; i++) {
      const chunkId = generateId("chk");

      const text = `Test chunk ${i} about Jack Doe`;
      const eventId = generateId("evt");

      await pool.query(
        `INSERT INTO events (event_id, tenant_id, session_id, channel, actor_type, actor_id, kind, content, scope, subject_type, subject_id, project_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
        [
          eventId,
          tenantId,
          sessionId,
          "private",
          "agent",
          agentAlice,
          "message",
          JSON.stringify({ text }),
          "user",
          "user",
          userId,
          projectId,
        ],
      );

      await pool.query(
        `INSERT INTO chunks (chunk_id, tenant_id, event_id, ts, kind, channel, token_est, importance, text, scope, subject_type, subject_id, project_id)
         VALUES ($1, $2, $3, NOW(), $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
        [
          chunkId,
          tenantId,
          eventId,
          "message",
          "private",
          16,
          0.5 + i * 0.1,
          text,
          "user",
          "user",
          userId,
          projectId,
        ],
      );
    }

    // Create test decisions
    for (let i = 1; i <= 2; i++) {
      const decisionId = generateId("dec");
      await pool.query(
        `INSERT INTO decisions (decision_id, tenant_id, decision, scope, subject_type, subject_id, project_id, status, rationale)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          decisionId,
          tenantId,
          `Test decision ${i}`,
          "project",
          "project",
          projectId,
          projectId,
          "active",
          ["R1"],
        ],
      );
    }
  });

  afterAll(async () => {
    // Cleanup
    await pool.query("DELETE FROM capsules WHERE tenant_id = $1", [tenantId]);
    await pool.query("DELETE FROM chunks WHERE tenant_id = $1", [tenantId]);
    await pool.query("DELETE FROM decisions WHERE tenant_id = $1", [tenantId]);
    await pool.query("DELETE FROM users WHERE tenant_id = $1", [tenantId]);
    await pool.query("DELETE FROM tenants WHERE tenant_id = $1", [tenantId]);
    await pool.end();
  });

  beforeEach(async () => {
    await pool.query("DELETE FROM capsules WHERE tenant_id = $1", [tenantId]);
  });

  describe("POST /api/v1/capsules", () => {
    it("should create a new capsule", async () => {
      const chunksResult = await pool.query(
        "SELECT chunk_id FROM chunks WHERE tenant_id = $1 LIMIT 3",
        [tenantId],
      );
      const decisionsResult = await pool.query(
        "SELECT decision_id FROM decisions WHERE tenant_id = $1 LIMIT 1",
        [tenantId],
      );

      const response = await request(app)
        .post("/api/v1/capsules")
        .set("Authorization", authToken)
        .send({
          tenant_id: tenantId,
          author_agent_id: agentAlice,
          subject_type: "user",
          subject_id: userId,
          scope: "user",
          audience_agent_ids: [agentBob],
          items: {
            chunks: chunksResult.rows.map((r) => r.chunk_id),
            decisions: decisionsResult.rows.map((r) => r.decision_id),
            artifacts: [],
          },
          ttl_days: 7,
          risks: ["Test risk"],
        });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty("capsule_id");
      expect(response.body).toHaveProperty("status", "active");
      expect(response.body).toHaveProperty("expires_at");
    });

    it("should validate that all referenced chunks exist", async () => {
      const response = await request(app)
        .post("/api/v1/capsules")
        .set("Authorization", authToken)
        .send({
          tenant_id: tenantId,
          author_agent_id: agentAlice,
          subject_type: "user",
          subject_id: userId,
          scope: "user",
          audience_agent_ids: [agentBob],
          items: {
            chunks: ["nonexistent-chunk-id"],
            decisions: [],
            artifacts: [],
          },
          ttl_days: 7,
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty("error");
    });

    it("should validate that all audience agents exist", async () => {
      const chunksResult = await pool.query(
        "SELECT chunk_id FROM chunks WHERE tenant_id = $1 LIMIT 1",
        [tenantId],
      );

      const response = await request(app)
        .post("/api/v1/capsules")
        .set("Authorization", authToken)
        .send({
          tenant_id: tenantId,
          author_agent_id: agentAlice,
          subject_type: "user",
          subject_id: userId,
          scope: "user",
          audience_agent_ids: ["nonexistent-agent"],
          items: {
            chunks: chunksResult.rows.map((r) => r.chunk_id),
            decisions: [],
            artifacts: [],
          },
          ttl_days: 7,
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty("error");
    });

    it("should calculate expires_at from ttl_days", async () => {
      const chunksResult = await pool.query(
        "SELECT chunk_id FROM chunks WHERE tenant_id = $1 LIMIT 1",
        [tenantId],
      );
      const ttlDays = 14;

      const response = await request(app)
        .post("/api/v1/capsules")
        .set("Authorization", authToken)
        .send({
          tenant_id: tenantId,
          author_agent_id: agentAlice,
          subject_type: "user",
          subject_id: userId,
          scope: "user",
          audience_agent_ids: [agentBob],
          items: {
            chunks: chunksResult.rows.map((r) => r.chunk_id),
            decisions: [],
            artifacts: [],
          },
          ttl_days: ttlDays,
        });

      expect(response.status).toBe(201);
      const expiresAt = new Date(response.body.expires_at);
      const now = new Date();
      const daysDiff = Math.round(
        (expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
      );
      expect(daysDiff).toBe(ttlDays);
    });

    it("should default to 7 days TTL if not specified", async () => {
      const chunksResult = await pool.query(
        "SELECT chunk_id FROM chunks WHERE tenant_id = $1 LIMIT 1",
        [tenantId],
      );

      const response = await request(app)
        .post("/api/v1/capsules")
        .set("Authorization", authToken)
        .send({
          tenant_id: tenantId,
          author_agent_id: agentAlice,
          subject_type: "user",
          subject_id: userId,
          scope: "user",
          audience_agent_ids: [agentBob],
          items: {
            chunks: chunksResult.rows.map((r) => r.chunk_id),
            decisions: [],
            artifacts: [],
          },
        });

      expect(response.status).toBe(201);
      const expiresAt = new Date(response.body.expires_at);
      const now = new Date();
      const daysDiff = Math.round(
        (expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
      );
      expect(daysDiff).toBe(7);
    });
  });

  describe("GET /api/v1/capsules", () => {
    let capsule1Id: string;
    let capsule2Id: string;

    beforeEach(async () => {
      const chunksResult = await pool.query(
        "SELECT chunk_id FROM chunks WHERE tenant_id = $1",
        [tenantId],
      );

      // Create capsule for agent-bob
      const result1 = await pool.query(
        `INSERT INTO capsules (capsule_id, tenant_id, scope, subject_type, subject_id, author_agent_id, ttl_days, status, audience_agent_ids, items, risks, created_at, expires_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW() + INTERVAL '7 days')
         RETURNING capsule_id`,
        [
          generateId("cap"),
          tenantId,
          "user",
          "user",
          userId,
          agentAlice,
          7,
          "active",
          [agentBob],
          JSON.stringify({
            chunks: chunksResult.rows.slice(0, 2).map((r) => r.chunk_id),
            decisions: [],
            artifacts: [],
          }),
          [],
        ],
      );
      capsule1Id = result1.rows[0].capsule_id;

      // Create capsule for agent-charlie
      const result2 = await pool.query(
        `INSERT INTO capsules (capsule_id, tenant_id, scope, subject_type, subject_id, author_agent_id, ttl_days, status, audience_agent_ids, items, risks, created_at, expires_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW() + INTERVAL '7 days')
         RETURNING capsule_id`,
        [
          generateId("cap"),
          tenantId,
          "user",
          "user",
          userId,
          agentAlice,
          7,
          "active",
          [agentCharlie],
          JSON.stringify({
            chunks: chunksResult.rows.slice(2, 4).map((r) => r.chunk_id),
            decisions: [],
            artifacts: [],
          }),
          [],
        ],
      );
      capsule2Id = result2.rows[0].capsule_id;
    });

    it("should list capsules available to the requesting agent", async () => {
      const response = await request(app)
        .get("/api/v1/capsules")
        .set("Authorization", authToken)
        .query({ tenant_id: tenantId, agent_id: agentBob });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("capsules");
      expect(response.body).toHaveProperty("count");
      expect(response.body.count).toBe(1);
      expect(response.body.capsules[0].capsule_id).toBe(capsule1Id);
    });

    it("should not return capsules for non-audience agents", async () => {
      const response = await request(app)
        .get("/api/v1/capsules")
        .set("Authorization", authToken)
        .query({ tenant_id: tenantId, agent_id: agentCharlie });

      expect(response.status).toBe(200);
      expect(
        response.body.capsules.every((c: any) => c.capsule_id !== capsule1Id),
      ).toBe(true);
    });

    it("should filter by subject_type and subject_id", async () => {
      const response = await request(app)
        .get("/api/v1/capsules")
        .set("Authorization", authToken)
        .query({
          tenant_id: tenantId,
          agent_id: agentBob,
          subject_type: "user",
          subject_id: userId,
        });

      expect(response.status).toBe(200);
      expect(response.body.capsules[0].subject_type).toBe("user");
      expect(response.body.capsules[0].subject_id).toBe(userId);
    });

    it("should require tenant_id and agent_id parameters", async () => {
      const response = await request(app)
        .get("/api/v1/capsules")
        .set("Authorization", authToken);

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty("error");
    });
  });

  describe("GET /api/v1/capsules/:capsule_id", () => {
    let capsuleId: string;

    beforeEach(async () => {
      const chunksResult = await pool.query(
        "SELECT chunk_id FROM chunks WHERE tenant_id = $1 LIMIT 2",
        [tenantId],
      );

      const result = await pool.query(
        `INSERT INTO capsules (capsule_id, tenant_id, scope, subject_type, subject_id, author_agent_id, ttl_days, status, audience_agent_ids, items, risks, created_at, expires_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW() + INTERVAL '7 days')
         RETURNING capsule_id`,
        [
          generateId("cap"),
          tenantId,
          "user",
          "user",
          userId,
          agentAlice,
          7,
          "active",
          [agentBob],
          JSON.stringify({
            chunks: chunksResult.rows.map((r) => r.chunk_id),
            decisions: [],
            artifacts: [],
          }),
          ["Test risk 1", "Test risk 2"],
        ],
      );
      capsuleId = result.rows[0].capsule_id;
    });

    it("should return capsule to audience agent", async () => {
      const response = await request(app)
        .get(`/api/v1/capsules/${capsuleId}`)
        .set("Authorization", authToken)
        .query({ agent_id: agentBob });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("capsule_id", capsuleId);
      expect(response.body).toHaveProperty("items");
      expect(response.body).toHaveProperty("risks");
      expect(response.body.risks.length).toBe(2);
    });

    it("should return 404 to non-audience agent", async () => {
      const response = await request(app)
        .get(`/api/v1/capsules/${capsuleId}`)
        .set("Authorization", authToken)
        .query({ agent_id: agentCharlie });

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty("error");
    });

    it("should return 404 for expired capsules", async () => {
      await pool.query(
        "UPDATE capsules SET expires_at = NOW() - INTERVAL '1 day' WHERE capsule_id = $1",
        [capsuleId],
      );

      const response = await request(app)
        .get(`/api/v1/capsules/${capsuleId}`)
        .set("Authorization", authToken)
        .query({ agent_id: agentBob });

      expect(response.status).toBe(404);
    });

    it("should require agent_id parameter", async () => {
      const response = await request(app)
        .get(`/api/v1/capsules/${capsuleId}`)
        .set("Authorization", authToken);

      expect(response.status).toBe(400);
    });
  });

  describe("DELETE /api/v1/capsules/:capsule_id", () => {
    let capsuleId: string;

    beforeEach(async () => {
      const chunksResult = await pool.query(
        "SELECT chunk_id FROM chunks WHERE tenant_id = $1 LIMIT 1",
        [tenantId],
      );

      const result = await pool.query(
        `INSERT INTO capsules (capsule_id, tenant_id, scope, subject_type, subject_id, author_agent_id, ttl_days, status, audience_agent_ids, items, risks, created_at, expires_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW() + INTERVAL '7 days')
         RETURNING capsule_id`,
        [
          generateId("cap"),
          tenantId,
          "user",
          "user",
          userId,
          agentAlice,
          7,
          "active",
          [agentBob, agentCharlie],
          JSON.stringify({
            chunks: chunksResult.rows.map((r) => r.chunk_id),
            decisions: [],
            artifacts: [],
          }),
          [],
        ],
      );
      capsuleId = result.rows[0].capsule_id;
    });

    it("should revoke an active capsule", async () => {
      const response = await request(app)
        .delete(`/api/v1/capsules/${capsuleId}`)
        .set("Authorization", authToken)
        .send({ tenant_id: tenantId });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("capsule_id", capsuleId);
      expect(response.body).toHaveProperty("status", "revoked");
      expect(response.body).toHaveProperty("revoked_at");

      // Verify capsule is revoked in database
      const result = await pool.query(
        "SELECT status FROM capsules WHERE capsule_id = $1",
        [capsuleId],
      );
      expect(result.rows[0].status).toBe("revoked");
    });

    it("should return 404 for non-existent capsule", async () => {
      const response = await request(app)
        .delete("/api/v1/capsules/nonexistent-capsule")
        .set("Authorization", authToken)
        .send({ tenant_id: tenantId });

      expect(response.status).toBe(404);
    });

    it("should require tenant_id in request body", async () => {
      const response = await request(app)
        .delete(`/api/v1/capsules/${capsuleId}`)
        .set("Authorization", authToken);

      expect(response.status).toBe(400);
    });

    it("should prevent access to revoked capsule", async () => {
      // Revoke capsule
      await request(app)
        .delete(`/api/v1/capsules/${capsuleId}`)
        .set("Authorization", authToken)
        .send({ tenant_id: tenantId });

      // Try to get revoked capsule
      const response = await request(app)
        .get(`/api/v1/capsules/${capsuleId}`)
        .set("Authorization", authToken)
        .query({ agent_id: agentBob });

      expect(response.status).toBe(404);
    });
  });

  describe("Capsule audience enforcement", () => {
    it("should enforce audience restrictions across all operations", async () => {
      const chunksResult = await pool.query(
        "SELECT chunk_id FROM chunks WHERE tenant_id = $1 LIMIT 1",
        [tenantId],
      );

      const capsuleResult = await pool.query(
        `INSERT INTO capsules (capsule_id, tenant_id, scope, subject_type, subject_id, author_agent_id, ttl_days, status, audience_agent_ids, items, risks, created_at, expires_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW() + INTERVAL '7 days')
         RETURNING capsule_id`,
        [
          generateId("cap"),
          tenantId,
          "user",
          "user",
          userId,
          agentAlice,
          7,
          "active",
          [agentBob], // Only agent-bob in audience
          JSON.stringify({
            chunks: chunksResult.rows.map((r) => r.chunk_id),
            decisions: [],
            artifacts: [],
          }),
          [],
        ],
      );
      const capsuleId = capsuleResult.rows[0].capsule_id;

      // agent-charlie should not be able to access
      const response = await request(app)
        .get(`/api/v1/capsules/${capsuleId}`)
        .set("Authorization", authToken)
        .query({ agent_id: agentCharlie });

      expect(response.status).toBe(404);
    });
  });
});
